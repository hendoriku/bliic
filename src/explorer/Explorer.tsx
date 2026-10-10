import { useDeferredValue, useMemo, useState } from "react";
import type { IbpItem } from "../api/ibp.ts";
import { ItemsView } from "../components/ItemsView.tsx";
import { ViewToggle } from "../components/ViewToggle.tsx";
import type { View } from "../view.ts";
import { PRESETS, presetIdOf, sortItems, type Sort } from "./sort.ts";

export function Explorer({ items, view, onViewChange }: { items: IbpItem[]; view: View; onViewChange: (v: View) => void }) {
  const [op, setOp] = useState("");
  const [q, setQ] = useState("");
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [sort, setSort] = useState<Sort>(PRESETS[0].sort);

  const ops = useMemo(() => [...new Set(items.map((i) => i.operator))].sort(), [items]);

  const deferredQ = useDeferredValue(q); // mengetik tetap mulus walau daftar besar
  const shown = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return sortItems(
      items.filter(
        (i) =>
          (!op || i.operator === op) &&
          (!onlyAvail || i.available) &&
          (!needle || i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle)),
      ),
      sort,
    );
  }, [items, op, deferredQ, onlyAvail, sort]);

  const presetId = presetIdOf(sort);

  return (
    <section>
      <div className="filters">
        <input type="search" placeholder="Cari paket atau kode…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="Operator">
          <option value="">Semua operator</option>
          {ops.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select
          value={presetId}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value);
            if (p) setSort(p.sort);
          }}
          aria-label="Urutkan"
        >
          {presetId === "kustom" && <option value="kustom" disabled>Urutan kustom (tabel)</option>}
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Tersedia saja
        </label>
      </div>

      <div className="bar">
        <p className="count">{shown.length} paket</p>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>

      <ItemsView entries={shown.map((item) => ({ item }))} view={view} sort={sort} onSort={setSort} />

      {shown.length === 0 && <p className="state">Tidak ada paket yang cocok.</p>}
    </section>
  );
}
