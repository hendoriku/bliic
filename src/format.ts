export const rupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Seperti rupiah(), tapi nilai kecil (<10) memakai 1 desimal agar "Rp 2,6" tidak dibulatkan jadi "Rp 3". */
export const rupiahPrecise = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);

export const gb = (n: number | null): string => (n === null ? "—" : `${+n.toFixed(2)} GB`);
export const days = (n: number | null): string => (n === null ? "—" : `${n} hari`);

/** Usia data dalam bahasa sehari-hari: "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu". */
export function formatAge(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

/** "12 Nov 2026, 14.11" untuk keterangan (tooltip) waktu pembaruan. */
export const formatDateTime = (at: number): string =>
  new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
