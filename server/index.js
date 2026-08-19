const express = require('express');
const path = require('node:path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const EDITABLE_FIELDS = ['avance', 'comentario', 'fecha_compromiso', 'barreras'];
const ESTATUS_OPCIONES = ['PENDIENTE', 'EN PROCESO', 'COMPLETADO', 'DETENIDO'];

function distinctValues(column) {
  return db
    .prepare(`SELECT DISTINCT ${column} AS v FROM activities WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`)
    .all()
    .map((r) => r.v);
}

app.get('/api/meta', (req, res) => {
  res.json({
    responsables: distinctValues('responsable'),
    coordinaciones: distinctValues('coordinacion'),
    estatus: ESTATUS_OPCIONES
  });
});

app.get('/api/activities', (req, res) => {
  const { responsable, coordinacion, estatus, fecha } = req.query;
  let sql = 'SELECT * FROM activities WHERE 1=1';
  const params = [];

  function addInClause(column, value) {
    const values = Array.isArray(value) ? value : [value];
    sql += ` AND ${column} IN (${values.map(() => '?').join(',')})`;
    params.push(...values);
  }

  if (responsable) addInClause('responsable', responsable);
  if (coordinacion) addInClause('coordinacion', coordinacion);
  if (estatus) addInClause('avance', estatus);
  if (fecha) {
    sql += ' AND fecha_compromiso = ?';
    params.push(fecha);
  }
  sql += ' ORDER BY id';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/activities/:id/log', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM change_log WHERE activity_id = ? ORDER BY changed_at DESC')
    .all(Number(req.params.id));
  res.json(rows);
});

app.put('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id);
  const { editedBy } = req.body || {};

  if (!editedBy || !editedBy.trim()) {
    return res.status(400).json({ error: 'Falta el nombre de quien edita.' });
  }

  const current = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  const now = new Date().toISOString();
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

  const setClause = Object.keys(updates)
    .map((f) => `${f} = ?`)
    .join(', ');
  const values = Object.values(updates);

  db.prepare(`UPDATE activities SET ${setClause}, updated_at = ?, updated_by = ? WHERE id = ?`).run(
    ...values,
    now,
    editedBy.trim(),
    id
  );

  const insertLog = db.prepare(`
    INSERT INTO change_log (activity_id, field, old_value, new_value, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const c of changes) {
    insertLog.run(id, c.field, c.oldValue, c.newValue, editedBy.trim(), now);
  }

  const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  res.json(updated);
});

app.get('/api/log', (req, res) => {
  const rows = db
    .prepare(`
      SELECT change_log.*, activities.actividad AS actividad
      FROM change_log
      JOIN activities ON activities.id = change_log.activity_id
      ORDER BY changed_at DESC
      LIMIT 200
    `)
    .all();
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de seguimiento de actividades corriendo en http://localhost:${PORT}`);
});
