import { db } from '../firebase.js';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { formatCurrency, formatDateShort } from '../utils/formatters.js';
import { showAbonoModal } from '../components/abonoForm.js';
import { showToast } from '../main.js';

let unsubscribeCobros = null;
let allCobros = [];
let sortOrder = 'antiguo'; // 'antiguo' o 'reciente'

/**
 * Renders the Por cobrar page HTML structure and local CSS styles
 */
export function renderPorCobrar() {
  allCobros = [];
  return `
    <style>
      .cobros-summary-card {
        background: var(--bg-card);
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        padding: 16px 20px;
        margin-bottom: 20px;
        display: inline-flex;
        flex-direction: column;
        min-width: 220px;
        box-shadow: var(--shadow-sm);
        border-left: 4px solid var(--accent);
      }
      .summary-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .summary-value {
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--accent);
        font-family: var(--font-mono);
      }
      .cobros-card {
        background: var(--bg-card);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        margin-top: 16px;
        overflow-x: auto;
        border: 1px solid var(--border);
      }
      .cobros-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        text-align: left;
      }
      .cobros-table th {
        background: #fafafa;
        color: var(--text-secondary);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        padding: 14px 18px;
        border-bottom: 1.5px solid var(--border);
      }
      .cobros-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .cobros-table tr:hover td {
        background: var(--bg-card-hover);
      }
      .cobros-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
        align-items: center;
      }
      .badge-saldo {
        font-weight: 700;
        color: var(--danger-text);
        background: var(--danger-subtle);
        padding: 2px 6px;
        border-radius: var(--radius-xs);
        font-size: 0.8rem;
        font-family: var(--font-mono);
      }
      .badge-abonado {
        font-weight: 500;
        color: var(--success-text);
        background: var(--success-subtle);
        padding: 2px 6px;
        border-radius: var(--radius-xs);
        font-size: 0.8rem;
        font-family: var(--font-mono);
      }
      .currency-value {
        font-family: var(--font-mono);
        font-size: 0.85rem;
      }
      .wa-button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        background: #eafaf1;
        color: #15803d;
        border: 1px solid #bbf7d0;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        transition: background var(--t-fast);
      }
      .wa-button-icon:hover {
        background: #dcfce7;
      }
      .btn-action-icon {
        width: 32px;
        height: 32px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .search-filter-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 16px;
      }
      .search-filter-row .search-wrap {
        flex: 1;
        min-width: 250px;
      }
      .filter-select-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    </style>

    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Por cobrar</h1>
        </div>
      </div>

      <!-- Resumen de valores pendientes (Se actualiza dinámicamente) -->
      <div id="cobros-summary-container">
        <div class="cobros-summary-card">
          <span class="summary-label">Total por cobrar</span>
          <span class="summary-value" id="summary-total-pendiente">$0.00</span>
        </div>
      </div>

      <div class="search-filter-row">
        <!-- Buscador -->
        <div class="search-wrap">
          <span class="search-icon">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input type="text" class="search-input" id="search-cobros" placeholder="Buscar por ID o cliente..." autocomplete="off" />
        </div>

        <!-- Filtro de ordenación -->
        <div class="filter-select-wrap">
          <select class="form-select" id="sort-cobros-select" style="width: auto;">
            <option value="antiguo" ${sortOrder === 'antiguo' ? 'selected' : ''}>Más antiguos primero</option>
            <option value="reciente" ${sortOrder === 'reciente' ? 'selected' : ''}>Más recientes primero</option>
          </select>
        </div>
      </div>

      <div id="cobros-content">
        <div class="loading-center">
          <div class="spinner spinner-lg"></div>
          <span>Cargando pedidos pendientes...</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Binds page events and initializes data listeners
 */
export function bindPorCobrarEvents() {
  const selectSort = document.getElementById('sort-cobros-select');
  const searchInput = document.getElementById('search-cobros');

  selectSort?.addEventListener('change', (e) => {
    sortOrder = e.target.value;
    renderCobrosList();
  });

  let debounce;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      renderCobrosList();
    }, 250);
  });

  const devBypass = localStorage.getItem('dev_bypass') === 'true';

  if (devBypass) {
    // Modo bypass desarrollo: Datos mockeados
    const mockPedidos = [
      {
        _docId: 'mock-p-101',
        id_pedido: '101',
        cliente_nombre: 'María José López',
        cliente_telefono: '0987654321',
        fecha_creacion: Timestamp.fromDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)), // Hace 10 días
        fecha_entrega: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),  // Hace 5 días
        estado_produccion: 'ENTREGADO',
        estado_pago: 'CON ABONO',
        total_pagar: 140.00,
        total_abonado: 60.00,
        saldo_pendiente: 80.00,
        productos: [{ producto_tipo: 'Tazas personalizadas', cantidad: 20 }]
      },
      {
        _docId: 'mock-p-102',
        id_pedido: '102',
        cliente_nombre: 'Santiago Torres',
        cliente_telefono: '0999876543',
        fecha_creacion: Timestamp.fromDate(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)), // Hace 15 días
        fecha_entrega: Timestamp.fromDate(new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)), // Hace 12 días
        estado_produccion: 'ENTREGADO',
        estado_pago: 'SIN PAGO',
        total_pagar: 320.00,
        total_abonado: 0.00,
        saldo_pendiente: 320.00,
        productos: [{ producto_tipo: 'Letrero Acrílico', cantidad: 1 }]
      },
      {
        _docId: 'mock-p-103',
        id_pedido: '103',
        cliente_nombre: 'Gabriela Cevallos',
        cliente_telefono: '0990001112',
        fecha_creacion: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),  // Hace 2 días
        fecha_entrega: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),   // Hace 1 día
        estado_produccion: 'ENTREGADO',
        estado_pago: 'CON ABONO',
        total_pagar: 95.00,
        total_abonado: 50.00,
        saldo_pendiente: 45.00,
        productos: [{ producto_tipo: 'Vinil decorativo', cantidad: 3 }]
      }
    ];

    allCobros = mockPedidos;
    renderCobrosList();
  } else {
    // Base de datos real: Escuchar pedidos en tiempo real
    const q = query(
      collection(db, 'pedidos'),
      where('estado_produccion', '==', 'ENTREGADO')
    );

    unsubscribeCobros = onSnapshot(q, (snap) => {
      allCobros = snap.docs
        .map(d => ({ _docId: d.id, ...d.data() }))
        .filter(p => p.saldo_pendiente > 0.001); // Filtrar solo los que tienen saldo pendiente > 0
      renderCobrosList();
    }, (err) => {
      console.error('Error al escuchar cobros:', err);
      const content = document.getElementById('cobros-content');
      if (content) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-title">Error al cargar</div>
            <div class="empty-msg">${err.message}</div>
          </div>
        `;
      }
    });
  }
}

/**
 * Clears listeners and state when leaving the page
 */
export function cleanupPorCobrar() {
  if (unsubscribeCobros) {
    unsubscribeCobros();
    unsubscribeCobros = null;
  }
  allCobros = [];
}

/**
 * Filter, sort, and render the orders list into the table
 */
function renderCobrosList() {
  // Actualizar la suma total por cobrar en la UI
  const summaryTotalEl = document.getElementById('summary-total-pendiente');
  const totalPendiente = allCobros.reduce((acc, p) => acc + (p.saldo_pendiente || 0), 0);
  if (summaryTotalEl) {
    summaryTotalEl.textContent = formatCurrency(totalPendiente);
  }

  const content = document.getElementById('cobros-content');
  if (!content) return;

  const searchInput = document.getElementById('search-cobros');
  const term = (searchInput?.value || '').trim().toLowerCase();

  // 1. Filtrar por buscador
  let filtered = allCobros.filter(p => {
    if (!term) return true;
    return (p.id_pedido || '').toLowerCase().includes(term) ||
           (p.cliente_nombre || '').toLowerCase().includes(term);
  });

  // 2. Ordenar por fecha_creacion (antiguo a reciente o reciente a antiguo)
  filtered.sort((a, b) => {
    const tA = a.fecha_creacion?.seconds || 0;
    const tB = b.fecha_creacion?.seconds || 0;
    return sortOrder === 'antiguo' ? tA - tB : tB - tA;
  });

  if (filtered.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Sin cobros pendientes</div>
        <div class="empty-msg">${term ? `No hay pedidos que coincidan con "${term}"` : '¡Todos los pedidos entregados están al día!'}</div>
      </div>
    `;
    return;
  }

  // Renderizar la tabla
  content.innerHTML = `
    <div class="cobros-card">
      <table class="cobros-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Fecha Entrega</th>
            <th>Total</th>
            <th>Abonado</th>
            <th>Pendiente</th>
            <th style="width: 100px; text-align: center;">Acciones</th>
          </tr>
        </thead>
        <tbody id="cobros-table-body">
          ${filtered.map(p => {
            const fechaEntrega = p.fecha_entrega 
              ? formatDateShort(p.fecha_entrega) 
              : (p.fecha_creacion ? formatDateShort(p.fecha_creacion) : '-');

            // Limpiar teléfono para WhatsApp: quitar todo lo que no sea dígito
            const telLimpio = (p.cliente_telefono || '').replace(/\D/g, '');
            const waMessage = encodeURIComponent(`Hola ${p.cliente_nombre}, te saludamos de Casa Gráfica. Te escribimos para recordarte que el pedido #${p.id_pedido} ya fue entregado y tiene un saldo pendiente de ${formatCurrency(p.saldo_pendiente)}. Quedamos a la espera de tu pago. ¡Muchas gracias!`);
            const waLink = `https://wa.me/${telLimpio}?text=${waMessage}`;

            return `
              <tr data-id="${p._docId}">
                <td style="font-weight: 700; color: var(--accent); font-family: var(--font-mono);">${p.id_pedido}</td>
                <td>
                  <div style="font-weight: 600;">${p.cliente_nombre}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">${p.cliente_telefono || 'Sin teléfono'}</div>
                </td>
                <td>${fechaEntrega}</td>
                <td class="currency-value">${formatCurrency(p.total_pagar)}</td>
                <td>
                  <span class="badge-abonado">${formatCurrency(p.total_abonado)}</span>
                </td>
                <td>
                  <span class="badge-saldo">${formatCurrency(p.saldo_pendiente)}</span>
                </td>
                <td>
                  <div class="cobros-actions">
                    <button class="btn btn-primary btn-sm btn-action-icon btn-registrar-abono" data-id="${p._docId}" title="Registrar Abono">
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                    </button>
                    ${telLimpio ? `
                      <a href="${waLink}" target="_blank" class="wa-button-icon" title="Enviar WhatsApp a ${p.cliente_nombre}">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                      </a>
                    ` : `
                      <div style="width: 32px; height: 32px;"></div>
                    `}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind individual row buttons
  content.querySelectorAll('.btn-registrar-abono').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const docId = e.currentTarget.getAttribute('data-id');
      const pedidoObj = allCobros.find(p => p._docId === docId);
      if (pedidoObj) {
        // En modo bypass de desarrollo, mockear la actualización en memoria
        const devBypass = localStorage.getItem('dev_bypass') === 'true';
        if (devBypass) {
          // Crear un flujo local de entrada de datos simulando el modal
          const inputMonto = prompt(`Ingresar abono para Pedido ${pedidoObj.id_pedido} (Saldo pendiente: ${formatCurrency(pedidoObj.saldo_pendiente)}):`, pedidoObj.saldo_pendiente);
          if (inputMonto === null) return;
          const monto = Number(inputMonto);
          if (isNaN(monto) || monto <= 0 || monto > pedidoObj.saldo_pendiente) {
            showToast('Monto de abono inválido', 'error');
            return;
          }
          
          pedidoObj.total_abonado += monto;
          pedidoObj.saldo_pendiente -= monto;
          if (pedidoObj.saldo_pendiente <= 0.001) {
            allCobros = allCobros.filter(p => p._docId !== docId);
          }
          showToast(`Pago de ${formatCurrency(monto)} registrado (Bypass)`, 'success');
          renderCobrosList();
        } else {
          // Producción: Usar el modal existente
          showAbonoModal(pedidoObj, () => {
            // El onSnapshot recargará la lista automáticamente
          });
        }
      }
    });
  });
}
