// Satu-satunya tempat yang menentukan lencana apa yang tampil di kartu.
// API mengirim sinyal yang sama dua kali (flag boolean DAN array `badges`);
// di sini semuanya disatukan, dinormalisasi, dan dihilangkan duplikatnya.
import type { IbpItem } from "../api/ibp.ts";

export type Tone = "brand" | "good" | "neutral";
export interface Badge {
  key: string;
  label: string;
  tone: Tone;
}

/** Daftar lencana yang dikenal. Urutan di sini = urutan tampil. Tambah/ubah label di sini. */
const KNOWN: Record<string, { label: string; tone: Tone }> = {
  smart_pick: { label: "Smart Pick", tone: "brand" },
  worth_it: { label: "Worth It", tone: "good" },
};

/** "Smart Pick", "smart-pick", "SMART_PICK" -> "smart_pick" */
export const badgeKey = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

const humanize = (key: string): string =>
  key.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export function badgesFor(item: Pick<IbpItem, "isSmartPick" | "isWorthIt" | "badges">): Badge[] {
  const keys = new Set<string>();
  if (item.isSmartPick) keys.add("smart_pick");
  if (item.isWorthIt) keys.add("worth_it");
  for (const b of item.badges) {
    const k = badgeKey(b);
    if (k) keys.add(k);
  }
  const order = Object.keys(KNOWN);
  return [...keys]
    .sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    })
    .map((key) => ({ key, label: KNOWN[key]?.label ?? humanize(key), tone: KNOWN[key]?.tone ?? "neutral" }));
}
