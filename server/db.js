import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

-- ===== Regras de integridade garantidas no próprio banco =====

-- O membro não troca de clube: cada clube só edita os próprios membros.
CREATE TRIGGER IF NOT EXISTS trg_member_club_immutable
BEFORE UPDATE OF club_id ON members WHEN NEW.club_id <> OLD.club_id
BEGIN SELECT RAISE(ABORT, 'O clube de um membro não pode ser alterado'); END;

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
