import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("does not override PUID or PGID supplied by the service env file", async () => {
  const compose = await readFile("docker-compose.yml", "utf8");
  assert.doesNotMatch(compose, /^\s+PUID:/m);
  assert.doesNotMatch(compose, /^\s+PGID:/m);
  assert.match(compose, /^\s+env_file:\s*$/m);
  assert.match(compose, /^\s+- \.env\.local\s*$/m);
});
