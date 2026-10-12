// Termo assinado pelo responsável: cada membro cadastrado pelo clã tem o seu link
// (/termo/TOKEN). O responsável lê os termos e assina digitalmente (nome + CPF).
// Assinou, o membro fica ativo e o link deixa de valer.
import { Router } from 'express';
import { get, run, tx } from '../db.js';
import { ageFrom, fail, str } from '../util.js';
import { getFicha, saveFicha, validateSignature, TERMOS } from '../ficha.js';
import { refreshStatus } from '../memberStatus.js';

const r = Router();

const load = (token) => {
  const m = token && get(
    `SELECT m.id, m.name, m.birth_date, m.status, c.name AS club_name, c.logo AS club_logo
     FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.terms_token = ?`,
    String(token),
  );
  if (!m) fail(404, 'Este link de termo não existe ou já foi assinado.');
  return m;
};

r.get('/public/termo/:token', (req, res) => {
  const m = load(req.params.token);
  const age = ageFrom(m.birth_date);
  res.json({ name: m.name, club_name: m.club_name, club_logo: m.club_logo, age, minor: age < 18 });
});

r.post('/public/termo/:token', (req, res) => {
  const m = load(req.params.token);
  const b = req.body || {};
  const sign = {
    assinatura_nome: str(b.assinatura_nome, 120), assinatura_cpf: String(b.assinatura_cpf || '').replace(/\D/g, ''),
    termo_medico: !!b.termo_medico, ...Object.fromEntries(TERMOS.map((t) => [t, !!b[t]])),
  };
  // A mesma assinatura vale para a ficha de cadastro e para a ficha de saúde.
  sign.med_assinatura_nome = sign.assinatura_nome;
  sign.med_assinatura_cpf = sign.assinatura_cpf;
  validateSignature(sign, ageFrom(m.birth_date));
  tx(() => {
    const { terms_accepted_at: _a, updated_at: _u, ...ficha } = getFicha(m.id);
    saveFicha(m.id, { ...ficha, ...sign, termo_assinado_por_link: true }, { acceptTerms: true });
    run('UPDATE members SET terms_token = NULL WHERE id = ?', m.id);
    refreshStatus(m.id); // só fica ativo depois da taxa paga
  });
  res.json({ ok: true, name: m.name, club_name: m.club_name });
});

export default r;
