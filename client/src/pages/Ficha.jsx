import { Field } from '../ui.jsx';

/** Termos aceitos pelo responsável na inscrição. */
export const TERMOS = [
  ['termo_imagem', 'Autorizo o uso de imagem (fotos e vídeos) do inscrito nas atividades e divulgações do clã.'],
  ['termo_responsabilidade', 'Autorizo a participação nas atividades do clã (reuniões, acampamentos e eventos) e confirmo que as informações da ficha médica são verdadeiras.'],
  ['termo_dados', 'Concordo que estes dados sejam usados pelo clã somente para cadastro, segurança e atendimento médico, como manda a LGPD.'],
];

const SANGUE = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei'];

/**
 * Ficha de cadastro + ficha médica (usada na inscrição pelo link e pelo clã).
 * value/onChange: objeto com os campos; minor: mostra o responsável como obrigatório.
 */
export default function FichaForm({ value: f, onChange, minor = true, readOnly = false }) {
  const input = (k, props = {}) => (
    <input value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly} {...props} />
  );
  const area = (k, placeholder) => (
    <textarea value={f[k] || ''} onChange={(e) => onChange({ ...f, [k]: e.target.value })} disabled={readOnly} placeholder={placeholder} style={{ minHeight: 70 }} />
  );
  return (
    <div className="form">
      <h3 className="ficha-title">Ficha de cadastro</h3>
      <div className="grid2">
        <Field label="Sexo">
          <select value={f.sexo || ''} onChange={(e) => onChange({ ...f, sexo: e.target.value })} disabled={readOnly}>
            <option value="">—</option><option>Masculino</option><option>Feminino</option>
          </select>
        </Field>
        <Field label="Telefone / WhatsApp">{input('telefone', { inputMode: 'tel' })}</Field>
      </div>
      <Field label="E-mail">{input('email', { type: 'email', autoCapitalize: 'none' })}</Field>
      <Field label="Endereço">{input('endereco', { placeholder: 'Rua, número, complemento' })}</Field>
      <div className="grid2">
        <Field label="Bairro">{input('bairro')}</Field>
        <Field label="Cidade">{input('cidade')}</Field>
      </div>
      <div className="grid2">
        <Field label="UF">{input('uf', { maxLength: 2 })}</Field>
        <Field label="CEP">{input('cep', { inputMode: 'numeric' })}</Field>
      </div>
      <div className="grid2">
        <Field label="Escola">{input('escola')}</Field>
        <Field label="Igreja">{input('igreja')}</Field>
      </div>

      <h3 className="ficha-title">Responsável {minor ? '(obrigatório para menores)' : ''}</h3>
      <Field label="Nome do responsável">{input('responsavel_nome')}</Field>
      <div className="grid2">
        <Field label="Parentesco">{input('responsavel_parentesco', { placeholder: 'Mãe, pai, avó...' })}</Field>
        <Field label="Telefone do responsável">{input('responsavel_telefone', { inputMode: 'tel' })}</Field>
      </div>
      <div className="grid2">
        <Field label="CPF do responsável">{input('responsavel_cpf', { inputMode: 'numeric' })}</Field>
        <Field label="E-mail do responsável">{input('responsavel_email', { type: 'email', autoCapitalize: 'none' })}</Field>
      </div>

      <h3 className="ficha-title">Ficha médica</h3>
      <div className="grid2">
        <Field label="Tipo sanguíneo">
          <select value={f.tipo_sanguineo || ''} onChange={(e) => onChange({ ...f, tipo_sanguineo: e.target.value })} disabled={readOnly}>
            {SANGUE.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
          </select>
        </Field>
        <Field label="Cartão do SUS">{input('cartao_sus', { inputMode: 'numeric' })}</Field>
      </div>
      <Field label="Plano de saúde">{input('plano_saude', { placeholder: 'Nome do plano e número da carteirinha' })}</Field>
      <Field label="Alergias">{area('alergias', 'Remédios, alimentos, picadas de inseto... (deixe em branco se não tiver)')}</Field>
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

/** Caixas dos termos (inscrição). */
export function TermosChecks({ value: f, onChange }) {
  return (
    <div className="stack" style={{ gap: '.5rem' }}>
      {TERMOS.map(([k, text]) => (
        <label key={k} className="check termo"><input type="checkbox" checked={!!f[k]} onChange={(e) => onChange({ ...f, [k]: e.target.checked })} /> {text}</label>
      ))}
    </div>
  );
}
