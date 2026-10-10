// Cache respons API di localStorage (stale-while-revalidate).
// Semua akses dibungkus try/catch: storage bisa kosong/diblokir (mode privat, dll).

export const CACHE_KEY = "bliic:ibp:v2";
export const CACHE_TTL_MS = 5 * 60 * 1000; // dianggap segar selama 5 menit

export interface Cached {
  at: number; // epoch ms saat disimpan
  json: unknown; // respons mentah, di-parse ulang saat dibaca
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function readCache(storage: StorageLike | null = defaultStorage()): Cached | null {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Cached>;
    return typeof v.at === "number" && v.json !== undefined ? { at: v.at, json: v.json } : null;
  } catch {
    return null;
  }
}

export function writeCache(json: unknown, now = Date.now(), storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ at: now, json } satisfies Cached));
  } catch {
    /* kuota penuh atau storage diblokir: abaikan */
  }
}

export const isFresh = (c: Cached, now = Date.now()): boolean => now - c.at < CACHE_TTL_MS;
