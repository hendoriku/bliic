import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_TTL_MS, isFresh, readCache, writeCache } from "./cache.ts";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test("tulis lalu baca cache", () => {
  const s = memory();
  writeCache({ data: [1] }, 1000, s);
  assert.deepEqual(readCache(s), { at: 1000, json: { data: [1] } });
});

test("cache rusak atau kosong menghasilkan null", () => {
  const s = memory();
  assert.equal(readCache(s), null);
  s.setItem("bliic:ibp:v2", "{bukan json");
  assert.equal(readCache(s), null);
});

test("storage yang melempar error tidak merusak aplikasi", () => {
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.equal(readCache(bad), null);
  assert.doesNotThrow(() => writeCache({}, 1, bad));
});

test("kesegaran mengikuti TTL", () => {
  assert.equal(isFresh({ at: 0, json: {} }, CACHE_TTL_MS - 1), true);
  assert.equal(isFresh({ at: 0, json: {} }, CACHE_TTL_MS), false);
});
