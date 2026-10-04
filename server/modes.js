// Formas de envio de um requisito: qualquer combinação de relatório, foto e quiz.
import { parseJson } from './util.js';

export const MODES = ['texto', 'foto', 'quiz'];

const LEGACY = { texto: ['texto'], foto: ['foto'], quiz: ['quiz'], texto_foto: ['texto', 'foto'], quiz_foto: ['quiz', 'foto'] };

/** Lê as formas de envio de um requisito (aceita registros antigos com "model"). */
export function modesOf(row) {
  if (row.modes) return row.modes.split(',').filter((m) => MODES.includes(m));
  return LEGACY[row.model] || [];
}

/** Normaliza o que veio do formulário (array, JSON ou "texto,foto"). */
export function parseModes(v) {
  const list = Array.isArray(v) ? v : typeof v === 'string' && v.startsWith('[') ? parseJson(v, []) : String(v || '').split(',');
  return MODES.filter((m) => list.includes(m));
}

/** Valor compatível com a coluna antiga "model" (mantida para bancos já existentes). */
export function legacyModel(modes) {
  if (modes.includes('quiz')) return modes.includes('foto') ? 'quiz_foto' : 'quiz';
  if (modes.includes('foto')) return modes.includes('texto') ? 'texto_foto' : 'foto';
  return 'texto';
}

export const MODE_LABEL = { texto: 'Relatório', foto: 'Foto', quiz: 'Quiz' };
