// Tablero analítico estilo Power BI: segmentadores arriba, KPIs, gráficos que filtran en cruzado y tabla de detalle.
import { api, html, setHTML, $, $$, pct, downloadCSV, fechaCorta, mesCorto } from './lib.js';
import { state, isProfesor } from './state.js';
import { setTitle } from './app.js';
import { lineChart, stackedColumns, hbars, stack100, scatter } from './charts.js';
import { estadoCaso } from './seguimiento.js';

const KEY = 'lt_tablero_filtros';
const VACIO = { periodo: 'en_curso', empresa: '', nivel: '', profesor: '', modalidad: '', grupo: '' };
const leer = () => {
  try {
    return { ...VACIO, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...VACIO };
  }
};
const guardar = (f) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* sin almacenamiento */
  }
};

const COLOR = { ok: 'var(--c1)', riesgo: 'var(--critical)', P: 'var(--good)', A: 'var(--critical)', T: 'var(--warning)', J: 'var(--c1)' };
const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export async function viewAnalitica(view) {
  setTitle('Tablero analítico');
  const d = await api('/analitica');
  const cfg = d.config;
  const minAsis = Number(cfg.asistencia_minima);
  const minNota = Number(cfg.nota_aprobacion);
  const gById = new Map(d.grupos.map((g) => [g.id, g]));
  const f = leer();
  let orden = { col: 'riesgo', dir: -1 };
  let verTodos = false;

  const uniq = (arr, k, l) => [...new Map(arr.filter((x) => x[k] != null).map((x) => [String(x[k]), x[l]])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const opciones = {
    empresa: uniq(d.grupos, 'empresa_id', 'empresa'),
    nivel: d.niveles.filter((n) => d.grupos.some((g) => g.nivel === n)).map((n) => [n, n]),
    profesor: uniq(d.grupos, 'profesor_id', 'profesor'),
    modalidad: uniq(d.grupos, 'modalidad', 'modalidad'),
  };

  setHTML(
    view,
    html`<div class="tablero"><div class="page-head">
      <div><h1>Tablero analítico</h1><p class="muted">${isProfesor() ? 'Indicadores de sus grupos.' : 'Indicadores de asistencia, notas y riesgo de todos los programas.'}<span class="no-print"> Haga clic en cualquier barra para filtrar.</span></p></div>
      <div class="actions no-print"><button class="btn btn-ghost" id="csv">Exportar a Excel</button><button class="btn btn-ghost" id="imprimir">Imprimir / PDF</button></div>
    </div>
    <section class="slicers no-print" aria-label="Filtros">
      <div class="seg-ctl" role="radiogroup" aria-label="Periodo">
        ${[['en_curso', 'En curso'], ['historico', 'Cerrados'], ['todo', 'Todo']].map(([v, l]) => html`<button data-periodo="${v}" role="radio">${l}</button>`)}
      </div>
      ${[['empresa', 'Empresa'], ['nivel', 'Nivel'], ['profesor', 'Profesor'], ['modalidad', 'Modalidad']]
        .filter(([k]) => !(isProfesor() && k === 'profesor'))
        .map(
          ([k, l]) => html`<label class="slicer"><span>${l}</span><select data-f="${k}"><option value="">Todos</option>${opciones[k].map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select></label>`
        )}
      <label class="slicer"><span>Grupo</span><select data-f="grupo" id="f-grupo"></select></label>
      <button class="btn btn-ghost btn-sm" id="limpiar">Limpiar filtros</button>
    </section>
    <p class="print-only" id="filtros-txt"></p>
    <div id="dash"></div></div>`
  );
  // Los eventos se enlazan al contenedor interno (la vista temporal se vacía al mostrarse).
  const root = $('.tablero', view);
  let filasActuales = [];
  // Los gráficos se dibujan al ancho real de su tarjeta (y se redibujan si cambia el tamaño).
  const charts = new Map();
  const slot = (fn, opts) => {
    const k = `c${charts.size}`;
    charts.set(k, [fn, opts]);
    return html`<div class="chart-slot" data-chart="${k}"></div>`;
  };
  const draw = () =>
    $$('.chart-slot', root).forEach((el) => {
      const w = Math.floor(el.clientWidth);
      if (!w || Number(el.dataset.w) === w) return;
      el.dataset.w = w;
      const [fn, o] = charts.get(el.dataset.chart);
      setHTML(el, fn({ ...o, width: w }));
    });
  new ResizeObserver(draw).observe(root);
  window.addEventListener('resize', draw);

  const filtrar = () => {
    const grupos = d.grupos.filter(
      (g) =>
        (f.periodo === 'todo' || (f.periodo === 'en_curso' ? g.estado === 'activo' : g.estado === 'cerrado')) &&
        (!f.empresa || String(g.empresa_id) === f.empresa) &&
        (!f.nivel || g.nivel === f.nivel) &&
        (!f.profesor || String(g.profesor_id) === f.profesor) &&
        (!f.modalidad || g.modalidad === f.modalidad)
    );
    const gruposSel = f.grupo ? grupos.filter((g) => String(g.id) === f.grupo) : grupos;
    const ids = new Set(gruposSel.map((g) => g.id));
    return {
      gruposDisp: grupos,
      grupos: gruposSel,
      registros: d.registros.filter((r) => ids.has(r.grupo_id)),
      semanas: d.semanas.filter((s) => ids.has(s.grupo_id)),
      componentes: d.componentes.filter((c) => ids.has(c.grupo_id)),
      retiros: d.retiros.filter((r) => ids.has(r.grupo_id)),
    };
  };

  const pintar = () => {
    guardar(f);
    $$('[data-periodo]', root).forEach((b) => {
      b.classList.toggle('on', b.dataset.periodo === f.periodo);
      b.setAttribute('aria-checked', b.dataset.periodo === f.periodo);
    });
    $$('select[data-f]', root).forEach((s) => s.dataset.f !== 'grupo' && (s.value = f[s.dataset.f]));
    const x = filtrar();
    if (f.grupo && !x.gruposDisp.some((g) => String(g.id) === f.grupo)) {
      f.grupo = '';
      return pintar();
    }
    setHTML($('#f-grupo', root), html`<option value="">Todos</option>${x.gruposDisp.map((g) => html`<option value="${g.id}">${g.nombre}</option>`)}`);
    $('#f-grupo', root).value = f.grupo;
    const activos = Object.entries(f).filter(([k, v]) => v && k !== 'periodo');
    $('#filtros-txt', root).textContent = `Generado el ${new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })} · Filtros: ${{ en_curso: 'grupos en curso', historico: 'grupos cerrados', todo: 'todos los periodos' }[f.periodo]}${activos.length ? ' · ' + activos.map(([k]) => $(`select[data-f="${k}"]`, root)?.selectedOptions[0]?.textContent).join(' · ') : ''}`;
    charts.clear();
    setHTML($('#dash', root), dashboard(x));
    draw();
    setTimeout(draw, 0); // tras mostrarse la vista
  };

  function dashboard({ grupos, registros, semanas, componentes, retiros }) {
    if (!registros.length) return html`<div class="card"><p class="empty">No hay datos para esta combinación de filtros.</p></div>`;
    const enCurso = registros.filter((r) => r.resultado === 'en_curso');
    const cerrados = registros.filter((r) => r.resultado !== 'en_curso');
    const tot = { P: 0, A: 0, T: 0, J: 0 };
    for (const r of registros) for (const k in tot) tot[k] += r.conteo[k] || 0;
    const totalReg = tot.P + tot.A + tot.T + tot.J;
    const asis = totalReg ? Math.round(((tot.P + tot.T + tot.J) / totalReg) * 1000) / 10 : null;
    const conNota = registros.filter((r) => r.nota_final != null);
    const prom = avg(conNota.map((r) => r.nota_final));
    const aprob = conNota.length ? Math.round((conNota.filter((r) => r.aprueba).length / conNota.length) * 100) : null;
    const riesgo = enCurso.filter((r) => r.riesgo).length;
    const reprob = cerrados.filter((r) => r.resultado === 'reprobado').length;
    const estudiantes = new Set(registros.map((r) => r.estudiante_id)).size;

    const kpis = [
      { l: 'Estudiantes', v: estudiantes, s: `${grupos.length} grupo(s)`, i: 'users' },
      { l: 'Asistencia promedio', v: pct(asis), s: `Meta ≥ ${minAsis}%`, i: 'check', cls: asis != null && asis < minAsis ? 'bad' : 'good' },
      { l: 'Promedio de notas', v: prom ?? '—', s: `Mínimo ${minNota}/100`, i: 'star', cls: prom != null && prom < minNota ? 'bad' : 'good' },
      { l: 'Aprobación', v: aprob == null ? '—' : `${aprob}%`, s: enCurso.length ? 'Proyectada en grupos en curso' : 'Niveles cerrados', i: 'award' },
      enCurso.length
        ? { l: 'En riesgo de deserción', v: riesgo, s: `${enCurso.length ? Math.round((riesgo / enCurso.length) * 100) : 0}% de los estudiantes en curso`, i: 'alert', cls: riesgo ? 'bad' : 'good' }
        : { l: 'Reprobados', v: reprob, s: `${cerrados.length ? Math.round((reprob / cerrados.length) * 100) : 0}% de los cerrados`, i: 'alert', cls: reprob ? 'bad' : 'good' },
    ];

    // asistencia en el tiempo (semanal; mensual si el periodo es largo)
    const porSemana = new Map();
    for (const s of semanas) {
      const a = porSemana.get(s.semana) || { p: 0, t: 0 };
      a.p += s.presentes;
      a.t += s.total;
      porSemana.set(s.semana, a);
    }
    let serie = [...porSemana.entries()].sort(([a], [b]) => a.localeCompare(b));
    let gran = 'semana';
    if (serie.length > 26) {
      gran = 'mes';
      const m = new Map();
      for (const [k, v] of serie) {
        const a = m.get(k.slice(0, 7)) || { p: 0, t: 0 };
        a.p += v.p;
        a.t += v.t;
        m.set(k.slice(0, 7), a);
      }
      serie = [...m.entries()];
    }
    const puntos = serie.map(([k, v]) => {
      const y = Math.round((v.p / v.t) * 1000) / 10;
      const lbl = gran === 'mes' ? mesCorto(`${k}-01`) : `${k.slice(8)}/${k.slice(5, 7)}`;
      return { x: lbl, y, tip: `${y}%|${gran === 'mes' ? 'Mes' : 'Semana del'} ${gran === 'mes' ? mesCorto(`${k}-01`) : fechaCorta(k)}|${v.p} de ${v.t} asistencias` };
    });

    // estudiantes por nivel
    const niveles = d.niveles.filter((n) => registros.some((r) => gById.get(r.grupo_id).nivel === n));
    const okV = {};
    const badV = {};
    for (const r of registros) {
      const n = gById.get(r.grupo_id).nivel;
      const bad = r.riesgo || r.resultado === 'reprobado';
      (bad ? badV : okV)[n] = ((bad ? badV : okV)[n] || 0) + 1;
    }

    // promedio por grupo
    const porGrupo = grupos
      .map((g) => {
        const rs = registros.filter((r) => r.grupo_id === g.id);
        const p = avg(rs.map((r) => r.nota_final).filter((v) => v != null));
        const a = avg(rs.map((r) => r.asistencia_pct).filter((v) => v != null));
        return { g, p, a, n: rs.length, riesgo: rs.filter((r) => r.riesgo).length };
      })
      .filter((x) => x.p != null)
      .sort((a, b) => b.p - a.p)
      .slice(0, 12);

    // promedio por componente (Unit Test 1, Speaking, ...)
    const comp = new Map();
    for (const c of componentes) {
      const a = comp.get(c.nombre) || { s: 0, n: 0, peso: c.peso };
      a.s += c.promedio * c.calificadas;
      a.n += c.calificadas;
      comp.set(c.nombre, a);
    }
    const compRows = [...comp.entries()].map(([nombre, a]) => {
      const v = Math.round((a.s / a.n) * 10) / 10;
      return { label: nombre, value: v, tip: `${v}/100|${nombre} · peso ${a.peso}%|${a.n} notas registradas` };
    });

    // aprobación por empresa
    const porEmpresa = [...new Set(grupos.map((g) => g.empresa_id))].map((id) => {
      const rs = registros.filter((r) => gById.get(r.grupo_id).empresa_id === id && r.nota_final != null);
      const v = rs.length ? Math.round((rs.filter((r) => r.aprueba).length / rs.length) * 100) : 0;
      const nombre = grupos.find((g) => g.empresa_id === id).empresa;
      return { label: nombre, value: v, display: `${v}%`, filter: `empresa:${id}`, active: f.empresa === String(id), tip: `${v}% aprueba|${nombre}|${rs.filter((r) => r.aprueba).length} de ${rs.length} estudiantes` };
    });

    // motivos de riesgo
    const motivos = { asis: 0, faltas: 0, nota: 0 };
    for (const r of enCurso)
      for (const m of r.motivos) {
        if (m.startsWith('Asistencia')) motivos.asis++;
        else if (m.includes('faltas')) motivos.faltas++;
        else motivos.nota++;
      }

    // deserción y seguimiento
    const porMotivo = new Map();
    for (const r of retiros) porMotivo.set(r.motivo_retiro || 'Sin motivo registrado', (porMotivo.get(r.motivo_retiro || 'Sin motivo registrado') || 0) + 1);
    const motivosRows = [...porMotivo.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ label: m, value: v, display: String(v), tip: `${v} retiro(s)|${m}` }));
    const baseRetiro = new Set([...registros.map((r) => r.estudiante_id), ...retiros.map((r) => r.estudiante_id)]).size;
    const tasaRetiro = baseRetiro ? Math.round((retiros.length / baseRetiro) * 1000) / 10 : 0;
    const casos = enCurso.filter((r) => r.riesgo);
    const segCuenta = { curso: 0, vencida: 0, coord: 0, sin: 0 };
    for (const c of casos) segCuenta[estadoCaso(c.seguimiento).key]++;

    // tabla de detalle
    const filas = registros.map((r) => {
      const g = gById.get(r.grupo_id);
      return { ...r, grupo: g.nombre, empresa: g.empresa, nivel: g.nivel, situacion: r.resultado === 'en_curso' ? (r.riesgo ? 'En riesgo' : 'Al día') : r.resultado === 'aprobado' ? 'Aprobó' : 'Reprobó' };
    });
    const val = (r, c) => (c === 'riesgo' ? (r.riesgo || r.resultado === 'reprobado' ? 1 : 0) * 1000 - (r.asistencia_pct ?? 0) : r[c] ?? -1);
    filas.sort((a, b) => {
      const va = val(a, orden.col);
      const vb = val(b, orden.col);
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * orden.dir;
    });
    filasActuales = filas;
    const th = (c, l, num) => html`<th class="${num ? 'num' : ''} sortable ${orden.col === c ? 'sorted' : ''}" data-sort="${c}">${l}${orden.col === c ? (orden.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;

    return html`
      <section class="kpis">${kpis.map(
        (k) => html`<div class="kpi ${k.cls || ''}"><span class="kpi-ico">${KICON[k.i]}</span><div><span class="kpi-l">${k.l}</span><strong>${k.v}</strong><small>${k.s}</small></div></div>`
      )}</section>

      <section class="viz-grid">
        <article class="card viz-card span-2">
          <div class="viz-head"><h2>Asistencia ${gran === 'mes' ? 'mensual' : 'semanal'}</h2><span class="muted small">% de asistencias (P + T + J)</span></div>
          ${slot(lineChart, { points: puntos, yMin: 50, yMax: 100, threshold: minAsis, thresholdLabel: `Meta ${minAsis}%` })}
        </article>
        <article class="card viz-card">
          <div class="viz-head"><h2>Composición de la asistencia</h2></div>
          ${stack100({ parts: [
            { label: 'Presente', value: tot.P, color: COLOR.P },
            { label: 'Atraso', value: tot.T, color: COLOR.T },
            { label: 'Justificada', value: tot.J, color: COLOR.J },
            { label: 'Ausente', value: tot.A, color: COLOR.A },
          ] })}
          ${enCurso.length
            ? html`<h3 class="mini-h">Motivos de riesgo (en curso)</h3>
              <ul class="reasons">
                <li><span>Asistencia &lt; ${minAsis}%</span><strong>${motivos.asis}</strong></li>
                <li><span>${cfg.faltas_consecutivas_alerta}+ faltas seguidas</span><strong>${motivos.faltas}</strong></li>
                <li><span>Promedio &lt; ${minNota}</span><strong>${motivos.nota}</strong></li>
              </ul>`
            : ''}
        </article>

        <article class="card viz-card">
          <div class="viz-head"><h2>Estudiantes por nivel</h2>
            <span class="legend"><span><i class="sw" style="background:var(--c1)"></i>Al día / aprobó</span><span><i class="sw" style="background:var(--critical)"></i>En riesgo / reprobó</span></span></div>
          ${slot(stackedColumns, { categories: niveles, filterKey: 'nivel', series: [
            { label: 'Al día / aprobó', color: COLOR.ok, values: okV },
            { label: 'En riesgo / reprobó', color: COLOR.riesgo, values: badV },
          ] })}
        </article>
        <article class="card viz-card span-2">
          <div class="viz-head"><h2>Promedio por grupo</h2><span class="muted small">Línea = nota mínima ${minNota}</span></div>
          ${slot(hbars, {
            rows: porGrupo.map((x) => ({
              label: x.g.nombre, value: x.p, filter: `grupo:${x.g.id}`, active: f.grupo === String(x.g.id),
              tip: `${x.p}/100|${x.g.nombre} · ${x.g.empresa}|Asistencia ${pct(x.a)} · ${x.n} estudiantes${x.riesgo ? ` · ${x.riesgo} en riesgo` : ''}`,
            })),
            threshold: minNota, thresholdLabel: `Mín. ${minNota}`, labelWidth: 190,
            colorFn: (r) => (r.value < minNota ? 'var(--critical)' : 'var(--c1)'),
          })}
        </article>

        <article class="card viz-card span-2">
          <div class="viz-head"><h2>Asistencia vs. promedio</h2>
            <span class="legend"><span><i class="dot-sw"></i>Al día</span><span><i class="dot-sw bad"></i>En riesgo / reprobó</span></span></div>
          ${slot(scatter, {
            xThreshold: minAsis, yThreshold: minNota,
            points: filas
              .filter((r) => r.nota_final != null && r.asistencia_pct != null)
              .map((r) => ({
                x: r.asistencia_pct, y: r.nota_final, cls: r.riesgo || r.resultado === 'reprobado' ? 'bad' : '', href: `#/grupos/${r.grupo_id}`,
                tip: `${r.nombres}|Asistencia ${r.asistencia_pct}% · Promedio ${r.nota_final}|${r.grupo}`,
              })),
          })}
          <p class="muted small">Zona sombreada = por debajo de la meta de asistencia o de la nota mínima.</p>
        </article>
        <article class="card viz-card">
          <div class="viz-head"><h2>Promedio por componente</h2></div>
          ${slot(hbars, { rows: compRows, threshold: minNota, thresholdLabel: `Mín. ${minNota}`, labelWidth: 200, colorFn: (r) => (r.value < minNota ? 'var(--critical)' : 'var(--c1)') })}
          ${isProfesor() ? '' : html`<h3 class="mini-h">Aprobación por empresa</h3>${slot(hbars, { rows: porEmpresa, labelWidth: 200, colorFn: () => 'var(--c2)' })}`}
        </article>
        <article class="card viz-card span-2">
          <div class="viz-head"><h2>Deserción: motivos de retiro</h2><span class="muted small">${retiros.length} retiro(s) · tasa ${tasaRetiro}% de los estudiantes</span></div>
          ${retiros.length ? slot(hbars, { rows: motivosRows, max: Math.max(...motivosRows.map((r) => r.value)), labelWidth: 210, colorFn: () => 'var(--c2)' }) : html`<p class="empty">Sin retiros en este filtro.</p>`}
        </article>
        <article class="card viz-card">
          <div class="viz-head"><h2>Seguimiento de casos en riesgo</h2><a class="small no-print" href="#/seguimiento">Abrir →</a></div>
          ${casos.length
            ? stack100({ parts: [
                { label: 'En seguimiento', value: segCuenta.curso, color: COLOR.ok },
                { label: 'Acción vencida', value: segCuenta.vencida, color: COLOR.T },
                { label: 'Requieren coordinación', value: segCuenta.coord, color: 'var(--c2)' },
                { label: 'Sin seguimiento', value: segCuenta.sin, color: COLOR.A },
              ] })
            : html`<p class="empty">Sin casos en riesgo.</p>`}
        </article>
      </section>

      <section class="card detalle">
        <div class="card-head"><h2>Detalle por estudiante</h2><span class="muted small">${filas.length} registro(s)<span class="no-print"> · clic en el encabezado para ordenar</span></span></div>
        <div class="table-wrap"><table class="table tabla-detalle">
          <thead><tr>${th('nombres', 'Estudiante')}${th('grupo', 'Grupo')}${th('empresa', 'Empresa')}${th('nivel', 'Nivel')}${th('asistencia_pct', 'Asistencia', true)}${th('nota_final', 'Promedio', true)}${th('riesgo', 'Situación')}</tr></thead>
          <tbody>${filas.map(
            (r, i) => html`<tr class="row-link ${r.riesgo ? 'row-risk' : ''} ${!verTodos && i >= 15 ? 'row-extra' : ''}" data-href="#/grupos/${r.grupo_id}">
              <td><strong>${r.nombres}</strong></td><td>${r.grupo}</td><td>${r.empresa}</td><td><span class="level">${r.nivel}</span></td>
              <td class="num">${meter(r.asistencia_pct, minAsis)}</td><td class="num">${r.nota_final ?? '—'}</td>
              <td><span class="badge ${{ 'En riesgo': 'bad', Reprobó: 'bad', 'Al día': 'ok', Aprobó: 'ok' }[r.situacion]}">${r.situacion}</span>
                ${r.riesgo ? html`<span class="muted small"> ${r.motivos.join(' · ')}</span>` : ''}</td></tr>`
          )}</tbody></table></div>
        ${filas.length > 15 ? html`<p class="right no-print"><button class="btn btn-ghost btn-sm" id="ver-todos">${verTodos ? 'Ver menos' : `Ver los ${filas.length}`}</button></p>` : ''}
      </section>`;
  }

  // ---------- eventos ----------
  root.addEventListener('click', (e) => {
    const p = e.target.closest('[data-periodo]');
    if (p) {
      f.periodo = p.dataset.periodo;
      return pintar();
    }
    const fl = e.target.closest('[data-filter]');
    if (fl) {
      const [k, v] = fl.dataset.filter.split(':');
      f[k] = f[k] === v ? '' : v; // segundo clic quita el filtro
      return pintar();
    }
    const s = e.target.closest('[data-sort]');
    if (s) {
      orden = { col: s.dataset.sort, dir: orden.col === s.dataset.sort ? -orden.dir : 1 };
      return pintar();
    }
    if (e.target.closest('#ver-todos')) {
      verTodos = !verTodos;
      return pintar();
    }
    if (e.target.closest('#limpiar')) {
      Object.assign(f, VACIO);
      return pintar();
    }
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-filter]')) {
      e.preventDefault();
      e.target.closest('[data-filter]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  root.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-f]');
    if (!s) return;
    f[s.dataset.f] = s.value;
    pintar();
  });
  $('#imprimir', root).addEventListener('click', () => window.print());
  $('#csv', root).addEventListener('click', () =>
    downloadCSV(
      'tablero-letstalk.csv',
      ['Estudiante', 'Grupo', 'Empresa', 'Nivel', 'Asistencia %', 'Promedio', 'Situación', 'Motivos'],
      filasActuales.map((r) => [r.nombres, r.grupo, r.empresa, r.nivel, r.asistencia_pct ?? '', r.nota_final ?? '', r.situacion, r.motivos.join(' / ')])
    )
  );
  pintar();
}

const meter = (v, meta) =>
  v == null ? '—' : html`<span class="meter"><span class="meter-bar"><i class="${v < meta ? 'bad' : ''}" style="width:${Math.max(0, Math.min(100, v))}%"></i></span>${v}%</span>`;

const svg = (d) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const KICON = {
  users: svg('M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1a5 5 0 0 1 10 0v1M12 20v-1a5 5 0 0 1 10 0v1'),
  check: svg('M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9'),
  star: svg('M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z'),
  award: svg('M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14L7 22l5-3 5 3-1.5-8'),
  alert: svg('M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'),
};
