import { crearAnticipo, anularAnticipo, escucharAnticipos } from '../services/anticipos.service.js';
import { renderClienteSearch, bindClienteSearch, clienteState, resetClienteState } from '../components/clienteSearch.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { showToast, getCurrentUserProfile } from '../main.js';

let allAnticipos = [];
let sidebarOpen = false;
let saving = false;
let unsubscribeAnticipos = null;
let documentClickHandler = null;

export function renderAnticipos() {
  sidebarOpen = false;
  saving = false;

  return `
    <style>
      .anticipos-layout {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .anticipos-table-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        overflow-x: auto;
      }
      .anticipos-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        text-align: left;
      }
      .anticipos-table th {
        background: #fafafa;
        color: var(--text-secondary);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        padding: 14px 18px;
        border-bottom: 1.5px solid var(--border);
      }
      .anticipos-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .anticipos-table tr:hover td {
        background: var(--bg-card-hover);
      }
      
      .badge-saldo {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: var(--radius-sm);
      }
      .badge-saldo.activo {
        background: rgba(76, 175, 80, 0.1);
        color: var(--success-text);
      }
      .badge-saldo.usado {
        background: rgba(158, 158, 158, 0.1);
        color: var(--text-secondary);
      }
      .badge-saldo.anulado {
        background: rgba(244, 67, 54, 0.1);
        color: var(--danger-text);
        text-decoration: line-through;
      }

      .btn-anular-anticipo {
        color: var(--danger-text);
        background: transparent;
        border: 1px solid var(--danger-text);
        border-radius: var(--radius-xs);
        padding: 4px 8px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--t-fast);
      }
      .btn-anular-anticipo:hover {
        background: var(--danger-text);
        color: #fff;
      }
    </style>

    <!-- Sidebar overlay -->
    <div class="sidebar-overlay" id="anticipos-sidebar-overlay"></div>

    <!-- Sidebar: Registrar Anticipo -->
    <aside class="sidebar" id="anticipos-sidebar" role="dialog" aria-label="Registrar Anticipo">
      <div class="sidebar-header">
        <span class="sidebar-title">Registrar Anticipo</span>
        <button class="sidebar-close" id="anticipos-sidebar-close-btn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="sidebar-body">
        <form id="anticipo-form" novalidate style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Selector de cliente -->
          <div class="form-group">
            <label class="form-label form-required">Cliente</label>
            ${renderClienteSearch()}
          </div>

          <div style="height: 1px; background: var(--border); margin: 8px 0;"></div>

          <!-- Monto -->
          <div class="form-group">
            <label class="form-label form-required">Monto del Anticipo</label>
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 12px; font-family: var(--font-mono); font-weight: 700; color: var(--text-secondary);">$</span>
              <input type="number" id="anticipo-monto" class="form-input form-mono" style="padding-left: 28px;" step="0.01" min="0.01" placeholder="0.00" required />
            </div>
          </div>

          <!-- Método de pago -->
          <div class="form-group">
            <label class="form-label form-required">Método de Pago</label>
            <select class="form-select" id="anticipo-metodo">
              <option value="Efectivo" selected>Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
            </select>
          </div>
        </form>
      </div>

      <div class="sidebar-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancelar-anticipo" style="flex: 1;">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" id="btn-guardar-anticipo" style="flex: 2;">
          Registrar Anticipo
        </button>
      </div>
    </aside>

    <!-- Page Content -->
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Anticipos</h1>
          <p class="page-subtitle">Saldos preventivos registrados a favor de clientes</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="search-wrap">
            <span class="search-icon">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input type="text" class="search-input" id="search-anticipos" placeholder="Buscar por cliente..." autocomplete="off" />
          </div>
        </div>
      </div>

      <div class="anticipos-layout">
        <div class="anticipos-table-card">
          <table class="anticipos-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Monto Original</th>
                <th>Saldo Disponible</th>
                <th>Método Pago</th>
                <th>Registrado Por</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="anticipos-table-body">
              <tr>
                <td colspan="8">
                  <div class="loading-center" style="padding: 40px 0;">
                    <div class="spinner"></div>
                    <span>Cargando anticipos...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" id="fab-nuevo-anticipo" aria-label="Nuevo Anticipo" title="Registrar Anticipo">+</button>
  `;
}

function openSidebar() {
  sidebarOpen = true;
  document.getElementById('anticipos-sidebar')?.classList.add('active');
  document.getElementById('anticipos-sidebar-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    document.getElementById('cs-input')?.focus();
  }, 150);
}

function closeSidebar() {
  sidebarOpen = false;
  document.getElementById('anticipos-sidebar')?.classList.remove('active');
  document.getElementById('anticipos-sidebar-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
  resetForm();
}

function resetForm() {
  resetClienteState();
  const csInput = document.getElementById('cs-input');
  if (csInput) csInput.value = '';
  const clearBtn = document.getElementById('cs-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  const dropdown = document.getElementById('cs-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const selected = document.getElementById('cs-selected');
  if (selected) selected.style.display = 'none';
  const searchContainer = document.getElementById('cs-search-mode-container');
  if (searchContainer) searchContainer.style.display = 'block';
  
  const montoInput = document.getElementById('anticipo-monto');
  if (montoInput) montoInput.value = '';

  const metodoSelect = document.getElementById('anticipo-metodo');
  if (metodoSelect) metodoSelect.value = 'Efectivo';
}

function loadAnticipos() {
  if (unsubscribeAnticipos) {
    unsubscribeAnticipos();
    unsubscribeAnticipos = null;
  }

  unsubscribeAnticipos = escucharAnticipos((anticipos) => {
    allAnticipos = anticipos;
    renderTable();
  });
}

function renderTable() {
  const tbody = document.getElementById('anticipos-table-body');
  if (!tbody) return;

  const searchTerm = document.getElementById('search-anticipos')?.value.trim().toLowerCase() || '';

  const filtered = allAnticipos.filter(a => {
    return !searchTerm || a.cliente_nombre.toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 40px 0;">
          No se encontraron anticipos.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const dateObj = a.fecha_creacion?.toDate ? a.fecha_creacion.toDate() : new Date(a.fecha_creacion?.seconds * 1000 || 0);
    const fechaStr = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                     dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    let registradoPor = a.usuario?.nombre || 'Sistema';

    let badgeClass = 'activo';
    let labelEstado = 'Activo';
    if (a.estado === 'usado') {
      badgeClass = 'usado';
      labelEstado = 'Usado';
    } else if (a.estado === 'anulado') {
      badgeClass = 'anulado';
      labelEstado = 'Anulado';
    }

    const canAnular = a.estado === 'activo' && Math.abs(a.saldo - a.monto) < 0.001;
    const actionCol = canAnular
      ? `<button type="button" class="btn-anular-anticipo" data-doc-id="${a._docId}">Anular</button>`
      : `<span style="color:var(--text-tertiary); font-size:0.8rem;">-</span>`;

    return `
      <tr style="${a.estado === 'anulado' ? 'opacity:0.65;' : ''}">
        <td style="color: var(--text-secondary); font-size:0.85rem;">${fechaStr}</td>
        <td class="cliente-nombre-uppercase" style="font-weight: 700; color: var(--text-primary);">${a.cliente_nombre}</td>
        <td style="font-family: var(--font-mono);">${formatCurrency(a.monto)}</td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${formatCurrency(a.saldo)}</td>
        <td><span class="badge-metodo badge-otro" style="font-size:0.68rem;">${a.metodo_pago}</span></td>
        <td style="color: var(--text-secondary); font-size:0.85rem;">${registradoPor}</td>
        <td><span class="badge-saldo ${badgeClass}">${labelEstado}</span></td>
        <td style="text-align: right; white-space: nowrap;">${actionCol}</td>
      </tr>
    `;
  }).join('');
}

export function bindAnticiposEvents() {
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }

  // Inicializar buscador de clientes para el sidebar
  bindClienteSearch({
    onNewClient: (typedValue) => {
      // Por simplicidad, en anticipos requerimos que el cliente ya exista
      // pero si el usuario presiona "crear", le informamos que debe seleccionarlo desde la lista
      showToast('Selecciona un cliente de la lista. Si es nuevo, regístralo primero desde Pedidos.', 'info');
    },
    onEditClient: () => {},
    onSelectClient: () => {}
  });

  // FAB
  document.getElementById('fab-nuevo-anticipo')?.addEventListener('click', openSidebar);

  // Botones de cierre
  document.getElementById('anticipos-sidebar-close-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('btn-cancelar-anticipo')?.addEventListener('click', closeSidebar);
  document.getElementById('anticipos-sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Registrar anticipo
  document.getElementById('btn-guardar-anticipo')?.addEventListener('click', handleSave);

  // Escuchar ESC para cerrar sidebar
  document.addEventListener('keydown', handleEsc);

  // Buscador de anticipos
  let debounce;
  document.getElementById('search-anticipos')?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderTable, 280);
  });

  // Manejo de acciones en la tabla
  documentClickHandler = async (e) => {
    const btnAnular = e.target.closest('.btn-anular-anticipo');
    if (btnAnular) {
      const docId = btnAnular.dataset.docId;
      if (!docId) return;

      if (!confirm('¿Estás seguro de que deseas ANULAR este anticipo? Se establecerá el saldo a 0 y no podrá aplicarse a futuros pedidos.')) {
        return;
      }

      try {
        await anularAnticipo(docId, getCurrentUserProfile());
        showToast('Anticipo anulado exitosamente.', 'success');
      } catch (err) {
        showToast('Error al anular: ' + err.message, 'error');
      }
    }
  };
  document.addEventListener('click', documentClickHandler);

  // Cargar datos
  loadAnticipos();
}

async function handleSave() {
  if (saving) return;

  if (!clienteState.nombre || !clienteState.docId) {
    showToast('Selecciona un cliente válido de la lista.', 'error');
    document.getElementById('cs-input')?.focus();
    return;
  }

  const montoInput = document.getElementById('anticipo-monto');
  const monto = parseFloat(montoInput?.value || '0');
  if (isNaN(monto) || monto <= 0) {
    showToast('Ingresa un monto de anticipo válido mayor a 0.', 'error');
    montoInput?.focus();
    return;
  }

  const metodoSelect = document.getElementById('anticipo-metodo');
  const metodo_pago = metodoSelect?.value || 'Efectivo';

  saving = true;
  const btn = document.getElementById('btn-guardar-anticipo');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Registrando...';
  }

  try {
    await crearAnticipo({
      cliente: {
        docId: clienteState.docId,
        nombre: clienteState.nombre,
        telefono: clienteState.telefono
      },
      monto,
      metodo_pago,
      usuario: getCurrentUserProfile()
    });

    showToast('Anticipo registrado exitosamente.', 'success');
    closeSidebar();
  } catch (err) {
    showToast('Error al registrar anticipo: ' + err.message, 'error');
  } finally {
    saving = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Registrar Anticipo';
    }
  }
}

function handleEsc(e) {
  if (e.key === 'Escape' && sidebarOpen) {
    closeSidebar();
  }
}

export function cleanupAnticipos() {
  document.removeEventListener('keydown', handleEsc);
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }
  if (unsubscribeAnticipos) {
    unsubscribeAnticipos();
    unsubscribeAnticipos = null;
  }
  document.body.style.overflow = '';
}
