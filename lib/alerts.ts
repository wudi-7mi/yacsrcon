import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { audit } from "./audit.ts";
import { config } from "./config.ts";
import type { AlertEvent, AlertKind, AlertStatus, MetricSample } from "./types.ts";

export type AlertState = {
  active: AlertKind | null;
  disconnectedSamples: number;
  highLatencySamples: number;
  lastSentAt: string | null;
  lastSentEvent: AlertEvent | null;
};

export type AlertSettings = {
  disconnectSamples: number;
  highLatencyMs: number;
  highLatencySamples: number;
  cooldownMs: number;
};

const INITIAL_STATE: AlertState = {
  active: null,
  disconnectedSamples: 0,
  highLatencySamples: 0,
  lastSentAt: null,
  lastSentEvent: null,
};
let alertQueue = Promise.resolve();

export function evaluateAlert(
  previous: AlertState,
  sample: MetricSample,
  settings: AlertSettings,
  now = Date.now(),
): { state: AlertState; event: AlertEvent | null } {
  const disconnectedSamples = sample.connected
    ? 0
    : previous.disconnectedSamples + 1;
  const highLatencySamples =
    sample.connected && (sample.latencyMs ?? 0) >= settings.highLatencyMs
      ? previous.highLatencySamples + 1
      : 0;

  let active = previous.active;
  if (disconnectedSamples >= settings.disconnectSamples) {
    active = "disconnected";
  } else if (highLatencySamples >= settings.highLatencySamples) {
    active = "high_latency";
  } else if (sample.connected && previous.active === "disconnected") {
    active = null;
  } else if (
    sample.connected &&
    previous.active === "high_latency" &&
    (sample.latencyMs ?? 0) < settings.highLatencyMs
  ) {
    active = null;
  }

  let event: AlertEvent | null = null;
  if (previous.active === "disconnected" && active === null) {
    event = "recovered";
  } else if (previous.active === "high_latency" && active === null) {
    event = "latency_recovered";
  } else if (active !== previous.active && active) {
    event = active;
  } else if (
    active &&
    (!previous.lastSentAt ||
      previous.lastSentEvent !== active ||
      now - Date.parse(previous.lastSentAt) >= settings.cooldownMs)
  ) {
    event = active;
  }

  return {
    state: {
      active,
      disconnectedSamples,
      highLatencySamples,
      lastSentAt: previous.lastSentAt,
      lastSentEvent: previous.lastSentEvent,
    },
    event,
  };
}

async function readAlertState(): Promise<AlertState> {
  try {
    const value = JSON.parse(
      await readFile(/* turbopackIgnore: true */ config.ALERT_STATE_PATH, "utf8"),
    ) as Partial<AlertState>;
    if (
      (value.active === null || value.active === "disconnected" || value.active === "high_latency") &&
      Number.isInteger(value.disconnectedSamples) &&
      (value.disconnectedSamples ?? -1) >= 0 &&
      Number.isInteger(value.highLatencySamples) &&
      (value.highLatencySamples ?? -1) >= 0 &&
      (value.lastSentAt === null ||
        (typeof value.lastSentAt === "string" &&
          Number.isFinite(Date.parse(value.lastSentAt))))
    ) {
      return {
        ...(value as AlertState),
        lastSentEvent:
          value.lastSentEvent === "disconnected" ||
          value.lastSentEvent === "high_latency" ||
          value.lastSentEvent === "recovered" ||
          value.lastSentEvent === "latency_recovered" ||
          value.lastSentEvent === "test"
            ? value.lastSentEvent
            : null,
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Alert state read failed:", error);
    }
  }
  return { ...INITIAL_STATE };
}

async function writeAlertState(state: AlertState) {
  const file = config.ALERT_STATE_PATH;
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(state)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

function alertSettings(): AlertSettings {
  return {
    disconnectSamples: config.ALERT_DISCONNECT_SAMPLES,
    highLatencyMs: config.ALERT_HIGH_LATENCY_MS,
    highLatencySamples: config.ALERT_HIGH_LATENCY_SAMPLES,
    cooldownMs: config.ALERT_COOLDOWN_MINUTES * 60_000,
  };
}

function eventText(event: AlertEvent, sample?: MetricSample) {
  const values: Record<AlertEvent, [string, string, "info" | "warning" | "critical"]> = {
    disconnected: ["CS2 RCON 连接中断", "连续探测失败，服务器可能已停止或网络不可达。", "critical"],
    high_latency: ["CS2 RCON 延迟过高", `RCON 延迟达到 ${sample?.latencyMs ?? "未知"} ms。`, "warning"],
    recovered: ["CS2 RCON 已恢复", "服务器 RCON 连接已恢复。", "info"],
    latency_recovered: ["CS2 RCON 延迟已恢复", `当前延迟 ${sample?.latencyMs ?? "未知"} ms。`, "info"],
    test: ["YACSRCON 测试通知", "Webhook 配置有效，测试消息发送成功。", "info"],
  };
  return values[event];
}

export async function deliverWebhook(event: AlertEvent, sample?: MetricSample) {
  if (!config.WEBHOOK_URL) throw new Error("Webhook 尚未配置。");
  const [title, message, severity] = eventText(event, sample);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "YACSRCON/0.1",
  };
  if (config.WEBHOOK_TOKEN) headers.authorization = `Bearer ${config.WEBHOOK_TOKEN}`;
  const response = await fetch(config.WEBHOOK_URL, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(config.WEBHOOK_TIMEOUT_MS),
    body: JSON.stringify({
      source: "yacsrcon",
      event,
      severity,
      title,
      message,
      at: new Date().toISOString(),
      server: config.SERVER_NAME,
      details: sample
        ? {
            connected: sample.connected,
            players: sample.players,
            maxPlayers: sample.maxPlayers,
            map: sample.map,
            latencyMs: sample.latencyMs,
          }
        : undefined,
    }),
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`Webhook 返回 HTTP ${response.status}`);
  }
}

export function processMetricAlert(sample: MetricSample) {
  if (!config.WEBHOOK_URL) return Promise.resolve();
  const operation = alertQueue.then(async () => {
    const previous = await readAlertState();
    const { state, event } = evaluateAlert(previous, sample, alertSettings());
    if (event) {
      try {
        await deliverWebhook(event, sample);
        state.lastSentAt = new Date().toISOString();
        state.lastSentEvent = event;
        void audit("webhook_alert", { event, delivered: true });
      } catch (error) {
        void audit("webhook_alert", {
          event,
          delivered: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await writeAlertState(state);
  });
  alertQueue = operation.catch((error) => console.error("Alert processing failed:", error));
  return operation;
}

export async function getAlertStatus(): Promise<AlertStatus> {
  const state = await readAlertState();
  return {
    enabled: Boolean(config.WEBHOOK_URL),
    destination: config.WEBHOOK_URL ? new URL(config.WEBHOOK_URL).host : null,
    active: state.active,
    lastSentAt: state.lastSentAt,
    thresholds: {
      disconnectSamples: config.ALERT_DISCONNECT_SAMPLES,
      highLatencyMs: config.ALERT_HIGH_LATENCY_MS,
      highLatencySamples: config.ALERT_HIGH_LATENCY_SAMPLES,
      cooldownMinutes: config.ALERT_COOLDOWN_MINUTES,
    },
  };
}

export async function sendTestWebhook() {
  try {
    await deliverWebhook("test");
    await audit("webhook_alert", { event: "test", delivered: true });
  } catch (error) {
    await audit("webhook_alert", {
      event: "test",
      delivered: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
