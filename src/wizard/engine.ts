// Engine rekomendasi bertahap, mengikuti blueprint_rekomendasi_paket_data.md.
// Murni (tanpa React) agar mudah diuji.
import type { IbpItem } from "../api/ibp.ts";
import { durationDays, isUnlimited } from "../domain/unlimited.ts";

export type Phone = "ya" | "tidak";
/** Kuota volume biasa (ada batas GB) atau skema unlimited murni. */
export type Scheme = "volume" | "unlimited";
export type Hotspot = "ya" | "tidak" | "tidak_yakin";
export type Duration = "1" | "2-3" | "7+" | "tidak_yakin";
export type Usage = "ringan" | "sedang" | "berat" | "tidak_yakin";
export type Budget = "lt10" | "10-20" | "gt20" | "tidak_yakin";
export type Priority = "cheapest" | "best_value" | "tidak_yakin";

export interface Answers {
  operator: string;
  /** Hafal / bersedia mengisi nomor HP? Menentukan boleh tidaknya menawarkan Paket Data. */
  phone: Phone;
  /** Kosong = "volume". Hanya ditanyakan bila operator punya paket unlimited murni. */
  scheme?: Scheme;
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

/** Jenis katalog yang bisa dibeli tanpa nomor HP (voucher/kuota elektrik). Paket Data memerlukan nomor. */
export const NO_NUMBER_CATALOGUES: readonly string[] = ["data-voucher", "electric-quota"];

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

const phoneOk = (i: IbpItem, phone: Phone) => phone === "ya" || NO_NUMBER_CATALOGUES.includes(i.catalogue);

/** Jumlah paket unlimited murni yang tersedia untuk operator + jawaban nomor HP (menentukan perlu tidaknya pertanyaan skema). */
export function countUnlimited(items: IbpItem[], operator: string, phone: Phone): number {
  return items.filter((i) => i.available && isUnlimited(i) && i.operator === operator && phoneOk(i, phone)).length;
}

export function getRecommendations(items: IbpItem[], a: Answers): Result {
  return a.scheme === "unlimited" ? recommendUnlimited(items, a) : recommendVolume(items, a);
}

/**
 * Skema unlimited: kuota tidak relevan, jadi "pemakaian harian" dan "prioritas" tidak ditanyakan.
 * Opsi 1 = paling hemat per hari; Opsi 2 = paling murah tunai.
 */
function recommendUnlimited(items: IbpItem[], a: Answers): Result {
  const range = DURATION_RANGE[a.duration];
  const maxBudget = MAX_BUDGET[a.budget];
  const valid = items
    .filter((i) => i.available && isUnlimited(i))
    .map(toProduct)
    .filter((p) => {
      if (p.item.operator !== a.operator || !phoneOk(p.item, a.phone)) return false;
      if (a.hotspot === "ya" && !p.allowHotspot) return false;
      if (range) {
        const d = durationDays(p.item);
        if (d === null || d < range[0] || d > range[1]) return false;
      }
      return p.item.price <= maxBudget;
    });
  if (valid.length === 0) {
    return { primary: null, secondary: null, message: "Belum ada paket unlimited yang sesuai kriteria." };
  }
  const penalty = (p: WProduct) => (a.hotspot === "tidak_yakin" && !p.allowHotspot ? 1 : 0);
  const perDay = (p: WProduct) => {
    const d = durationDays(p.item);
    return d ? p.item.price / d : Number.POSITIVE_INFINITY;
  };
  const byValue = [...valid].sort((x, y) => penalty(x) - penalty(y) || perDay(x) - perDay(y) || x.item.price - y.item.price);
  const primary = byValue[0];
  const secondary = valid
    .filter((p) => p !== primary)
    .sort((x, y) => penalty(x) - penalty(y) || x.item.price - y.item.price)[0] ?? null;
  return { primary, secondary };
}

function recommendVolume(items: IbpItem[], a: Answers): Result {
  const range = DURATION_RANGE[a.duration];
  const minDaily = MIN_DAILY_GB[a.usage];
  const maxBudget = MAX_BUDGET[a.budget];
  const needHotspot = a.hotspot === "ya";
  const hotspotUnsure = a.hotspot === "tidak_yakin";

  // Tahap 1: hard filter
  const valid = items
    .filter((i) => i.available)
    // Blueprint mensyaratkan total_gb dan masa_aktif_hari. Item tanpa keduanya (tagihan, pulsa, SMS,
    // perpanjangan masa aktif, "unlimited per jam") bukan paket data yang bisa dibandingkan.
    .filter((i) => i.volumeGb !== null && i.volumeGb > 0 && i.validityDays !== null && i.validityDays > 0)
    .map(toProduct)
    .filter((p) => {
      if (p.item.operator !== a.operator) return false;
      if (!phoneOk(p.item, a.phone)) return false;
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

/** Teks badge kartu kedua pada skema unlimited (opsi paling murah tunai). */
export function compareUnlimitedBadge(primary: WProduct, secondary: WProduct, fmt: (n: number) => string): string {
  const dp = primary.item.price - secondary.item.price;
  return dp > 0 ? `Paling murah tunai, hemat ${fmt(dp)}` : "Alternatif unlimited";
}
