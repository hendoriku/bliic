import type { ApiClient } from "./client.ts";
import { writeCache } from "./cache.ts";

export const IBP_PATH = "/catalogue/ibp";

export interface IbpItem {
  code: string;
  name: string;
  catalogue: string;
  operator: string;
  price: number;
  priceType: string;
  currency: string;
  available: boolean;
  volumeGb: number | null;
  validityDays: number | null;
  ratePerGbDay: number | null;
  isSmartPick: boolean;
  isWorthIt: boolean;
  badges: string[];
  buyUrl: string | null;
}

export interface IbpResult {
  items: IbpItem[];
  /** Semua kunci selain `data` pada respons (meta, links, dsb.) untuk keperluan debug. */
  extra: Record<string, unknown>;
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

function badgeLabel(b: unknown): string {
  if (typeof b === "string") return b;
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    return str(o.label) || str(o.name) || str(o.code) || JSON.stringify(b);
  }
  return String(b);
}

/** Mengubah satu item mentah menjadi IbpItem; mengembalikan null jika item tidak layak ditampilkan. */
export function normalizeItem(raw: unknown): IbpItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = str(o.code);
  const price = num(o.price);
  if (!code || price === null) return null;
  return {
    code,
    name: str(o.name, code).replace(/\s+/g, " ").trim(),
    catalogue: str(o.catalogue, "lainnya"),
    operator: str(o.operator, "-"),
    price,
    priceType: str(o.price_type, "fixed"),
    currency: str(o.currency, "IDR"),
    available: o.available !== false,
    volumeGb: num(o.volume_gb),
    validityDays: num(o.validity_days),
    ratePerGbDay: num(o.rate_per_gb_day),
    isSmartPick: o.is_smart_pick === true,
    isWorthIt: o.is_worth_it === true,
    badges: Array.isArray(o.badges) ? o.badges.map(badgeLabel) : [],
    buyUrl: typeof o.buy_url === "string" ? o.buy_url : null,
  };
}

export function parseIbp(json: unknown): IbpResult {
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const list = Array.isArray(json) ? json : Array.isArray(root.data) ? root.data : [];
  const { data: _data, ...extra } = root;
  return { items: list.map(normalizeItem).filter((i): i is IbpItem => i !== null), extra };
}

/** Ambil dari jaringan dan simpan ke cache. */
export async function fetchIbp(client: ApiClient): Promise<IbpResult> {
  const json = await client.getJson(IBP_PATH);
  writeCache(json);
  return parseIbp(json);
}
