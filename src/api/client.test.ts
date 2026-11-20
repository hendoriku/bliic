import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient, ApiError, parseRetryAfter } from "./client.ts";

const BASE = "https://api.test/v1";
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

/** Klien dengan urutan respons terskrip; jeda diperkecil agar test cepat. */
function scripted(steps: Array<Response | Error>, retries = 2) {
  let n = 0;
  const client = new ApiClient({
    baseUrl: BASE,
    retries,
    backoffMs: 1,
    fetchImpl: async () => {
      const s = steps[Math.min(n++, steps.length - 1)];
      if (s instanceof Error) throw s;
      return s.clone();
    },
  });
  return { client, calls: () => n };
}

test("Retry-After: detik dan tanggal HTTP", () => {
  assert.equal(parseRetryAfter("3"), 3000);
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(null), null);
  assert.equal(parseRetryAfter("bukan angka atau tanggal"), null);
  const now = Date.parse("2026-11-20T10:00:00Z");
  assert.equal(parseRetryAfter("Fri, 20 Nov 2026 10:00:05 GMT", now), 5000);
});

test("429 lalu 200: dicoba ulang dan berhasil (menghormati Retry-After)", async () => {
  const { client, calls } = scripted([new Response("x", { status: 429, headers: { "retry-after": "0" } }), json({ ok: 1 })]);
  assert.deepEqual(await client.getJson("/x"), { ok: 1 });
  assert.equal(calls(), 2);
});

test("429 terus-menerus: error berjenis rate-limit membawa retryAfterMs", async () => {
  const { client } = scripted([new Response("x", { status: 429, headers: { "retry-after": "0" } })], 1);
  await assert.rejects(client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "rate-limit" && e.status === 429 && e.retryAfterMs === 0);
});

test("502 lalu 200 (server baru bangun): berhasil setelah dicoba ulang", async () => {
  const { client } = scripted([new Response("bad gateway", { status: 502 }), json({ ok: 1 })]);
  assert.deepEqual(await client.getJson("/x"), { ok: 1 });
});

test("5xx terus-menerus: error berjenis server", async () => {
  const { client } = scripted([new Response("x", { status: 503 })], 1);
  await assert.rejects(client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "server");
});

test("kegagalan jaringan dicoba ulang; bila tetap gagal berjenis network", async () => {
  const flaky = scripted([new TypeError("fetch failed"), json({ ok: 1 })]);
  assert.deepEqual(await flaky.client.getJson("/x"), { ok: 1 });
  const down = scripted([new TypeError("fetch failed")], 1);
  await assert.rejects(down.client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "network");
});

test("waktu habis dibedakan dari jaringan putus", async () => {
  const timeout = Object.assign(new Error("signal timed out"), { name: "TimeoutError" });
  const { client } = scripted([timeout], 0);
  await assert.rejects(client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "timeout");
});

test("4xx lain (mis. 404) tidak dicoba ulang", async () => {
  const { client, calls } = scripted([new Response("nope", { status: 404 })]);
  await assert.rejects(client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "http" && e.status === 404);
  assert.equal(calls(), 1);
});

test("respons bukan JSON berjenis parse", async () => {
  const { client } = scripted([new Response("<html>", { status: 200 })]);
  await assert.rejects(client.getJson("/x"), (e: unknown) => e instanceof ApiError && e.kind === "parse");
});
