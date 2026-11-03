import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TAB, parseTab, tabHash } from "./tabs.ts";

test("hash dikenali dalam beberapa bentuk", () => {
  assert.equal(parseTab("#katalog"), "katalog");
  assert.equal(parseTab("#/rekomendasi"), "rekomendasi");
  assert.equal(parseTab("bantu"), "bantu");
  assert.equal(parseTab("#KATALOG"), "katalog");
});

test("kosong atau tak dikenal -> tab bawaan (Bantu Pilih)", () => {
  assert.equal(DEFAULT_TAB, "bantu");
  assert.equal(parseTab(""), "bantu");
  assert.equal(parseTab("#"), "bantu");
  assert.equal(parseTab("#admin"), "bantu");
});

test("tabHash adalah kebalikan parseTab", () => {
  for (const t of ["katalog", "rekomendasi", "bantu"] as const) assert.equal(parseTab(tabHash(t)), t);
});
