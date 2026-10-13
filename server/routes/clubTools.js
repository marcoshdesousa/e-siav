// Pastas do Sistema do Clube: agenda, tesouraria (minhas finanças), patrimônio,
// biblioteca (especialidades e guias), ferramentas (aniversariantes e contatos) e suporte.
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { fail, int, str, validDate, ageFrom } from '../util.js';
import { getFicha } from '../ficha.js';
import { setting, toCents } from '../fees.js';

const r = Router();
const club = requireAuth('club');
const admin = requireAuth('admin');

// ---------- Agenda ----------
/**
 * Dias do item: uma lista de dias escolhidos no calendário (um, vários seguidos ou soltos).
 * Também aceita data + "até" (do dia tal ao dia tal).
 */
const AGENDA_CORES = ['verde', 'azul', 'laranja', 'vermelho', 'roxo', 'preto'];
function agendaFields(b) {
  const title = str(b.title, 120);
  if (!title) fail(400, 'Escreva o que vai acontecer');
  let dates = Array.isArray(b.dates) ? [...new Set(b.dates.filter(validDate))].sort() : [];
  if (!dates.length && validDate(b.date)) {
    const end = b.end_date && validDate(b.end_date) && b.end_date >= b.date ? b.end_date : b.date;
    for (let d = new Date(b.date + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= end && dates.length < 92; d = new Date(d.getTime() + 864e5)) dates.push(d.toISOString().slice(0, 10));
  }
  if (!dates.length) fail(400, 'Escolha pelo menos um dia');
  if (dates.length > 92) fail(400, 'No máximo 92 dias');
  const time = /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : null;
  const color = AGENDA_CORES.includes(b.color) ? b.color : 'verde';
  return {
    color,
    title, date: dates[0], end: dates.length > 1 ? dates[dates.length - 1] : null, dates: JSON.stringify(dates),
    time, location: str(b.location, 160) || null, description: str(b.description, 1000) || null,
  };
}
const withDates = (rows) => rows.map((a) => ({ ...a, dates: a.dates ? JSON.parse(a.dates) : null }));
const AGENDA_COLS = `a.id, a.creator_type, a.scope, a.title, a.description, a.location, a.date, a.end_date, a.dates, a.time, a.color, a.club_id, a.district_id,
  d.name AS district_name, c.name AS club_name`;
const AGENDA_FROM = 'agenda_items a LEFT JOIN districts d ON d.id = a.district_id LEFT JOIN clubs c ON c.id = a.club_id';

/** Agenda que um clube (ou um membro/grupo dele) vê: a do clube + a do App para todos, o distrito ou o clube. */
function agendaFor(clubId, districtId) {
  return withDates(all(
    `SELECT ${AGENDA_COLS} FROM ${AGENDA_FROM}
     WHERE (a.creator_type = 'club' AND a.club_id = ?)
        OR (a.creator_type = 'admin' AND (a.scope = 'geral' OR (a.scope = 'distrito' AND a.district_id = ?) OR (a.scope = 'clube' AND a.club_id = ?)))
     ORDER BY a.date, a.time`,
    clubId, districtId, clubId,
  ));
}
r.get('/agenda', requireAuth('club', 'unit', 'member'), (req, res) => res.json(agendaFor(req.actor.club_id, req.actor.district_id)));

r.post('/club/agenda', club, (req, res) => {
  const f = agendaFields(req.body);
  const id = Number(run(`INSERT INTO agenda_items (creator_type, club_id, scope, title, description, location, date, end_date, dates, time, color) VALUES ('club',?,'clube',?,?,?,?,?,?,?,?)`,
    req.actor.id, f.title, f.description, f.location, f.date, f.end, f.dates, f.time, f.color).lastInsertRowid);
  res.json({ id });
});
r.put('/club/agenda/:id', club, (req, res) => {
  const f = agendaFields(req.body);
  const { changes } = run(`UPDATE agenda_items SET title = ?, description = ?, location = ?, date = ?, end_date = ?, dates = ?, time = ?, color = ? WHERE id = ? AND creator_type = 'club' AND club_id = ?`,
    f.title, f.description, f.location, f.date, f.end, f.dates, f.time, f.color, int(req.params.id), req.actor.id);
  if (!changes) fail(404, 'Item da agenda não encontrado');
  res.json({ ok: true });
});
r.delete('/club/agenda/:id', club, (req, res) => {
  const { changes } = run(`DELETE FROM agenda_items WHERE id = ? AND creator_type = 'club' AND club_id = ?`, int(req.params.id), req.actor.id);
  if (!changes) fail(404, 'Item da agenda não encontrado');
  res.json({ ok: true });
});

// Admin: agenda para todos os clubes, um distrito ou um clube.
r.get('/admin/agenda', admin, (_req, res) => res.json(withDates(all(`SELECT ${AGENDA_COLS} FROM ${AGENDA_FROM} WHERE a.creator_type = 'admin' ORDER BY a.date, a.time`))));
function adminScope(b) {
  const scope = ['geral', 'distrito', 'clube'].includes(b.scope) ? b.scope : 'geral';
  let districtId = null;
  let clubId = null;
  if (scope === 'distrito') {
    districtId = int(b.district_id);
    if (!get('SELECT 1 FROM districts WHERE id = ?', districtId)) fail(400, 'Escolha o distrito');
  }
  if (scope === 'clube') {
    clubId = int(b.club_id);
    if (!get('SELECT 1 FROM clubs WHERE id = ?', clubId)) fail(400, 'Escolha o clube');
  }
  return { scope, districtId, clubId };
}
r.post('/admin/agenda', admin, (req, res) => {
  const f = agendaFields(req.body);
  const { scope, districtId, clubId } = adminScope(req.body);
  const id = Number(run(`INSERT INTO agenda_items (creator_type, club_id, scope, district_id, title, description, location, date, end_date, dates, time, color) VALUES ('admin',?,?,?,?,?,?,?,?,?,?,?)`,
    clubId, scope, districtId, f.title, f.description, f.location, f.date, f.end, f.dates, f.time, f.color).lastInsertRowid);
  res.json({ id });
});
r.put('/admin/agenda/:id', admin, (req, res) => {
  const f = agendaFields(req.body);
  const { scope, districtId, clubId } = adminScope(req.body);
  const { changes } = run(`UPDATE agenda_items SET club_id = ?, scope = ?, district_id = ?, title = ?, description = ?, location = ?, date = ?, end_date = ?, dates = ?, time = ?, color = ?
                           WHERE id = ? AND creator_type = 'admin'`,
  clubId, scope, districtId, f.title, f.description, f.location, f.date, f.end, f.dates, f.time, f.color, int(req.params.id));
  if (!changes) fail(404, 'Item da agenda não encontrado');
  res.json({ ok: true });
});
r.delete('/admin/agenda/:id', admin, (req, res) => {
  const { changes } = run(`DELETE FROM agenda_items WHERE id = ? AND creator_type = 'admin'`, int(req.params.id));
  if (!changes) fail(404, 'Item da agenda não encontrado');
  res.json({ ok: true });
});

// ---------- Tesouraria: minhas finanças (só controle, não movimenta dinheiro) ----------
r.get('/club/financas', club, (req, res) => {
  const rows = all('SELECT * FROM club_finance WHERE club_id = ? ORDER BY date DESC, id DESC', req.actor.id);
  const sum = (k) => rows.filter((x) => x.kind === k).reduce((s, x) => s + x.amount_cents, 0);
  res.json({ rows, entradas: sum('entrada'), saidas: sum('saida'), saldo: sum('entrada') - sum('saida') });
});
r.post('/club/financas', club, (req, res) => {
  const kind = req.body.kind === 'saida' ? 'saida' : 'entrada';
  const description = str(req.body.description, 160);
  const cents = toCents(req.body.amount);
  if (!description) fail(400, 'Escreva a descrição (ex.: Acampamento de inverno)');
  if (!cents) fail(400, 'Informe o valor');
  const date = validDate(req.body.date) ? req.body.date : new Date().toISOString().slice(0, 10);
  const id = Number(run('INSERT INTO club_finance (club_id, kind, description, amount_cents, date) VALUES (?,?,?,?,?)', req.actor.id, kind, description, cents, date).lastInsertRowid);
  res.json({ id });
});
r.delete('/club/financas/:id', club, (req, res) => {
  const { changes } = run('DELETE FROM club_finance WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!changes) fail(404, 'Lançamento não encontrado');
  res.json({ ok: true });
});

// ---------- Patrimônio ----------
r.get('/club/patrimonio', club, (req, res) => {
  const rows = all('SELECT * FROM club_assets WHERE club_id = ? ORDER BY name', req.actor.id);
  res.json({ rows, total_cents: rows.reduce((s, x) => s + (x.price_cents || 0), 0) });
});
function assetFields(b) {
  const name = str(b.name, 120);
  if (!name) fail(400, 'Escreva o nome do patrimônio');
  return { name, price: b.price === undefined || b.price === '' ? null : toCents(b.price), acquired: validDate(b.acquired_at) ? b.acquired_at : null, notes: str(b.notes, 500) || null };
}
r.post('/club/patrimonio', club, imageUpload.single('photo'), (req, res) => {
  const f = assetFields(req.body);
  const id = Number(run('INSERT INTO club_assets (club_id, name, photo, price_cents, acquired_at, notes) VALUES (?,?,?,?,?,?)',
    req.actor.id, f.name, req.file ? fileUrl(req.file) : null, f.price, f.acquired, f.notes).lastInsertRowid);
  res.json({ id });
});
r.put('/club/patrimonio/:id', club, imageUpload.single('photo'), (req, res) => {
  const a = get('SELECT * FROM club_assets WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!a) fail(404, 'Patrimônio não encontrado');
  const f = assetFields(req.body);
  run('UPDATE club_assets SET name = ?, price_cents = ?, acquired_at = ?, notes = ?, photo = ? WHERE id = ?',
    f.name, f.price, f.acquired, f.notes, req.file ? fileUrl(req.file) : a.photo, a.id);
  res.json({ ok: true });
});
r.delete('/club/patrimonio/:id', club, (req, res) => {
  const { changes } = run('DELETE FROM club_assets WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!changes) fail(404, 'Patrimônio não encontrado');
  res.json({ ok: true });
});

// ---------- Biblioteca: especialidades e guias ----------
/** Quem tem especialidades e guias no clube, com a quantidade e a lista de cada um. */
r.get('/club/biblioteca', club, (req, res) => {
  const members = all(`SELECT id, name, photo, code, birth_date, unit_id FROM members WHERE club_id = ? AND status <> 'inativo' ORDER BY name`, req.actor.id);
  const ach = all(
    `SELECT a.member_id, a.date, ct.id, ct.type, ct.name, ct.icon, ct.image, ct.category FROM achievements a
     JOIN content ct ON ct.id = a.content_id JOIN members m ON m.id = a.member_id
     WHERE m.club_id = ? AND ct.type IN ('especialidade','classe') ORDER BY ct.type, ct.name`,
    req.actor.id,
  );
  res.json(members.map((m) => {
    const mine = ach.filter((a) => a.member_id === m.id);
    return {
      id: m.id, name: m.name, photo: m.photo, code: m.code, age: ageFrom(m.birth_date), unit_id: m.unit_id,
      insignias: mine.filter((a) => a.type === 'especialidade'), guias: mine.filter((a) => a.type === 'classe'),
    };
  }));
});

/** Entrega de uma vez: várias especialidades ou guias para várias pessoas. */
r.post('/club/biblioteca/entregar', club, (req, res) => {
  const memberIds = [...new Set((Array.isArray(req.body.member_ids) ? req.body.member_ids : []).map(Number).filter(Boolean))];
  const contentIds = [...new Set((Array.isArray(req.body.content_ids) ? req.body.content_ids : []).map(Number).filter(Boolean))];
  if (!memberIds.length) fail(400, 'Escolha pelo menos uma pessoa');
  if (!contentIds.length) fail(400, 'Escolha pelo menos uma especialidade ou guia');
  let added = 0;
  tx(() => {
    for (const mid of memberIds) {
      if (!get(`SELECT 1 FROM members WHERE id = ? AND club_id = ? AND status <> 'inativo'`, mid, req.actor.id)) fail(400, 'Membro inválido');
      for (const cid of contentIds) {
        if (!get(`SELECT 1 FROM content WHERE id = ? AND type IN ('classe','especialidade')`, cid)) fail(400, 'Especialidade ou guia inválido');
        added += Number(run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'clube')`, mid, cid).changes);
      }
    }
  });
  res.json({ added });
});

/** Dados do certificado (gerado automaticamente) de uma especialidade ou guia. */
r.get('/club/certificado/:memberId/:contentId', club, (req, res) => {
  const c = get(
    `SELECT m.name AS member_name, ct.name AS content_name, ct.type, ct.image, ct.icon, a.date, cl.name AS club_name, cl.logo AS club_logo, cl.director_name
     FROM achievements a JOIN members m ON m.id = a.member_id JOIN content ct ON ct.id = a.content_id JOIN clubs cl ON cl.id = m.club_id
     WHERE a.member_id = ? AND a.content_id = ? AND m.club_id = ?`,
    int(req.params.memberId), int(req.params.contentId), req.actor.id,
  );
  if (!c) fail(404, 'Certificado não encontrado');
  res.json(c);
});

// ---------- Ferramentas: contatos ----------
/** WhatsApp do membro e do responsável (pais ou responsável legal), para achar rápido. */
r.get('/club/contatos', club, (req, res) => {
  const rows = all(`SELECT m.id, m.name, m.photo, m.code, m.birth_date, m.unit_id, u.name AS unit_name FROM members m LEFT JOIN units u ON u.id = m.unit_id
                    WHERE m.club_id = ? AND m.status <> 'inativo' ORDER BY m.name`, req.actor.id);
  res.json(rows.map((m) => {
    const f = getFicha(m.id);
    const resp = f.responsavel_whatsapp ? [f.responsavel_nome, f.responsavel_whatsapp]
      : f.mae_whatsapp ? [f.mae_nome, f.mae_whatsapp] : f.pai_whatsapp ? [f.pai_nome, f.pai_whatsapp] : [null, null];
    return {
      id: m.id, name: m.name, photo: m.photo, code: m.code, age: ageFrom(m.birth_date), unit_id: m.unit_id, unit_name: m.unit_name,
      whatsapp: f.whatsapp || null, responsavel_nome: resp[0] || null, responsavel_whatsapp: resp[1] || null,
    };
  }));
});

// ---------- Suporte ----------
r.get('/club/suporte', club, (_req, res) => res.json({ whatsapp: setting('support_whatsapp') || '' }));

export default r;
