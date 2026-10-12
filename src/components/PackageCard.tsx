// Satu-satunya komponen kartu paket: dipakai oleh Katalog, Rekomendasi, dan Bantu Pilih.
// Variasi tampilan dikendalikan lewat props, bukan dengan menyalin komponen.
import type { IbpItem } from "../api/ibp.ts";
import { rupiah, rupiahPrecise } from "../format.ts";
import { badgesFor } from "../presentation/badges.ts";
import { BadgeChip } from "./BadgeChip.tsx";
import { BuyButton } from "./BuyButton.tsx";
import { DETAILS, pricePerGb, type DetailKey } from "../presentation/details.ts";
import { cleanTitle } from "../presentation/title.ts";

export interface PackageCardProps {
  item: IbpItem;
  /** Baris detail yang ditampilkan, berurutan. */
  rows?: DetailKey[];
  /** Pita sorotan di atas kartu (mis. "Paling Hemat Tunai"). */
  highlight?: { text: string; tone: "main" | "alt" | "unl" };
  /** Catatan kecil di bawah detail. */
  note?: string;
  /** Tampilkan "≈ Rp X/GB" di bawah harga. */
  showPricePerGb?: boolean;
}

const DEFAULT_ROWS: DetailKey[] = ["kuota", "masa", "perGbHari"];

export function PackageCard({ item, rows = DEFAULT_ROWS, highlight, note, showPricePerGb = false }: PackageCardProps) {
  const badges = badgesFor(item);
  const perGb = showPricePerGb ? pricePerGb(item) : null;
  const details = rows
    .map((k) => ({ k, label: DETAILS[k].label, value: DETAILS[k].value(item) }))
    .filter((d) => d.value !== null);

  return (
    <article className={`card${item.available ? "" : " off"}${highlight ? ` result ${highlight.tone}` : ""}`}>
      {highlight && <span className={`tag ${highlight.tone}`}>{highlight.text}</span>}
      <div className="meta">
        <span className="op">{item.operator}</span>
      </div>
      <h3>{cleanTitle(item.name)}</h3>
      {badges.length > 0 && (
        <ul className="badges" aria-label="Lencana">
          {badges.map((b) => <BadgeChip key={b.key} badge={b} />)}
        </ul>
      )}
      {details.length > 0 && (
        <dl>
          {details.map((d) => (
            <div key={d.k}><dt>{d.label}</dt><dd>{d.value}</dd></div>
          ))}
        </dl>
      )}
      {note && <p className="reason">{note}</p>}
      <div className="buy">
        <div>
          <strong>{rupiah(item.price)}</strong>
          {perGb !== null && <small className="rate">≈ {rupiahPrecise(perGb)}/GB</small>}
        </div>
        <BuyButton item={item} />
      </div>
    </article>
  );
}
