import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

/**
 * Setas na tela para celular. onDir(dir, ativo): ativo = true ao encostar e false ao soltar.
 * action: texto do botão de ação (opcional), que chama onDir('action', ...).
 */
export default function DPad({ onDir, dirs = ['up', 'left', 'right', 'down'], action }) {
  const ICON = { up: ChevronUp, down: ChevronDown, left: ChevronLeft, right: ChevronRight };
  const btn = (d, label) => {
    const Ico = ICON[d];
    return (
      <button
        key={d}
        type="button"
        className={'dpad-btn dpad-' + d}
        aria-label={label || d}
        onPointerDown={(e) => { e.preventDefault(); onDir(d, true); }}
        onPointerUp={() => onDir(d, false)}
        onPointerLeave={() => onDir(d, false)}
        onPointerCancel={() => onDir(d, false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Ico ? <Ico size={26} /> : label}
      </button>
    );
  };
  return (
    <div className="dpad">
      <div className="dpad-arrows">{dirs.map((d) => btn(d))}</div>
      {action && btn('action', action)}
    </div>
  );
}
