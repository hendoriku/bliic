import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "./api/client.ts";
import { isFresh, readCache } from "./api/cache.ts";
import { fetchIbp, parseIbp, type IbpItem, type IbpResult } from "./api/ibp.ts";
import { PackageCard } from "./components/PackageCard.tsx";
import { recommend, unitCost, type Need } from "./recommend.ts";
import { Wizard } from "./Wizard.tsx";

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://babelii.diofis.net/public-api/v1",
  retries: 1,
});

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: IbpResult; at: number; refreshing: boolean; notice?: string }
  | { kind: "error"; message: string };
type Tab = "katalog" | "rekomendasi" | "bantu";
type Sort = "termurah" | "hemat" | "kuota";

export function App() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("katalog");

  // Stale-while-revalidate: tampilkan cache dulu, segarkan di latar bila sudah kedaluwarsa (atau dipaksa).
  const reload = (force = false) => {
    const cached = readCache();
    const shown = cached ? parseIbp(cached.json) : null;
    if (cached && shown && shown.items.length > 0) {
      const fresh = isFresh(cached) && !force;
      setLoad({ kind: "ok", data: shown, at: cached.at, refreshing: !fresh });
      if (fresh) return;
    } else {
      setLoad({ kind: "loading" });
    }
    fetchIbp(client)
      .then((data) => setLoad({ kind: "ok", data, at: Date.now(), refreshing: false }))
      .catch((err) =>
        setLoad((cur) =>
          cur.kind === "ok"
            ? { ...cur, refreshing: false, notice: "Gagal menyegarkan, menampilkan data tersimpan." }
            : { kind: "error", message: String(err) },
        ),
      );
  };
  useEffect(() => reload(), []);

  return (
    <div className="app">
      <header className="top">
        <h1>Bli.ic <span>by Babelii</span></h1>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "katalog"} onClick={() => setTab("katalog")}>Katalog</button>
          <button role="tab" aria-selected={tab === "bantu"} onClick={() => setTab("bantu")}>Bantu Pilih</button>
          <button role="tab" aria-selected={tab === "rekomendasi"} onClick={() => setTab("rekomendasi")}>Rekomendasi</button>
        </nav>
      </header>

      <main>
        {load.kind === "loading" && <p className="state">Memuat paket…</p>}
        {load.kind === "error" && (
          <div className="state error" role="alert">
            <p>Gagal memuat data paket.</p>
            <small>{load.message}</small>
            <button onClick={() => reload(true)}>Coba lagi</button>
          </div>
        )}
        {load.kind === "ok" && (
          <>
            {tab === "katalog" && <Catalogue items={load.data.items} />}
            {tab === "bantu" && <Wizard items={load.data.items} />}
            {tab === "rekomendasi" && <Recommend items={load.data.items} />}
            <p className="updated">
              {load.refreshing ? "Menyegarkan data…" : `Data diperbarui ${new Date(load.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
              {load.notice && <> · <span className="warn">{load.notice}</span></>}
              {" "}<button className="link" disabled={load.refreshing} onClick={() => reload(true)}>Segarkan</button>
            </p>
            <details className="debug">
              <summary>Info teknis ({load.data.items.length} paket)</summary>
              <pre>{JSON.stringify(load.data.extra, null, 2)}</pre>
            </details>
          </>
        )}
      </main>
    </div>
  );
}

function uniq(items: IbpItem[], pick: (i: IbpItem) => string): string[] {
  return [...new Set(items.map(pick))].sort();
}

function Catalogue({ items }: { items: IbpItem[] }) {
  const [op, setOp] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("termurah");
  const [onlyAvail, setOnlyAvail] = useState(true);

  const ops = useMemo(() => uniq(items, (i) => i.operator), [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (!op || i.operator === op) &&
        (!onlyAvail || i.available) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle)),
    );
    const inf = Number.POSITIVE_INFINITY;
    if (sort === "termurah") list.sort((a, b) => a.price - b.price);
    if (sort === "hemat") list.sort((a, b) => (unitCost(a) ?? inf) - (unitCost(b) ?? inf) || a.price - b.price);
    if (sort === "kuota") list.sort((a, b) => (b.volumeGb ?? -1) - (a.volumeGb ?? -1));
    return list;
  }, [items, op, q, sort, onlyAvail]);

  return (
    <section>
      <div className="filters">
        <input type="search" placeholder="Cari paket atau kode…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="Operator">
          <option value="">Semua operator</option>
          {ops.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
          <option value="termurah">Termurah</option>
          <option value="hemat">Paling hemat/GB/hari</option>
          <option value="kuota">Kuota terbesar</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Tersedia saja
        </label>
      </div>
      <p className="count">{shown.length} paket</p>
      <ul className="grid">
        {shown.map((i) => <li key={i.code}><PackageCard item={i} /></li>)}
      </ul>
      {shown.length === 0 && <p className="state">Tidak ada paket yang cocok.</p>}
    </section>
  );
}

function Recommend({ items }: { items: IbpItem[] }) {
  const [budget, setBudget] = useState("");
  const [minGb, setMinGb] = useState("");
  const [minDays, setMinDays] = useState("");
  const [op, setOp] = useState("");

  const ops = useMemo(() => uniq(items, (i) => i.operator), [items]);

  const need: Need = {
    budget: budget ? Number(budget) : undefined,
    minGb: minGb ? Number(minGb) : undefined,
    minDays: minDays ? Number(minDays) : undefined,
    operator: op || undefined,
  };
  const results = useMemo(() => recommend(items, need), [items, budget, minGb, minDays, op]);

  return (
    <section>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label>Budget maksimum (Rp)
          <input inputMode="numeric" type="number" min="0" placeholder="mis. 50000" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <label>Kuota minimum (GB)
          <input inputMode="decimal" type="number" min="0" placeholder="mis. 10" value={minGb} onChange={(e) => setMinGb(e.target.value)} />
        </label>
        <label>Masa aktif minimum (hari)
          <input inputMode="numeric" type="number" min="0" placeholder="mis. 30" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
        </label>
        <label>Operator
          <select value={op} onChange={(e) => setOp(e.target.value)}>
            <option value="">Semua</option>
            {ops.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      </form>
      <h2 className="h2">Rekomendasi untuk Anda</h2>
      {results.length === 0 ? (
        <p className="state">Belum ada paket yang cocok. Coba longgarkan budget, kuota, atau masa aktif.</p>
      ) : (
        <ul className="grid">
          {results.map((r) => <li key={r.item.code}><PackageCard item={r.item} note={r.reason} /></li>)}
        </ul>
      )}
    </section>
  );
}
