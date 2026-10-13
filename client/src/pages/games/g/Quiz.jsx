// Quiz bíblico e dos Desbravadores: 15 s por pergunta, três erros e acabou.
import { useEffect, useRef, useState } from 'react';
import { shuffle, useInterval } from '../kit.js';
import './Quiz.css';

// [pergunta, resposta certa, errada, errada, errada]
const Q = [
  ['Qual é o primeiro livro da Bíblia?', 'Gênesis', 'Êxodo', 'Mateus', 'Salmos'],
  ['Qual é o último livro da Bíblia?', 'Apocalipse', 'Judas', 'Malaquias', 'Atos'],
  ['Quantos livros tem a Bíblia?', '66', '72', '39', '50'],
  ['Quantos livros tem o Antigo Testamento?', '39', '27', '40', '46'],
  ['Quantos livros tem o Novo Testamento?', '27', '39', '21', '33'],
  ['Quem construiu a arca para escapar do dilúvio?', 'Noé', 'Moisés', 'Abraão', 'Jonas'],
  ['Quem foi o primeiro homem criado por Deus?', 'Adão', 'Abel', 'Noé', 'Sete'],
  ['Em que dia da semana da criação Deus descansou?', 'No sétimo dia', 'No primeiro dia', 'No sexto dia', 'No terceiro dia'],
  ['Quem derrotou o gigante Golias?', 'Davi', 'Saul', 'Sansão', 'Josué'],
  ['Quem foi engolido por um grande peixe?', 'Jonas', 'Elias', 'Pedro', 'Daniel'],
  ['Quem foi lançado na cova dos leões?', 'Daniel', 'José', 'Jeremias', 'Elias'],
  ['Quem recebeu os Dez Mandamentos no monte Sinai?', 'Moisés', 'Arão', 'Josué', 'Abraão'],
  ['Qual personagem tinha sua força ligada aos cabelos?', 'Sansão', 'Gideão', 'Davi', 'Absalão'],
  ['Em que cidade Jesus nasceu?', 'Belém', 'Nazaré', 'Jerusalém', 'Cafarnaum'],
  ['Em que cidade Jesus cresceu?', 'Nazaré', 'Belém', 'Jericó', 'Betânia'],
  ['Quantos discípulos Jesus escolheu?', '12', '10', '7', '70'],
  ['Qual discípulo traiu Jesus?', 'Judas Iscariotes', 'Pedro', 'Tomé', 'Filipe'],
  ['Qual discípulo negou Jesus três vezes?', 'Pedro', 'João', 'André', 'Tiago'],
  ['Quem batizou Jesus?', 'João Batista', 'Pedro', 'Paulo', 'André'],
  ['Em que rio Jesus foi batizado?', 'Jordão', 'Nilo', 'Eufrates', 'Tigre'],
  ['Qual foi o primeiro milagre de Jesus, nas bodas de Caná?', 'Transformar água em vinho', 'Curar um cego', 'Andar sobre as águas', 'Multiplicar pães'],
  ['Quem Jesus ressuscitou depois de quatro dias no túmulo?', 'Lázaro', 'Jairo', 'Zaqueu', 'Nicodemos'],
  ['Quem subiu numa árvore para conseguir ver Jesus?', 'Zaqueu', 'Nicodemos', 'Bartimeu', 'Mateus'],
  ['Qual livro da Bíblia tem 150 capítulos?', 'Salmos', 'Provérbios', 'Isaías', 'Gênesis'],
  ['Qual rei pediu a Deus sabedoria?', 'Salomão', 'Davi', 'Saul', 'Ezequias'],
  ['Quem foi o pai de Isaque?', 'Abraão', 'Jacó', 'Noé', 'Ló'],
  ['Quem eram os filhos gêmeos de Isaque?', 'Esaú e Jacó', 'Caim e Abel', 'Moisés e Arão', 'Efraim e Manassés'],
  ['Qual novo nome Deus deu a Jacó?', 'Israel', 'Abraão', 'Judá', 'Benjamim'],
  ['Para onde José foi levado depois de ser vendido pelos irmãos?', 'Egito', 'Babilônia', 'Canaã', 'Assíria'],
  ['Que mar Deus abriu para o povo de Israel passar?', 'Mar Vermelho', 'Mar Morto', 'Mar da Galileia', 'Mar Mediterrâneo'],
  ['Quantas pragas caíram sobre o Egito?', '10', '7', '12', '3'],
  ['Os muros de qual cidade caíram depois que o povo marchou ao redor dela?', 'Jericó', 'Jerusalém', 'Nínive', 'Babilônia'],
  ['Quem liderou Israel na conquista de Jericó?', 'Josué', 'Moisés', 'Gideão', 'Calebe'],
  ['Qual rainha arriscou a vida para salvar o seu povo?', 'Ester', 'Jezabel', 'Vasti', 'Rainha de Sabá'],
  ['Quem disse a Noemi: “O teu povo é o meu povo, e o teu Deus é o meu Deus”?', 'Rute', 'Orfa', 'Ester', 'Ana'],
  ['Qual profeta subiu ao céu num carro de fogo?', 'Elias', 'Eliseu', 'Isaías', 'Enoque'],
  ['Qual apóstolo se converteu no caminho de Damasco?', 'Paulo', 'Pedro', 'Barnabé', 'Tiago'],
  ['Quem é conhecido como o primeiro mártir cristão?', 'Estêvão', 'Pedro', 'Tiago', 'Filipe'],
  ['Quantos dias Jesus jejuou no deserto?', '40', '7', '12', '3'],
  ['Na multiplicação, quantos pães e peixes um menino ofereceu?', '5 pães e 2 peixes', '7 pães e 3 peixes', '2 pães e 5 peixes', '12 pães e 1 peixe'],
  ['“No princípio, criou Deus os céus e a terra” está em qual livro?', 'Gênesis', 'João', 'Salmos', 'Êxodo'],
  ['Qual salmo começa com “O Senhor é o meu pastor”?', 'Salmo 23', 'Salmo 1', 'Salmo 91', 'Salmo 119'],
  ['“Porque Deus amou o mundo de tal maneira…” está em qual texto?', 'João 3:16', 'Gênesis 1:1', 'Salmo 23:1', 'Romanos 8:28'],
  ['Qual dia Deus abençoou e santificou na criação?', 'O sétimo dia (sábado)', 'O primeiro dia', 'O terceiro dia', 'O sexto dia'],
  ['O que aconteceu na Torre de Babel?', 'Deus confundiu as línguas', 'Caiu fogo do céu', 'Houve um dilúvio', 'O mar se abriu'],
  ['Qual foi o sinal da aliança de Deus com Noé?', 'O arco-íris', 'Uma estrela', 'Uma pomba', 'Uma nuvem'],
  ['Quem era a esposa de Abraão?', 'Sara', 'Rebeca', 'Raquel', 'Lia'],
  ['Qual menino ouviu Deus chamar seu nome à noite no templo?', 'Samuel', 'Davi', 'José', 'Daniel'],
  ['Quem foi o primeiro rei de Israel?', 'Saul', 'Davi', 'Salomão', 'Samuel'],
  ['Quem escreveu o Apocalipse?', 'João', 'Paulo', 'Pedro', 'Lucas'],
  ['Em que ilha João recebeu as visões do Apocalipse?', 'Patmos', 'Creta', 'Chipre', 'Malta'],
  ['Qual destes livros NÃO é um dos evangelhos?', 'Atos', 'Marcos', 'Lucas', 'João'],
  ['Qual era a profissão de Pedro antes de seguir Jesus?', 'Pescador', 'Carpinteiro', 'Cobrador de impostos', 'Pastor de ovelhas'],
  ['Qual era a profissão de Mateus antes de seguir Jesus?', 'Cobrador de impostos', 'Pescador', 'Médico', 'Soldado'],
  ['Qual era a profissão de José, marido de Maria?', 'Carpinteiro', 'Pescador', 'Pastor', 'Ferreiro'],
  ['Com quantos homens Gideão venceu os midianitas?', '300', '3.000', '12', '70'],
  ['Na parábola, quem ajudou o homem ferido na estrada?', 'Um samaritano', 'Um sacerdote', 'Um levita', 'Um soldado'],
  ['Em que dia Jesus ressuscitou depois de morrer?', 'No terceiro dia', 'No mesmo dia', 'No sétimo dia', 'No quadragésimo dia'],
  ['Onde o bebê Moisés foi colocado para ser salvo?', 'Num cesto no rio', 'Numa caverna', 'Num barco no mar', 'Num poço'],
  ['Quais amigos de Daniel foram lançados na fornalha?', 'Sadraque, Mesaque e Abede-Nego', 'Pedro, Tiago e João', 'Sem, Cam e Jafé', 'Arão, Hur e Josué'],
  ['Quem foi o irmão de Abel?', 'Caim', 'Sete', 'Enoque', 'Jafé'],
  ['Como se chamava o alimento que Deus mandava do céu no deserto?', 'Maná', 'Mirra', 'Manjar', 'Trigo'],
  ['O que a pomba trouxe a Noé depois do dilúvio?', 'Uma folha de oliveira', 'Um ramo de videira', 'Uma flor', 'Uma pedra'],
  ['Qual capítulo é conhecido como o “capítulo do amor”?', '1 Coríntios 13', 'João 3', 'Salmo 23', 'Gênesis 1'],
  ['Em qual carta de Paulo está a lista do “fruto do Espírito”?', 'Gálatas', 'Romanos', 'Hebreus', 'Tiago'],
  ['Qual era o nome de Paulo antes da conversão?', 'Saulo', 'Simão', 'Silas', 'Samuel'],
  ['Quem foi a mãe de Jesus?', 'Maria', 'Marta', 'Isabel', 'Ana'],
  ['Quem eram as irmãs de Lázaro?', 'Marta e Maria', 'Raquel e Lia', 'Rute e Orfa', 'Sara e Agar'],
  // Desbravadores
  ['Em que ano a Associação Geral oficializou o Clube de Desbravadores?', '1950', '1844', '1920', '1975'],
  ['Qual é o lema dos Desbravadores?', 'O amor de Cristo me motiva', 'Sempre alerta', 'Servir e salvar', 'Fé, força e foco'],
  ['Qual é o alvo dos Desbravadores?', 'A mensagem do advento a todo o mundo em minha geração', 'O amor de Cristo me motiva', 'Ir aonde Deus mandar', 'Ser puro, bondoso e leal'],
  ['Como começa o voto do Desbravador?', 'Pela graça de Deus, serei puro, bondoso e leal…', 'Prometo ser sempre alegre…', 'Pela minha honra, prometo…', 'Com fé e coragem, serei…'],
  ['Quantos itens tem a Lei do Desbravador?', '8', '10', '6', '12'],
  ['Qual destes itens faz parte da Lei do Desbravador?', 'Ter sempre um cântico no coração', 'Nunca dormir em barraca', 'Ser o primeiro em tudo', 'Correr todos os dias'],
  ['Qual item da Lei fala sobre o começo do dia?', 'Observar a devoção matinal', 'Cuidar de meu corpo', 'Ir aonde Deus mandar', 'Ser cortês e obediente'],
  ['Qual é a faixa de idade dos Desbravadores?', '10 a 15 anos', '4 a 9 anos', '16 a 21 anos', '6 a 12 anos'],
  ['Qual é a primeira classe regular dos Desbravadores?', 'Amigo', 'Guia', 'Pioneiro', 'Pesquisador'],
  ['Qual é a última classe regular dos Desbravadores?', 'Guia', 'Excursionista', 'Amigo', 'Companheiro'],
  ['Qual clube da igreja é para crianças menores que os Desbravadores?', 'Aventureiros', 'Embaixadores', 'Escoteiros', 'Jovens'],
  ['Qual igreja mantém o Clube de Desbravadores?', 'Igreja Adventista do Sétimo Dia', 'Igreja Católica', 'Igreja Batista', 'Igreja Metodista'],
  ['Qual é a forma principal do emblema dos Desbravadores?', 'Triângulo', 'Círculo', 'Estrela', 'Quadrado'],
  ['No emblema dos Desbravadores, o que a espada representa?', 'A Palavra de Deus', 'A guerra', 'A força física', 'A vitória no Campori'],
  ['No emblema, a cor vermelha simboliza…', 'Sacrifício', 'Lealdade', 'Pureza', 'Excelência'],
  ['No emblema, a cor branca simboliza…', 'Pureza', 'Sacrifício', 'Lealdade', 'Coragem'],
  ['No emblema, a cor azul simboliza…', 'Lealdade', 'Pureza', 'Sacrifício', 'Alegria'],
  ['No emblema, a cor dourada simboliza…', 'Excelência', 'Pureza', 'Lealdade', 'Riqueza'],
  ['Como se chama o grande encontro de clubes de Desbravadores?', 'Campori', 'Congresso', 'Retiro', 'Festival'],
  ['Como se chama o pequeno grupo de desbravadores dentro do clube?', 'Unidade', 'Patrulha', 'Pelotão', 'Equipe'],
  ['Quem acompanha e orienta de perto uma unidade?', 'O conselheiro', 'O pastor', 'O tesoureiro', 'O secretário'],
  ['Qual é o último item da Lei do Desbravador?', 'Ir aonde Deus mandar', 'Cuidar de meu corpo', 'Manter a consciência limpa', 'Observar a devoção matinal'],
];

const TIME = 15;
const LIVES = 3;

const makeDeck = () => shuffle(Q).map(([q, ok, ...bad]) => ({ q, ok, opts: shuffle([ok, ...bad]) }));

export default function Game({ onScore, onEnd }) {
  const [deck, setDeck] = useState(makeDeck);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [left, setLeft] = useState(TIME); // segundos restantes (fracionado)
  const [pickd, setPickd] = useState(null); // opção escolhida, ou '' quando o tempo acaba
  const [gain, setGain] = useState(0);
  const deadline = useRef(Date.now() + TIME * 1000);
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const cur = deck[idx];
  const answered = pickd !== null;
  const over = answered && lives <= 0;

  useEffect(() => { cb.current.onScore?.(score); }, [score]);

  const answer = (opt) => {
    if (answered || ended.current) return;
    const secs = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    setPickd(opt);
    if (opt === cur.ok) {
      const g = 10 + Math.min(TIME, secs);
      setGain(g);
      setScore((s) => s + g);
    } else {
      setGain(0);
      setLives((l) => l - 1);
    }
  };

  // Relógio da pergunta.
  useInterval(() => {
    const l = Math.max(0, (deadline.current - Date.now()) / 1000);
    setLeft(l);
    if (l <= 0) answer('');
  }, answered ? null : 100);

  // Depois do retorno: próxima pergunta ou fim.
  useEffect(() => {
    if (!answered) return undefined;
    const t = setTimeout(() => {
      if (lives <= 0) {
        if (ended.current) return;
        ended.current = true;
        cb.current.onEnd?.(score);
        return;
      }
      if (idx + 1 >= deck.length) { setDeck(makeDeck()); setIdx(0); } else setIdx(idx + 1);
      setPickd(null);
      setLeft(TIME);
      deadline.current = Date.now() + TIME * 1000;
    }, pickd === cur.ok ? 1100 : 1800);
    return () => clearTimeout(t);
  }, [answered, lives, score, idx, deck, pickd, cur.ok]);

  useEffect(() => {
    const k = (e) => {
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && e.key.length === 1 && cur.opts[i]) answer(cur.opts[i]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const pct = (left / TIME) * 100;
  const fb = !answered ? null : pickd === cur.ok ? `Certo! +${gain}` : pickd === '' ? 'Tempo esgotado!' : 'Errou!';

  return (
    <div className="quiz">
      <div className="quiz-head">
        <span className="quiz-lives" aria-label={`${lives} vidas`}>
          {[...Array(LIVES).keys()].map((i) => <span key={i}>{i < lives ? '❤️' : '🤍'}</span>)}
        </span>
        <span className="quiz-num">Pergunta {idx + 1}</span>
        <span className="quiz-score">⭐ {score}</span>
      </div>
      <div className="quiz-timer">
        <div className={'quiz-bar' + (left <= 5 ? ' quiz-bar-low' : '')} style={{ width: pct + '%' }} />
        <span className="quiz-secs">{Math.ceil(left)} s</span>
      </div>
      <div className="quiz-card">
        <p className="quiz-q">{cur.q}</p>
      </div>
      <div className="quiz-opts">
        {cur.opts.map((o, i) => {
          let cls = 'quiz-opt';
          if (answered) {
            if (o === cur.ok) cls += ' quiz-ok';
            else if (o === pickd) cls += ' quiz-bad';
            else cls += ' quiz-dim';
          }
          return (
            <button key={o} type="button" className={cls} onClick={() => answer(o)} disabled={answered}>
              <b>{'ABCD'[i]}</b><span>{o}</span>
            </button>
          );
        })}
      </div>
      <div className={'quiz-fb' + (answered ? (pickd === cur.ok ? ' quiz-fb-ok' : ' quiz-fb-bad') : '')}>
        {fb ? (over ? fb + ' Fim de jogo.' : fb) : 'Toque na resposta certa'}
        {answered && pickd !== cur.ok && <small>Resposta: {cur.ok}</small>}
      </div>
    </div>
  );
}
