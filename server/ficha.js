// Ficha do membro (modelo do Registro de Membro): cadastro, documentos, pais e
// responsável, profissional de saúde, ficha médica e termos assinados.
// Fica guardada só no Sistema do Clã: o Administrador Geral não tem acesso.
import { get, run } from './db.js';
import { str, bool, cleanCpf, fail, ageFrom } from './util.js';

/** Campos de texto aceitos na ficha (chave → tamanho máximo). */
export const FICHA_CAMPOS = {
  // Cadastro
  sexo: 20, sexo_outro: 60, whatsapp: 30,
  endereco: 200, numero: 20, bairro: 80, cidade: 80, uf: 2, cep: 12, referencia: 200,
  // Documentos: RG e CPF, ou certidão de nascimento
  doc_tipo: 20, rg: 30, rg_orgao: 30, certidao: 60,
  // Profissional de saúde (16 anos ou mais)
  saude_area: 40, saude_area_outro: 60, saude_registro: 60,
  // Pais e responsável legal (menores de 18)
  pai_nome: 120, pai_whatsapp: 30, mae_nome: 120, mae_whatsapp: 30,
  responsavel_nome: 120, responsavel_whatsapp: 30,
  // Outros
  camiseta: 10, estado_civil: 20,
  // Ficha médica
  tipo_sanguineo: 10, alergias: 500, medicamentos: 500, doencas: 500, restricoes_alimentares: 300, deficiencias: 300,
  plano_saude: 120, cartao_sus: 30, contato_emergencia_nome: 120, contato_emergencia_telefone: 30, observacoes_medicas: 800,
  // Assinatura (nome e CPF de quem assina: o responsável, ou a própria pessoa se for maior)
  assinatura_nome: 120, assinatura_cpf: 14,
};
const SIM_NAO = ['saude_profissional', 'responsavel_outro'];

/** Termos aceitos na inscrição. */
export const TERMOS = ['termo_imagem', 'termo_responsabilidade', 'termo_dados'];

export const SEXOS = ['Feminino', 'Masculino', 'Outro'];
export const AREAS_SAUDE = ['Dentista', 'Enfermeiro', 'Fisioterapeuta', 'Médico', 'Socorrista', 'Téc. de Enfermagem', 'Outro'];
export const ESTADOS_CIVIS = ['Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'Não informado'];

/** Limpa os dados recebidos: só os campos conhecidos, com tamanho limitado. */
export function cleanFicha(body = {}) {
  const data = {};
  for (const [k, max] of Object.entries(FICHA_CAMPOS)) {
    const v = str(body[k], max);
    if (v) data[k] = v;
  }
  for (const k of [...SIM_NAO, ...TERMOS]) data[k] = bool(body[k]);
  if (data.assinatura_cpf) data.assinatura_cpf = data.assinatura_cpf.replace(/\D/g, '');
  if (data.uf) data.uf = data.uf.toUpperCase();
  if (data.sexo !== 'Outro') delete data.sexo_outro;
  if (!data.saude_profissional) { delete data.saude_area; delete data.saude_area_outro; delete data.saude_registro; }
  if (data.saude_area !== 'Outro') delete data.saude_area_outro;
  if (!data.responsavel_outro) { delete data.responsavel_nome; delete data.responsavel_whatsapp; }
  if (data.doc_tipo !== 'certidao') { data.doc_tipo = 'rg_cpf'; delete data.certidao; }
  return data;
}

/**
 * Confere a ficha da inscrição. A idade decide o que aparece:
 * menor de 18 → pais/responsável e assinatura do responsável; 16+ → profissional de saúde.
 */
export function validateSignup(f, birthDate) {
  const age = ageFrom(birthDate);
  const need = (cond, msg) => { if (!cond) fail(400, msg); };
  need(SEXOS.includes(f.sexo), 'Informe o sexo');
  need(f.sexo !== 'Outro' || f.sexo_outro, 'Escreva como você se identifica');
  need(f.whatsapp, 'Informe o WhatsApp');
  need(f.endereco && f.numero && f.bairro && f.cidade && f.uf, 'Preencha o endereço: rua, número, bairro, cidade e estado');
  if (age >= 16 && f.saude_profissional) {
    need(AREAS_SAUDE.includes(f.saude_area), 'Escolha a sua área na saúde');
    need(f.saude_area !== 'Outro' || f.saude_area_outro, 'Escreva a sua área na saúde');
  }
  if (age < 18) {
    need(f.pai_nome || f.mae_nome || f.responsavel_outro, 'Informe o nome do pai, da mãe ou do responsável legal');
    need(!f.pai_nome || f.pai_whatsapp, 'Informe o WhatsApp do pai');
    need(!f.mae_nome || f.mae_whatsapp, 'Informe o WhatsApp da mãe');
    need(!f.responsavel_outro || (f.responsavel_nome && f.responsavel_whatsapp), 'Informe o nome e o WhatsApp do responsável legal');
  }
  need(TERMOS.every((t) => f[t]), 'É preciso aceitar os termos');
  need(f.assinatura_nome && f.assinatura_nome.split(/\s+/).length >= 2, age < 18 ? 'O responsável precisa assinar com o nome completo' : 'Assine com o seu nome completo');
  need(cleanCpf(f.assinatura_cpf), age < 18 ? 'Informe o CPF do responsável' : 'Informe o seu CPF na assinatura');
}

export function getFicha(memberId) {
  const row = get('SELECT data, terms_accepted_at, updated_at FROM member_records WHERE member_id = ?', memberId);
  return { ...(row ? JSON.parse(row.data) : {}), terms_accepted_at: row?.terms_accepted_at || null, updated_at: row?.updated_at || null };
}

export function saveFicha(memberId, data, { acceptTerms = false } = {}) {
  const now = new Date().toISOString();
  const prev = get('SELECT data, terms_accepted_at FROM member_records WHERE member_id = ?', memberId);
  // Data, local e assinatura da inscrição não mudam quando o clã corrige a ficha.
  const kept = prev ? JSON.parse(prev.data) : {};
  for (const k of ['data_inscricao', 'local_inscricao']) if (kept[k] && !data[k]) data[k] = kept[k];
  const accepted = acceptTerms ? now : prev?.terms_accepted_at || null;
  run(`INSERT INTO member_records (member_id, data, terms_accepted_at, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(member_id) DO UPDATE SET data = excluded.data, terms_accepted_at = excluded.terms_accepted_at, updated_at = excluded.updated_at`,
  memberId, JSON.stringify(data), accepted, now);
}

/**
 * Documento que identifica a pessoa em todo o app (um clã por pessoa):
 * o CPF, ou o número da certidão de nascimento para quem ainda não tem CPF.
 */
export function checkIdentity({ cpf: rawCpf, certidao: rawCert }, selfId = null) {
  const cpf = rawCpf ? cleanCpf(rawCpf) : null;
  if (rawCpf && String(rawCpf).replace(/\D/g, '') && !cpf) fail(400, 'CPF inválido');
  const certidao = String(rawCert || '').replace(/[^\dA-Za-z]/g, '').slice(0, 60) || null;
  if (!cpf && !certidao) fail(400, 'Informe o CPF ou o número da certidão de nascimento');
  if (certidao && certidao.length < 6) fail(400, 'Número da certidão de nascimento inválido');
  const taken = (col, v) => {
    const other = v && get(`SELECT id FROM members WHERE ${col} = ?`, v);
    if (other && other.id !== selfId) fail(409, `Este ${col === 'cpf' ? 'CPF' : 'número de certidão'} já está cadastrado em um clã. Para trazer a pessoa, peça a transferência.`);
  };
  taken('cpf', cpf);
  taken('birth_cert', certidao);
  return { cpf, certidao };
}
