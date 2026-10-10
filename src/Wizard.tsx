import { useMemo, useState } from "react";
import type { IbpItem } from "./api/ibp.ts";
import { catalogueLabel, days, gb, rupiah } from "./format.ts";
import { compareBadge, getRecommendations, type Answers, type WProduct } from "./wizard/engine.ts";

type Key = keyof Answers;
interface Option { value: string; label: string; hint?: string; unsure?: boolean }
interface Step { key: Key; question: string; options: Option[] }

const UNSURE: Option = { value: "tidak_yakin", label: "Tidak yakin", unsure: true };

const niceOperator = (o: string) => (o.length <= 3 ? o : o[0] + o.slice(1).toLowerCase());

function buildSteps(operators: string[]): Step[] {
  return [
    {
      key: "operator",
      question: "Apa operator selulermu?",
      options: operators.map((o) => ({ value: o, label: niceOperator(o) })),
    },
    {
      key: "phone",
      question: "Kamu hafal nomor HP-mu dan bersedia mengisinya?",
      options: [
        { value: "ya", label: "Ya, bersedia", hint: "semua jenis paket" },
        { value: "tidak", label: "Tidak", hint: "voucher & kuota elektrik" },
      ],
    },
    {
      key: "hotspot",
      question: "Kuotanya mau di-hotspot / tethering?",
      options: [{ value: "ya", label: "Ya" }, { value: "tidak", label: "Tidak" }, UNSURE],
    },
    {
      key: "duration",
      question: "Butuh untuk durasi berapa lama?",
      options: [
        { value: "1", label: "1 hari" },
        { value: "2-3", label: "2-3 hari" },
        { value: "7+", label: "Seminggu / bulanan" },
        UNSURE,
      ],
    },
    {
      key: "usage",
      question: "Perkiraan pemakaian harianmu?",
      options: [
        { value: "ringan", label: "Ringan", hint: "< 2 GB" },
        { value: "sedang", label: "Sedang", hint: "2-5 GB" },
        { value: "berat", label: "Berat", hint: "> 5 GB" },
        UNSURE,
      ],
    },
    {
      key: "budget",
      question: "Maksimal anggaran tunai saat ini?",
      options: [
        { value: "lt10", label: "Di bawah Rp 10.000" },
        { value: "10-20", label: "Rp 10.000 - Rp 20.000" },
        { value: "gt20", label: "Di atas Rp 20.000" },
        UNSURE,
      ],
    },
    {
      key: "priority",
      question: "Apa prioritas utamamu?",
      options: [
        { value: "cheapest", label: "Hemat bayar tunai" },
        { value: "best_value", label: "Kuota melimpah", hint: "rate hemat" },
        UNSURE,
      ],
    },
  ];
}

export function Wizard({ items }: { items: IbpItem[] }) {
  const operators = useMemo(() => [...new Set(items.map((i) => i.operator))].sort(), [items]);
  const steps = useMemo(() => buildSteps(operators), [operators]);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [step, setStep] = useState(0);

  const done = step >= steps.length;
  const result = useMemo(
    () => (done ? getRecommendations(items, answers as Answers) : null),
    [done, items, answers],
  );

  const choose = (key: Key, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setStep((s) => s + 1);
  };
  const reset = () => {
    setAnswers({});
    setStep(0);
  };

  if (!done) {
    const s = steps[step];
    return (
      <section className="wiz">
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          <div style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="step-no">Pertanyaan {step + 1} dari {steps.length}</p>
        <h2 className="q">{s.question}</h2>
        <div className="opts">
          {s.options.map((o) => (
            <button
              key={o.value}
              className={`opt${o.unsure ? " unsure" : ""}${answers[s.key] === o.value ? " picked" : ""}`}
              onClick={() => choose(s.key, o.value)}
            >
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </button>
          ))}
        </div>
        {step > 0 && <button className="link back" onClick={() => setStep(step - 1)}>← Kembali</button>}
      </section>
    );
  }

  const r = result!;
  const a = answers as Answers;
  const label = (k: Key) => steps.find((s) => s.key === k)!.options.find((o) => o.value === a[k])?.label ?? "-";
  return (
    <section className="wiz">
      <h2 className="q">Rekomendasi untukmu</h2>
      <p className="summary">
        {steps.map((s) => label(s.key)).join(" · ")}
      </p>
      {!r.primary ? (
        <p className="state">{r.message} Coba ubah jawabanmu, misalnya anggaran atau durasi.</p>
      ) : (
        <ul className="grid wiz-grid">
          <li>
            <ResultCard
              p={r.primary}
              badge={a.priority === "cheapest" ? "Paling Hemat Tunai" : "Paling Pas Dengan Kebutuhanmu"}
              tone="main"
            />
          </li>
          {r.secondary && (
            <li>
              <ResultCard p={r.secondary} badge={compareBadge(r.primary, r.secondary, rupiah)} tone="alt" />
            </li>
          )}
        </ul>
      )}
      <div className="wiz-actions">
        <button className="link" onClick={() => setStep(steps.length - 1)}>← Ubah jawaban terakhir</button>
        <button className="btn ghost" onClick={reset}>Mulai lagi</button>
      </div>
    </section>
  );
}

function ResultCard({ p, badge, tone }: { p: WProduct; badge: string; tone: "main" | "alt" }) {
  const i = p.item;
  return (
    <article className={`card result ${tone}`}>
      <span className={`tag ${tone}`}>{badge}</span>
      <div className="meta">
        <span className="op">{i.operator}</span>
        <span className="cat">{catalogueLabel(i.catalogue)}</span>
      </div>
      <h3>{i.name}</h3>
      <dl>
        <div><dt>Total kuota</dt><dd>{gb(i.volumeGb)}</dd></div>
        <div><dt>Masa aktif</dt><dd>{days(i.validityDays)}</dd></div>
      </dl>
      <div className="buy">
        <div>
          <strong>{rupiah(i.price)}</strong>
          {p.ratePerGb !== null && <small className="rate">≈ {rupiah(p.ratePerGb)}/GB</small>}
        </div>
        {i.buyUrl ? (
          <a className="btn" href={i.buyUrl} target="_blank" rel="noopener noreferrer">Beli</a>
        ) : (
          <span className="btn disabled">Beli</span>
        )}
      </div>
    </article>
  );
}
