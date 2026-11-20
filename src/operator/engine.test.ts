import test from "node:test";
import assert from "node:assert/strict";
import { normalizeItem } from "../api/ibp.ts";
import { fitsProfile, rankOperators, type Profile } from "./engine.ts";

let seq = 0;
const mk = (operator: string, price: number, gbTotal: number | null, days: number | null, extra: Record<string, unknown> = {}) =>
  normalizeItem({ code: `P${seq++}`, name: `${operator} paket`, operator, price, volume_gb: gbTotal, validity_days: days, available: true, ...extra })!;
/** n paket dengan harga per GB tertentu. */
const many = (operator: string, n: number, perGb: number, gb = 10, days = 30, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, () => mk(operator, perGb * gb, gb, days, extra));

const base: Profile = { usage: "tidak_yakin", horizon: "tidak_yakin", budget: "gt150", priority: "seimbang" };

test("prioritas hemat: operator dengan harga per GB terendah menang", () => {
  const items = [...many("MURAH", 8, 1000), ...many("MAHAL", 8, 4000)];
  const r = rankOperators(items, { ...base, priority: "hemat" });
  assert.equal(r.results[0].operator, "MURAH");
  assert.equal(r.results[0].pricierPct, 0);
  assert.equal(r.results[1].pricierPct, 300); // 4000 vs 1000
  assert.ok(r.results[0].strengths.includes("hemat"));
});

test("prioritas variasi: operator dengan paket terbanyak menang walau lebih mahal", () => {
  const items = [...many("BANYAK", 40, 3000), ...many("SEDIKIT", 7, 1500)];
  assert.equal(rankOperators(items, { ...base, priority: "variasi" }).results[0].operator, "BANYAK");
  assert.equal(rankOperators(items, { ...base, priority: "hemat" }).results[0].operator, "SEDIKIT");
});

test("prioritas kuota besar: yang punya paket terbesar menang; contoh paketnya yang terbesar", () => {
  const items = [...many("KECIL", 8, 1000, 10), ...many("BESAR", 7, 2000, 10), mk("BESAR", 600_000, 300, 30)];
  const r = rankOperators(items, { ...base, priority: "besar" });
  assert.equal(r.results[0].operator, "BESAR");
  assert.equal(r.results[0].sample.volumeGb, 300);
});

test("anggaran dan masa aktif menyaring paket; operator tanpa paket cocok masuk unmatched", () => {
  const items = [...many("A", 8, 1000, 10, 1), ...many("B", 8, 1000, 10, 30)];
  const r = rankOperators(items, { ...base, horizon: "harian" });
  assert.deepEqual(r.results.map((x) => x.operator), ["A"]);
  assert.deepEqual(r.unmatched, ["B"]);
});

test("anggaran: paket di atas batas dikeluarkan", () => {
  const items = [...many("MURAH", 8, 1000), ...many("MAHAL", 8, 3000)]; // Rp 10.000 vs Rp 30.000 per paket
  assert.deepEqual(rankOperators(items, { ...base, budget: "lt15" }).results.map((x) => x.operator), ["MURAH"]);
  assert.equal(rankOperators(items, { ...base, budget: "15-50" }).results.length, 2);
});

test("pemakaian berat hanya mengikutkan paket dengan kuota harian >= 5 GB", () => {
  const items = [mk("A", 10_000, 8, 1), mk("A", 50_000, 30, 30)]; // 8 GB/hari vs 1 GB/hari
  const r = rankOperators(items, { ...base, usage: "berat" });
  assert.equal(r.results[0].matches, 1);
});

test("item tak layak dibandingkan diabaikan: tanpa kuota, tanpa masa aktif, per jam, atau tidak tersedia", () => {
  const items = [mk("A", 5000, null, 1), mk("A", 5000, 5, null), mk("A", 5000, 5, null, { name: "A paket 3 Jam" }), mk("A", 5000, 5, 1, { available: false })];
  assert.equal(rankOperators(items, base).results.length, 0);
});

test("sedikit paket cocok -> skor diredam dan ditandai kurang meyakinkan", () => {
  const items = [...many("RAMAI", 12, 2000), ...many("SEPI", 1, 500)];
  const r = rankOperators(items, { ...base, priority: "hemat" });
  const sepi = r.results.find((x) => x.operator === "SEPI")!;
  assert.equal(sepi.lowConfidence, true);
  assert.equal(r.results[0].operator, "RAMAI"); // satu paket murah tidak cukup mengalahkan operator dengan banyak pilihan
});

test("tanda kualitas (Worth It / Smart Pick) menaikkan skor", () => {
  const items = [...many("BAGUS", 8, 2000, 10, 30, { is_worth_it: true }), ...many("BIASA", 8, 2000)];
  assert.equal(rankOperators(items, base).results[0].operator, "BAGUS");
});

test("satu operator saja: tidak ada penanda keunggulan, skor tetap wajar", () => {
  const r = rankOperators(many("SENDIRI", 8, 1000), base);
  assert.equal(r.results[0].strengths.length, 0);
  assert.ok(r.results[0].score > 0 && r.results[0].score <= 100);
});

test("tanpa satu pun paket cocok", () => {
  const r = rankOperators(many("A", 8, 1000, 10, 30), { ...base, horizon: "harian" });
  assert.deepEqual(r.results, []);
  assert.deepEqual(r.unmatched, ["A"]);
});

test("fitsProfile: batas anggaran dan rentang masa aktif bersifat inklusif", () => {
  const i = mk("A", 15_000, 10, 3);
  assert.equal(fitsProfile(i, { ...base, budget: "lt15", horizon: "harian" }), true);
  assert.equal(fitsProfile(mk("A", 15_001, 10, 3), { ...base, budget: "lt15" }), false);
  assert.equal(fitsProfile(mk("A", 1000, 10, 4), { ...base, horizon: "harian" }), false);
});

// ---- pelonggaran bertahap ----
import { recommendOperators } from "./engine.ts";

test("profil terpenuhi: tidak ada yang dilonggarkan", () => {
  const r = recommendOperators(many("A", 8, 1000), base);
  assert.equal(r.relaxed, null);
  assert.equal(r.results.length, 1);
});

test("anggaran terlalu kecil: dilonggarkan dan dilaporkan harga minimal yang dibutuhkan", () => {
  const items = [...many("A", 8, 2000, 10, 30), ...many("B", 8, 3000, 10, 30)]; // Rp 20.000 dan Rp 30.000
  const r = recommendOperators(items, { ...base, budget: "lt15" });
  assert.equal(r.relaxed, "budget");
  assert.equal(r.neededPrice, 20_000);
  assert.ok(r.results.length > 0);
});

test("kebutuhan kuota terlalu tinggi untuk durasi itu: kuota dilonggarkan", () => {
  const items = many("A", 8, 1000, 3, 30); // 3 GB per 30 hari = 0,1 GB/hari
  const r = recommendOperators(items, { ...base, usage: "berat" });
  assert.equal(r.relaxed, "usage");
});

test("tidak ada paket untuk durasi itu sama sekali: durasi dilonggarkan", () => {
  const r = recommendOperators(many("A", 8, 1000, 10, 30), { ...base, horizon: "harian" });
  assert.equal(r.relaxed, "horizon");
});

test("tidak ada data yang bisa dibandingkan: hasil kosong tanpa pelonggaran", () => {
  const r = recommendOperators([mk("A", 5000, null, null)], base);
  assert.deepEqual([r.results.length, r.relaxed], [0, null]);
});
