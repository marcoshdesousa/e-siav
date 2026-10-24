import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy, Hash, Link2, MessageCircle, RotateCcw,
} from 'lucide-react';
import { api } from '../../api.js';
import { fmtCpf, fmtDate } from '../../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, Modal, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import FichaForm, { DocFields, SaudeLista, SexoField } from '../Ficha.jsx';

/** Em que lista o membro aparece: ativo, pendente (termo, aprovação ou dados) ou inativo. */
export const memberGroup = (m) => (m.status === 'inativo' ? 'inativo' : 'ativo');


const ageOf = (birth) => (birth ? Math.floor((Date.now() - Date.parse(birth + 'T12:00:00')) / 31557600000) : null);

/** Dados do membro + ficha juntos, para editar tudo no mesmo formulário. */
const initial = (d) => ({
  ...d.ficha, name: d.member.name, birth_date: d.member.birth_date || '', cpf: fmtCpf(d.member.cpf),
  certidao: d.member.birth_cert || d.ficha.certidao || '', doc_tipo: d.ficha.doc_tipo || (!d.member.cpf && d.member.birth_cert ? 'certidao' : 'rg_cpf'),
});

/** Ficha de cadastro: dados pessoais primeiro (nome, nascimento, sexo, documentos), depois contato e endereço. */
function DadosPessoais({ value: f, onChange }) {
  const age = ageOf(f.birth_date);
  return (
    <div className="form">
      <h3 className="ficha-title">Dados pessoais</h3>
      <Field label="Nome completo"><input value={f.name} onChange={(e) => onChange({ ...f, name: e.target.value })} /></Field>
      <Field label="Data de nascimento" hint={age != null ? `${age} anos` : ''}><input type="date" value={f.birth_date} onChange={(e) => onChange({ ...f, birth_date: e.target.value })} /></Field>
      <SexoField value={f} onChange={onChange} />
      <DocFields value={f} onChange={onChange} cpf={f.cpf} onCpf={(cpf) => onChange({ ...f, cpf })} />
      <FichaForm value={f} onChange={onChange} age={age} personal={false} />
    </div>
  );
}

/**
 * Ficha do membro em duas partes: ficha de cadastro e ficha médica.
 * O clube pode corrigir; o Administrador Geral só visualiza (readOnly).
 */
export function FichaModal({ member, url, onClose, readOnly = false }) {
  const state = useLoad(() => api.get(url));
  const [part, setPart] = useState('cadastro');
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put(url, f || initial(state.data)), 'Ficha salva!');
    onClose();
  };
  return (
    <Modal title={`Ficha · ${member.name}`} onClose={onClose} footer={!readOnly && state.data && <Button busy={busy} onClick={save}>{member.outdated && !f ? 'Confirmar ficha atualizada' : 'Salvar ficha'}</Button>}>
      <Loading {...state}>
        {(d) => (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Código <b>{d.member.code}</b> · {d.member.cpf ? <>CPF {fmtCpf(d.member.cpf)}</> : d.member.birth_cert ? <>Certidão {d.member.birth_cert}</> : 'sem documento'}
              {readOnly && <> · <b>só visualização</b></>}
            </p>
            {d.ficha.termo_imagem === false && <Badge kind="red">Sem autorização de uso de imagem</Badge>}
            <Tabs tabs={[['cadastro', 'Ficha de cadastro'], ['medica', 'Ficha médica']]} value={part} onChange={setPart} />
            <fieldset disabled={readOnly} className="plain-fieldset">
              {part === 'cadastro'
                ? <DadosPessoais value={f || initial(d)} onChange={setF} />
                : <SaudeLista value={f || initial(d)} onChange={setF} />}
            </fieldset>
            {d.ficha.terms_accepted_at ? (
              <Card className="small mt">
                <b>Termos assinados</b> em {fmtDate(d.ficha.terms_accepted_at)}{d.ficha.local_inscricao ? ` · ${d.ficha.local_inscricao}` : ''}<br />
                {part === 'cadastro'
                  ? <>Assinado por <b>{d.ficha.assinatura_nome || '—'}</b>{d.ficha.assinatura_cpf ? ` · CPF ${fmtCpf(d.ficha.assinatura_cpf)}` : ''}</>
                  : <>Assinado por <b>{d.ficha.med_assinatura_nome || '—'}</b>{d.ficha.med_assinatura_cpf ? ` · CPF ${fmtCpf(d.ficha.med_assinatura_cpf)}` : ''}</>}
              </Card>
            ) : <Card className="small mt">Os termos ainda não foram assinados.</Card>}
          </>
        )}
      </Loading>
    </Modal>
  );
}

/** Link do termo deste membro, para mandar ao responsável. */
export function TermLinkInline({ member }) {
  const url = `${location.origin}/termo/${member.terms_token}`;
  const first = member.name.split(' ')[0];
  const text = `Olá! Para ${first} participar das atividades do clube, assine os termos por este link: ${url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify('Link copiado!'); } catch { notify('Não deu para copiar. Selecione o link e copie.', 'error'); }
  };
  return (
    <>
      <div className="signup-link"><Link2 size={16} /> <span className="ellipsis">{url}</span></div>
      <div className="row wrap mt">
        <Button small onClick={copy}><Copy size={14} /> Copiar link</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Button small variant="green"><MessageCircle size={14} /> Enviar pelo WhatsApp</Button></a>
      </div>
    </>
  );
}

export function TermLinkModal({ member, onClose }) {
  const first = member.name.split(' ')[0];
  return (
    <Modal title={`Termo · ${member.name}`} onClose={onClose}>
      <p className="small" style={{ marginTop: 0 }}>Envie este link para o {member.kind === 'desbravador' ? 'responsável' : 'próprio membro'}. Quando ele assinar, {first} fica <b>ativo</b>. O link é só deste membro e vale uma vez.</p>
      <TermLinkInline member={member} />
    </Modal>
  );
}

/**
 * Lista de membros com as abas Ativos, Pendentes e Todos (os inativos só aparecem
 * no filtro "Inativos" e não entram no total).
 * actions: botões de cada membro (Sistema do Clube); sem actions = só visualização.
 */
export function MembersBrowser({ list, units, actions, initialTab = 'ativo' }) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const count = (g) => list.filter((m) => memberGroup(m) === g).length;
  const total = list.length - count('inativo');
  const nq = q.trim().toLowerCase();
  const shown = list.filter((m) => {
    const g = memberGroup(m);
    const inTab = tab === 'todos' ? g !== 'inativo' : tab === 'ativo' ? g !== 'inativo' : g === tab;
    return inTab && (!nq || m.name.toLowerCase().includes(nq) || m.code.includes(nq))
      && (!unitFilter || (unitFilter === 'none' ? !m.unit_id : String(m.unit_id) === unitFilter));
  });
  return (
    <>
      <Tabs tabs={[['ativo', 'Ativos', count('ativo')], ['todos', `Todos (${total})`], ['inativo', 'Inativos']]} value={tab} onChange={setTab} />
      <div className="grid2">
        <input placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">Todos as unidades</option>
          <option value="none">Sem unidade</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="list mt">
        {shown.map((m) => (
          <div key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <Avatar src={m.photo} name={m.name} size={48} />
            <div className="grow">
              <div className="title ico">{m.name}</div>
              <div className="sub">{m.age} anos · {m.cargo} · {m.unit_name || 'Sem unidade'}</div>
              <div className="row wrap" style={{ marginTop: '.35rem', gap: '.3rem' }}>
                <Badge kind={m.kind === 'desbravador' ? 'blue' : 'yellow'}>{m.role}</Badge>
                <Badge><Hash size={11} /> {m.code}</Badge>
                {m.status === 'inativo' && <Badge>Inativo</Badge>}
              </div>
              {actions && <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>{actions(m)}</div>}
            </div>
          </div>
        ))}
        {!shown.length && <Empty>{tab === 'inativo' ? 'Ninguém inativo.' : 'Ninguém encontrado.'}</Empty>}
      </div>
    </>
  );
}

/** Botões do Sistema do Clube para cada membro, conforme a situação. */
export function memberActions({ base, run, done, setEditing, setAch }) {
  return (m) => {
    if (m.status === 'inativo') {
      return <Button small variant="green" onClick={() => run(() => api.post(`/club/members/${m.id}/reativar`), 'Membro ativado!').then(() => done())}><RotateCcw size={14} /> Ativar</Button>;
    }
    return (
      <>
        <Button small variant="secondary" onClick={() => setEditing(m)}>Editar</Button>
        <Button small variant="secondary" onClick={() => setAch(m)}>Especialidades</Button>
        <Link to={`${base}/ver/membro/${m.link}`}><Button small variant="ghost">Perfil</Button></Link>
        <Confirm text={`Inativar ${m.name}? A pessoa sai das listas e do ranking, mas continua no sistema e pode ser ativada de novo.`}
          onYes={() => run(() => api.post(`/club/members/${m.id}/desativar`), 'Membro inativado').then(() => done())}>Inativar</Confirm>
      </>
    );
  };
}
