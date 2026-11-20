// Estúdio do prêmio: quem finaliza um ranking personaliza o troféu (ou, nos mini-jogos, a medalha)
// antes de entregar. A prévia mostra o 1º, o 2º e o 3º lugar.
import { useState } from 'react';
import { Shuffle, Trophy as TrophyIcon } from 'lucide-react';
import { Button, Modal } from '../ui.jsx';
import { FrameStudio, newFrame } from '../frames.jsx';
import { BASES, COLORS, EMBLEMS, GameMedal, MEDAL_MODELS, RIBBONS, TROPHY_MODELS, Trophy, baseSwatch, colorSwatch, ribbonSwatch } from '../trophies.jsx';

const pick = (list) => list[Math.floor(Math.random() * list.length)][0];

function Choice({ label, options, value, onChange, swatch, preview }) {
  return (
    <div className="ts-group">
      <span className="ts-label">{label}</span>
      <div className={'ts-options' + (preview ? ' with-preview' : '')}>
        {options.map(([k, name]) => (
          <button key={k} type="button" className={'ts-opt' + (value === k ? ' on' : '')} onClick={() => onChange(k)} title={name} aria-pressed={value === k}>
            {preview ? preview(k) : swatch ? <span className="ts-dot" style={{ background: swatch(k) }} /> : null}
            <span>{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * mode: 'trofeu' (rankings) ou 'medalha' (mini-jogos). title: título padrão do prêmio.
 * onConfirm(design) é chamado ao finalizar.
 */
export default function TrophyStudio({ mode = 'trofeu', title, heading, info, onClose, onConfirm, busy }) {
  const medal = mode === 'medalha';
  const [d, setD] = useState({
    model: medal ? 'redonda' : 'classica', color: 'podio', base: 'madeira', ribbon: 'dbv',
    emblem: medal ? 'controle' : 'estrela', year: new Date().getFullYear(), title,
  });
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  // O que entregar aos 3 primeiros: troféu, moldura ou os dois (nos rankings).
  const [giveTrophy, setGiveTrophy] = useState(true);
  const [frame, setFrame] = useState(null);
  const Art = medal ? GameMedal : Trophy;
  const surprise = () => setD((x) => ({
    ...x, model: pick(medal ? MEDAL_MODELS : TROPHY_MODELS), color: pick(COLORS), base: pick(BASES), ribbon: pick(RIBBONS),
    emblem: pick(EMBLEMS.filter(([k]) => k !== 'nenhum')),
  }));
  return (
    <Modal title={heading} onClose={onClose} footer={(
      <div className="row" style={{ gap: '.5rem', width: '100%' }}>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button block busy={busy} disabled={!medal && !giveTrophy && !frame} onClick={() => onConfirm(d, { trophy: medal || giveTrophy, frame })}><TrophyIcon size={16} /> Finalizar e entregar</Button>
      </div>
    )}>
      <div className="ts-stage">
        <div className="ts-podium">
          {[2, 1, 3].map((p) => (
            <div key={p} className={`ts-place p${p}`}>
              <Art design={d} pos={p} size={p === 1 ? 104 : 78} />
            </div>
          ))}
        </div>
        <b className="ts-title">{d.title || title}</b>
        <span className="ts-year">Temporada {d.year}</span>
      </div>
      {info && <p className="small muted" style={{ margin: '.2rem 0 .6rem' }}>{info}</p>}
      {!medal && (
        <div className="ts-give">
          <span className="ts-label">O que os 3 primeiros ganham</span>
          <label className="check-row"><input type="checkbox" checked={giveTrophy} onChange={(e) => setGiveTrophy(e.target.checked)} /><span><b>Troféu</b> com certificado de honra</span></label>
          <label className="check-row"><input type="checkbox" checked={!!frame} onChange={(e) => setFrame(e.target.checked ? newFrame((d.title || title).slice(0, 22), String(d.year)) : null)} /><span><b>Moldura</b> para a foto de perfil</span></label>
          {frame && <FrameStudio value={frame} onChange={setFrame} />}
        </div>
      )}
      <div className="ts-fields">
        <label className="field"><span className="field-label">Título {medal ? 'da medalha' : 'do troféu'}</span>
          <input value={d.title} maxLength={32} onChange={(e) => set('title')(e.target.value)} placeholder={title} />
        </label>
        <label className="field ts-year-field"><span className="field-label">Ano</span>
          <input type="number" min="2000" max="2100" value={d.year} onChange={(e) => set('year')(Number(e.target.value) || '')} />
        </label>
      </div>
      <Button small variant="secondary" onClick={surprise}><Shuffle size={14} /> Surpreenda-me</Button>
      <Choice label="Modelo" options={medal ? MEDAL_MODELS : TROPHY_MODELS} value={d.model} onChange={set('model')}
        preview={(k) => <Art design={{ ...d, model: k, year: '' }} pos={1} size={40} />} />
      <Choice label="Cor" options={COLORS} value={d.color} onChange={set('color')} swatch={colorSwatch} />
      {medal
        ? <Choice label="Fita" options={RIBBONS} value={d.ribbon} onChange={set('ribbon')} swatch={ribbonSwatch} />
        : <Choice label="Base" options={BASES} value={d.base} onChange={set('base')} swatch={baseSwatch} />}
      <Choice label="Emblema" options={EMBLEMS} value={d.emblem} onChange={set('emblem')} />
      <p className="small muted" style={{ marginBottom: 0 }}>
        {medal ? 'A medalha vai para os 3 primeiros de cada jogo (sem certificado).' : 'O troféu vai para os 3 primeiros, junto com o certificado (nos Downloads).'} Só ganha quem fez pontos.
      </p>
    </Modal>
  );
}
