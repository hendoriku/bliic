import test from "node:test";
import assert from "node:assert/strict";
import { matchesValidity, UNKNOWN, validityKey, validityLabel, validityOptions } from "./facets.ts";

const it = (days: number | null) => ({ days });

test("label: jam untuk < 1 hari, hari untuk lainnya, dan tidak tercantum", () => {
  assert.equal(validityLabel(3 / 24), "3 jam");
  assert.equal(validityLabel(1), "1 hari");
  assert.equal(validityLabel(28), "28 hari");
  assert.equal(validityLabel(null), "Tidak tercantum");
});

test("opsi dibuat dari variasi yang ada, terurut, dengan jumlah; tidak tercantum di akhir", () => {
  const o = validityOptions([it(28), it(1), it(28), it(null), it(3 / 24), it(7), it(28)]);
  assert.deepEqual(o.map((x) => [x.label, x.count]), [["3 jam", 1], ["1 hari", 1], ["7 hari", 1], ["28 hari", 3], ["Tidak tercantum", 1]]);
});

test("pilihan yang jumlahnya jadi 0 karena filter lain tetap tampil", () => {
  const o = validityOptions([it(1), it(7)], validityKey(30));
  assert.deepEqual(o.map((x) => [x.key, x.count]), [["1", 1], ["7", 1], ["30", 0]]);
  assert.deepEqual(validityOptions([], UNKNOWN).map((x) => [x.key, x.count]), [[UNKNOWN, 0]]);
});

test("pencocokan: kosong = semua; unknown cocok dengan masa aktif null; jam tidak bentrok desimal", () => {
  assert.equal(matchesValidity(it(5), ""), true);
  assert.equal(matchesValidity(it(7), "7"), true);
  assert.equal(matchesValidity(it(7), "5"), false);
  assert.equal(matchesValidity(it(null), UNKNOWN), true);
  assert.equal(matchesValidity(it(3 / 24), validityKey(3 / 24)), true);
});
