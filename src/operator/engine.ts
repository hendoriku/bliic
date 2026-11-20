// Rekomendasi operator berdasarkan karakteristik pengguna, dihitung dari data katalog.
//
// Yang diukur HANYA yang ada di data: harga per GB, ragam paket, ukuran kuota, dan tanda kualitas dari API
// (Worth It / Smart Pick). Kualitas sinyal dan cakupan tidak ada di data, jadi tidak ikut dinilai.
import type { IbpItem } from "../api/ibp.ts";
import { MIN_DAILY_GB, type Usage } from "../wizard/engine.ts";

export type Horizon = "harian" | "mingguan" | "bulanan" | "panjang" | "tidak_yakin";
export type OpBudget = "lt15" | "15-50" | "50-150" | "gt150";
export type OpPriority = "hemat" | "variasi" | "besar" | "seimbang";

export interface Profile {
  usage: Usage; // pemakaian harian
  horizon: Horizon; // biasanya beli untuk berapa lama
  budget: OpBudget; // anggaran maksimum per pembelian
  priority: OpPriority;
}

/** Rentang masa aktif (hari) per pilihan; null = semua. Ubah di sini bila ambang perlu disesuaikan. */
export const HORIZON_RANGE: Record<Horizon, [number, number] | null> = {
  harian: [1, 3],
  mingguan: [4, 15],
  bulanan: [16, 45],
  panjang: [46, Infinity],
  tidak_yakin: null,
};
export const MAX_PRICE: Record<OpBudget, number> = { lt15: 15_000, "15-50": 50_000, "50-150": 150_000, gt150: Infinity };

/** Bobot tiap dimensi menurut prioritas: h = hemat per GB, v = ragam paket, s = ukuran kuota, q = tanda kualitas. */
export const WEIGHTS: Record<OpPriority, { h: number; v: number; s: number; q: number }> = {
  hemat: { h: 0.6, v: 0.1, s: 0.1, q: 0.2 },
  variasi: { h: 0.25, v: 0.5, s: 0.05, q: 0.2 },
  besar: { h: 0.3, v: 0.05, s: 0.5, q: 0.15 },
  seimbang: { h: 0.4, v: 0.2, s: 0.2, q: 0.2 },
};

/** Di bawah jumlah ini hasil dianggap kurang meyakinkan; skor diredam. */
export const MIN_CONFIDENT = 6;

export type Strength = "hemat" | "variasi" | "besar";

export interface OperatorResult {
  operator: string;
  /** 0-100. */
  score: number;
  /** Jumlah paket yang cocok dengan profil. */
  matches: number;
  /** Harga per GB tipikal (gabungan median dan rata-rata 3 termurah). */
  ratePerGb: number;
  /** Berapa persen lebih mahal dari operator termurah (0 untuk yang termurah). */
  pricierPct: number;
  maxGb: number;
  /** Porsi paket bertanda Worth It atau Smart Pick, 0-1. */
  qualityShare: number;
  strengths: Strength[];
  lowConfidence: boolean;
  /** Paket contoh yang paling cocok untuk ditawarkan. */
  sample: IbpItem;
}

export interface Ranking {
  results: OperatorResult[];
  /** Operator yang tidak punya satu pun paket cocok. */
  unmatched: string[];
}

const median = (sorted: number[]): number => {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

/** Paket yang bisa dibandingkan: tersedia, kuota dan masa aktif (>= 1 hari) diketahui. */
const comparable = (i: IbpItem): boolean => i.available && !!i.volumeGb && i.volumeGb > 0 && i.days !== null && i.days >= 1;

export function fitsProfile(i: IbpItem, p: Profile): boolean {
  if (!comparable(i)) return false;
  const range = HORIZON_RANGE[p.horizon];
  if (range && (i.days! < range[0] || i.days! > range[1])) return false;
  if (i.price > MAX_PRICE[p.budget]) return false;
  return i.volumeGb! / i.days! >= MIN_DAILY_GB[p.usage];
}

export function rankOperators(items: readonly IbpItem[], p: Profile): Ranking {
  const operators = [...new Set(items.map((i) => i.operator))];
  const byOp = new Map<string, IbpItem[]>();
  for (const i of items) if (fitsProfile(i, p)) (byOp.get(i.operator) ?? byOp.set(i.operator, []).get(i.operator)!).push(i);

  const stats = [...byOp.entries()].map(([operator, pk]) => {
    const rates = pk.map((i) => i.price / i.volumeGb!).sort((a, b) => a - b);
    const best3 = rates.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, rates.length);
    const maxGb = Math.max(...pk.map((i) => i.volumeGb!));
    const quality = pk.filter((i) => i.isWorthIt || i.isSmartPick).length / pk.length;
    const byRate = [...pk].sort((a, b) => a.price / a.volumeGb! - b.price / b.volumeGb! || a.price - b.price);
    const sample = p.priority === "besar" ? [...pk].sort((a, b) => b.volumeGb! - a.volumeGb! || a.price - b.price)[0] : byRate[0];
    return { operator, n: pk.length, rate: 0.5 * median(rates) + 0.5 * best3, maxGb, quality, sample };
  });

  const unmatched = operators.filter((o) => !byOp.has(o)).sort();
  if (stats.length === 0) return { results: [], unmatched };

  const minRate = Math.min(...stats.map((s) => s.rate));
  const maxN = Math.max(...stats.map((s) => s.n));
  const maxMaxGb = Math.max(...stats.map((s) => s.maxGb));
  const w = WEIGHTS[p.priority];

  const results = stats.map<OperatorResult>((s) => {
    const h = minRate / s.rate; // 1 = termurah; selisih proporsional (bukan min-max yang melebih-lebihkan)
    const v = Math.log(1 + s.n) / Math.log(1 + maxN);
    const size = Math.log(1 + s.maxGb) / Math.log(1 + maxMaxGb);
    const damp = Math.min(1, (s.n + 2) / (MIN_CONFIDENT + 2)); // sedikit paket = kurang meyakinkan
    const score = 100 * (w.h * h + w.v * v + w.s * size + w.q * s.quality) * damp;
    return {
      operator: s.operator,
      score: Math.round(score),
      matches: s.n,
      ratePerGb: s.rate,
      pricierPct: Math.round((s.rate / minRate - 1) * 100),
      maxGb: s.maxGb,
      qualityShare: s.quality,
      strengths: [],
      lowConfidence: s.n < MIN_CONFIDENT,
      sample: s.sample,
    };
  });

  // Penanda keunggulan hanya bermakna bila ada pembanding.
  if (results.length > 1) {
    const top = <K extends keyof OperatorResult>(k: K, dir: 1 | -1) => results.reduce((a, b) => ((b[k] as number) * dir > (a[k] as number) * dir ? b : a));
    top("ratePerGb", -1).strengths.push("hemat");
    top("matches", 1).strengths.push("variasi");
    top("maxGb", 1).strengths.push("besar");
  }

  results.sort((a, b) => b.score - a.score || a.ratePerGb - b.ratePerGb);
  return { results, unmatched };
}

export type Relaxation = "budget" | "usage" | "horizon";

export interface Recommendation extends Ranking {
  /** Syarat yang dilonggarkan agar ada hasil (null = profil terpenuhi apa adanya). */
  relaxed: Relaxation | null;
  /** Bila anggaran dilonggarkan: harga paket termurah yang memenuhi syarat lainnya. */
  neededPrice: number | null;
}

/**
 * Seperti rankOperators, tetapi bila tidak ada paket yang cocok, syarat dilonggarkan bertahap
 * (anggaran, lalu kebutuhan kuota harian, lalu masa aktif) dan hasilnya memberi tahu syarat mana yang dilonggarkan.
 */
export function recommendOperators(items: readonly IbpItem[], p: Profile): Recommendation {
  const first = rankOperators(items, p);
  if (first.results.length > 0) return { ...first, relaxed: null, neededPrice: null };

  const noBudget: Profile = { ...p, budget: "gt150" };
  const noUsage: Profile = { ...noBudget, usage: "tidak_yakin" };
  const noHorizon: Profile = { ...noUsage, horizon: "tidak_yakin" };
  for (const [relaxed, q] of [["budget", noBudget], ["usage", noUsage], ["horizon", noHorizon]] as const) {
    const r = rankOperators(items, q);
    if (r.results.length === 0) continue;
    const neededPrice = relaxed === "budget" ? Math.min(...items.filter((i) => fitsProfile(i, q)).map((i) => i.price)) : null;
    return { ...r, relaxed, neededPrice };
  }
  return { ...first, relaxed: null, neededPrice: null };
}
