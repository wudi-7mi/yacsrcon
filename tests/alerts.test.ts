import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { evaluateAlert } = await import("../lib/alerts.ts");

const settings = {
  disconnectSamples: 3,
  highLatencyMs: 500,
  highLatencySamples: 2,
  cooldownMs: 30 * 60_000,
};
const base = {
  active: null,
  disconnectedSamples: 0,
  highLatencySamples: 0,
  lastSentAt: null,
  lastSentEvent: null,
} as const;

function sample(connected: boolean, latencyMs: number | null) {
  return {
    at: "2026-08-14T00:00:00.000Z",
    connected,
    players: connected ? 2 : 0,
    maxPlayers: connected ? 16 : 0,
    map: connected ? "de_dust2" : null,
    latencyMs,
  };
}

test("requires consecutive failures before emitting a disconnect alert", () => {
  const first = evaluateAlert(base, sample(false, null), settings, 0);
  const second = evaluateAlert(first.state, sample(false, null), settings, 1);
  const third = evaluateAlert(second.state, sample(false, null), settings, 2);
  assert.equal(first.event, null);
  assert.equal(second.event, null);
  assert.equal(third.event, "disconnected");
  assert.equal(third.state.active, "disconnected");
});

test("emits recovery and applies cooldown only to matching reminders", () => {
  const active = {
    ...base,
    active: "disconnected" as const,
    disconnectedSamples: 3,
    lastSentAt: new Date(0).toISOString(),
    lastSentEvent: "disconnected" as const,
  };
  const reminderBlocked = evaluateAlert(active, sample(false, null), settings, 1000);
  assert.equal(reminderBlocked.event, null);
  const recovered = evaluateAlert(active, sample(true, 30), settings, 1000);
  assert.equal(recovered.event, "recovered");
});

test("requires consecutive high latency samples", () => {
  const first = evaluateAlert(base, sample(true, 700), settings, 0);
  const second = evaluateAlert(first.state, sample(true, 800), settings, 1);
  assert.equal(first.event, null);
  assert.equal(second.event, "high_latency");
});
