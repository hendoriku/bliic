import { ShoppingCart } from "lucide-react";
import type { IbpItem } from "../api/ibp.ts";

/** Tombol beli yang dipakai semua tampilan (kartu, daftar, tabel). Menuju halaman pesan Babelii di tab baru. */
export function BuyButton({ item, small = false }: { item: IbpItem; small?: boolean }) {
  const cls = `btn${small ? " sm" : ""}`;
  if (item.available && item.buyUrl) {
    return (
      <a className={cls} href={item.buyUrl} target="_blank" rel="noopener noreferrer">
        <ShoppingCart size={small ? 14 : 16} strokeWidth={2.2} aria-hidden />
        Beli
      </a>
    );
  }
  return <span className={`${cls} disabled`}>{item.available ? "Beli" : "Habis"}</span>;
}
