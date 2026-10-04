const tz = undefined;

export const fmtDate = (s) => (s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR', { timeZone: tz }) : '');
export const fmtDateTime = (s) =>
  s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const fmtTime = (s) => (s ? new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
export const fmtMoney = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtChatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(s);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function timeLeft(deadline) {
  const ms = Date.parse(deadline) - Date.now();
  if (ms < 0) return null;
  const h = Math.floor(ms / 36e5);
  if (h < 1) return 'menos de 1 hora';
  if (h < 48) return `${h} horas`;
  return `${Math.floor(h / 24)} dias`;
}

/** Converte "datetime-local" (horário local) em ISO e vice-versa. */
export const localToIso = (v) => (v ? new Date(v).toISOString() : '');
export function isoToLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ordinal = (n) => `${n}º`;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const KIND_LABEL = { desbravador: 'Desbravador', lideranca: 'Liderança' };
export const MODEL_LABEL = { texto: 'Relatório', foto: 'Foto', quiz: 'Quiz', texto_foto: 'Relatório + foto', quiz_foto: 'Quiz + foto' };
export const AUDIENCE_LABEL = { club: 'Clubes', unit: 'Unidades', member: 'Desbravadores' };
export const STATE_LABEL = { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', fora_do_prazo: 'Fora do prazo' };
