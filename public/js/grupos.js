import { api, html, raw, setHTML, $, $$, toast, modal, confirmDialog, pct, fechaCorta, hoyISO } from './lib.js';
import { state, isStaff, isCoord, isProfesor, ASIS } from './state.js';
import { setTitle, refresh } from './app.js';
import { showCredenciales } from './estudiantes.js';
import { registrarSeguimiento } from './seguimiento.js';

const estadoBadge = (e) => html`<span class="badge ${e === 'activo' ? 'ok' : ''}">${e === 'activo' ? 'Activo' : 'Cerrado'}</span>`;

// ---------- listado ----------
export async function viewGrupos(view) {
  setTitle('Grupos');
  const grupos = await api('/grupos');
  setHTML(
    view,
    html`<div class="page-head">
      <div><h1>Grupos</h1><p class="muted">${isProfesor() ? 'Grupos asignados a usted.' : 'Grupos por empresa, nivel y profesor.'}</p></div>
      <div class="actions">${isStaff() ? html`<button class="btn btn-primary" id="nuevo">+ Nuevo grupo</button>` : ''}</div>
    </div>
    <div class="card">
      <div class="toolbar"><input type="search" id="buscar" placeholder="Buscar grupo, empresa o profesor…">
        <select id="f-estado"><option value="activo">Activos</option><option value="cerrado">Cerrados</option><option value="">Todos</option></select></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Grupo</th><th>Empresa</th><th>Nivel</th><th>Profesor</th><th>Modalidad</th><th>Horario</th><th class="num">Estudiantes</th><th class="num">Clases</th><th>Estado</th></tr></thead>
        <tbody id="rows"></tbody></table></div>
    </div>`
  );
  const paint = () => {
    const q = $('#buscar', view).value.toLowerCase();
    const est = $('#f-estado', view).value;
    const list = grupos.filter((g) => (!est || g.estado === est) && `${g.nombre} ${g.empresa} ${g.profesor || ''}`.toLowerCase().includes(q));
    setHTML(
      $('#rows', view),
      list.length
        ? list.map(
            (g) => html`<tr class="row-link" data-href="#/grupos/${g.id}"><td><strong>${g.nombre}</strong></td><td>${g.empresa}</td><td><span class="level">${g.nivel}</span></td>
            <td>${g.profesor || html`<span class="muted">Sin asignar</span>`}</td><td>${g.modalidad}</td><td class="small">${g.horario || ''}</td>
            <td class="num">${g.estudiantes}</td><td class="num">${g.sesiones}</td><td>${estadoBadge(g.estado)}</td></tr>`
          )
        : html`<tr><td colspan="9" class="empty">No hay grupos con ese filtro.</td></tr>`
    );
  };
  $('#buscar', view).addEventListener('input', paint);
  $('#f-estado', view).addEventListener('change', paint);
  $('#nuevo', view)?.addEventListener('click', () => editarGrupo());
  paint();
}

export async function editarGrupo(g = {}) {
  const [empresas, usuarios] = await Promise.all([api('/empresas'), api('/usuarios')]);
  modal({
    title: g.id ? 'Editar grupo' : 'Nuevo grupo',
    fields: [
      { name: 'nombre', label: 'Nombre del grupo', required: true, value: g.nombre, placeholder: 'Ej. EDF B1 Tarde', full: true },
      { name: 'empresa_id', label: 'Empresa', type: 'select', required: true, value: g.empresa_id, placeholder: 'Seleccione…', options: empresas.map((e) => [e.id, e.nombre]) },
      { name: 'nivel', label: 'Nivel', type: 'select', required: true, value: g.nivel, options: state.niveles.map((n) => [n.codigo, `${n.codigo} · ${n.descripcion}`]) },
      { name: 'profesor_id', label: 'Profesor', type: 'select', value: g.profesor_id, placeholder: 'Sin asignar', options: usuarios.filter((u) => u.rol === 'profesor' && u.activo).map((u) => [u.id, u.nombre]) },
      { name: 'modalidad', label: 'Modalidad', type: 'select', value: g.modalidad || 'Presencial', options: ['Presencial', 'Online', 'Híbrida'].map((m) => [m, m]) },
      { name: 'horario', label: 'Horario', value: g.horario, placeholder: 'Ej. Mar y Jue 17:30-19:00', full: true },
      { name: 'horas', label: 'Horas del curso', type: 'number', min: 1, max: 2000, value: g.horas, placeholder: `Estándar: ${state.config.horas_por_nivel || 180}`,
        hint: 'Déjelo vacío para usar el estándar. Aparece en el certificado ("Lesson per level").' },
      { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'date', value: g.fecha_inicio },
      { name: 'fecha_fin', label: 'Fecha de fin', type: 'date', value: g.fecha_fin },
    ],
    onSubmit: async (data) => {
      if (g.id) await api(`/grupos/${g.id}`, { method: 'PUT', body: data });
      else {
        const r = await api('/grupos', { method: 'POST', body: data });
        location.hash = `#/grupos/${r.id}`;
      }
      toast('Grupo guardado');
      refresh();
    },
  });
}

// ---------- detalle ----------
export async function viewGrupo(view, [id, tab = 'estudiantes'], params) {
  const g = await api(`/grupos/${id}`);
  setTitle(g.nombre);
  const puedeRegistrar = g.estado === 'activo' && (isCoord() || (isProfesor() && g.profesor_id === state.user.id));
  const tabs = [
    ['estudiantes', 'Estudiantes'],
    ['asistencia', 'Asistencia'],
    ['notas', 'Notas'],
  ];
  setHTML(
    view,
    html`<a class="back" href="#/grupos">← Grupos</a>
    <div class="page-head">
      <div><h1>${g.nombre} <span class="level level-lg">${g.nivel}</span> ${estadoBadge(g.estado)}</h1>
        <p class="muted">${g.empresa} · ${g.modalidad} · ${g.horario || 'Sin horario'} · Profesor: ${g.profesor || 'sin asignar'}
        ${g.fecha_inicio ? html` · ${fechaCorta(g.fecha_inicio)} – ${fechaCorta(g.fecha_fin)}` : ''} · ${g.horas || state.config.horas_por_nivel || 180} horas</p></div>
      <div class="actions">
        <a class="btn btn-ghost" href="#/reportes/avance/${g.id}">Reporte de avance</a>
        ${isStaff() ? html`<button class="btn btn-ghost" id="editar">Editar</button><button class="btn btn-ghost" id="asignar">Asignar estudiantes</button>` : ''}
        ${isCoord() && g.estado === 'activo' ? html`<button class="btn btn-primary" id="cerrar">Cerrar nivel</button>` : ''}
      </div>
    </div>
    <nav class="tabs">${tabs.map(([k, l]) => html`<a href="#/grupos/${g.id}/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`)}</nav>
    <div id="tab"></div>`
  );
  $('#editar', view)?.addEventListener('click', () => editarGrupo(g));
  $('#asignar', view)?.addEventListener('click', () => asignarEstudiantes(g));
  $('#cerrar', view)?.addEventListener('click', () => cerrarNivel(g));
  const box = $('#tab', view);
  if (tab === 'asistencia') await tabAsistencia(box, g, puedeRegistrar);
  else if (tab === 'notas') await tabNotas(box, g, puedeRegistrar, params?.get('p'));
  else tabEstudiantes(box, g);
}

function tabEstudiantes(box, g) {
  const verCred = isCoord() || isProfesor();
  setHTML(
    box,
    html`<div class="card">${puedeAgregar(g) ? html`<div class="card-head"><h2>Estudiantes del grupo</h2><button class="btn btn-ghost" id="agregar-est">+ Agregar estudiante</button></div>` : ''}<div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>Estudiante</th><th>Cédula</th><th>Nivel inicial</th><th class="num">Asistencia</th><th class="num">P / A / T / J</th><th class="num">Promedio</th><th>Situación</th>${verCred ? html`<th>Pearson</th>` : ''}</tr></thead>
      <tbody>${g.estudiantes.map(
        (s, i) => html`<tr class="${s.riesgo ? 'row-risk' : ''}">
          <td class="muted">${i + 1}</td><td><strong>${s.nombres}</strong>${s.estado !== 'activo' ? html` <span class="badge">${s.estado}</span>` : ''}</td><td>${s.cedula || ''}</td>
          <td><span class="level">${s.nivel_inicial}</span></td>
          <td class="num">${pct(s.asistencia_pct)}</td>
          <td class="num small">${s.conteo.P} / ${s.conteo.A} / ${s.conteo.T} / ${s.conteo.J}</td>
          <td class="num">${s.nota_final ?? '—'}</td>
          <td>${s.riesgo ? html`${s.motivos.map((m) => html`<span class="badge bad">${m}</span> `)}${s.estado === 'activo' ? html`<button class="link small" data-seg="${s.id}">+ Seguimiento</button>` : ''}` : html`<span class="badge ok">Al día</span>`}</td>
          ${verCred ? html`<td><button class="btn btn-sm btn-ghost" data-cred="${s.id}">Ver acceso</button></td>` : ''}
        </tr>`
      )}</tbody></table></div>
      ${g.estudiantes.length ? '' : html`<p class="empty">Este grupo aún no tiene estudiantes.${isStaff() ? ' Use "Asignar estudiantes".' : ''}</p>`}
    </div>`
  );
  $$('[data-cred]', box).forEach((b) => b.addEventListener('click', () => showCredenciales(b.dataset.cred)));
  $('#agregar-est', box)?.addEventListener('click', () => agregarEstudiante(g));
  const porId = new Map(g.estudiantes.map((s) => [String(s.id), s]));
  $$('[data-seg]', box).forEach((b) => b.addEventListener('click', () => registrarSeguimiento(porId.get(b.dataset.seg))));
}

async function tabAsistencia(box, g, puedeRegistrar) {
  const d = await api(`/grupos/${g.id}/asistencia`);
  const reg = new Map(d.registros.map((r) => [`${r.sesion_id}:${r.estudiante_id}`, r.estado]));
  const sesionPorFecha = new Map(d.sesiones.map((s) => [s.fecha, s]));
  const activos = d.estudiantes.filter((s) => s.estado === 'activo');

  setHTML(
    box,
    html`${puedeRegistrar
      ? html`<div class="card">
          <div class="card-head"><div><h2>Tomar asistencia</h2><span class="muted small">P = presente · A = ausente · T = atraso · J = falta justificada</span></div>
            <button class="btn btn-ghost" id="agregar-est">+ Agregar estudiante</button></div>
          <div class="toolbar">
            <label class="inline">Fecha <input type="date" id="fecha" value="${hoyISO()}" max="${hoyISO()}"></label>
            <input type="text" id="tema" placeholder="Tema de la clase (opcional)" class="grow">
            <button class="btn btn-ghost" id="todos">Todos presentes</button>
          </div>
          <div id="toma" class="attendance-list"></div>
          <div class="form-foot"><span class="muted small" id="estado-toma"></span><button class="btn btn-primary" id="guardar">Guardar asistencia</button></div>
        </div>`
      : g.estado === 'cerrado'
        ? html`<p class="notice">Grupo cerrado: la asistencia es de solo lectura.</p>`
        : ''}
    <div class="card">
      <div class="card-head"><h2>Historial de asistencia</h2><span class="muted small">${d.sesiones.length} clases registradas</span></div>
      ${d.sesiones.length
        ? html`<div class="table-wrap matrix-wrap"><table class="table matrix">
          <thead><tr><th class="sticky">Estudiante</th>${d.sesiones.map(
            (s) => html`<th class="date-col" title="${s.tema || ''}">${s.fecha.slice(8)}/${s.fecha.slice(5, 7)}${isCoord() ? html`<button class="del-ses" data-del="${s.id}" data-fecha="${s.fecha}" title="Eliminar clase">✕</button>` : ''}</th>`
          )}<th class="num">%</th></tr></thead>
          <tbody>${d.estudiantes.map(
            (st) => html`<tr><td class="sticky"><strong>${st.nombres}</strong></td>${d.sesiones.map((s) => {
              const e = reg.get(`${s.id}:${st.id}`);
              return html`<td class="cell ${e ? ASIS[e].cls : ''}" title="${e ? ASIS[e].label : 'Sin registro'}">${e || '·'}</td>`;
            })}<td class="num ${st.riesgo ? 'text-bad' : ''}">${pct(st.asistencia_pct)}</td></tr>`
          )}</tbody></table></div>`
        : html`<p class="empty">Aún no hay clases registradas.</p>`}
    </div>`
  );

  $$('[data-del]', box).forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirmDialog('Eliminar clase', `Se eliminará la asistencia del ${fechaCorta(b.dataset.fecha)} para todo el grupo.`, 'Eliminar'))) return;
      await api(`/grupos/${g.id}/asistencia/${b.dataset.del}`, { method: 'DELETE' });
      toast('Clase eliminada');
      refresh();
    })
  );

  $('#agregar-est', box)?.addEventListener('click', () => agregarEstudiante(g));
  if (!puedeRegistrar) return;
  let marcas = {};
  const pintar = () => {
    const fecha = $('#fecha', box).value;
    const ses = sesionPorFecha.get(fecha);
    marcas = {};
    for (const s of activos) marcas[s.id] = ses ? reg.get(`${ses.id}:${s.id}`) || null : null;
    $('#tema', box).value = ses?.tema || '';
    $('#estado-toma', box).textContent = ses ? 'Esta fecha ya tiene asistencia: los cambios la actualizarán.' : 'Nueva clase.';
    setHTML(
      $('#toma', box),
      activos.map(
        (s) => html`<div class="att-row" data-est="${s.id}">
          <span class="att-name">${s.nombres}${s.riesgo ? html` <span class="badge bad">riesgo</span>` : ''}</span>
          <div class="seg" role="radiogroup" aria-label="Asistencia de ${s.nombres}">${Object.entries(ASIS).map(
            ([k, v]) => html`<button type="button" class="seg-btn ${v.cls} ${marcas[s.id] === k ? 'on' : ''}" data-v="${k}" role="radio" aria-checked="${marcas[s.id] === k}" title="${v.label}">${k}</button>`
          )}</div></div>`
      )
    );
  };
  $('#toma', box).addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    const row = b.closest('.att-row');
    marcas[row.dataset.est] = b.dataset.v;
    $$('.seg-btn', row).forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', x === b);
    });
  });
  $('#fecha', box).addEventListener('change', pintar);
  $('#todos', box).addEventListener('click', () => {
    for (const s of activos) marcas[s.id] = 'P';
    $$('.att-row', box).forEach((row) => $$('.seg-btn', row).forEach((x) => x.classList.toggle('on', x.dataset.v === 'P')));
  });
  $('#guardar', box).addEventListener('click', async () => {
    const faltan = activos.filter((s) => !marcas[s.id]);
    if (faltan.length) return toast(`Falta marcar a ${faltan.length} estudiante(s).`, 'bad');
    await api(`/grupos/${g.id}/asistencia`, { method: 'POST', body: { fecha: $('#fecha', box).value, tema: $('#tema', box).value, registros: marcas } });
    toast('Asistencia guardada');
    refresh();
  });
  pintar();
}

// Notas: cada evaluación general (p. ej. Unit Test 1) puede tener subnotas; su nota es el promedio de ellas.
// El promedio final es ponderado según el peso de cada evaluación general.
async function tabNotas(box, g, puedeRegistrar, panelInicial) {
  const d = await api(`/grupos/${g.id}/notas`);
  const minNota = Number(state.config.nota_aprobacion);
  const evals = d.evaluaciones;
  const sumaPesos = evals.reduce((a, e) => a + e.peso, 0);
  const editable = (s) => puedeRegistrar && s.estado === 'activo';

  // valores originales y editados
  const orig = new Map();
  for (const n of d.notas) if (n.nota != null) orig.set(`e${n.evaluacion_id}:${n.estudiante_id}`, n.nota);
  for (const n of d.subnotas) orig.set(`i${n.item_id}:${n.estudiante_id}`, n.nota);
  const val = new Map(orig);

  const r1 = (x) => Math.round(x * 10) / 10;
  const general = (e, sid) => {
    if (!e.items.length) return val.get(`e${e.id}:${sid}`) ?? null;
    const xs = e.items.map((it) => val.get(`i${it.id}:${sid}`)).filter((v) => v != null);
    return xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const final = (sid) => {
    let sp = 0;
    let s = 0;
    for (const e of evals) {
      const v = general(e, sid);
      if (v == null) continue;
      sp += e.peso;
      s += (v / e.nota_max) * 100 * e.peso;
    }
    return sp ? r1(s / sp) : null;
  };
  const tono = (v, max = 100) => (v == null ? '' : (v / max) * 100 < minNota ? 'g-bad' : (v / max) * 100 >= 90 ? 'g-top' : 'g-ok');
  const chip = (v, max = 100) => html`<span class="gchip ${tono(v, max)}">${v ?? '—'}</span>`;
  const progreso = (e, sid) => {
    if (!e.items.length) return '';
    const c = e.items.filter((it) => val.get(`i${it.id}:${sid}`) != null).length;
    return c > 0 && c < e.items.length ? html`<small class="parcial" title="Subnotas registradas">${c}/${e.items.length}</small>` : '';
  };

  const panel = panelInicial && (panelInicial === 'resumen' || evals.some((e) => String(e.id) === panelInicial)) ? panelInicial : 'resumen';
  const estudiantes = d.estudiantes;

  const resumen = html`<div class="panel" data-panel="resumen">
    <div class="table-wrap"><table class="table grades">
      <thead><tr><th class="sticky">Estudiante</th>${evals.map(
        (e) => html`<th class="num"><button class="link" data-goto="${e.id}">${e.nombre}</button><small>${e.peso}% · ${e.items.length ? `${e.items.length} subnotas` : 'nota única'}</small></th>`
      )}<th class="num col-final">Promedio final<small>ponderado /100</small></th></tr></thead>
      <tbody>${estudiantes.map(
        (s) => html`<tr data-est="${s.id}"><td class="sticky"><strong>${s.nombres}</strong>${s.estado !== 'activo' ? html` <span class="badge">${s.estado}</span>` : ''}</td>
          ${evals.map((e) => html`<td class="num" data-gen="${e.id}:${s.id}">${chip(general(e, s.id), e.nota_max)}${progreso(e, s.id)}</td>`)}
          <td class="num col-final" data-fin="${s.id}">${chip(final(s.id))}</td></tr>`
      )}</tbody>
    </table></div></div>`;

  const panelEval = (e) => html`<div class="panel" data-panel="${e.id}" hidden>
    <div class="panel-head">
      <div><h3>${e.nombre}</h3><p class="muted small">Peso ${e.peso}% del promedio final · Nota máxima ${e.nota_max}${e.items.length ? ` · La nota de "${e.nombre}" es el promedio de sus ${e.items.length} subnotas` : ''}${e.fecha ? ` · ${fechaCorta(e.fecha)}` : ''}</p></div>
      ${puedeRegistrar ? html`<button class="btn btn-ghost btn-sm" data-edit="${e.id}">Editar evaluación y subnotas</button>` : ''}
    </div>
    <div class="table-wrap"><table class="table grades">
      <thead><tr><th class="sticky">Estudiante</th>
        ${e.items.length ? e.items.map((it) => html`<th class="num">${it.nombre}<small>/${e.nota_max}</small></th>`) : html`<th class="num">Nota<small>/${e.nota_max}</small></th>`}
        ${e.items.length ? html`<th class="num col-gen">Nota ${e.nombre}<small>promedio</small></th>` : ''}
        <th class="num col-final">Promedio final<small>ponderado /100</small></th></tr></thead>
      <tbody>${estudiantes.map((s) => {
        const celda = (key, label) => {
          const v = val.get(key);
          return editable(s)
            ? html`<td class="num"><input class="grade" type="number" inputmode="decimal" min="0" max="${e.nota_max}" step="0.1" data-key="${key}" data-max="${e.nota_max}" data-est="${s.id}" value="${v ?? ''}" aria-label="${label} de ${s.nombres}"></td>`
            : html`<td class="num">${v ?? '—'}</td>`;
        };
        return html`<tr><td class="sticky"><strong>${s.nombres}</strong></td>
          ${e.items.length ? e.items.map((it) => celda(`i${it.id}:${s.id}`, it.nombre)) : celda(`e${e.id}:${s.id}`, e.nombre)}
          ${e.items.length ? html`<td class="num col-gen" data-gen="${e.id}:${s.id}">${chip(general(e, s.id), e.nota_max)}${progreso(e, s.id)}</td>` : ''}
          <td class="num col-final" data-fin="${s.id}">${chip(final(s.id))}</td></tr>`;
      })}</tbody>
    </table></div></div>`;

  setHTML(
    box,
    html`<div class="card">
      <div class="card-head"><div><h2>Calificaciones</h2><p class="muted small">Cada nota general se calcula con el promedio de sus subnotas. El promedio final es ponderado (mínimo para aprobar: ${minNota}/100).</p></div>
        <div class="actions">
          <span class="badge ${sumaPesos === 100 ? 'ok' : 'warn'}">Pesos: ${sumaPesos}%${sumaPesos !== 100 ? ' (debe sumar 100%)' : ''}</span>
          ${puedeRegistrar ? html`<button class="btn btn-ghost" id="nueva-eval">+ Evaluación</button>` : ''}
        </div></div>
      ${evals.length
        ? html`<nav class="pills" role="tablist">
            <button class="pill" data-tab="resumen" role="tab">Resumen</button>
            ${evals.map((e) => html`<button class="pill" data-tab="${e.id}" role="tab">${e.nombre} <span class="pill-n">${e.peso}%</span></button>`)}
          </nav>
          ${resumen}${evals.map(panelEval)}
          ${puedeRegistrar ? html`<div class="form-foot sticky-foot"><span class="muted small" id="cambios">Sin cambios.</span><button class="btn btn-primary" id="guardar-notas" disabled>Guardar notas</button></div>` : ''}`
        : html`<div class="empty">
            <p>Este grupo aún no tiene evaluaciones.</p>
            ${puedeRegistrar ? html`<p><button class="btn btn-primary" id="plantilla">Crear estructura estándar</button></p><p class="small">4 notas generales + examen final, cada una con 3 subnotas. Luego puede editarlas.</p>` : ''}
          </div>`}
    </div>`
  );

  const mostrar = (k) => {
    $$('.pill', box).forEach((p) => p.classList.toggle('active', p.dataset.tab === k));
    $$('[data-panel]', box).forEach((p) => (p.hidden = p.dataset.panel !== k));
    history.replaceState(null, '', `#/grupos/${g.id}/notas?p=${k}`);
  };
  $$('.pill', box).forEach((p) => p.addEventListener('click', () => mostrar(p.dataset.tab)));
  $$('[data-goto]', box).forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.goto)));
  if (evals.length) mostrar(panel);

  const cambios = () => [...val.entries()].filter(([k, v]) => (orig.get(k) ?? null) !== (v ?? null));
  const pintarEstudiante = (sid) => {
    for (const e of evals) $$(`[data-gen="${e.id}:${sid}"]`, box).forEach((c) => setHTML(c, html`${chip(general(e, sid), e.nota_max)}${progreso(e, sid)}`));
    $$(`[data-fin="${sid}"]`, box).forEach((c) => setHTML(c, chip(final(sid))));
    const n = cambios().length;
    const lbl = $('#cambios', box);
    if (lbl) lbl.textContent = n ? `${n} cambio(s) sin guardar.` : 'Sin cambios.';
    if ($('#guardar-notas', box)) $('#guardar-notas', box).disabled = !n;
  };
  box.addEventListener('input', (ev) => {
    const i = ev.target.closest('input.grade');
    if (!i) return;
    const v = i.value === '' ? null : Number(i.value);
    const bad = v != null && (!(v >= 0) || v > Number(i.dataset.max));
    i.classList.toggle('invalid', bad);
    if (v == null) val.delete(i.dataset.key);
    else val.set(i.dataset.key, v);
    pintarEstudiante(Number(i.dataset.est));
  });
  // Enter baja a la siguiente fila (como en Excel)
  box.addEventListener('keydown', (ev) => {
    const i = ev.target.closest('input.grade');
    if (!i || ev.key !== 'Enter') return;
    ev.preventDefault();
    const td = i.closest('td');
    const idx = [...td.parentElement.children].indexOf(td);
    const next = td.parentElement.nextElementSibling?.children[idx]?.querySelector('input');
    next?.focus();
    next?.select();
  });

  const evalById = new Map(evals.map((e) => [e.id, e]));
  $('#nueva-eval', box)?.addEventListener('click', () => editarEval(g));
  $$('[data-edit]', box).forEach((b) => b.addEventListener('click', () => editarEval(g, evalById.get(Number(b.dataset.edit)))));
  $('#plantilla', box)?.addEventListener('click', async () => {
    await api(`/grupos/${g.id}/evaluaciones/plantilla`, { method: 'POST', body: {} });
    toast('Estructura de notas creada');
    refresh();
  });
  $('#guardar-notas', box)?.addEventListener('click', async () => {
    if ($$('input.grade.invalid', box).length) return toast('Hay notas fuera de rango.', 'bad');
    const notas = [];
    const subnotas = [];
    for (const [k, v] of cambios()) {
      const [ref, est] = k.split(':');
      const id = Number(ref.slice(1));
      if (ref[0] === 'i') subnotas.push({ item_id: id, estudiante_id: Number(est), nota: v ?? null });
      else notas.push({ evaluacion_id: id, estudiante_id: Number(est), nota: v ?? null });
    }
    // valores borrados (ya no están en val)
    for (const k of orig.keys())
      if (!val.has(k)) {
        const [ref, est] = k.split(':');
        const id = Number(ref.slice(1));
        if (ref[0] === 'i') subnotas.push({ item_id: id, estudiante_id: Number(est), nota: null });
        else notas.push({ evaluacion_id: id, estudiante_id: Number(est), nota: null });
      }
    try {
      await api(`/grupos/${g.id}/notas`, { method: 'PUT', body: { notas, subnotas } });
    } catch (e) {
      return toast(e.message, 'bad');
    }
    toast(`${notas.length + subnotas.length} nota(s) guardada(s)`);
    refresh();
  });
}

function editarEval(g, e = {}) {
  const items = e.id ? e.items.map((it) => it.nombre) : ['Subnota 1', 'Subnota 2', 'Subnota 3'];
  const { dlg, close } = modal({
    title: e.id ? `Editar ${e.nombre}` : 'Nueva evaluación',
    fields: [
      { name: 'nombre', label: 'Nombre de la nota general', required: true, value: e.nombre, placeholder: 'Ej. Unit Test 3', full: true },
      { name: 'peso', label: 'Peso en el promedio final (%)', type: 'number', required: true, min: 1, max: 100, value: e.peso },
      { name: 'nota_max', label: 'Nota máxima', type: 'number', required: true, min: 1, value: e.nota_max ?? 100 },
      { name: 'fecha', label: 'Fecha', type: 'date', value: e.fecha },
      {
        name: 'items',
        label: 'Subnotas (una por línea)',
        type: 'textarea',
        rows: 4,
        value: items.join('\n'),
        full: true,
        hint: 'La nota general es el promedio de estas subnotas. Déjelo vacío para registrar una sola nota. Si quita una subnota, se borran sus calificaciones.',
      },
    ],
    body: e.id ? html`<p class="right"><button type="button" class="btn btn-sm btn-danger" id="del-eval">Eliminar evaluación</button></p>` : '',
    onSubmit: async (data) => {
      data.items = String(data.items || '')
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
      await api(e.id ? `/grupos/${g.id}/evaluaciones/${e.id}` : `/grupos/${g.id}/evaluaciones`, { method: e.id ? 'PUT' : 'POST', body: data });
      toast('Evaluación guardada');
      refresh();
    },
  });
  $('#del-eval', dlg)?.addEventListener('click', async () => {
    close();
    if (!(await confirmDialog('Eliminar evaluación', `Se eliminará "${e.nombre}" con todas sus subnotas y calificaciones.`, 'Eliminar'))) return;
    await api(`/grupos/${g.id}/evaluaciones/${e.id}`, { method: 'DELETE' });
    toast('Evaluación eliminada');
    refresh();
  });
}

const puedeAgregar = (g) => g.estado === 'activo' && (isStaff() || (isProfesor() && g.profesor_id === state.user.id));

// Agrega un estudiante al grupo: aparece en Estudiantes, Asistencia y Notas (todas se basan en el grupo del estudiante).
async function agregarEstudiante(g) {
  const existentes = isStaff()
    ? (await api(`/estudiantes?empresa_id=${g.empresa_id}&estado=activo`)).filter((s) => s.grupo_id !== g.id)
    : [];
  const niveles = state.niveles.map((n) => [n.codigo, `${n.codigo} · ${n.descripcion}`]);
  const { dlg } = modal({
    title: `Agregar estudiante a ${g.nombre}`,
    wide: true,
    body: html`<p class="muted small">El estudiante quedará en las pestañas Estudiantes, Asistencia y Notas de este grupo. Empresa: <strong>${g.empresa}</strong>.</p>
      ${existentes.length
        ? html`<div class="field"><label for="existente">¿Es un estudiante ya registrado?</label>
            <select id="existente" name="existente_id"><option value="">No, es un estudiante nuevo</option>
              ${existentes.map((s) => html`<option value="${s.id}">${s.nombres} · ${s.nivel_actual}${s.grupo ? ` · ahora en ${s.grupo}` : ' · sin grupo'}</option>`)}</select>
            <small class="hint">Si lo elige, se moverá a este grupo y no hace falta llenar lo demás.</small></div>`
        : ''}`,
    fields: [
      { name: 'nombres', label: 'Apellidos y nombres', required: true, full: true, placeholder: 'Ej. PÉREZ LÓPEZ ANA' },
      { name: 'cedula', label: 'Cédula / pasaporte' },
      { name: 'email', label: 'Correo', type: 'email' },
      { name: 'telefono', label: 'Teléfono' },
      { name: 'nivel_inicial', label: 'Nivel inicial (prueba de ubicación)', type: 'select', value: g.nivel, options: niveles },
      { name: 'pearson_usuario', label: 'Usuario Pearson' },
      { name: 'pearson_password', label: 'Contraseña Pearson', type: 'password', autocomplete: 'new-password', hint: 'Se guarda cifrada.' },
    ],
    submitLabel: 'Agregar al grupo',
    onSubmit: async (data) => {
      await api(`/grupos/${g.id}/estudiantes`, { method: 'POST', body: data.existente_id ? { existente_id: data.existente_id } : data });
      toast('Estudiante agregado al grupo');
      refresh();
    },
  });
  // Si elige uno existente, los datos del nuevo dejan de ser obligatorios.
  const sel = $('#existente', dlg);
  sel?.addEventListener('change', () => {
    const nuevo = !sel.value;
    $$('.form-grid input, .form-grid select', dlg).forEach((el) => {
      el.disabled = !nuevo;
      if (el.name === 'nombres') el.required = nuevo;
    });
    $('.form-grid', dlg).classList.toggle('dimmed', !nuevo);
  });
}

async function asignarEstudiantes(g) {
  const lista = (await api(`/estudiantes?empresa_id=${g.empresa_id}&estado=activo`)).filter((s) => s.grupo_id !== g.id);
  modal({
    title: `Asignar estudiantes a ${g.nombre}`,
    wide: true,
    body: lista.length
      ? html`<p class="muted small">Estudiantes activos de ${g.empresa}. Si ya están en otro grupo, se moverán a este.</p>
        <div class="check-list">${lista.map(
          (s) => html`<label class="check"><input type="checkbox" name="e${s.id}"> <strong>${s.nombres}</strong> <span class="level">${s.nivel_actual}</span> <span class="muted small">${s.grupo ? `En: ${s.grupo}` : 'Sin grupo'}</span></label>`
        )}</div>`
      : html`<p class="empty">No hay más estudiantes activos de esta empresa. Créelos en "Estudiantes".</p>`,
    submitLabel: 'Asignar',
    onSubmit: async (data) => {
      const ids = Object.entries(data)
        .filter(([k, v]) => k.startsWith('e') && v === true)
        .map(([k]) => Number(k.slice(1)));
      if (!ids.length) throw new Error('Seleccione al menos un estudiante.');
      await api(`/grupos/${g.id}/asignar`, { method: 'POST', body: { estudiantes: ids } });
      toast(`${ids.length} estudiante(s) asignado(s)`);
      refresh();
    },
  });
}

async function cerrarNivel(g) {
  const cfg = state.config;
  const aprueban = g.estudiantes.filter((s) => s.estado === 'activo' && s.aprueba);
  const sinNota = g.estudiantes.filter((s) => s.estado === 'activo' && s.nota_final == null);
  modal({
    title: `Cerrar nivel ${g.nivel} · ${g.nombre}`,
    wide: true,
    body: html`<p>Se registrará el resultado del nivel para cada estudiante. Quienes tengan promedio ≥ ${cfg.nota_aprobacion} y asistencia ≥ ${cfg.asistencia_minima}% serán <strong>promovidos al siguiente nivel</strong>. Después del cierre, profesores ya no podrán modificar notas ni asistencia.</p>
      ${sinNota.length ? html`<p class="notice warn">${sinNota.length} estudiante(s) no tienen notas registradas y quedarán como no aprobados.</p>` : ''}
      <div class="table-wrap"><table class="table"><thead><tr><th>Estudiante</th><th class="num">Asistencia</th><th class="num">Promedio</th><th>Resultado</th></tr></thead>
      <tbody>${g.estudiantes.filter((s) => s.estado === 'activo').map(
        (s) => html`<tr><td>${s.nombres}</td><td class="num">${pct(s.asistencia_pct)}</td><td class="num">${s.nota_final ?? '—'}</td>
          <td>${s.aprueba ? html`<span class="badge ok">Promueve</span>` : html`<span class="badge bad">Repite ${g.nivel}</span>`}</td></tr>`
      )}</tbody></table></div>
      <p><strong>${aprueban.length}</strong> de ${g.estudiantes.filter((s) => s.estado === 'activo').length} estudiantes promueven.</p>`,
    fields: [{ name: 'fecha', label: 'Fecha de cierre', type: 'date', required: true, value: hoyISO() }],
    submitLabel: 'Cerrar nivel',
    onSubmit: async (data) => {
      await api(`/grupos/${g.id}/cerrar`, { method: 'POST', body: data });
      toast('Nivel cerrado. Ya puede emitir certificados en Reportes.');
      refresh();
    },
  });
}
