import type { IbpItem } from "./api/ibp.ts";

export interface Need {
  budget?: number; // harga maksimum (IDR)
  minGb?: number; // kuota minimum
  minDays?: number; // masa aktif minimum
  catalogue?: string; // kosong = semua jenis
  operator?: string; // kosong = semua operator
}

export interface Recommendation {
  item: IbpItem;
  reason?: string;
}

/** Biaya per GB per hari: pakai nilai dari API, atau hitung sendiri bila datanya lengkap. */
export function unitCost(i: IbpItem): number | null {
  if (i.ratePerGbDay !== null) return i.ratePerGbDay;
  if (i.volumeGb && i.validityDays) return i.price / i.volumeGb / i.validityDays;
  return null;
}

export function matches(i: IbpItem, n: Need): boolean {
  if (!i.available) return false;
  if (n.catalogue && i.catalogue !== n.catalogue) return false;
  if (n.operator && i.operator !== n.operator) return false;
  if (n.budget !== undefined && i.price > n.budget) return false;
  if (n.minGb !== undefined && (i.volumeGb === null || i.volumeGb < n.minGb)) return false;
  if (n.minDays !== undefined && (i.validityDays === null || i.validityDays < n.minDays)) return false;
  return true;
}

export function recommend(items: IbpItem[], n: Need, limit = 5): Recommendation[] {
  const ok = items.filter((i) => matches(i, n));
  const costOf = (i: IbpItem) => unitCost(i) ?? Number.POSITIVE_INFINITY;
  ok.sort((a, b) => costOf(a) - costOf(b) || a.price - b.price);
  return ok.slice(0, limit).map((item) => ({ item, reason: explain(item, ok[0] === item) || undefined }));
}

/** Catatan di bawah kartu. Lencana (Smart Pick, Worth It) ditampilkan kartu itu sendiri, jadi tidak diulang di sini. */
function explain(i: IbpItem, best: boolean): string {
  return best && unitCost(i) !== null ? "Paling hemat per GB per hari di antara yang cocok" : "";
}
