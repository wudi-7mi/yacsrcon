import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD = "test-rcon-password";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.AUTH_SECRET = "test-auth-secret-long-enough";

const {
  punishmentCommand,
  punishmentFailed,
  punishmentSchema,
  punishmentSucceeded,
  normalizeBanRecords,
} = await import("../lib/punishments.ts");

test("builds SimpleAdmin commands only from validated identifiers", () => {
  const player = {
    confirm: true as const,
    userid: "42",
    steamId: "76561190000000001",
    playerName: "Player One",
  };
  assert.equal(
    punishmentCommand({ action: "kick", ...player }),
    "css_kick #42",
  );
  assert.equal(
    punishmentCommand({ action: "slay", ...player }),
    "css_slay #42",
  );
  assert.equal(
    punishmentCommand({ action: "ban", ...player, minutes: 120 }),
    "css_ban 76561190000000001 120",
  );
  assert.equal(
    punishmentCommand({ action: "ban", ...player, minutes: 0 }),
    "css_ban 76561190000000001",
  );
  assert.equal(
    punishmentCommand({
      action: "unban",
      confirm: true,
      steamId: player.steamId,
    }),
    `css_unban ${player.steamId}`,
  );
});

test("rejects unsafe punishment input", () => {
  assert.equal(
    punishmentSchema.safeParse({
      action: "kick",
      confirm: true,
      userid: "42;quit",
      steamId: "76561190000000001",
      playerName: "Player",
    }).success,
    false,
  );
  assert.equal(
    punishmentSchema.safeParse({
      action: "ban",
      confirm: true,
      steamId: "76561190000000001",
      minutes: 525_601,
    }).success,
    false,
  );
  assert.equal(
    punishmentSchema.safeParse({
      action: "unban",
      confirm: false,
      steamId: "76561190000000001",
    }).success,
    false,
  );
});

test("recognizes SimpleAdmin failure responses", () => {
  assert.equal(punishmentFailed("Player is already banned."), true);
  assert.equal(punishmentFailed("Couldn't find user by identifier #5"), true);
  assert.equal(punishmentFailed('Unknown command "css_ban"'), true);
  assert.equal(punishmentFailed("Command css_ban does not exist"), true);
  assert.equal(punishmentFailed("Command 'css_ban' not found"), true);
  assert.equal(
    punishmentFailed("Player with Steam ID 76561190000000001 has been banned."),
    false,
  );
});

test("requires SimpleAdmin's explicit success response for bans", () => {
  const ban = {
    action: "ban" as const,
    confirm: true as const,
    steamId: "76561190000000001",
    minutes: 120,
  };
  assert.equal(
    punishmentSucceeded(
      ban,
      "[CSS] [unnamed] with Steam ID 76561190000000001 has been banned for 120 minutes.",
    ),
    true,
  );
  assert.equal(punishmentSucceeded(ban, ""), false);
  assert.equal(
    punishmentSucceeded(ban, 'Unknown command "css_ban"'),
    false,
  );
  assert.equal(
    punishmentSucceeded(
      { ...ban, action: "unban" },
      "",
    ),
    true,
  );
});

test("normalizes permanent, active, and expired ban records", () => {
  const records = normalizeBanRecords(
    [
      {
        steamId: "76561190000000001",
        playerName: null,
        minutes: 0,
        createdAt: "2026-08-13 08:00:00",
      },
      {
        steamId: "76561190000000002",
        playerName: "Active",
        minutes: 120,
        createdAt: "2026-08-13 08:00:00",
      },
      {
        steamId: "76561190000000003",
        playerName: "Expired",
        minutes: 30,
        createdAt: "2026-08-13 08:00:00",
      },
    ],
    new Date("2026-08-13T09:00:00Z"),
  );
  assert.deepEqual(
    records.map(({ expiresAt, expired }) => ({ expiresAt, expired })),
    [
      { expiresAt: null, expired: false },
      { expiresAt: "2026-08-13T10:00:00.000Z", expired: false },
      { expiresAt: "2026-08-13T08:30:00.000Z", expired: true },
    ],
  );
});
