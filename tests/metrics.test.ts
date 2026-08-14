import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { createNonReentrantTask, downsampleMetrics, parseMetricText, summarizeMetrics } = await import(
  "../lib/metrics.ts"
);

test("parses valid monitoring samples around damaged JSONL lines", () => {
  const samples = parseMetricText(
    '{"at":"2026-08-13T00:00:00.000Z","connected":true,"players":2,"maxPlayers":16,"map":"de_dust2","latencyMs":20}\nbad\n' +
      '{"at":"2026-08-13T00:01:00.000Z","connected":false,"players":0,"maxPlayers":0,"map":null,"latencyMs":null}\n',
  );
  assert.equal(samples.length, 2);
  assert.equal(summarizeMetrics(samples).disconnects, 1);
  assert.equal(summarizeMetrics(samples).availabilityPercent, 50);
});

test("downsamples monitoring history while preserving outages and peaks", () => {
  const samples = Array.from({ length: 100 }, (_, index) => ({
    at: new Date(index * 30_000).toISOString(),
    connected: index !== 50,
    players: index === 75 ? 12 : 2,
    maxPlayers: 16,
    map: "de_dust2",
    latencyMs: 20,
  }));
  const result = downsampleMetrics(samples, 10);
  assert.equal(result.length, 10);
  assert.equal(result.some((sample) => !sample.connected), true);
  assert.equal(Math.max(...result.map((sample) => sample.players)), 12);
});

test("reports high latency and current disconnect alerts", () => {
  const base = { players: 2, maxPlayers: 16, map: "de_dust2" };
  assert.equal(
    summarizeMetrics([
      {
        ...base,
        at: "2026-08-13T00:00:00.000Z",
        connected: true,
        latencyMs: 500,
      },
    ]).currentAlert,
    "high_latency",
  );
  assert.equal(
    summarizeMetrics([
      {
        ...base,
        at: "2026-08-13T00:01:00.000Z",
        connected: false,
        latencyMs: null,
      },
    ]).currentAlert,
    "disconnected",
  );
});

test("uses the configured high latency threshold", () => {
  const samples = [
    {
      at: "2026-08-13T00:00:00.000Z",
      connected: true,
      players: 2,
      maxPlayers: 16,
      map: "de_dust2",
      latencyMs: 700,
    },
  ];
  assert.equal(summarizeMetrics(samples, 1000).currentAlert, null);
  assert.equal(summarizeMetrics(samples, 500).currentAlert, "high_latency");
});

test("does not enqueue another metric task while one is running", async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const run = createNonReentrantTask(async () => {
    calls += 1;
    if (calls === 1) await blocked;
  });

  const first = run();
  assert.equal(await run(), false);
  assert.equal(calls, 1);

  release();
  assert.equal(await first, true);
  assert.equal(await run(), true);
  assert.equal(calls, 2);
});
