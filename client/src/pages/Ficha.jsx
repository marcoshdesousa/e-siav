import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, HeartPulse } from 'lucide-react';
import { Button, Field } from '../ui.jsx';
import { fmtCpf } from '../format.js';

/** Termos aceitos na inscrição. */
export const TERMOS = [
  ['termo_imagem', 'Autorizo o uso de imagem (fotos e vídeos) nas atividades e divulgações do clã.'],
  ['termo_responsabilidade', 'Autorizo a participação nas atividades do clã (reuniões, acampamentos e eventos) e confirmo que as informações da ficha médica são verdadeiras.'],
  ['termo_dados', 'Concordo que estes dados fiquem guardados no sistema do clã, só para cadastro, segurança e atendimento médico, como manda a LGPD.'],
];

const SEXOS = ['Feminino', 'Masculino', 'Outro'];
const AREAS_SAUDE = ['Dentista', 'Enfermeiro', 'Fisioterapeuta', 'Médico', 'Socorrista', 'Téc. de Enfermagem', 'Outro'];
const ESTADOS_CIVIS = ['Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'Não informado'];
const CAMISETAS = ['2', '4', '6', '8', '10', '12', '14', '16', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Botões de escolha (sim/não, sexo...). */
function Choice({ options, value, onChange, disabled }) {
  return (
    <div className="seg seg-wrap">
      {options.map(([k, l]) => (
        <button key={String(k)} type="button" disabled={disabled} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

/**
 * Ficha de cadastro (modelo do Registro de Membro).
 * A idade decide o que aparece: menor de 18 → pais e responsável; 16+ → profissional de saúde.
 */
export default function FichaForm({ value: f, onChange, age = null, readOnly = false }) {
  const set = (k) => (v) => onChange({ ...f, [k]: v });
  const input = (k, props = {}) => (
    <input value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly} {...props} />
  );
  const select = (k, list, empty = '—') => (
    <select value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly}>
      <option value="">{empty}</option>
      {list.map((x) => <option key={x}>{x}</option>)}
    </select>
  );
  const minor = age != null && age < 18;
  return (
    <div className="form">
      <h3 className="ficha-title">Ficha de cadastro</h3>
      <Field group label="Sexo">
        <Choice options={SEXOS.map((s) => [s, s])} value={f.sexo} onChange={set('sexo')} disabled={readOnly} />
      </Field>
      {f.sexo === 'Outro' && <Field label="Como você se identifica?">{input('sexo_outro')}</Field>}
      <Field label="WhatsApp" hint="Se o explorador não tiver WhatsApp, coloque o do responsável.">{input('whatsapp', { inputMode: 'tel', placeholder: '(00) 00000-0000' })}</Field>

      <div className="grid-addr">
        <Field label="Endereço">{input('endereco', { placeholder: 'Rua, avenida...' })}</Field>
        <Field label="Nº">{input('numero')}</Field>
      </div>
      <Field label="Bairro">{input('bairro')}</Field>
      <div className="grid-addr">
        <Field label="Cidade">{input('cidade')}</Field>
        <Field label="Estado">{select('uf', UFS, 'UF')}</Field>
      </div>
      <div className="grid2">
        <Field label="CEP" hint="Se não souber, pode deixar em branco">{input('cep', { inputMode: 'numeric' })}</Field>
        <Field label="Referência" hint="Opcional">{input('referencia', { placeholder: 'Perto de...' })}</Field>
      </div>

      {f.doc_tipo !== 'certidao' && (
        <div className="grid2">
          <Field label="RG">{input('rg')}</Field>
          <Field label="Órgão expedidor">{input('rg_orgao', { placeholder: 'SSP/PE' })}</Field>
        </div>
      )}

      {age != null && age >= 16 && (
        <>
          <Field group label="Você é profissional de saúde?">
            <Choice options={[[true, 'Sim'], [false, 'Não']]} value={!!f.saude_profissional} onChange={set('saude_profissional')} disabled={readOnly} />
          </Field>
          {f.saude_profissional && (
            <>
              <Field group label="Área">
                <Choice options={AREAS_SAUDE.map((s) => [s, s])} value={f.saude_area} onChange={set('saude_area')} disabled={readOnly} />
              </Field>
              {f.saude_area === 'Outro' && <Field label="Qual área?">{input('saude_area_outro')}</Field>}
              <Field label="Doc. profissional" hint="Ex.: CRM, COREN, CRO">{input('saude_registro')}</Field>
            </>
          )}
        </>
      )}

      {minor && (
        <>
          <h3 className="ficha-title">Pais</h3>
          <p className="muted small" style={{ margin: 0 }}>O WhatsApp do pai e da mãe pode ser o mesmo.</p>
          <div className="grid2">
            <Field label="Nome do pai">{input('pai_nome')}</Field>
            <Field label="WhatsApp do pai">{input('pai_whatsapp', { inputMode: 'tel' })}</Field>
          </div>
          <div className="grid2">
            <Field label="Nome da mãe">{input('mae_nome')}</Field>
            <Field label="WhatsApp da mãe">{input('mae_whatsapp', { inputMode: 'tel' })}</Field>
          </div>
          <Field group label="O responsável legal é outra pessoa?" hint="Marque Sim se não tiver pai ou mãe, ou se outra pessoa for a responsável.">
            <Choice options={[[true, 'Sim'], [false, 'Não']]} value={!!f.responsavel_outro} onChange={set('responsavel_outro')} disabled={readOnly} />
          </Field>
          {f.responsavel_outro && (
            <div className="grid2">
              <Field label="Nome do responsável legal">{input('responsavel_nome')}</Field>
              <Field label="WhatsApp do responsável" hint="Pode ser o mesmo do pai ou da mãe">{input('responsavel_whatsapp', { inputMode: 'tel' })}</Field>
            </div>
          )}
        </>
      )}

      <div className="grid2">
        <Field label="Tamanho da camiseta">{select('camiseta', CAMISETAS)}</Field>
        {age != null && age >= 16 && <Field label="Estado civil">{select('estado_civil', ESTADOS_CIVIS)}</Field>}
      </div>

    </div>
  );
}

/** Termos + assinatura (nome e CPF de quem assina). */
export function TermosAssinatura({ value: f, onChange, minor }) {
  return (
    <div className="form">
      <h3 className="ficha-title">Termos {minor ? '(o responsável aceita)' : ''}</h3>
      <div className="stack" style={{ gap: '.5rem' }}>
        {TERMOS.map(([k, text]) => (
          <label key={k} className="check termo"><input type="checkbox" checked={!!f[k]} onChange={(e) => onChange({ ...f, [k]: e.target.checked })} /> {text}</label>
        ))}
      </div>
      <p className="declaracao">Me responsabilizo por todas as informações desta Ficha de Cadastro, e garanto como fiel e verdadeiro.</p>
      <div className="grid2">
        <Field label={minor ? 'Assinatura do responsável (nome completo)' : 'Assinatura (seu nome completo)'}>
          <input value={f.assinatura_nome || ''} onChange={(e) => onChange({ ...f, assinatura_nome: e.target.value })} />
        </Field>
        <Field label={minor ? 'CPF do responsável' : 'Seu CPF'}>
          <input value={fmtCpf(f.assinatura_cpf)} onChange={(e) => onChange({ ...f, assinatura_cpf: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="000.000.000-00" />
        </Field>
      </div>
    </div>
  );
}

/** Documento: RG e CPF, ou certidão de nascimento. */
export function DocFields({ value: f, onChange, cpf, onCpf }) {
  return (
    <>
      <Field group label="Documento">
        <Choice options={[['rg_cpf', 'RG e CPF'], ['certidao', 'Certidão de nascimento']]} value={f.doc_tipo === 'certidao' ? 'certidao' : 'rg_cpf'} onChange={(v) => onChange({ ...f, doc_tipo: v })} />
      </Field>
      {f.doc_tipo === 'certidao' ? (
        <Field label="Número da certidão de nascimento" hint="A matrícula de 32 números (modelo novo) ou nº da ordem/folha/livro (modelo antigo)">
          <input value={f.certidao || ''} onChange={(e) => onChange({ ...f, certidao: e.target.value })} />
        </Field>
      ) : (
        <Field label="CPF"><input value={cpf} onChange={(e) => onCpf(fmtCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" /></Field>
      )}
    </>
  );
}

// ---------- Ficha de saúde ----------
export const DOENCAS = ['Catapora', 'Meningite', 'Hepatite', 'Dengue', 'Pneumonia', 'Malária', 'Febre amarela', 'H1N1', 'Cólera',
  'Rubéola', 'Sarampo', 'Tétano', 'Varíola', 'Coqueluche', 'Difteria', 'Caxumba', 'Rinite', 'Bronquite'];

/** [chave, pergunta, o que escrever se for "sim"] — igual ao servidor. */
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
const SANGUE_TIPOS = ['A', 'B', 'O', 'AB', 'Não sei'];
const SANGUE_RH = ['Positivo', 'Negativo', 'Não sei'];

/** O que falta na ficha de saúde (vazio = completa). */
export function saudeFaltando(f) {
  const out = [];
  if (!f.doencas_ok) out.push('doenças');
  for (const [k, q, det] of MED_PERGUNTAS) {
    if (!f['q_' + k]) out.push(q);
    else if (f['q_' + k] === 'sim' && det && !f['q_' + k + '_det']) out.push(det);
  }
  if (!SANGUE_TIPOS.includes(f.sangue_tipo) || (f.sangue_tipo !== 'Não sei' && !f.sangue_rh)) out.push('tipo sanguíneo');
  return out;
}

function YesNo({ value, onChange }) {
  return (
    <div className="quiz-yn">
      <button type="button" className={value === 'sim' ? 'on yes' : ''} onClick={() => onChange('sim')}><Check size={18} /> Sim</button>
      <button type="button" className={value === 'nao' ? 'on no' : ''} onClick={() => onChange('nao')}>Não</button>
    </div>
  );
}

/** Uma pergunta da ficha de saúde (sim/não e, se sim, o porquê). */
function Pergunta({ f, onChange, k, q, det, autoFocus }) {
  const v = f['q_' + k];
  return (
    <div className="quiz-q">
      <h3>{q}</h3>
      <YesNo value={v} onChange={(x) => onChange({ ...f, ['q_' + k]: x })} />
      {v === 'sim' && det && (
        <Field label={det}>
          <textarea autoFocus={autoFocus} value={f['q_' + k + '_det'] || ''} onChange={(e) => onChange({ ...f, ['q_' + k + '_det']: e.target.value })} style={{ minHeight: 70 }} />
        </Field>
      )}
    </div>
  );
}

function Doencas({ f, onChange }) {
  const list = f.doencas || [];
  const toggle = (d) => onChange({ ...f, doencas_ok: true, doencas: list.includes(d) ? list.filter((x) => x !== d) : [...list, d] });
  return (
    <div className="quiz-q">
      <h3>Quais destas doenças já teve?</h3>
      <p className="muted small">Toque em todas as que já teve. Se não teve nenhuma, toque em "Nenhuma".</p>
      <div className="quiz-chips">
        {DOENCAS.map((d) => <button key={d} type="button" className={list.includes(d) ? 'on' : ''} onClick={() => toggle(d)}>{d}</button>)}
      </div>
      <button type="button" className={'quiz-none' + (f.doencas_ok && !list.length ? ' on' : '')} onClick={() => onChange({ ...f, doencas_ok: true, doencas: [] })}>Nenhuma dessas</button>
    </div>
  );
}

function Sangue({ f, onChange }) {
  return (
    <div className="quiz-q">
      <h3>Tipo sanguíneo</h3>
      <div className="quiz-chips">
        {SANGUE_TIPOS.map((t) => <button key={t} type="button" className={f.sangue_tipo === t ? 'on' : ''} onClick={() => onChange({ ...f, sangue_tipo: t })}>{t}</button>)}
      </div>
      {f.sangue_tipo && f.sangue_tipo !== 'Não sei' && (
        <>
          <h3 style={{ marginTop: '1rem' }}>Fator RH</h3>
          <div className="quiz-chips">
            {SANGUE_RH.map((t) => <button key={t} type="button" className={f.sangue_rh === t ? 'on' : ''} onClick={() => onChange({ ...f, sangue_rh: t })}>{t}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Ficha de saúde em formato de quiz: uma pergunta por vez, com Sim/Não.
 * Quando é "sim", aparece a caixinha para explicar. No fim: plano de saúde e SUS.
 */
export function SaudeQuiz({ value: f, onChange, onDone }) {
  const steps = [
    { key: 'doencas', ok: f.doencas_ok, render: () => <Doencas f={f} onChange={onChange} /> },
    ...MED_PERGUNTAS.map(([k, q, det]) => ({
      key: k, ok: !!f['q_' + k] && !(f['q_' + k] === 'sim' && det && !f['q_' + k + '_det']),
      render: () => <Pergunta f={f} onChange={onChange} k={k} q={q} det={det} autoFocus />,
    })),
    { key: 'sangue', ok: SANGUE_TIPOS.includes(f.sangue_tipo) && (f.sangue_tipo === 'Não sei' || !!f.sangue_rh), render: () => <Sangue f={f} onChange={onChange} /> },
    {
      key: 'plano', ok: true,
      render: () => (
        <div className="quiz-q">
          <h3>Plano de saúde e SUS</h3>
          <Field label="Plano de saúde" hint="Nome do plano e número da carteirinha (se tiver)"><input value={f.plano_saude || ''} onChange={(e) => onChange({ ...f, plano_saude: e.target.value })} /></Field>
          <Field label="Nº do cartão do SUS" hint="Se tiver"><input value={f.cartao_sus || ''} onChange={(e) => onChange({ ...f, cartao_sus: e.target.value })} inputMode="numeric" /></Field>
        </div>
      ),
    },
  ];
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="ico"><HeartPulse size={16} /> Ficha de saúde</span>
        <span className="muted small">{i + 1} de {steps.length}</span>
      </div>
      <div className="progress"><span style={{ width: ((i + 1) / steps.length) * 100 + '%' }} /></div>
      <div key={step.key} className="quiz-step">{step.render()}</div>
      <div className="row between mt">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft size={16} /> Voltar</Button>
        <Button disabled={!step.ok} onClick={() => (last ? onDone() : setI(i + 1))}>{last ? 'Concluir' : 'Próxima'} {!last && <ArrowRight size={16} />}</Button>
      </div>
    </div>
  );
}

/** Ficha de saúde inteira numa página (o clã confere e corrige). */
export function SaudeLista({ value: f, onChange }) {
  return (
    <div className="form">
      <h3 className="ficha-title">Ficha de saúde</h3>
      <Doencas f={f} onChange={onChange} />
      {MED_PERGUNTAS.map(([k, q, det]) => <Pergunta key={k} f={f} onChange={onChange} k={k} q={q} det={det} />)}
      <Sangue f={f} onChange={onChange} />
      <div className="grid2">
        <Field label="Plano de saúde"><input value={f.plano_saude || ''} onChange={(e) => onChange({ ...f, plano_saude: e.target.value })} /></Field>
        <Field label="Nº do cartão do SUS"><input value={f.cartao_sus || ''} onChange={(e) => onChange({ ...f, cartao_sus: e.target.value })} /></Field>
      </div>
    </div>
  );
}

/** Declaração e assinatura da ficha de saúde. */
export function SaudeAssinatura({ value: f, onChange, minor }) {
  return (
    <div className="form">
      <label className="check termo"><input type="checkbox" checked={!!f.termo_medico} onChange={(e) => onChange({ ...f, termo_medico: e.target.checked })} />
        Me responsabilizo por todas as informações desta Ficha de Saúde, e garanto que nenhuma outra informação foi omitida, que pode vir a prejudicar o membro e o clã, em caso de um atendimento médico de emergência.</label>
      <div className="grid2">
        <Field label={minor ? 'Assinatura do responsável (nome completo)' : 'Assinatura (seu nome completo)'}>
          <input value={f.med_assinatura_nome || ''} onChange={(e) => onChange({ ...f, med_assinatura_nome: e.target.value })} />
        </Field>
        <Field label={minor ? 'CPF do responsável' : 'Seu CPF'}>
          <input value={fmtCpf(f.med_assinatura_cpf)} onChange={(e) => onChange({ ...f, med_assinatura_cpf: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="000.000.000-00" />
        </Field>
      </div>
    </div>
  );
}

/** O que falta na parte 1 (cadastro) — mesmas regras do servidor. */
export function cadastroFaltando({ name, age, cpf, password, password2, needPassword = true }, f) {
  const minor = age != null && age < 18;
  return [
    (name || '').trim().split(/\s+/).length < 2 && 'nome completo',
    !(age >= 10) && 'data de nascimento',
    (f.doc_tipo === 'certidao' ? (f.certidao || '').length < 6 : (cpf || '').replace(/\D/g, '').length !== 11 || !f.rg || !f.rg_orgao) && 'documento',
    (!f.sexo || (f.sexo === 'Outro' && !f.sexo_outro)) && 'sexo',
    !f.whatsapp && 'WhatsApp',
    !(f.endereco && f.numero && f.bairro && f.cidade && f.uf) && 'endereço',
    age >= 16 && f.saude_profissional && (!f.saude_area || (f.saude_area === 'Outro' && !f.saude_area_outro)) && 'área da saúde',
    minor && !(f.pai_nome || f.mae_nome || f.responsavel_outro) && 'pai, mãe ou responsável',
    minor && ((f.pai_nome && !f.pai_whatsapp) || (f.mae_nome && !f.mae_whatsapp) || (f.responsavel_outro && !(f.responsavel_nome && f.responsavel_whatsapp))) && 'WhatsApp dos pais/responsável',
    !f.camiseta && 'camiseta',
    age >= 16 && !f.estado_civil && 'estado civil',
    !TERMOS.every(([k]) => f[k]) && 'termos',
    !((f.assinatura_nome || '').trim().split(/\s+/).length >= 2 && (f.assinatura_cpf || '').length === 11) && 'assinatura',
    needPassword && !((password || '').length >= 6 && password === password2) && 'senha',
  ].filter(Boolean);
}
