import { VIEWS, VIEW_LABEL, type View } from "../view.ts";

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Tampilan">
      {VIEWS.map((v) => (
        <button key={v} role="radio" aria-checked={view === v} onClick={() => onChange(v)}>
          {VIEW_LABEL[v]}
        </button>
      ))}
    </div>
  );
}
