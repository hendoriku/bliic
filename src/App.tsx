import { Calculator, Library, RadioTower, RefreshCw, TriangleAlert, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, ApiError } from "./api/client.ts";
import { isFresh, POLL_MS, readCache, STALE_WARN_MS, writeCache } from "./api/cache.ts";
import { describeDiff, diffCatalogue } from "./api/diff.ts";
import { formatAge, formatDateTime } from "./format.ts";
import { fetchIbpConditional, type IbpItem } from "./api/ibp.ts";
import { ItemsView } from "./components/ItemsView.tsx";
import { ViewToggle } from "./components/ViewToggle.tsx";
import { usePersistentState } from "./hooks.ts";
import { parseTab, tabHash, type Tab } from "./tabs.ts";
import { VIEWS, VIEW_STORAGE_KEY, type View } from "./view.ts";
import { recommend, unitCost, type Need } from "./recommend.ts";
import { Explorer } from "./explorer/Explorer.tsx";
import { OperatorAdvisor } from "./OperatorAdvisor.tsx";
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
  // Detik berjalan agar usia data ("5 menit lalu") ikut diperbarui tanpa perlu interaksi.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [tab, setTabState] = useState<Tab>(() => parseTab(window.location.hash));
  useEffect(() => {
    const onHash = () => setTabState(parseTab(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Operator yang dipilih dari tab Operator ("Lihat semua paket ..."), dipakai sebagai filter awal Katalog.
  const [catalogOperator, setCatalogOperator] = useState("");
  useEffect(() => {
    if (tab !== "katalog") setCatalogOperator("");
  }, [tab]);
  const seeCatalog = (operator: string) => {
    setCatalogOperator(operator);
    setTab("katalog");
  };
  const setTab = (t: Tab) => {
    setTabState(t);
    // replaceState: berpindah tab tidak menambah riwayat (tombol Back tidak berputar antar tab).
    window.history.replaceState(null, "", tabHash(t));
  };
  // Pilihan tampilan dipakai bersama oleh semua tab dan diingat antar kunjungan.
  const [view, setView] = usePersistentState<View>(VIEW_STORAGE_KEY, "tabel", VIEWS);

  const loadRef = useRef(load);
  loadRef.current = load;
  const failures = useRef(0); // gagal berturut-turut: dipakai untuk memperlambat polling agar tidak membebani server

  // Pemberitahuan singkat saat katalog berubah ("27 paket dihapus, 59 harga berubah").
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(id);
  }, [toast]);

  /**
   * Stale-while-revalidate. Tampilkan cache lebih dulu (dibaca asinkron dari IndexedDB), lalu periksa server dengan
   * permintaan bersyarat (ETag): data tidak berubah -> 304 tanpa isi. Mode `silent` (polling) tidak menyentuh
   * indikator "Menyegarkan…" dan tidak pernah menggantikan data yang tampil dengan layar error.
   */
  const reload = async ({ force = false, silent = false }: { force?: boolean; silent?: boolean } = {}) => {
    const cached = await readCache();
    if (!silent) {
      if (cached && cached.items.length > 0) {
        const fresh = isFresh(cached) && !force;
        setLoad({ kind: "ok", items: cached.items, at: cached.at, refreshing: !fresh });
        if (fresh) return;
      } else {
        setLoad({ kind: "loading" });
      }
    } else if (!cached || loadRef.current.kind !== "ok") {
      return;
    }
    try {
      const res = await fetchIbpConditional(client, cached?.etag ?? null);
      const now = Date.now();
      failures.current = 0;
      if (res.status === "not-modified" && cached) {
        void writeCache({ ...cached, at: now });
        // Data identik: pertahankan referensi `items` agar daftar tidak dirender ulang.
        setLoad((cur) => (cur.kind === "ok" ? { ...cur, at: now, refreshing: false, notice: undefined } : cur));
      } else if (res.status === "ok") {
        const shown = loadRef.current;
        if (shown.kind === "ok") {
          const msg = describeDiff(diffCatalogue(shown.items, res.items));
          if (msg) setToast(`Katalog diperbarui: ${msg}`);
        }
        void writeCache({ at: now, etag: res.etag, items: res.items });
        setLoad({ kind: "ok", items: res.items, at: now, refreshing: false });
      }
    } catch (err) {
      failures.current++;
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

  // Hampir realtime: selama tab terlihat, periksa ulang tiap menit. Bila gagal, jedanya melebar (maks. 5x) agar tidak
  // membebani server yang membatasi permintaan.
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(tick, Math.min(POLL_MS * 2 ** failures.current, POLL_MS * 5));
    };
    const tick = async () => {
      const cur = loadRef.current;
      if (document.visibilityState === "visible" && cur.kind === "ok" && !cur.refreshing) await reload({ silent: true });
      schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  // Segera periksa saat koneksi kembali atau tab dibuka lagi bila data sudah lewat masa segarnya atau penyegaran terakhir gagal.
  // Jeda 15 detik antar percobaan.
  const lastAttempt = useRef(0);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const cur = loadRef.current;
      if (cur.kind === "loading" || (cur.kind === "ok" && cur.refreshing)) return;
      const needs = cur.kind === "error" || (cur.kind === "ok" && (!!cur.notice || !isFresh({ at: cur.at })));
      if (!needs || Date.now() - lastAttempt.current < 15_000) return;
      lastAttempt.current = Date.now();
      void reload({ silent: cur.kind === "ok" });
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
          <button role="tab" aria-selected={tab === "operator"} onClick={() => setTab("operator")}><RadioTower size={16} aria-hidden />Operator</button>
        </nav>
      </header>

      <main>
        {load.kind === "loading" && <p className="state">Memuat paket…</p>}
        {load.kind === "error" && (
          <div className="state error" role="alert">
            <p>Gagal memuat data paket.</p>
            <small>{load.message}</small>
            <button className="tbtn" onClick={() => void reload({ force: true })}><RefreshCw size={15} aria-hidden />Coba lagi</button>
          </div>
        )}
        {load.kind === "ok" && (
          <>
            {!load.refreshing && now - load.at > STALE_WARN_MS && (
              <div className="stale" role="status">
                <TriangleAlert size={18} aria-hidden />
                <p>
                  Data terakhir diperbarui <strong>{formatAge(now - load.at)}</strong> dan belum bisa disegarkan. Harga dan ketersediaan paket bisa sudah berbeda.
                </p>
                <button className="tbtn sm" onClick={() => void reload({ force: true })}>
                  <RefreshCw size={13} aria-hidden />
                  Segarkan sekarang
                </button>
              </div>
            )}
            {tab === "katalog" && <Explorer items={load.items} view={view} onViewChange={setView} initialOperator={catalogOperator} />}
            {tab === "rekomendasi" && <Recommend items={load.items} view={view} onViewChange={setView} />}
            {tab === "bantu" && <Wizard items={load.items} view={view} onViewChange={setView} />}
            {tab === "operator" && <OperatorAdvisor items={load.items} onSeeCatalog={seeCatalog} />}
            <p className="updated" title={`Terakhir diperbarui ${formatDateTime(load.at)}`}>
              {load.refreshing ? "Menyegarkan data…" : `Data diperbarui ${formatAge(now - load.at)}`}
              {load.notice && <> · <span className="warn">{load.notice}</span></>}
              {" "}
              <button className="tbtn sm" disabled={load.refreshing} onClick={() => void reload({ force: true })}>
                <RefreshCw size={13} className={load.refreshing ? "spin" : undefined} aria-hidden />
                Segarkan
              </button>
            </p>
          </>
        )}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <RefreshCw size={14} aria-hidden />
          <span>{toast}</span>
          <button className="tbtn sm" onClick={() => setToast(null)} aria-label="Tutup pemberitahuan">Tutup</button>
        </div>
      )}

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
