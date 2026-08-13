import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, apiRequest } from "../lib/api-client.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("returns JSON payloads", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  assert.deepEqual(await apiRequest<{ ok: boolean }>("/api/test"), {
    ok: true,
  });
});

test("preserves structured API errors and notifies on 401", async () => {
  let unauthorized = false;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Session expired", code: "expired" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(
    apiRequest("/api/test", {
      onUnauthorized: () => {
        unauthorized = true;
      },
    }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Session expired");
      return true;
    },
  );
  assert.equal(unauthorized, true);
});

test("reports non-JSON error responses", async () => {
  globalThis.fetch = async () =>
    new Response("Bad gateway", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  await assert.rejects(
    apiRequest("/api/test"),
    (error) => error instanceof ApiError && error.message === "Bad gateway",
  );
});

test("classifies network failures and preserves AbortError", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(
    apiRequest("/api/test"),
    (error) => error instanceof ApiError && error.status === 0,
  );

  globalThis.fetch = async () => {
    throw new DOMException("aborted", "AbortError");
  };
  await assert.rejects(
    apiRequest("/api/test"),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
});
