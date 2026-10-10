export const rupiah = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Seperti rupiah(), tapi nilai kecil (<10) memakai 1 desimal agar "Rp 2,6" tidak dibulatkan jadi "Rp 3". */
export const rupiahPrecise = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);

export const gb = (n: number | null): string => (n === null ? "—" : `${+n.toFixed(2)} GB`);
export const days = (n: number | null): string => (n === null ? "—" : `${n} hari`);
