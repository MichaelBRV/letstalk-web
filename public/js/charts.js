// Gráficos SVG livianos (sin librerías externas) con tooltip al pasar el mouse y clic para filtrar.
// data-tip: "valor|etiqueta|detalle"  → la primera parte se muestra en negrita.
// data-filter: "campo:valor"           → el tablero lo usa para filtrar en cruzado.
import { html, raw } from './lib.js';

const fx = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// ---------- tooltip global ----------
let tip;
function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.hidden = true;
  document.body.append(tip);
  const show = (el, x, y) => {
    const parts = el.dataset.tip.split('|');
    tip.replaceChildren();
    parts.forEach((p, i) => {
      const line = document.createElement(i === 0 ? 'strong' : 'span');
      line.textContent = p;
      tip.append(line);
    });
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
    const top = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  const guide = (el, on) => {
    const svg = el.closest('svg');
    const g = svg?.querySelector('.guide');
    if (!g) return;
    if (on && el.dataset.gx) {
      g.setAttribute('x1', el.dataset.gx);
      g.setAttribute('x2', el.dataset.gx);
      g.style.opacity = 1;
      const dot = svg.querySelector('.guide-dot');
      if (dot) {
        dot.setAttribute('cx', el.dataset.gx);
        dot.setAttribute('cy', el.dataset.gy);
        dot.style.opacity = 1;
      }
    } else {
      g.style.opacity = 0;
      const dot = svg.querySelector('.guide-dot');
      if (dot) dot.style.opacity = 0;
    }
  };
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) {
      if (!tip.hidden) {
        tip.hidden = true;
        document.querySelectorAll('.guide').forEach((g) => (g.style.opacity = 0));
        document.querySelectorAll('.guide-dot').forEach((g) => (g.style.opacity = 0));
      }
      return;
    }
    show(el, e.clientX, e.clientY);
    guide(el, true);
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    show(el, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', () => (tip.hidden = true));
  return tip;
}


// Ticks "redondos" para el eje Y
function ticks(min, max, n) {
  const span = max - min;
  if (!n) n = [5, 4, 6, 3].find((k) => Number.isInteger(span / k) && (span / k) % 5 === 0) || 4;
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => fx(min + step * i, 0));
}

// ---------- línea con área (asistencia en el tiempo) ----------
export function lineChart({ points, yMin = 0, yMax = 100, threshold, thresholdLabel, unit = '%', height = 240, width = 640 }) {
  const W = Math.max(300, Math.round(width));
  ensureTip();
  if (!points.length) return html`<p class="empty">Sin datos para este filtro.</p>`;
  const pad = { l: 40, r: 16, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${fx(x(i))},${fx(y(p.y))}`).join(' ');
  const area = `${path} L${fx(x(points.length - 1))},${pad.t + ih} L${fx(x(0))},${pad.t + ih} Z`;
  const every = Math.max(1, Math.ceil(points.length / Math.max(3, Math.floor(iw / 70))));
  const last = points.length - 1;
  const conEtiqueta = (i) => (i === last ? true : i % every === 0 && last - i >= every * 0.7);
  const band = points.length > 1 ? iw / (points.length - 1) : iw;
  return html`<svg class="viz" viewBox="0 0 ${W} ${height}" role="img" aria-label="Gráfico de línea">
    <defs><linearGradient id="lg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--c1)" stop-opacity=".22"/><stop offset="1" stop-color="var(--c1)" stop-opacity="0"/></linearGradient></defs>
    ${ticks(yMin, yMax).map((t) => html`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}${unit}</text>`)}
    ${threshold != null ? html`<line class="threshold" x1="${pad.l}" x2="${W - pad.r}" y1="${y(threshold)}" y2="${y(threshold)}"/><text class="threshold-lbl" x="${W - pad.r}" y="${y(threshold) - 6}" text-anchor="end">${thresholdLabel}</text>` : ''}
    <path d="${area}" fill="url(#lg-area)"/>
    <path d="${path}" class="line"/>
    ${points.length <= 40 ? points.map((p, i) => html`<circle class="pt" cx="${x(i)}" cy="${y(p.y)}" r="3"/>`) : ''}
    ${points.map((p, i) => (conEtiqueta(i) ? html`<text class="tick" x="${x(i)}" y="${height - 8}" text-anchor="middle">${p.x}</text>` : ''))}
    <line class="guide" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}"/>
    <circle class="guide-dot" r="5" cx="0" cy="0"/>
    ${points.map((p, i) => html`<rect class="hit" x="${x(i) - band / 2}" y="${pad.t}" width="${band}" height="${ih}" data-gx="${fx(x(i))}" data-gy="${fx(y(p.y))}" data-tip="${p.tip}"/>`)}
  </svg>`;
}

// ---------- columnas apiladas ----------
export function stackedColumns({ categories, series, height = 240, filterKey, width = 640 }) {
  const W = Math.max(300, Math.round(width));
  ensureTip();
  const totals = categories.map((c) => series.reduce((a, s) => a + (s.values[c] || 0), 0));
  const max = Math.max(1, ...totals);
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const pad = { l: 34, r: 10, t: 18, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = Math.min(56, (iw / categories.length) * 0.56);
  const cx = (i) => pad.l + (iw / categories.length) * (i + 0.5);
  const y = (v) => pad.t + ih - (v / niceMax) * ih;
  return html`<svg class="viz" viewBox="0 0 ${W} ${height}" role="img" aria-label="Gráfico de columnas">
    ${ticks(0, niceMax).map((t) => html`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`)}
    ${categories.map((c, i) => {
      let acc = 0;
      const segs = series
        .filter((s) => s.values[c])
        .map((s, k, arr) => {
          const v = s.values[c];
          const y0 = y(acc);
          acc += v;
          const y1 = y(acc);
          const top = k === arr.length - 1;
          const h = Math.max(0, y0 - y1 - (top ? 0 : 2));
          return html`<path class="seg" fill="${s.color}" d="${top ? roundTop(cx(i) - bw / 2, y1, bw, h) : `M${fx(cx(i) - bw / 2)},${fx(y1 + 2)}h${fx(bw)}v${fx(h)}h${fx(-bw)}Z`}"
            tabindex="0" data-tip="${v} estudiantes|${s.label} · ${c}" ${filterKey ? html`data-filter="${filterKey}:${c}"` : ''}/>`;
        });
      return html`${segs}
        <text class="val" x="${cx(i)}" y="${y(totals[i]) - 6}" text-anchor="middle">${totals[i] || ''}</text>
        <text class="cat" x="${cx(i)}" y="${height - 8}" text-anchor="middle">${c}</text>`;
    })}
    <line class="base" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}"/>
  </svg>`;
}
function roundTop(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  return `M${fx(x)},${fx(y + h)}V${fx(y + r)}Q${fx(x)},${fx(y)} ${fx(x + r)},${fx(y)}H${fx(x + w - r)}Q${fx(x + w)},${fx(y)} ${fx(x + w)},${fx(y + r)}V${fx(y + h)}Z`;
}
function roundRight(x, y, w, h) {
  const r = Math.min(4, w, h / 2);
  return `M${fx(x)},${fx(y)}H${fx(x + w - r)}Q${fx(x + w)},${fx(y)} ${fx(x + w)},${fx(y + r)}V${fx(y + h - r)}Q${fx(x + w)},${fx(y + h)} ${fx(x + w - r)},${fx(y + h)}H${fx(x)}Z`;
}

// ---------- barras horizontales (ranking) ----------
export function hbars({ rows, max = 100, threshold, thresholdLabel, unit = '', labelWidth = 170, colorFn, width = 640 }) {
  const W = Math.max(300, Math.round(width));
  ensureTip();
  if (!rows.length) return html`<p class="empty">Sin datos para este filtro.</p>`;
  const rh = 30;
  const pad = { t: threshold != null ? 22 : 6, b: 6, r: 52 };
  const height = pad.t + rows.length * rh + pad.b;
  labelWidth = Math.min(labelWidth, Math.round(W * 0.42));
  const iw = W - labelWidth - pad.r;
  const x = (v) => labelWidth + (Math.max(0, Math.min(max, v)) / max) * iw;
  return html`<svg class="viz" viewBox="0 0 ${W} ${height}" role="img" aria-label="Gráfico de barras">
    ${threshold != null ? html`<text class="threshold-lbl" x="${x(threshold)}" y="12" text-anchor="middle">${thresholdLabel}</text>` : ''}
    ${rows.map((r, i) => {
      const y0 = pad.t + i * rh;
      const w = Math.max(2, x(r.value) - labelWidth);
      return html`<g class="hrow ${r.active ? 'active' : ''}" ${r.filter ? html`data-filter="${r.filter}"` : ''} data-tip="${r.tip}" tabindex="0">
        <rect class="hit" x="0" y="${y0}" width="${W}" height="${rh}"/>
        <text class="cat" x="${labelWidth - 10}" y="${y0 + rh / 2 + 4}" text-anchor="end">${trunc(r.label, Math.floor(labelWidth / 7.2))}</text>
        <rect class="track" x="${labelWidth}" y="${y0 + 7}" width="${iw}" height="${rh - 14}" rx="4"/>
        <path class="bar" fill="${colorFn ? colorFn(r) : 'var(--c1)'}" d="${roundRight(labelWidth, y0 + 7, w, rh - 14)}"/>
        <text class="val" x="${labelWidth + w + 6}" y="${y0 + rh / 2 + 4}">${r.display ?? `${r.value}${unit}`}</text>
      </g>`;
    })}
    ${threshold != null ? html`<line class="threshold" x1="${x(threshold)}" x2="${x(threshold)}" y1="${pad.t - 4}" y2="${height - pad.b}"/>` : ''}
  </svg>`;
}
const trunc = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : s);

// ---------- barra 100% (composición) ----------
export function stack100({ parts }) {
  ensureTip();
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return html`<p class="empty">Sin registros de asistencia.</p>`;
  return html`<div class="stack100">${parts
    .filter((p) => p.value)
    .map(
      (p) => html`<span style="${raw(`flex:${p.value};background:${p.color}`)}" tabindex="0" data-tip="${fx((p.value / total) * 100)}%|${p.label} · ${p.value} registros"></span>`
    )}</div>
    <ul class="legend-list">${parts.map(
      (p) => html`<li><i class="sw" style="${raw(`background:${p.color}`)}"></i><span>${p.label}</span><strong>${fx((p.value / total) * 100)}%</strong></li>`
    )}</ul>`;
}

// ---------- dispersión (asistencia vs nota) ----------
export function scatter({ points, xThreshold, yThreshold, height = 280, width = 640 }) {
  const W = Math.max(300, Math.round(width));
  ensureTip();
  if (!points.length) return html`<p class="empty">Sin estudiantes con notas y asistencia.</p>`;
  const pad = { l: 40, r: 14, t: 12, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const xMin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.x), xThreshold) - 2) / 10) * 10);
  const yMin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.y), yThreshold) - 2) / 10) * 10);
  const x = (v) => pad.l + ((v - xMin) / (100 - xMin)) * iw;
  const y = (v) => pad.t + ih - ((v - yMin) / (100 - yMin)) * ih;
  return html`<svg class="viz" viewBox="0 0 ${W} ${height}" role="img" aria-label="Asistencia contra promedio">
    <rect class="zone-bad" x="${pad.l}" y="${pad.t}" width="${x(xThreshold) - pad.l}" height="${ih}"/>
    <rect class="zone-bad" x="${x(xThreshold)}" y="${y(yThreshold)}" width="${W - pad.r - x(xThreshold)}" height="${pad.t + ih - y(yThreshold)}"/>
    ${ticks(yMin, 100).map((t) => html`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`)}
    ${ticks(xMin, 100).map((t) => html`<text class="tick" x="${x(t)}" y="${height - 16}" text-anchor="middle">${t}%</text>`)}
    <text class="axis-title" x="${pad.l + iw / 2}" y="${height - 2}" text-anchor="middle">Asistencia</text>
    <line class="threshold" x1="${x(xThreshold)}" x2="${x(xThreshold)}" y1="${pad.t}" y2="${pad.t + ih}"/>
    <line class="threshold" x1="${pad.l}" x2="${W - pad.r}" y1="${y(yThreshold)}" y2="${y(yThreshold)}"/>
    ${points.map(
      (p) => html`<g class="dot-g" tabindex="0" data-tip="${p.tip}" ${p.href ? html`data-href="${p.href}"` : ''}>
        <circle class="hit" cx="${x(p.x)}" cy="${y(p.y)}" r="12"/>
        <circle class="dot ${p.cls || ''}" cx="${x(p.x)}" cy="${y(p.y)}" r="5"/></g>`
    )}
  </svg>`;
}
