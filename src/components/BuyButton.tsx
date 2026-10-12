import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { ShoppingCart } from "lucide-react";
import type { MouseEvent } from "react";
import type { IbpItem } from "../api/ibp.ts";

/**
 * Tombol beli yang dipakai semua tampilan (kartu, daftar, tabel).
 * - Web: tautan biasa ke halaman pesan Babelii di tab baru.
 * - Aplikasi Android (Capacitor): dibuka di dalam aplikasi lewat Chrome Custom Tabs, bukan memindahkan ke Chrome.
 */
export function BuyButton({ item, small = false }: { item: IbpItem; small?: boolean }) {
  const cls = `btn${small ? " sm" : ""}`;
  if (item.available && item.buyUrl) {
    const url = item.buyUrl;
    const onClick = (e: MouseEvent) => {
      if (!Capacitor.isNativePlatform()) return;
      e.preventDefault();
      void Browser.open({ url });
    };
    return (
      <a className={cls} href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <ShoppingCart size={small ? 14 : 16} strokeWidth={2.2} aria-hidden />
        Beli
      </a>
    );
  }
  return <span className={`${cls} disabled`}>{item.available ? "Beli" : "Habis"}</span>;
}
