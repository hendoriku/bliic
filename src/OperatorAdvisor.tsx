import { ArrowRight, BadgeCheck, HardDrive, Info, Layers, Trophy, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { IbpItem } from "./api/ibp.ts";
import { BuyButton } from "./components/BuyButton.tsx";
import { TypeChip } from "./components/TypeChip.tsx";
import { rupiah } from "./format.ts";
import { DETAILS } from "./presentation/details.ts";
import { niceOperator } from "./presentation/operator.ts";
import { cleanTitle } from "./presentation/title.ts";
import {
  recommendOperators,
  type Horizon,
  type OperatorResult,
  type OpBudget,
  type OpPriority,
  type Profile,
  type Recommendation,
  type Strength,
} from "./operator/engine.ts";
import type { Usage } from "./wizard/engine.ts";

interface Opt<T extends string> { value: T; label: string; hint?: string }

const USAGE: Opt<Usage>[] = [
  { value: "ringan", label: "Ringan", hint: "chat, sosmed, < 2 GB/hari" },
  { value: "sedang", label: "Sedang", hint: "video, 2-5 GB/hari" },
  { value: "berat", label: "Berat", hint: "streaming, game, > 5 GB/hari" },
  { value: "tidak_yakin", label: "Tidak yakin" },
];
const HORIZON: Opt<Horizon>[] = [
  { value: "harian", label: "Harian", hint: "1-3 hari" },
  { value: "mingguan", label: "Mingguan", hint: "4-15 hari" },
  { value: "bulanan", label: "Bulanan", hint: "16-45 hari" },
  { value: "panjang", label: "Jangka panjang", hint: "> 45 hari" },
  { value: "tidak_yakin", label: "Tidak yakin" },
];
const BUDGET: Opt<OpBudget>[] = [
  { value: "lt15", label: "Sampai Rp 15 rb" },
  { value: "15-50", label: "Sampai Rp 50 rb" },
  { value: "50-150", label: "Sampai Rp 150 rb" },
  { value: "gt150", label: "Tanpa batas" },
];
const PRIORITY: Opt<OpPriority>[] = [
  { value: "hemat", label: "Paling hemat", hint: "harga per GB terendah" },
  { value: "variasi", label: "Banyak pilihan", hint: "paket paling beragam" },
  { value: "besar", label: "Kuota besar", hint: "ada paket jumbo" },
  { value: "seimbang", label: "Seimbang" },
];

const STRENGTH: Record<Strength, { label: string; Icon: typeof Trophy }> = {
  hemat: { label: "Paling hemat", Icon: Wallet },
  variasi: { label: "Pilihan terbanyak", Icon: Layers },
  besar: { label: "Kuota terbesar", Icon: HardDrive },
};

function Choice<T extends string>({ legend, value, onChange, options }: { legend: string; value: T | null; onChange: (v: T) => void; options: Opt<T>[] }) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="chips2" role="radiogroup" aria-label={legend}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={value === o.value} className={`chip2${o.value === "tidak_yakin" ? " soft" : ""}`} onClick={() => onChange(o.value)}>
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const RELAX_TEXT: Record<"usage" | "horizon", string> = {
  usage: "Tidak ada paket yang memenuhi kebutuhan kuota harian itu, jadi syarat kuota dilonggarkan.",
  horizon: "Tidak ada paket untuk durasi itu, jadi durasi dilonggarkan.",
};

export function OperatorAdvisor({ items, onSeeCatalog }: { items: IbpItem[]; onSeeCatalog: (operator: string) => void }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [budget, setBudget] = useState<OpBudget | null>(null);
  const [priority, setPriority] = useState<OpPriority | null>(null);

  const answered = [usage, horizon, budget, priority].filter(Boolean).length;
  const rec = useMemo<Recommendation | null>(
    () => (usage && horizon && budget && priority ? recommendOperators(items, { usage, horizon, budget, priority } satisfies Profile) : null),
    [items, usage, horizon, budget, priority],
  );

  return (
    <section className="adv">
      <h2 className="adv-title">Operator mana yang cocok untukmu?</h2>
      <p className="adv-sub">Jawab 4 pertanyaan tentang caramu memakai internet. Kami bandingkan {new Set(items.map((i) => i.operator)).size} operator dari harga dan ragam paket di katalog.</p>

      <div className="adv-form">
        <Choice legend="1. Seberapa banyak pemakaian internetmu?" value={usage} onChange={setUsage} options={USAGE} />
        <Choice legend="2. Biasanya beli paket untuk berapa lama?" value={horizon} onChange={setHorizon} options={HORIZON} />
        <Choice legend="3. Anggaran per pembelian?" value={budget} onChange={setBudget} options={BUDGET} />
        <Choice legend="4. Apa yang paling kamu utamakan?" value={priority} onChange={setPriority} options={PRIORITY} />
      </div>

      {!rec ? (
        <p className="state adv-wait">Jawab semua pertanyaan untuk melihat rekomendasi ({answered}/4)</p>
      ) : (
        <Result rec={rec} onSeeCatalog={onSeeCatalog} />
      )}
    </section>
  );
}

function Result({ rec, onSeeCatalog }: { rec: Recommendation; onSeeCatalog: (op: string) => void }) {
  if (rec.results.length === 0) {
    return <p className="state">Belum ada paket yang bisa dibandingkan untuk profil ini. Coba ubah jawabanmu.</p>;
  }
  return (
    <div className="adv-result">
      {rec.relaxed === "budget" && rec.neededPrice !== null && (
        <div className="adv-note warnbox">
          <Info size={16} aria-hidden />
          <p>
            Tidak ada paket yang cocok dalam anggaranmu. Dengan kebutuhan itu paket termurah sekitar <strong>{rupiah(rec.neededPrice)}</strong>, dan inilah operator terbaik di rentang itu.
          </p>
        </div>
      )}
      {(rec.relaxed === "usage" || rec.relaxed === "horizon") && (
        <div className="adv-note warnbox">
          <Info size={16} aria-hidden />
          <p>{RELAX_TEXT[rec.relaxed]}</p>
        </div>
      )}

      <h3 className="adv-h3">Rekomendasi operator</h3>
      <ol className="adv-list">
        {rec.results.map((r, i) => (
          <li key={r.operator}>
            <OperatorCard r={r} rank={i + 1} onSeeCatalog={onSeeCatalog} />
          </li>
        ))}
      </ol>

      {rec.unmatched.length > 0 && (
        <p className="adv-unmatched">Tidak punya paket yang cocok dengan profilmu: {rec.unmatched.map(niceOperator).join(", ")}.</p>
      )}

      <aside className="adv-note infobox">
        <Info size={16} aria-hidden />
        <p>
          Perbandingan ini berdasarkan <strong>harga dan ragam paket</strong> di katalog Babelii, bukan kualitas sinyal. Kekuatan sinyal berbeda di tiap lokasi, jadi cek juga cakupan operator di areamu. Kuota bersyarat (lokal, aplikasi, malam hari) dihitung penuh dalam harga per GB.
        </p>
      </aside>
    </div>
  );
}

function OperatorCard({ r, rank, onSeeCatalog }: { r: OperatorResult; rank: number; onSeeCatalog: (op: string) => void }) {
  const name = niceOperator(r.operator);
  const s = r.sample;
  return (
    <article className={`op-card${rank === 1 ? " top" : ""}`}>
      <header className="op-head">
        <span className="op-rank" aria-label={`Peringkat ${rank}`}>{rank === 1 ? <Trophy size={16} aria-hidden /> : rank}</span>
        <h4>{name}</h4>
        {rank === 1 && <span className="op-best">Paling cocok</span>}
        <span className="op-score" title="Skor kecocokan 0-100">{r.score}<small>/100</small></span>
      </header>
      <div className="meter" role="img" aria-label={`Skor ${r.score} dari 100`}><div style={{ width: `${r.score}%` }} /></div>

      {r.strengths.length > 0 && (
        <ul className="strengths">
          {r.strengths.map((k) => {
            const { label, Icon } = STRENGTH[k];
            return <li key={k} className="str"><Icon size={13} aria-hidden />{label}</li>;
          })}
        </ul>
      )}

      <ul className="facts">
        <li><strong>{r.matches}</strong> paket cocok dengan profilmu{r.lowConfidence ? " (sedikit, hasil kurang meyakinkan)" : ""}</li>
        <li>Harga ± <strong>{rupiah(Math.round(r.ratePerGb))}</strong> per GB{r.pricierPct > 0 ? `, ${r.pricierPct}% lebih mahal dari yang termurah` : ", yang termurah di antara pilihan"}</li>
        <li>Kuota terbesar sampai <strong>{+r.maxGb.toFixed(0)} GB</strong></li>
        <li className="with-icon"><BadgeCheck size={14} aria-hidden /><span>{Math.round(r.qualityShare * 100)}% paket bertanda Worth It / Smart Pick</span></li>
      </ul>

      <div className="sample">
        <span className="sample-label">Contoh paket yang cocok</span>
        <div className="sample-body">
          <div className="sample-info">
            <strong>{cleanTitle(s.name)}</strong>
            <span className="sample-meta">
              <TypeChip catalogue={s.catalogue} />
              {DETAILS.kuota.value(s)} · {DETAILS.masa.value(s)} · {rupiah(s.price)}
            </span>
          </div>
          <BuyButton item={s} small />
        </div>
      </div>

      <button className="tbtn" onClick={() => onSeeCatalog(r.operator)}>
        Lihat semua paket {name} <ArrowRight size={15} aria-hidden />
      </button>
    </article>
  );
}
