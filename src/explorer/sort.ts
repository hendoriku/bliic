import type { IbpItem } from "../api/ibp.ts";
import { unitCost } from "../recommend.ts";

export type SortKey = "price" | "volume" | "validity" | "unit" | "name" | "operator";
export type Dir = "asc" | "desc";
export interface Sort {
  key: SortKey;
  dir: Dir;
}

/** Pilihan cepat di dropdown "Urutkan". */
export const PRESETS: { id: string; label: string; sort: Sort }[] = [
  { id: "termurah", label: "Termurah", sort: { key: "price", dir: "asc" } },
  { id: "hemat", label: "Paling hemat per GB/hari", sort: { key: "unit", dir: "asc" } },
  { id: "kuota", label: "Kuota terbesar", sort: { key: "volume", dir: "desc" } },
  { id: "masa", label: "Masa aktif terlama", sort: { key: "validity", dir: "desc" } },
  { id: "termahal", label: "Termahal", sort: { key: "price", dir: "desc" } },
];

export const presetIdOf = (s: Sort): string => PRESETS.find((p) => p.sort.key === s.key && p.sort.dir === s.dir)?.id ?? "kustom";

/** Arah awal saat header kolom diklik pertama kali. */
export const defaultDir = (key: SortKey): Dir => (key === "volume" || key === "validity" ? "desc" : "asc");

type Value = number | string | null;
const valueOf = (i: IbpItem, key: SortKey): Value => {
  switch (key) {
    case "price": return i.price;
    case "volume": return i.volumeGb;
    case "validity": return i.validityDays;
    case "unit": return unitCost(i);
    case "name": return i.name.toLowerCase();
    case "operator": return i.operator.toLowerCase();
  }
};

/** Mengurutkan salinan daftar. Nilai kosong (null) selalu di akhir, apa pun arahnya; seri diurutkan menurut harga. */
export function sortItems(items: readonly IbpItem[], { key, dir }: Sort): IbpItem[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = valueOf(a, key);
    const vb = valueOf(b, key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const c = typeof va === "string" ? va.localeCompare(vb as string, "id") : va - (vb as number);
      if (c !== 0) return c * sign;
    }
    return a.price - b.price;
  });
}
