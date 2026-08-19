const NAME_KEY = 'seguimiento_userName';
const ESTATUS_OPCIONES = ['PENDIENTE', 'EN PROCESO', 'HECHO', 'DETENIDO'];

let currentActivities = [];
let editingId = null;
let editDraft = {};
let searchTerm = '';

const filterState = {
  coordinacion: new Set(),
  estatus: new Set()
};

// ---------- Nombre de usuario ----------

function getUserName() {
  return localStorage.getItem(NAME_KEY) || '';
}

function setUserName(name) {
  localStorage.setItem(NAME_KEY, name);
}

function showNameGate(prefill) {
  const overlay = document.getElementById('nameGate');
  const input = document.getElementById('nameInput');
  input.value = prefill || '';
  document.getElementById('nameError').textContent = '';
  overlay.classList.remove('hidden');
  input.focus();
}

function hideNameGate() {
  document.getElementById('nameGate').classList.add('hidden');
}

function refreshUserLabel() {
  document.getElementById('currentUserLabel').textContent = `Hola, ${getUserName()}`;
}

document.getElementById('nameSubmit').addEventListener('click', () => {
  const value = document.getElementById('nameInput').value.trim();
  if (!value) {
    document.getElementById('nameError').textContent = 'Escribe tu nombre para continuar.';
    return;
  }
  setUserName(value);
  refreshUserLabel();
  hideNameGate();
});

document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('nameSubmit').click();
});

document.getElementById('changeNameBtn').addEventListener('click', () => {
  showNameGate(getUserName());
});

// ---------- Multiselect genérico ----------

function buildMultiSelect(containerId, stateSet, onChangeCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'multiselect-toggle';
  container.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'multiselect-panel hidden';
  container.appendChild(panel);

  function updateToggleLabel() {
    if (stateSet.size === 0) toggle.textContent = 'Todos';
    else if (stateSet.size === 1) toggle.textContent = [...stateSet][0];
    else toggle.textContent = `${stateSet.size} seleccionados`;
  }

  function renderOptions(options) {
    panel.innerHTML = '';
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'multiselect-empty';
      empty.textContent = 'Sin opciones disponibles';
      panel.appendChild(empty);
      return;
    }
    options.forEach((opt) => {
      const row = document.createElement('label');
      row.className = 'multiselect-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = stateSet.has(opt);
      cb.addEventListener('change', () => {
        if (cb.checked) stateSet.add(opt);
        else stateSet.delete(opt);
        updateToggleLabel();
        onChangeCallback();
      });
      const span = document.createElement('span');
      span.textContent = opt;
      row.appendChild(cb);
      row.appendChild(span);
      panel.appendChild(row);
    });
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.multiselect-panel').forEach((p) => {
      if (p !== panel) p.classList.add('hidden');
    });
    panel.classList.toggle('hidden');
  });

  updateToggleLabel();

  return { renderOptions, updateToggleLabel };
}

document.addEventListener('click', () => {
  document.querySelectorAll('.multiselect-panel').forEach((p) => p.classList.add('hidden'));
});

const coordinacionMS = buildMultiSelect('filterCoordinacion', filterState.coordinacion, fetchActivities);
const estatusMS = buildMultiSelect('filterEstatus', filterState.estatus, fetchActivities);

// ---------- Datos ----------

async function fetchMeta() {
  const res = await fetch('/api/meta');
  const meta = await res.json();
  coordinacionMS.renderOptions(meta.coordinaciones);
  estatusMS.renderOptions(meta.estatus && meta.estatus.length ? meta.estatus : ESTATUS_OPCIONES);
}

function buildQuery() {
  const params = new URLSearchParams();
  filterState.coordinacion.forEach((v) => params.append('coordinacion', v));
  filterState.estatus.forEach((v) => params.append('estatus', v));
  const fecha = document.getElementById('filterFecha').value;
  if (fecha) params.set('fecha', fecha);
  return params.toString();
}

async function fetchActivities() {
  const query = buildQuery();
  const res = await fetch(`/api/activities${query ? '?' + query : ''}`);
  currentActivities = await res.json();
  renderTable();
}

document.getElementById('filterFecha').addEventListener('change', fetchActivities);

document.getElementById('filterSearch').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderTable();
});

document.getElementById('clearFilters').addEventListener('click', () => {
  filterState.coordinacion.clear();
  filterState.estatus.clear();
  document.getElementById('filterFecha').value = '';
  document.getElementById('filterSearch').value = '';
  searchTerm = '';
  coordinacionMS.updateToggleLabel();
  estatusMS.updateToggleLabel();
  fetchMeta();
  fetchActivities();
});

// ---------- Descargar Excel ----------

document.getElementById('downloadExcelBtn').addEventListener('click', () => {
  const visible = getVisibleActivities();

  if (!visible.length) {
    alert('No hay actividades para exportar con los filtros actuales.');
    return;
  }

  const rows = visible.map((row) => ({
    'Actividad': row.actividad || '',
    'Descripción de acciones': row.descripcion || '',
    'Responsable': row.responsable || '',
    'Coordinación': row.coordinacion || '',
    'Avance': row.avance || '',
    'Comentario': row.comentario || '',
    'Fecha compromiso': row.fecha_compromiso ? formatDate(row.fecha_compromiso) : '',
    'Barreras/Apoyo querido': row.barreras || '',
    'Editado por': row.updated_by || '',
    'Última edición': row.updated_at ? formatDateTime(row.updated_at) : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Actividades');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `seguimiento-actividades-${fecha}.xlsx`);
});

// ---------- Búsqueda de texto y contador ----------

function rowMatchesSearch(row) {
  if (!searchTerm) return true;
  const haystack = [
    row.actividad,
    row.descripcion,
    row.responsable,
    row.coordinacion,
    row.avance,
    row.comentario,
    formatDate(row.fecha_compromiso),
    row.barreras
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(searchTerm);
}

function getVisibleActivities() {
  return currentActivities.filter((row) => row.id === editingId || rowMatchesSearch(row));
}

function updateCounts(visible) {
  const counts = { 'PENDIENTE': 0, 'EN PROCESO': 0, 'HECHO': 0, 'DETENIDO': 0 };
  visible.forEach((row) => {
    const key = row.avance || 'PENDIENTE';
    if (key in counts) counts[key] += 1;
  });

  const bar = document.getElementById('countsBar');
  bar.innerHTML = `
    <span class="count-chip count-total">${visible.length} actividades totales</span>
    <span class="count-chip status-PENDIENTE">${counts['PENDIENTE']} Pendiente</span>
    <span class="count-chip status-EN-PROCESO">${counts['EN PROCESO']} En proceso</span>
    <span class="count-chip status-HECHO">${counts['HECHO']} Hecho</span>
    <span class="count-chip status-DETENIDO">${counts['DETENIDO']} Detenido</span>
  `;
}

// ---------- Tabla ----------

function statusClass(value) {
  return 'status-' + (value || 'PENDIENTE').replace(/\s+/g, '-');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(isoOrDate) {
  if (!isoOrDate) return '—';
  const datePart = isoOrDate.substring(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return isoOrDate;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderTable() {
  const tbody = document.getElementById('activitiesBody');
  const emptyState = document.getElementById('emptyState');
  tbody.innerHTML = '';

  const visible = getVisibleActivities();
  updateCounts(visible);

  if (!visible.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  visible.forEach((row) => {
    const tr = document.createElement('tr');
    const isEditing = editingId === row.id;

    tr.innerHTML = `
      <td class="cell-actividad">${escapeHtml(row.actividad)}</td>
      <td>${escapeHtml(row.descripcion) || '—'}</td>
      <td>${escapeHtml(row.responsable) || '—'}</td>
      <td>${escapeHtml(row.coordinacion) || '—'}</td>
      <td data-field-cell="avance"></td>
      <td data-field-cell="comentario"></td>
      <td data-field-cell="fecha_compromiso"></td>
      <td data-field-cell="barreras"></td>
      <td data-action-cell></td>
    `;

    const avanceCell = tr.querySelector('[data-field-cell="avance"]');
    const comentarioCell = tr.querySelector('[data-field-cell="comentario"]');
    const fechaCell = tr.querySelector('[data-field-cell="fecha_compromiso"]');
    const barrerasCell = tr.querySelector('[data-field-cell="barreras"]');
    const actionCell = tr.querySelector('[data-action-cell]');

    if (isEditing) {
      const select = document.createElement('select');
      select.className = 'editable-select';
      ESTATUS_OPCIONES.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if ((editDraft.avance ?? row.avance) === opt) o.selected = true;
        select.appendChild(o);
      });
      select.addEventListener('input', () => (editDraft.avance = select.value));
      avanceCell.appendChild(select);

      const textarea = document.createElement('textarea');
      textarea.className = 'editable-textarea';
      textarea.value = editDraft.comentario ?? row.comentario ?? '';
      textarea.addEventListener('input', () => (editDraft.comentario = textarea.value));
      comentarioCell.appendChild(textarea);

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'editable-input';
      const currentFecha = editDraft.fecha_compromiso ?? row.fecha_compromiso;
      dateInput.value = currentFecha ? currentFecha.substring(0, 10) : '';
      dateInput.addEventListener('input', () => (editDraft.fecha_compromiso = dateInput.value));
      fechaCell.appendChild(dateInput);

      const barrerasInput = document.createElement('input');
      barrerasInput.type = 'text';
      barrerasInput.className = 'editable-input';
      barrerasInput.value = editDraft.barreras ?? row.barreras ?? '';
      barrerasInput.addEventListener('input', () => (editDraft.barreras = barrerasInput.value));
      barrerasCell.appendChild(barrerasInput);

      const wrap = document.createElement('div');
      wrap.className = 'action-cell';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-secondary btn-sm';
      saveBtn.textContent = 'Guardar';
      saveBtn.addEventListener('click', () => saveRow(row.id));

      const discardBtn = document.createElement('button');
      discardBtn.className = 'btn btn-danger btn-sm';
      discardBtn.textContent = 'Descartar';
      discardBtn.addEventListener('click', () => {
        editingId = null;
        editDraft = {};
        renderTable();
      });

      const historyBtn = document.createElement('button');
      historyBtn.className = 'history-link';
      historyBtn.textContent = 'Ver historial';
      historyBtn.addEventListener('click', () => openHistory(row.id, row.actividad));

      wrap.appendChild(saveBtn);
      wrap.appendChild(discardBtn);
      wrap.appendChild(historyBtn);
      actionCell.appendChild(wrap);
    } else {
      const badge = document.createElement('span');
      badge.className = `status-badge ${statusClass(row.avance)}`;
      badge.textContent = row.avance || 'PENDIENTE';
      avanceCell.appendChild(badge);

      comentarioCell.textContent = row.comentario || '—';
      fechaCell.textContent = formatDate(row.fecha_compromiso);
      barrerasCell.textContent = row.barreras || '—';

      const wrap = document.createElement('div');
      wrap.className = 'action-cell';

      const updateBtn = document.createElement('button');
      updateBtn.className = 'btn btn-ghost btn-sm';
      updateBtn.textContent = 'Actualizar';
      updateBtn.addEventListener('click', () => {
        if (!getUserName()) {
          showNameGate('');
          return;
        }
        editingId = row.id;
        editDraft = {};
        renderTable();
      });

      const historyBtn = document.createElement('button');
      historyBtn.className = 'history-link';
      historyBtn.textContent = 'Ver historial';
      historyBtn.addEventListener('click', () => openHistory(row.id, row.actividad));

      wrap.appendChild(updateBtn);
      wrap.appendChild(historyBtn);

      if (row.updated_at) {
        const meta = document.createElement('div');
        meta.className = 'cell-meta';
        meta.textContent = `Editado por ${row.updated_by} · ${formatDateTime(row.updated_at)}`;
        wrap.appendChild(meta);
      }

      actionCell.appendChild(wrap);
    }

    tbody.appendChild(tr);
  });
}

async function saveRow(id) {
  const payload = { editedBy: getUserName(), ...editDraft };
  const res = await fetch(`/api/activities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'No se pudo guardar el cambio.');
    return;
  }

  editingId = null;
  editDraft = {};
  await fetchActivities();
  await fetchMeta();
}

// ---------- Historial ----------

async function openHistory(activityId, activityName) {
  const modal = document.getElementById('historyModal');
  const content = document.getElementById('historyContent');
  content.innerHTML = 'Cargando…';
  modal.classList.remove('hidden');

  const res = await fetch(`/api/activities/${activityId}/log`);
  const entries = await res.json();

  if (!entries.length) {
    content.innerHTML = `<p>Sin cambios registrados todavía para "${escapeHtml(activityName)}".</p>`;
    return;
  }

  content.innerHTML = entries
    .map(
      (e) => `
      <div class="history-item">
        <div><span class="history-field">${escapeHtml(e.field.replace('_', ' '))}</span></div>
        <div class="history-values">
          <span class="history-old">${escapeHtml(e.old_value) || '(vacío)'}</span>
          →
          <span class="history-new">${escapeHtml(e.new_value) || '(vacío)'}</span>
        </div>
        <div class="history-meta">Por ${escapeHtml(e.changed_by)} · ${formatDateTime(e.changed_at)}</div>
      </div>`
    )
    .join('');
}

document.getElementById('closeHistory').addEventListener('click', () => {
  document.getElementById('historyModal').classList.add('hidden');
});

document.getElementById('historyModal').addEventListener('click', (e) => {
  if (e.target.id === 'historyModal') e.target.classList.add('hidden');
});

// ---------- Init ----------

async function init() {
  const name = getUserName();
  if (!name) showNameGate('');
  else hideNameGate();
  refreshUserLabel();

  await fetchMeta();
  await fetchActivities();
}

init();
