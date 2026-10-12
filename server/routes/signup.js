// Inscrição pelo link do clã (/inscricao/CODIGO): a própria pessoa (ou o responsável)
// preenche a ficha de cadastro, a ficha médica e aceita os termos. O membro entra
// como "pendente" e só acessa o app depois que o clã aprovar.
import { Router } from 'express';
import { get, run, tx } from '../db.js';
import { setLogin } from '../auth.js';
import { CARGO_PADRAO } from '../config.js';
import { fail, str, validDate, memberKind, newMemberCode } from '../util.js';
import { checkIdentity, cleanFicha, saveFicha, validateSignup } from '../ficha.js';

const r = Router();

const clubByCode = (code) => get(
  `SELECT c.id, c.name, c.logo, c.code, d.name AS district_name FROM clubs c JOIN districts d ON d.id = c.district_id WHERE c.code = ?`,
  String(code || '').padStart(4, '0'),
);

// Poucas inscrições por IP por hora, para evitar abuso do formulário público.
const LIMITE = 10;
const janela = new Map();
setInterval(() => janela.clear(), 60 * 60 * 1000).unref();

r.get('/public/inscricao/:code', (req, res) => {
  const c = clubByCode(req.params.code);
  if (!c) fail(404, 'Clã não encontrado. Confira o link com a diretoria.');
  res.json(c);
});

r.post('/public/inscricao/:code', (req, res) => {
  const c = clubByCode(req.params.code);
  if (!c) fail(404, 'Clã não encontrado. Confira o link com a diretoria.');
  const n = (janela.get(req.ip) || 0) + 1;
  janela.set(req.ip, n);
  if (n > LIMITE) fail(429, 'Muitas inscrições seguidas. Tente de novo mais tarde.');

  const b = req.body || {};
  const name = str(b.name, 120);
  if (name.split(/\s+/).length < 2) fail(400, 'Informe o nome completo');
  if (!validDate(b.birth_date)) fail(400, 'Informe a data de nascimento');
  const kind = memberKind(b.birth_date);
  if (!kind) fail(400, 'É preciso ter pelo menos 10 anos');
  const ficha = cleanFicha(b);
  const { cpf, certidao } = checkIdentity({ cpf: ficha.doc_tipo === 'certidao' ? b.cpf || null : b.cpf, certidao: ficha.doc_tipo === 'certidao' ? ficha.certidao : null });
  if (ficha.doc_tipo !== 'certidao' && !cpf) fail(400, 'Informe o CPF');
  validateSignup(ficha, b.birth_date);
  if (String(b.password || '').length < 6) fail(400, 'Crie uma senha com pelo menos 6 caracteres');
  // Data e local da ficha: o dia da inscrição e o clã, pelo sistema online.
  ficha.data_inscricao = new Date().toISOString().slice(0, 10);
  ficha.local_inscricao = `${c.name} — sistema online`;

  const out = tx(() => {
    const code = newMemberCode();
    const id = Number(run(
      `INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, cpf, birth_cert, status) VALUES (?,?,?,?,?,?,?,?,'pendente')`,
      c.id, null, name, b.birth_date, CARGO_PADRAO[kind], code, cpf, certidao,
    ).lastInsertRowid);
    setLogin('member', id, code, b.password);
    saveFicha(id, ficha, { acceptTerms: true });
    return { code };
  });
  res.json({ ...out, club_name: c.name });
});

export default r;
