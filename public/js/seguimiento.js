// Seguimiento de deserción: casos en riesgo, acciones realizadas (llamadas, reuniones...) y retiros con su motivo.
import { api, html, setHTML, $, $$, toast, modal, pct, fechaCorta, hoyISO } from './lib.js';
import { state, isStaff, isProfesor } from './state.js';
import { setTitle, refresh } from './app.js';

export const TIPOS = {
  llamada: 'Llamada',
  mensaje: 'WhatsApp / mensaje',
  correo: 'Correo',
  reunion: 'Reunión',
  empresa: 'Aviso a la empresa (RR. HH.)',
  otro: 'Otro',
};
export const RESULTADOS = {
  compromiso: { label: 'Se compromete a continuar', cls: 'ok' },
  temporal: { label: 'Situación temporal / justificada', cls: 'info' },
  sin_respuesta: { label: 'Sin respuesta', cls: 'warn' },
  quiere_retirarse: { label: 'Quiere retirarse', cls: 'bad' },
  resuelto: { label: 'Resuelto', cls: 'ok' },
  retiro: { label: 'Retirado', cls: 'bad' },
};

// Estado del caso según su último seguimiento
export function estadoCaso(seg) {
  const hoy = hoyISO();
  if (!seg) return { key: 'sin', label: 'Sin seguimiento', cls: 'bad' };
  if (seg.resultado === 'quiere_retirarse') return { key: 'coord', label: 'Requiere coordinación', cls: 'bad' };
  if (seg.proxima_fecha && seg.proxima_fecha < hoy) return { key: 'vencida', label: `Acción vencida (${fechaCorta(seg.proxima_fecha)})`, cls: 'warn' };
  if (seg.resultado === 'sin_respuesta') return { key: 'curso', label: 'Sin respuesta', cls: 'warn' };
  return { key: 'curso', label: 'En seguimiento', cls: 'ok' };
}

export const badgeCaso = (seg) => {
  const e = estadoCaso(seg);
  return html`<span class="badge ${e.cls}">${e.label}</span>`;
};

// ---------- registrar una acción ----------
export function registrarSeguimiento(est, onSaved = refresh) {
  modal({
    title: `Seguimiento · ${est.nombres}`,
    body: est.motivos?.length ? html`<p class="notice warn">En riesgo por: ${est.motivos.join(' · ')}</p>` : '',
    fields: [
      { name: 'fecha', label: 'Fecha', type: 'date', required: true, value: hoyISO(), max: hoyISO() },
      { name: 'tipo', label: 'Tipo de contacto', type: 'select', required: true, placeholder: 'Seleccione…', options: Object.entries(TIPOS) },
      { name: 'resultado', label: 'Resultado', type: 'select', required: true, placeholder: 'Seleccione…', full: true, options: Object.entries(RESULTADOS).filter(([k]) => k !== 'retiro').map(([k, v]) => [k, v.label]) },
      { name: 'detalle', label: 'Qué se conversó / acuerdos', type: 'textarea', rows: 3, required: true, full: true, placeholder: 'Ej. Indica que tuvo cierre de mes en el trabajo; retoma desde el martes.' },
      { name: 'proxima_fecha', label: 'Próxima acción (opcional)', type: 'date', hint: 'Si no se cumple, el caso aparecerá como "Acción vencida".' },
    ],
    submitLabel: 'Guardar seguimiento',
    onSubmit: async (data) => {
      await api(`/estudiantes/${est.id}/seguimientos`, { method: 'POST', body: data });
      toast('Seguimiento registrado');
      onSaved();
    },
  });
}

// ---------- registrar retiro (coordinación / administrativo) ----------
export function registrarRetiro(est, motivos, onSaved = refresh) {
  modal({
    title: `Registrar retiro · ${est.nombres}`,
    body: html`<p class="muted small">El estudiante pasará a estado "Retirado" y dejará de aparecer en asistencia y notas. Su historial se conserva. El motivo alimenta las estadísticas de deserción.</p>`,
    fields: [
      { name: 'fecha', label: 'Fecha de retiro', type: 'date', required: true, value: hoyISO() },
      { name: 'motivo', label: 'Motivo', type: 'select', required: true, placeholder: 'Seleccione…', options: motivos.map((m) => [m, m]) },
      { name: 'detalle', label: 'Observaciones', type: 'textarea', rows: 2, full: true },
    ],
    submitLabel: 'Registrar retiro',
    onSubmit: async (data) => {
      await api(`/estudiantes/${est.id}/retiro`, { method: 'POST', body: data });
      toast('Retiro registrado');
      onSaved();
    },
  });
}

// ---------- historial (para el detalle del estudiante) ----------
export function historialHTML(items) {
  if (!items.length) return html`<p class="muted">Sin acciones de seguimiento registradas.</p>`;
  return html`<ol class="timeline">${items.map(
    (s) => html`<li><span class="tl-dot ${RESULTADOS[s.resultado]?.cls || ''}"></span>
      <div><div class="tl-head"><strong>${fechaCorta(s.fecha)}</strong> · ${TIPOS[s.tipo]} <span class="badge ${RESULTADOS[s.resultado]?.cls || ''}">${RESULTADOS[s.resultado]?.label || s.resultado}</span></div>
        <p>${s.detalle || ''}</p>
        <span class="muted small">${s.usuario_nombre || ''}${s.grupo ? ` · ${s.grupo}` : ''}${s.proxima_fecha ? ` · Próxima acción: ${fechaCorta(s.proxima_fecha)}` : ''}</span></div></li>`
  )}</ol>`;
}

export async function verHistorial(est, motivos) {
  const items = await api(`/estudiantes/${est.id}/seguimientos`);
  const { dlg, close } = modal({
    title: `Historial de seguimiento · ${est.nombres}`,
    wide: true,
    body: html`${historialHTML(items)}
      <div class="modal-actions">
        ${isStaff() && motivos ? html`<button type="button" class="btn btn-danger" id="h-retiro">Registrar retiro</button>` : ''}
        <button type="button" class="btn btn-primary" id="h-nuevo">+ Registrar seguimiento</button>
      </div>`,
  });
  $('#h-nuevo', dlg).addEventListener('click', () => {
    close();
    registrarSeguimiento(est);
  });
  $('#h-retiro', dlg)?.addEventListener('click', () => {
    close();
    registrarRetiro(est, motivos);
  });
}

// ---------- vista principal ----------
export async function viewSeguimiento(view, _m, params) {
  setTitle('Seguimiento de deserción');
  const d = await api('/seguimiento');
  const conEstado = d.casos.map((c) => ({ ...c, estado: estadoCaso(c.seguimiento) }));
  const cuenta = (k) => conEstado.filter((c) => c.estado.key === k).length;
  const kpis = [
    { k: '', l: 'Casos en riesgo', v: conEstado.length, cls: conEstado.length ? 'bad' : 'good' },
    { k: 'sin', l: 'Sin seguimiento', v: cuenta('sin'), cls: cuenta('sin') ? 'bad' : 'good' },
    { k: 'vencida', l: 'Acción vencida', v: cuenta('vencida'), cls: cuenta('vencida') ? 'bad' : 'good' },
    { k: 'coord', l: 'Requieren coordinación', v: cuenta('coord'), cls: cuenta('coord') ? 'bad' : 'good' },
    { k: 'curso', l: 'En seguimiento', v: cuenta('curso'), cls: 'good' },
  ];
  let filtro = params.get('f') || '';

  setHTML(
    view,
    html`<div class="seg-root"><div class="page-head"><div><h1>Seguimiento de deserción</h1>
      <p class="muted">Estudiantes en riesgo (asistencia baja, faltas seguidas o promedio bajo) y las acciones realizadas con cada uno.${isProfesor() ? ' Solo sus grupos.' : ''}</p></div></div>
    <section class="kpis seg-kpis">${kpis.map(
      (k) => html`<button class="kpi kpi-btn ${k.cls}" data-k="${k.k}"><div><span class="kpi-l">${k.l}</span><strong>${k.v}</strong><small>${k.k ? 'Clic para filtrar' : 'Ver todos'}</small></div></button>`
    )}</section>
    <section class="card"><div class="card-head"><h2 id="casos-t">Casos</h2></div><div id="casos"></div></section>
    <section class="card"><div class="card-head"><h2>Retirados</h2><span class="muted small">${d.retirados.length} estudiante(s)</span></div>
      ${d.retirados.length
        ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Estudiante</th><th>Grupo</th><th>Empresa</th><th>Fecha</th><th>Motivo</th><th></th></tr></thead>
          <tbody>${d.retirados.map(
            (r) => html`<tr><td><strong>${r.nombres}</strong></td><td>${r.grupo || '—'}</td><td>${r.empresa}</td><td>${r.fecha_retiro ? fechaCorta(r.fecha_retiro) : '—'}</td>
              <td>${r.motivo_retiro ? html`<span class="badge">${r.motivo_retiro}</span>` : html`<span class="muted">Sin motivo registrado</span>`}</td>
              <td class="right"><button class="btn btn-sm btn-ghost" data-hist-ret="${r.id}">Historial</button></td></tr>`
          )}</tbody></table></div>`
        : html`<p class="empty">No hay estudiantes retirados.</p>`}
    </section></div>`
  );
  const root = $('.seg-root', view);

  const pintar = () => {
    $$('.kpi-btn', root).forEach((b) => b.classList.toggle('selected', b.dataset.k === filtro));
    const lista = conEstado.filter((c) => !filtro || c.estado.key === filtro);
    $('#casos-t', root).textContent = filtro ? `Casos: ${kpis.find((k) => k.k === filtro).l}` : 'Todos los casos en riesgo';
    setHTML(
      $('#casos', root),
      lista.length
        ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Estudiante</th><th class="num">Asistencia</th><th class="num">Promedio</th><th>Motivo del riesgo</th><th>Último seguimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>${lista.map(
            (c) => html`<tr>
              <td class="col-est"><strong>${c.nombres}</strong><span class="muted small block"><a href="#/grupos/${c.grupo_id}">${c.grupo}</a> · ${c.empresa}</span></td>
              <td class="num">${pct(c.asistencia_pct)}</td><td class="num">${c.nota_final ?? '—'}</td>
              <td>${c.motivos.map((m) => html`<span class="badge bad">${m}</span> `)}</td>
              <td>${c.seguimiento
                ? html`<span class="small">${fechaCorta(c.seguimiento.fecha)} · ${TIPOS[c.seguimiento.tipo]}</span><span class="muted small block">${c.seguimiento.usuario_nombre} · ${c.seguimiento.total} acción(es)</span>`
                : html`<span class="muted small">—</span>`}</td>
              <td><span class="badge ${c.estado.cls}">${c.estado.label}</span></td>
              <td class="right"><div class="row-actions"><button class="btn btn-sm btn-primary" data-nuevo="${c.id}">+ Seguimiento</button><button class="btn btn-sm btn-ghost" data-hist="${c.id}">Historial</button></div></td>
            </tr>`
          )}</tbody></table></div>`
        : html`<p class="empty">${filtro ? 'No hay casos con este estado.' : 'No hay estudiantes en riesgo.'}</p>`
    );
  };
  const byId = new Map(conEstado.map((c) => [String(c.id), c]));
  const retById = new Map(d.retirados.map((r) => [String(r.id), r]));
  root.addEventListener('click', (e) => {
    const k = e.target.closest('.kpi-btn');
    if (k) {
      filtro = filtro === k.dataset.k ? '' : k.dataset.k;
      return pintar();
    }
    const n = e.target.closest('[data-nuevo]');
    if (n) return registrarSeguimiento(byId.get(n.dataset.nuevo));
    const hh = e.target.closest('[data-hist]');
    if (hh) return verHistorial(byId.get(hh.dataset.hist), d.motivos_retiro);
    const hr = e.target.closest('[data-hist-ret]');
    if (hr) return verHistorial(retById.get(hr.dataset.histRet));
  });
  pintar();
}
