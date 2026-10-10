import test from "node:test";
import assert from "node:assert/strict";
import { normalizeItem } from "../api/ibp.ts";
import { PRESETS, presetIdOf, sortItems } from "./sort.ts";

const mk = (code: string, o: Record<string, unknown>) => normalizeItem({ code, name: code, price: 1000, ...o })!;
const items = [
  mk("A", { price: 9000, volume_gb: 8, validity_days: 1 }),
  mk("B", { price: 4000 }), // tanpa kuota/masa
  mk("C", { price: 25000, volume_gb: 30, validity_days: 7 }),
];
const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

test("harga naik/turun", () => {
  assert.deepEqual(codes(sortItems(items, { key: "price", dir: "asc" })), ["B", "A", "C"]);
  assert.deepEqual(codes(sortItems(items, { key: "price", dir: "desc" })), ["C", "A", "B"]);
});

test("nilai kosong selalu di akhir, juga saat menurun", () => {
  assert.deepEqual(codes(sortItems(items, { key: "volume", dir: "desc" })), ["C", "A", "B"]);
  assert.deepEqual(codes(sortItems(items, { key: "volume", dir: "asc" })), ["A", "C", "B"]);
});

test("tidak mengubah array asal", () => {
  const before = codes(items);
  sortItems(items, { key: "price", dir: "desc" });
  assert.deepEqual(codes(items), before);
});

test("presetIdOf mengenali preset dan 'kustom'", () => {
  assert.equal(presetIdOf(PRESETS[0].sort), PRESETS[0].id);
  assert.equal(presetIdOf({ key: "name", dir: "asc" }), "kustom");
});
