// Baris detail pada kartu. Untuk menambah/menghapus/mengganti label detail,
// ubah DETAILS di sini lalu pilih baris mana yang tampil lewat prop `rows` pada <PackageCard>.
import type { IbpItem } from "../api/ibp.ts";
import { days, gb, rupiahPrecise } from "../format.ts";
import { unitCost } from "../recommend.ts";

export type DetailKey = "kuota" | "masa" | "perGbHari";

interface DetailDef {
  label: string;
  /** null = baris disembunyikan */
  value: (i: IbpItem) => string | null;
}

export const DETAILS: Record<DetailKey, DetailDef> = {
  kuota: { label: "Kuota", value: (i) => gb(i.volumeGb) },
  masa: { label: "Masa aktif", value: (i) => days(i.validityDays) },
  perGbHari: {
    label: "Per GB/hari",
    value: (i) => {
      const c = unitCost(i);
      return c === null ? null : rupiahPrecise(c);
    },
  },
};

/** Harga per GB total (harga / total GB), untuk teks kecil di bawah harga. */
export const pricePerGb = (i: IbpItem): number | null =>
  i.volumeGb && i.volumeGb > 0 ? i.price / i.volumeGb : null;
