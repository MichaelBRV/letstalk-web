import { api, html, setHTML, $, $$, toast, modal, pct, fechaCorta, parseCSV, downloadCSV } from './lib.js';
import { state, isStaff, isCoord, isProfesor } from './state.js';
import { setTitle, refresh } from './app.js';
import { historialHTML, registrarSeguimiento } from './seguimiento.js';

const ESTADOS = { activo: 'Activo', retirado: 'Retirado', finalizado: 'Finalizado' };
const estadoCls = { activo: 'ok', retirado: 'bad', finalizado: 'info' };

export async function viewEstudiantes(view, _m, params) {
  setTitle('Estudiantes');
  const [lista, empresas, grupos] = await Promise.all([api('/estudiantes'), isStaff() ? api('/empresas') : [], api('/grupos')]);
  setHTML(
    view,
    html`<div class="page-head">
      <div><h1>Estudiantes</h1><p class="muted">${isProfesor() ? 'Estudiantes de sus grupos.' : `${lista.length} estudiantes registrados.`}</p></div>
      <div class="actions">
        <button class="btn btn-ghost" id="exportar">Exportar Excel (CSV)</button>
        ${isStaff() ? html`<button class="btn btn-ghost" id="importar">Importar desde Excel</button><button class="btn btn-primary" id="nuevo">+ Nuevo estudiante</button>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="toolbar">
        <input type="search" id="q" placeholder="Buscar por nombre, cédula o correo…" class="grow" value="${params.get('q') || ''}">
        ${isStaff() ? html`<select id="f-empresa"><option value="">Todas las empresas</option>${empresas.map((e) => html`<option value="${e.id}">${e.nombre}</option>`)}</select>` : ''}
        <select id="f-grupo"><option value="">Todos los grupos</option><option value="-">Sin grupo</option>${grupos.filter((g) => g.estado === 'activo').map((g) => html`<option value="${g.id}">${g.nombre}</option>`)}</select>
        <select id="f-nivel"><option value="">Todos los niveles</option>${state.niveles.map((n) => html`<option>${n.codigo}</option>`)}</select>
        <select id="f-estado"><option value="activo">Activos</option><option value="finalizado">Finalizados</option><option value="retirado">Retirados</option><option value="">Todos</option></select>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Estudiante</th><th>Cédula</th><th>Empresa</th><th>Grupo</th><th>Nivel inicial</th><th>Nivel actual</th><th>Usuario Pearson</th><th>Estado</th></tr></thead>
        <tbody id="rows"></tbody></table></div>
      <p class="muted small" id="count"></p>
    </div>`
  );
  let filtrados = lista;
  const paint = () => {
    const q = $('#q', view).value.toLowerCase();
    const emp = $('#f-empresa', view)?.value;
    const gr = $('#f-grupo', view).value;
    const niv = $('#f-nivel', view).value;
    const est = $('#f-estado', view).value;
    filtrados = lista.filter(
      (s) =>
        (!q || `${s.nombres} ${s.cedula || ''} ${s.email || ''}`.toLowerCase().includes(q)) &&
        (!emp || String(s.empresa_id) === emp) &&
        (!gr || (gr === '-' ? !s.grupo_id : String(s.grupo_id) === gr)) &&
        (!niv || s.nivel_actual === niv) &&
        (!est || s.estado === est)
    );
    setHTML(
      $('#rows', view),
      filtrados.length
        ? filtrados.map(
            (s) => html`<tr class="row-link" data-id="${s.id}"><td><strong>${s.nombres}</strong><br><span class="muted small">${s.email || ''}</span></td>
            <td>${s.cedula || ''}</td><td>${s.empresa}</td><td>${s.grupo || html`<span class="muted">—</span>`}</td>
            <td><span class="level">${s.nivel_inicial}</span></td><td><span class="level">${s.nivel_actual}</span></td>
            <td class="small">${s.pearson_usuario || html`<span class="muted">—</span>`}</td>
            <td><span class="badge ${estadoCls[s.estado]}">${ESTADOS[s.estado]}</span></td></tr>`
          )
        : html`<tr><td colspan="8" class="empty">No hay estudiantes con ese filtro.</td></tr>`
    );
    $('#count', view).textContent = `${filtrados.length} de ${lista.length} estudiantes`;
  };
  $$('.toolbar input, .toolbar select', view).forEach((el) => el.addEventListener('input', paint));
  $('#rows', view).addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) detalleEstudiante(tr.dataset.id);
  });
  $('#nuevo', view)?.addEventListener('click', () => editarEstudiante());
  $('#importar', view)?.addEventListener('click', () => importar(empresas));
  $('#exportar', view).addEventListener('click', () =>
    downloadCSV(
      'estudiantes.csv',
      ['Nombres', 'Cédula', 'Correo', 'Teléfono', 'Empresa', 'Grupo', 'Nivel inicial', 'Nivel actual', 'Estado', 'Usuario Pearson'],
      filtrados.map((s) => [s.nombres, s.cedula, s.email, s.telefono, s.empresa, s.grupo, s.nivel_inicial, s.nivel_actual, ESTADOS[s.estado], s.pearson_usuario])
    )
  );
  paint();
}

export async function editarEstudiante(s = {}) {
  const [empresas, grupos] = await Promise.all([api('/empresas'), api('/grupos')]);
  const niveles = state.niveles.map((n) => [n.codigo, n.codigo]);
  modal({
    title: s.id ? 'Editar estudiante' : 'Nuevo estudiante',
    wide: true,
    fields: [
      { name: 'nombres', label: 'Apellidos y nombres', required: true, value: s.nombres, full: true },
      { name: 'cedula', label: 'Cédula / pasaporte', value: s.cedula },
      { name: 'email', label: 'Correo', type: 'email', value: s.email },
      { name: 'telefono', label: 'Teléfono', value: s.telefono },
      { name: 'fecha_ingreso', label: 'Fecha de ingreso', type: 'date', value: s.fecha_ingreso },
      { name: 'empresa_id', label: 'Empresa', type: 'select', required: true, value: s.empresa_id, placeholder: 'Seleccione…', options: empresas.map((e) => [e.id, e.nombre]) },
      { name: 'grupo_id', label: 'Grupo', type: 'select', value: s.grupo_id, placeholder: 'Sin grupo', options: grupos.filter((g) => g.estado === 'activo' || g.id === s.grupo_id).map((g) => [g.id, `${g.nombre} (${g.empresa})`]) },
      { name: 'nivel_inicial', label: 'Nivel inicial (prueba de ubicación)', type: 'select', required: true, value: s.nivel_inicial, options: niveles },
      { name: 'nivel_actual', label: 'Nivel actual', type: 'select', value: s.nivel_actual, options: niveles },
      { name: 'estado', label: 'Estado', type: 'select', value: s.estado || 'activo', options: Object.entries(ESTADOS) },
      { name: 'pearson_usuario', label: 'Usuario Pearson', value: s.pearson_usuario },
      { name: 'pearson_password', label: 'Contraseña Pearson', type: 'password', autocomplete: 'new-password', hint: s.tiene_pearson_pass ? 'Dejar vacío para mantener la actual. Se guarda cifrada.' : 'Se guarda cifrada.' },
    ],
    onSubmit: async (data) => {
      await api(s.id ? `/estudiantes/${s.id}` : '/estudiantes', { method: s.id ? 'PUT' : 'POST', body: data });
      toast('Estudiante guardado');
      refresh();
    },
  });
}

export async function detalleEstudiante(id) {
  const [s, segs] = await Promise.all([api(`/estudiantes/${id}`), api(`/estudiantes/${id}/seguimientos`)]);
  const a = s.actual;
  const { dlg, close } = modal({
    title: s.nombres,
    wide: true,
    body: html`<div class="detail-grid">
        <div><span class="muted small">Cédula</span><strong>${s.cedula || '—'}</strong></div>
        <div><span class="muted small">Correo</span><strong>${s.email || '—'}</strong></div>
        <div><span class="muted small">Teléfono</span><strong>${s.telefono || '—'}</strong></div>
        <div><span class="muted small">Empresa</span><strong>${s.empresa}</strong></div>
        <div><span class="muted small">Grupo actual</span><strong>${s.grupo || '—'}</strong></div>
        <div><span class="muted small">Estado</span><strong>${ESTADOS[s.estado]}</strong></div>
        <div><span class="muted small">Nivel inicial</span><strong><span class="level">${s.nivel_inicial}</span></strong></div>
        <div><span class="muted small">Nivel actual</span><strong><span class="level">${s.nivel_actual}</span></strong></div>
        <div><span class="muted small">Usuario Pearson</span><strong>${s.pearson_usuario || '—'}</strong></div>
      </div>
      ${a
        ? html`<h3>Nivel en curso</h3><div class="detail-grid">
          <div><span class="muted small">Asistencia</span><strong>${pct(a.asistencia_pct)} (${a.sesiones_registradas} clases)</strong></div>
          <div><span class="muted small">Promedio parcial</span><strong>${a.nota_final ?? '—'}</strong></div>
          <div><span class="muted small">Situación</span><strong>${a.riesgo ? a.motivos.join(' · ') : 'Al día'}</strong></div></div>`
        : ''}
      <h3>Historial académico</h3>
      ${s.historial.length
        ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Grupo</th><th>Nivel cursado</th><th class="num">Asistencia</th><th class="num">Nota</th><th>Resultado</th>${isStaff() ? html`<th></th>` : ''}</tr></thead>
          <tbody>${s.historial.map(
            (h) => html`<tr><td>${fechaCorta(h.fecha)}</td><td>${h.grupo || '—'}</td><td><span class="level">${h.nivel_cursado}</span></td><td class="num">${pct(h.asistencia_pct)}</td><td class="num">${h.nota_final ?? '—'}</td>
            <td>${h.aprobado ? html`<span class="badge ok">Aprobado → ${h.nivel_resultante}</span>` : html`<span class="badge bad">No aprobado</span>`}</td>
            ${isStaff() ? html`<td>${h.aprobado ? html`<a class="btn btn-sm btn-ghost" href="#/certificado/${h.id}" data-close>Certificado</a>` : ''}</td>` : ''}</tr>`
          )}</tbody></table></div>`
        : html`<p class="muted">Aún no tiene niveles cerrados.</p>`}
      <h3>Seguimiento de deserción</h3>
      ${s.estado === 'retirado' ? html`<p class="notice warn">Retirado${s.fecha_retiro ? ` el ${fechaCorta(s.fecha_retiro)}` : ''}${s.motivo_retiro ? ` · Motivo: ${s.motivo_retiro}` : ''}</p>` : ''}
      ${historialHTML(segs)}
      <div class="modal-actions">
        ${s.estado === 'activo' && s.grupo_id ? html`<button type="button" class="btn btn-ghost" id="seg">+ Registrar seguimiento</button>` : ''}
        ${isCoord() || isProfesor() ? html`<button type="button" class="btn btn-ghost" id="cred">Ver acceso Pearson</button>` : ''}
        ${isStaff() ? html`<button type="button" class="btn btn-ghost" id="editar">Editar datos</button>` : ''}
      </div>`,
  });
  $$('a[data-close]', dlg).forEach((x) => x.addEventListener('click', close));
  $('#cred', dlg)?.addEventListener('click', () => showCredenciales(s.id));
  $('#seg', dlg)?.addEventListener('click', () => {
    close();
    registrarSeguimiento({ ...s, motivos: a?.motivos || [] });
  });
  $('#editar', dlg)?.addEventListener('click', () => {
    close();
    editarEstudiante(s);
  });
}

export async function showCredenciales(id, tipo = 'estudiantes') {
  try {
    const c = await api(`/${tipo}/${id}/credenciales`);
    const { dlg } = modal({
      title: 'Acceso a Pearson',
      body: html`<div class="cred">
        <div><span class="muted small">Usuario</span><code>${c.usuario || '—'}</code>${c.usuario ? html`<button type="button" class="btn btn-sm btn-ghost" data-copy="${c.usuario}">Copiar</button>` : ''}</div>
        <div><span class="muted small">Contraseña</span><code>${c.password || '—'}</code>${c.password ? html`<button type="button" class="btn btn-sm btn-ghost" data-copy="${c.password}">Copiar</button>` : ''}</div>
      </div><p class="muted small">Por seguridad, esta consulta quedó registrada en la auditoría.</p>`,
    });
    $$('[data-copy]', dlg).forEach((b) =>
      b.addEventListener('click', async () => {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast('Copiado');
      })
    );
  } catch (e) {
    toast(e.message, 'bad');
  }
}

function importar(empresas) {
  let filas = [];
  const { dlg } = modal({
    title: 'Importar estudiantes desde Excel',
    wide: true,
    body: html`<ol class="steps">
        <li>En Excel, organice las columnas con estos encabezados (la primera fila):<br>
          <code>nombres; cedula; email; telefono; empresa; grupo; nivel_inicial; fecha_ingreso; pearson_usuario; pearson_password</code><br>
          <span class="muted small">Obligatorios: nombres, empresa y nivel_inicial. La empresa y el grupo deben existir con el mismo nombre. Empresas registradas: ${empresas.map((e) => e.nombre).join(', ')}.</span></li>
        <li>Guarde como <strong>CSV UTF-8 (delimitado por comas)</strong>.</li>
        <li>Seleccione el archivo:</li>
      </ol>
      <p><button type="button" class="btn btn-ghost btn-sm" id="plantilla">Descargar plantilla</button></p>
      <input type="file" id="archivo" accept=".csv,text/csv">
      <div id="preview"></div>`,
    submitLabel: 'Importar',
    onSubmit: async () => {
      if (!filas.length) throw new Error('Seleccione un archivo CSV con datos.');
      const r = await api('/estudiantes/importar', { method: 'POST', body: { filas } });
      if (r.errores.length) {
        modal({ title: `Importación: ${r.creados} creados, ${r.errores.length} con errores`, body: html`<ul class="error-list">${r.errores.map((e) => html`<li>${e}</li>`)}</ul>` });
      } else toast(`${r.creados} estudiantes importados`);
      refresh();
    },
  });
  $('#plantilla', dlg).addEventListener('click', () =>
    downloadCSV('plantilla_estudiantes.csv', ['nombres', 'cedula', 'email', 'telefono', 'empresa', 'grupo', 'nivel_inicial', 'fecha_ingreso', 'pearson_usuario', 'pearson_password'], [
      ['APELLIDO APELLIDO NOMBRE', '1700000000', 'correo@empresa.com', '0990000000', empresas[0]?.nombre || 'Empresa', '', 'A1', '2026-11-01', '', ''],
    ])
  );
  $('#archivo', dlg).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    filas = parseCSV(await file.text());
    setHTML(
      $('#preview', dlg),
      filas.length
        ? html`<p><strong>${filas.length}</strong> filas encontradas. Vista previa:</p><div class="table-wrap"><table class="table small"><thead><tr><th>Nombres</th><th>Cédula</th><th>Empresa</th><th>Grupo</th><th>Nivel</th></tr></thead>
          <tbody>${filas.slice(0, 8).map((f) => html`<tr><td>${f.nombres}</td><td>${f.cedula}</td><td>${f.empresa}</td><td>${f.grupo}</td><td>${f.nivel_inicial}</td></tr>`)}</tbody></table></div>`
        : html`<p class="form-error">El archivo no tiene filas válidas.</p>`
    );
  });
}
