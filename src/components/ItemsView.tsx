// Menampilkan daftar paket dalam mode Kartu / Daftar / Tabel, dipakai oleh semua tab.
//
// Seperti file explorer:
//  - Virtualisasi (@tanstack/react-virtual): hanya baris yang terlihat yang dirender, jadi ribuan
//    paket tetap ringan. Scroll memakai scroll halaman biasa.
//  - Navigasi keyboard dengan "roving tabindex": satu item bisa difokus (Tab), lalu panah
//    ↑ ↓ ← →, Home, End, PageUp, PageDown berpindah item, Enter membuka halaman beli.
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Sort } from "../explorer/sort.ts";
import type { Entry, View } from "../view.ts";
import { PackageCard } from "./PackageCard.tsx";
import { PackageRow } from "./PackageRow.tsx";
import { PackageTableCells, PackageTableHead, TABLE_COLS } from "./PackageTable.tsx";

interface Props {
  entries: Entry[];
  view: View;
  /** Jika diberikan, header kolom pada Tabel bisa diklik untuk mengurutkan. Hasil berperingkat (rekomendasi) tidak memakainya. */
  sort?: Sort;
  onSort?: (s: Sort) => void;
}

// Perkiraan tinggi baris (px) sebelum diukur; diambil dari pengukuran nyata agar total tinggi
// daftar tidak melompat saat baris-baris selesai diukur. [layar lebar, layar sempit (<=640px)]
const ESTIMATE: Record<View, [number, number]> = { kartu: [214, 190], daftar: [105, 165], tabel: [61, 144] };
const estimate = (v: View) => ESTIMATE[v][window.innerWidth <= 640 ? 1 : 0];
const MIN_CARD = 260;
const GAP = 12;
const PAGE_JUMP = 8;

/** Jumlah kolom kartu menurut lebar wadah (1 untuk mode lain). */
function useColumns(el: HTMLElement | null, view: View): number {
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    if (view !== "kartu" || !el) return setCols(1);
    const measure = () => setCols(Math.max(1, Math.floor((el.clientWidth + GAP) / (MIN_CARD + GAP))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, view]);
  return cols;
}

export function ItemsView({ entries, view, sort, onSort }: Props) {
  const [box, setBox] = useState<HTMLElement | null>(null); // elemen yang memuat baris virtual
  const [active, setActive] = useState(0);
  const [margin, setMargin] = useState(0);
  const cols = useColumns(box, view);
  const n = entries.length;
  const rowCount = Math.ceil(n / cols);

  const virt = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimate(view),
    overscan: 6,
    scrollMargin: margin,
  });

  // Posisi atas wadah terhadap dokumen (dibutuhkan virtualizer berbasis window).
  useLayoutEffect(() => {
    if (!box) return;
    const measure = () => setMargin(Math.round(box.getBoundingClientRect().top + window.scrollY));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [box, view, n]);

  // Ukuran baris berbeda antar mode/jumlah kolom: buang cache ukuran.
  useEffect(() => virt.measure(), [view, cols, virt]);

  // Daftar baru (filter/urutan berubah) -> kembali ke item pertama.
  const firstKey = entries[0]?.item.code;
  useEffect(() => setActive(0), [firstKey, n, view]);

  const focusItem = useCallback(
    (index: number, tries = 12) => {
      const el = box?.querySelector<HTMLElement>(`[data-item="${index}"]`);
      if (el) el.focus({ preventScroll: true });
      else if (tries > 0) requestAnimationFrame(() => focusItem(index, tries - 1));
    },
    [box],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.dataset.item === undefined) return; // fokus di tombol/tautan di dalam item: biarkan perilaku bawaan
    const step = view === "kartu" ? cols : 1;
    let next = active;
    switch (e.key) {
      case "ArrowDown": next = active + step; break;
      case "ArrowUp": next = active - step; break;
      case "ArrowRight": if (view === "kartu") next = active + 1; else return; break;
      case "ArrowLeft": if (view === "kartu") next = active - 1; else return; break;
      case "PageDown": next = active + step * PAGE_JUMP; break;
      case "PageUp": next = active - step * PAGE_JUMP; break;
      case "Home": next = 0; break;
      case "End": next = n - 1; break;
      case "Enter": {
        const url = entries[active]?.item.buyUrl;
        if (url && entries[active].item.available) window.open(url, "_blank", "noopener,noreferrer");
        e.preventDefault();
        return;
      }
      default: return;
    }
    e.preventDefault();
    next = Math.min(Math.max(next, 0), n - 1);
    setActive(next);
    virt.scrollToIndex(Math.floor(next / cols), { align: "auto" });
    focusItem(next);
  };

  const rows = virt.getVirtualItems();
  const offset = (start: number) => start - margin;
  const common = { "aria-label": "Daftar paket" } as const;

  if (n === 0) return null;

  // ---- Tabel: <table> asli dengan baris pengisi (spacer) di atas/bawah ----
  if (view === "tabel") {
    const padTop = rows.length ? offset(rows[0].start) : 0;
    const padBottom = rows.length ? virt.getTotalSize() - offset(rows[rows.length - 1].end) : 0;
    return (
      <div className="table-wrap">
        <table className="ptable" {...common}>
          <PackageTableHead sort={sort} onSort={onSort} />
          <tbody ref={setBox} onKeyDown={onKeyDown}>
            {padTop > 0 && <tr aria-hidden className="spacer" style={{ height: padTop }}><td colSpan={TABLE_COLS} /></tr>}
            {rows.map((v) => (
              <tr
                key={entries[v.index].item.code}
                data-index={v.index}
                data-item={v.index}
                ref={virt.measureElement}
                tabIndex={v.index === active ? 0 : -1}
                className={`${entries[v.index].item.available ? "" : "off "}${v.index === active ? "active" : ""}`}
              >
                <PackageTableCells entry={entries[v.index]} />
              </tr>
            ))}
            {padBottom > 0 && <tr aria-hidden className="spacer" style={{ height: padBottom }}><td colSpan={TABLE_COLS} /></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  // ---- Daftar & Kartu: baris diposisikan absolut ----
  return (
    <ul ref={setBox} className="vbox" style={{ height: virt.getTotalSize() }} onKeyDown={onKeyDown} {...common}>
      {rows.map((v) => {
        const first = v.index * cols;
        const slice = entries.slice(first, first + cols);
        return (
          <li
            key={slice[0].item.code}
            data-index={v.index}
            ref={virt.measureElement}
            className="vrow"
            style={{ transform: `translateY(${offset(v.start)}px)` }}
          >
            {view === "daftar" ? (
              <div data-item={first} tabIndex={first === active ? 0 : -1} className={first === active ? "item active" : "item"}>
                <PackageRow entry={slice[0]} />
              </div>
            ) : (
              <div className="vgrid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {slice.map((e, j) => (
                  <div
                    key={e.item.code}
                    data-item={first + j}
                    tabIndex={first + j === active ? 0 : -1}
                    className={first + j === active ? "item active" : "item"}
                  >
                    <PackageCard item={e.item} rows={e.rows} highlight={e.highlight} note={e.note} showPricePerGb={e.showPricePerGb} />
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
