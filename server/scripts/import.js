// Reemplaza todas las actividades y la bitácora por el contenido de seed-data.json.
//
// Uso:
//   DATABASE_URL="..." node server/scripts/import.js
//
// ADVERTENCIA: borra todo lo que haya en las tablas `activities` y `change_log`
// antes de insertar los datos nuevos. No se puede deshacer.

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL.');
  process.exit(1);
}

const dataPath = path.join(__dirname, 'seed-data.json');
const records = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function main() {
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS c FROM activities');
  console.log(`Actividades actuales en la base: ${countRows[0].c}`);
  console.log(`Se van a insertar ${records.length} actividades desde ${dataPath}.`);
  console.log('Esto BORRARÁ las actividades y la bitácora actuales. Continuando en 5 segundos... (Ctrl+C para cancelar)');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM change_log');
    await client.query('DELETE FROM activities');
    await client.query('ALTER SEQUENCE activities_id_seq RESTART WITH 1');

    const insertText = `
      INSERT INTO activities
        (actividad, descripcion, responsable, coordinacion, avance, comentario, fecha_compromiso, barreras, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    `;

    for (const rec of records) {
      await client.query(insertText, [
        rec.actividad,
        rec.descripcion || '',
        rec.responsable || '',
        rec.coordinacion || '',
        rec.avance || 'PENDIENTE',
        rec.comentario || '',
        rec.fecha_compromiso || null,
        rec.barreras || ''
      ]);
    }

    await client.query('COMMIT');
    console.log(`Listo: ${records.length} actividades importadas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error durante la importación:', err);
  process.exit(1);
});
