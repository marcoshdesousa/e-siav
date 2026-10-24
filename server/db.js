import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARGOS_RENOMEADOS, NOME_UNIDADE_LIDERANCA } from './config.js';

/** Pasta raiz do projeto (independe da pasta onde o servidor foi iniciado). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
// Arquivos privados (fotos/áudios do chat e fotos de comprovação): só com login.
export const PRIVATE_DIR = path.join(DATA_DIR, 'private');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'dbv.sqlite');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS districts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Credenciais de todas as contas (usuário único na plataforma).
CREATE TABLE IF NOT EXISTS logins (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('admin','club','unit','member')),
  account_id INTEGER NOT NULL,
  UNIQUE (account_type, account_id)
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  name TEXT NOT NULL,
  photo TEXT,
  logo TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo TEXT,
  is_leadership INTEGER NOT NULL DEFAULT 0 CHECK (is_leadership IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (club_id, name)
);

-- Membros: sem CPF. Apenas o necessário.
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  photo TEXT,
  cargo TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  excellence INTEGER NOT NULL DEFAULT 0 CHECK (excellence IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('admin','club')),
  club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('club','unit','member')),
  scope TEXT NOT NULL DEFAULT 'geral' CHECK (scope IN ('geral','distrito','clube')),
  district_id INTEGER REFERENCES districts(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL CHECK (model IN ('texto','foto','quiz','texto_foto','quiz_foto')),
  points INTEGER NOT NULL CHECK (points >= 0),
  late_points INTEGER NOT NULL DEFAULT 0 CHECK (late_points >= 0),
  deadline TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (late_points <= points),
  -- Requisito de clube vale só para as unidades e os desbravadores daquele clube.
  CHECK (creator_type = 'admin' OR (audience IN ('unit','member') AND club_id IS NOT NULL AND scope = 'clube')),
  CHECK (creator_type = 'club' OR (club_id IS NULL AND scope IN ('geral','distrito'))),
  CHECK (scope <> 'distrito' OR district_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  submitter_type TEXT NOT NULL CHECK (submitter_type IN ('club','unit','member')),
  submitter_id INTEGER NOT NULL,
  text TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  answers TEXT,
  quiz_correct INTEGER,
  quiz_total INTEGER,
  status TEXT NOT NULL CHECK (status IN ('enviado','aprovado','recusado')),
  late INTEGER NOT NULL DEFAULT 0 CHECK (late IN (0,1)),
  points INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE (requirement_id, submitter_type, submitter_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_submitter ON submissions(submitter_type, submitter_id);

CREATE TABLE IF NOT EXISTS medals (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('medalha','trofeu')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Entrega sempre manual, feita pelo Administrador Geral.
CREATE TABLE IF NOT EXISTS medal_awards (
  id INTEGER PRIMARY KEY,
  medal_id INTEGER NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('club','unit','member')),
  target_id INTEGER NOT NULL,
  note TEXT,
  awarded_by INTEGER NOT NULL REFERENCES admins(id),
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  district_id INTEGER REFERENCES districts(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS event_participants (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('club','member')),
  target_id INTEGER NOT NULL,
  PRIMARY KEY (event_id, target_type, target_id)
);

-- Especialidades, classes e cursos (criados só pelo Administrador Geral).
CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('especialidade','classe','curso')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'book',
  category TEXT NOT NULL DEFAULT '',
  age INTEGER,
  leader INTEGER NOT NULL DEFAULT 0 CHECK (leader IN (0,1)),
  is_free INTEGER NOT NULL DEFAULT 1 CHECK (is_free IN (0,1)),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (is_free = 1 OR price_cents > 0)
);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS content_progress (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  answer TEXT,
  done_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (member_id, item_id)
);

CREATE TABLE IF NOT EXISTS content_access (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('compra','admin')),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (member_id, content_id)
);

-- Estrutura de compra pronta; o meio de pagamento será plugado depois.
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente','pago','cancelado')),
  provider TEXT,
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT
);

-- Classes e especialidades concluídas (registradas pelo clube ou feitas online).
CREATE TABLE IF NOT EXISTS achievements (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('clube','online','admin')),
  date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (member_id, content_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('unidade','diretoria','direta')),
  club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
  member_a INTEGER REFERENCES members(id) ON DELETE CASCADE,
  member_b INTEGER REFERENCES members(id) ON DELETE CASCADE,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (type <> 'unidade' OR unit_id IS NOT NULL),
  CHECK (type <> 'diretoria' OR (club_id IS NOT NULL AND member_a IS NOT NULL)),
  CHECK (type <> 'direta' OR (member_a IS NOT NULL AND member_b IS NOT NULL AND member_a < member_b))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_unit ON conversations(unit_id) WHERE type = 'unidade';
CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_dir ON conversations(member_a) WHERE type = 'diretoria';
CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_direct ON conversations(member_a, member_b) WHERE type = 'direta';

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('member','club')),
  sender_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('texto','audio','foto')),
  body TEXT,
  media TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (kind = 'texto' OR media IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reader_type TEXT NOT NULL,
  reader_id INTEGER NOT NULL,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, reader_type, reader_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_type TEXT NOT NULL CHECK (blocker_type IN ('member','club')),
  blocker_id INTEGER NOT NULL,
  blocked_type TEXT NOT NULL CHECK (blocked_type IN ('member','club')),
  blocked_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (blocker_type, blocker_id, blocked_type, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('member','club')),
  reporter_id INTEGER NOT NULL,
  club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  reported_club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  reported_type TEXT,
  reported_id INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Transferência de membro entre clubes: o clube novo pede, o clube antigo aceita
-- e o clube novo confirma. Só então o membro muda de clube (com todo o histórico).
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  from_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  to_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente_origem'
    CHECK (status IN ('pendente_origem','pendente_destino','concluida','recusada','cancelada')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  CHECK (from_club_id <> to_club_id)
);

-- ===== Regras de integridade garantidas no próprio banco =====

-- O membro só troca de clube por uma transferência aceita pelos dois clubes.
CREATE TRIGGER IF NOT EXISTS trg_member_club_immutable
BEFORE UPDATE OF club_id ON members WHEN NEW.club_id <> OLD.club_id
  AND NOT EXISTS (SELECT 1 FROM transfers t WHERE t.member_id = NEW.id AND t.to_club_id = NEW.club_id AND t.status = 'concluida')
BEGIN SELECT RAISE(ABORT, 'O clube de um membro só muda por transferência aceita'); END;

CREATE TRIGGER IF NOT EXISTS trg_unit_club_immutable
BEFORE UPDATE OF club_id ON units WHEN NEW.club_id <> OLD.club_id
BEGIN SELECT RAISE(ABORT, 'O clube de uma unidade não pode ser alterado'); END;

-- A unidade do membro precisa ser do mesmo clube.
CREATE TRIGGER IF NOT EXISTS trg_member_unit_club_ins
BEFORE INSERT ON members WHEN NEW.unit_id IS NOT NULL
  AND (SELECT club_id FROM units WHERE id = NEW.unit_id) IS NOT NEW.club_id
BEGIN SELECT RAISE(ABORT, 'A unidade pertence a outro clube'); END;

CREATE TRIGGER IF NOT EXISTS trg_member_unit_club_upd
BEFORE UPDATE OF unit_id ON members WHEN NEW.unit_id IS NOT NULL
  AND (SELECT club_id FROM units WHERE id = NEW.unit_id) IS NOT NEW.club_id
BEGIN SELECT RAISE(ABORT, 'A unidade pertence a outro clube'); END;

-- Envio precisa vir do público do requisito.
CREATE TRIGGER IF NOT EXISTS trg_submission_audience
BEFORE INSERT ON submissions
WHEN (SELECT audience FROM requirements WHERE id = NEW.requirement_id) IS NOT NEW.submitter_type
BEGIN SELECT RAISE(ABORT, 'Este requisito não é para este tipo de conta'); END;

-- Requisito criado por um clube só aceita envios das unidades daquele clube.
CREATE TRIGGER IF NOT EXISTS trg_submission_club_req2
BEFORE INSERT ON submissions
WHEN (SELECT creator_type FROM requirements WHERE id = NEW.requirement_id) = 'club'
  AND (SELECT club_id FROM requirements WHERE id = NEW.requirement_id)
      IS NOT (CASE NEW.submitter_type
                WHEN 'unit' THEN (SELECT club_id FROM units WHERE id = NEW.submitter_id)
                WHEN 'member' THEN (SELECT club_id FROM members WHERE id = NEW.submitter_id)
              END)
BEGIN SELECT RAISE(ABORT, 'Requisito de outro clube'); END;

-- Medalhas nunca são entregues por gatilho automático: só por um administrador.
CREATE TRIGGER IF NOT EXISTS trg_award_requires_admin
BEFORE INSERT ON medal_awards
WHEN (SELECT id FROM admins WHERE id = NEW.awarded_by) IS NULL
BEGIN SELECT RAISE(ABORT, 'Somente o Administrador Geral entrega medalhas'); END;
`;

db.exec(SCHEMA);
migrate();

/**
 * Migrações: só acrescentam colunas e tabelas, preservando os dados de quem
 * já usa o app. Cada passo é idempotente.
 */
function migrate() {
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  const add = (t, col, def) => {
    if (!cols(t).includes(col)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
  };

  // @ do membro (usado para ser encontrado no chat e no link do perfil)
  add('members', 'handle', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_member_handle ON members(handle COLLATE NOCASE) WHERE handle IS NOT NULL');

  // Requisitos: combinação livre de envio (texto, foto, quiz) e fotos de exemplo
  add('requirements', 'modes', 'TEXT');
  add('requirements', 'images', "TEXT NOT NULL DEFAULT '[]'");

  // Conteúdo: imagem/insígnia própria; requisitos das classes com envio e avaliação
  add('content', 'image', 'TEXT');
  add('content_items', 'modes', "TEXT NOT NULL DEFAULT ''");
  add('content_items', 'images', "TEXT NOT NULL DEFAULT '[]'");
  for (const [c, d] of [['status', "TEXT NOT NULL DEFAULT 'aprovado'"], ['text', 'TEXT'], ['photos', "TEXT NOT NULL DEFAULT '[]'"], ['answers', 'TEXT'],
    ['quiz_correct', 'INTEGER'], ['quiz_total', 'INTEGER'], ['feedback', 'TEXT'], ['submitted_at', 'TEXT'], ['reviewed_at', 'TEXT']]) add('content_progress', c, d);
  db.exec(`CREATE TABLE IF NOT EXISTS content_item_questions (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    ord INTEGER NOT NULL DEFAULT 0,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct INTEGER NOT NULL
  )`);

  // Conquistas entregues pelo Administrador Geral (origem "admin"): recria a tabela se preciso
  const achSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'achievements'").get()?.sql || '';
  if (!achSql.includes("'admin'")) {
    db.exec(`PRAGMA foreign_keys = OFF; BEGIN;
      CREATE TABLE achievements_new (
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('clube','online','admin')),
        date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (member_id, content_id));
      INSERT INTO achievements_new SELECT member_id, content_id, source, date FROM achievements;
      DROP TABLE achievements; ALTER TABLE achievements_new RENAME TO achievements;
      COMMIT; PRAGMA foreign_keys = ON;`);
  }

  // Requisitos do clube também para os desbravadores do clube: amplia a regra antiga
  // (recria a tabela preservando tudo; os ids continuam os mesmos).
  const reqSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'requirements'").get()?.sql || '';
  if (reqSql.includes("audience = 'unit' AND club_id IS NOT NULL")) {
    const newSql = reqSql
      .replace('CREATE TABLE requirements', 'CREATE TABLE requirements_new')
      .replace('CREATE TABLE IF NOT EXISTS requirements', 'CREATE TABLE requirements_new')
      .replace("audience = 'unit' AND club_id IS NOT NULL", "audience IN ('unit','member') AND club_id IS NOT NULL");
    const columns = cols('requirements').join(', ');
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(newSql);
      db.exec(`INSERT INTO requirements_new (${columns}) SELECT ${columns} FROM requirements`);
      db.exec('DROP TABLE requirements');
      db.exec('PRAGMA legacy_alter_table = ON');
      db.exec('ALTER TABLE requirements_new RENAME TO requirements');
      db.exec('PRAGMA legacy_alter_table = OFF');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
  db.exec('DROP TRIGGER IF EXISTS trg_submission_club_req');

  // Eventos e anúncios do clube (só para os membros dele) e público-alvo dos anúncios
  add('events', 'club_id', 'INTEGER REFERENCES clubs(id) ON DELETE CASCADE');

  // Eventos com anexos (PDF ou fotos)
  add('events', 'attachments', "TEXT NOT NULL DEFAULT '[]'");

  // Chat: apagar para todos, apagar para mim, limpar, arquivar e apagar conversa
  add('messages', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS message_hidden (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL, user_id INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_type, user_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS conversation_user (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL, user_id INTEGER NOT NULL,
    cleared_id INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, user_type, user_id)
  )`);
  // Cópia da mensagem denunciada (continua visível para quem analisa, mesmo se apagada)
  add('reports', 'snapshot', 'TEXT');

  // Pedidos do membro: "tenho esta classe/especialidade" → a diretoria do clube aprova
  db.exec(`CREATE TABLE IF NOT EXISTS achievement_requests (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    reviewed_at TEXT
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_ach_req_pending ON achievement_requests(member_id, content_id) WHERE status = 'pendente'`);
  // Especialidade adicionada pela diretoria de um clube (quando falta no catálogo)
  add('content', 'code', 'TEXT'); // código oficial da especialidade (ex.: do manual)
  add('content', 'added_by_club', 'INTEGER REFERENCES clubs(id) ON DELETE SET NULL');
  // Eventos aparecem na abertura do app até a data do evento
  add('events', 'promote', 'INTEGER NOT NULL DEFAULT 1');

  // Anúncios que aparecem ao abrir o app
  db.exec(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    image TEXT,
    link TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  add('announcements', 'club_id', 'INTEGER REFERENCES clubs(id) ON DELETE CASCADE'); // criado pela diretoria do clube
  add('announcements', 'target_type', "TEXT NOT NULL DEFAULT 'all'"); // all | district | club
  add('announcements', 'target_id', 'INTEGER');
  // Marcas de tarefas de manutenção que só rodam uma vez.
  db.exec('CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY)');

  // Uma vez: recria os gatilhos para as mensagens usarem os nomes novos (Clube, Unidade).
  if (!db.prepare(`SELECT 1 FROM app_flags WHERE key = 'trigger-names-cla'`).get()) {
    for (const t of ['trg_member_club_immutable', 'trg_unit_club_immutable', 'trg_member_unit_club_ins', 'trg_member_unit_club_upd', 'trg_submission_club_req2']) {
      db.exec(`DROP TRIGGER IF EXISTS ${t}`);
    }
    db.exec(SCHEMA);
    db.exec(`INSERT INTO app_flags (key) VALUES ('trigger-names-cla')`);
  }

  // Desbravadores: a unidade da liderança se chama "Liderança" e cargos antigos ganham o nome dos Desbravadores.
  db.prepare(`UPDATE units SET name = ? WHERE is_leadership = 1 AND name IN ('Tutores', 'Conselheiros', 'Liderança')`).run(NOME_UNIDADE_LIDERANCA);
  for (const [old, novo] of Object.entries(CARGOS_RENOMEADOS)) db.prepare('UPDATE members SET cargo = ? WHERE cargo = ?').run(novo, old);

  const flag = (key) => !!db.prepare('SELECT 1 FROM app_flags WHERE key = ?').get(key);
  const setFlag = (key) => db.prepare('INSERT OR IGNORE INTO app_flags (key) VALUES (?)').run(key);

  // Clube: código de 4 dígitos (0001, 0002...), nome do diretor e história.
  add('clubs', 'code', 'TEXT');
  add('clubs', 'director_name', 'TEXT');
  add('clubs', 'associate_directors', 'TEXT'); // um nome por linha; só o admin muda
  add('clubs', 'history', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_club_code ON clubs(code) WHERE code IS NOT NULL');
  for (const c of db.prepare('SELECT id FROM clubs WHERE code IS NULL ORDER BY id').all()) {
    const max = db.prepare('SELECT MAX(CAST(code AS INTEGER)) n FROM clubs').get().n || 0;
    db.prepare('UPDATE clubs SET code = ? WHERE id = ?').run(String(max + 1).padStart(4, '0'), c.id);
  }

  // Unidade: senha de 4 números gerada pelo app (única dentro do clube). Entra com o código do clube.
  add('units', 'pin', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_unit_pin ON units(club_id, pin) WHERE pin IS NOT NULL');
  for (const u of db.prepare('SELECT id, club_id FROM units WHERE pin IS NULL').all()) {
    for (;;) {
      const pin = String(crypto.randomInt(10000)).padStart(4, '0');
      if (db.prepare('SELECT 1 FROM units WHERE club_id = ? AND pin = ?').get(u.club_id, pin)) continue;
      db.prepare('UPDATE units SET pin = ? WHERE id = ?').run(pin, u.id);
      break;
    }
  }

  // Membro: código de 6 números, CPF (um clube por pessoa), situação e ficha (cadastro, médica, termos).
  add('members', 'cpf', 'TEXT');
  add('members', 'status', "TEXT NOT NULL DEFAULT 'ativo'");
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_member_cpf ON members(cpf) WHERE cpf IS NOT NULL');
  // Quem ainda não tem CPF se identifica pela certidão de nascimento.
  add('members', 'birth_cert', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_member_birth_cert ON members(birth_cert) WHERE birth_cert IS NOT NULL');
  db.exec(`CREATE TABLE IF NOT EXISTS member_records (
    member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '{}',
    terms_accepted_at TEXT,
    updated_at TEXT
  )`);
  for (const m of db.prepare(`SELECT id FROM members WHERE NOT (code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]')`).all()) {
    for (;;) {
      const code = String(crypto.randomInt(100000, 1000000));
      if (db.prepare('SELECT 1 FROM members WHERE code = ?').get(code)) continue;
      db.prepare('UPDATE members SET code = ? WHERE id = ?').run(code, m.id);
      break;
    }
  }

  // Uma vez: o gatilho do clube do membro passa a aceitar transferências concluídas.
  if (!flag('trigger-transfer')) {
    db.exec('DROP TRIGGER IF EXISTS trg_member_club_immutable');
    db.exec(SCHEMA);
    setFlag('trigger-transfer');
  }

  // Requisitos criados pela unidade (para os desbravadores da unidade) e requisitos de membro
  // só para desbravadores ou só para tutores/liderança. Recria a tabela preservando os ids.
  const reqSql2 = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'requirements'").get()?.sql || '';
  if (!reqSql2.includes("creator_type IN ('admin','club','unit')")) {
    let newSql = reqSql2.replace(/CREATE TABLE( IF NOT EXISTS)? "?requirements"?/, 'CREATE TABLE requirements_new');
    const swaps = [
      ["creator_type IN ('admin','club')", "creator_type IN ('admin','club','unit')"],
      ["scope IN ('geral','distrito','clube')", "scope IN ('geral','distrito','clube','grupo')"],
      ["club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,",
        "club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,\n  unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,\n  member_kind TEXT CHECK (member_kind IN ('desbravador','lideranca')),"],
      ["CHECK (creator_type = 'admin' OR (audience IN ('unit','member') AND club_id IS NOT NULL AND scope = 'clube'))",
        "CHECK (creator_type <> 'club' OR (audience IN ('unit','member') AND club_id IS NOT NULL AND scope = 'clube'))," +
        "\n  CHECK (creator_type <> 'unit' OR (audience = 'member' AND club_id IS NOT NULL AND unit_id IS NOT NULL AND scope = 'grupo'))"],
      ["CHECK (creator_type = 'club' OR (club_id IS NULL AND scope IN ('geral','distrito')))",
        "CHECK (creator_type <> 'admin' OR (club_id IS NULL AND scope IN ('geral','distrito')))"],
    ];
    for (const [a, b] of swaps) {
      if (!newSql.includes(a)) throw new Error('Migração de requisitos: trecho não encontrado: ' + a);
      newSql = newSql.replace(a, b);
    }
    const columns = cols('requirements').join(', ');
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(newSql);
      db.exec(`INSERT INTO requirements_new (${columns}) SELECT ${columns} FROM requirements`);
      db.exec('DROP TABLE requirements');
      db.exec('PRAGMA legacy_alter_table = ON');
      db.exec('ALTER TABLE requirements_new RENAME TO requirements');
      db.exec('PRAGMA legacy_alter_table = OFF');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }
  // Uma vez: requisitos de membro que já existiam eram só para desbravadores.
  if (!flag('member-kind-default')) {
    db.exec(`UPDATE requirements SET member_kind = 'desbravador' WHERE audience = 'member' AND member_kind IS NULL`);
    setFlag('member-kind-default');
  }
  // Número do clube (1º, 2º...), separado do código.
  add('clubs', 'number', 'INTEGER');
  for (const c of db.prepare('SELECT id FROM clubs WHERE number IS NULL ORDER BY id').all()) {
    const n = (db.prepare('SELECT MAX(number) n FROM clubs').get().n || 0) + 1;
    db.prepare('UPDATE clubs SET number = ? WHERE id = ?').run(n, c.id);
  }
  // Senha das unidades no formato novo: 2 letras + 4 números.
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (const u of db.prepare(`SELECT id, club_id FROM units WHERE pin IS NULL OR NOT (pin GLOB '[A-Z][A-Z][0-9][0-9][0-9][0-9]')`).all()) {
    for (;;) {
      const pin = LETRAS[crypto.randomInt(24)] + LETRAS[crypto.randomInt(24)] + String(crypto.randomInt(10000)).padStart(4, '0');
      if (db.prepare('SELECT 1 FROM units WHERE club_id = ? AND pin = ?').get(u.club_id, pin)) continue;
      db.prepare('UPDATE units SET pin = ? WHERE id = ?').run(pin, u.id);
      break;
    }
  }

  // Link do termo: o clube cadastra o membro e o responsável assina pelo link.
  add('members', 'terms_token', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_member_terms_token ON members(terms_token) WHERE terms_token IS NOT NULL');

  // Taxas: parcelas mensais do clube e taxa anual por membro (pagas no Pix).
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  for (const [k, v] of [['fee_member_year_cents', '250'], ['fee_club_month_cents', '3085'], ['club_installments', '12'], ['pix_key', '']]) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS club_installments (
    id INTEGER PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    n INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at TEXT,
    UNIQUE (club_id, n)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS member_fees (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at TEXT NOT NULL,
    PRIMARY KEY (member_id, year)
  )`);

  // Cadastro do membro: aprovado pelo clube e taxa paga. Só depois disso fica ativo.
  add('members', 'approved_at', 'TEXT');
  add('members', 'fee_cleared_at', 'TEXT');
  if (!flag('member-approval-fee-v1')) {
    // Quem já existia: aprovado (menos inscrições esperando aprovação) e, se ativo, sem cobrar de novo.
    db.exec(`UPDATE members SET approved_at = COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
             WHERE approved_at IS NULL AND NOT (status = 'pendente' AND terms_token IS NULL)`);
    db.exec(`UPDATE members SET fee_cleared_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE fee_cleared_at IS NULL AND status <> 'pendente'`);
    setFlag('member-approval-fee-v1');
  }

  // Inscrição anual: o ano até quando o membro está liberado. Quem já estava liberado fica no ano atual.
  add('members', 'cleared_year', 'INTEGER');
  // Skin escolhida para os jogos (personagem m01..m30 / f01..f30 e skate b01..b30)
  add('members', 'game_skin', 'TEXT');
  add('members', 'game_board', 'TEXT');
  // Administrador de distrito: cuida só do distrito dele (sem distrito = administrador geral).
  add('admins', 'district_id', 'INTEGER REFERENCES districts(id)');
  if (!flag('member-cleared-year-v1')) {
    db.prepare('UPDATE members SET cleared_year = ? WHERE cleared_year IS NULL AND fee_cleared_at IS NOT NULL').run(new Date().getFullYear());
    setFlag('member-cleared-year-v1');
  }
  // Pedidos de pagamento da inscrição anual: o clube escolhe os membros e paga no Pix; a equipe confirma.
  db.exec(`CREATE TABLE IF NOT EXISTS fee_orders (
    id INTEGER PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    member_ids TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    confirmed_at TEXT,
    canceled_at TEXT
  )`);

  // Agenda: o clube marca as suas datas; o admin marca para todos, um distrito ou um clube.
  db.exec(`CREATE TABLE IF NOT EXISTS agenda_items (
    id INTEGER PRIMARY KEY,
    creator_type TEXT NOT NULL CHECK (creator_type IN ('admin','club')),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('geral','distrito','clube')),
    district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    date TEXT NOT NULL,
    end_date TEXT,
    time TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  // Dias escolhidos um a um (ex.: acampamento de sexta a domingo, ou dias soltos da semana).
  add('agenda_items', 'dates', 'TEXT');
  add('agenda_items', 'color', 'TEXT'); // uma das 6 cores para identificar no calendário
  // Tesouraria: controle financeiro do próprio clube (entradas e saídas, só anotação).
  db.exec(`CREATE TABLE IF NOT EXISTS club_finance (
    id INTEGER PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('entrada','saida')),
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  // Patrimônio do clube: foto, nome e quanto custou.
  db.exec(`CREATE TABLE IF NOT EXISTS club_assets (
    id INTEGER PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    photo TEXT,
    price_cents INTEGER,
    acquired_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('support_whatsapp', '')`).run();

  // App secundário ao SGC: sem inscrição pelo link, ficha, termo ou taxas. Quem estava
  // pendente (esperando termo, aprovação ou pagamento) fica ativo.
  if (!flag('sem-inscricao-v1')) {
    db.exec(`UPDATE members SET status = 'ativo', terms_token = NULL, approved_at = COALESCE(approved_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE status = 'pendente'`);
    setFlag('sem-inscricao-v1');
  }
  // Links dos sites que abrem dentro do app (o admin cadastra): SGC (clube),
  // Cantinho da Unidade (unidade) e Cartão DBV (membro).
  for (const k of ['link_sgc', 'link_cantinho', 'link_cartao']) db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, '');
  // Chat de suporte: cada conta (clube, unidade, membro) conversa com a equipe.
  db.exec(`CREATE TABLE IF NOT EXISTS support_threads (
    id INTEGER PRIMARY KEY,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('club','unit','member')),
    actor_id INTEGER NOT NULL,
    last_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    admin_unread INTEGER NOT NULL DEFAULT 0,
    user_unread INTEGER NOT NULL DEFAULT 0,
    UNIQUE (actor_type, actor_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user','admin')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  // Mini jogos: recorde (best), soma dos pontos (total) e partidas de cada membro em cada jogo.
  db.exec(`CREATE TABLE IF NOT EXISTS game_scores (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    best INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    plays INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (member_id, game)
  )`);

  // Álbuns de figurinhas: pedidos de pacotinhos (Pix), progresso, figurinhas e aberturas.
  db.exec(`CREATE TABLE IF NOT EXISTS sticker_orders (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    album TEXT NOT NULL,
    packs INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    txid TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','aguardando','pago','cancelado','recusado')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    notified_at TEXT,
    paid_at TEXT
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS album_progress (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    album TEXT NOT NULL,
    packs_unopened INTEGER NOT NULL DEFAULT 0,
    packs_opened INTEGER NOT NULL DEFAULT 0,
    free_packs INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    PRIMARY KEY (member_id, album)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS album_stickers (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    album TEXT NOT NULL,
    sticker INTEGER NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    stuck INTEGER NOT NULL DEFAULT 0,
    first_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (member_id, album, sticker)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS album_openings (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    album TEXT NOT NULL,
    stickers TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  // Aprendizagem Diária. Ano Bíblico: um registro por dia do plano (melhor nota do quiz, quando
  // concluiu e se foi no dia certo, que é o que conta para a sequência).
  db.exec(`CREATE TABLE IF NOT EXISTS bible_progress (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    best INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    on_time INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (member_id, day)
  )`);
  // Pontos de ranking da Leitura bíblica (Ano Bíblico): um registro por dia concluído pela 1ª vez.
  // Guarda a unidade e o clube de quando o dia foi feito (membro 100, unidade 100, clube 25).
  db.exec(`CREATE TABLE IF NOT EXISTS bible_points (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (member_id, day)
  )`);
  // Estudo feito atrasado (dia que já passou) vale menos: late = 1.
  add('bible_points', 'late', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bible_points_unit ON bible_points(unit_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bible_points_club ON bible_points(club_id)');
  // Dias já concluídos antes de existir a pontuação também valem (uma vez só; a chave impede repetir).
  db.exec(`INSERT OR IGNORE INTO bible_points (member_id, day, unit_id, club_id, created_at)
    SELECT p.member_id, p.day, m.unit_id, m.club_id, p.completed_at
    FROM bible_progress p JOIN members m ON m.id = p.member_id WHERE p.completed_at IS NOT NULL`);
  // Bom de Bíblia: melhor nota de cada fase (passa de fase com 7 de 10).
  db.exec(`CREATE TABLE IF NOT EXISTS bdb_progress (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL,
    best INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    passed_at TEXT,
    PRIMARY KEY (member_id, phase)
  )`);
  // Tabelas do antigo DesbravaCraft (o jogo saiu; ficam vazias, sem uso).
  db.exec(`CREATE TABLE IF NOT EXISTS craft_worlds (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    seed INTEGER NOT NULL,
    owner_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    time REAL NOT NULL DEFAULT 180,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS craft_chunks (
    world_id INTEGER NOT NULL REFERENCES craft_worlds(id) ON DELETE CASCADE,
    chunk TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (world_id, chunk)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS craft_players (
    world_id INTEGER NOT NULL REFERENCES craft_worlds(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    state TEXT,
    last_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (world_id, member_id)
  )`);
  // Pix automático (SyncPay): identificador da cobrança, código e quem pagou.
  add('sticker_orders', 'identifier', 'TEXT');
  add('sticker_orders', 'pix_code', 'TEXT');
  add('sticker_orders', 'payer', 'TEXT');
  add('sticker_orders', 'checked_at', 'INTEGER');
  // Pagamentos do site todo (figurinhas hoje; cursos e outras vendas depois): Pix pela SyncPay
  // (automático) ou Pix manual confirmado pela equipe. purpose diz o que foi comprado e ref os detalhes.
  db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '{}',
    title TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    txid TEXT NOT NULL UNIQUE,
    identifier TEXT,
    pix_code TEXT,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','aguardando','pago','cancelado','recusado')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    notified_at TEXT,
    paid_at TEXT,
    checked_at INTEGER
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id, purpose, id)');
  if (!flag('pagamentos-v1')) {
    db.exec(`INSERT OR IGNORE INTO payments (id, member_id, purpose, ref, title, amount_cents, txid, identifier, pix_code, status, created_at, notified_at, paid_at, checked_at)
      SELECT id, member_id, 'figurinhas', json_object('album', album, 'packs', packs),
        packs || CASE WHEN packs > 1 THEN ' pacotinhos' ELSE ' pacotinho' END || ' de figurinhas',
        amount_cents, txid, identifier, pix_code, status, created_at, notified_at, paid_at, checked_at FROM sticker_orders`);
    setFlag('pagamentos-v1');
  }
  for (const k of ['pix_key', 'pix_name', 'pix_city']) db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, '');

  // Volta para os Desbravadores: "Nº Clã X" vira "Nº Clube X" e a medalha de grupo vira de unidade.
  if (!flag('nomes-dbv-v1')) {
    db.exec(`UPDATE clubs SET name = replace(name, 'º Clã ', 'º Clube ') WHERE name LIKE '%º Clã %'`);
    db.exec(`UPDATE medals SET name = 'Unidade nota 10', description = 'Unidade exemplar em organização e espírito de equipe.' WHERE name = 'Grupo nota 10'`);
    db.exec(`UPDATE medals SET name = 'Desbravador destaque' WHERE name = 'Explorador destaque'`);
    setFlag('nomes-dbv-v1');
  }
  // Clube sem número no nome: "1º Clube X" vira "Clube X".
  db.exec(`UPDATE clubs SET name = substr(name, instr(name, 'Clube ')) WHERE name GLOB '[0-9]*º Clube *'`);

  // Biografia da unidade (a própria unidade escreve no Portal da Unidade).
  add('units', 'bio', 'TEXT');

  // Número da unidade dentro do clube (1 a 10), usado no link: /cla/CÓDIGO/NÚMERO.
  add('units', 'number', 'INTEGER');
  // Link do perfil para compartilhar: letras aleatórias (o código e o @ ficam em segredo, servem para entrar).
  add('members', 'link_token', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_member_link ON members(link_token) WHERE link_token IS NOT NULL');
  const LETRAS_LINK = 'abcdefghjkmnpqrstuvwxyz';
  const linkToken = () => Array.from({ length: 10 }, () => LETRAS_LINK[crypto.randomInt(LETRAS_LINK.length)]).join('');
  for (const m of db.prepare('SELECT id FROM members WHERE link_token IS NULL').all()) {
    for (;;) { const t = linkToken(); if (!db.prepare('SELECT 1 FROM members WHERE link_token = ?').get(t)) { db.prepare('UPDATE members SET link_token = ? WHERE id = ?').run(t, m.id); break; } }
  }
  // Membro novo: o link já nasce aleatório (só letras).
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_member_link AFTER INSERT ON members WHEN NEW.link_token IS NULL BEGIN
    UPDATE members SET link_token = lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(hex(randomblob(5)),
      '0','g'),'1','h'),'2','k'),'3','m'),'4','n'),'5','p'),'6','q'),'7','r'),'8','s'),'9','t')) WHERE id = NEW.id;
  END`);

  // Clube App Brasil: quem cria conta pelo app, sem o link de um clube (distrito e clube escondidos).
  add('districts', 'is_app', 'INTEGER NOT NULL DEFAULT 0');
  add('clubs', 'is_app', 'INTEGER NOT NULL DEFAULT 0');
  for (const u of db.prepare('SELECT id, club_id FROM units WHERE number IS NULL AND is_leadership = 0 ORDER BY id').all()) {
    const used = new Set(db.prepare('SELECT number FROM units WHERE club_id = ? AND number IS NOT NULL').all(u.club_id).map((x) => x.number));
    let n = 1;
    while (used.has(n)) n++;
    db.prepare('UPDATE units SET number = ? WHERE id = ?').run(n, u.id);
  }

  // Pedidos para criar um clube (página pública /criar-clube).
  db.exec(`CREATE TABLE IF NOT EXISTS clan_applications (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    uf TEXT NOT NULL,
    city TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 0,
    teens INTEGER NOT NULL DEFAULT 0,
    kids_6_9 INTEGER NOT NULL DEFAULT 0,
    kids_10_15 INTEGER NOT NULL DEFAULT 0,
    clan_name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    viewed_at TEXT
  )`);

  // Requisito criado por uma unidade só aceita envios dos membros daquela unidade.
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_submission_unit_req
    BEFORE INSERT ON submissions
    WHEN (SELECT creator_type FROM requirements WHERE id = NEW.requirement_id) = 'unit'
      AND (NEW.submitter_type <> 'member'
           OR (SELECT unit_id FROM requirements WHERE id = NEW.requirement_id) IS NOT (SELECT unit_id FROM members WHERE id = NEW.submitter_id))
    BEGIN SELECT RAISE(ABORT, 'Requisito de outra unidade'); END`);
}

/** Apaga tudo e recria o esquema (usado por "npm run seed"). */
export function resetDatabase() {
  db.exec('PRAGMA foreign_keys = OFF');
  const objs = db.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'").all();
  for (const o of objs.filter((x) => x.type === 'trigger')) db.exec(`DROP TRIGGER IF EXISTS "${o.name}"`);
  for (const o of objs.filter((x) => x.type === 'table')) db.exec(`DROP TABLE IF EXISTS "${o.name}"`);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrate();
}

function clean(params) {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

export const all = (sql, ...p) => db.prepare(sql).all(...clean(p));
export const get = (sql, ...p) => db.prepare(sql).get(...clean(p));
export const run = (sql, ...p) => db.prepare(sql).run(...clean(p));

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();
