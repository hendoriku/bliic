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

const MAX_PAGES = 200; // pengaman agar tidak berputar tanpa akhir

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asInt = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && Number.isInteger(n) ? n : null;
};

/** Tautan halaman berikutnya (gaya Laravel: links.next / next_page_url), bila ada. */
function nextUrl(root: Record<string, unknown>): string | null {
  const candidates = [obj(root.links).next, root.next_page_url, obj(root.meta).next_page_url, root.next];
  const found = candidates.find((c) => typeof c === "string" && c !== "");
  return typeof found === "string" ? found : null;
}

/** Nomor halaman terakhir (meta.last_page / last_page), bila API memakainya. */
function lastPage(root: Record<string, unknown>): number | null {
  const meta = obj(root.meta);
  return asInt(meta.last_page) ?? asInt(root.last_page) ?? asInt(obj(root.pagination).last_page);
}

function currentPage(root: Record<string, unknown>): number {
  return asInt(obj(root.meta).current_page) ?? asInt(root.current_page) ?? asInt(obj(root.pagination).current_page) ?? 1;
}

/**
 * Mengambil seluruh halaman: mengikuti tautan "next" bila ada, atau menelusuri
 * ?page=2..last_page. Hasil digabung menjadi satu respons ({ ...halaman1, data: semua }).
 */
export async function fetchAllPages(client: ApiClient, path = IBP_PATH): Promise<unknown> {
  const first = await client.getJson(path);
  const root = obj(first);
  if (!Array.isArray(root.data)) return first; // bukan bentuk berhalaman
  const all: unknown[] = [...root.data];

  let pages = 1;
  let next = nextUrl(root);
  if (next) {
    while (next && pages < MAX_PAGES) {
      const page = obj(await client.getJson(next));
      if (!Array.isArray(page.data) || page.data.length === 0) break;
      all.push(...page.data);
      pages++;
      next = nextUrl(page);
    }
  } else {
    const last = lastPage(root);
    for (let n = currentPage(root) + 1; last !== null && n <= last && pages < MAX_PAGES; n++) {
      const page = obj(await client.getJson(path, { page: n }));
      if (!Array.isArray(page.data)) break;
      all.push(...page.data);
      pages++;
    }
  }

  // Hilangkan duplikat bila ada tumpang tindih antarhalaman.
  const seen = new Set<string>();
  const data = all.filter((r) => {
    const code = str(obj(r).code);
    if (!code) return true;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
  return { ...root, data, _pages: pages };
}

/** Ambil semua halaman dari jaringan dan simpan ke cache. */
export async function fetchIbp(client: ApiClient): Promise<IbpResult> {
  const json = await fetchAllPages(client);
  writeCache(json);
  return parseIbp(json);
}
