const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    responsable TEXT DEFAULT '',
    coordinacion TEXT DEFAULT '',
    avance TEXT DEFAULT 'PENDIENTE',
    comentario TEXT DEFAULT '',
    fecha_compromiso TEXT,
    barreras TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activities(id)
  );
`);

const seedCount = db.prepare('SELECT COUNT(*) AS c FROM activities').get().c;
if (seedCount === 0) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activities
      (actividad, descripcion, responsable, coordinacion, avance, comentario, fecha_compromiso, barreras, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'PROPUESTAS O INICIATIVA DE LEY QUE APOYEN OTROS ACTIVISTAS',
    '',
    'ABOGADOS',
    'JOSE',
    'PENDIENTE',
    '',
    null,
    '',
    now
  );
}

module.exports = db;
