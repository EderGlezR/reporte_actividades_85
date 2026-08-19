const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Falta la variable de entorno DATABASE_URL. Define la cadena de conexión a tu base de datos Postgres.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      actividad TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      responsable TEXT DEFAULT '',
      coordinacion TEXT DEFAULT '',
      avance TEXT DEFAULT 'PENDIENTE',
      comentario TEXT DEFAULT '',
      fecha_compromiso TEXT,
      barreras TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      updated_by TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS change_log (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM activities');
  if (rows[0].c === 0) {
    await pool.query(
      `INSERT INTO activities
        (actividad, descripcion, responsable, coordinacion, avance, comentario, fecha_compromiso, barreras, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        'PROPUESTAS O INICIATIVA DE LEY QUE APOYEN OTROS ACTIVISTAS',
        '',
        'ABOGADOS',
        'JOSE',
        'PENDIENTE',
        '',
        null,
        ''
      ]
    );
  }
}

module.exports = { pool, init };
