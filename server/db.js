import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
  -- Requisito de clube vale só para as unidades daquele clube.
  CHECK (creator_type = 'admin' OR (audience = 'unit' AND club_id IS NOT NULL AND scope = 'clube')),
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
  icon TEXT NOT NULL DEFAULT '📘',
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
  source TEXT NOT NULL CHECK (source IN ('clube','online')),
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
CREATE TRIGGER IF NOT EXISTS trg_submission_club_req
BEFORE INSERT ON submissions
WHEN (SELECT creator_type FROM requirements WHERE id = NEW.requirement_id) = 'club'
  AND (SELECT club_id FROM requirements WHERE id = NEW.requirement_id)
      IS NOT (SELECT club_id FROM units WHERE id = NEW.submitter_id)
BEGIN SELECT RAISE(ABORT, 'Requisito de outro clube'); END;

-- Medalhas nunca são entregues por gatilho automático: só por um administrador.
CREATE TRIGGER IF NOT EXISTS trg_award_requires_admin
BEFORE INSERT ON medal_awards
WHEN (SELECT id FROM admins WHERE id = NEW.awarded_by) IS NULL
BEGIN SELECT RAISE(ABORT, 'Somente o Administrador Geral entrega medalhas'); END;
`;

db.exec(SCHEMA);

/** Apaga tudo e recria o esquema (usado por "npm run seed"). */
export function resetDatabase() {
  db.exec('PRAGMA foreign_keys = OFF');
  const objs = db.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'").all();
  for (const o of objs.filter((x) => x.type === 'trigger')) db.exec(`DROP TRIGGER IF EXISTS "${o.name}"`);
  for (const o of objs.filter((x) => x.type === 'table')) db.exec(`DROP TABLE IF EXISTS "${o.name}"`);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
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
