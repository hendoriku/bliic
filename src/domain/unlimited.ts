// Pengenalan paket "unlimited murni" dan masa aktif yang diturunkan dari nama paket.
// Dipakai bersama oleh engine rekomendasi dan lapisan tampilan.
import type { IbpItem } from "../api/ibp.ts";

/**
 * Unlimited murni = tanpa kuota GB tetap dan namanya menyebut unlimited.
 * Paket seperti "3GB + Unlimited App" punya GB tetap, jadi tetap skema kuota volume.
 */
export const isUnlimited = (i: Pick<IbpItem, "volumeGb" | "name">): boolean =>
  i.volumeGb === null && /\b(unlimited|unli)\b/i.test(i.name);

/**
 * Masa aktif dalam hari. Memakai `validityDays` dari API; bila kosong, dibaca dari nama
 * ("... 28D", "... 7 Days", "... 3 Jam" -> 0,125 hari). null jika tidak terbaca.
 */
export function durationDays(i: Pick<IbpItem, "validityDays" | "name">): number | null {
  if (i.validityDays !== null && i.validityDays > 0) return i.validityDays;
  const d = i.name.match(/(\d+(?:[.,]\d+)?)\s*(?:d|hari|days?)\b/i);
  if (d) return Number(d[1].replace(",", "."));
  const h = i.name.match(/(\d+(?:[.,]\d+)?)\s*(?:jam|hr|hours?)\b/i);
  if (h) return Number(h[1].replace(",", ".")) / 24;
  return null;
}

/** "1 hari", "28 hari", "3 jam", atau "—". */
export function durationLabel(i: Pick<IbpItem, "validityDays" | "name">): string {
  const d = durationDays(i);
  if (d === null) return "—";
  if (d < 1) return `${Math.round(d * 24)} jam`;
  return `${+d.toFixed(2)} hari`;
}
