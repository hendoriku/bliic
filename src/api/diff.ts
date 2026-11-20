import type { IbpItem } from "./ibp.ts";

export interface CatalogueDiff {
  added: number;
  removed: number;
  priceChanged: number;
  /** Berubah dari tersedia menjadi habis atau sebaliknya. */
  availabilityChanged: number;
}

/** Membandingkan dua versi katalog berdasarkan `code`, untuk memberi tahu pengguna apa yang berubah. */
export function diffCatalogue(prev: readonly IbpItem[], next: readonly IbpItem[]): CatalogueDiff {
  const before = new Map(prev.map((i) => [i.code, i]));
  const after = new Set<string>();
  let added = 0, priceChanged = 0, availabilityChanged = 0;
  for (const i of next) {
    after.add(i.code);
    const old = before.get(i.code);
    if (!old) added++;
    else {
      if (old.price !== i.price) priceChanged++;
      if (old.available !== i.available) availabilityChanged++;
    }
  }
  let removed = 0;
  for (const code of before.keys()) if (!after.has(code)) removed++;
  return { added, removed, priceChanged, availabilityChanged };
}

/** Ringkasan bahasa sehari-hari, mis. "27 paket dihapus, 59 harga berubah"; null bila tidak ada perubahan berarti. */
export function describeDiff(d: CatalogueDiff): string | null {
  const parts: string[] = [];
  if (d.added) parts.push(`${d.added} paket baru`);
  if (d.removed) parts.push(`${d.removed} paket dihapus`);
  if (d.priceChanged) parts.push(`${d.priceChanged} harga berubah`);
  if (d.availabilityChanged) parts.push(`${d.availabilityChanged} status stok berubah`);
  return parts.length ? parts.join(", ") : null;
}
