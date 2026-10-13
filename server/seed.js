// Dados de exemplo do Distrito Palmares: dois clubes, unidades, membros,
// requisitos, envios, medalhas, eventos, conteúdo e conversas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, get, all, tx, resetDatabase, UPLOAD_DIR } from './db.js';
import { hashPassword } from './auth.js';
import { cleanCpf } from './util.js';
import { saveFicha } from './ficha.js';
import { NOME_UNIDADE_LIDERANCA } from './config.js';
import { syncCatalog } from './catalog.js';

const day = 864e5;
const iso = (offsetDays, hour = 23, min = 59) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const dateOnly = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const birthForAge = (age, monthsAgo = 3) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
};

const ICONS = {
  compass: '<circle cx="50" cy="50" r="22" fill="none" stroke="#fff" stroke-width="5"/><path d="M50 32 L56 50 L50 68 L44 50 Z" fill="#FFC72C"/>',
  wing: '<path d="M22 60 C35 30 60 26 78 34 C64 38 58 44 56 52 C66 50 72 52 78 58 C62 60 50 66 44 74 C40 66 32 62 22 60 Z" fill="#fff"/>',
  paw: '<circle cx="50" cy="60" r="12" fill="#fff"/><circle cx="34" cy="44" r="6" fill="#fff"/><circle cx="46" cy="36" r="6" fill="#fff"/><circle cx="58" cy="36" r="6" fill="#fff"/><circle cx="68" cy="44" r="6" fill="#fff"/>',
  mountain: '<path d="M18 72 L40 38 L52 54 L62 42 L82 72 Z" fill="#fff"/><path d="M40 38 L46 47 L34 47 Z" fill="#FFC72C"/>',
  flame: '<path d="M50 22 C60 38 70 44 66 60 C64 70 56 76 50 76 C42 76 34 70 34 60 C34 50 42 46 44 36 C48 44 52 46 52 46 C54 38 52 30 50 22 Z" fill="#FFC72C"/>',
  star: '<path d="M50 20 L58 42 L82 42 L62 56 L70 78 L50 64 L30 78 L38 56 L18 42 L42 42 Z" fill="#FFC72C"/>',
};

function makeLogo(file, color, icon, ring = '#FFC72C') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${color}"/><circle cx="50" cy="50" r="44" fill="none" stroke="${ring}" stroke-width="3"/>${ICONS[icon]}</svg>`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), svg);
  return '/uploads/' + file;
}

function login(type, id, username, password) {
  run('INSERT INTO logins (username, password_hash, account_type, account_id) VALUES (?,?,?,?)', username, hashPassword(password), type, id);
}
const ins = (sql, ...p) => Number(run(sql, ...p).lastInsertRowid);

/** Ficha completa de teste (cadastro + saúde), assinada pelo responsável. */
function demoFicha(name, age, club) {
  const first = name.split(' ')[0];
  const minor = age < 18;
  const resp = minor ? `Responsável de ${first} Teste` : name;
  const f = {
    sexo: /a$/.test(first) ? 'Feminino' : 'Masculino', whatsapp: '81999990000', doc_tipo: 'rg_cpf', rg: '1234567', rg_orgao: 'SSP/PE',
    endereco: 'Rua das Palmeiras', numero: '100', bairro: 'Centro', cidade: 'Palmares', uf: 'PE', camiseta: minor ? '12' : 'M',
    termo_imagem: true, termo_responsabilidade: true, termo_dados: true, assinatura_nome: resp, assinatura_cpf: '11144477735',
    doencas: ['Catapora'], doencas_ok: true, sangue_tipo: 'O', sangue_rh: 'Positivo', plano_saude: '', cartao_sus: '',
    termo_medico: true, med_assinatura_nome: resp, med_assinatura_cpf: '11144477735',
    data_inscricao: new Date().toISOString().slice(0, 10), local_inscricao: `${club === 'aguias' ? 'Clube Águias do Vale' : 'Clube Leões de Judá'} — dados de teste`,
  };
  for (const k of ['cardiaco', 'alergia_medicamento', 'lactose', 'deficiencia', 'transfusao', 'alergia_pele', 'convulsao', 'psicologico', 'alergia', 'diabetes', 'ferimento', 'fratura', 'cirurgia', 'internacao']) f['q_' + k] = 'nao';
  if (age >= 16) f.estado_civil = 'Solteiro';
  if (minor) Object.assign(f, { mae_nome: `Mãe de ${first} Teste`, mae_whatsapp: '81999990000' });
  return f;
}

/**
 * Dados de teste. production = true: no app no ar, cria só clubes, unidades e membros
 * de teste (usa o admin e o distrito que já existem; não mexe no catálogo, cursos,
 * medalhas, eventos e requisitos gerais).
 */
export function seed({ production = false } = {}) {
  tx(() => {
    const palmares = get(`SELECT id FROM districts WHERE name = 'Distrito Palmares'`)?.id
      || (production && get('SELECT id FROM districts ORDER BY id LIMIT 1')?.id)
      || ins(`INSERT INTO districts (name) VALUES ('Distrito Palmares')`);

    let admin = get('SELECT id FROM admins ORDER BY id LIMIT 1')?.id;
    if (!admin) {
      admin = ins(`INSERT INTO admins (name) VALUES ('Administrador Geral')`);
      login('admin', admin, 'admin', 'admin123');
    }

    // ---------- Clubes e unidades ----------
    const clubs = {};
    const units = {};
    const clubDefs = [
      { key: 'aguias', number: 1, code: '4821', password: 'AG2026', name: 'Clube Águias do Vale', director: 'Marcos Almeida', associates: 'Juliana Costa', color: '#0B3D91', icon: 'wing', user: 'aguias', lid: 'TU9001',
        units: [['falcoes', 'Falcões', '#D62828', 'wing', 'FA1111'], ['gavioes', 'Gaviões', '#1F7A4D', 'mountain', 'GA2222']] },
      { key: 'leoes', number: 2, code: '7350', password: 'LE2026', name: 'Clube Leões de Judá', director: 'Carlos Pereira', color: '#8A1C1C', icon: 'paw', user: 'leoes', lid: 'TU9002',
        units: [['panteras', 'Panteras', '#3A2E7A', 'paw', 'PA3333'], ['tigres', 'Tigres', '#D9822B', 'flame', 'TI4444']] },
    ];
    for (const c of clubDefs) {
      const id = ins('INSERT INTO clubs (district_id, name, number, logo, code, director_name, associate_directors, history) VALUES (?,?,?,?,?,?,?,?)', palmares, c.name, c.number,
        makeLogo(`seed-club-${c.key}.svg`, c.color, c.icon), c.code, c.director, c.associates || null, `O ${c.name} nasceu da vontade de levar aventura e fé aos jovens do bairro.`);
      login('club', id, c.user, c.password);
      clubs[c.key] = id;
      units[c.key + ':lideranca'] = ins('INSERT INTO units (club_id, name, logo, is_leadership, pin) VALUES (?,?,?,1,?)', id, NOME_UNIDADE_LIDERANCA, makeLogo(`seed-lid-${c.key}.svg`, '#0B3D91', 'star', '#fff'), c.lid);
      c.units.forEach(([ukey, uname, ucolor, uicon, pin], k) => {
        units[ukey] = ins('INSERT INTO units (club_id, name, logo, pin, number) VALUES (?,?,?,?,?)', id, uname, makeLogo(`seed-unit-${ukey}.svg`, ucolor, uicon), pin, k + 1);
      });
    }

    // ---------- Membros ----------
    const members = {};
    const memberDefs = [
      ['pedro', 'aguias', 'falcoes', 'Pedro Henrique Lima', 12, 'Desbravador'],
      ['ana', 'aguias', 'gavioes', 'Ana Clara Souza', 11, 'Desbravador'],
      ['lucas', 'aguias', 'falcoes', 'Lucas Ferreira', 14, 'Desbravador'],
      ['beatriz', 'aguias', 'gavioes', 'Beatriz Santos', 13, 'Desbravador'],
      ['gabriel', 'aguias', null, 'Gabriel Oliveira', 15, 'Desbravador'],
      ['marcos', 'aguias', 'aguias:lideranca', 'Marcos Almeida', 34, 'Diretor'],
      ['juliana', 'aguias', 'falcoes', 'Juliana Costa', 22, 'Conselheira'],
      ['davi', 'leoes', 'panteras', 'Davi Rodrigues', 10, 'Desbravador'],
      ['sofia', 'leoes', 'tigres', 'Sofia Martins', 13, 'Desbravador'],
      ['rafael', 'leoes', 'panteras', 'Rafael Gomes', 12, 'Desbravador'],
      ['isabela', 'leoes', 'tigres', 'Isabela Ribeiro', 14, 'Desbravador'],
      ['carlos', 'leoes', 'leoes:lideranca', 'Carlos Pereira', 41, 'Diretor'],
      ['fernanda', 'leoes', 'leoes:lideranca', 'Fernanda Dias', 19, 'Instrutora'],
    ];
    // CPFs fictícios (válidos só no formato), gerados a partir de um número base.
    const fakeCpf = (n) => {
      for (let base = n; ; base++) {
        const d = String(base).padStart(9, '0').split('').map(Number);
        const dv = (arr) => { const len = arr.length; const r = (arr.reduce((s, x, i) => s + x * (len + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r; };
        d.push(dv(d)); d.push(dv(d));
        const cpf = cleanCpf(d.join(''));
        if (cpf) return cpf;
      }
    };
    // Códigos fixos (100001, 100002...) para facilitar os testes. A senha é o ano de nascimento.
    memberDefs.forEach(([key, club, unit, name, age, cargo], i) => {
      const birth = birthForAge(age, (key.length * 2) % 11);
      const id = ins(
        `INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, cpf, approved_at, cleared_year) VALUES (?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?)`,
        clubs[club], unit ? units[unit] : null, name, birth, cargo, String(100001 + i), fakeCpf(123456000 + i * 1000), new Date().getFullYear(),
      );
      login('member', id, key, 'dbv123'); // usuário antigo (pedro, lucas...); a senha que vale é o ano de nascimento
      members[key] = id;
      // Inscrição do ano paga.
      run(`INSERT INTO member_fees (member_id, year, amount_cents, paid_at) VALUES (?, ?, 250, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, id, new Date().getFullYear());
      // Ficha completa para quase todos; Gabriel e Davi ficam com "dados incompletos".
      if (!['gabriel', 'davi'].includes(key)) saveFicha(id, demoFicha(name, age, club), { acceptTerms: true });
    });
    // Uma inscrição esperando aprovação (feita pelo link de cadastro).
    const pend = ins(`INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, cpf, status, approved_at, cleared_year) VALUES (?,?,?,?,?,?,?,'ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'),2026)`,
      clubs.aguias, null, 'Bruna Inscrita Teste', birthForAge(11, 2), 'Desbravador', '100099', fakeCpf(123999000));
    login('member', pend, 'bruna', 'dbv123');
    saveFicha(pend, demoFicha('Bruna Inscrita Teste', 11, 'aguias'), { acceptTerms: true });
    // Um cadastro feito pelo clube, com termo assinado, esperando o clube pagar a inscrição do ano.
    const pag = ins(`INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, cpf, status, approved_at, cleared_year) VALUES (?,?,?,?,?,?,?,'ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'),2026)`,
      clubs.aguias, units.gavioes, 'Rafaela Nunes Teste', birthForAge(12, 4), 'Desbravador', '100098', fakeCpf(123998000));
    login('member', pag, 'rafaela', 'dbv123');
    saveFicha(pag, demoFicha('Rafaela Nunes Teste', 12, 'aguias'), { acceptTerms: true });

    // ---------- Conteúdo: classes, especialidades e cursos ----------
    const content = {};
    const addContent = (key, type, name, opts, items) => {
      const id = ins(
        'INSERT INTO content (type, name, description, icon, category, age, leader, is_free, price_cents) VALUES (?,?,?,?,?,?,?,?,?)',
        type, name, opts.description || '', opts.icon || 'book', opts.category || '', opts.age ?? null, opts.leader ? 1 : 0, opts.price ? 0 : 1, opts.price || 0,
      );
      items.forEach(([title, body, modes = '', quiz = []], i) => {
        const itemId = ins('INSERT INTO content_items (content_id, ord, title, body, modes) VALUES (?,?,?,?,?)', id, i, title, body, modes);
        quiz.forEach(([q, o, c], k) => run('INSERT INTO content_item_questions (item_id, ord, question, options, correct) VALUES (?,?,?,?,?)', itemId, k, q, JSON.stringify(o), c));
      });
      content[key] = id;
    };
    // Classes e especialidades vêm do catálogo (não são vendidas nem feitas online).
    syncCatalog({ demo: !production });
    const byName = (type, name) => get('SELECT id FROM content WHERE type = ? AND name = ?', type, name)?.id;
    for (const [k, n] of [['amigo', 'Amigo'], ['companheiro', 'Companheiro'], ['pesquisador', 'Pesquisador'], ['pioneiro', 'Pioneiro'], ['lider', 'Líder']]) content[k] = byName('classe', n);
    for (const [k, n] of [['nos', 'Nós e Amarras'], ['socorros', 'Primeiros Socorros Básico'], ['acampamento', 'Acampamento I'], ['historias', 'Arte de Contar Histórias Cristãs'], ['culinaria', 'Culinária'], ['aves', 'Aves'], ['natacao', 'Natação Principiante I']]) content[k] = byName('especialidade', n);

    // Cursos (só nos dados de exemplo locais)
    if (!production) addContent('curso_acampamento', 'curso', 'Acampamento Seguro', { icon: 'flame', description: 'Curso em 4 aulas sobre segurança em acampamentos.' }, [
      ['Aula 1 — Planejamento', 'Como planejar um acampamento: local, autorização dos pais, equipe e cardápio.'],
      ['Aula 2 — Equipamentos', 'Barracas, sacos de dormir, lanternas e kit de primeiros socorros.'],
      ['Aula 3 — Fogo e cozinha', 'Regras para fogueiras, fogareiros e higiene dos alimentos.'],
      ['Aula 4 — Natureza', 'Deixe o lugar melhor do que encontrou: lixo, trilhas e animais.'],
    ]);
    if (!production) addContent('curso_biblia', 'curso', 'Bíblia para Desbravadores', { icon: 'scroll', description: 'Conheça os livros da Bíblia de um jeito prático.' }, [
      ['Aula 1 — Como a Bíblia é organizada', 'Antigo e Novo Testamento, livros, capítulos e versículos.'],
      ['Aula 2 — Grandes histórias', 'De Gênesis a Apocalipse em 10 histórias.'],
      ['Aula 3 — Devocional diário', 'Como criar o hábito da devoção matinal.'],
    ]);
    if (!production) addContent('curso_lideranca', 'curso', 'Liderança Jovem', { icon: 'graduation', price: 4990, description: 'Para quem quer liderar unidades e projetos.' }, [
      ['Aula 1 — O que é liderar', 'Liderança servidora e exemplo.'],
      ['Aula 2 — Comunicação', 'Como falar com a unidade e ouvir cada membro.'],
      ['Aula 3 — Planejamento', 'Metas, calendário e divisão de tarefas.'],
      ['Aula 4 — Conflitos', 'Resolvendo conflitos com respeito.'],
      ['Aula 5 — Projeto final', 'Planeje uma atividade completa para o seu clube.'],
    ]);

    // Conquistas registradas pelo clube.
    const ach = (m, c, source = 'clube') => content[c] && run('INSERT INTO achievements (member_id, content_id, source) VALUES (?,?,?)', members[m], content[c], source);
    ach('pedro', 'amigo'); ach('pedro', 'companheiro'); ach('pedro', 'nos');
    ach('lucas', 'amigo'); ach('lucas', 'companheiro'); ach('lucas', 'pesquisador'); ach('lucas', 'pioneiro'); ach('lucas', 'socorros'); ach('lucas', 'acampamento');
    ach('ana', 'amigo'); ach('sofia', 'amigo'); ach('sofia', 'companheiro'); ach('sofia', 'pesquisador'); ach('sofia', 'historias');
    ach('marcos', 'lider'); ach('carlos', 'lider');

    if (!production) run(`INSERT INTO content_access (member_id, content_id, source) VALUES (?, ?, 'admin')`, members.juliana, content.curso_lideranca);

    // Pedidos de membros: "tenho esta especialidade/classe" → a diretoria aprova
    const pedido = (m, c) => content[c] && run('INSERT INTO achievement_requests (member_id, content_id) VALUES (?, ?)', members[m], content[c]);
    pedido('beatriz', 'culinaria'); pedido('beatriz', 'aves'); pedido('beatriz', 'amigo');
    pedido('gabriel', 'natacao');
    pedido('isabela', 'nos');

    // ---------- Requisitos ----------
    const req = (o) => {
      if (production && !o.club) return null; // no ar: só requisitos dos clubes de teste
      const id = ins(
        `INSERT INTO requirements (creator_type, club_id, audience, member_kind, scope, district_id, title, description, model, points, late_points, deadline, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        o.club ? 'club' : 'admin', o.club ? clubs[o.club] : null, o.audience, o.audience === 'member' ? 'desbravador' : null, o.club ? 'clube' : o.scope || 'geral', o.scope === 'distrito' ? palmares : null,
        o.title, o.description, o.model, o.points, o.late, o.deadline, iso(-25, 10, 0),
      );
      (o.quiz || []).forEach(([q, opts, correct], i) => run('INSERT INTO quiz_questions (requirement_id, ord, question, options, correct) VALUES (?,?,?,?,?)', id, i, q, JSON.stringify(opts), correct));
      return id;
    };
    const quizLei = [
      ['Qual é o lema dos Desbravadores?', ['O amor de Cristo me motiva', 'Sempre alerta', 'Servir é viver', 'Unidos venceremos'], 0],
      ['Complete o Voto: "Pela graça de Deus, serei puro, bondoso e ___"', ['forte', 'leal', 'sábio', 'alegre'], 1],
      ['Qual destes itens faz parte da Lei do Desbravador?', ['Ter sempre um cântico no coração', 'Vencer todas as competições', 'Acampar todo mês', 'Ser o primeiro a chegar'], 0],
      ['Qual é o alvo dos Desbravadores?', ['A mensagem do advento a todo o mundo em minha geração', 'Ganhar todos os camporis', 'Ter o maior clube do distrito', 'Conhecer todas as especialidades'], 0],
    ];
    const quizNos = [
      ['Qual nó une duas cordas de mesma espessura?', ['Nó direito', 'Lais de guia', 'Volta do fiel', 'Nó de escota'], 0],
      ['Qual nó forma uma alça fixa que não corre?', ['Nó corrediço', 'Lais de guia', 'Nó direito', 'Volta redonda'], 1],
      ['Para unir cordas de espessuras diferentes usamos o:', ['Nó de escota', 'Nó direito', 'Nó cego', 'Catau'], 0],
    ];
    const quizSocorros = [
      ['Qual é o número do SAMU?', ['192', '190', '193', '199'], 0],
      ['Em um corte leve, o primeiro passo é:', ['Lavar com água e sabão', 'Passar pó de café', 'Assoprar', 'Cobrir com terra'], 0],
    ];

    const R = {
      clubRelatorio: req({ audience: 'club', title: 'Relatório do Dia Mundial dos Desbravadores', description: 'Conte como foi a programação do seu clube no Dia Mundial dos Desbravadores.', model: 'texto', points: 100, late: 50, deadline: iso(20) }),
      clubFotos: req({ audience: 'club', title: 'Fotos da ação solidária', description: 'Envie fotos da ação solidária realizada pelo clube neste trimestre.', model: 'foto', points: 80, late: 40, deadline: iso(-3) }),
      clubQuiz: req({ audience: 'club', scope: 'distrito', title: 'Quiz da secretaria', description: 'Perguntas rápidas sobre o ideal dos Desbravadores para a secretaria do clube.', model: 'quiz', points: 60, late: 30, deadline: iso(15), quiz: quizLei }),
      unitGrito: req({ audience: 'unit', title: 'Grito de guerra da unidade', description: 'Escreva o grito de guerra da unidade e envie uma foto da unidade reunida.', model: 'texto_foto', points: 60, late: 30, deadline: iso(10) }),
      unitNos: req({ audience: 'unit', title: 'Quiz de nós e amarras', description: 'Respondam juntos, em unidade!', model: 'quiz', points: 50, late: 20, deadline: iso(15), quiz: quizNos }),
      memLei: req({ audience: 'member', title: 'Quiz: Lei e Voto do Desbravador', description: 'Mostre que você conhece o ideal desbravador.', model: 'quiz', points: 40, late: 20, deadline: iso(30), quiz: quizLei }),
      memLeitura: req({ audience: 'member', title: 'Relatório de leitura bíblica', description: 'Leia o livro de Jonas e escreva o que mais chamou a sua atenção.', model: 'texto', points: 30, late: 15, deadline: iso(7) }),
      memFoto: req({ audience: 'member', title: 'Foto com o uniforme de gala', description: 'Envie uma foto sua com o uniforme completo.', model: 'foto', points: 20, late: 10, deadline: iso(-2) }),
      memSocorros: req({ audience: 'member', scope: 'distrito', title: 'Primeiros socorros na prática', description: 'Responda ao quiz e envie uma foto montando um kit de primeiros socorros.', model: 'quiz_foto', points: 50, late: 25, deadline: iso(12), quiz: quizSocorros }),
      aguiasBandeirim: req({ club: 'aguias', audience: 'unit', title: 'Bandeirim da unidade', description: 'Enviem uma foto do bandeirim da unidade finalizado.', model: 'foto', points: 40, late: 20, deadline: iso(5) }),
      aguiasCantinho: req({ club: 'aguias', audience: 'unit', title: 'Relatório da reunião de unidade', description: 'Contem o que foi feito na última reunião da unidade.', model: 'texto', points: 30, late: 10, deadline: iso(-1) }),
      aguiasLeitura: req({ club: 'aguias', audience: 'member', title: 'Leitura do mês: Provérbios', description: 'Leia o livro de Provérbios e conte o versículo de que mais gostou.', model: 'texto', points: 20, late: 10, deadline: iso(18) }),
      leoesCantinho: req({ club: 'leoes', audience: 'unit', title: 'Cantinho da unidade', description: 'Escrevam sobre o cantinho da unidade e enviem uma foto.', model: 'texto_foto', points: 50, late: 25, deadline: iso(8) }),
    };

    const sub = (reqId, type, id, o) => reqId && run(
      `INSERT INTO submissions (requirement_id, submitter_type, submitter_id, text, photos, answers, quiz_correct, quiz_total, status, late, points, submitted_at, reviewed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      reqId, type, id, o.text || null, JSON.stringify(o.photos || []), o.answers ? JSON.stringify(o.answers) : null, o.correct ?? null, o.total ?? null,
      o.status || 'aprovado', o.late ? 1 : 0, o.points || 0, iso(o.at, 15, o.min || 0), o.status === 'enviado' ? null : iso(o.at, 18),
    );
    // Clubes
    sub(R.clubFotos, 'club', clubs.aguias, { photos: [], status: 'aprovado', points: 80, at: -6 });
    sub(R.clubQuiz, 'club', clubs.leoes, { answers: [0, 1, 0, 0], correct: 4, total: 4, points: 60, at: -4 });
    sub(R.clubQuiz, 'club', clubs.aguias, { answers: [0, 1, 1, 0], correct: 3, total: 4, points: 45, at: -5 });
    sub(R.clubFotos, 'club', clubs.leoes, { photos: [], status: 'aprovado', points: 40, late: true, at: -1 });
    // Unidades (gerais)
    sub(R.unitNos, 'unit', units.falcoes, { answers: [0, 1, 0], correct: 3, total: 3, points: 50, at: -7 });
    sub(R.unitNos, 'unit', units.tigres, { answers: [0, 1, 1], correct: 2, total: 3, points: 33, at: -6 });
    sub(R.unitNos, 'unit', units.panteras, { answers: [0, 0, 0], correct: 2, total: 3, points: 33, at: -5 });
    sub(R.unitGrito, 'unit', units.gavioes, { text: 'Gaviões! Olhos no céu, pés no chão, sempre prontos para servir!', photos: [], status: 'enviado', at: -1 });
    // Unidades (requisitos do clube)
    sub(R.aguiasCantinho, 'unit', units.falcoes, { text: 'Fizemos a revisão dos nós e ensaiamos o grito de guerra.', status: 'aprovado', points: 30, at: -3 });
    sub(R.aguiasCantinho, 'unit', units.gavioes, { text: 'Estudamos a classe Amigo e planejamos o bandeirim.', status: 'aprovado', points: 10, late: true, at: 0 });
    sub(R.aguiasBandeirim, 'unit', units.gavioes, { photos: [], status: 'enviado', at: -1 });
    sub(R.leoesCantinho, 'unit', units.tigres, { text: 'Montamos o cantinho com as especialidades da unidade.', photos: [], status: 'aprovado', points: 50, at: -2 });
    // Desbravadores (requisito do clube Águias)
    sub(R.aguiasLeitura, 'member', members.lucas, { text: 'Provérbios 3:5 — confie no Senhor de todo o coração.', status: 'aprovado', points: 20, at: -2 });
    sub(R.aguiasLeitura, 'member', members.beatriz, { text: 'Provérbios 17:17 — o amigo ama em todos os momentos.', status: 'aprovado', points: 20, at: -1 });
    sub(R.aguiasLeitura, 'member', members.gabriel, { text: 'Provérbios 22:6.', status: 'enviado', at: 0 });
    // Membros (desbravadores)
    sub(R.memLei, 'member', members.pedro, { answers: [0, 1, 0, 0], correct: 4, total: 4, points: 40, at: -9 });
    sub(R.memLei, 'member', members.sofia, { answers: [0, 1, 0, 0], correct: 4, total: 4, points: 40, at: -8 });
    sub(R.memLei, 'member', members.lucas, { answers: [0, 1, 0, 1], correct: 3, total: 4, points: 30, at: -8 });
    sub(R.memLei, 'member', members.ana, { answers: [0, 0, 0, 1], correct: 2, total: 4, points: 20, at: -7 });
    sub(R.memLei, 'member', members.rafael, { answers: [0, 1, 1, 0], correct: 3, total: 4, points: 30, at: -6 });
    sub(R.memLeitura, 'member', members.sofia, { text: 'Aprendi que Deus dá segundas chances, como deu a Jonas e a Nínive.', status: 'aprovado', points: 30, at: -3 });
    sub(R.memLeitura, 'member', members.lucas, { text: 'Jonas tentou fugir, mas Deus cuidou dele mesmo assim.', status: 'enviado', at: -1 });
    sub(R.memFoto, 'member', members.isabela, { photos: [], status: 'aprovado', points: 20, at: -4 });
    sub(R.memFoto, 'member', members.davi, { photos: [], status: 'recusado', at: -4 });

    if (!production) {
    // ---------- Medalhas, troféus e eventos ----------
    const medal = (kind, name, icon, description) => ins('INSERT INTO medals (kind, name, icon, description) VALUES (?,?,?,?)', kind, name, icon, description);
    const award = (m, type, id, note) => run('INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by) VALUES (?,?,?,?,?)', m, type, id, note, admin);
    const mesMedal = medal('medalha', 'Melhor clube do mês', 'medal', 'Clube de destaque do mês no distrito.');
    const acampTrophy = medal('trofeu', 'Melhor do acampamento', 'trophy', 'Destaque geral no acampamento do distrito.');
    const anoTrophy = medal('trofeu', 'Melhor clube do ano de 2027', 'trophy', 'Troféu anual do distrito (será entregue no fim de 2027).');
    const unitMedal = medal('medalha', 'Unidade nota 10', 'star', 'Unidade exemplar em organização e espírito de equipe.');
    const destaque = medal('medalha', 'Desbravador destaque', 'award', 'Reconhecimento por dedicação e bom exemplo.');
    void anoTrophy;
    award(mesMedal, 'club', clubs.aguias, 'Setembro de 2026');
    award(acampTrophy, 'club', clubs.leoes, 'Acampamento do Distrito Palmares');
    award(unitMedal, 'unit', units.falcoes, null);
    award(acampTrophy, 'unit', units.tigres, 'Acampamento do Distrito Palmares');
    award(destaque, 'member', members.pedro, 'Acampamento do Distrito Palmares');
    award(destaque, 'member', members.sofia, null);

    const ev1 = ins('INSERT INTO events (name, description, date, location, district_id) VALUES (?,?,?,?,?)', 'Acampamento do Distrito Palmares', 'Três dias de atividades, especialidades e muita comunhão.', dateOnly(-30), 'Sítio Recanto Verde', palmares);
    const ev2 = ins('INSERT INTO events (name, description, date, location, district_id) VALUES (?,?,?,?,?)', 'Dia Mundial dos Desbravadores', 'Desfile e programação especial nas igrejas do distrito.', dateOnly(-14), 'Praça Central de Palmares', palmares);
    ins('INSERT INTO events (name, description, date, location, district_id, promote) VALUES (?,?,?,?,?,1)', 'Campori do Distrito Palmares',
      'Quatro dias de acampamento com todos as unidades do distrito: especialidades, gincanas, ordem unida e programação espiritual. Evento gratuito — confirme a inscrição com a diretoria do seu clube.',
      dateOnly(40), 'Parque Ecológico de Palmares', palmares);
    const part = (e, type, id) => run('INSERT INTO event_participants (event_id, target_type, target_id) VALUES (?,?,?)', e, type, id);
    part(ev1, 'club', clubs.aguias); part(ev1, 'club', clubs.leoes);
    for (const m of ['pedro', 'lucas', 'beatriz', 'marcos', 'juliana', 'sofia', 'isabela', 'carlos']) part(ev1, 'member', members[m]);
    part(ev2, 'club', clubs.aguias);
    for (const m of ['pedro', 'ana', 'marcos']) part(ev2, 'member', members[m]);

    // Anúncio de exemplo
    run('INSERT INTO announcements (title, body, link) VALUES (?,?,?)', 'Bem-vindo ao App do DBV!',
      'Agora o seu clube está no celular: cumpra requisitos, acompanhe o ranking, informe suas classes e especialidades e converse com a sua unidade.', null);

    }

    // ---------- Chat ----------
    const conv = (type, o) => ins('INSERT INTO conversations (type, club_id, unit_id, member_a, member_b) VALUES (?,?,?,?,?)', type, o.club ?? null, o.unit ?? null, o.a ?? null, o.b ?? null);
    const msg = (c, st, sid, body, minutesAgo) => {
      const at = new Date(Date.now() - minutesAgo * 6e4).toISOString();
      const id = ins(`INSERT INTO messages (conversation_id, sender_type, sender_id, kind, body, created_at) VALUES (?,?,?,'texto',?,?)`, c, st, sid, body, at);
      run('UPDATE conversations SET last_message_at = ? WHERE id = ?', at, c);
      return id;
    };
    const read = (c, t, id, last) => run('INSERT OR REPLACE INTO conversation_reads (conversation_id, reader_type, reader_id, last_read_id) VALUES (?,?,?,?)', c, t, id, last);
    const falcoes = conv('unidade', { unit: units.falcoes, club: clubs.aguias });
    msg(falcoes, 'member', members.juliana, 'Bom dia, Falcões! Não esqueçam o lenço no sábado.', 300);
    let last = msg(falcoes, 'member', members.pedro, 'Pode deixar, conselheira!', 290);
    read(falcoes, 'member', members.pedro, last);
    msg(falcoes, 'member', members.lucas, 'Vou levar a corda para treinarmos os nós.', 120);
    const dirPedro = conv('diretoria', { club: clubs.aguias, a: members.pedro });
    msg(dirPedro, 'member', members.pedro, 'Olá, diretoria! O uniforme de gala chega quando?', 200);
    last = msg(dirPedro, 'club', clubs.aguias, 'Oi, Pedro! Chega na próxima semana. Avisaremos na conversa da unidade.', 180);
    read(dirPedro, 'member', members.pedro, last);
    read(dirPedro, 'club', clubs.aguias, last);
    const dirAna = conv('diretoria', { club: clubs.aguias, a: members.ana });
    msg(dirAna, 'member', members.ana, 'Posso levar minha irmã para conhecer o clube?', 45);
    const direct = conv('direta', { a: Math.min(members.pedro, members.lucas), b: Math.max(members.pedro, members.lucas) });
    msg(direct, 'member', members.lucas, 'Bora treinar o lais de guia amanhã?', 60);
    const tigres = conv('unidade', { unit: units.tigres, club: clubs.leoes });
    msg(tigres, 'member', members.sofia, 'Tigres, conseguimos o 1º lugar no cantinho!', 90);

    // ---------- Agenda, tesouraria, patrimônio e fichas para atualizar ----------
    const dia = (n) => new Date(Date.now() + n * day).toISOString().slice(0, 10);
    const agenda = (creator, scope, club, district, title, date, extra = {}) => run(
      'INSERT INTO agenda_items (creator_type, club_id, scope, district_id, title, description, location, date, end_date, time, color) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      creator, club, scope, district, title, extra.description || null, extra.location || null, date, extra.end || null, extra.time || null, extra.color || 'verde',
    );
    agenda('club', 'clube', clubs.aguias, null, 'Reunião do clube', dia(3), { time: '09:00', location: 'Igreja Central', color: 'azul' });
    agenda('club', 'clube', clubs.aguias, null, 'Acampamento de primavera', dia(24), { end: dia(26), location: 'Sítio Boa Vista', description: 'Levar barraca, lanterna e saco de dormir.', color: 'laranja' });
    agenda('club', 'clube', clubs.leoes, null, 'Ordem unida', dia(5), { time: '15:00', color: 'preto' });
    agenda('admin', 'geral', null, null, 'Campori App do DBV', dia(40), { end: dia(43), location: 'Parque Nacional', description: 'Evento para todos os clubes.', color: 'vermelho' });
    agenda('admin', 'distrito', null, palmares, 'Encontro do Distrito Palmares', dia(12), { time: '08:00', color: 'roxo' });
    const fin = (c, kind, description, cents, n) => run('INSERT INTO club_finance (club_id, kind, description, amount_cents, date) VALUES (?,?,?,?,?)', c, kind, description, cents, dia(n));
    fin(clubs.aguias, 'entrada', 'Venda de pizza', 85000, -20);
    fin(clubs.aguias, 'saida', 'Lenços e distintivos', 32050, -15);
    fin(clubs.aguias, 'entrada', 'Inscrições do acampamento', 120000, -5);
    const bem = (c, name, cents, notes) => run('INSERT INTO club_assets (club_id, name, price_cents, acquired_at, notes) VALUES (?,?,?,?,?)', c, name, cents, dia(-90), notes);
    bem(clubs.aguias, 'Barraca 6 pessoas', 45990, '2 unidades');
    bem(clubs.aguias, 'Bandeira do clube', 18000, null);
    bem(clubs.aguias, 'Caixa de primeiros socorros', 12500, 'Revisar validade dos remédios');
    // Fichas do ano passado: aparecem como "desatualizadas" para o clube atualizar.
    const anoPassado = `${new Date().getFullYear() - 1}-08-15T12:00:00.000Z`;
    for (const k of ['ana', 'sofia']) run('UPDATE member_records SET updated_at = ? WHERE member_id = ?', anoPassado, members[k]);
  });
}

/**
 * Banco de verdade: só o acesso do Administrador Geral (login "admin").
 * A senha vem da variável ADMIN_PASSWORD (nunca fica no código, que é público).
 * Clubes, unidades e membros são criados pelo próprio app e nunca são apagados aqui.
 */
export function createInitialAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('ADMIN_PASSWORD não definida: o acesso do administrador será criado quando ela for configurada.');
    return false;
  }
  tx(() => {
    const admin = ins(`INSERT INTO admins (name) VALUES ('Administrador Geral')`);
    login('admin', admin, 'admin', password);
  });
  console.log('Acesso do administrador criado (login: admin).');
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--reset')) resetDatabase();
  if (get('SELECT 1 FROM admins LIMIT 1')) {
    console.log('O banco já tem dados. Use "npm run seed" para recriar.');
  } else {
    seed();
    console.log('Dados de exemplo criados.');
  }
}

/**
 * Apaga todos os clubes (com unidades, membros, conversas e envios deles), mantendo o
 * administrador, os distritos, o catálogo, os cursos e o que é do admin.
 */
export function wipeClubs() {
  tx(() => {
    run(`DELETE FROM submissions WHERE submitter_type IN ('club','unit','member')`);
    run(`DELETE FROM medal_awards WHERE target_type IN ('club','unit','member')`);
    run(`DELETE FROM event_participants WHERE target_type IN ('club','unit','member')`);
    run(`DELETE FROM blocks`);
    run(`DELETE FROM conversations`);
    run(`DELETE FROM logins WHERE account_type IN ('club','unit','member')`);
    run(`DELETE FROM requirements WHERE creator_type IN ('club','unit')`);
    run(`DELETE FROM support_threads WHERE actor_type IN ('club','unit','member')`);
    run(`DELETE FROM agenda_items WHERE creator_type = 'club' OR scope = 'clube'`);
    run(`DELETE FROM members`);
    run(`DELETE FROM units`);
    run(`DELETE FROM clubs`);
  });
}

/**
 * Uma vez (pedido do dono do app): apaga os clubes que existiam para criar de novo e
 * deixa só o Distrito Palmares. O administrador e o catálogo continuam.
 * Com os dados de exemplo recém-criados (SEED_DEMO=1), só marca como feito.
 */
export function resetClubsForDbvOnce({ justSeeded = false } = {}) {
  const KEY = 'reset-dbv-v1';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return;
  if (!justSeeded) {
    wipeClubs();
    tx(() => {
      run(`DELETE FROM support_messages`);
      run(`DELETE FROM support_threads`);
      run(`DELETE FROM agenda_items WHERE creator_type = 'club' OR scope = 'clube'`);
      const pal = get(`SELECT id FROM districts WHERE name = 'Distrito Palmares'`)?.id || Number(run(`INSERT INTO districts (name) VALUES ('Distrito Palmares')`).lastInsertRowid);
      run('UPDATE requirements SET district_id = ? WHERE district_id IS NOT NULL AND district_id <> ?', pal, pal);
      run('UPDATE agenda_items SET district_id = ? WHERE district_id IS NOT NULL AND district_id <> ?', pal, pal);
      run('DELETE FROM districts WHERE id <> ?', pal);
    });
    console.log('Clubes apagados para criar de novo; só o Distrito Palmares ficou.');
  }
  run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
}

/**
 * Uma vez: troca os clubes que existiam pelos clubes de teste (pedido do dono do app,
 * enquanto ninguém usa a plataforma). Se os dados de exemplo acabaram de ser
 * criados (SEED_DEMO=1), só marca como feito.
 */
export function resetToDemoClubsOnce({ justSeeded = false } = {}) {
  const KEY = 'demo-clubs-v1';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return;
  // Não cria mais clubes de teste no ar (os clubes são criados pelo administrador).
  void justSeeded;
  run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
}

/**
 * Uma vez (pedido do dono do app): apaga todos os clubes que existem no ar (com unidades e
 * membros) e cria os clubes de teste com os botões de "entrar como". O administrador e a
 * senha dele não mudam. Com os dados de exemplo recém-criados (SEED_DEMO=1), só marca.
 */
export function resetToTestClubsOnce({ justSeeded = false } = {}) {
  const KEY = 'clubes-teste-v2';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return;
  if (!justSeeded) {
    wipeClubs();
    seed({ production: true });
    console.log('Clubes apagados e clubes de teste criados (o administrador continua o mesmo).');
  }
  run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
}
