import { Calculator, Library, RefreshCw, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, ApiError } from "./api/client.ts";
import { isFresh, readCache, writeCache } from "./api/cache.ts";
import { fetchIbpConditional, type IbpItem } from "./api/ibp.ts";
import { ItemsView } from "./components/ItemsView.tsx";
import { ViewToggle } from "./components/ViewToggle.tsx";
import { usePersistentState } from "./hooks.ts";
import { parseTab, tabHash, type Tab } from "./tabs.ts";
import { VIEWS, VIEW_STORAGE_KEY, type View } from "./view.ts";
import { recommend, unitCost, type Need } from "./recommend.ts";
import { Explorer } from "./explorer/Explorer.tsx";
import { Wizard } from "./Wizard.tsx";

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://babelii.diofis.net/public-api/v1",
  // Respons katalog besar dan kadang lambat (server bisa "bangun" 3-10 detik), jadi waktu tunggu dan percobaan ulang dilonggarkan.
  timeoutMs: 20_000,
  retries: 2,
});

/** Alasan kegagalan dalam bahasa yang bisa dipahami pengguna. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "rate-limit":
        return "Server sedang membatasi permintaan, coba lagi sebentar lagi";
      case "timeout":
        return "Server lambat merespons";
      case "network":
        return navigator.onLine === false ? "Tidak ada koneksi internet" : "Tidak bisa menjangkau server";
      case "server":
        return `Server sedang bermasalah (HTTP ${err.status ?? "5xx"})`;
      default:
        return `Respons tidak terduga${err.status ? ` (HTTP ${err.status})` : ""}`;
    }
  }
  return "Terjadi kesalahan tak terduga";
}

type Load =
  | { kind: "loading" }
  | { kind: "ok"; items: IbpItem[]; at: number; refreshing: boolean; notice?: string }
  | { kind: "error"; message: string };

export function App() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // Tab mengikuti hash URL (#katalog, #rekomendasi, #bantu) sehingga bisa dibagikan sebagai tautan langsung.
  const [tab, setTabState] = useState<Tab>(() => parseTab(window.location.hash));
  useEffect(() => {
    const onHash = () => setTabState(parseTab(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    // replaceState: berpindah tab tidak menambah riwayat (tombol Back tidak berputar antar tab).
    window.history.replaceState(null, "", tabHash(t));
  };
  // Pilihan tampilan dipakai bersama oleh semua tab dan diingat antar kunjungan.
  const [view, setView] = usePersistentState<View>(VIEW_STORAGE_KEY, "tabel", VIEWS);

  // Stale-while-revalidate: tampilkan cache dulu (dibaca asinkron dari IndexedDB, tanpa memblokir render),
  // lalu segarkan di latar dengan permintaan bersyarat (ETag): bila data tidak berubah server menjawab 304 tanpa isi.
  const reload = async (force = false) => {
    const cached = await readCache();
    if (cached && cached.items.length > 0) {
      const fresh = isFresh(cached) && !force;
      setLoad({ kind: "ok", items: cached.items, at: cached.at, refreshing: !fresh });
      if (fresh) return;
    } else {
      setLoad({ kind: "loading" });
    }
    try {
      const res = await fetchIbpConditional(client, cached?.etag ?? null);
      const now = Date.now();
      if (res.status === "not-modified" && cached) {
        void writeCache({ ...cached, at: now });
        // Data identik: pertahankan referensi `items` agar tidak ada render ulang daftar.
        setLoad((cur) => (cur.kind === "ok" ? { ...cur, at: now, refreshing: false, notice: undefined } : cur));
      } else if (res.status === "ok") {
        void writeCache({ at: now, etag: res.etag, items: res.items });
        setLoad({ kind: "ok", items: res.items, at: now, refreshing: false });
      }
    } catch (err) {
      setLoad((cur) =>
        cur.kind === "ok"
          ? { ...cur, refreshing: false, notice: `Gagal menyegarkan: ${describeError(err)}. Menampilkan data tersimpan.` }
          : { kind: "error", message: describeError(err) },
      );
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  // Penyegaran otomatis saat koneksi kembali atau tab dibuka lagi, hanya bila data basi atau penyegaran terakhir gagal.
  // Jeda minimal 30 detik antar percobaan agar tidak membebani server yang membatasi permintaan.
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastAttempt = useRef(Date.now());
  useEffect(() => {
    const refreshIfNeeded = () => {
      const cur = loadRef.current;
      if (cur.kind === "loading" || (cur.kind === "ok" && cur.refreshing)) return;
      const needs = cur.kind === "error" || (cur.kind === "ok" && (!!cur.notice || !isFresh({ at: cur.at })));
      if (!needs || Date.now() - lastAttempt.current < 30_000) return;
      lastAttempt.current = Date.now();
      void reload();
    };
    const onVisible = () => document.visibilityState === "visible" && refreshIfNeeded();
    window.addEventListener("online", refreshIfNeeded);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", refreshIfNeeded);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="app">
      <header className="top">
        <h1>
          <img className="logo" src={`${import.meta.env.BASE_URL}favicon.png`} alt="" width={28} height={28} />
          Bli.ic <span>by Babelii</span>
        </h1>
        <p className="subtitle">Internet Package Calculator</p>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "katalog"} onClick={() => setTab("katalog")}><Library size={16} aria-hidden />Katalog</button>
          <button role="tab" aria-selected={tab === "rekomendasi"} onClick={() => setTab("rekomendasi")}><Calculator size={16} aria-hidden />Rekomendasi</button>
          <button role="tab" aria-selected={tab === "bantu"} onClick={() => setTab("bantu")}><WandSparkles size={16} aria-hidden />Bantu Pilih</button>
        </nav>
      </header>

      <main>
        {load.kind === "loading" && <p className="state">Memuat paket…</p>}
        {load.kind === "error" && (
          <div className="state error" role="alert">
            <p>Gagal memuat data paket.</p>
            <small>{load.message}</small>
            <button className="tbtn" onClick={() => void reload(true)}><RefreshCw size={15} aria-hidden />Coba lagi</button>
          </div>
        )}
        {load.kind === "ok" && (
          <>
            {tab === "katalog" && <Explorer items={load.items} view={view} onViewChange={setView} />}
            {tab === "rekomendasi" && <Recommend items={load.items} view={view} onViewChange={setView} />}
            {tab === "bantu" && <Wizard items={load.items} view={view} onViewChange={setView} />}
            <p className="updated">
              {load.refreshing ? "Menyegarkan data…" : `Data diperbarui ${new Date(load.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
              {load.notice && <> · <span className="warn">{load.notice}</span></>}
              {" "}
              <button className="tbtn sm" disabled={load.refreshing} onClick={() => void reload(true)}>
                <RefreshCw size={13} className={load.refreshing ? "spin" : undefined} aria-hidden />
                Segarkan
              </button>
            </p>
          </>
        )}
      </main>

      {/* Mengikuti footer website Babelii: satu baris kecil, rata tengah, warna redup. */}
      <footer className="foot">
        <p>&copy; {new Date().getFullYear()} Babelii - Kiosk &amp; PPOB. All rights reserved.</p>
      </footer>
    </div>
  );
}

function uniq(items: IbpItem[], pick: (i: IbpItem) => string): string[] {
  return [...new Set(items.map(pick))].sort();
}

function Recommend({ items, view, onViewChange }: { items: IbpItem[]; view: View; onViewChange: (v: View) => void }) {
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
      <div className="bar">
        <h2 className="h2">Rekomendasi untuk Anda</h2>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      {results.length === 0 ? (
        <p className="state">Belum ada paket yang cocok. Coba longgarkan budget, kuota, atau masa aktif.</p>
      ) : (
        <ItemsView entries={results.map((r) => ({ item: r.item, note: r.reason, showType: true }))} view={view} />
      )}
    </section>
  );
}
