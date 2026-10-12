import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_KEY, CACHE_TTL_MS, isFresh, readCache, writeCache, type KV } from "./cache.ts";
import { normalizeItem } from "./ibp.ts";

const memory = (): KV => {
  const m = new Map<string, unknown>();
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v) };
};
const items = [normalizeItem({ code: "A", name: "Paket A", price: 1000 })!];

test("tulis lalu baca cache (item sudah ternormalisasi, ETag ikut)", async () => {
  const kv = memory();
  await writeCache({ at: 1000, etag: '"abc"', items }, kv);
  assert.deepEqual(await readCache(kv), { at: 1000, etag: '"abc"', items });
});

test("cache kosong atau bentuknya salah -> null", async () => {
  const kv = memory();
  assert.equal(await readCache(kv), null);
  await kv.set(CACHE_KEY, { at: "bukan angka", items: "bukan array" });
  assert.equal(await readCache(kv), null);
});

test("tanpa IndexedDB (null) atau storage yang melempar error tidak merusak aplikasi", async () => {
  assert.equal(await readCache(null), null);
  await assert.doesNotReject(writeCache({ at: 1, etag: null, items }, null));
  const bad: KV = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } };
  assert.equal(await readCache(bad), null);
  await assert.doesNotReject(writeCache({ at: 1, etag: null, items }, bad));
});

test("kesegaran mengikuti TTL", () => {
  assert.equal(isFresh({ at: 0 }, CACHE_TTL_MS - 1), true);
  assert.equal(isFresh({ at: 0 }, CACHE_TTL_MS), false);
});
