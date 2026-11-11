import { api, html, raw, setHTML, $, $$, toast, pct, fechaLarga, fechaCorta, mesAnio, mesCorto, hoyISO } from './lib.js';
import { state } from './state.js';
import { setTitle } from './app.js';

const RECOMENDACIONES_DEF = [
  'Revisar la lista de colaboradores que no alcanzaron el nivel B2 y, si aún se encuentran activos, continuar con el programa de capacitación.',
  'Implementar un club de conversación para los colaboradores de nivel B2 para que mantengan sus habilidades y no disminuyan por falta de práctica del idioma.',
];

// ---------- selector de reportes ----------
export async function viewReportes(view, _m, params) {
  setTitle('Reportes y certificados');
  const [empresas, grupos, estudiantes] = await Promise.all([api('/empresas'), api('/grupos'), api('/estudiantes?estado=')]);
  setHTML(
    view,
    html`<div class="page-head"><div><h1>Reportes y certificados</h1><p class="muted">Genere los informes para empresas y los certificados de promoción. Todos se pueden imprimir o guardar como PDF.</p></div></div>
    <a class="card promo" href="#/tablero"><div><h2>Tablero analítico interactivo</h2><p class="muted small">Indicadores en vivo de asistencia, notas, aprobación y riesgo, con filtros por empresa, nivel, profesor y grupo. Exportable a Excel.</p></div><span class="btn btn-primary">Abrir tablero →</span></a>
    <div class="two-col">
      <form class="card" id="f-final">
        <h2>Reporte de resultados por empresa</h2>
        <p class="muted small">Formato "Reporte de resultados · Let's Talk about Business": distribución por nivel alcanzado y avance individual.</p>
        <div class="field"><label>Empresa</label><select name="empresa_id" required>${empresas.map((e) => html`<option value="${e.id}"${String(e.id) === params.get('empresa') ? raw(' selected') : ''}>${e.nombre}</option>`)}</select></div>
        <div class="form-grid">
          <div class="field"><label>Desde</label><input type="date" name="desde"></div>
          <div class="field"><label>Hasta</label><input type="date" name="hasta" value="${hoyISO()}"></div>
        </div>
        <div class="field"><label>Objetivo del reporte</label><input name="objetivo" value="Reportar el nivel alcanzado por los estudiantes durante el periodo"></div>
        <div class="field"><label>Recomendaciones (una por línea)</label><textarea name="recomendaciones" rows="5">${RECOMENDACIONES_DEF.join('\n')}</textarea></div>
        <div class="form-foot"><span></span><button class="btn btn-primary">Generar reporte</button></div>
      </form>
      <div>
        <form class="card" id="f-avance">
          <h2>Reporte de avance por grupo</h2>
          <p class="muted small">Asistencia, calificaciones parciales y alertas del nivel en curso.</p>
          <div class="field"><label>Grupo</label><select name="grupo" required>${grupos.map((g) => html`<option value="${g.id}">${g.nombre} · ${g.empresa}${g.estado === 'cerrado' ? ' (cerrado)' : ''}</option>`)}</select></div>
          <div class="form-foot"><span></span><button class="btn btn-primary">Generar avance</button></div>
        </form>
        <div class="card">
          <h2>Certificados</h2>
          <p class="muted small">Disponibles para estudiantes que aprobaron un nivel (después de "Cerrar nivel" en el grupo).</p>
          <input type="search" id="q-cert" placeholder="Buscar estudiante…">
          <ul class="cert-list" id="cert-list"></ul>
        </div>
      </div>
    </div>`
  );
  $('#f-final', view).addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    sessionStorage.setItem('lt_rep_texto', JSON.stringify({ objetivo: d.get('objetivo'), recomendaciones: d.get('recomendaciones') }));
    location.hash = `#/reportes/final?${new URLSearchParams({ empresa_id: d.get('empresa_id'), desde: d.get('desde'), hasta: d.get('hasta') })}`;
  });
  $('#f-avance', view).addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = `#/reportes/avance/${new FormData(e.target).get('grupo')}`;
  });
  const q = $('#q-cert', view);
  q.addEventListener('input', async () => {
    const term = q.value.trim().toLowerCase();
    const list = $('#cert-list', view);
    if (term.length < 2) return setHTML(list, '');
    const matches = estudiantes.filter((s) => s.nombres.toLowerCase().includes(term)).slice(0, 6);
    const det = await Promise.all(matches.map((s) => api(`/estudiantes/${s.id}`)));
    const items = det.flatMap((s) =>
      s.historial.filter((h) => h.aprobado).map((h) => html`<li><a href="#/certificado/${h.id}"><strong>${s.nombres}</strong> · Nivel ${h.nivel_cursado} aprobado · ${fechaCorta(h.fecha)}</a></li>`)
    );
    setHTML(list, items.length ? items : html`<li class="muted">Sin niveles aprobados para esa búsqueda.</li>`);
  });
}

function printBar(back) {
  return html`<div class="print-bar no-print"><a class="back" href="${back}">← Volver</a><span class="muted small">Use "Imprimir" y elija "Guardar como PDF" para obtener el archivo.</span><button class="btn btn-primary" data-print>Imprimir / Guardar PDF</button></div>`;
}
function bindPrint(view) {
  $('[data-print]', view).addEventListener('click', () => window.print());
}

// Gráfico de barras (SVG) igual al del reporte: # estudiantes y %
function barChart(dist) {
  if (!dist.length) return '';
  const W = 560, H = 260, pad = { l: 40, r: 16, t: 20, b: 40 };
  const max = Math.max(10, Math.ceil(Math.max(...dist.map((d) => d.estudiantes)) / 10) * 10);
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const slot = iw / dist.length;
  const bw = Math.min(46, slot / 3);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((max / 5) * i));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Distribución por nivel alcanzado">`;
  for (const t of ticks) s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${t}</text>`;
  dist.forEach((d, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const pctV = (d.pct / 100) * max;
    s += `<rect x="${cx - bw - 2}" y="${y(d.estudiantes)}" width="${bw}" height="${pad.t + ih - y(d.estudiantes)}" class="bar1" rx="2"/>`;
    s += `<text x="${cx - bw / 2 - 2}" y="${y(d.estudiantes) - 5}" class="val" text-anchor="middle">${d.estudiantes}</text>`;
    s += `<rect x="${cx + 2}" y="${y(pctV)}" width="${bw}" height="${pad.t + ih - y(pctV)}" class="bar2" rx="2"/>`;
    s += `<text x="${cx + bw / 2 + 2}" y="${y(pctV) - 5}" class="val" text-anchor="middle">${d.pct}%</text>`;
    s += `<text x="${cx}" y="${H - pad.b + 18}" class="axis lbl" text-anchor="middle">${d.nivel}</text>`;
  });
  s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" class="base"/></svg>`;
  s += `<div class="legend"><span><i class="sw bar1"></i># estudiantes</span><span><i class="sw bar2"></i>%</span></div>`;
  return raw(s);
}

// ---------- reporte final por empresa ----------
export async function viewReporteFinal(view, _m, params) {
  const d = await api(`/reportes/final?${params}`);
  let texto = {};
  try {
    texto = JSON.parse(sessionStorage.getItem('lt_rep_texto') || '{}');
  } catch {
    /* sin texto guardado */
  }
  const recomendaciones = (texto.recomendaciones ?? RECOMENDACIONES_DEF.join('\n')).split('\n').map((r) => r.trim()).filter(Boolean);
  const y1 = d.desde?.slice(0, 4);
  const y2 = d.hasta?.slice(0, 4);
  const periodo = y1 ? (y1 === y2 ? y1 : `${y1}-${y2}`) : '—';
  const cfg = d.config;
  setTitle(`Reporte ${d.empresa.nombre}`);
  view.className = 'printable';
  setHTML(
    view,
    html`${printBar('#/reportes')}
    <article class="doc">
      <header class="doc-head">
        <div class="brand-doc"><img class="logo" src="/img/logo-letstalk.png" alt="Let's Talk"><small>GLED · Global Education</small></div>
        <div class="doc-title"><h1>Reporte de resultados</h1><p>Programa de Inglés "Let's Talk about Business"</p><p class="doc-company">${d.empresa.nombre.toUpperCase()}</p></div>
      </header>
      <dl class="doc-meta">
        <div><dt>Periodo del reporte</dt><dd>${periodo}</dd></div>
        <div><dt>Modalidad</dt><dd>${d.modalidades.join(' & ') || '—'}</dd></div>
        ${d.modalidades.includes('Presencial') ? html`<div><dt>Ciudad modalidad presencial</dt><dd>${d.empresa.ciudad || cfg.ciudad}</dd></div>` : ''}
      </dl>

      <h2>1. Contexto del programa</h2>
      <dl class="doc-list">
        <div><dt>Objetivo del reporte</dt><dd>${texto.objetivo || 'Reportar el nivel alcanzado por los estudiantes durante el periodo'} ${periodo}</dd></div>
        <div><dt>Población capacitada</dt><dd>${d.filas.length} colaboradores</dd></div>
        <div><dt>Rango de fechas</dt><dd>${d.desde ? `${mesAnio(d.desde)} – ${mesAnio(d.hasta)}` : '—'}</dd></div>
        <div><dt>Colaboradores que subieron de nivel</dt><dd>${d.progresaron} (${d.filas.length ? Math.round((d.progresaron / d.filas.length) * 100) : 0}%)</dd></div>
      </dl>

      <h2>2. Perfil del grupo</h2>
      <h3>2.1 Distribución por nivel alcanzado (CEFR)</h3>
      ${d.filas.length
        ? html`<div class="doc-dist">
          <table class="doc-table narrow"><thead><tr><th>Nivel alcanzado</th><th># estudiantes</th><th>%</th></tr></thead>
          <tbody>${d.distribucion.map((x) => html`<tr><td>${x.nivel}</td><td>${x.estudiantes}</td><td>${x.pct}%</td></tr>`)}</tbody>
          <tfoot><tr><td>Total</td><td>${d.filas.length}</td><td>100%</td></tr></tfoot></table>
          <div class="doc-chart">${barChart(d.distribucion)}</div></div>`
        : html`<p class="notice">No hay niveles cerrados para esta empresa en el periodo seleccionado.</p>`}

      <h3>2.2 Avance individual</h3>
      <table class="doc-table"><thead><tr><th>No.</th><th>Nombre estudiante</th><th>Nivel inicial</th><th>Nivel final</th><th>Fecha fin</th></tr></thead>
        <tbody>${d.filas.map((f, i) => html`<tr><td>${i + 1}</td><td class="left">${f.nombres}</td><td>${f.nivel_inicial}</td><td>${f.nivel_final}</td><td>${mesCorto(f.fecha_fin)}</td></tr>`)}</tbody></table>

      <h2>Recomendaciones</h2>
      <ul class="doc-recs">${recomendaciones.map((r) => html`<li>${r}</li>`)}</ul>

      <footer class="doc-sign">
        <p>Elaborado por: <strong>${cfg.firma_nombre}</strong>. ${cfg.firma_cargo}</p>
        <p>${cfg.ciudad}, ${fechaLarga(hoyISO())}</p>
      </footer>
    </article>`
  );
  bindPrint(view);
}

// ---------- reporte de avance por grupo ----------
export async function viewReporteAvance(view, [id]) {
  const d = await api(`/reportes/avance/${id}`);
  const g = d.grupo;
  const cfg = d.config;
  const conNota = d.estudiantes.filter((s) => s.nota_final != null);
  const prom = conNota.length ? Math.round((conNota.reduce((a, s) => a + s.nota_final, 0) / conNota.length) * 10) / 10 : null;
  const conAsis = d.estudiantes.filter((s) => s.asistencia_pct != null);
  const asisProm = conAsis.length ? Math.round((conAsis.reduce((a, s) => a + s.asistencia_pct, 0) / conAsis.length) * 10) / 10 : null;
  setTitle(`Avance ${g.nombre}`);
  view.className = 'printable';
  setHTML(
    view,
    html`${printBar(`#/grupos/${g.id}`)}
    <article class="doc">
      <header class="doc-head">
        <div class="brand-doc"><img class="logo" src="/img/logo-letstalk.png" alt="Let's Talk"><small>GLED · Global Education</small></div>
        <div class="doc-title"><h1>Reporte de avance</h1><p>Programa de Inglés "Let's Talk about Business"</p><p class="doc-company">${g.empresa.toUpperCase()}</p></div>
      </header>
      <dl class="doc-meta">
        <div><dt>Grupo</dt><dd>${g.nombre}</dd></div>
        <div><dt>Nivel</dt><dd>${g.nivel}</dd></div>
        <div><dt>Modalidad</dt><dd>${g.modalidad}</dd></div>
        <div><dt>Profesor</dt><dd>${g.profesor || '—'}</dd></div>
        <div><dt>Periodo</dt><dd>${g.fecha_inicio ? `${fechaCorta(g.fecha_inicio)} – ${fechaCorta(g.fecha_fin)}` : '—'}</dd></div>
        <div><dt>Fecha de corte</dt><dd>${fechaCorta(hoyISO())}</dd></div>
      </dl>
      <section class="doc-kpis">
        <div><strong>${d.estudiantes.filter((s) => s.estado === 'activo').length}</strong><span>Estudiantes activos</span></div>
        <div><strong>${d.estudiantes[0]?.total_sesiones ?? 0}</strong><span>Clases dictadas</span></div>
        <div><strong>${pct(asisProm)}</strong><span>Asistencia promedio</span></div>
        <div><strong>${prom ?? '—'}</strong><span>Promedio del grupo</span></div>
        <div class="${d.estudiantes.some((s) => s.riesgo) ? 'bad' : ''}"><strong>${d.estudiantes.filter((s) => s.riesgo).length}</strong><span>En riesgo</span></div>
      </section>
      <h2>Detalle por estudiante</h2>
      <table class="doc-table"><thead><tr><th>No.</th><th>Nombre estudiante</th><th>Asistencia</th><th>Faltas</th>${d.evaluaciones.map((e) => html`<th>${e.nombre}<br><small>${e.peso}%</small></th>`)}<th>Promedio</th><th>Observación</th></tr></thead>
      <tbody id="filas"></tbody></table>
      <p class="muted small">Promedio ponderado sobre 100 con las evaluaciones calificadas a la fecha. Aprobación: ${cfg.nota_aprobacion}/100 y ${cfg.asistencia_minima}% de asistencia.</p>
      <footer class="doc-sign"><p>Elaborado por: <strong>${cfg.firma_nombre}</strong>. ${cfg.firma_cargo}</p><p>${cfg.ciudad}, ${fechaLarga(hoyISO())}</p></footer>
    </article>`
  );
  // notas por evaluación
  const notas = await api(`/grupos/${g.id}/notas`);
  const nm = new Map(notas.notas.map((x) => [`${x.evaluacion_id}:${x.estudiante_id}`, x.nota]));
  setHTML(
    $('#filas', view),
    d.estudiantes.map(
      (s, i) => html`<tr class="${s.riesgo ? 'risk' : ''}"><td>${i + 1}</td><td class="left">${s.nombres}${s.estado !== 'activo' ? ` (${s.estado})` : ''}</td><td>${pct(s.asistencia_pct)}</td><td>${s.conteo.A}</td>
      ${d.evaluaciones.map((e) => html`<td>${nm.get(`${e.id}:${s.id}`) ?? '—'}</td>`)}<td><strong>${s.nota_final ?? '—'}</strong></td>
      <td class="left small">${s.riesgo ? s.motivos.join('; ') : 'Al día'}</td></tr>`
    )
  );
  bindPrint(view);
}

// ---------- certificado ----------
// Certificado GLED (plantilla oficial): frente con los datos del estudiante + reverso con la descripción de niveles.
// Las posiciones vienen de los campos del PDF original (puntos sobre una hoja A4 de 595.28 × 841.89).
const A4W = 595.28;
const A4H = 841.89;
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const fechaIngles = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS_EN[dt.getUTCDay()]}, ${MESES_EN[m - 1]} ${d}${ordinal(d)}, ${y}`;
};
const ddmmyyyy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

// Campo posicionado: rect en puntos PDF → porcentajes; tamaño de letra relativo al ancho de la hoja.
function campo({ x0, y0, x1, y1, size, align = 'center', valign = 'center' }, contenido) {
  const st = `left:${(x0 / A4W) * 100}%;top:${(y0 / A4H) * 100}%;width:${((x1 - x0) / A4W) * 100}%;height:${((y1 - y0) / A4H) * 100}%;font-size:${(size / A4W) * 100}cqw;justify-content:${align === 'left' ? 'flex-start' : 'center'};align-items:${valign === 'top' ? 'flex-start' : 'center'};text-align:${align}`;
  return html`<div class="cert-campo" style="${raw(st)}">${contenido}</div>`;
}

export async function viewCertificado(view, [id]) {
  const c = await api(`/certificados/${id}`);
  const cfg = c.config;
  setTitle(`Certificado ${c.nombres}`);
  view.className = 'printable cert-view';
  const nombre = String(c.nombres).toUpperCase();
  // nombres largos: se reduce la letra para que quepan en el ancho del campo (441 pt)
  const tamNombre = Math.min(31.68, 441 / (nombre.length * 0.68));
  const ciudad = `${String(cfg.ciudad || 'Quito').toUpperCase()} - ECUADOR`;
  setHTML(
    view,
    html`${printBar('#/reportes')}
    <label class="check no-print cert-opt"><input type="checkbox" id="reverso" checked> Incluir reverso (descripción de niveles)</label>
    <div class="cert-hojas">
      <article class="cert-page">
        <img class="cert-fondo" src="/img/cert-frente.svg" alt="">
        ${campo({ x0: 77, y0: 289, x1: 518, y1: 351, size: tamNombre }, nombre)}
        ${campo({ x0: 78, y0: 379, x1: 515, y1: 413, size: 20.16 }, cfg.curso_certificado || "Let's Talk Business English")}
        ${campo({ x0: 236, y0: 415, x1: 303, y1: 437, size: 10.08 }, ddmmyyyy(c.fecha_inicio))}
        ${campo({ x0: 321, y0: 415, x1: 387, y1: 436, size: 10.08 }, ddmmyyyy(c.fecha))}
        ${campo({ x0: 206, y0: 454, x1: 387, y1: 475, size: 10.08 }, `${cfg.horas_por_nivel || 180} HOURS`)}
        ${campo({ x0: 302, y0: 552, x1: 510, y1: 572, size: 14.4, align: 'left' }, c.nivel_cursado)}
        ${campo({ x0: 303, y0: 577, x1: 510, y1: 593, size: 14.4, align: 'left' }, c.asistencia_pct == null ? '—' : `${Math.round(c.asistencia_pct)}%`)}
        ${campo({ x0: 131, y0: 676, x1: 465, y1: 742, size: 10.08, valign: 'top' }, html`<span>${fechaIngles(c.fecha)}<br>${ciudad}</span>`)}
      </article>
      <article class="cert-page cert-reverso">
        <img class="cert-fondo" src="/img/cert-reverso.svg" alt="">
      </article>
    </div>`
  );
  bindPrint(view);
  const hojas = $('.cert-hojas', view);
  $('#reverso', view).addEventListener('change', (e) => hojas.classList.toggle('sin-reverso', !e.target.checked));
}
