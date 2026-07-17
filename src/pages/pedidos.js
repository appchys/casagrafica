import { renderProductForm, renderProductListRow, createEmptyProduct } from '../components/productForm.js';
import { renderAbonoFormModal, showAbonoModal } from '../components/abonoForm.js';
import { calcularSubtotal, calcularTotalPagar } from '../utils/calculations.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { crearPedido, actualizarPedido, obtenerPedido, obtenerPedidosRecientes, obtenerTiposProducto, eliminarPedido, escucharPedidosRecientes, agruparPedidos, obtenerPedidosActivosCliente, actualizarGrupoPedido, obtenerPedidosPendientesCobroCliente } from '../services/pedidos.service.js';
import { guardarProducto, obtenerProductosGuardados, eliminarProductoGuardado } from '../services/productosGuardados.service.js';
import { guardarCliente, obtenerCliente } from '../services/clientes.service.js';
import { obtenerAnticiposActivosCliente } from '../services/anticipos.service.js';
import { imprimirRecibo, imprimirReciboDirecto } from '../services/print.service.js';
import { showToast, getCurrentUserProfile } from '../main.js';
import { renderPedidoCard } from '../components/pedidoCard.js';
import { renderClienteSearch, bindClienteSearch, clienteState, resetClienteState } from '../components/clienteSearch.js';


let productos = [];
let saving = false;
let sidebarOpen = false;
let filtroActivo = 'TODOS';
let isFormOpen = false;
let currentProductIndex = null;
let tempProduct = null;

let existingTipos = [];
let savedProducts = [];
let nuevoPedidoAbonos = [];
let anticiposDisponibles = [];
let anticiposAplicados = [];
let cobrosPendientesCliente = [];
let isAbonoModalOpen = false;
let isNewClientModalOpen = false;
let tempNewClientName = '';
let editingClientDocId = '';
let tempEditClientExtra = {};
let editingPedidoId = '';
let deletePedidoId = '';
let isUnificarModalOpen = false;
let pedidosActivosCliente = [];
let decisionUnificacionTomada = false;
let unificarAbiertoAlGuardar = false;
let documentClickHandler = null;
let unsubscribePedidos = null;
let colapsados = { PENDIENTE: false, EN_PROCESO: false, ENTREGADO: true };
let shouldPrintOnSave = true;

function actualizarListadoProductosGuardados() {
  const savedSection = document.getElementById('saved-products-section');
  const savedList = document.getElementById('saved-products-list');
  const fallback = document.getElementById('saved-products-fallback');
  if (savedSection && savedList) {
    if (savedProducts.length > 0) {
      savedSection.style.display = '';
      if (fallback) fallback.style.display = 'none';
      savedList.innerHTML = savedProducts.map(sp => {
        const tipo = String(sp.producto_tipo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        const det = String(sp.detalle_personalizado || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        const priceVal = Number(sp.precio_unitario) || 0;
        const priceStr = priceVal > 0 ? formatCurrency(priceVal) : '0.00';
        return `
          <tr class="saved-product-row" data-saved-doc-id="${sp._docId}" style="cursor: pointer;">
            <td style="font-weight: 700; color: var(--text-primary);">${tipo}</td>
            <td style="color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${det}">${det || '-'}</td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem;">${priceStr}</td>
            <td style="text-align: right; white-space: nowrap;">
              <button type="button" class="btn btn-xs btn-outline saved-product-delete-btn" data-delete-doc-id="${sp._docId}" style="color: var(--danger-text); border-color: transparent; padding: 2px 6px;" title="Eliminar de la lista">✕</button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      savedSection.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
    }
  }
}

/**
 * Render the Pedidos main page
 */
export function renderPedidos() {
  productos = [];
  existingTipos = [];
  savedProducts = [];
  saving = false;
  sidebarOpen = false;
  isFormOpen = false;
  currentProductIndex = null;
  tempProduct = null;
  nuevoPedidoAbonos = [];
  isAbonoModalOpen = false;
  isNewClientModalOpen = false;
  tempNewClientName = '';

  return `
    <!-- Sidebar overlay -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <!-- Contenedor general de modales (producto / abono) -->
    <div id="app-modal-container"></div>

    <!-- Sidebar: Nuevo Pedido -->
    <aside class="sidebar" id="nuevo-pedido-sidebar" role="dialog" aria-label="Nuevo Pedido">
      <div class="sidebar-header">
        <span class="sidebar-title">Nuevo Pedido</span>
        <button class="sidebar-close" id="sidebar-close-btn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="sidebar-body" id="sidebar-body">
        <!-- Datos del cliente -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
            Cliente
          </div>
          ${renderClienteSearch()}
          <div id="anticipo-cliente-container" style="margin-top: 8px;"></div>
          <div id="valores-pendientes-cliente-container" style="margin-top: 8px;"></div>
        </div>

        <div style="height: 1px; background: var(--border); margin-bottom: 16px;"></div>

        <!-- Productos -->
        <div style="margin-bottom: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">
              Productos
            </div>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-add-product" style="display: flex; align-items: center; gap: 4px;">
              ＋ Agregar
            </button>
          </div>
          <!-- Contenedor de la lista de productos ya agregados -->
          <div id="products-list-container">
            ${renderAllProducts()}
          </div>
        </div>

        <!-- Totals -->
        <div class="totals-box" id="totals-box">
          ${renderTotalsHTML()}
        </div>

        <div style="height: 1px; background: var(--border); margin: 20px 0 16px;"></div>

        <!-- Sección de Pago Reestructurada y Simplificada -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
            Método de Pago
          </div>
          <div id="abono-summary-container"></div>
        </div>

        <!-- Notas del pedido -->
        <div class="form-group" id="pedido-notas-group">
          <div id="pedido-notas-toggle" style="font-size:0.82rem; font-weight:600; color:var(--text-tertiary); cursor:pointer; padding:4px 0; user-select:none;">+ Agregar notas</div>
          <input type="text" class="form-input" id="pedido-notas" placeholder="Instrucciones adicionales para el taller" style="display:none;" />
        </div>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-sidebar" style="flex: 1;">
          Cancelar
        </button>
        <button type="button" class="btn btn-secondary" id="btn-save-only" style="flex: 1.5;">
          Guardar
        </button>
        <button type="button" class="btn btn-primary" id="btn-save-print" style="flex: 2;">
          Guardar e Imprimir
        </button>
      </div>
    </aside>

    <!-- Page content -->
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Pedidos</h1>
          <p class="page-subtitle">Gestión de órdenes y pagos</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="search-wrap">
            <span class="search-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
            <input type="text" class="search-input" id="search-pedidos" placeholder="Buscar por ID o cliente..." autocomplete="off" />
          </div>

          <div class="filter-dropdown" style="position:relative;">
            <button type="button" class="btn btn-outline" id="btn-filter-toggle" title="Filtrar pedidos" style="padding:10px; height:42px; width:42px; display:inline-flex; align-items:center; justify-content:center; border-radius:var(--radius-md);">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            </button>
            <div class="filter-dropdown-menu" id="filter-dropdown-menu" style="display:none; position:absolute; right:0; top:48px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:var(--shadow-md); z-index:100; min-width:180px; padding:6px 0;">
              <button class="filter-dropdown-item active" data-filter="TODOS">Todos</button>
              <button class="filter-dropdown-item" data-filter="SIN PAGO">Sin pago</button>
              <button class="filter-dropdown-item" data-filter="PARCIAL">Parcial</button>
              <button class="filter-dropdown-item" data-filter="PAGADO">Pagados</button>
              <button class="filter-dropdown-item" data-filter="PENDIENTE">Pendiente producción</button>
              <button class="filter-dropdown-item" data-filter="LISTO">Listo</button>
              <button class="filter-dropdown-item" data-filter="ENTREGADO">Entregados</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Orders grid -->
      <div id="pedidos-list">
        <div class="loading-center">
          <div class="spinner spinner-lg"></div>
          <span>Cargando pedidos...</span>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" id="fab-nuevo" aria-label="Nuevo Pedido" title="Nuevo Pedido">+</button>
  `;
}

function renderAllProducts() {
  if (productos.length === 0) {
    return `
      <div class="products-empty-state">
        Sin productos en el pedido
      </div>
    `;
  }
  return productos.map((p, i) => renderProductListRow(p, i)).join('');
}

function renderTotalsHTML() {
  const total = calcularTotalPagar(productos);
  return `
    <div class="totals-row main" style="justify-content: flex-end; gap: 8px;">
      <span>Total</span>
      <span class="totals-val" id="total-display">${formatCurrency(total)}</span>
    </div>
  `;
}

function renderNewClientForm(typedValue, extraFields = {}) {
  const isEdit = typedValue.includes('\t');
  let nameVal = typedValue;
  let phoneVal = '';
  if (isEdit) {
    const parts = typedValue.split('\t');
    nameVal = parts[0] || '';
    phoneVal = parts[1] || '';
  } else {
    const isPhone = /^\+?[0-9\s\-()]+$/.test(typedValue) && typedValue.replace(/\D/g, '').length >= 2;
    nameVal = isPhone ? '' : typedValue;
    phoneVal = isPhone ? typedValue.replace(/[\s\-\(\)]/g, '') : '';
  }

  return `
    <div class="modal-overlay" id="nuevo-cliente-modal" style="display: flex;">
      <div class="modal-card" style="margin: auto; max-width: 400px; width: 100%;">
        <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">${isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</div>
        <div class="modal-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 18px;">${isEdit ? 'Actualiza los datos del cliente.' : 'Registra el cliente para asociarlo al pedido.'}</div>

        <div class="form-group">
          <label class="form-label form-required">Nombre Completo</label>
          <input type="text" class="form-input" id="nuevo-cliente-name" placeholder="Ej. Juan Pérez" value="${nameVal.replace(/"/g,'&quot;')}" autocomplete="off" />
        </div>
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">Teléfono / Celular</label>
          <input type="tel" class="form-input" id="nuevo-cliente-phone" placeholder="Ej. 0985985684" value="${phoneVal}" autocomplete="off" />
        </div>

        <div style="margin-bottom: 14px;">
          <button type="button" id="btn-toggle-extra-fields" style="font-size:0.82rem; font-weight:600; color:var(--text-tertiary); background:transparent; border:none; cursor:pointer; padding:4px 0; display:inline-flex; align-items:center; gap:6px;">
            <span id="extra-fields-arrow" style="transition:transform var(--t-fast); display:inline-flex;">▶</span> Otros campos
          </button>
          <div id="extra-fields-container" style="${isEdit && extraFields?.ruc ? 'display:block' : 'display:none'}; margin-top:10px;">
            <div class="form-group">
              <label class="form-label">RUC</label>
              <input type="text" class="form-input" id="nuevo-cliente-ruc" placeholder="Ej. 1234567890001" autocomplete="off" value="${(extraFields?.ruc || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input type="email" class="form-input" id="nuevo-cliente-email" placeholder="Ej. cliente@correo.com" autocomplete="off" value="${(extraFields?.email || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Dirección</label>
              <input type="text" class="form-input" id="nuevo-cliente-direccion" placeholder="Ej. Av. Principal 123" autocomplete="off" value="${(extraFields?.direccion || '')}" />
            </div>
          </div>
        </div>

        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-new-client" style="flex: 1;">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-new-client" style="flex: 2;">${isEdit ? 'Actualizar Cliente' : 'Guardar Cliente'}</button>
        </div>
      </div>
    </div>
  `;
}

// ── Pedidos list rendering ──

let allPedidos = [];

async function loadPedidos() {
  const list = document.getElementById('pedidos-list');
  if (!list) return;

  if (unsubscribePedidos) {
    unsubscribePedidos();
    unsubscribePedidos = null;
  }

  try {
    unsubscribePedidos = escucharPedidosRecientes(300, (pedidos) => {
      allPedidos = pedidos;
      renderFilteredList();
    });
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error al cargar</div>
        <div class="empty-msg">${err.message}</div>
      </div>`;
  }
}

function renderFilteredList() {
  const list = document.getElementById('pedidos-list');
  if (!list) return;

  const searchTerm = document.getElementById('search-pedidos')?.value.trim().toLowerCase() || '';

  let filtered = allPedidos.filter(p => {
    const matchFilter =
      filtroActivo === 'TODOS' ||
      p.estado_pago === filtroActivo ||
      p.estado_produccion === filtroActivo ||
      (filtroActivo === 'LISTO' && p.estado_produccion === 'EN PROCESO');

    const matchSearch = !searchTerm ||
      p.cliente_nombre.toLowerCase().includes(searchTerm) ||
      p.id_pedido.toLowerCase().includes(searchTerm);

    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Sin resultados</div>
        <div class="empty-msg">${allPedidos.length === 0
          ? 'Crea tu primer pedido con el botón ＋'
          : 'No hay pedidos que coincidan con el filtro o búsqueda.'}</div>
      </div>`;
    return;
  }

  const grouped = agruparPedidos(filtered);

  // Group by status
  const pendientes = grouped.filter(p => p.estado_produccion === 'PENDIENTE');
  const listo      = grouped.filter(p => p.estado_produccion === 'LISTO' || p.estado_produccion === 'EN PROCESO');

  // Only show orders delivered today in the Entregadas column
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const entregados = grouped.filter(p => {
    if (p.estado_produccion !== 'ENTREGADO') return false;

    const target = p.isGrupo ? p.pedidos[0] : p;

    let deliveryDate = null;
    if (target.fecha_entrega) {
      deliveryDate = target.fecha_entrega.toDate ? target.fecha_entrega.toDate() : new Date(target.fecha_entrega);
    } else if (Array.isArray(target.historial_estados)) {
      const deliveryEvent = target.historial_estados.find(h => h.tipo === 'produccion' && h.estado_nuevo === 'ENTREGADO');
      if (deliveryEvent && deliveryEvent.fecha) {
        deliveryDate = deliveryEvent.fecha.toDate ? deliveryEvent.fecha.toDate() : new Date(deliveryEvent.fecha);
      }
    }

    if (!deliveryDate) {
      if (target.fecha_creacion) {
        const createdDate = target.fecha_creacion.toDate ? target.fecha_creacion.toDate() : new Date(target.fecha_creacion);
        if (createdDate >= startOfToday) return true;
      }
      return false;
    }

    return deliveryDate >= startOfToday;
  });

  list.innerHTML = `
    <div class="taller-columns">
      <!-- Columna Pendientes -->
      <div class="taller-column ${colapsados.PENDIENTE ? 'collapsed' : ''}" data-estado="PENDIENTE">
        <div class="taller-column-header" style="cursor:pointer; user-select:none;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="taller-column-arrow" style="transition: transform var(--t-fast); display:inline-flex; font-size:0.75rem; color:var(--text-tertiary); transform: ${colapsados.PENDIENTE ? 'rotate(-90deg)' : 'none'};">▼</span>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; color:var(--text-tertiary);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span class="taller-column-title">Pendientes</span>
          </div>
          <span class="taller-column-count ${pendientes.length > 0 ? 'has-items' : ''}">${pendientes.length}</span>
        </div>
        <div class="taller-column-body">
          ${pendientes.map(p => renderPedidoCard(p)).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>

      <!-- Columna Listo -->
      <div class="taller-column ${colapsados.LISTO ? 'collapsed' : ''}" data-estado="LISTO">
        <div class="taller-column-header" style="cursor:pointer; user-select:none;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="taller-column-arrow" style="transition: transform var(--t-fast); display:inline-flex; font-size:0.75rem; color:var(--text-tertiary); transform: ${colapsados.LISTO ? 'rotate(-90deg)' : 'none'};">▼</span>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; color:var(--success-text);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span class="taller-column-title">Listo</span>
          </div>
          <span class="taller-column-count ${listo.length > 0 ? 'has-items' : ''}">${listo.length}</span>
        </div>
        <div class="taller-column-body">
          ${listo.map(p => renderPedidoCard(p)).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>

      <!-- Columna Entregadas -->
      <div class="taller-column ${colapsados.ENTREGADO ? 'collapsed' : ''}" data-estado="ENTREGADO">
        <div class="taller-column-header" style="cursor:pointer; user-select:none;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="taller-column-arrow" style="transition: transform var(--t-fast); display:inline-flex; font-size:0.75rem; color:var(--text-tertiary); transform: ${colapsados.ENTREGADO ? 'rotate(-90deg)' : 'none'};">▼</span>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; color:var(--accent);"><polyline points="21 16 12 21 3 16 3 8 12 3 21 8 21 16"></polyline><polyline points="3 8 12 13 21 8"></polyline><line x1="12" y1="13" x2="12" y2="21"></line></svg>
            <span class="taller-column-title">Entregadas hoy</span>
          </div>
          <span class="taller-column-count ${entregados.length > 0 ? 'has-items' : ''}">${entregados.length}</span>
        </div>
        <div class="taller-column-body">
          ${entregados.map(p => renderPedidoCard(p)).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>
    </div>
  `;

  // Bind click to headers to collapse columns
  list.querySelectorAll('.taller-column-header').forEach(header => {
    header.addEventListener('click', () => {
      const col = header.closest('.taller-column');
      const estado = col.dataset.estado;
      const arrow = header.querySelector('.taller-column-arrow');
      
      colapsados[estado] = !colapsados[estado];
      col.classList.toggle('collapsed', colapsados[estado]);
      
      if (arrow) {
        arrow.style.transform = colapsados[estado] ? 'rotate(-90deg)' : 'none';
      }
    });
  });

  // Bind click to each card → navigate to taller with this pedido
  list.querySelectorAll('.pedido-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-dropdown') || e.target.closest('[data-card-print]') || e.target.closest('.pedido-card-amount-action') || e.target.closest('.btn-attach-card')) return;

      // Si la tarjeta tiene sub-bloques, es un grupo: siempre abrir vista consolidada
      const hasSubBlocks = card.querySelector('.sub-pedido-block');
      if (hasSubBlocks) {
        history.pushState(null, '', `/taller/grupo/${card.dataset.docId}`);
      } else {
        history.pushState(null, '', `/taller/${card.dataset.docId}`);
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}

// ── Sidebar ──

function openSidebar() {
  sidebarOpen = true;
  document.getElementById('nuevo-pedido-sidebar')?.classList.add('active');
  document.getElementById('sidebar-overlay')?.classList.add('active');
  document.getElementById('fab-nuevo')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('cs-input')?.focus(), 350);
}

async function openSidebarForEdit(pedidoDocId) {
  try {
    const pedido = await obtenerPedido(pedidoDocId);
    if (!pedido) { showToast('Pedido no encontrado', 'error'); return; }

    editingPedidoId = pedidoDocId;

    // Load products (state only, UI render after openSidebar)
    productos = (pedido.productos || []).map(p => ({
      id_producto: p.id_producto || '',
      producto_tipo: p.producto_tipo || '',
      detalle_personalizado: p.detalle_personalizado || '',
      cantidad: p.cantidad || 1,
      precio_unitario: p.precio_unitario || 0,
    }));

    // Load payment
    const abonos = pedido.abonos || [];
    nuevoPedidoAbonos = abonos.map(ab => ({ ...ab }));

    isFormOpen = false;
    isAbonoModalOpen = false;
    isNewClientModalOpen = false;

    openSidebar();

    // Load client – set state and show card directly
    clienteState.nombre = pedido.cliente_nombre || '';
    clienteState.telefono = pedido.cliente_telefono || '';
    clienteState.docId = pedido.cliente_id || '';
    clienteState.isNew = false;
    const n = clienteState.nombre;
    const t = clienteState.telefono;
    const searchContainer = document.getElementById('cs-search-mode-container');
    if (searchContainer) searchContainer.style.display = 'none';
    const selectedChip = document.getElementById('cs-selected');
    if (selectedChip) {
      selectedChip.style.display = 'block';
      selectedChip.innerHTML = `
        <div class="cs-selected-client-row">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="cs-client-avatar">${n.charAt(0).toUpperCase()}</div>
            <div>
              <div class="cs-client-name">${n}</div>
              <div class="cs-client-phone">${t || 'Sin celular'}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 2px;">
            <button type="button" class="cs-icon-btn" id="cs-chip-edit" title="Editar cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button type="button" class="cs-icon-btn cs-icon-btn-remove" id="cs-chip-remove" title="Quitar cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      `;
      document.getElementById('cs-chip-remove')?.addEventListener('click', () => {
        resetClienteState();
        const inp = document.getElementById('cs-input');
        if (inp) inp.value = '';
        const sc = document.getElementById('cs-search-mode-container');
        if (sc) sc.style.display = 'block';
        if (selectedChip) selectedChip.style.display = 'none';
        const icon = document.getElementById('cs-icon');
        if (icon) icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        setTimeout(() => inp?.focus(), 50);
      });
      document.getElementById('cs-chip-edit')?.addEventListener('click', async () => {
        editingClientDocId = clienteState.docId || '';
        tempEditClientExtra = {};
        if (editingClientDocId) {
          try {
            const clienteFull = await obtenerCliente(editingClientDocId);
            if (clienteFull) {
              tempEditClientExtra = {
                ruc: clienteFull.ruc || '',
                email: clienteFull.email || '',
                direccion: clienteFull.direccion || '',
              };
            }
          } catch { /* ignore */ }
        }
        tempNewClientName = `${n}\t${t}`;
        isNewClientModalOpen = true;
        updateSidebarUI();
      });
    }

    // Render UI after state is set
    updateSidebarUI();
    updateTotals();

    // Pre-fill notes if any
    const notesInput = document.getElementById('pedido-notas');
    const notesToggle = document.getElementById('pedido-notas-toggle');
    if (pedido.notas) {
      if (notesInput) { notesInput.value = pedido.notas; notesInput.style.display = 'block'; }
      if (notesToggle) notesToggle.style.display = 'none';
    }
  } catch (err) {
    showToast('Error al cargar pedido: ' + err.message, 'error');
  }
}

function closeSidebar() {
  sidebarOpen = false;
  closeAllDropdowns();
  document.getElementById('nuevo-pedido-sidebar')?.classList.remove('active');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
  document.getElementById('fab-nuevo')?.classList.remove('open');
  document.body.style.overflow = '';
  
  // Reset product and payment modal state when closing
  isFormOpen = false;
  currentProductIndex = null;
  tempProduct = null;
  isAbonoModalOpen = false;
  isNewClientModalOpen = false;
  tempNewClientName = '';
  editingClientDocId = '';
  tempEditClientExtra = {};
  editingPedidoId = '';
  deletePedidoId = '';
}

function actualizarAlertaAnticipo() {
  const container = document.getElementById('anticipo-cliente-container');
  if (!container) return;

  if (anticiposDisponibles.length === 0) {
    container.innerHTML = '';
    return;
  }

  const totalAnticipos = anticiposDisponibles.reduce((sum, a) => sum + a.saldo, 0);
  const yaAplicado = nuevoPedidoAbonos.some(ab => ab.metodo_pago === 'Anticipo');

  if (yaAplicado) {
    container.innerHTML = `
      <div class="cs-selected-client-row" style="background: rgba(76, 175, 80, 0.08); border: 1px solid var(--success); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="color: var(--success-text); font-weight: 600;">Anticipo aplicado</span>
        <button type="button" class="btn btn-xs btn-outline" id="btn-remover-anticipo-alerta" style="border-color: var(--success); color: var(--success-text); padding: 2px 6px;">Quitar</button>
      </div>
    `;
    document.getElementById('btn-remover-anticipo-alerta')?.addEventListener('click', quitarAnticipoDelPedido);
  } else {
    container.innerHTML = `
      <div class="cs-selected-client-row" style="background: rgba(229, 57, 53, 0.08); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div style="color: var(--text-primary);">
          Saldo a favor: <strong style="font-family: var(--font-mono); font-weight: 700; color: var(--accent);">${formatCurrency(totalAnticipos)}</strong>
        </div>
        <button type="button" class="btn btn-xs btn-primary" id="btn-aplicar-anticipo-alerta">Aplicar</button>
      </div>
    `;
    document.getElementById('btn-aplicar-anticipo-alerta')?.addEventListener('click', aplicarAnticipoAlPedido);
  }
}

function actualizarAlertaValoresPendientes() {
  const container = document.getElementById('valores-pendientes-cliente-container');
  if (!container) return;

  if (cobrosPendientesCliente.length === 0) {
    container.innerHTML = '';
    return;
  }

  const totalPendiente = cobrosPendientesCliente.reduce((sum, p) => sum + (p.saldo_pendiente || 0), 0);

  container.innerHTML = `
    <div class="cs-selected-client-row" style="background: rgba(229, 57, 53, 0.08); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div style="color: var(--text-primary); font-weight: 500;">
        Valores pendientes: <strong style="font-family: var(--font-mono); font-weight: 700; color: var(--accent);">${formatCurrency(totalPendiente)}</strong>
      </div>
    </div>
  `;
}

function aplicarAnticipoAlPedido() {
  const total = calcularTotalPagar(productos);
  if (total <= 0) {
    showToast('Agrega productos al pedido antes de aplicar el anticipo', 'error');
    return;
  }

  const abonosNoAnticipo = nuevoPedidoAbonos
    .filter(ab => ab.metodo_pago !== 'Anticipo')
    .reduce((sum, ab) => sum + Number(ab.monto), 0);

  const saldoPedido = Math.max(0, total - abonosNoAnticipo);
  if (saldoPedido <= 0.001) {
    showToast('El pedido ya está cubierto por otros abonos', 'info');
    return;
  }

  const totalAnticipos = anticiposDisponibles.reduce((sum, a) => sum + a.saldo, 0);
  if (totalAnticipos <= 0) {
    showToast('El cliente no tiene saldo de anticipos disponible', 'error');
    return;
  }

  const montoAplicar = Math.min(totalAnticipos, saldoPedido);

  // Distribuir el monto entre los anticipos disponibles
  let restante = montoAplicar;
  anticiposAplicados = [];

  for (const ant of anticiposDisponibles) {
    if (restante <= 0) break;
    const aUsar = Math.min(ant.saldo, restante);
    if (aUsar > 0) {
      anticiposAplicados.push({ docId: ant._docId, monto: Number(aUsar.toFixed(2)) });
      restante -= aUsar;
    }
  }

  // Quitar cualquier abono anterior de tipo Anticipo por seguridad
  nuevoPedidoAbonos = nuevoPedidoAbonos.filter(ab => ab.metodo_pago !== 'Anticipo');

  // Agregar abono de tipo Anticipo
  nuevoPedidoAbonos.push({
    monto: Number(montoAplicar.toFixed(2)),
    metodo_pago: 'Anticipo',
    esNuevo: true
  });

  updateSidebarUI();
  updateTotals();
  showToast('Anticipo aplicado al total', 'success');
}

function quitarAnticipoDelPedido() {
  nuevoPedidoAbonos = nuevoPedidoAbonos.filter(ab => ab.metodo_pago !== 'Anticipo');
  anticiposAplicados = [];
  updateSidebarUI();
  updateTotals();
  showToast('Anticipo removido', 'info');
}

function resetSidebar() {
  productos = [];
  existingTipos = [];
  savedProducts = [];
  isFormOpen = false;
  currentProductIndex = null;
  tempProduct = null;
  nuevoPedidoAbonos = [];
  anticiposDisponibles = [];
  anticiposAplicados = [];
  isAbonoModalOpen = false;
  isNewClientModalOpen = false;
  tempNewClientName = '';
  editingClientDocId = '';
  tempEditClientExtra = {};
  editingPedidoId = '';
  deletePedidoId = '';
  isUnificarModalOpen = false;
  pedidosActivosCliente = [];
  
  const antContainer = document.getElementById('anticipo-cliente-container');
  if (antContainer) antContainer.innerHTML = '';
  const cobContainer = document.getElementById('valores-pendientes-cliente-container');
  if (cobContainer) cobContainer.innerHTML = '';
  cobrosPendientesCliente = [];
  decisionUnificacionTomada = false;
  unificarAbiertoAlGuardar = false;
  
  updateSidebarUI();
  updateTotals();
  
  // Reset client autocomplete
  resetClienteState();
  const input = document.getElementById('cs-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('cs-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  const dropdown = document.getElementById('cs-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const selected = document.getElementById('cs-selected');
  if (selected) selected.style.display = 'none';
  const searchContainer = document.getElementById('cs-search-mode-container');
  if (searchContainer) searchContainer.style.display = 'block';
  const iconEl = document.getElementById('cs-icon');
  if (iconEl) iconEl.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  const phoneGrp = document.getElementById('cs-phone-group');
  if (phoneGrp) phoneGrp.style.display = 'none';
  const phoneInp = document.getElementById('cs-phone');
  if (phoneInp) phoneInp.value = '';

  const notesEl = document.getElementById('pedido-notas');
  if (notesEl) { notesEl.value = ''; notesEl.style.display = 'none'; }
  const notesToggle = document.getElementById('pedido-notas-toggle');
  if (notesToggle) notesToggle.style.display = 'block';
}

function closeAllDropdowns() {
  document.querySelectorAll('.product-dropdown-menu.open').forEach(m => m.classList.remove('open'));
}

function obtenerIconoMetodoPago(metodo) {
  if (metodo === 'Transferencia') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--text-primary);"><polygon points="2 10 12 2 22 10"></polygon><rect x="4" y="10" width="16" height="11"></rect><line x1="9" y1="15" x2="9" y2="18"></line><line x1="12" y1="15" x2="12" y2="18"></line><line x1="15" y1="15" x2="15" y2="18"></line></svg>`;
  }
  if (metodo === 'Tarjeta') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--text-primary);"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
  }
  // Por defecto Efectivo
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--text-primary);"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
}

function updatePaymentUI() {
  updateSidebarUI();
}

function updateSidebarUI() {
  const modalContainer = document.getElementById('app-modal-container');
  const listContainer = document.getElementById('products-list-container');
  const saveBtn = document.getElementById('btn-save-print');
  const saveOnlyBtn = document.getElementById('btn-save-only');
  const total = calcularTotalPagar(productos);
  const abonoSummaryContainer = document.getElementById('abono-summary-container');

  if (abonoSummaryContainer) {
    const totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
    const saldoRestante = Math.max(0, total - totalAbonadoAct);

    let itemsHtml = '';
    if (nuevoPedidoAbonos.length > 0) {
      itemsHtml = nuevoPedidoAbonos.map((ab, idx) => {
        const animationStyle = ab.esNuevo ? 'animation: slideDown 0.15s ease-out;' : '';
        if (ab.esNuevo) {
          ab.esNuevo = false;
        }
        return `
          <div class="cs-selected-client-row" style="margin-bottom: 8px; ${animationStyle}">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0;">
                ${obtenerIconoMetodoPago(ab.metodo_pago)}
              </div>
              <div>
                <div class="cs-client-name" style="font-family: var(--font-mono);">${formatCurrency(ab.monto)}</div>
                <div class="cs-client-phone">${ab.metodo_pago}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center;">
              <button type="button" class="cs-icon-btn cs-icon-btn-remove btn-remove-abono-item" data-index="${idx}" title="Eliminar abono">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    let actionsHtml = '';
    if (saldoRestante > 0.001) {
      actionsHtml = `
        <div style="display: flex; gap: 6px; margin-top: 12px;">
          <button type="button" class="btn btn-sm btn-outline btn-pagar-rapido" data-metodo="Efectivo" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; font-size: 0.72rem; border-color: var(--border-strong);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span>Efectivo</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline btn-pagar-rapido" data-metodo="Transferencia" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; font-size: 0.72rem; border-color: var(--border-strong);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polygon points="2 10 12 2 22 10"></polygon><rect x="4" y="10" width="16" height="11"></rect><line x1="9" y1="15" x2="9" y2="18"></line><line x1="12" y1="15" x2="12" y2="18"></line><line x1="15" y1="15" x2="15" y2="18"></line></svg>
            <span>Transf.</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline btn-pagar-rapido" data-metodo="Tarjeta" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; font-size: 0.72rem; border-color: var(--border-strong);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            <span>Tarjeta</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline" id="btn-registrar-pago" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; font-size: 0.72rem; border-color: var(--border-strong);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="6.5" cy="15" r="5.5"></circle><rect x="12" y="10" width="9.5" height="7" rx="1.5"></rect><line x1="14.5" y1="12.5" x2="19" y2="12.5"></line><line x1="14.5" y1="15" x2="17" y2="15"></line></svg>
            <span>Abono</span>
          </button>
        </div>
      `;
    } else {
      actionsHtml = '';
    }

    abonoSummaryContainer.innerHTML = `
      <div>
        ${itemsHtml}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 4px 0; font-size: 0.8rem; color: var(--text-secondary);">
          <span>Saldo pendiente:</span>
          <strong style="color: ${saldoRestante > 0.001 ? 'var(--danger-text)' : 'var(--success-text)'}; font-family: var(--font-mono); font-size: 0.85rem;">${formatCurrency(saldoRestante)}</strong>
        </div>
        ${actionsHtml}
      </div>
    `;
  }

  // 3. Renderizar modales (producto o abono)
  if (deletePedidoId) {
    if (modalContainer) {
      modalContainer.innerHTML = `
        <div class="modal-overlay" id="confirm-delete-modal" style="display: flex;">
          <div class="modal-card" style="margin: auto; max-width: 400px; width: 100%;">
            <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Eliminar Pedido</div>
            <div class="modal-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 18px;">
              ¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.
            </div>
            <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-delete-modal" style="flex: 1;">Cancelar</button>
              <button type="button" class="btn btn-primary" id="btn-confirm-delete-modal" style="flex: 2;">Eliminar</button>
            </div>
          </div>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('btn-cancel-delete-modal')?.focus();
      }, 150);
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Eliminando pedido...';
    }
  } else if (isFormOpen) {
    if (modalContainer) {
      modalContainer.innerHTML = renderProductForm(tempProduct, currentProductIndex !== null, existingTipos, savedProducts);
      setTimeout(() => {
        modalContainer.querySelector('.temp-product-field[data-field="producto_tipo"]')?.focus();
      }, 150);
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Completa el producto...';
    }
  } else if (isAbonoModalOpen) {
    if (modalContainer) {
      const totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
      const saldoRestante = total - totalAbonadoAct;
      modalContainer.innerHTML = renderAbonoFormModal(saldoRestante, saldoRestante, 'Efectivo');
      setTimeout(() => {
        const input = document.getElementById('abono-modal-monto');
        if (input) {
          input.focus();
          input.select();
        }
      }, 150);
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Completa el abono...';
    }
  } else if (isUnificarModalOpen) {
    if (modalContainer) {
      modalContainer.innerHTML = renderUnificarModal(pedidosActivosCliente);
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Unificando pedido...';
    }
  } else if (isNewClientModalOpen) {
    if (modalContainer) {
      modalContainer.innerHTML = renderNewClientForm(tempNewClientName, tempEditClientExtra);
      setTimeout(() => {
        const nameInput = document.getElementById('nuevo-cliente-name');
        const phoneInput = document.getElementById('nuevo-cliente-phone');
        if (nameInput && !nameInput.value.trim()) nameInput.focus();
        else phoneInput?.focus();
      }, 150);
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Completa el cliente...';
    }
  } else {
    if (modalContainer) modalContainer.innerHTML = '';
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingPedidoId ? 'Actualizar Pedido' : 'Guardar e Imprimir';
    }
  }

  if (saveOnlyBtn) {
    if (editingPedidoId) {
      saveOnlyBtn.style.display = 'none';
    } else {
      saveOnlyBtn.style.display = '';
      saveOnlyBtn.disabled = !!(deletePedidoId || isFormOpen || isAbonoModalOpen || isUnificarModalOpen || isNewClientModalOpen);
    }
  }

  // Update sidebar title
  const sidebarTitleEl = document.querySelector('.sidebar-title');
  if (sidebarTitleEl) sidebarTitleEl.textContent = editingPedidoId ? 'Editar Pedido' : 'Nuevo Pedido';
  const sidebar = document.getElementById('nuevo-pedido-sidebar');
  if (sidebar) sidebar.setAttribute('aria-label', editingPedidoId ? 'Editar Pedido' : 'Nuevo Pedido');

  if (listContainer) {
    listContainer.innerHTML = renderAllProducts();
  }
  actualizarAlertaAnticipo();
  actualizarAlertaValoresPendientes();
}

// ── Events ──

export function bindPedidosEvents() {
  // Remove stale listener before registering a new one (prevents accumulation)
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }

  // Check if edit query parameter is present in URL
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  if (editId) {
    history.replaceState(null, '', '/pedidos');
    openSidebarForEdit(editId);
  }

  // Initialize client search autocomplete events
  bindClienteSearch({
    onNewClient: (typedValue) => {
      tempNewClientName = typedValue;
      isNewClientModalOpen = true;
      updateSidebarUI();
    },
    onEditClient: async (nombre, telefono) => {
      tempNewClientName = `${nombre}\t${telefono}`;
      editingClientDocId = clienteState.docId || '';
      tempEditClientExtra = {};
      if (editingClientDocId) {
        try {
          const clienteFull = await obtenerCliente(editingClientDocId);
          if (clienteFull) {
            tempEditClientExtra = {
              ruc: clienteFull.ruc || '',
              email: clienteFull.email || '',
              direccion: clienteFull.direccion || '',
            };
          }
        } catch { /* use empty extra */ }
      }
      isNewClientModalOpen = true;
      updateSidebarUI();
    },
    onSelectClient: async (client) => {
      try {
        // Cargar anticipos activos del cliente
        const anticipos = await obtenerAnticiposActivosCliente(client._docId);
        anticiposDisponibles = anticipos;
        actualizarAlertaAnticipo();

        // Cargar pedidos con saldo pendiente del cliente
        const cobros = await obtenerPedidosPendientesCobroCliente(client._docId);
        cobrosPendientesCliente = cobros;
        actualizarAlertaValoresPendientes();

        const activos = await obtenerPedidosActivosCliente(client._docId);
        if (activos.length > 0) {
          pedidosActivosCliente = activos;
          isUnificarModalOpen = true;
          unificarAbiertoAlGuardar = false;
          decisionUnificacionTomada = false;
          updateSidebarUI();
        } else {
          pedidosActivosCliente = [];
          decisionUnificacionTomada = true;
        }
      } catch (err) {
        console.error("Error comprobando pedidos activos al seleccionar cliente:", err);
      }
    }
  });

  // FAB
  document.getElementById('fab-nuevo')?.addEventListener('click', () => {
    if (sidebarOpen) closeSidebar();
    else { resetSidebar(); openSidebar(); }
  });

  // Toggle notas del pedido
  document.getElementById('pedido-notas-toggle')?.addEventListener('click', () => {
    const input = document.getElementById('pedido-notas');
    const toggle = document.getElementById('pedido-notas-toggle');
    if (input && toggle) {
      input.style.display = 'block';
      toggle.style.display = 'none';
      input.focus();
    }
  });

  // Close sidebar
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
  document.getElementById('btn-cancel-sidebar')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // ESC key
  document.addEventListener('keydown', handleEsc);

  // Add product button click (opens form)
  document.getElementById('btn-add-product')?.addEventListener('click', () => {
    isFormOpen = true;
    currentProductIndex = null;
    tempProduct = createEmptyProduct();
    existingTipos = [];
    savedProducts = [];
    updateSidebarUI();
    Promise.all([obtenerTiposProducto(), obtenerProductosGuardados()]).then(([tiposFromFirestore, saved]) => {
      const sessionTipos = [...new Set(productos.map(p => p.producto_tipo).filter(Boolean))];
      existingTipos = [...new Set([...tiposFromFirestore, ...sessionTipos])].sort();
      savedProducts = saved;
      const datalist = document.getElementById('tipo-datalist');
      if (datalist) datalist.innerHTML = existingTipos.map(t => `<option value="${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}">`).join('');
      actualizarListadoProductosGuardados();
    }).catch(() => {});
  });

  // Product and Abono form events inside app-modal-container
  const modalContainer = document.getElementById('app-modal-container');
  if (modalContainer) {
    modalContainer.addEventListener('input', (e) => {
      // 1. Manejo del input de Total del producto (cálculo inverso)
      if (e.target.id === 'modal-product-total') {
        const qtyInput = modalContainer.querySelector('#modal-product-qty');
        const priceInput = modalContainer.querySelector('#modal-product-price');
        const totalVal = parseFloat(e.target.value) || 0;
        const qtyVal = parseInt(qtyInput?.value) || 1;

        const calculatedPrice = totalVal > 0 ? Number((totalVal / qtyVal).toFixed(4)) : 0;
        
        if (priceInput) {
          priceInput.value = calculatedPrice > 0 ? calculatedPrice : '';
        }
        if (tempProduct) {
          tempProduct.precio_unitario = calculatedPrice > 0 ? calculatedPrice : '';
        }
        
        // Actualizar el subtotal de abajo
        updateModalSubtotal(totalVal);
        return;
      }

      // 2. Manejo de inputs estándar (.temp-product-field)
      const fieldEl = e.target.closest('.temp-product-field');
      if (fieldEl) {
        const fieldName = fieldEl.dataset.field;
        let value = fieldEl.value;
        
        if (fieldName === 'cantidad') {
          value = parseInt(value) || 1;
        } else if (fieldName === 'precio_unitario') {
          value = value ? parseFloat(value) : '';
        }
        
        if (tempProduct) {
          tempProduct[fieldName] = value;
        }
        
        // Recalcular Total e inyectarlo en el input de Total del producto
        const qtyVal = parseInt(modalContainer.querySelector('#modal-product-qty')?.value) || 1;
        const priceVal = parseFloat(modalContainer.querySelector('#modal-product-price')?.value) || 0;
        const totalInput = modalContainer.querySelector('#modal-product-total');
        
        const sub = qtyVal * priceVal;
        if (totalInput) {
          totalInput.value = sub > 0 ? Number(sub.toFixed(2)) : '';
        }
        
        updateModalSubtotal(sub);
      }
    });

    modalContainer.addEventListener('click', async (e) => {
      // --- Tab Switcher ---
      const tabBtn = e.target.closest('.modal-tab-btn');
      if (tabBtn) {
        const targetTab = tabBtn.dataset.tab;
        
        // Update active classes
        modalContainer.querySelectorAll('.modal-tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn === tabBtn);
        });
        
        // Toggle tab panels
        const panelNew = modalContainer.querySelector('#tab-new-product');
        const panelSaved = modalContainer.querySelector('#tab-saved-products');
        const btnConfirm = modalContainer.querySelector('#btn-confirm-product');
        
        if (targetTab === 'new-product') {
          if (panelNew) panelNew.style.display = 'block';
          if (panelSaved) panelSaved.style.display = 'none';
          if (btnConfirm) btnConfirm.style.display = '';
          modalContainer.querySelector('.temp-product-field[data-field="producto_tipo"]')?.focus();
        } else if (targetTab === 'saved-products') {
          if (panelNew) panelNew.style.display = 'none';
          if (panelSaved) panelSaved.style.display = 'block';
          if (btnConfirm) btnConfirm.style.display = 'none';
        }
        return;
      }

      // --- UNIFICAR PEDIDO MODAL ---
      if (e.target.closest('#btn-confirm-unificar')) {
        isUnificarModalOpen = false;
        decisionUnificacionTomada = true;
        updateSidebarUI();
        if (unificarAbiertoAlGuardar) {
          await handleSave(true);
        }
        return;
      }

      if (e.target.closest('#btn-no-unificar')) {
        isUnificarModalOpen = false;
        decisionUnificacionTomada = true;
        pedidosActivosCliente = []; // Vaciamos para guardar separado
        updateSidebarUI();
        if (unificarAbiertoAlGuardar) {
          await handleSave(true);
        }
        return;
      }

      if (e.target.id === 'unificar-pedido-modal') {
        isUnificarModalOpen = false;
        pedidosActivosCliente = [];
        updateSidebarUI();
        return;
      }

      // --- DELETE CONFIRMATION MODAL ---
      if (e.target.closest('#btn-confirm-delete-modal')) {
        const id = deletePedidoId;
        deletePedidoId = '';
        updateSidebarUI();
        eliminarPedido(id).then(() => {
          showToast('Pedido eliminado', 'info');
          loadPedidos();
        }).catch(() => showToast('Error al eliminar', 'error'));
        return;
      }

      if (e.target.closest('#btn-cancel-delete-modal') || e.target.id === 'confirm-delete-modal') {
        deletePedidoId = '';
        updateSidebarUI();
        return;
      }

      // --- Delete saved product ---
      const deleteSavedBtn = e.target.closest('.saved-product-delete-btn');
      if (deleteSavedBtn) {
        e.stopPropagation();
        const docId = deleteSavedBtn.dataset.deleteDocId;
        eliminarProductoGuardado(docId).then(() => {
          showToast('Producto guardado eliminado', 'info');
          savedProducts = savedProducts.filter(p => p._docId !== docId);
          actualizarListadoProductosGuardados();
        }).catch(() => showToast('Error al eliminar producto guardado', 'error'));
        return;
      }

      // --- Select saved product to populate form ---
      const savedRow = e.target.closest('.saved-product-row[data-saved-doc-id]');
      if (savedRow) {
        const docId = savedRow.dataset.savedDocId;
        const sp = savedProducts.find(p => p._docId === docId);
        if (sp && tempProduct) {
          tempProduct.producto_tipo = sp.producto_tipo;
          tempProduct.detalle_personalizado = sp.detalle_personalizado || '';
          tempProduct.precio_unitario = sp.precio_unitario || '';
          const tipoInput = modalContainer.querySelector('.temp-product-field[data-field="producto_tipo"]');
          const detalleInput = modalContainer.querySelector('.temp-product-field[data-field="detalle_personalizado"]');
          const precioInput = modalContainer.querySelector('.temp-product-field[data-field="precio_unitario"]');
          if (tipoInput) tipoInput.value = sp.producto_tipo;
          if (detalleInput) detalleInput.value = sp.detalle_personalizado || '';
          if (precioInput) precioInput.value = sp.precio_unitario > 0 ? sp.precio_unitario : '';
          
          // Trigger subtotal recalculation
          const qty = Number(modalContainer.querySelector('.temp-product-field[data-field="cantidad"]')?.value) || 1;
          const price = Number(sp.precio_unitario) || 0;
          const sub = qty * price;
          
          const totalInput = modalContainer.querySelector('#modal-product-total');
          if (totalInput) {
            totalInput.value = sub > 0 ? Number(sub.toFixed(2)) : '';
          }
          
          updateModalSubtotal(sub);
          
          // Programmatically switch back to Nuevo Producto tab
          const newTabBtn = modalContainer.querySelector('.modal-tab-btn[data-tab="new-product"]');
          if (newTabBtn) {
            newTabBtn.click();
          }
        }
        return;
      }

      // --- PRODUCT MODAL ---
      // Confirm Product (Añadir / Guardar Cambios)
      if (e.target.closest('#btn-confirm-product')) {
        if (!tempProduct || !tempProduct.producto_tipo?.trim()) {
          showToast('Tipo de producto requerido', 'error');
          modalContainer.querySelector('.temp-product-field[data-field="producto_tipo"]')?.focus();
          return;
        }

        if (!tempProduct.cantidad || Number(tempProduct.cantidad) <= 0) {
          showToast('Cantidad inválida (mínimo 1)', 'error');
          modalContainer.querySelector('.temp-product-field[data-field="cantidad"]')?.focus();
          return;
        }
        if (tempProduct.precio_unitario === '' || Number(tempProduct.precio_unitario) < 0) {
          showToast('Precio unitario inválido', 'error');
          modalContainer.querySelector('.temp-product-field[data-field="precio_unitario"]')?.focus();
          return;
        }

        // Save product if checkbox is checked
        const saveCheckbox = modalContainer.querySelector('#save-product-checkbox');
        if (currentProductIndex === null && saveCheckbox?.checked) {
          const saved = await guardarProducto(tempProduct);
          savedProducts = [saved, ...savedProducts];
          showToast('Producto guardado para usos futuros', 'success');
        }

        // Add or update
        if (currentProductIndex !== null) {
          productos[currentProductIndex] = { ...tempProduct };
          showToast('Producto modificado', 'success');
        } else {
          productos.push({ ...tempProduct });
          showToast('Producto añadido al pedido', 'success');
        }

        isFormOpen = false;
        currentProductIndex = null;
        tempProduct = null;
        updateSidebarUI();
        updateTotals();
      }

      // Cancel Product Form
      if (e.target.closest('#btn-cancel-product')) {
        isFormOpen = false;
        currentProductIndex = null;
        tempProduct = null;
        updateSidebarUI();
      }

      // Close modal on click outside (overlay click)
      if (e.target.id === 'product-modal') {
        isFormOpen = false;
        currentProductIndex = null;
        tempProduct = null;
        updateSidebarUI();
      }

      // --- ABONO MODAL ---
      // Confirm Abono
      if (e.target.closest('#btn-confirm-abono-modal')) {
        const total = calcularTotalPagar(productos);
        const montoVal = Number(document.getElementById('abono-modal-monto')?.value) || 0;
        const metodoVal = document.getElementById('abono-modal-metodo')?.value || 'Efectivo';

        const totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
        const saldoRestante = total - totalAbonadoAct;

        if (montoVal <= 0) {
          showToast('El monto del abono debe ser mayor a 0', 'error');
          document.getElementById('abono-modal-monto')?.focus();
          return;
        }
        if (montoVal > saldoRestante + 0.001) {
          showToast('El abono no puede exceder el saldo pendiente del pedido', 'error');
          document.getElementById('abono-modal-monto')?.focus();
          return;
        }

        nuevoPedidoAbonos.push({ monto: montoVal, metodo_pago: metodoVal, esNuevo: true });
        isAbonoModalOpen = false;
        updateSidebarUI();
        showToast('Abono registrado', 'success');
      }

      // Cancel Abono
      if (e.target.closest('#btn-cancel-abono-modal')) {
        isAbonoModalOpen = false;
        updateSidebarUI();
      }

      // Close Abono modal on overlay click
      if (e.target.id === 'abono-form-modal') {
        isAbonoModalOpen = false;
        updateSidebarUI();
      }

      // --- NEW CLIENT MODAL ---
      // Toggle extra fields
      if (e.target.closest('#btn-toggle-extra-fields')) {
        const container = document.getElementById('extra-fields-container');
        const arrow = document.getElementById('extra-fields-arrow');
        if (container && arrow) {
          const isOpen = container.style.display !== 'none';
          container.style.display = isOpen ? 'none' : 'block';
          arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        }
        return;
      }

      if (e.target.closest('#btn-confirm-new-client')) {
        const nameInput = document.getElementById('nuevo-cliente-name');
        const phoneInput = document.getElementById('nuevo-cliente-phone');
        const nombreVal = nameInput?.value.trim();
        if (!nombreVal) {
          showToast('Ingresa el nombre del cliente', 'error');
          nameInput?.focus();
          return;
        }

        const telefonoVal = phoneInput?.value.trim() || '';
        const rucVal = document.getElementById('nuevo-cliente-ruc')?.value.trim() || '';
        const emailVal = document.getElementById('nuevo-cliente-email')?.value.trim() || '';
        const direccionVal = document.getElementById('nuevo-cliente-direccion')?.value.trim() || '';

        // Close modal and show card immediately
        isNewClientModalOpen = false;
        tempNewClientName = '';
        updateSidebarUI();

        const searchContainer = document.getElementById('cs-search-mode-container');
        if (searchContainer) searchContainer.style.display = 'none';

        const selectedChip = document.getElementById('cs-selected');
        if (selectedChip) {
          selectedChip.style.display = 'block';
          selectedChip.innerHTML = `
            <div class="cs-selected-client-row">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="cs-client-avatar">${nombreVal.charAt(0).toUpperCase()}</div>
                <div>
                  <div class="cs-client-name">${nombreVal}</div>
                  <div class="cs-client-phone">${telefonoVal || 'Sin celular'}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 2px;">
                <button type="button" class="cs-icon-btn" id="cs-chip-edit" title="Editar cliente">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button type="button" class="cs-icon-btn cs-icon-btn-remove" id="cs-chip-remove" title="Quitar cliente">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          `;
          document.getElementById('cs-chip-remove')?.addEventListener('click', () => {
            resetClienteState();
            anticiposDisponibles = [];
            anticiposAplicados = [];
            cobrosPendientesCliente = [];
            actualizarAlertaAnticipo();
            actualizarAlertaValoresPendientes();
            const inp = document.getElementById('cs-input');
            if (inp) inp.value = '';
            const sc = document.getElementById('cs-search-mode-container');
            if (sc) sc.style.display = 'block';
            if (selectedChip) selectedChip.style.display = 'none';
            const icon = document.getElementById('cs-icon');
            if (icon) icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
            setTimeout(() => inp?.focus(), 50);
          });
          document.getElementById('cs-chip-edit')?.addEventListener('click', async () => {
            tempNewClientName = `${nombreVal}\t${telefonoVal}`;
            editingClientDocId = clienteState.docId || '';
            tempEditClientExtra = {};
            if (editingClientDocId) {
              try {
                const clienteFull = await obtenerCliente(editingClientDocId);
                if (clienteFull) {
                  tempEditClientExtra = {
                    ruc: clienteFull.ruc || '',
                    email: clienteFull.email || '',
                    direccion: clienteFull.direccion || '',
                  };
                }
              } catch { /* ignore */ }
            }
            isNewClientModalOpen = true;
            updateSidebarUI();
          });
        }

        showToast('Cliente guardado y seleccionado', 'success');

        // Save to Firestore in background
        const isEditMode = !!editingClientDocId;
        try {
          const docId = await guardarCliente({
            _docId: editingClientDocId || undefined,
            nombre: nombreVal,
            telefono: telefonoVal,
            ruc: rucVal,
            email: emailVal,
            direccion: direccionVal,
          });
          clienteState.docId = docId;
          clienteState.nombre = nombreVal;
          clienteState.telefono = telefonoVal;
          clienteState.isNew = false;
          if (isEditMode) {
            showToast('Cliente actualizado', 'success');
          }
          editingClientDocId = '';
        } catch (err) {
          showToast('Error al guardar cliente: ' + err.message, 'error');
          editingClientDocId = '';
        }
      }

      if (e.target.closest('#btn-cancel-new-client') || e.target.id === 'nuevo-cliente-modal') {
        isNewClientModalOpen = false;
        tempNewClientName = '';
        editingClientDocId = '';
        updateSidebarUI();
      }
    });
  }

  // Card dropdown menus + close dropdowns — single document handler
  documentClickHandler = (e) => {
    // Resetear unificación al quitar el cliente
    if (e.target.closest('#cs-chip-remove')) {
      decisionUnificacionTomada = false;
      pedidosActivosCliente = [];
      anticiposDisponibles = [];
      anticiposAplicados = [];
      cobrosPendientesCliente = [];
      actualizarAlertaAnticipo();
      actualizarAlertaValoresPendientes();
    }

    // Toggle card dropdown
    const toggleBtn = e.target.closest('[data-card-dropdown-toggle]');
    if (toggleBtn) {
      const menuId = toggleBtn.dataset.cardDropdownToggle;
      document.querySelectorAll('.product-dropdown-menu.open').forEach(m => m.classList.remove('open'));
      const menu = document.getElementById(menuId);
      if (menu) menu.classList.toggle('open');
      return;
    }

    // Registrar abono desde indicador de saldo
    const abonoBtn = e.target.closest('.pedido-card-amount-action');
    if (abonoBtn) {
      const docId = abonoBtn.dataset.abonoPedidoId;
      const ped = allPedidos.find(p => p._docId === docId);
      if (ped) {
        showAbonoModal(ped);
      }
      return;
    }

    // Eliminar pedido
    const removeBtn = e.target.closest('[data-card-remove]');
    if (removeBtn) {
      deletePedidoId = removeBtn.dataset.cardRemove;
      closeAllDropdowns();
      updateSidebarUI();
      return;
    }

    // Editar pedido
    const editBtn = e.target.closest('[data-card-edit]');
    if (editBtn) {
      openSidebarForEdit(editBtn.dataset.cardEdit);
      return;
    }

    // Imprimir pedido
    const printBtn = e.target.closest('[data-card-print]');
    if (printBtn) {
      const docId = printBtn.dataset.cardPrint;
      const groupedList = agruparPedidos(allPedidos);
      const ped = groupedList.find(p => p._docId === docId || (p.isGrupo && p.pedidos.some(sub => sub._docId === docId)));
      if (ped) {
        imprimirRecibo(ped);
      } else {
        showToast('Error: No se pudo encontrar los detalles del pedido', 'error');
      }
      return;
    }

    // Close dropdowns on any click outside the menu
    if (!e.target.closest('.product-dropdown')) {
      closeAllDropdowns();
    }
    if (!e.target.closest('.filter-dropdown')) {
      const filterMenu = document.getElementById('filter-dropdown-menu');
      if (filterMenu) filterMenu.style.display = 'none';
    }
  };
  document.addEventListener('click', documentClickHandler);

  // Product list events and Payment toggling via delegation on sidebar-body
  const sidebarBody = document.getElementById('sidebar-body');
  if (sidebarBody) {

    sidebarBody.addEventListener('click', (e) => {
      // Toggle product dropdown menu
      const toggleBtn = e.target.closest('[data-dropdown-toggle]');
      if (toggleBtn) {
        const menuId = toggleBtn.dataset.dropdownToggle;
        closeAllDropdowns();
        const menu = document.getElementById(menuId);
        if (menu) menu.classList.toggle('open');
        return;
      }

      // Edit Product from List
      const editBtn = e.target.closest('[data-edit-index]');
      if (editBtn) {
        const index = parseInt(editBtn.dataset.editIndex);
        currentProductIndex = index;
        tempProduct = { ...productos[index] };
        isFormOpen = true;
        existingTipos = [];
        savedProducts = [];
        updateSidebarUI();
        Promise.all([obtenerTiposProducto(), obtenerProductosGuardados()]).then(([tiposFromFirestore, saved]) => {
          const sessionTipos = [...new Set(productos.map(p => p.producto_tipo).filter(Boolean))];
          existingTipos = [...new Set([...tiposFromFirestore, ...sessionTipos])].sort();
          savedProducts = saved;
          const datalist = document.getElementById('tipo-datalist');
          if (datalist) datalist.innerHTML = existingTipos.map(t => `<option value="${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}">`).join('');
        }).catch(() => {});
      }

      // Remove Product from List
      const removeBtn = e.target.closest('[data-remove-index]');
      if (removeBtn) {
        const index = parseInt(removeBtn.dataset.removeIndex);
        productos.splice(index, 1);
        const newTotal = calcularTotalPagar(productos);
        
        let totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
        if (totalAbonadoAct > newTotal) {
          let acumulado = 0;
          const abonosAjustados = [];
          for (const ab of nuevoPedidoAbonos) {
            if (acumulado + ab.monto <= newTotal) {
              abonosAjustados.push(ab);
              acumulado += ab.monto;
            } else {
              const restante = newTotal - acumulado;
              if (restante > 0) {
                abonosAjustados.push({ monto: restante, metodo_pago: ab.metodo_pago });
                acumulado += restante;
              }
              break;
            }
          }
          nuevoPedidoAbonos = abonosAjustados;
        }
        updateSidebarUI();
        updateTotals();
        showToast('Producto eliminado', 'info');
      }

      // Eliminar abono individual
      const removeAbonoBtn = e.target.closest('.btn-remove-abono-item');
      if (removeAbonoBtn) {
        const index = parseInt(removeAbonoBtn.dataset.index);
        nuevoPedidoAbonos.splice(index, 1);
        updateSidebarUI();
        showToast('Abono eliminado', 'info');
        return;
      }

      // Registrar pago (abre modal de abono parcial)
      if (e.target.closest('#btn-registrar-pago')) {
        const total = calcularTotalPagar(productos);
        if (total <= 0) {
          showToast('Agrega productos al pedido antes de registrar un abono', 'error');
          return;
        }
        const totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
        const saldoRestante = total - totalAbonadoAct;
        if (saldoRestante <= 0.001) {
          showToast('El pedido ya está cubierto por completo', 'info');
          return;
        }
        isAbonoModalOpen = true;
        updateSidebarUI();
        return;
      }

      // Pagar todo con método rápido (Efectivo, Transferencia, Tarjeta)
      const pagarRapidoBtn = e.target.closest('.btn-pagar-rapido');
      if (pagarRapidoBtn) {
        const metodo = pagarRapidoBtn.dataset.metodo;
        const total = calcularTotalPagar(productos);
        if (total <= 0) {
          showToast('Agrega productos al pedido antes de realizar el pago', 'error');
          return;
        }
        const totalAbonadoAct = nuevoPedidoAbonos.reduce((sum, ab) => sum + Number(ab.monto), 0);
        const saldoRestante = Math.max(0, total - totalAbonadoAct);
        if (saldoRestante <= 0.001) {
          showToast('El pedido ya está cubierto por completo', 'info');
          return;
        }
        nuevoPedidoAbonos.push({ monto: Number(saldoRestante.toFixed(2)), metodo_pago: metodo, esNuevo: true });
        updateSidebarUI();
        showToast(`Pedido saldado con ${metodo}`, 'success');
        return;
      }
    });
  }

  // Save button
  document.getElementById('btn-save-print')?.addEventListener('click', () => {
    shouldPrintOnSave = true;
    handleSave();
  });
  document.getElementById('btn-save-only')?.addEventListener('click', () => {
    shouldPrintOnSave = false;
    handleSave();
  });

  // Filter dropdown listeners
  const filterToggle = document.getElementById('btn-filter-toggle');
  const filterMenu = document.getElementById('filter-dropdown-menu');

  filterToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (filterMenu) {
      filterMenu.style.display = filterMenu.style.display === 'none' ? 'block' : 'none';
    }
  });

  filterMenu?.addEventListener('click', (e) => {
    const item = e.target.closest('.filter-dropdown-item');
    if (!item) return;

    filterMenu.querySelectorAll('.filter-dropdown-item').forEach(c => c.classList.remove('active'));
    item.classList.add('active');

    filtroActivo = item.dataset.filter;
    renderFilteredList();
    filterMenu.style.display = 'none';
  });

  // Search
  let debounce;
  document.getElementById('search-pedidos')?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderFilteredList, 280);
  });

  // Load data
  loadPedidos();
}

function handleEsc(e) {
  if (e.key === 'Escape') {
    if (deletePedidoId) {
      deletePedidoId = '';
      updateSidebarUI();
      e.stopPropagation();
      e.preventDefault();
    } else if (isFormOpen) {
      isFormOpen = false;
      currentProductIndex = null;
      tempProduct = null;
      updateSidebarUI();
      e.stopPropagation();
      e.preventDefault();
    } else if (isAbonoModalOpen) {
      isAbonoModalOpen = false;
      updateSidebarUI();
      e.stopPropagation();
      e.preventDefault();
    } else if (isNewClientModalOpen) {
  isNewClientModalOpen = false;
  tempNewClientName = '';
  editingClientDocId = '';
  tempEditClientExtra = {};
      updateSidebarUI();
      e.stopPropagation();
      e.preventDefault();
    } else if (sidebarOpen) {
      closeSidebar();
    }
  }
}

function updateTotals() {
  const box = document.getElementById('totals-box');
  if (box) box.innerHTML = renderTotalsHTML();
  updateSidebarUI();
}

async function handleSave(confirmacionOmitida = false) {
  if (saving) return;

  // Read selected client autocomplete state
  if (!clienteState.nombre || !clienteState.nombre.trim()) {
    showToast('Selecciona o crea un cliente para continuar', 'error');
    document.getElementById('cs-input')?.focus();
    return;
  }

  if (productos.length === 0) {
    showToast('Debe agregar al menos un producto o servicio para guardar el pedido', 'error');
    isFormOpen = true;
    currentProductIndex = null;
    tempProduct = createEmptyProduct();
    updateSidebarUI();
    return;
  }

  // Si no es edición y no se ha tomado la decisión
  if (!editingPedidoId && !decisionUnificacionTomada) {
    try {
      const btn = document.getElementById('btn-save-print');
      const btnSaveOnly = document.getElementById('btn-save-only');
      if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Verificando...'; }
      if (btnSaveOnly) { btnSaveOnly.disabled = true; }
      
      const activos = await obtenerPedidosActivosCliente(clienteState.docId);
      
      if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar e Imprimir'; }
      if (btnSaveOnly) { btnSaveOnly.disabled = false; }

      if (activos.length > 0) {
        pedidosActivosCliente = activos;
        isUnificarModalOpen = true;
        unificarAbiertoAlGuardar = true;
        updateSidebarUI();
        return;
      }
    } catch (err) {
      console.error("Error comprobando pedidos activos:", err);
    }
  }

  const abonosFinales = nuevoPedidoAbonos.map(ab => ({ ...ab, monto: Number(ab.monto) }));
  const notas = document.getElementById('pedido-notas')?.value || '';
  const copiaproductos = [...productos];
  const copiacliente = {
    docId: clienteState.docId,
    nombre: clienteState.nombre,
    telefono: clienteState.telefono,
    isNew: clienteState.isNew
  };
  const copiaAnticiposAplicados = [...anticiposAplicados];
  const copiaPedidosActivosCliente = [...pedidosActivosCliente];
  const isEditMode = !!editingPedidoId;
  const targetEditingPedidoId = editingPedidoId;

  // Crear pedido optimista para actualización inmediata en UI
  let grupo_id = null;
  if (!isEditMode && copiaPedidosActivosCliente.length > 0) {
    const targetActivo = copiaPedidosActivosCliente[0];
    grupo_id = targetActivo.grupo_id || targetActivo._docId || targetActivo.id;
  }

  const optimisticPedido = {
    _docId: isEditMode ? targetEditingPedidoId : 'optimistic-' + Date.now(),
    id_pedido: isEditMode ? (allPedidos.find(p => p._docId === targetEditingPedidoId)?.id_pedido || '...') : '...',
    cliente_nombre: copiacliente.nombre.trim().toUpperCase(),
    cliente_telefono: copiacliente.telefono,
    cliente_id: copiacliente.docId || 'temp-id',
    productos: copiaproductos.map(p => ({
      id_producto: p.id_producto || 'temp-prod-id',
      producto_tipo: p.producto_tipo,
      cantidad: Number(p.cantidad) || 1,
      precio_unitario: Number(p.precio_unitario) || 0,
      detalle_personalizado: p.detalle_personalizado,
      subtotal: (Number(p.cantidad) || 1) * (Number(p.precio_unitario) || 0)
    })),
    abonos: abonosFinales,
    total_pagar: copiaproductos.reduce((sum, p) => sum + ((Number(p.cantidad) || 1) * (Number(p.precio_unitario) || 0)), 0),
    total_abonado: abonosFinales.reduce((sum, ab) => sum + ab.monto, 0),
    saldo_pendiente: Math.max(0, copiaproductos.reduce((sum, p) => sum + ((Number(p.cantidad) || 1) * (Number(p.precio_unitario) || 0)), 0) - abonosFinales.reduce((sum, ab) => sum + ab.monto, 0)),
    estado_pago: abonosFinales.reduce((sum, ab) => sum + ab.monto, 0) >= copiaproductos.reduce((sum, p) => sum + ((Number(p.cantidad) || 1) * (Number(p.precio_unitario) || 0)), 0) ? 'PAGADO' : (abonosFinales.reduce((sum, ab) => sum + ab.monto, 0) > 0 ? 'PARCIAL' : 'SIN PAGO'),
    estado_produccion: isEditMode ? (allPedidos.find(p => p._docId === targetEditingPedidoId)?.estado_produccion || 'PENDIENTE') : 'PENDIENTE',
    fecha_creacion: {
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000)
    },
    notas,
    grupo_id: isEditMode ? (allPedidos.find(p => p._docId === targetEditingPedidoId)?.grupo_id || null) : grupo_id,
    isOptimistic: true
  };

  const originalAllPedidos = [...allPedidos];

  // Insertar u optimizar en la lista local
  if (isEditMode) {
    const idx = allPedidos.findIndex(p => p._docId === targetEditingPedidoId);
    if (idx !== -1) {
      allPedidos[idx] = optimisticPedido;
    }
  } else {
    allPedidos = [optimisticPedido, ...allPedidos];
  }

  // Renderizar la lista con el pedido optimista de inmediato
  renderFilteredList();

  // Cerrar y restablecer la barra lateral inmediatamente para mayor fluidez
  closeSidebar();
  resetSidebar();

  showToast(isEditMode ? 'Actualizando pedido...' : 'Guardando pedido...', 'info');

  // Ejecución en segundo plano
  (async () => {
    try {
      if (isEditMode) {
        await actualizarPedido(targetEditingPedidoId, {
          productos: copiaproductos,
          notas,
          abonos: abonosFinales,
          usuario: getCurrentUserProfile()
        });
        showToast('Pedido actualizado', 'success');
      } else {
        const savedPedido = await crearPedido({
          cliente: copiacliente,
          productos: copiaproductos,
          abonosIniciales: abonosFinales,
          notas,
          usuario: getCurrentUserProfile(),
          grupo_id,
          anticiposAplicados: copiaAnticiposAplicados
        });

        // Si el pedido activo original al que nos unificamos no tenía un grupo_id asignado, lo actualizamos.
        if (grupo_id && copiaPedidosActivosCliente.length > 0) {
          const targetActivo = copiaPedidosActivosCliente[0];
          if (!targetActivo.grupo_id) {
            await actualizarGrupoPedido(targetActivo._docId, grupo_id);
          }
        }

        showToast('Pedido creado', 'success');

        if (shouldPrintOnSave && savedPedido) {
          if (savedPedido.grupo_id) {
            try {
              const activosDelGrupo = await obtenerPedidosActivosCliente(copiacliente.docId);
              const grupoPedidos = activosDelGrupo.filter(p => p.grupo_id === savedPedido.grupo_id || p._docId === savedPedido.grupo_id);
              
              if (grupoPedidos.length > 0) {
                const principal = grupoPedidos.find(p => p._docId === savedPedido.grupo_id) || grupoPedidos[0];
                const grupoObj = {
                  isGrupo: true,
                  grupo_id: savedPedido.grupo_id,
                  cliente_nombre: savedPedido.cliente_nombre,
                  cliente_telefono: savedPedido.cliente_telefono,
                  pedidos: grupoPedidos,
                  fecha_creacion: principal.fecha_creacion
                };
                imprimirReciboDirecto(grupoObj);
              } else {
                imprimirReciboDirecto(savedPedido);
              }
            } catch (err) {
              console.warn('Error al imprimir recibo de grupo, imprimiendo individual:', err);
              imprimirReciboDirecto(savedPedido);
            }
          } else {
            imprimirReciboDirecto(savedPedido);
          }
        }
      }
    } catch (err) {
      // Revertir lista a su estado original si falla
      allPedidos = originalAllPedidos;
      renderFilteredList();
      showToast('Error al guardar: ' + err.message, 'error');
    }
  })();
}



// Cleanup function (called on route change)
export function cleanupPedidos() {
  document.removeEventListener('keydown', handleEsc);
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }
  document.body.style.overflow = '';
  if (unsubscribePedidos) {
    unsubscribePedidos();
    unsubscribePedidos = null;
  }
}

function updateModalSubtotal(sub) {
  const displayEl = document.getElementById('temp-product-subtotal');
  const amountEl = document.getElementById('temp-subtotal-display');
  
  if (displayEl && amountEl) {
    if (sub > 0) {
      displayEl.style.display = 'block';
      amountEl.textContent = formatCurrency(sub);
    } else {
      displayEl.style.display = 'none';
    }
  }
}

function renderUnificarModal(pedidosActivos) {
  const listaPedidos = pedidosActivos.map(p => `#${p.id_pedido}`).join(', ');
  return `
    <div class="modal-overlay" id="unificar-pedido-modal" style="display: flex;">
      <div class="modal-card" style="margin: auto; max-width: 400px; width: 100%;">
        <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Unificar Pedido</div>
        
        <div style="margin: 16px 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">
          El cliente tiene pedidos activos (${listaPedidos}). ¿Deseas unificar esta nueva orden dentro de la misma tarjeta?
        </div>

        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-no-unificar" style="flex: 1;">Crear separado</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-unificar" style="flex: 1;">Unificar</button>
        </div>
      </div>
    </div>
  `;
}
