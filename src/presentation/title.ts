// Pembersihan judul paket sebelum ditampilkan. Tambah aturan baru ke TITLE_RULES;
// aturan dijalankan berurutan. Data asli di API tidak diubah.

type Rule = (title: string) => string;

const TITLE_RULES: Rule[] = [
  (t) => t.replace(/\s+/g, " "), // spasi ganda
  (t) => t.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"), // spasi di dalam kurung
  (t) => t.replace(/\s+([,.;:])/g, "$1"), // spasi sebelum tanda baca
  (t) => t.trim(),
];

export const cleanTitle = (title: string): string => TITLE_RULES.reduce((t, rule) => rule(t), title);
