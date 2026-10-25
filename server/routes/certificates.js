// Certificados (área Downloads do membro): o app gera sozinho quando o membro conclui o Ano Bíblico,
// o Bom Líder (Manual Administrativo), uma classe, uma especialidade ou um curso. A página do
// certificado tem o botão de imprimir / salvar em PDF.
import { Router } from 'express';
import { all, get } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int } from '../util.js';
import { TOTAL_DAYS } from '../bible.js';
import { bomLiderFinished } from './bomLider.js';
import { memberTrophies, trophyCertificate } from '../rankFinals.js';

const r = Router();
const member = requireAuth('member');
const TYPE = { classe: 'Classe', especialidade: 'Especialidade', curso: 'Curso' };

function bibleFinished(memberId) {
  const b = get('SELECT COUNT(*) n, MAX(completed_at) at FROM bible_progress WHERE member_id = ? AND completed_at IS NOT NULL', memberId);
  return b.n >= TOTAL_DAYS ? b.at : null;
}

function listOf(memberId) {
  const out = [];
  const bible = bibleFinished(memberId);
  if (bible) out.push({ kind: 'ano-biblico', id: '1', title: 'Ano Bíblico', subtitle: 'Leu a Bíblia toda no plano do Ano Bíblico', date: bible });
  const bl = bomLiderFinished(memberId);
  if (bl) out.push({ kind: 'bom-lider', id: 'manual', title: 'Bom Líder: Manual Administrativo', subtitle: 'Concluiu todas as aulas', date: bl });
  for (const a of all(`SELECT ct.id, ct.name, ct.type, a.date FROM achievements a JOIN content ct ON ct.id = a.content_id
      WHERE a.member_id = ? AND ct.type IN ('classe','especialidade','curso') ORDER BY ct.type, ct.name`, memberId)) {
    out.push({ kind: 'conteudo', id: String(a.id), title: a.name, subtitle: TYPE[a.type], type: a.type, date: a.date });
  }
  // Troféus dos rankings finalizados (1º, 2º e 3º lugar).
  for (const t of memberTrophies(memberId)) out.push({ kind: 'trofeu', id: String(t.id), title: `${t.place}º lugar · ${t.name}`, subtitle: `Troféu do ranking · ${t.year}`, date: t.awarded_at });
  return out;
}

r.get('/me/certificados', member, (req, res) => res.json(listOf(req.actor.id)));

r.get('/me/certificados/:kind/:id', member, (req, res) => {
  const c = listOf(req.actor.id).find((x) => x.kind === req.params.kind && x.id === String(req.params.id));
  if (!c) fail(404, 'Certificado não encontrado');
  if (c.kind === 'trofeu') return res.json(trophyCertificate(int(c.id)));
  const m = get(`SELECT m.name, cl.name AS club_name, cl.logo AS club_logo, cl.director_name, cl.is_app FROM members m JOIN clubs cl ON cl.id = m.club_id WHERE m.id = ?`, req.actor.id);
  const what = c.kind === 'ano-biblico' ? 'concluiu o plano de leitura do' : c.kind === 'bom-lider' ? 'concluiu o curso' : c.type === 'classe' ? 'concluiu a classe' : c.type === 'curso' ? 'concluiu o curso' : 'concluiu a especialidade';
  res.json({ ...c, what, member_name: m.name, club_name: m.is_app ? null : m.club_name, club_logo: m.is_app ? null : m.club_logo, director_name: m.is_app ? null : m.director_name, content_id: c.kind === 'conteudo' ? int(c.id) : null });
});

export default r;
