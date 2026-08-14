import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import { processMetricAlert } from "./alerts.ts";
import { rcon } from "./rcon.ts";
import type { MetricSample, MonitoringResult } from "./types.ts";

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_POINTS = 180;
let writeQueue = Promise.resolve();
let samplesSinceCompaction = 0;

export function parseMetricText(text: string, since = 0) {
  const samples: MetricSample[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as MetricSample;
      const timestamp = Date.parse(value.at);
      if (
        timestamp >= since &&
        typeof value.connected === "boolean" &&
        typeof value.players === "number" &&
        typeof value.maxPlayers === "number"
      ) {
        samples.push(value);
      }
    } catch {
      // A partially written line must not hide the remaining monitoring history.
    }
  }
  return samples;
}

export function summarizeMetrics(
  samples: MetricSample[],
  highLatencyMs = 500,
): MonitoringResult["summary"] {
  const connected = samples.filter((sample) => sample.connected);
  let disconnects = 0;
  for (let index = 0; index < samples.length; index += 1) {
    if (!samples[index].connected && (index === 0 || samples[index - 1].connected)) {
      disconnects += 1;
    }
  }
  const latencies = connected
    .map((sample) => sample.latencyMs)
    .filter((value): value is number => value != null);
  const latest = samples.at(-1);
  return {
    availabilityPercent: samples.length
      ? Math.round((connected.length / samples.length) * 1000) / 10
      : 0,
    disconnects,
    averageLatencyMs: latencies.length
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : null,
    peakPlayers: Math.max(0, ...samples.map((sample) => sample.players)),
    currentAlert: !latest?.connected
      ? "disconnected"
      : (latest.latencyMs ?? 0) >= highLatencyMs
        ? "high_latency"
        : null,
  };
}

export function downsampleMetrics(samples: MetricSample[], maximum = MAX_POINTS) {
  if (samples.length <= maximum) return samples;
  const result: MetricSample[] = [];
  const bucketSize = samples.length / maximum;
  for (let index = 0; index < maximum; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    const bucket = samples.slice(start, end);
    const connected = bucket.filter((sample) => sample.connected);
    const latencies = connected
      .map((sample) => sample.latencyMs)
      .filter((value): value is number => value != null);
    const last = bucket.at(-1)!;
    result.push({
      at: last.at,
      connected: connected.length === bucket.length,
      players: Math.max(...bucket.map((sample) => sample.players)),
      maxPlayers: last.maxPlayers,
      map: last.map,
      latencyMs: latencies.length
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
      error: last.error,
    });
  }
  return result;
}

async function compactMetrics(file: string) {
  let size = 0;
  try {
    size = (await stat(file)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  samplesSinceCompaction += 1;
  if (size < 2 * 1024 * 1024 && samplesSinceCompaction < 120) return;
  samplesSinceCompaction = 0;
  let text = "";
  try {
    text = await readFile(/* turbopackIgnore: true */ file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const samples = parseMetricText(text, Date.now() - RETENTION_MS);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(
      temporary,
      samples.map((sample) => JSON.stringify(sample)).join("\n") +
        (samples.length ? "\n" : ""),
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function recordMetric(sample: MetricSample) {
  const file = config.METRICS_PATH;
  const write = writeQueue.then(async () => {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await compactMetrics(file);
    await appendFile(file, `${JSON.stringify(sample)}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(file, 0o600);
  });
  writeQueue = write.catch((error) => console.error("Metric write failed:", error));
  return write;
}

export async function collectMetric() {
  const at = new Date().toISOString();
  let sample: MetricSample;
  try {
    const { status, latencyMs } = await rcon.probeStatus();
    sample = {
      at,
      connected: true,
      players: status.players,
      maxPlayers: status.maxPlayers,
      map: status.map,
      latencyMs,
    };
  } catch (error) {
    sample = {
      at,
      connected: false,
      players: 0,
      maxPlayers: 0,
      map: null,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  await recordMetric(sample);
  await processMetricAlert(sample);
}

export async function readMonitoring(hours = 6): Promise<MonitoringResult> {
  let text = "";
  try {
    text = await readFile(/* turbopackIgnore: true */ config.METRICS_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const samples = parseMetricText(text, Date.now() - hours * 60 * 60 * 1000);
  return {
    samples: downsampleMetrics(samples),
    summary: summarizeMetrics(samples, config.ALERT_HIGH_LATENCY_MS),
  };
}

export async function readLatestMetric(): Promise<MetricSample | null> {
  try {
    const samples = parseMetricText(
      await readFile(/* turbopackIgnore: true */ config.METRICS_PATH, "utf8"),
    );
    return samples.at(-1) ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

declare global {
  var yacsrconMetricSampler: ReturnType<typeof setInterval> | undefined;
}

export function createNonReentrantTask(task: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return false;
    running = true;
    try {
      await task();
      return true;
    } finally {
      running = false;
    }
  };
}

export function startMetricSampler(intervalMs = 30_000) {
  if (globalThis.yacsrconMetricSampler) return;
  const run = createNonReentrantTask(collectMetric);
  void run().catch((error) => console.error("Metric collection failed:", error));
  globalThis.yacsrconMetricSampler = setInterval(() => {
    void run().catch((error) => console.error("Metric collection failed:", error));
  }, intervalMs);
  globalThis.yacsrconMetricSampler.unref();
}
