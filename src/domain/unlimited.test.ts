import test from "node:test";
import assert from "node:assert/strict";
import { durationDays, durationLabel, isUnlimited } from "./unlimited.ts";

const it = (name: string, volumeGb: number | null = null, validityDays: number | null = null) => ({ name, volumeGb, validityDays });

test("unlimited murni: tanpa GB tetap + kata unlimited", () => {
  assert.equal(isUnlimited(it("Axis Data Paket Warnet Unlimited 24 Jam")), true);
  assert.equal(isUnlimited(it("SMARTFREN DATA VOUCHER UNLIMITED 28D")), true);
  assert.equal(isUnlimited(it("Voucher 3GB All + 17GB + Unli App 28 Hari", 20, 28)), false); // punya GB tetap
  assert.equal(isUnlimited(it("Bayar Telkomsel Data")), false);
});

test("durasi dibaca dari validity_days, lalu dari nama", () => {
  assert.equal(durationDays(it("x", null, 7)), 7);
  assert.equal(durationDays(it("SMARTFREN DATA VOUCHER UNLIMITED 28D")), 28);
  assert.equal(durationDays(it("Roam Singapore 7 Days")), 7);
  assert.equal(durationDays(it("Warnet Unlimited 3 Jam")), 3 / 24);
  assert.equal(durationDays(it("Paket Tanpa Keterangan")), null);
});

test("label durasi: jam untuk < 1 hari", () => {
  assert.equal(durationLabel(it("Warnet Unlimited 3 Jam")), "3 jam");
  assert.equal(durationLabel(it("x", null, 28)), "28 hari");
  assert.equal(durationLabel(it("tanpa info")), "—");
});
