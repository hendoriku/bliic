import { LayoutGrid, List, Table2 } from "lucide-react";
import { VIEWS, VIEW_LABEL, type View } from "../view.ts";

const ICONS = { kartu: LayoutGrid, daftar: List, tabel: Table2 } as const;

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Tampilan">
      {VIEWS.map((v) => {
        const Icon = ICONS[v];
        return (
          <button key={v} role="radio" aria-checked={view === v} aria-label={VIEW_LABEL[v]} title={VIEW_LABEL[v]} onClick={() => onChange(v)}>
            <Icon size={16} strokeWidth={2.2} aria-hidden />
            <span className="seg-text">{VIEW_LABEL[v]}</span>
          </button>
        );
      })}
    </div>
  );
}
