// Filter berdasarkan variasi nilai yang benar-benar ada di data (faceted filter).
import type { IbpItem } from "../api/ibp.ts";

export interface FacetOption {
  key: string;
  label: string;
  count: number;
  /** Untuk pengurutan; null = tidak tercantum (selalu di akhir). */
  days: number | null;
}

export const UNKNOWN = "unknown";

/** Kunci stabil untuk satu nilai masa aktif (hindari selisih desimal, mis. 1 jam = 0,0417 hari). */
export const validityKey = (days: number | null): string => (days === null ? UNKNOWN : String(+days.toFixed(4)));

/** "3 jam", "28 hari", atau "Tidak tercantum". */
export function validityLabel(days: number | null): string {
  if (days === null) return "Tidak tercantum";
  if (days < 1) return `${Math.round(days * 24)} jam`;
  return `${+days.toFixed(2)} hari`;
}

export const matchesValidity = (i: Pick<IbpItem, "days">, key: string): boolean => !key || validityKey(i.days) === key;

/**
 * Daftar variasi masa aktif beserta jumlah paketnya, terurut dari terpendek; "Tidak tercantum" di akhir.
 * `selected` tetap dimasukkan (jumlah 0) bila filter lain membuatnya kosong, agar pilihan tidak "hilang".
 */
export function validityOptions(items: readonly Pick<IbpItem, "days">[], selected = ""): FacetOption[] {
  const counts = new Map<string, FacetOption>();
  const add = (days: number | null, n: number) => {
    const key = validityKey(days);
    const cur = counts.get(key);
    if (cur) cur.count += n;
    else counts.set(key, { key, label: validityLabel(days), count: n, days });
  };
  for (const i of items) add(i.days, 1);
  if (selected && !counts.has(selected)) add(selected === UNKNOWN ? null : Number(selected), 0);
  return [...counts.values()].sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
}
