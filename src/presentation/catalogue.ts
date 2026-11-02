// Jenis produk menurut `catalogue` dari API. Ubah label/ikon/warna di sini.
export type CatalogueIcon = "package" | "ticket" | "zap";

interface CatalogueDef {
  label: string;
  icon: CatalogueIcon;
}

const CATALOGUES: Record<string, CatalogueDef> = {
  "data-package": { label: "Paket Data", icon: "package" },
  "data-voucher": { label: "Data Voucher", icon: "ticket" },
  "electric-quota": { label: "Kuota Elektrik", icon: "zap" },
};

const humanize = (key: string): string =>
  key.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export interface CatalogueInfo {
  key: string;
  label: string;
  icon: CatalogueIcon | null;
}

/** Jenis tak dikenal tetap ditampilkan dengan label yang dirapikan, tanpa ikon. */
export function catalogueInfo(key: string): CatalogueInfo {
  const d = CATALOGUES[key];
  return { key, label: d?.label ?? humanize(key), icon: d?.icon ?? null };
}
