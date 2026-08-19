const express = require('express');
const path = require('node:path');
const { pool, init } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const EDITABLE_FIELDS = ['avance', 'comentario', 'fecha_compromiso', 'barreras'];
const ESTATUS_OPCIONES = ['PENDIENTE', 'EN PROCESO', 'COMPLETADO', 'DETENIDO'];

async function distinctValues(column) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ${column} AS v FROM activities WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`
  );
  return rows.map((r) => r.v);
}

app.get('/api/meta', async (req, res, next) => {
  try {
    const [responsables, coordinaciones] = await Promise.all([
      distinctValues('responsable'),
      distinctValues('coordinacion')
    ]);
    res.json({ responsables, coordinaciones, estatus: ESTATUS_OPCIONES });
  } catch (err) {
    next(err);
  }
});

app.get('/api/activities', async (req, res, next) => {
  try {
    const { responsable, coordinacion, estatus, fecha } = req.query;
    const conditions = [];
    const params = [];

    function addInClause(column, value) {
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      conditions.push(`${column} IN (${placeholders.join(',')})`);
    }

    if (responsable) addInClause('responsable', responsable);
    if (coordinacion) addInClause('coordinacion', coordinacion);
    if (estatus) addInClause('avance', estatus);
    if (fecha) {
      params.push(fecha);
      conditions.push(`fecha_compromiso = $${params.length}`);
    }

    let sql = 'SELECT * FROM activities';
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY id';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/activities/:id/log', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM change_log WHERE activity_id = $1 ORDER BY changed_at DESC',
      [Number(req.params.id)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.put('/api/activities/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { editedBy } = req.body || {};

    if (!editedBy || !editedBy.trim()) {
      return res.status(400).json({ error: 'Falta el nombre de quien edita.' });
    }

    const { rows: currentRows } = await pool.query('SELECT * FROM activities WHERE id = $1', [id]);
    const current = currentRows[0];
    if (!current) {
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const updates = {};
    const changes = [];

    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        const newValue = (req.body[field] ?? '').toString();
        const oldValue = (current[field] ?? '').toString();
        if (newValue !== oldValue) {
          updates[field] = newValue;
          changes.push({ field, oldValue, newValue });
        }
      }
    }

    if (changes.length === 0) {
      return res.json(current);
    }

    const setParams = [];
    const setClause = Object.keys(updates)
      .map((f) => {
        setParams.push(updates[f]);
        return `${f} = $${setParams.length}`;
      })
      .join(', ');

    setParams.push(editedBy.trim());
    const updatedByIdx = setParams.length;
    setParams.push(id);
    const idIdx = setParams.length;

    await pool.query(
      `UPDATE activities SET ${setClause}, updated_at = now(), updated_by = $${updatedByIdx} WHERE id = $${idIdx}`,
      setParams
    );

    const insertLogText = `
      INSERT INTO change_log (activity_id, field, old_value, new_value, changed_by, changed_at)
      VALUES ($1, $2, $3, $4, $5, now())
    `;
    for (const c of changes) {
      await pool.query(insertLogText, [id, c.field, c.oldValue, c.newValue, editedBy.trim()]);
    }

    const { rows: updatedRows } = await pool.query('SELECT * FROM activities WHERE id = $1', [id]);
    res.json(updatedRows[0]);
  } catch (err) {
    next(err);
  }
});

app.get('/api/log', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT change_log.*, activities.actividad AS actividad
      FROM change_log
      JOIN activities ON activities.id = change_log.activity_id
      ORDER BY changed_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor de seguimiento de actividades corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
