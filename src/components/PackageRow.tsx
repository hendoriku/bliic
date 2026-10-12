// Tampilan "Daftar": satu baris per paket, padat dan mudah dipindai.
import { rupiahPrecise, rupiah } from "../format.ts";
import { badgesFor } from "../presentation/badges.ts";
import { BadgeChip } from "./BadgeChip.tsx";
import { BuyButton } from "./BuyButton.tsx";
import { DETAILS, pricePerGb, type DetailKey } from "../presentation/details.ts";
import type { Entry } from "../view.ts";
import { cleanTitle } from "../presentation/title.ts";

const ROWS: DetailKey[] = ["kuota", "masa", "perGbHari"];

export function PackageRow({ entry }: { entry: Entry }) {
  const { item, highlight, note } = entry;
  const badges = badgesFor(item);
  const perGb = entry.showPricePerGb ? pricePerGb(item) : null;
  return (
    <div className={`row${item.available ? "" : " off"}${highlight ? ` result ${highlight.tone}` : ""}`}>
      <div className="row-main">
        {highlight && <span className={`tag ${highlight.tone}`}>{highlight.text}</span>}
        <div className="row-top">
          <span className="op">{item.operator}</span>
          <span className="code">{item.code}</span>
        </div>
        <h3>{cleanTitle(item.name)}</h3>
        {badges.length > 0 && (
          <ul className="badges">
            {badges.map((b) => <BadgeChip key={b.key} badge={b} />)}
          </ul>
        )}
        <p className="row-details">
          {ROWS.map((k) => ({ label: DETAILS[k].label, value: DETAILS[k].value(item) }))
            .filter((d) => d.value !== null)
            .map((d) => (
              <span key={d.label}><em>{d.label}</em> {d.value}</span>
            ))}
        </p>
        {note && <p className="reason">{note}</p>}
      </div>
      <div className="row-buy">
        <strong>{rupiah(item.price)}</strong>
        {perGb !== null && <small className="rate">≈ {rupiahPrecise(perGb)}/GB</small>}
        <BuyButton item={item} />
      </div>
    </div>
  );
}
