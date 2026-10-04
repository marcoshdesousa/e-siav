import crypto from 'node:crypto';
import { IDADE_MIN_DESBRAVADOR, IDADE_MAX_DESBRAVADOR } from './config.js';
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

/** A idade define o tipo de conta: 10–15 desbravador, 16+ liderança. */
export function memberKind(birthDate) {
  const age = ageFrom(birthDate);
  if (age < IDADE_MIN_DESBRAVADOR) return null;
  return age <= IDADE_MAX_DESBRAVADOR ? 'desbravador' : 'lideranca';
}

export function newMemberCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code = 'DBV-';
    for (let i = 0; i < 5; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!get('SELECT 1 FROM members WHERE code = ?', code)) return code;
  }
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
