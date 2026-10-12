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
  // Ficha de saúde (modelo da Ficha de Saúde)
  plano_saude: 120, cartao_sus: 30, sangue_tipo: 10, sangue_rh: 10,
  // Assinaturas (nome e CPF de quem assina: o responsável, ou a própria pessoa se for maior)
  assinatura_nome: 120, assinatura_cpf: 14, med_assinatura_nome: 120, med_assinatura_cpf: 14,
};
const SIM_NAO = ['saude_profissional', 'responsavel_outro', 'doencas_ok', 'termo_medico'];

/** Doenças que a pessoa já teve (marcar as que teve). */
export const DOENCAS = ['Catapora', 'Meningite', 'Hepatite', 'Dengue', 'Pneumonia', 'Malária', 'Febre amarela', 'H1N1', 'Cólera',
  'Rubéola', 'Sarampo', 'Tétano', 'Varíola', 'Coqueluche', 'Difteria', 'Caxumba', 'Rinite', 'Bronquite'];

/** Perguntas de sim/não da ficha de saúde: [chave, pergunta, o que escrever se for "sim"]. */
export const MED_PERGUNTAS = [
  ['cardiaco', 'Tem problemas cardíacos?', 'Quais medicamentos usa?'],
  ['alergia_medicamento', 'Tem alergia a algum medicamento?', 'A quais medicamentos tem alergia?'],
  ['lactose', 'Tem intolerância à lactose?', 'Quais medicamentos usa?'],
  ['deficiencia', 'Tem alguma deficiência?', 'Qual deficiência?'],
  ['transfusao', 'Já recebeu transfusão de sangue?', null],
  ['alergia_pele', 'Tem alergia na pele?', 'Quais medicamentos usa?'],
  ['convulsao', 'Tem ou teve desmaio ou convulsão?', 'Quais medicamentos usa?'],
  ['psicologico', 'Tem algum problema psicológico?', 'Faz acompanhamento? Conte um pouco.'],
  ['alergia', 'Possui alguma outra alergia?', 'A quê? Quais medicamentos usa?'],
  ['diabetes', 'É diabético?', 'Quais medicamentos usa?'],
  ['ferimento', 'Teve algum ferimento grave recente?', null],
  ['fratura', 'Teve algum tipo de fratura recente?', 'Qual fratura?'],
  ['cirurgia', 'Já passou por cirurgias?', 'Quais cirurgias?'],
  ['internacao', 'Ficou internado nos últimos 5 anos?', 'Qual foi o motivo da internação?'],
];
export const SANGUE_TIPOS = ['A', 'B', 'O', 'AB', 'Não sei'];
export const SANGUE_RH = ['Positivo', 'Negativo', 'Não sei'];

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
  // Doenças: só as da lista. Perguntas: "sim"/"nao" e o texto quando for sim.
  const doencas = Array.isArray(body.doencas) ? body.doencas : String(body.doencas || '').split(',');
  data.doencas = DOENCAS.filter((d) => doencas.includes(d));
  for (const [k, , det] of MED_PERGUNTAS) {
    const v = body['q_' + k];
    if (v === 'sim' || v === 'nao') data['q_' + k] = v;
    if (v === 'sim' && det) {
      const t = str(body['q_' + k + '_det'], 500);
      if (t) data['q_' + k + '_det'] = t;
    }
  }
  if (data.med_assinatura_cpf) data.med_assinatura_cpf = data.med_assinatura_cpf.replace(/\D/g, '');
  if (data.sangue_tipo === 'Não sei') delete data.sangue_rh;
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
  need(f.doc_tipo === 'certidao' || (f.rg && f.rg_orgao), 'Informe o RG e o órgão expedidor');
  need(f.camiseta, 'Informe o tamanho da camiseta');
  need(age < 16 || f.estado_civil, 'Informe o estado civil');
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
  validateMedical(f, age);
}

/** Ficha de saúde: toda pergunta respondida e, quando for "sim", o porquê. */
export function validateMedical(f, age) {
  const need = (cond, msg) => { if (!cond) fail(400, msg); };
  need(f.doencas_ok, 'Ficha de saúde: marque as doenças que já teve (ou "nenhuma")');
  for (const [k, q, det] of MED_PERGUNTAS) {
    need(f['q_' + k], `Ficha de saúde: responda "${q}"`);
    if (det) need(f['q_' + k] !== 'sim' || f['q_' + k + '_det'], `Ficha de saúde: ${det.toLowerCase()}`);
  }
  need(SANGUE_TIPOS.includes(f.sangue_tipo), 'Ficha de saúde: informe o tipo sanguíneo (ou "não sei")');
  need(f.sangue_tipo === 'Não sei' || SANGUE_RH.includes(f.sangue_rh), 'Ficha de saúde: informe o fator RH');
  need(f.termo_medico, 'Ficha de saúde: confirme a declaração');
  need(f.med_assinatura_nome && f.med_assinatura_nome.split(/\s+/).length >= 2, age < 18 ? 'Ficha de saúde: o responsável precisa assinar' : 'Ficha de saúde: assine com o seu nome completo');
  need(cleanCpf(f.med_assinatura_cpf), 'Ficha de saúde: informe o CPF de quem assina');
}

/** A ficha está completa? (cadastro + saúde). Sem ficha completa, o membro aparece com "dados incompletos". */
export function fichaCompleta(ficha, birthDate) {
  try {
    validateSignup(ficha, birthDate);
    return true;
  } catch {
    return false;
  }
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
