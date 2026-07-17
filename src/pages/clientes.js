import { obtenerTodosClientes, guardarCliente, eliminarCliente } from '../services/clientes.service.js';
import { getCurrentUserProfile, showToast } from '../main.js';

let loadedClients = [];
let editingClientId = null;
let saveBtnElement = null;

/**
 * Render the Clientes page layout
 */
export function renderClientes() {
  loadedClients = [];
  editingClientId = null;

  return `
    <style>
      .clientes-card {
        margin-top: 10px;
        overflow-x: auto;
      }
      .clientes-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        text-align: left;
      }
      .clientes-table th {
        background: #fafafa;
        color: var(--text-secondary);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        padding: 14px 18px;
        border-bottom: 1.5px solid var(--border);
      }
      .clientes-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .clientes-table tr:hover td {
        background: var(--bg-card-hover);
      }
      .action-buttons {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .action-icon-btn {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        border-radius: var(--radius-xs);
        transition: background var(--t-fast), color var(--t-fast);
      }
      .action-icon-btn:hover {
        background: var(--bg-body);
        color: var(--text-primary);
      }
      .action-icon-btn.btn-delete:hover {
        background: rgba(229, 57, 53, 0.08);
        color: var(--danger-text);
      }
    </style>

    <!-- Sidebar overlay -->
    <div class="sidebar-overlay" id="cliente-sidebar-overlay"></div>

    <!-- Sidebar: Crear/Editar Cliente -->
    <aside class="sidebar" id="cliente-sidebar" role="dialog" aria-label="Gestionar Cliente">
      <div class="sidebar-header">
        <span class="sidebar-title" id="cliente-sidebar-title">Nuevo Cliente</span>
        <button class="sidebar-close" id="cliente-sidebar-close-btn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="sidebar-body">
        <form id="cliente-form" novalidate>
          <div class="form-group">
            <label class="form-label form-required">Nombre completo</label>
            <input type="text" class="form-input" id="client-nombre" placeholder="Ej. Juan Pérez" required autocomplete="off" />
          </div>

          <div class="form-group">
            <label class="form-label form-required">Teléfono / Celular</label>
            <input type="tel" class="form-input" id="client-telefono" placeholder="Ej. 0985985684" required autocomplete="off" />
          </div>

          <div class="form-group">
            <label class="form-label">RUC</label>
            <input type="text" class="form-input" id="client-ruc" placeholder="Ej. 1712345678001" autocomplete="off" />
          </div>

          <div class="form-group">
            <label class="form-label">Correo electrónico</label>
            <input type="email" class="form-input" id="client-email" placeholder="Ej. cliente@correo.com" autocomplete="off" />
          </div>

          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-input" id="client-direccion" placeholder="Ej. Av. De los Shyris N34" autocomplete="off" />
          </div>
        </form>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button type="button" class="btn btn-secondary" id="cliente-sidebar-cancel-btn" style="flex: 1;">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" id="cliente-sidebar-save-btn" style="flex: 2;">
          Guardar Cliente
        </button>
      </div>
    </aside>

    <!-- Page Content -->
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Clientes</h1>
          <p class="page-subtitle">Listado y administración de clientes</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="search-wrap">
            <span class="search-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
            <input type="text" class="search-input" id="search-clientes" placeholder="Buscar por nombre o teléfono..." autocomplete="off" />
          </div>
          <button class="btn btn-primary" id="btn-nuevo-cliente" style="height:42px;">
            Crear Cliente
          </button>
        </div>
      </div>

      <!-- List of Clients -->
      <div class="card clientes-card">
        <table class="clientes-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>RUC</th>
              <th>Correo electrónico</th>
              <th>Dirección</th>
              <th style="width:100px; text-align:center;">Acciones</th>
            </tr>
          </thead>
          <tbody id="clientes-table-body">
            <tr>
              <td colspan="6" style="text-align:center; padding: 40px 0;">
                <div class="spinner" style="margin: 0 auto 10px;"></div>
                <span style="color:var(--text-secondary);">Cargando clientes...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Bind DOM events for the Clientes page
 */
export function bindClientesEvents() {
  saveBtnElement = document.getElementById('cliente-sidebar-save-btn');

  // Sidebar visibility toggles
  document.getElementById('btn-nuevo-cliente')?.addEventListener('click', openNewClient);
  document.getElementById('cliente-sidebar-close-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('cliente-sidebar-cancel-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('cliente-sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Search input events (instant filtering on local/cached data)
  document.getElementById('search-clientes')?.addEventListener('input', (e) => {
    filterAndRenderTable(e.target.value.trim());
  });

  // Save button
  saveBtnElement?.addEventListener('click', handleSaveClient);

  // Load all clients initially
  loadClients();
}

/**
 * Cleanup page resources
 */
export function cleanupClientes() {
  loadedClients = [];
  editingClientId = null;
  saveBtnElement = null;
}

// ════════════════════════════════
// SIDEBAR CONTROL
// ════════════════════════════════

function openSidebar() {
  document.getElementById('cliente-sidebar')?.classList.add('active');
  document.getElementById('cliente-sidebar-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('cliente-sidebar')?.classList.remove('active');
  document.getElementById('cliente-sidebar-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

function openNewClient() {
  editingClientId = null;
  document.getElementById('cliente-sidebar-title').textContent = 'Nuevo Cliente';

  // Clear inputs
  document.getElementById('client-nombre').value = '';
  document.getElementById('client-telefono').value = '';
  document.getElementById('client-ruc').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('client-direccion').value = '';

  openSidebar();
}

function openEditClient(clientId) {
  const client = loadedClients.find(c => c._docId === clientId);
  if (!client) return;

  editingClientId = clientId;
  document.getElementById('cliente-sidebar-title').textContent = 'Editar Cliente';

  document.getElementById('client-nombre').value = client.nombre || '';
  document.getElementById('client-telefono').value = client.telefono || '';
  document.getElementById('client-ruc').value = client.ruc || '';
  document.getElementById('client-email').value = client.email || '';
  document.getElementById('client-direccion').value = client.direccion || '';

  openSidebar();
}

// ════════════════════════════════
// DATA LOADING & RENDERING
// ════════════════════════════════

async function loadClients() {
  const tbody = document.getElementById('clientes-table-body');
  if (!tbody) return;

  try {
    loadedClients = await obtenerTodosClientes();
    renderClientsTable(loadedClients);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px 0; color: var(--danger-text);">
          Error al cargar clientes: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientes-table-body');
  if (!tbody) return;

  if (!clients || clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px 0; color: var(--text-secondary);">
          No se encontraron clientes.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clients.map(client => {
    const ruc = client.ruc || '-';
    const email = client.email || '-';
    const direccion = client.direccion || '-';
    const telefono = client.telefono || '-';

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary); text-transform: uppercase;">${client.nombre}</td>
        <td style="font-family: var(--font-mono); font-size: 0.85rem;">${telefono}</td>
        <td>${ruc}</td>
        <td style="font-size: 0.85rem; color: var(--text-secondary);">${email}</td>
        <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${direccion}">${direccion}</td>
        <td style="text-align: center;">
          <div class="action-buttons" style="justify-content: center;">
            <button type="button" class="action-icon-btn btn-edit" data-edit-id="${client._docId}" title="Editar cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button type="button" class="action-icon-btn btn-delete" data-delete-id="${client._docId}" title="Eliminar cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; color:var(--danger-text);"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind edit buttons
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditClient(btn.dataset.editId);
    });
  });

  // Bind delete buttons
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      handleDeleteClient(btn.dataset.deleteId);
    });
  });
}

function filterAndRenderTable(searchTerm) {
  if (!searchTerm) {
    renderClientsTable(loadedClients);
    return;
  }

  const queryLower = searchTerm.toLowerCase();
  const filtered = loadedClients.filter(c => {
    const nameMatch = (c.nombre || '').toLowerCase().includes(queryLower);
    const phoneMatch = (c.telefono || '').toLowerCase().includes(queryLower);
    return nameMatch || phoneMatch;
  });

  renderClientsTable(filtered);
}

// ════════════════════════════════
// ACTIONS HANDLERS
// ════════════════════════════════

async function handleSaveClient() {
  const nombre = document.getElementById('client-nombre')?.value.trim();
  const telefono = document.getElementById('client-telefono')?.value.trim();
  const ruc = document.getElementById('client-ruc')?.value.trim();
  const email = document.getElementById('client-email')?.value.trim();
  const direccion = document.getElementById('client-direccion')?.value.trim();

  if (!nombre) {
    showToast('El nombre completo es obligatorio', 'error');
    return;
  }
  if (!telefono) {
    showToast('El teléfono es obligatorio', 'error');
    return;
  }

  if (saveBtnElement) {
    saveBtnElement.disabled = true;
    saveBtnElement.textContent = 'Guardando...';
  }

  try {
    await guardarCliente({
      _docId: editingClientId || undefined,
      nombre,
      telefono,
      ruc,
      email,
      direccion
    });

    showToast(editingClientId ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente', 'success');
    closeSidebar();
    
    // Recargar tabla de clientes
    await loadClients();
  } catch (err) {
    showToast('Error al guardar cliente: ' + err.message, 'error');
  } finally {
    if (saveBtnElement) {
      saveBtnElement.disabled = false;
      saveBtnElement.textContent = editingClientId ? 'Guardar Cambios' : 'Guardar Cliente';
    }
  }
}

async function handleDeleteClient(clientId) {
  const client = loadedClients.find(c => c._docId === clientId);
  if (!client) return;

  const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar al cliente "${client.nombre.toUpperCase()}"? Esta acción no se puede deshacer.`);
  if (!confirmDelete) return;

  try {
    await eliminarCliente(clientId);
    showToast('Cliente eliminado correctamente', 'success');
    await loadClients();
  } catch (err) {
    showToast('Error al eliminar cliente: ' + err.message, 'error');
  }
}
