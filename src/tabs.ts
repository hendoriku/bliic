// Tautan langsung ke tab lewat bagian "#" pada URL, mis. https://bliic.diofis.net/#katalog
// Hash dipilih (bukan path) karena situs statis di GitHub Pages tidak punya routing sisi server,
// dan hash tidak memuat ulang halaman, juga aman di aplikasi Android (Capacitor).
export const TABS = ["katalog", "rekomendasi", "bantu"] as const;
export type Tab = (typeof TABS)[number];
export const DEFAULT_TAB: Tab = "bantu";

/** "#katalog", "#/katalog", "katalog" -> "katalog". Nilai tak dikenal -> tab bawaan. */
export function parseTab(hash: string): Tab {
  const key = hash.replace(/^#\/?/, "").trim().toLowerCase();
  return (TABS as readonly string[]).includes(key) ? (key as Tab) : DEFAULT_TAB;
}

export const tabHash = (tab: Tab): string => `#${tab}`;
