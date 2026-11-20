import test from "node:test";
import assert from "node:assert/strict";
import { describeDiff, diffCatalogue } from "./diff.ts";
import { normalizeItem } from "./ibp.ts";

const it = (code: string, price: number, available = true) => normalizeItem({ code, name: code, price, available })!;

test("menghitung paket baru, dihapus, harga berubah, dan status stok berubah", () => {
  const prev = [it("A", 1000), it("B", 2000), it("C", 3000), it("D", 4000)];
  const next = [it("A", 1000), it("B", 2500), it("C", 3000, false), it("E", 5000)];
  assert.deepEqual(diffCatalogue(prev, next), { added: 1, removed: 1, priceChanged: 1, availabilityChanged: 1 });
});

test("tanpa perubahan -> semua nol dan tidak ada ringkasan", () => {
  const same = [it("A", 1000), it("B", 2000)];
  assert.equal(describeDiff(diffCatalogue(same, same)), null);
});

test("ringkasan hanya menyebut yang berubah", () => {
  assert.equal(describeDiff({ added: 0, removed: 27, priceChanged: 59, availabilityChanged: 0 }), "27 paket dihapus, 59 harga berubah");
  assert.equal(describeDiff({ added: 2, removed: 0, priceChanged: 0, availabilityChanged: 1 }), "2 paket baru, 1 status stok berubah");
});
