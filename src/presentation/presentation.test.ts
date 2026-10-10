import test from "node:test";
import assert from "node:assert/strict";
import { badgesFor } from "./badges.ts";
import { cleanTitle } from "./title.ts";

test("lencana dari flag dan array badges tidak ganda (kasus nyata dari API)", () => {
  const b = badgesFor({ isSmartPick: true, isWorthIt: true, badges: ["smart_pick", "worth_it"] });
  assert.deepEqual(b.map((x) => x.label), ["Smart Pick", "Worth It"]);
});

test("normalisasi kunci: spasi, strip, huruf besar dianggap sama", () => {
  const b = badgesFor({ isSmartPick: true, isWorthIt: false, badges: ["Smart Pick", "SMART-PICK"] });
  assert.equal(b.length, 1);
});

test("lencana tak dikenal diberi label rapi dan nada netral, dikumpulkan setelah yang dikenal", () => {
  const b = badgesFor({ isSmartPick: false, isWorthIt: true, badges: ["best_seller"] });
  assert.deepEqual(b.map((x) => [x.label, x.tone]), [["Worth It", "good"], ["Best Seller", "neutral"]]);
});

test("tanpa lencana -> daftar kosong", () => {
  assert.deepEqual(badgesFor({ isSmartPick: false, isWorthIt: false, badges: [] }), []);
});

test("cleanTitle merapikan spasi dan kurung", () => {
  assert.equal(cleanTitle("  Axis Data  Paket ( 1GB ) , Jam "), "Axis Data Paket (1GB), Jam");
});
