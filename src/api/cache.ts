// Cache data katalog di IndexedDB (stale-while-revalidate).
//
// Dibanding localStorage lama:
//  - asinkron: membaca ~500 KB tidak memblokir render pertama (localStorage membaca & mem-parse JSON di main thread);
//  - menyimpan item yang SUDAH dinormalisasi (structured clone), jadi tidak ada JSON.parse + normalisasi ulang;
//  - menyimpan ETag respons, sehingga penyegaran cukup permintaan bersyarat (304, tanpa isi) bila data tidak berubah.
// Semua akses dibungkus try/catch: IndexedDB bisa tidak tersedia (mode privat, dll) dan aplikasi tetap jalan tanpa cache.
import { createStore, del, get, set } from "idb-keyval";
import type { IbpItem } from "./ibp.ts";

/** Naikkan bila bentuk IbpItem berubah supaya cache lama dibuang. */
export const SCHEMA_VERSION = 5;
export const CACHE_KEY = `ibp:v${SCHEMA_VERSION}`;
/** Server menyatakan data berlaku maksimal 60 detik (cache-control: max-age=60), jadi lebih sering dari ini tidak ada gunanya. */
export const CACHE_TTL_MS = 60 * 1000;
/** Selama halaman terbuka, data diperiksa ulang tiap interval ini (permintaan bersyarat, murah bila tidak berubah). */
export const POLL_MS = 60 * 1000;
/** Katalog berubah cepat (produk hilang, harga berganti), jadi cache yang lebih tua dari ini dibuang, bukan ditampilkan. */
export const CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Di atas usia ini data yang gagal disegarkan diberi peringatan jelas. */
export const STALE_WARN_MS = 5 * 60 * 1000;

export interface Cached {
  at: number; // epoch ms terakhir data dipastikan mutakhir
  etag: string | null;
  items: IbpItem[];
}

/** Penyimpanan kunci-nilai minimal; mudah digantikan di test. */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del?(key: string): Promise<void>;
}

let store: ReturnType<typeof createStore> | undefined;
function defaultKV(): KV | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    store ??= createStore("bliic", "cache");
    const s = store;
    return { get: (k) => get(k, s), set: (k, v) => set(k, v, s), del: (k) => del(k, s) };
  } catch {
    return null;
  }
}

/** Hapus cache localStorage versi lama (~900 KB) yang tidak dipakai lagi. */
function purgeLegacy(): void {
  try {
    for (const k of ["bliic:ibp:v1", "bliic:ibp:v2"]) localStorage.removeItem(k);
  } catch {
    /* abaikan */
  }
}

/** Hapus cache dari versi skema sebelumnya (bentuk data lama dan bisa memuat produk yang sudah tidak dijual). */
async function purgeOldSchemas(kv: KV | null): Promise<void> {
  try {
    for (let v = 1; v < SCHEMA_VERSION; v++) await kv?.del?.(`ibp:v${v}`);
  } catch {
    /* abaikan */
  }
}

export async function readCache(kv: KV | null = defaultKV(), now = Date.now()): Promise<Cached | null> {
  purgeLegacy();
  void purgeOldSchemas(kv);
  try {
    const v = (await kv?.get(CACHE_KEY)) as Partial<Cached> | undefined;
    if (!v || typeof v.at !== "number" || !Array.isArray(v.items)) return null;
    if (now - v.at > CACHE_MAX_AGE_MS) return null; // terlalu tua: lebih baik muat ulang daripada menampilkan data yang mungkin sudah tidak berlaku
    return { at: v.at, etag: typeof v.etag === "string" ? v.etag : null, items: v.items };
  } catch {
    return null;
  }
}

export async function writeCache(c: Cached, kv: KV | null = defaultKV()): Promise<void> {
  try {
    await kv?.set(CACHE_KEY, c);
  } catch {
    /* kuota penuh atau storage diblokir: abaikan */
  }
}

export const isFresh = (c: Pick<Cached, "at">, now = Date.now()): boolean => now - c.at < CACHE_TTL_MS;
