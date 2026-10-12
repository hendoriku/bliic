// Potongan tabel: header (bisa diklik untuk mengurutkan) dan satu baris data.
// Penyusunan <table> dan virtualisasinya ada di ItemsView.
import { memo } from "react";
import { rupiah } from "../format.ts";
import { badgesFor } from "../presentation/badges.ts";
import { BadgeChip } from "./BadgeChip.tsx";
import { BuyButton } from "./BuyButton.tsx";
import { DETAILS } from "../presentation/details.ts";
import { cleanTitle } from "../presentation/title.ts";
import { defaultDir, type Sort, type SortKey } from "../explorer/sort.ts";
import type { Entry } from "../view.ts";

/** Definisi kolom: ubah urutan/label/kolom di sini. */
const COLUMNS: { id: string; label: string; sort?: SortKey; right?: boolean }[] = [
  { id: "operator", label: "Operator", sort: "operator" },
  { id: "name", label: "Paket", sort: "name" },
  { id: "kuota", label: "Kuota", sort: "volume", right: true },
  { id: "masa", label: "Masa aktif", sort: "validity", right: true },
  { id: "perGbHari", label: "Per GB/hari", sort: "unit", right: true },
  { id: "price", label: "Harga", sort: "price", right: true },
  { id: "buy", label: "" },
];
export const TABLE_COLS = COLUMNS.length;

export function PackageTableHead({ sort, onSort }: { sort?: Sort; onSort?: (s: Sort) => void }) {
  const toggle = (key: SortKey) =>
    sort && onSort && onSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) });
  return (
    <thead>
      <tr>
        {COLUMNS.map((c) => (
          <th
            key={c.id}
            scope="col"
            className={c.right ? "r" : undefined}
            aria-sort={c.sort && sort && sort.key === c.sort ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
          >
            {c.sort && sort && onSort ? (
              <button className="th-btn" onClick={() => toggle(c.sort!)}>
                {c.label}
                <span aria-hidden>{sort.key === c.sort ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
              </button>
            ) : (
              c.label
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Isi sel-sel satu baris (elemen <tr>-nya disediakan ItemsView agar bisa diukur dan difokuskan).
 * Kelas "c-*" dan atribut data-label dipakai CSS untuk menata ulang baris menjadi blok bertumpuk di layar HP.
 */
function PackageTableCells({ entry: { item: i, highlight, note } }: { entry: Entry }) {
  return (
    <>
      <td className="op c-op">{i.operator}</td>
      <td className="c-name">
        {highlight && <span className={`tag ${highlight.tone}`}>{highlight.text}</span>}
        <div className="t-name">{cleanTitle(i.name)}</div>
        <div className="t-sub">
          <span className="code">{i.code}</span>
          {badgesFor(i).map((b) => <BadgeChip key={b.key} badge={b} as="span" />)}
        </div>
        {note && <div className="t-note">{note}</div>}
      </td>
      <td className="r c-kuota" data-label="Kuota">{DETAILS.kuota.value(i)}</td>
      <td className="r c-masa" data-label="Masa aktif">{DETAILS.masa.value(i)}</td>
      <td className="r c-rate" data-label="Per GB/hari">{DETAILS.perGbHari.value(i) ?? "—"}</td>
      <td className="r c-price"><strong>{rupiah(i.price)}</strong></td>
      <td className="r c-buy"><BuyButton item={i} small /></td>
    </>
  );
}

/**
 * Satu baris tabel. Dibungkus memo: saat scroll hanya baris baru yang dirender, baris lain dilewati
 * (props stabil: entry tidak berubah, `active` hanya berubah pada dua baris saat navigasi keyboard).
 */
export const PackageTableRow = memo(function PackageTableRow({
  entry,
  index,
  active,
  measure,
}: {
  entry: Entry;
  index: number;
  active: boolean;
  measure: (el: Element | null) => void;
}) {
  return (
    <tr data-index={index} data-item={index} ref={measure} tabIndex={active ? 0 : -1} className={entry.item.available ? undefined : "off"}>
      <PackageTableCells entry={entry} />
    </tr>
  );
});
