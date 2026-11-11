import { api, html, raw, setHTML, $, $$, toast, modal, pct, fechaLarga, hoyISO } from './lib.js';
import { state, ROL_LABEL, isStaff, isCoord } from './state.js';
import { viewGrupos, viewGrupo } from './grupos.js';
import { viewEstudiantes } from './estudiantes.js';
import { viewEmpresas, viewUsuarios, viewAuditoria, viewConfig } from './admin.js';
import { viewReportes, viewReporteFinal, viewReporteAvance, viewCertificado } from './reportes.js';
import { viewAnalitica } from './analitica.js';
import { viewSeguimiento, registrarSeguimiento, badgeCaso } from './seguimiento.js';

const app = $('#app');

const NAV = [
  { sec: 'Principal' },
  { href: '#/inicio', label: 'Inicio', icon: 'home', show: () => true },
  { href: '#/tablero', label: 'Tablero analítico', icon: 'chart', show: () => true },
  { sec: 'Académico' },
  { href: '#/grupos', label: 'Grupos', icon: 'groups', show: () => true },
  { href: '#/estudiantes', label: 'Estudiantes', icon: 'student', show: () => true },
  { href: '#/seguimiento', label: 'Seguimiento de deserción', icon: 'alert', show: () => true },
  { href: '#/reportes', label: 'Reportes y certificados', icon: 'report', show: isStaff },
  { sec: 'Gestión', show: isStaff },
  { href: '#/empresas', label: 'Empresas', icon: 'building', show: isStaff },
  { href: '#/usuarios', label: 'Profesores y usuarios', icon: 'users', show: isStaff },
  { href: '#/auditoria', label: 'Auditoría', icon: 'shield', show: isCoord },
  { href: '#/config', label: 'Configuración', icon: 'gear', show: () => true },
];

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  groups: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1a5 5 0 0 1 10 0v1M12 20v-1a5 5 0 0 1 10 0v1',
  student: 'M12 3l10 5-10 5L2 8zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 9h4a1 1 0 0 1 1 1v11M8 7h3M8 11h3M8 15h3M2 21h20',
  users: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 17v-3M12 17v-6M15 17v-4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6M20 8v4h-4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
};
export const icon = (name) =>
  raw(`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`);

// ---------- login ----------
function renderLogin(msg) {
  document.body.classList.remove('shell');
  setHTML(
    app,
    html`<main class="login">
      <section class="login-hero">
        <div><img class="logo" src="/img/logo-letstalk-blanco.png" alt="Let's Talk"><span class="brand-sub">Programas corporativos de inglés · GLED</span></div>
        <div class="login-copy">
          <h2>Gestión académica en un solo lugar</h2>
          <ul>
            <li>${icon('check')} Asistencia por clase con alertas de deserción</li>
            <li>${icon('star')} Notas generales con subnotas y promedio automático</li>
            <li>${icon('chart')} Tablero analítico y reportes para empresas</li>
            <li>${icon('shield')} Datos de estudiantes protegidos y auditados</li>
          </ul>
        </div>
        <p class="login-legal">Uso exclusivo del personal autorizado de GLED.</p>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <img class="logo" src="/img/logo-letstalk.png" alt="Let's Talk">
          <h1>Iniciar sesión</h1>
          <p class="muted">Acceso para coordinación, personal administrativo y profesores.</p>
          <form id="login-form" autocomplete="on">
            <div class="field"><label for="email">Correo</label><input id="email" name="email" type="email" required autocomplete="username" placeholder="nombre@gledcenter.com"></div>
            <div class="field"><label for="password">Contraseña</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>
            <p class="form-error" ${msg ? '' : raw('hidden')}>${msg || ''}</p>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Ingresar</button>
          </form>
          <p class="login-foot">${icon('shield')} Cada acceso queda registrado. La sesión se cierra tras 30 minutos sin uso.</p>
        </div>
      </section>
    </main>`
  );
  const form = $('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form);
    err.hidden = true;
    const btn = $('button', form);
    btn.disabled = true;
    try {
      state.user = await api('/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      await boot();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  $('#email').focus();
}

// ---------- estructura principal ----------
function renderShell() {
  document.body.classList.add('shell');
  const u = state.user;
  setHTML(
    app,
    html`<aside class="sidebar" id="sidebar">
        <div class="brand"><div><img class="logo" src="/img/logo-letstalk-blanco.png" alt="Let's Talk"><span class="brand-sub">Gestión académica · GLED</span></div></div>
        <nav>${NAV.filter((n) => (n.show ? n.show() : true)).map((n) =>
          n.sec ? html`<span class="nav-sec">${n.sec}</span>` : html`<a href="${n.href}" data-nav="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`
        )}</nav>
        <div class="sidebar-foot">
          <div class="me"><span class="avatar">${initials(u.nombre)}</span><div><strong>${u.nombre}</strong><small>${ROL_LABEL[u.rol]}</small></div></div>
          <button class="btn btn-ghost btn-block" id="logout">${icon('logout')} Cerrar sesión</button>
        </div>
      </aside>
      <div class="sidebar-scrim" id="scrim"></div>
      <div class="main-wrap">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menú">☰</button>
          <span class="topbar-title" id="topbar-title"></span>
          <span class="topbar-date">${hoyLargo()}</span>
          <span class="topbar-user"><span class="avatar sm">${initials(u.nombre)}</span><span>${u.nombre.split(' ')[0]}</span></span>
        </header>
        <main id="view" class="view" tabindex="-1"></main>
      </div>`
  );
  $('#logout').addEventListener('click', async () => {
    await api('/logout', { method: 'POST', body: {} }).catch(() => {});
    state.user = null;
    location.hash = '';
    renderLogin();
  });
  $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#scrim').addEventListener('click', () => $('#sidebar').classList.remove('open'));
}

const initials = (s) =>
  s
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hoyLargo = () => {
  const d = new Date();
  const s = `${DIAS[d.getDay()]}, ${fechaLarga(hoyISO())}`;
  return s[0].toUpperCase() + s.slice(1);
};

export function setTitle(t) {
  document.title = `${t} · Let's Talk`;
  const el = $('#topbar-title');
  if (el) el.textContent = t;
}

// ---------- inicio ----------
async function viewInicio(view) {
  setTitle('Inicio');
  const d = await api('/dashboard');
  const t = d.totales;
  const cfg = state.config;
  const prom = (xs) => {
    const v = xs.filter((x) => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const asis = prom(d.grupos.map((g) => g.asistencia_prom));
  const nota = prom(d.grupos.map((g) => g.nota_prom));
  const cards = [
    { l: 'Grupos activos', v: t.grupos, i: 'groups', s: t.profesores != null ? `${t.profesores} profesores` : 'Asignados a usted' },
    { l: 'Estudiantes activos', v: t.estudiantes, i: 'student', s: t.empresas != null ? `${t.empresas} empresas` : 'En sus grupos' },
    { l: 'Asistencia promedio', v: pct(asis), i: 'check', s: `Meta ≥ ${cfg.asistencia_minima}%`, cls: asis != null && asis < Number(cfg.asistencia_minima) ? 'bad' : 'good' },
    { l: 'Promedio de notas', v: nota ?? '—', i: 'star', s: `Mínimo ${cfg.nota_aprobacion}/100`, cls: nota != null && nota < Number(cfg.nota_aprobacion) ? 'bad' : 'good' },
    { l: 'En riesgo', v: d.alertas.length, i: 'alert', s: `${d.alertas.filter((a) => !a.seguimiento).length} sin seguimiento`, cls: d.alertas.length ? 'bad' : 'good' },
  ];
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const bar = (v, meta, unit = '%') =>
    html`<span class="mini-bar"><i class="${v != null && v < meta ? 'bad' : ''}" style="width:${Math.max(0, Math.min(100, v ?? 0))}%"></i></span><b>${v ?? '—'}${v != null ? unit : ''}</b>`;
  setHTML(
    view,
    html`<section class="hero">
      <div><p class="hero-kicker">${saludo}</p><h1>${state.user.nombre.split(' ')[0]}, este es el estado de ${state.user.rol === 'profesor' ? 'sus grupos' : 'los programas'}</h1>
        <p class="muted">${d.alertas.length ? `Hay ${d.alertas.length} estudiante(s) que requieren seguimiento.` : 'Todos los estudiantes están al día.'}</p></div>
      <div class="actions"><a class="btn btn-ghost" href="#/tablero">${icon('chart')} Ver tablero analítico</a>${state.user.rol !== 'administrativo' ? html`<a class="btn btn-primary" href="#/grupos">${icon('check')} Tomar asistencia</a>` : ''}</div>
    </section>
    <section class="kpis">${cards.map(
      (k) => html`<div class="kpi ${k.cls || ''}"><span class="kpi-ico">${icon(k.i)}</span><div><span class="kpi-l">${k.l}</span><strong>${k.v}</strong><small>${k.s}</small></div></div>`
    )}</section>

    <div class="home-grid">
      <section class="card">
        <div class="card-head"><h2>${state.user.rol === 'profesor' ? 'Mis grupos' : 'Grupos activos'}</h2><a class="small" href="#/grupos">Ver todos →</a></div>
        <div class="group-cards">${d.grupos.map(
          (g) => html`<a class="group-card" href="#/grupos/${g.id}">
            <div class="gc-top"><span class="level">${g.nivel}</span><span class="badge">${g.modalidad}</span>${g.en_riesgo ? html`<span class="badge bad">${g.en_riesgo} en riesgo</span>` : ''}</div>
            <strong>${g.nombre}</strong>
            <span class="muted small">${g.empresa} · ${g.horario || ''}</span>
            <div class="gc-metrics">
              <span>Asistencia</span>${bar(g.asistencia_prom, Number(cfg.asistencia_minima))}
              <span>Promedio</span>${bar(g.nota_prom, Number(cfg.nota_aprobacion), '')}
            </div>
            <span class="gc-foot">${g.estudiantes} estudiantes · ${g.sesiones} clases · ${g.profesor || 'Sin profesor'}</span>
          </a>`
        )}</div>
        ${d.grupos.length ? '' : html`<p class="empty">No hay grupos activos.</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h2>Alertas de deserción</h2><a class="small" href="#/seguimiento">Ver seguimiento →</a></div>
        <p class="muted small">Asistencia &lt; ${cfg.asistencia_minima}%, ${cfg.faltas_consecutivas_alerta}+ faltas seguidas o promedio &lt; ${cfg.nota_aprobacion}.</p>
        ${d.alertas.length
          ? html`<ul class="alert-list">${d.alertas.map(
              (a) => html`<li>
                <span class="avatar sm bad">${initials(a.nombres)}</span>
                <div class="grow"><strong>${a.nombres}</strong><span class="muted small"><a href="#/grupos/${a.grupo_id}">${a.grupo}</a> · ${a.empresa}</span>
                  <span class="alert-tags">${a.motivos.map((m) => html`<span class="badge bad">${m}</span>`)}</span>
                  <span class="alert-seg">${badgeCaso(a.seguimiento)}<button class="link small" data-seg="${a.id}">+ Registrar seguimiento</button></span></div>
              </li>`
            )}</ul>`
          : html`<p class="empty">Sin estudiantes en riesgo.</p>`}
      </section>
    </div>`
  );
  const porId = new Map(d.alertas.map((x) => [String(x.id), x]));
  $$('[data-seg]', view).forEach((b) => b.addEventListener('click', () => registrarSeguimiento(porId.get(b.dataset.seg))));
}

// ---------- router ----------
const ROUTES = [
  [/^#\/inicio$/, viewInicio],
  [/^#\/tablero$/, viewAnalitica],
  [/^#\/seguimiento$/, viewSeguimiento],
  [/^#\/grupos$/, viewGrupos],
  [/^#\/grupos\/(\d+)(?:\/(\w+))?$/, viewGrupo],
  [/^#\/estudiantes$/, viewEstudiantes],
  [/^#\/empresas$/, viewEmpresas],
  [/^#\/usuarios$/, viewUsuarios],
  [/^#\/reportes$/, viewReportes],
  [/^#\/reportes\/final$/, viewReporteFinal],
  [/^#\/reportes\/avance\/(\d+)$/, viewReporteAvance],
  [/^#\/certificado\/(\d+)$/, viewCertificado],
  [/^#\/auditoria$/, viewAuditoria],
  [/^#\/config$/, viewConfig],
];

let renderSeq = 0;
async function route() {
  if (!state.user) return;
  const full = location.hash || '#/inicio';
  const [hash, query] = full.split('?');
  const params = new URLSearchParams(query || '');
  const match = ROUTES.map(([re, fn]) => [hash.match(re), fn]).find(([m]) => m);
  if (!match) {
    location.hash = '#/inicio';
    return;
  }
  const [m, fn] = match;
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', hash.startsWith(a.dataset.nav)));
  $('#sidebar')?.classList.remove('open');
  const view = $('#view');
  const seq = ++renderSeq;
  view.classList.add('loading');
  try {
    const tmp = document.createElement('div');
    await fn(tmp, m.slice(1), params);
    if (seq !== renderSeq) return;
    view.replaceChildren(...tmp.childNodes);
    view.className = `view ${tmp.className || ''}`;
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    setHTML(view, html`<div class="card"><h2>No se pudo cargar</h2><p class="form-error">${e.message}</p></div>`);
  } finally {
    view.classList.remove('loading');
  }
}

// Re-render de la vista actual (tras guardar cambios)
export const refresh = () => route();

// filas clicables
document.addEventListener('click', (e) => {
  const tr = e.target.closest('[data-href]');
  if (tr && !e.target.closest('a,button,input,select,label')) location.hash = tr.dataset.href;
});

window.addEventListener('hashchange', route);
window.addEventListener('session-expired', () => {
  if (!state.user) return;
  state.user = null;
  renderLogin('Su sesión expiró por seguridad. Ingrese nuevamente.');
});

async function boot() {
  try {
    state.user = state.user || (await api('/me'));
  } catch {
    return renderLogin();
  }
  [state.niveles, state.config] = await Promise.all([api('/niveles'), api('/config')]);
  renderShell();
  if (!location.hash || location.hash === '#/') location.hash = '#/inicio';
  else route();
}

export { toast, modal };
boot();
