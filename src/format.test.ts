import test from "node:test";
import assert from "node:assert/strict";
import { formatAge } from "./format.ts";

const MIN = 60_000, H = 60 * MIN, D = 24 * H;

test("usia data dalam bahasa sehari-hari", () => {
  assert.equal(formatAge(0), "baru saja");
  assert.equal(formatAge(59_000), "baru saja");
  assert.equal(formatAge(5 * MIN), "5 menit lalu");
  assert.equal(formatAge(59 * MIN), "59 menit lalu");
  assert.equal(formatAge(60 * MIN), "1 jam lalu");
  assert.equal(formatAge(23 * H + 59 * MIN), "23 jam lalu");
  assert.equal(formatAge(24 * H), "1 hari lalu");
  assert.equal(formatAge(3 * D + 5 * H), "3 hari lalu");
});

test("usia negatif (jam perangkat mundur) tidak menghasilkan teks aneh", () => {
  assert.equal(formatAge(-5000), "baru saja");
});
