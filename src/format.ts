export const rupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const gb = (n: number | null): string => (n === null ? "—" : `${+n.toFixed(2)} GB`);
export const days = (n: number | null): string => (n === null ? "—" : `${n} hari`);

const LABELS: Record<string, string> = {
  "data-package": "Paket Data",
  "data-voucher": "Data Voucher",
  "electric-quota": "Kuota Elektrik",
};
export const catalogueLabel = (c: string): string => LABELS[c] ?? c;
