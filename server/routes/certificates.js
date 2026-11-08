// Certificados (aba Certificados): o app gera sozinho quando o membro conclui o Ano Bíblico ou o Bom
// Líder (Manual Administrativo), e quando alguém fica no pódio de um ranking finalizado (troféu com
// certificado de honra, também para unidades e clubes). A página do certificado tem o botão de
// imprimir / salvar em PDF.
import { Router } from 'express';
import { all, get } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int } from '../util.js';
import { TOTAL_DAYS } from '../bible.js';
import { bomLiderFinished } from './bomLider.js';
import { memberTrophies, trophiesOf, trophyCertificate } from '../rankFinals.js';

const r = Router();
const member = requireAuth('member');

function bibleProgress(memberId) {
  const b = get('SELECT COUNT(*) n, MAX(completed_at) at FROM bible_progress WHERE member_id = ? AND completed_at IS NOT NULL', memberId);
  return { done: b.n, at: b.n >= TOTAL_DAYS ? b.at : null };
}
const trophyItem = (t) => ({ kind: 'trofeu', id: String(t.id), title: `${t.place}º lugar · ${t.name}`, subtitle: `Certificado de honra · ${t.year}`, date: t.awarded_at, place: t.place, design: t.design });

function listOf(memberId) {
  const out = [];
  const bible = bibleProgress(memberId).at;
  if (bible) out.push({ kind: 'ano-biblico', id: '1', title: 'Ano Bíblico', subtitle: 'Leu a Bíblia toda no plano do Ano Bíblico', date: bible });
  const bl = bomLiderFinished(memberId);
  if (bl) out.push({ kind: 'bom-lider', id: 'manual', title: 'Bom Líder: Manual Administrativo', subtitle: 'Concluiu todas as aulas', date: bl });
  // Troféus dos rankings finalizados (1º, 2º e 3º lugar).
  for (const t of memberTrophies(memberId)) out.push(trophyItem(t));
  return out;
}

/** O que ainda dá para conquistar (aparece trancado, com o quanto falta). */
function goalsOf(actor, have) {
  const goals = [];
  if (!have.has('ano-biblico')) goals.push({ kind: 'ano-biblico', title: 'Ano Bíblico', progress: `${bibleProgress(actor.id).done} de ${TOTAL_DAYS} dias lidos` });
  if (actor.kind === 'lideranca' && !have.has('bom-lider')) {
    const n = get('SELECT COUNT(*) n FROM bom_lider_progress WHERE member_id = ? AND completed_at IS NOT NULL', actor.id)?.n || 0;
    goals.push({ kind: 'bom-lider', title: 'Bom Líder: Manual Administrativo', progress: `${n} aulas concluídas` });
  }
  goals.push({ kind: 'trofeu', title: 'Certificado de honra', progress: 'Fique entre os 3 primeiros quando um ranking for finalizado' });
  return goals;
}

r.get('/me/certificados', member, (req, res) => {
  const list = listOf(req.actor.id);
  res.json({ list, goals: goalsOf(req.actor, new Set(list.map((c) => c.kind))) });
});

r.get('/me/certificados/:kind/:id', member, (req, res) => {
  const c = listOf(req.actor.id).find((x) => x.kind === req.params.kind && x.id === String(req.params.id));
  if (!c) fail(404, 'Certificado não encontrado');
  if (c.kind === 'trofeu') return res.json(trophyCertificate(int(c.id)));
  const m = get(`SELECT m.name, cl.name AS club_name, cl.logo AS club_logo, cl.director_name, cl.is_app FROM members m JOIN clubs cl ON cl.id = m.club_id WHERE m.id = ?`, req.actor.id);
  const what = c.kind === 'ano-biblico' ? 'concluiu o plano de leitura do' : 'concluiu o curso';
  res.json({ ...c, what, member_name: m.name, club_name: m.is_app ? null : m.club_name, club_logo: m.is_app ? null : m.club_logo, director_name: m.is_app ? null : m.director_name });
});

// Clube e unidade: os certificados de honra dos troféus (o clube vê os dele e os das suas unidades).
r.get('/certificados', requireAuth('club', 'unit'), (req, res) => {
  const a = req.actor;
  const units = a.type === 'unit' ? [a.id] : all('SELECT id FROM units WHERE club_id = ?', a.id).map((u) => u.id);
  const names = new Map(all(`SELECT id, name FROM units WHERE id IN (${units.map(() => '?').join(',') || 'NULL'})`, ...units).map((u) => [u.id, u.name]));
  const list = [
    ...(a.type === 'club' ? trophiesOf('club', [a.id]).map((t) => ({ ...trophyItem(t), who: 'Clube' })) : []),
    ...trophiesOf('unit', units).map((t) => ({ ...trophyItem(t), who: `Unidade ${names.get(t.target_id) || ''}`.trim() })),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));
  res.json({ list });
});

export default r;
