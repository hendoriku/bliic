import { useMemo, useState } from "react";
import type { IbpItem } from "./api/ibp.ts";
import { ItemsView } from "./components/ItemsView.tsx";
import { ViewToggle } from "./components/ViewToggle.tsx";
import type { Entry, View } from "./view.ts";
import { rupiah } from "./format.ts";
import {
  compareBadge,
  compareUnlimitedBadge,
  countUnlimited,
  getRecommendations,
  type Answers,
  type Phone,
  type Scheme,
} from "./wizard/engine.ts";

type Key = keyof Answers;
interface Option { value: string; label: string; hint?: string; unsure?: boolean }
interface Step {
  key: Key;
  question: string;
  options: Option[] | ((a: Partial<Answers>) => Option[]);
  /** Langkah hanya ditanyakan bila syaratnya terpenuhi (urutan dan jumlah pertanyaan bersifat dinamis). */
  when?: (a: Partial<Answers>) => boolean;
  /** Perkiraan untuk penghitung "dari N" saat jawaban penentu `when` belum lengkap (default: sama dengan `when`). */
  maybe?: (a: Partial<Answers>) => boolean;
}
const optionsOf = (s: Step, a: Partial<Answers>): Option[] => (typeof s.options === "function" ? s.options(a) : s.options);

const UNSURE: Option = { value: "tidak_yakin", label: "Tidak yakin", unsure: true };

/** "AXIS" -> "Axis"; nama yang sudah campuran huruf ("by.U", "Indosat") dan singkatan pendek ("XL") dibiarkan. */
const niceOperator = (o: string) => (o.length > 3 && o === o.toUpperCase() ? o[0] + o.slice(1).toLowerCase() : o);

/** Skema efektif: "unlimited" hanya berlaku bila pertanyaannya memang diajukan (operator punya paket unlimited murni). */
function effectiveScheme(a: Partial<Answers>, items: IbpItem[]): Scheme {
  return schemeAsked(a, items) && a.scheme === "unlimited" ? "unlimited" : "volume";
}
const schemeAsked = (a: Partial<Answers>, items: IbpItem[]): boolean =>
  !!a.operator && !!a.phone && countUnlimited(items, a.operator, a.phone as Phone) > 0;

function buildSteps(operators: string[], items: IbpItem[]): Step[] {
  const volumeOnly = (a: Partial<Answers>) => effectiveScheme(a, items) === "volume";
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
      // Posisi ini sengaja: ditanya SETELAH operator + nomor HP (ketersediaan unlimited bergantung pada keduanya)
      // dan SEBELUM kriteria lain (menentukan apakah pemakaian harian & prioritas masih relevan).
      key: "scheme",
      question: "Kamu mau paket kuota biasa atau unlimited?",
      when: (a) => schemeAsked(a, items),
      // Sebelum nomor HP dijawab, anggap "ya" (kemungkinan terbanyak) agar total tidak melompat-lompat.
      maybe: (a) => !a.operator || countUnlimited(items, a.operator, (a.phone ?? "ya") as Phone) > 0,
      options: (a) => [
        { value: "volume", label: "Kuota volume biasa", hint: "ada batas GB" },
        {
          value: "unlimited",
          label: "Skema unlimited",
          hint: `tanpa batas kuota · ${countUnlimited(items, a.operator!, a.phone as Phone)} paket`,
        },
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
      when: volumeOnly,
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
      when: volumeOnly,
      question: "Apa prioritas utamamu?",
      options: [
        { value: "cheapest", label: "Hemat bayar tunai" },
        { value: "best_value", label: "Kuota melimpah", hint: "rate hemat" },
        UNSURE,
      ],
    },
  ];
}

export function Wizard({ items, view, onViewChange }: { items: IbpItem[]; view: View; onViewChange: (v: View) => void }) {
  const operators = useMemo(() => [...new Set(items.map((i) => i.operator))].sort(), [items]);
  const allSteps = useMemo(() => buildSteps(operators, items), [operators, items]);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [step, setStep] = useState(0);
  const steps = allSteps.filter((s) => !s.when || s.when(answers));
  // Jumlah pertanyaan yang diperkirakan untuk label "N dari M" (bisa menyusut begitu jawaban penentu diketahui).
  const projected = allSteps.filter((s) => (s.maybe ?? s.when)?.(answers) ?? true).length;
  const scheme = effectiveScheme(answers, items);

  const done = step >= steps.length;
  const result = useMemo(
    () => (done ? getRecommendations(items, { ...(answers as Answers), scheme }) : null),
    [done, items, answers, scheme],
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
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={projected} aria-valuenow={step + 1}>
          <div style={{ width: `${((step + 1) / projected) * 100}%` }} />
        </div>
        <p className="step-no">Pertanyaan {step + 1} dari {projected}</p>
        <h2 className="q">{s.question}</h2>
        <div className="opts">
          {optionsOf(s, answers).map((o) => (
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
  const label = (st: Step) => optionsOf(st, answers).find((o) => o.value === a[st.key])?.label ?? "-";
  return (
    <section className="wiz wide">
      <div className="bar">
        <h2 className="q">Rekomendasi untukmu</h2>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
      <p className="summary">
        {steps.map(label).join(" · ")}
      </p>
      {!r.primary ? (
        <p className="state">{r.message} Coba ubah jawabanmu, misalnya anggaran atau durasi.</p>
      ) : (
        <ItemsView
          view={view}
          entries={
            [
              {
                item: r.primary.item,
                rows: ["kuota", "masa"],
                showPricePerGb: true,
                highlight: {
                  text: scheme === "unlimited" ? "Paling Hemat per Hari" : a.priority === "cheapest" ? "Paling Hemat Tunai" : "Paling Pas Dengan Kebutuhanmu",
                  tone: "main",
                },
              },
              r.secondary && {
                item: r.secondary.item,
                rows: ["kuota", "masa"],
                showPricePerGb: true,
                highlight: {
                  text: scheme === "unlimited" ? compareUnlimitedBadge(r.primary, r.secondary, rupiah) : compareBadge(r.primary, r.secondary, rupiah),
                  tone: "alt",
                },
              },
            ].filter(Boolean) as Entry[]
          }
        />
      )}
      <div className="wiz-actions">
        <button className="link" onClick={() => setStep(steps.length - 1)}>← Ubah jawaban terakhir</button>
        <button className="btn ghost" onClick={reset}>Mulai lagi</button>
      </div>
    </section>
  );
}
