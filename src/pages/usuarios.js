import { obtenerTodosUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } from '../services/usuarios.service.js';
import { auth } from '../firebase.js';
import { showToast } from '../main.js';

let loadedUsers = [];
let editingUid = null;
let saveBtnElement = null;

/**
 * Render the Usuarios page layout
 */
export function renderUsuarios() {
  loadedUsers = [];
  editingUid = null;

  return `
    <style>
      .usuarios-card {
        margin-top: 10px;
        overflow-x: auto;
      }
      .usuarios-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        text-align: left;
      }
      .usuarios-table th {
        background: #fafafa;
        color: var(--text-secondary);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        padding: 14px 18px;
        border-bottom: 1.5px solid var(--border);
      }
      .usuarios-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .usuarios-table tr:hover td {
        background: var(--bg-card-hover);
      }
      .permisos-container {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .permiso-tag {
        font-size: 0.65rem;
        background: #e8e8e8;
        color: #555;
        padding: 2px 6px;
        border-radius: var(--radius-xs);
        font-weight: 600;
      }
      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
      }
      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        cursor: pointer;
        user-select: none;
      }
      .checkbox-item input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
    </style>

    <!-- Sidebar overlay -->
    <div class="sidebar-overlay" id="usuario-sidebar-overlay"></div>

    <!-- Sidebar: Crear/Editar Usuario -->
    <aside class="sidebar" id="usuario-sidebar" role="dialog" aria-label="Gestionar Usuario">
      <div class="sidebar-header">
        <span class="sidebar-title" id="usuario-sidebar-title">Nuevo Usuario</span>
        <button class="sidebar-close" id="usuario-sidebar-close-btn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="sidebar-body">
        <form id="usuario-form" novalidate>
          <div class="form-group">
            <label class="form-label form-required">Nombre completo</label>
            <input type="text" class="form-input" id="user-nombre" placeholder="Juan Pérez" required />
          </div>

          <div class="form-group">
            <label class="form-label form-required">Correo electrónico</label>
            <input type="email" class="form-input" id="user-email" placeholder="usuario@casagrafica.com" required />
          </div>

          <div class="form-group" id="password-field-group">
            <label class="form-label form-required">Contraseña</label>
            <input type="password" class="form-input" id="user-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
          </div>

          <div class="form-group">
            <label class="form-label form-required">Rol del sistema</label>
            <select class="form-select" id="user-rol">
              <option value="admin">Administrador</option>
              <option value="diseño" selected>Diseño</option>
              <option value="taller">Taller / Producción</option>
            </select>
          </div>

          <div style="height: 1px; background: var(--border); margin: 20px 0 16px;"></div>

          <div class="form-group">
            <label class="form-label">Permisos específicos</label>
            <div class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" id="perm-crear-pedidos" checked />
                <span>Crear Pedidos</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" id="perm-editar-pedidos" checked />
                <span>Editar Pedidos</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" id="perm-gestionar-taller" />
                <span>Taller & Entrega</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" id="perm-gestionar-usuarios" />
                <span>Gestionar Usuarios & Permisos</span>
              </label>
            </div>
          </div>
        </form>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button type="button" class="btn btn-secondary" id="usuario-sidebar-cancel-btn" style="flex: 1;">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" id="usuario-sidebar-save-btn" style="flex: 2;">
          Guardar Usuario
        </button>
      </div>
    </aside>

    <!-- Page Content -->
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Usuarios</h1>
          <p class="page-subtitle">Gestión de cuentas de acceso y permisos del sistema</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-usuario">
          Crear Usuario
        </button>
      </div>

      <!-- List of Users -->
      <div class="card usuarios-card">
        <table class="usuarios-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo electrónico</th>
              <th>Rol</th>
              <th>Permisos Asignados</th>
              <th>Creado en</th>
              <th style="width:100px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="usuarios-table-body">
            <tr>
              <td colspan="6" style="text-align:center; padding: 40px 0;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                <span style="color:var(--text-secondary);">Cargando usuarios...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Bind DOM events for the Usuarios page
 */
export function bindUsuariosEvents() {
  saveBtnElement = document.getElementById('usuario-sidebar-save-btn');

  // Sidebar visibility toggles
  document.getElementById('btn-nuevo-usuario')?.addEventListener('click', openNewUser);
  document.getElementById('usuario-sidebar-close-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('usuario-sidebar-cancel-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('usuario-sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Auto-fill default permissions on role select change
  document.getElementById('user-rol')?.addEventListener('change', (e) => {
    applyDefaultPermissions(e.target.value);
  });

  // Save button
  saveBtnElement?.addEventListener('click', handleSaveUser);

  // Load all users initially
  loadUsers();
}

/**
 * Cleanup page resources
 */
export function cleanupUsuarios() {
  loadedUsers = [];
  editingUid = null;
  saveBtnElement = null;
}

// ════════════════════════════════
// SIDEBAR CONTROL
// ════════════════════════════════

function openSidebar() {
  document.getElementById('usuario-sidebar')?.classList.add('active');
  document.getElementById('usuario-sidebar-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('usuario-sidebar')?.classList.remove('active');
  document.getElementById('usuario-sidebar-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

function openNewUser() {
  editingUid = null;
  document.getElementById('usuario-sidebar-title').textContent = 'Nuevo Usuario';
  document.getElementById('user-email').disabled = false;
  document.getElementById('password-field-group').style.display = 'block';

  // Clear inputs
  document.getElementById('user-nombre').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-rol').value = 'diseño';

  // Apply defaults
  applyDefaultPermissions('diseño');
  openSidebar();
}

function openEditUser(uid) {
  const user = loadedUsers.find(u => u.uid === uid);
  if (!user) return;

  editingUid = uid;
  document.getElementById('usuario-sidebar-title').textContent = 'Editar Usuario';
  
  // Disable email modification (standard practice for simplicity)
  const emailInput = document.getElementById('user-email');
  emailInput.value = user.email || '';
  emailInput.disabled = true;

  document.getElementById('user-nombre').value = user.nombre || '';
  document.getElementById('password-field-group').style.display = 'none'; // No password edit in this view
  document.getElementById('user-rol').value = user.rol || 'diseño';

  const permisos = user.permisos || [];
  document.getElementById('perm-crear-pedidos').checked = permisos.includes('crear_pedidos');
  document.getElementById('perm-editar-pedidos').checked = permisos.includes('editar_pedidos');
  document.getElementById('perm-gestionar-taller').checked = permisos.includes('gestionar_taller');
  document.getElementById('perm-gestionar-usuarios').checked = permisos.includes('gestionar_usuarios');

  openSidebar();
}

function applyDefaultPermissions(rol) {
  const pCrear = document.getElementById('perm-crear-pedidos');
  const pEditar = document.getElementById('perm-editar-pedidos');
  const pTaller = document.getElementById('perm-gestionar-taller');
  const pUsuarios = document.getElementById('perm-gestionar-usuarios');

  if (!pCrear || !pEditar || !pTaller || !pUsuarios) return;

  if (rol === 'admin') {
    pCrear.checked = true;
    pEditar.checked = true;
    pTaller.checked = true;
    pUsuarios.checked = true;
  } else if (rol === 'diseño') {
    pCrear.checked = true;
    pEditar.checked = true;
    pTaller.checked = false;
    pUsuarios.checked = false;
  } else if (rol === 'taller') {
    pCrear.checked = false;
    pEditar.checked = false;
    pTaller.checked = true;
    pUsuarios.checked = false;
  }
}

// ════════════════════════════════
// DATA OPERATIONS
// ════════════════════════════════

async function loadUsers() {
  const tbody = document.getElementById('usuarios-table-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding: 40px 0;">
        <div class="spinner" style="margin: 0 auto 10px;"></div>
        <span style="color:var(--text-secondary); font-size:0.9rem;">Cargando usuarios...</span>
      </td>
    </tr>
  `;

  try {
    loadedUsers = await obtenerTodosUsuarios();
    if (loadedUsers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 40px 0; color:var(--text-tertiary);">
            No hay usuarios registrados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = loadedUsers.map(user => {
      const dateVal = user.creado_en ? new Date(user.creado_en.seconds * 1000).toLocaleDateString() : 'N/A';
      
      let rolBadge = '';
      if (user.rol === 'admin') {
        rolBadge = `<span class="badge" style="background:var(--accent-subtle); color:var(--accent); font-weight:700;">Admin</span>`;
      } else if (user.rol === 'diseño') {
        rolBadge = `<span class="badge" style="background:var(--info-subtle); color:var(--info); font-weight:700;">Diseño</span>`;
      } else {
        rolBadge = `<span class="badge" style="background:#e8e8e8; color:#555; font-weight:700;">Taller</span>`;
      }

      const permisosTags = (user.permisos || []).map(p => {
        let label = p;
        if (p === 'crear_pedidos') label = 'Crear Pedidos';
        else if (p === 'editar_pedidos') label = 'Editar Pedidos';
        else if (p === 'gestionar_taller') label = 'Taller';
        else if (p === 'gestionar_usuarios') label = 'Usuarios';
        return `<span class="permiso-tag">${label}</span>`;
      }).join('');

      return `
        <tr>
          <td style="font-weight:700;">${user.nombre}</td>
          <td style="color:var(--text-secondary);">${user.email}</td>
          <td>${rolBadge}</td>
          <td><div class="permisos-container">${permisosTags}</div></td>
          <td style="color:var(--text-tertiary);">${dateVal}</td>
          <td>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-xs btn-edit-user" data-uid="${user.uid}" title="Editar" style="padding: 5px 8px; display:inline-flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn btn-secondary btn-xs btn-delete-user" data-uid="${user.uid}" title="Eliminar" style="padding: 5px 8px; display:inline-flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; stroke:var(--danger-text);"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => openEditUser(btn.dataset.uid));
    });
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteUser(btn.dataset.uid));
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px 0; color:var(--danger-text);">
          Error al cargar los usuarios del sistema.
        </td>
      </tr>
    `;
  }
}

async function handleSaveUser() {
  const nombre = document.getElementById('user-nombre')?.value.trim();
  const email = document.getElementById('user-email')?.value.trim();
  const password = document.getElementById('user-password')?.value;
  const rol = document.getElementById('user-rol')?.value;

  if (!nombre || !email) {
    showToast('El nombre y el correo electrónico son obligatorios.', 'error');
    return;
  }

  // Validate permissions
  const permisos = [];
  if (document.getElementById('perm-crear-pedidos').checked) permisos.push('crear_pedidos');
  if (document.getElementById('perm-editar-pedidos').checked) permisos.push('editar_pedidos');
  if (document.getElementById('perm-gestionar-taller').checked) permisos.push('gestionar_taller');
  if (document.getElementById('perm-gestionar-usuarios').checked) permisos.push('gestionar_usuarios');

  if (editingUid === null) {
    // Creating user: require password
    if (!password || password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    try {
      setSaving(true);
      await crearUsuario({ email, password, nombre, rol, permisos });
      showToast('Usuario creado con éxito.', 'success');
      closeSidebar();
      loadUsers();
    } catch (err) {
      console.error(err);
      let msg = 'Error al crear el usuario.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'El correo electrónico ya está en uso.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Formato de correo electrónico inválido.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Contraseña demasiado débil.';
      }
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  } else {
    // Editing user
    try {
      setSaving(true);
      await actualizarUsuario(editingUid, { nombre, rol, permisos });
      showToast('Usuario actualizado con éxito.', 'success');
      closeSidebar();
      loadUsers();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar el usuario: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }
}

async function handleDeleteUser(uid) {
  // Prevent admin from deleting their own user account
  const selfUser = auth.currentUser;
  if (selfUser && selfUser.uid === uid) {
    showToast('No puedes eliminar tu propio usuario de sesión.', 'error');
    return;
  }

  if (!confirm('¿Estás seguro de que deseas eliminar este usuario? Su perfil será revocado del sistema.')) {
    return;
  }

  try {
    await eliminarUsuario(uid);
    showToast('Usuario eliminado con éxito.', 'success');
    loadUsers();
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar el usuario.', 'error');
  }
}

function setSaving(isSaving) {
  if (!saveBtnElement) return;
  if (isSaving) {
    saveBtnElement.disabled = true;
    saveBtnElement.innerHTML = '<div class="spinner"></div> Guardando...';
  } else {
    saveBtnElement.disabled = false;
    saveBtnElement.innerHTML = 'Guardar Usuario';
  }
}
