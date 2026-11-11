// Utilidades de interfaz: plantillas seguras (escapan HTML), llamadas a la API, modales y avisos.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(s);
const fmt = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmt).join('') : v == null || v === false ? '' : esc(v));
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += fmt(vals[i]);
  });
  return raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function setHTML(el, content) {
  el.innerHTML = fmt(content);
  return el;
}

// ---------- API ----------
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
// Dirección de la API. Vacía = mismo servidor (versión local).
// Si las pantallas se publican en otro dominio (Lovable), se indica en index.html: <meta name="lt-api" content="https://...">
const API_BASE = (document.querySelector('meta[name="lt-api"]')?.content || '').replace(/\/$/, '');
const TOKEN_KEY = 'lt_token';
// Con API en otro dominio la sesión viaja como token (se borra al cerrar la pestaña).
const leerToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const guardarToken = (t) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento */
  }
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = body !== undefined ? { 'Content-Type': 'application/json' } : {};
  const token = API_BASE ? leerToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: API_BASE ? 'omit' : 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revise su internet e intente de nuevo.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (path === '/login' && res.ok && data?.token) {
    guardarToken(data.token);
    delete data.token;
  }
  if (path === '/logout') guardarToken(null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') {
      guardarToken(null);
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    throw new ApiError(res.status, data?.error || `Error ${res.status}`);
  }
  return data;
}

// ---------- avisos ----------
export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- modal ----------
// fields: [{name,label,type,options:[[value,label]],required,value,placeholder,hint,full}]
export function modal({ title, body, fields, submitLabel = 'Guardar', onSubmit, wide = false }) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal ${wide ? 'modal-wide' : ''}`;
  const formFields = fields
    ? html`<div class="form-grid">${fields.map(renderField)}</div>`
    : '';
  setHTML(
    dlg,
    html`<form method="dialog" class="modal-form" novalidate>
      <header class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></header>
      <div class="modal-body">${body || ''}${formFields}<p class="form-error" hidden></p></div>
      ${onSubmit
        ? html`<footer class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${submitLabel}</button></footer>`
        : html`<footer class="modal-foot"><button type="button" class="btn btn-primary" data-close>Cerrar</button></footer>`}
    </form>`
  );
  document.body.append(dlg);
  const close = () => {
    dlg.close();
    dlg.remove();
  };
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', close));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  const form = $('form', dlg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const err = $('.form-error', dlg);
    err.hidden = true;
    if (!form.checkValidity()) {
      err.textContent = 'Revise los campos obligatorios.';
      err.hidden = false;
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    $$('input[type=checkbox]', form).forEach((c) => (data[c.name] = c.checked));
    const btn = $('button[type=submit]', dlg);
    btn.disabled = true;
    try {
      const keep = await onSubmit(data, dlg);
      if (keep !== true) close();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  dlg.showModal();
  $('input:not([type=hidden]),select,textarea', dlg)?.focus();
  return { dlg, close };
}

function renderField(f) {
  const id = `f_${f.name}_${Math.random().toString(36).slice(2, 7)}`;
  const req = f.required ? raw(' required') : '';
  let input;
  if (f.type === 'select') {
    input = html`<select id="${id}" name="${f.name}"${req}>
      ${f.placeholder !== undefined ? html`<option value="">${f.placeholder}</option>` : ''}
      ${f.options.map(([v, l]) => html`<option value="${v}"${String(v) === String(f.value ?? '') ? raw(' selected') : ''}>${l}</option>`)}
    </select>`;
  } else if (f.type === 'textarea') {
    input = html`<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${req} placeholder="${f.placeholder || ''}">${f.value ?? ''}</textarea>`;
  } else if (f.type === 'checkbox') {
    return html`<label class="check ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.name}"${f.value ? raw(' checked') : ''}> ${f.label}</label>`;
  } else {
    input = html`<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${f.value ?? ''}"${req}
      ${f.placeholder ? html` placeholder="${f.placeholder}"` : ''}${f.min != null ? html` min="${f.min}"` : ''}${f.max != null ? html` max="${f.max}"` : ''}${f.step ? html` step="${f.step}"` : ''}
      ${f.autocomplete ? html` autocomplete="${f.autocomplete}"` : ''}>`;
  }
  return html`<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}${f.required ? html`<span class="req">*</span>` : ''}</label>${input}${f.hint ? html`<small class="hint">${f.hint}</small>` : ''}</div>`;
}

export function confirmDialog(title, message, label = 'Confirmar') {
  return new Promise((resolve) => {
    let done = false;
    const { dlg } = modal({
      title,
      body: html`<p>${message}</p>`,
      submitLabel: label,
      onSubmit: () => {
        done = true;
        resolve(true);
      },
    });
    dlg.addEventListener('close', () => !done && resolve(false));
  });
}

// ---------- formato ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fechaLarga = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};
export const mesAnio = (iso) => {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
};
export const mesCorto = (iso) => {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${MES_CORTO[m - 1]}-${String(y).slice(2)}`;
};
export const fechaCorta = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const hoyISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const pct = (v) => (v == null ? '—' : `${v}%`);
export const num = (v) => (v == null ? '—' : String(v));

// CSV sencillo (soporta comillas y separador , o ;)
export function parseCSV(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((c) => c.trim()));
  if (!clean.length) return [];
  const headers = clean[0].map((h) =>
    h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')
  );
  return clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function downloadCSV(filename, headers, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const content = '﻿' + [headers.map(q).join(';'), ...rows.map((r) => r.map(q).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
