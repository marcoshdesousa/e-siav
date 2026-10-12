import crypto from 'node:crypto';
import { CARGOS_LIDERANCA, IDADE_MIN_DESBRAVADOR, IDADE_MAX_DESBRAVADOR } from './config.js';
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

/** Papel mostrado no app: Explorador (10–15), ou Liderança/Tutor (16+) conforme o cargo. */
export function roleOf(kind, cargo) {
  if (kind === 'desbravador') return 'Explorador';
  return CARGOS_LIDERANCA.includes(cargo) ? 'Liderança' : 'Tutor';
}

/** A idade define o tipo de conta: 10–15 explorador, 16+ tutor. */
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

/** Código do clã: 4 números em sequência (0001, 0002...). */
export function newClubCode() {
  const max = get('SELECT MAX(CAST(code AS INTEGER)) n FROM clubs').n || 0;
  return String(max + 1).padStart(4, '0');
}

/** Senha do grupo: 4 números aleatórios, sem repetir dentro do clã. */
export function newUnitPin(clubId) {
  for (;;) {
    const pin = String(crypto.randomInt(10000)).padStart(4, '0');
    if (!get('SELECT 1 FROM units WHERE club_id = ? AND pin = ?', clubId, pin)) return pin;
  }
}

/** Senha inicial do clã: 6 números aleatórios (pode ser trocada depois). */
export const newClubPassword = () => String(crypto.randomInt(100000, 1000000));

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
