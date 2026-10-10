// Engine rekomendasi bertahap, mengikuti blueprint_rekomendasi_paket_data.md.
// Murni (tanpa React) agar mudah diuji.
import type { IbpItem } from "../api/ibp.ts";

export type Hotspot = "ya" | "tidak" | "tidak_yakin";
export type Duration = "1" | "2-3" | "7+" | "tidak_yakin";
export type Usage = "ringan" | "sedang" | "berat" | "tidak_yakin";
export type Budget = "lt10" | "10-20" | "gt20" | "tidak_yakin";
export type Priority = "cheapest" | "best_value" | "tidak_yakin";

export interface Answers {
  operator: string;
  hotspot: Hotspot;
  duration: Duration;
  usage: Usage;
  budget: Budget;
  priority: Priority;
}

// Pemetaan pilihan -> batas numerik. Ubah di sini bila ambang perlu disesuaikan.
export const DURATION_RANGE: Record<Duration, [number, number] | null> = {
  "1": [1, 1],
  "2-3": [2, 3],
  "7+": [7, Infinity],
  tidak_yakin: null, // skip filter durasi
};
export const MIN_DAILY_GB: Record<Usage, number> = { ringan: 1, sedang: 2, berat: 5, tidak_yakin: 0 };
export const MAX_BUDGET: Record<Budget, number> = {
  lt10: 10_000,
  "10-20": 20_000,
  gt20: Infinity,
  tidak_yakin: Infinity,
};

export interface WProduct {
  item: IbpItem;
  dailyGb: number | null; // total_gb / masa_aktif_hari
  ratePerGb: number | null; // harga / total_gb
  allowHotspot: boolean;
}

/** API tidak punya field allow_hotspot: paket "Warnet" dianggap tanpa hotspot, lainnya diizinkan. */
export function toProduct(item: IbpItem): WProduct {
  const gbTotal = item.volumeGb && item.volumeGb > 0 ? item.volumeGb : null;
  return {
    item,
    dailyGb: gbTotal !== null && item.validityDays && item.validityDays > 0 ? gbTotal / item.validityDays : null,
    ratePerGb: gbTotal !== null ? item.price / gbTotal : null,
    allowHotspot: !/warnet/i.test(item.name),
  };
}

export interface Result {
  primary: WProduct | null;
  secondary: WProduct | null;
  message?: string;
}

export function getRecommendations(items: IbpItem[], a: Answers): Result {
  const range = DURATION_RANGE[a.duration];
  const minDaily = MIN_DAILY_GB[a.usage];
  const maxBudget = MAX_BUDGET[a.budget];
  const needHotspot = a.hotspot === "ya";
  const hotspotUnsure = a.hotspot === "tidak_yakin";

  // Tahap 1: hard filter
  const valid = items
    .filter((i) => i.available)
    .map(toProduct)
    .filter((p) => {
      if (p.item.operator !== a.operator) return false;
      if (needHotspot && !p.allowHotspot) return false;
      if (range) {
        const d = p.item.validityDays;
        if (d === null || d < range[0] || d > range[1]) return false;
      }
      if (minDaily > 0 && (p.dailyGb === null || p.dailyGb < minDaily)) return false;
      if (p.item.price > maxBudget) return false;
      return true;
    });

  if (valid.length === 0) return { primary: null, secondary: null, message: "Tidak ada paket yang sesuai kriteria." };

  // "Tidak yakin" hotspot: tidak menyaring, tapi paket terbatas (mis. Warnet) didegradasi.
  const penalty = (p: WProduct) => (hotspotUnsure && !p.allowHotspot ? 1 : 0);
  const rate = (p: WProduct) => p.ratePerGb ?? Number.POSITIVE_INFINITY;

  // Tahap 2: sorting & pemilihan
  if (a.priority === "cheapest") {
    valid.sort((x, y) => penalty(x) - penalty(y) || x.item.price - y.item.price);
    const primary = valid[0];
    const secondary =
      valid.find((p) => {
        if (p === primary || p.item.volumeGb === null || primary.item.volumeGb === null) return false;
        const diff = p.item.price - primary.item.price;
        return diff > 0 && diff <= 2000 && p.item.volumeGb / primary.item.volumeGb >= 1.5;
      }) ??
      valid[1] ??
      null;
    return { primary, secondary };
  }

  if (a.priority === "best_value") {
    valid.sort((x, y) => penalty(x) - penalty(y) || rate(x) - rate(y) || x.item.price - y.item.price);
    const primary = valid[0];
    const secondary = valid.find((p) => p !== primary && p.item.price < primary.item.price) ?? valid[1] ?? null;
    return { primary, secondary };
  }

  // Hybrid: 50% harga + 50% rate per GB (dinormalisasi). Rate kosong dianggap yang terburuk.
  const finiteRates = valid.map((p) => p.ratePerGb).filter((r): r is number => r !== null);
  const worstRate = finiteRates.length ? Math.max(...finiteRates) : 0;
  const prices = valid.map((p) => p.item.price);
  const rates = valid.map((p) => p.ratePerGb ?? worstRate);
  const [minP, maxP] = [Math.min(...prices), Math.max(...prices)];
  const [minR, maxR] = [Math.min(...rates), Math.max(...rates)];
  const score = (p: WProduct) =>
    0.5 * ((p.item.price - minP) / (maxP - minP || 1)) +
    0.5 * (((p.ratePerGb ?? worstRate) - minR) / (maxR - minR || 1)) +
    penalty(p);
  const scored = valid.map((p) => ({ p, s: score(p) })).sort((x, y) => x.s - y.s);
  return { primary: scored[0].p, secondary: scored[1]?.p ?? null };
}

/** Teks badge untuk kartu kedua (smart upsell / alternatif). */
export function compareBadge(primary: WProduct, secondary: WProduct, fmt: (n: number) => string): string {
  const dp = secondary.item.price - primary.item.price;
  const vp = primary.item.volumeGb;
  const vs = secondary.item.volumeGb;
  if (dp > 0 && vp !== null && vs !== null && vs > vp) {
    return `Nambah ${fmt(dp)}, Dapet +${+(vs - vp).toFixed(2)} GB!`;
  }
  if (dp < 0) return `Lebih hemat ${fmt(-dp)} dari pilihan utama`;
  if (dp > 0) return `Nambah ${fmt(dp)} untuk opsi lain`;
  return "Opsi pembanding";
}
