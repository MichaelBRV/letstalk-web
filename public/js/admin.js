import { api, html, setHTML, $, $$, toast, modal } from './lib.js';
import { state, ROL_LABEL, isCoord, isStaff } from './state.js';
import { setTitle, refresh } from './app.js';
import { showCredenciales } from './estudiantes.js';

// ---------- empresas ----------
export async function viewEmpresas(view) {
  setTitle('Empresas');
  const empresas = await api('/empresas');
  setHTML(
    view,
    html`<div class="page-head"><div><h1>Empresas</h1><p class="muted">Clientes corporativos del programa Let's Talk.</p></div>
      <div class="actions"><button class="btn btn-primary" id="nuevo">+ Nueva empresa</button></div></div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>Empresa</th><th>Ciudad</th><th>Contacto</th><th>Correo</th><th class="num">Grupos activos</th><th class="num">Estudiantes activos</th><th></th></tr></thead>
      <tbody>${empresas.map(
        (e) => html`<tr><td><strong>${e.nombre}</strong></td><td>${e.ciudad || ''}</td><td>${e.contacto || ''}</td><td>${e.email_contacto || ''}</td>
        <td class="num">${e.grupos}</td><td class="num">${e.estudiantes}</td><td class="right"><button class="btn btn-sm btn-ghost" data-edit="${e.id}">Editar</button>
        <a class="btn btn-sm btn-ghost" href="#/reportes?empresa=${e.id}">Reporte</a></td></tr>`
      )}</tbody></table></div>${empresas.length ? '' : html`<p class="empty">No hay empresas registradas.</p>`}</div>`
  );
  const edit = (e = {}) =>
    modal({
      title: e.id ? 'Editar empresa' : 'Nueva empresa',
      fields: [
        { name: 'nombre', label: 'Nombre', required: true, value: e.nombre, full: true },
        { name: 'ciudad', label: 'Ciudad', value: e.ciudad },
        { name: 'contacto', label: 'Persona / área de contacto', value: e.contacto },
        { name: 'email_contacto', label: 'Correo de contacto', type: 'email', value: e.email_contacto, full: true },
      ],
      onSubmit: async (data) => {
        await api(e.id ? `/empresas/${e.id}` : '/empresas', { method: e.id ? 'PUT' : 'POST', body: data });
        toast('Empresa guardada');
        refresh();
      },
    });
  $('#nuevo', view).addEventListener('click', () => edit());
  $$('[data-edit]', view).forEach((b) => b.addEventListener('click', () => edit(empresas.find((e) => e.id === Number(b.dataset.edit)))));
}

// ---------- usuarios ----------
export async function viewUsuarios(view) {
  setTitle('Profesores y usuarios');
  const usuarios = await api('/usuarios');
  const coord = isCoord();
  setHTML(
    view,
    html`<div class="page-head"><div><h1>Profesores y usuarios</h1><p class="muted">Solo coordinación puede crear usuarios. Nadie puede registrarse por su cuenta.</p></div>
      <div class="actions">${coord ? html`<button class="btn btn-primary" id="nuevo">+ Nuevo usuario</button>` : ''}</div></div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Teléfono</th><th>Usuario Pearson</th><th class="num">Grupos activos</th><th>Estado</th>${coord ? html`<th></th>` : ''}</tr></thead>
      <tbody>${usuarios.map(
        (u) => html`<tr><td><strong>${u.nombre}</strong></td><td>${u.email}</td><td>${ROL_LABEL[u.rol]}</td><td>${u.telefono || ''}</td>
        <td class="small">${u.pearson_usuario || html`<span class="muted">—</span>`}</td><td class="num">${u.rol === 'profesor' ? u.grupos : ''}</td>
        <td><span class="badge ${u.activo ? 'ok' : 'bad'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        ${coord
          ? html`<td class="right nowrap"><button class="btn btn-sm btn-ghost" data-edit="${u.id}">Editar</button><button class="btn btn-sm btn-ghost" data-reset="${u.id}">Contraseña</button>
            ${u.pearson_usuario ? html`<button class="btn btn-sm btn-ghost" data-cred="${u.id}">Acceso Pearson</button>` : ''}</td>`
          : ''}</tr>`
      )}</tbody></table></div></div>`
  );
  if (!coord) return;
  const roles = Object.entries(ROL_LABEL);
  const edit = (u = {}) =>
    modal({
      title: u.id ? 'Editar usuario' : 'Nuevo usuario',
      fields: [
        { name: 'nombre', label: 'Nombre completo', required: true, value: u.nombre, full: true },
        { name: 'email', label: 'Correo (usuario de acceso)', type: 'email', required: true, value: u.email, placeholder: 'nombre@gledcenter.com' },
        { name: 'rol', label: 'Rol', type: 'select', required: true, value: u.rol || 'profesor', options: roles },
        { name: 'telefono', label: 'Teléfono', value: u.telefono },
        ...(u.id ? [] : [{ name: 'password', label: 'Contraseña inicial', type: 'password', required: true, autocomplete: 'new-password', hint: 'Mínimo 10 caracteres, letras y números.' }]),
        { name: 'pearson_usuario', label: 'Usuario Pearson', value: u.pearson_usuario },
        { name: 'pearson_password', label: 'Contraseña Pearson', type: 'password', autocomplete: 'new-password', hint: u.tiene_pearson_pass ? 'Dejar vacío para mantener la actual.' : 'Se guarda cifrada.' },
        ...(u.id ? [{ name: 'activo', label: 'Usuario activo (desmarcar para bloquear el acceso)', type: 'checkbox', value: !!u.activo, full: true }] : []),
      ],
      onSubmit: async (data) => {
        await api(u.id ? `/usuarios/${u.id}` : '/usuarios', { method: u.id ? 'PUT' : 'POST', body: data });
        toast('Usuario guardado');
        refresh();
      },
    });
  $('#nuevo', view).addEventListener('click', () => edit());
  const byId = (id) => usuarios.find((u) => u.id === Number(id));
  $$('[data-edit]', view).forEach((b) => b.addEventListener('click', () => edit(byId(b.dataset.edit))));
  $$('[data-cred]', view).forEach((b) => b.addEventListener('click', () => showCredenciales(b.dataset.cred, 'usuarios')));
  $$('[data-reset]', view).forEach((b) =>
    b.addEventListener('click', () => {
      const u = byId(b.dataset.reset);
      modal({
        title: `Restablecer contraseña · ${u.nombre}`,
        fields: [{ name: 'password', label: 'Nueva contraseña', type: 'password', required: true, autocomplete: 'new-password', hint: 'Mínimo 10 caracteres, letras y números. Se cerrarán sus sesiones abiertas.', full: true }],
        onSubmit: async (data) => {
          await api(`/usuarios/${u.id}/reset-password`, { method: 'POST', body: data });
          toast('Contraseña actualizada');
        },
      });
    })
  );
}

// ---------- auditoría ----------
const ACCIONES = {
  login: 'Inicio de sesión',
  login_fallido: 'Intento fallido de acceso',
  logout: 'Cierre de sesión',
  crear: 'Creó',
  editar: 'Editó',
  eliminar: 'Eliminó',
  registrar_asistencia: 'Registró asistencia',
  registrar_notas: 'Registró notas',
  eliminar_sesion: 'Eliminó clase',
  ver_credenciales: 'Consultó credenciales',
  cerrar_nivel: 'Cerró nivel',
  generar_reporte: 'Generó reporte',
  emitir_certificado: 'Emitió certificado',
  importar: 'Importó estudiantes',
  asignar_estudiantes: 'Asignó estudiantes',
  reset_password: 'Restableció contraseña',
  cambiar_password: 'Cambió su contraseña',
  seed: 'Sistema',
};
export async function viewAuditoria(view) {
  setTitle('Auditoría');
  const log = await api('/auditoria');
  setHTML(
    view,
    html`<div class="page-head"><div><h1>Auditoría</h1><p class="muted">Registro de quién hizo qué y cuándo (últimos 500 eventos).</p></div></div>
    <div class="card"><div class="toolbar"><input type="search" id="q" class="grow" placeholder="Filtrar por usuario, acción o detalle…"></div>
    <div class="table-wrap"><table class="table small"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
    <tbody id="rows"></tbody></table></div></div>`
  );
  const paint = () => {
    const q = $('#q', view).value.toLowerCase();
    setHTML(
      $('#rows', view),
      log
        .filter((l) => !q || `${l.usuario_nombre} ${l.accion} ${ACCIONES[l.accion]} ${l.entidad} ${l.detalle}`.toLowerCase().includes(q))
        .map(
          (l) => html`<tr class="${l.accion === 'login_fallido' ? 'row-risk' : ''}"><td class="nowrap">${l.fecha}</td><td>${l.usuario_nombre || '—'}</td>
          <td>${ACCIONES[l.accion] || l.accion}</td><td>${l.entidad}${l.entidad_id ? ` #${l.entidad_id}` : ''}</td><td>${l.detalle || ''}</td><td class="muted">${l.ip || ''}</td></tr>`
        )
    );
  };
  $('#q', view).addEventListener('input', paint);
  paint();
}

// ---------- configuración ----------
export async function viewConfig(view) {
  setTitle('Configuración');
  const cfg = state.config;
  setHTML(
    view,
    html`<div class="page-head"><div><h1>Configuración</h1></div></div>
    <div class="two-col">
      <form class="card" id="f-pass">
        <h2>Cambiar mi contraseña</h2>
        <div class="field"><label>Contraseña actual</label><input type="password" name="actual" required autocomplete="current-password"></div>
        <div class="field"><label>Nueva contraseña</label><input type="password" name="nueva" required autocomplete="new-password" minlength="10"><small class="hint">Mínimo 10 caracteres, letras y números.</small></div>
        <div class="field"><label>Repetir nueva contraseña</label><input type="password" name="repetir" required autocomplete="new-password"></div>
        <div class="form-foot"><span></span><button class="btn btn-primary">Actualizar</button></div>
      </form>
      ${isStaff()
        ? html`<form class="card" id="f-cfg">
          <h2>Reglas académicas</h2>
          ${isCoord() ? '' : html`<p class="muted small">Solo coordinación puede modificar estos valores.</p>`}
          <div class="field"><label>Nota mínima de aprobación (sobre 100)</label><input type="number" name="nota_aprobacion" min="1" max="100" value="${cfg.nota_aprobacion}"></div>
          <div class="field"><label>Asistencia mínima (%)</label><input type="number" name="asistencia_minima" min="1" max="100" value="${cfg.asistencia_minima}"></div>
          <div class="field"><label>Alertar después de N faltas seguidas</label><input type="number" name="faltas_consecutivas_alerta" min="1" max="20" value="${cfg.faltas_consecutivas_alerta}"></div>
          <h2>Firma de reportes y certificados</h2>
          <div class="field"><label>Nombre</label><input name="firma_nombre" value="${cfg.firma_nombre}"></div>
          <div class="field"><label>Cargo</label><input name="firma_cargo" value="${cfg.firma_cargo}"></div>
          <div class="field"><label>Ciudad</label><input name="ciudad" value="${cfg.ciudad}"></div>
          <div class="field"><label>Curso que aparece en el certificado</label><input name="curso_certificado" value="${cfg.curso_certificado || ''}"></div>
          <div class="field"><label>Horas por nivel (certificado)</label><input name="horas_por_nivel" type="number" min="1" value="${cfg.horas_por_nivel || 180}"></div>
          ${isCoord() ? html`<div class="form-foot"><span></span><button class="btn btn-primary">Guardar configuración</button></div>` : ''}
        </form>`
        : ''}
    </div>`
  );
  $('#f-pass', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.nueva !== d.repetir) return toast('Las contraseñas no coinciden.', 'bad');
    try {
      await api('/me/password', { method: 'POST', body: d });
      e.target.reset();
      toast('Contraseña actualizada');
    } catch (ex) {
      toast(ex.message, 'bad');
    }
  });
  const fc = $('#f-cfg', view);
  if (fc && !isCoord()) $$('input', fc).forEach((i) => (i.disabled = true));
  fc?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      state.config = await api('/config', { method: 'PUT', body: Object.fromEntries(new FormData(fc)) });
      toast('Configuración guardada');
    } catch (ex) {
      toast(ex.message, 'bad');
    }
  });
}
