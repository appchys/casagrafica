import { renderPedidoCard } from '../components/pedidoCard.js';
import { renderAbonoModal } from '../components/abonoForm.js';
import {
  buscarPedidos, obtenerPedido, agregarAbono,
  actualizarEstadoProduccion, escucharPedido, escucharPedidosRecientes
} from '../services/pedidos.service.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { imprimirRecibo } from '../services/print.service.js';
import { showToast, getCurrentUserProfile } from '../main.js';

let unsubscribe = null;

/**
 * Render Taller & Entrega page
 */
export function renderTaller(initialDocId) {
  return `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Taller & Entrega</h1>
          <p class="page-subtitle">Producción y control de entrega</p>
        </div>
      </div>

      <!-- Search -->
      <div class="taller-search-row">
        <div class="search-wrap" style="flex:1;">
          <span class="search-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
          <input type="text" class="search-input" id="search-taller"
            placeholder="Buscar por ID o nombre del cliente..." autocomplete="off" />
        </div>
        <button class="btn btn-secondary" id="btn-ver-todos">Ver todos</button>
      </div>

      <!-- Content area -->
      <div id="taller-content">
        <div class="loading-center">
          <div class="spinner spinner-lg"></div>
          <span>Cargando pedidos...</span>
        </div>
      </div>
    </div>
  `;
}

export function bindTallerEvents(initialDocId) {
  // Search
  let debounce;
  document.getElementById('search-taller')?.addEventListener('input', (e) => {
    clearTimeout(debounce);
    const term = e.target.value.trim();
    debounce = setTimeout(() => {
      if (term.length >= 2) doSearch(term);
      else if (term.length === 0) loadRecent();
    }, 300);
  });

  document.getElementById('btn-ver-todos')?.addEventListener('click', () => {
    const input = document.getElementById('search-taller');
    if (input) input.value = '';
    loadRecent();
  });

  // If arriving from a card click, load that pedido directly
  if (initialDocId) {
    openDetail(initialDocId);
  } else {
    loadRecent();
  }
}

export function cleanupTaller() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

// ── Data loading ──

async function loadRecent() {
  const content = document.getElementById('taller-content');
  if (!content) return;

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  content.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div><span>Cargando pedidos...</span></div>`;

  try {
    unsubscribe = escucharPedidosRecientes(20, (pedidos) => {
      showList(pedidos);
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--danger-text);"><svg class="icon icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div><div class="empty-title">Error al cargar</div><div class="empty-msg">${err.message}</div></div>`;
  }
}

async function doSearch(term) {
  const content = document.getElementById('taller-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div><span>Buscando...</span></div>`;

  try {
    const results = await buscarPedidos(term);
    showList(results, term);
  } catch (err) {
    showToast('Error en búsqueda: ' + err.message, 'error');
  }
}

function showList(pedidos, searchTerm = '') {
  const content = document.getElementById('taller-content');
  if (!content) return;

  if (pedidos.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--text-tertiary);"><svg class="icon icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
        <div class="empty-title">Sin resultados</div>
        <div class="empty-msg">${searchTerm ? `No hay pedidos para "${searchTerm}"` : 'No hay pedidos aún'}</div>
      </div>`;
    return;
  }

  // Group by status
  const pendientes = pedidos.filter(p => p.estado_produccion === 'PENDIENTE');
  const enProceso  = pedidos.filter(p => p.estado_produccion === 'EN PROCESO');
  const entregados = pedidos.filter(p => p.estado_produccion === 'ENTREGADO');

  content.innerHTML = `
    <div style="margin-bottom:12px; font-size:0.8rem; color:var(--text-tertiary);">
      ${pedidos.length} pedido(s) — Haz clic en una tarjeta para ver el detalle
    </div>
    
    <div class="taller-columns">
      <!-- Columna Pendientes -->
      <div class="taller-column">
        <div class="taller-column-header">
          <span class="taller-column-title">Pendientes</span>
          <span class="taller-column-count">${pendientes.length}</span>
        </div>
        <div class="taller-column-body">
          ${pendientes.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>

      <!-- Columna En Proceso -->
      <div class="taller-column">
        <div class="taller-column-header">
          <span class="taller-column-title">En proceso</span>
          <span class="taller-column-count">${enProceso.length}</span>
        </div>
        <div class="taller-column-body">
          ${enProceso.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>

      <!-- Columna Entregadas -->
      <div class="taller-column">
        <div class="taller-column-header">
          <span class="taller-column-title">Entregadas</span>
          <span class="taller-column-count">${entregados.length}</span>
        </div>
        <div class="taller-column-body">
          ${entregados.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>
    </div>
  `;

  content.querySelectorAll('.pedido-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const printBtn = e.target.closest('[data-card-print]');
      if (printBtn) {
        const docId = printBtn.dataset.cardPrint;
        const ped = pedidos.find(p => p._docId === docId);
        if (ped) {
          imprimirRecibo(ped);
        }
        return;
      }

      // Check if action button was clicked
      const actionBtn = e.target.closest('.taller-card-action');
      if (actionBtn) {
        const docId = actionBtn.dataset.docId;
        const action = actionBtn.dataset.tallerAction;
        const ped = pedidos.find(p => p._docId === docId);
        if (ped) {
          handleCardAction(ped, action);
        }
        return;
      }

      history.pushState(null, '', `/taller/${card.dataset.docId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}

// ── Pedido Detail ──

async function openDetail(docId) {
  if (!docId) return;
  const content = document.getElementById('taller-content');
  if (!content) return;

  content.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div><span>Cargando pedido...</span></div>`;

  // Stop previous listener
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  try {
    const pedido = await obtenerPedido(docId);
    if (!pedido) { showToast('Pedido no encontrado', 'error'); loadRecent(); return; }

    renderDetail(pedido);

    // Real-time updates
    unsubscribe = escucharPedido(docId, (updated) => {
      renderDetail(updated);
    });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    loadRecent();
  }
}

function renderDetail(pedido) {
  const content = document.getElementById('taller-content');
  if (!content) return;

  const isPaid = pedido.saldo_pendiente <= 0;
  const isEntregado = pedido.estado_produccion === 'ENTREGADO';
  const estados = ['PENDIENTE', 'EN PROCESO', 'ENTREGADO'];

  const productRows = pedido.productos.map((p, i) => `
    <tr>
      <td style="font-weight:700; color:var(--text-tertiary);">${i + 1}</td>
      <td>
        <div style="font-weight:700; color:var(--accent);">${p.producto_tipo}</div>
        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">${p.detalle_personalizado}</div>
      </td>
      <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">${p.cantidad}</td>
      <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(p.precio_unitario)}</td>
      <td style="text-align:right; font-family:var(--font-mono); font-weight:800;">${formatCurrency(p.subtotal)}</td>
    </tr>
  `).join('');


  content.innerHTML = `
    <!-- Back -->
    <button class="btn btn-ghost btn-sm" id="btn-back-taller" style="margin-bottom:16px;">
      ← Volver
    </button>

    <div class="taller-detail-layout">

      <!-- Left column -->
      <div style="display:flex; flex-direction:column; gap:14px;">

        <!-- Order header -->
        <div class="card card-padded">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-family:var(--font-mono); font-size:1.1rem; font-weight:800; color:var(--accent);">${pedido.id_pedido}</span>
                <button type="button" class="btn-print-card" id="btn-print-detail" title="Imprimir Recibo">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                </button>
              </div>
              <div style="font-size:1.2rem; font-weight:800;">${pedido.cliente_nombre}</div>
              ${pedido.cliente_telefono ? `<div style="color:var(--text-tertiary); font-size:0.85rem; margin-top:2px; display:flex; align-items:center; gap:6px;"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> ${pedido.cliente_telefono}</div>` : ''}
              <div style="color:var(--text-tertiary); font-size:0.78rem; margin-top:4px;">${formatDate(pedido.fecha_creacion)}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
              <span class="badge badge-${pedido.estado_pago.toLowerCase().replace(' ', '-')}">${pedido.estado_pago}</span>
              <span class="badge badge-${pedido.estado_produccion.toLowerCase().replace(' ', '-')}">${pedido.estado_produccion}</span>
            </div>
          </div>
        </div>

        <!-- Products -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Productos</span>
          </div>
          <div style="overflow-x: auto; padding: 0 4px;">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto / Detalle</th>
                  <th style="text-align:center;">Cant.</th>
                  <th style="text-align:right;">P.Unit.</th>
                  <th style="text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
          </div>
        </div>

        ${pedido.notas ? `
          <div class="card card-padded">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:8px;">Notas</div>
            <p style="color:var(--text-secondary); font-size:0.9rem;">${pedido.notas}</p>
          </div>
        ` : ''}

        <!-- Estado de producción -->
        <div class="card card-padded">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:10px;">Estado de Producción</div>
          <div class="estado-tabs">
            ${estados.map(e => `
              <button class="estado-tab ${pedido.estado_produccion === e ? 'active' : ''}" data-estado="${e}">${e}</button>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- Right column -->
      <div style="display:flex; flex-direction:column; gap:14px;">

        ${isPaid ? '' : `
          <div class="alert-blocked">
            <div class="alert-blocked-label"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Saldo pendiente</div>
            <div class="alert-blocked-amount">${formatCurrency(pedido.saldo_pendiente)}</div>
            <div class="alert-blocked-msg">No se puede entregar sin pago total</div>
            <button class="btn btn-danger-outline btn-sm" id="btn-add-abono" style="margin-top:14px;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Registrar abono
            </button>
          </div>
        `}

        <!-- Financial summary -->
        <div class="card card-padded">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:12px;">Resumen financiero</div>
          <div class="totals-box" style="margin-top:0;">
            <div class="totals-row">
              <span>Total</span>
              <span class="totals-val">${formatCurrency(pedido.total_pagar)}</span>
            </div>
            <div class="totals-row">
              <span>Abonado</span>
              <span class="totals-val" style="color:var(--success-text);">${formatCurrency(pedido.total_abonado)}</span>
            </div>
            <div class="totals-row main">
              <span>Saldo</span>
              <span class="totals-val ${pedido.saldo_pendiente > 0 ? 'totals-saldo-due' : 'totals-saldo-paid'}">${pedido.saldo_pendiente > 0 ? formatCurrency(pedido.saldo_pendiente) : 'Pagado'}</span>
            </div>
          </div>
        </div>



        <!-- Historial de cambios -->
        ${pedido.historial_estados && pedido.historial_estados.length > 0 ? `
          <div class="card card-padded" style="margin-bottom:14px;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:12px;">Historial de Estados</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:0.8rem; max-height:220px; overflow-y:auto; padding-right:4px;">
              ${pedido.historial_estados.map(h => {
                const dateStr = formatDate(h.fecha);
                const userStr = h.usuario ? h.usuario.nombre : 'Sistema';
                let desc = `Cambio de estado a ${h.estado_nuevo}`;
                if (h.tipo === 'creacion') desc = `Pedido registrado`;
                else if (h.tipo === 'produccion') desc = `Producción: ${h.estado_anterior} ➔ ${h.estado_nuevo}`;
                else if (h.tipo === 'pago') desc = `Pago: ${h.estado_anterior} ➔ ${h.estado_nuevo}`;
                
                return `
                  <div style="display:flex; flex-direction:column; border-bottom:1px solid var(--border); padding-bottom:6px; gap:2px;">
                    <div style="font-weight:600; color:var(--text-primary);">${desc}</div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-tertiary); font-size:0.72rem;">
                      <span>Por: ${userStr}</span>
                      <span>${dateStr}</span>
                    </div>
                  </div>
                `;
              }).reverse().join('')}
            </div>
          </div>
        ` : ''}

        <!-- Deliver button -->
        ${isPaid && !isEntregado ? `
          <button class="btn btn-success btn-lg btn-block" id="btn-entregar">
            Marcar como ENTREGADO
          </button>
        ` : ''}

        ${isEntregado ? `
          <div class="card card-padded" style="text-align:center; color:var(--text-tertiary);">
            <div style="margin-bottom:8px; color:var(--text-tertiary);"><svg class="icon icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>
            <div style="font-weight:700;">Pedido ENTREGADO</div>
          </div>
        ` : ''}

      </div>
    </div>
  `;

  // Back button
  document.getElementById('btn-back-taller')?.addEventListener('click', () => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      history.pushState(null, '', '/taller');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  // Print button in detail
  document.getElementById('btn-print-detail')?.addEventListener('click', () => {
    imprimirRecibo(pedido);
  });

  // Estado tabs
  content.querySelectorAll('.estado-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nuevoEstado = btn.dataset.estado;
      if (nuevoEstado === 'ENTREGADO') {
        if (pedido.saldo_pendiente > 0) {
          if (!confirm(`El pedido tiene un saldo pendiente de ${formatCurrency(pedido.saldo_pendiente)}. ¿Deseas marcarlo como ENTREGADO de todos modos?`)) {
            return;
          }
        } else {
          if (!confirm('¿Confirmar entrega al cliente?')) return;
        }
      }
      try {
        await actualizarEstadoProduccion(pedido._docId, nuevoEstado, getCurrentUserProfile());
        showToast(`Estado: ${nuevoEstado}`, 'success');
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });
  });

  // Add abono
  document.getElementById('btn-add-abono')?.addEventListener('click', () => showAbonoModal(pedido));

  // Deliver
  document.getElementById('btn-entregar')?.addEventListener('click', async () => {
    if (!confirm('¿Confirmar entrega al cliente?')) return;
    try {
      await actualizarEstadoProduccion(pedido._docId, 'ENTREGADO', getCurrentUserProfile());
      showToast('¡Pedido marcado como ENTREGADO!', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });
}

function showAbonoModal(pedido) {
  document.getElementById('abono-modal')?.remove();

  // Import inline to avoid circular
  import('../components/abonoForm.js').then(({ renderAbonoModal }) => {
    document.body.insertAdjacentHTML('beforeend', renderAbonoModal(pedido));

    const modal = document.getElementById('abono-modal');

    document.getElementById('modal-cancel')?.addEventListener('click', () => modal?.remove());
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('modal-confirm')?.addEventListener('click', async () => {
      const monto = Number(document.getElementById('modal-abono-monto')?.value);
      const metodo = document.getElementById('modal-abono-metodo')?.value || 'Efectivo';

      if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
      if (monto > pedido.saldo_pendiente + 0.001) { showToast('El monto excede el saldo pendiente', 'error'); return; }

      try {
        await agregarAbono(pedido._docId, monto, metodo, getCurrentUserProfile());
        showToast(`Abono de ${formatCurrency(monto)} registrado`, 'success');
        modal?.remove();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });

    setTimeout(() => document.getElementById('modal-abono-monto')?.focus(), 80);
  });
}

async function handleCardAction(pedido, action) {
  if (action === 'comenzar') {
    try {
      await actualizarEstadoProduccion(pedido._docId, 'EN PROCESO', getCurrentUserProfile());
      showToast('Pedido marcado en proceso', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  } else if (action === 'entregar') {
    if (pedido.saldo_pendiente > 0) {
      if (!confirm(`El pedido tiene un saldo pendiente de ${formatCurrency(pedido.saldo_pendiente)}. ¿Deseas marcarlo como ENTREGADO de todos modos?`)) {
        return;
      }
    } else {
      if (!confirm('¿Confirmar entrega al cliente?')) return;
    }
    
    try {
      await actualizarEstadoProduccion(pedido._docId, 'ENTREGADO', getCurrentUserProfile());
      showToast('¡Pedido marcado como ENTREGADO!', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }
}
