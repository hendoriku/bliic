// Cache data katalog di IndexedDB (stale-while-revalidate).
//
// Dibanding localStorage lama:
//  - asinkron: membaca ~500 KB tidak memblokir render pertama (localStorage membaca & mem-parse JSON di main thread);
//  - menyimpan item yang SUDAH dinormalisasi (structured clone), jadi tidak ada JSON.parse + normalisasi ulang;
//  - menyimpan ETag respons, sehingga penyegaran cukup permintaan bersyarat (304, tanpa isi) bila data tidak berubah.
// Semua akses dibungkus try/catch: IndexedDB bisa tidak tersedia (mode privat, dll) dan aplikasi tetap jalan tanpa cache.
import { createStore, get, set } from "idb-keyval";
import type { IbpItem } from "./ibp.ts";

/** Naikkan bila bentuk IbpItem berubah supaya cache lama dibuang. */
export const SCHEMA_VERSION = 3;
export const CACHE_KEY = `ibp:v${SCHEMA_VERSION}`;
export const CACHE_TTL_MS = 5 * 60 * 1000; // dianggap segar selama 5 menit

export interface Cached {
  at: number; // epoch ms terakhir data dipastikan mutakhir
  etag: string | null;
  items: IbpItem[];
}

/** Penyimpanan kunci-nilai minimal; mudah digantikan di test. */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

let store: ReturnType<typeof createStore> | undefined;
function defaultKV(): KV | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    store ??= createStore("bliic", "cache");
    const s = store;
    return { get: (k) => get(k, s), set: (k, v) => set(k, v, s) };
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

export async function readCache(kv: KV | null = defaultKV()): Promise<Cached | null> {
  purgeLegacy();
  try {
    const v = (await kv?.get(CACHE_KEY)) as Partial<Cached> | undefined;
    if (!v || typeof v.at !== "number" || !Array.isArray(v.items)) return null;
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
