// Uji terhadap cuplikan respons asli /catalogue/ibp (fixtures/ibp.sample.json).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseIbp } from "./api/ibp.ts";
import { getRecommendations, type Answers } from "./wizard/engine.ts";
import { badgesFor } from "./presentation/badges.ts";

const raw = JSON.parse(readFileSync(new URL("../fixtures/ibp.sample.json", import.meta.url), "utf8"));
const { items, extra } = parseIbp(raw);

test("respons asli ter-parse: semua item valid, meta terbawa", () => {
  assert.equal(items.length, raw.data.length);
  assert.ok(extra.meta && extra.links);
});

test("lencana asli (flag + array) tidak pernah ganda", () => {
  for (const i of items) {
    const keys = badgesFor(i).map((b) => b.key);
    assert.equal(new Set(keys).size, keys.length, i.code);
  }
});

test("rekomendasi tidak pernah memilih item tanpa kuota/masa aktif (tagihan, pulsa, dll)", () => {
  const base: Answers = { operator: "", phone: "ya", hotspot: "tidak_yakin", duration: "tidak_yakin", usage: "tidak_yakin", budget: "tidak_yakin", priority: "cheapest" };
  for (const operator of new Set(items.map((i) => i.operator))) {
    for (const priority of ["cheapest", "best_value", "tidak_yakin"] as const) {
      const r = getRecommendations(items, { ...base, operator, priority });
      for (const p of [r.primary, r.secondary]) {
        if (!p) continue;
        assert.ok(p.item.volumeGb && p.item.validityDays, `${operator}/${priority}: ${p.item.name}`);
      }
    }
  }
});
