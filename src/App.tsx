import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "./api/client.ts";
import { fetchIbp, type IbpItem, type IbpResult } from "./api/ibp.ts";
import { catalogueLabel, days, gb, rupiah } from "./format.ts";
import { recommend, unitCost, type Need } from "./recommend.ts";

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://babelii.diofis.net/public-api/v1",
  retries: 1,
});

type Load = { kind: "loading" } | { kind: "ok"; data: IbpResult } | { kind: "error"; message: string };
type Tab = "katalog" | "rekomendasi";
type Sort = "termurah" | "hemat" | "kuota";

export function App() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("katalog");

  const reload = () => {
    setLoad({ kind: "loading" });
    fetchIbp(client)
      .then((data) => setLoad({ kind: "ok", data }))
      .catch((err) => setLoad({ kind: "error", message: String(err) }));
  };
  useEffect(reload, []);

  return (
    <div className="app">
      <header className="top">
        <h1>Bli.ic <span>by Babelii</span></h1>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "katalog"} onClick={() => setTab("katalog")}>Katalog</button>
          <button role="tab" aria-selected={tab === "rekomendasi"} onClick={() => setTab("rekomendasi")}>Rekomendasi</button>
        </nav>
      </header>

      <main>
        {load.kind === "loading" && <p className="state">Memuat paket…</p>}
        {load.kind === "error" && (
          <div className="state error" role="alert">
            <p>Gagal memuat data paket.</p>
            <small>{load.message}</small>
            <button onClick={reload}>Coba lagi</button>
          </div>
        )}
        {load.kind === "ok" && (
          <>
            {tab === "katalog" ? <Catalogue items={load.data.items} /> : <Recommend items={load.data.items} />}
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
  const [cat, setCat] = useState("");
  const [op, setOp] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("termurah");
  const [onlyAvail, setOnlyAvail] = useState(true);

  const cats = useMemo(() => uniq(items, (i) => i.catalogue), [items]);
  const ops = useMemo(() => uniq(items, (i) => i.operator), [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (!cat || i.catalogue === cat) &&
        (!op || i.operator === op) &&
        (!onlyAvail || i.available) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle)),
    );
    const inf = Number.POSITIVE_INFINITY;
    if (sort === "termurah") list.sort((a, b) => a.price - b.price);
    if (sort === "hemat") list.sort((a, b) => (unitCost(a) ?? inf) - (unitCost(b) ?? inf) || a.price - b.price);
    if (sort === "kuota") list.sort((a, b) => (b.volumeGb ?? -1) - (a.volumeGb ?? -1));
    return list;
  }, [items, cat, op, q, sort, onlyAvail]);

  return (
    <section>
      <div className="chips" role="group" aria-label="Jenis paket">
        <button aria-pressed={cat === ""} onClick={() => setCat("")}>Semua</button>
        {cats.map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{catalogueLabel(c)}</button>
        ))}
      </div>
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
        {shown.map((i) => <li key={i.code}><Card item={i} /></li>)}
      </ul>
      {shown.length === 0 && <p className="state">Tidak ada paket yang cocok.</p>}
    </section>
  );
}

function Card({ item: i, reason }: { item: IbpItem; reason?: string }) {
  const rate = unitCost(i);
  return (
    <article className={`card${i.available ? "" : " off"}`}>
      <div className="meta">
        <span className="op">{i.operator}</span>
        <span className="cat">{catalogueLabel(i.catalogue)}</span>
      </div>
      <h3>{i.name}</h3>
      <div className="badges">
        {i.isSmartPick && <span className="b smart">Smart Pick</span>}
        {i.isWorthIt && <span className="b worth">Worth It</span>}
        {i.badges.map((b) => <span key={b} className="b">{b}</span>)}
      </div>
      <dl>
        <div><dt>Kuota</dt><dd>{gb(i.volumeGb)}</dd></div>
        <div><dt>Masa aktif</dt><dd>{days(i.validityDays)}</dd></div>
        {rate !== null && <div><dt>Per GB/hari</dt><dd>{rupiah(rate)}</dd></div>}
      </dl>
      {reason && <p className="reason">{reason}</p>}
      <div className="buy">
        <strong>{rupiah(i.price)}</strong>
        {i.available && i.buyUrl ? (
          <a className="btn" href={i.buyUrl} target="_blank" rel="noopener noreferrer">Beli</a>
        ) : (
          <span className="btn disabled">{i.available ? "Beli" : "Tidak tersedia"}</span>
        )}
      </div>
    </article>
  );
}

function Recommend({ items }: { items: IbpItem[] }) {
  const [budget, setBudget] = useState("");
  const [minGb, setMinGb] = useState("");
  const [minDays, setMinDays] = useState("");
  const [cat, setCat] = useState("");
  const [op, setOp] = useState("");

  const cats = useMemo(() => uniq(items, (i) => i.catalogue), [items]);
  const ops = useMemo(() => uniq(items, (i) => i.operator), [items]);

  const need: Need = {
    budget: budget ? Number(budget) : undefined,
    minGb: minGb ? Number(minGb) : undefined,
    minDays: minDays ? Number(minDays) : undefined,
    catalogue: cat || undefined,
    operator: op || undefined,
  };
  const results = useMemo(() => recommend(items, need), [items, budget, minGb, minDays, cat, op]);

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
        <label>Jenis paket
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Semua</option>
            {cats.map((c) => <option key={c} value={c}>{catalogueLabel(c)}</option>)}
          </select>
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
          {results.map((r) => <li key={r.item.code}><Card item={r.item} reason={r.reason} /></li>)}
        </ul>
      )}
    </section>
  );
}
