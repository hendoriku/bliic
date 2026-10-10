import test from "node:test";
import assert from "node:assert/strict";
import { normalizeItem } from "./api/ibp.ts";
import { recommend } from "./recommend.ts";

const mk = (o: Record<string, unknown>) =>
  normalizeItem({ code: "X", name: "x", price: 1000, available: true, ...o })!;

test("normalizeItem menolak item tanpa code/price", () => {
  assert.equal(normalizeItem({ name: "a" }), null);
  assert.equal(normalizeItem({ code: "A", price: "abc" }), null);
});

test("recommend memfilter budget/kuota dan mengurutkan per GB/hari", () => {
  const items = [
    mk({ code: "A", price: 10000, volume_gb: 10, validity_days: 30 }),
    mk({ code: "B", price: 9000, volume_gb: 20, validity_days: 30 }),
    mk({ code: "C", price: 99000, volume_gb: 99, validity_days: 30 }),
    mk({ code: "D", price: 5000, volume_gb: 20, validity_days: 30, available: false }),
  ];
  const r = recommend(items, { budget: 20000, minGb: 5 });
  assert.deepEqual(r.map((x) => x.item.code), ["B", "A"]);
});

test("minGb mengecualikan paket tanpa data kuota", () => {
  assert.equal(recommend([mk({ code: "A" })], { minGb: 1 }).length, 0);
});
