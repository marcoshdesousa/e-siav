import { Field } from '../ui.jsx';
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
const SANGUE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei'];
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
 * Ficha de cadastro (modelo do Registro de Membro) + ficha médica.
 * A idade decide o que aparece: menor de 18 → pais e responsável; 16+ → profissional de saúde.
 */
export default function FichaForm({ value: f, onChange, age = null, readOnly = false }) {
  const set = (k) => (v) => onChange({ ...f, [k]: v });
  const input = (k, props = {}) => (
    <input value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly} {...props} />
  );
  const area = (k, placeholder) => (
    <textarea value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly} placeholder={placeholder} style={{ minHeight: 70 }} />
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
        <Field label="Estado civil">{select('estado_civil', ESTADOS_CIVIS)}</Field>
      </div>

      <h3 className="ficha-title">Ficha médica</h3>
      <div className="grid2">
        <Field label="Tipo sanguíneo">{select('tipo_sanguineo', SANGUE)}</Field>
        <Field label="Cartão do SUS">{input('cartao_sus', { inputMode: 'numeric' })}</Field>
      </div>
      <Field label="Plano de saúde">{input('plano_saude', { placeholder: 'Nome do plano e número da carteirinha' })}</Field>
      <Field label="Alergias">{area('alergias', 'Remédios, alimentos, picadas de inseto... (em branco se não tiver)')}</Field>
      <Field label="Remédios de uso contínuo">{area('medicamentos', 'Nome, dose e horário')}</Field>
      <Field label="Doenças ou condições de saúde">{area('doencas', 'Asma, diabetes, epilepsia, problemas no coração...')}</Field>
      <Field label="Restrições alimentares">{area('restricoes_alimentares')}</Field>
      <Field label="Deficiências ou necessidades especiais">{area('deficiencias')}</Field>
      <div className="grid2">
        <Field label="Contato de emergência">{input('contato_emergencia_nome', { placeholder: 'Nome' })}</Field>
        <Field label="Telefone de emergência">{input('contato_emergencia_telefone', { inputMode: 'tel' })}</Field>
      </div>
      <Field label="Outras observações médicas">{area('observacoes_medicas')}</Field>
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
