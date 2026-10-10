import test from "node:test";
import assert from "node:assert/strict";
import { normalizeItem } from "../api/ibp.ts";
import { getRecommendations, type Answers } from "./engine.ts";

const mk = (o: Record<string, unknown>) =>
  normalizeItem({ name: "Paket", operator: "AXIS", available: true, ...o })!;

const base: Answers = {
  operator: "AXIS",
  phone: "ya",
  hotspot: "tidak_yakin",
  duration: "tidak_yakin",
  usage: "tidak_yakin",
  budget: "tidak_yakin",
  priority: "cheapest",
};

const items = [
  mk({ code: "A", price: 9000, volume_gb: 8, validity_days: 1 }),
  mk({ code: "B", price: 10000, volume_gb: 14, validity_days: 1 }), // +1000, 1.75x -> upsell
  mk({ code: "C", price: 25000, volume_gb: 30, validity_days: 7 }),
  mk({ code: "W", name: "Paket Warnet", price: 4000, volume_gb: 1, validity_days: 1 }),
  mk({ code: "T", operator: "TELKOMSEL", price: 1000, volume_gb: 1, validity_days: 1 }),
];

test("tanpa nomor HP: Paket Data tidak ditawarkan, hanya voucher & kuota elektrik", () => {
  const mix = [
    mk({ code: "PK", catalogue: "data-package", price: 3000, volume_gb: 5, validity_days: 1 }),
    mk({ code: "DV", catalogue: "data-voucher", price: 5000, volume_gb: 5, validity_days: 1 }),
    mk({ code: "EQ", catalogue: "electric-quota", price: 6000, volume_gb: 5, validity_days: 1 }),
  ];
  const no = getRecommendations(mix, { ...base, phone: "tidak" });
  assert.equal(no.primary?.item.code, "DV");
  assert.equal(no.secondary?.item.code, "EQ");
  const yes = getRecommendations(mix, { ...base, phone: "ya" });
  assert.equal(yes.primary?.item.code, "PK");
});

test("tanpa nomor HP dan hanya ada Paket Data -> tidak ada hasil", () => {
  const only = [mk({ code: "PK", catalogue: "data-package", price: 3000, volume_gb: 5, validity_days: 1 })];
  assert.equal(getRecommendations(only, { ...base, phone: "tidak" }).primary, null);
});

test("filter operator mutlak", () => {
  const r = getRecommendations(items, { ...base, operator: "TELKOMSEL" });
  assert.equal(r.primary?.item.code, "T");
});

test("hotspot ya mengeluarkan paket Warnet", () => {
  const r = getRecommendations(items, { ...base, hotspot: "ya" });
  assert.equal(r.primary?.item.code, "A");
});

test("hotspot tidak yakin: Warnet didegradasi walau termurah", () => {
  const r = getRecommendations(items, base);
  assert.equal(r.primary?.item.code, "A");
});

test("cheapest: smart upsell memilih +<=2000 dan >=1.5x GB", () => {
  const r = getRecommendations(items, { ...base, hotspot: "ya" });
  assert.equal(r.secondary?.item.code, "B");
});

test("best_value: utama rate terendah, pembanding lebih murah", () => {
  const r = getRecommendations(items, { ...base, hotspot: "ya", priority: "best_value" });
  assert.equal(r.primary?.item.code, "B"); // 10000/14 = 714/GB (A=1125, C=833)
  assert.equal(r.secondary?.item.code, "A"); // lebih murah dari B
});

test("durasi 7+ dan budget membatasi hasil", () => {
  assert.equal(getRecommendations(items, { ...base, duration: "7+" }).primary?.item.code, "C");
  assert.equal(getRecommendations(items, { ...base, duration: "7+", budget: "lt10" }).primary, null);
});

test("pemakaian berat (>=5 GB/hari) menyaring paket kecil", () => {
  const r = getRecommendations(items, { ...base, usage: "berat", hotspot: "ya" });
  assert.equal(r.primary?.item.code, "A"); // 8 GB/hari; C hanya ~4.3 GB/hari
});

test("hybrid mengembalikan dua opsi", () => {
  const r = getRecommendations(items, { ...base, hotspot: "ya", priority: "tidak_yakin" });
  assert.ok(r.primary && r.secondary);
});

test("tidak ada hasil -> pesan", () => {
  const r = getRecommendations(items, { ...base, operator: "XL" });
  assert.equal(r.primary, null);
  assert.ok(r.message);
});
