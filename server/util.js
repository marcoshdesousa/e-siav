import crypto from 'node:crypto';
import { CARGOS, CARGOS_LIDERANCA, IDADE_MIN_DESBRAVADOR, IDADE_MAX_DESBRAVADOR } from './config.js';
import { get } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};

export function ageFrom(birthDate, ref = new Date()) {
  const b = new Date(birthDate + 'T12:00:00');
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

/** Papel mostrado no app: Desbravador (10–15), ou Diretoria / Conselheiro (16+) conforme o cargo. */
export function roleOf(kind, cargo) {
  if (kind === 'desbravador') return 'Desbravador';
  if (!CARGOS.lideranca.includes(cargo)) return 'Liderança';
  return CARGOS_LIDERANCA.includes(cargo) ? 'Diretoria' : 'Conselheiro';
}

/**
 * Cargo mostrado no app. Aos 16 anos o membro vira liderança sozinho (continua na unidade dele):
 * enquanto o clube não troca o cargo de desbravador, aparece "Liderança".
 */
export function cargoOf(kind, cargo) {
  return kind === 'lideranca' && !CARGOS.lideranca.includes(cargo) ? 'Liderança' : cargo;
}

/** A idade define o tipo de conta: 10–15 desbravador, 16+ liderança. */
export function memberKind(birthDate) {
  const age = ageFrom(birthDate);
  if (age < IDADE_MIN_DESBRAVADOR) return null;
  return age <= IDADE_MAX_DESBRAVADOR ? 'desbravador' : 'lideranca';
}

/** Código do membro: 6 números, único em todo o app. */
export function newMemberCode() {
  for (;;) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!get('SELECT 1 FROM members WHERE code = ?', code)) return code;
  }
}

/** Código do clube: 4 números aleatórios, único (é o login do clube e das unidades). */
export function newClubCode() {
  for (;;) {
    const code = String(crypto.randomInt(1000, 10000));
    if (!get('SELECT 1 FROM clubs WHERE code = ?', code)) return code;
  }
}

/** Número do clube: a ordem de criação (1º, 2º, 3º...). */
export const newClubNumber = () => (get('SELECT MAX(number) n FROM clubs').n || 0) + 1;

/** Nome mostrado no app: "1º Clube Águias" (o número vem na frente, sozinho). */
export function clubDisplayName(number, raw) {
  const base = String(raw || '').trim().replace(/^\d+\s*º\s*/, '').replace(/^(clube|club|cl[ãa])(\s+|$)/i, '').trim();
  // O nome sempre começa com "Clube" (ex.: "Titânio" vira "Clube Titânio").
  return `Clube ${base}`;
}

// Senhas de clube e de unidade: 2 letras + 4 números (ex.: KR4827), geradas pelo app
// e que não podem ser trocadas. Sem I e O para não confundir com 1 e 0.
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const novaSenha = () => LETRAS[crypto.randomInt(LETRAS.length)] + LETRAS[crypto.randomInt(LETRAS.length)] + String(crypto.randomInt(10000)).padStart(4, '0');
export const SENHA_RE = /^[A-Z]{2}\d{4}$/;

export const newClubPassword = novaSenha;

/** Senha da unidade: única dentro do clube e diferente da senha do clube. */
export function newUnitPin(clubId, isClubPassword = () => false) {
  for (;;) {
    const pin = novaSenha();
    if (get('SELECT 1 FROM units WHERE club_id = ? AND pin = ?', clubId, pin)) continue;
    if (isClubPassword(pin)) continue;
    return pin;
  }
}

/** CPF: só números, com dígitos verificadores válidos. Retorna os 11 dígitos ou null. */
export function cleanCpf(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}

export const str = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));
export const int = (v, def = null) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';

export function parseJson(v, def) {
  if (v == null || v === '') return def;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return def;
  }
}

export function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
