// Ficha do membro: cadastro, ficha médica e termos assinados pelo responsável.
// Fica separada da tabela de membros e só o próprio clã (e o Administrador Geral) vê.
import { get, run } from './db.js';
import { str, bool, cleanCpf, fail } from './util.js';

/** Campos de texto aceitos na ficha (chave → tamanho máximo). */
export const FICHA_CAMPOS = {
  // Cadastro
  sexo: 20, telefone: 30, email: 120, endereco: 200, bairro: 80, cidade: 80, uf: 2, cep: 12, escola: 120, igreja: 120,
  responsavel_nome: 120, responsavel_cpf: 14, responsavel_parentesco: 40, responsavel_telefone: 30, responsavel_email: 120,
  // Ficha médica
  tipo_sanguineo: 5, alergias: 500, medicamentos: 500, doencas: 500, restricoes_alimentares: 300, deficiencias: 300,
  plano_saude: 120, cartao_sus: 30, contato_emergencia_nome: 120, contato_emergencia_telefone: 30, observacoes_medicas: 800,
};

/** Termos que o responsável aceita na inscrição. */
export const TERMOS = ['termo_imagem', 'termo_responsabilidade', 'termo_dados'];

/** Limpa os dados recebidos: só os campos conhecidos, com tamanho limitado. */
export function cleanFicha(body = {}) {
  const data = {};
  for (const [k, max] of Object.entries(FICHA_CAMPOS)) {
    const v = str(body[k], max);
    if (v) data[k] = v;
  }
  if (data.responsavel_cpf) data.responsavel_cpf = cleanCpf(data.responsavel_cpf) || data.responsavel_cpf.replace(/\D/g, '');
  if (data.uf) data.uf = data.uf.toUpperCase();
  for (const t of TERMOS) data[t] = bool(body[t]);
  return data;
}

export function getFicha(memberId) {
  const row = get('SELECT data, terms_accepted_at, updated_at FROM member_records WHERE member_id = ?', memberId);
  return { ...(row ? JSON.parse(row.data) : {}), terms_accepted_at: row?.terms_accepted_at || null, updated_at: row?.updated_at || null };
}

export function saveFicha(memberId, data, { acceptTerms = false } = {}) {
  const now = new Date().toISOString();
  const prev = get('SELECT terms_accepted_at FROM member_records WHERE member_id = ?', memberId);
  const accepted = acceptTerms ? now : prev?.terms_accepted_at || null;
  run(`INSERT INTO member_records (member_id, data, terms_accepted_at, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(member_id) DO UPDATE SET data = excluded.data, terms_accepted_at = excluded.terms_accepted_at, updated_at = excluded.updated_at`,
  memberId, JSON.stringify(data), accepted, now);
}

/** CPF obrigatório e único: cada pessoa está em um clã só. */
export function checkCpf(raw, selfId = null) {
  const cpf = cleanCpf(raw);
  if (!cpf) fail(400, 'Informe um CPF válido');
  const other = get('SELECT id FROM members WHERE cpf = ?', cpf);
  if (other && other.id !== selfId) fail(409, 'Este CPF já está cadastrado em um clã. Para trazer a pessoa, peça a transferência.');
  return cpf;
}
