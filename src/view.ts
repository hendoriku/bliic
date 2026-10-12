import type { IbpItem } from "./api/ibp.ts";
import type { DetailKey } from "./presentation/details.ts";

export const VIEWS = ["kartu", "daftar", "tabel"] as const;
export type View = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<View, string> = { kartu: "Kartu", daftar: "Daftar", tabel: "Tabel" };
export const VIEW_STORAGE_KEY = "bliic:view:v2";

/** Satu paket yang akan ditampilkan beserta hiasannya; dipakai bersama oleh semua tab dan semua mode tampilan. */
export interface Entry {
  item: IbpItem;
  /** Pita sorotan (mis. "Paling Hemat Tunai"). */
  highlight?: { text: string; tone: "main" | "alt" | "unl" };
  /** Catatan kecil di bawah detail. */
  note?: string;
  /** Tampilkan "≈ Rp X/GB" di bawah harga. */
  showPricePerGb?: boolean;
  /** Baris detail yang ditampilkan (khusus mode Kartu). */
  rows?: DetailKey[];
}
