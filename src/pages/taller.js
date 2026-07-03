import { renderPedidoCard } from '../components/pedidoCard.js';
import { showAbonoModal } from '../components/abonoForm.js';
import {
  buscarPedidos, obtenerPedido, obtenerPedidosActivosCliente,
  actualizarEstadoProduccion, escucharPedido, escucharPedidosRecientes,
  agregarAbono, agruparPedidos
} from '../services/pedidos.service.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { imprimirRecibo } from '../services/print.service.js';
import { showToast, getCurrentUserProfile } from '../main.js';

let unsubscribe = null;
let allPedidos = [];
let colapsados = { PENDIENTE: false, LISTO: false, ENTREGADO: true };

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
    debounce = setTimeout(() => {
      renderFilteredTaller();
    }, 280);
  });

  document.getElementById('btn-ver-todos')?.addEventListener('click', () => {
    const input = document.getElementById('search-taller');
    if (input) input.value = '';
    renderFilteredTaller();
  });

  // If arriving from a card click, load that pedido directly
  if (initialDocId) {
    if (initialDocId.startsWith('grupo/')) {
      const grupoId = initialDocId.replace('grupo/', '');
      openGroupDetail(grupoId);
    } else {
      openDetail(initialDocId);
    }
  } else {
    loadRecent();
  }
}

export function cleanupTaller() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  allPedidos = [];
}

// ── Data loading ──

async function loadRecent() {
  const content = document.getElementById('taller-content');
  if (!content) return;

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  content.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div><span>Cargando pedidos...</span></div>`;

  try {
    unsubscribe = escucharPedidosRecientes(300, (pedidos) => {
      allPedidos = pedidos;
      renderFilteredTaller();
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--danger-text);"><svg class="icon icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div><div class="empty-title">Error al cargar</div><div class="empty-msg">${err.message}</div></div>`;
  }
}

function renderFilteredTaller() {
  const searchTerm = document.getElementById('search-taller')?.value.trim().toLowerCase() || '';

  const filtered = allPedidos.filter(p => {
    return !searchTerm ||
      p.cliente_nombre.toLowerCase().includes(searchTerm) ||
      p.id_pedido.toLowerCase().includes(searchTerm);
  });

  showList(filtered, searchTerm);
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

  const grouped = agruparPedidos(pedidos);

  // Group by status
  const pendientes = grouped.filter(p => p.estado_produccion === 'PENDIENTE');
  const listo      = grouped.filter(p => p.estado_produccion === 'LISTO' || p.estado_produccion === 'EN PROCESO');
  const entregados = grouped.filter(p => p.estado_produccion === 'ENTREGADO');

  content.innerHTML = `
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
          ${pendientes.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
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
          ${listo.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
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
          ${entregados.map(p => renderPedidoCard(p, { showTallerActions: true })).join('') || '<div class="taller-empty-column">Sin pedidos</div>'}
        </div>
      </div>
    </div>
  `;

  // Bind click to headers to collapse columns
  content.querySelectorAll('.taller-column-header').forEach(header => {
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

  content.querySelectorAll('.pedido-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const printBtn = e.target.closest('[data-card-print]');
      if (printBtn) {
        const docId = printBtn.dataset.cardPrint;
        const groupedList = agruparPedidos(pedidos);
        const ped = groupedList.find(p => p._docId === docId || (p.isGrupo && p.pedidos.some(sub => sub._docId === docId)));
        if (ped) {
          imprimirRecibo(ped);
        }
        return;
      }

      // Check if abono amount was clicked
      const abonoBtn = e.target.closest('.pedido-card-amount-action');
      if (abonoBtn) {
        const docId = abonoBtn.dataset.abonoPedidoId;
        const ped = pedidos.find(p => p._docId === docId);
        if (ped) {
          showAbonoModal(ped);
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
  const estados = ['PENDIENTE', 'LISTO', 'ENTREGADO'];

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

  const adjuntos = pedido.adjuntos || [];
  const adjuntosHTML = adjuntos.length > 0
    ? adjuntos.map((adj, index) => {
        const extension = adj.nombre.split('.').pop().toLowerCase();
        const esImagen = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
        const iconHTML = esImagen
          ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color:var(--text-tertiary);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
          : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color:var(--text-tertiary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
        
        const fechaStr = adj.fecha ? new Date(adj.fecha).toLocaleDateString('es-MX') : '—';
        const subidoPor = adj.usuario && adj.usuario.nombre ? adj.usuario.nombre : 'SISTEMA';

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); gap:12px;">
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1;">
              ${iconHTML}
              <span class="attachment-link-detail" onclick="event.stopPropagation(); window.mostrarDetalleAdjunto('${adj.nombre.replace(/'/g, "\\'")}', '${adj.url}', '${adj.tipo || ''}', '${subidoPor.replace(/'/g, "\\'")}', '${adj.fecha || ''}')" title="Ver detalles de ${adj.nombre}" style="font-size:0.85rem; font-weight:600; color:var(--text-primary); cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-decoration:none;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-primary)'">
                ${adj.nombre}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
              <span style="font-size:0.75rem; color:var(--text-tertiary);" title="Subido por: ${subidoPor}">${fechaStr}</span>
              <a href="${adj.url}" target="_blank" download="${adj.nombre}" class="btn btn-ghost btn-xs" title="Descargar" style="padding:4px; display:flex; align-items:center; justify-content:center; border:none; background:transparent;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </a>
              <button type="button" class="btn btn-ghost btn-xs btn-delete-attachment" data-adj-idx="${index}" title="Eliminar" style="padding:4px; display:flex; align-items:center; justify-content:center; color:var(--danger-text); background:transparent; border:none; cursor:pointer;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')
    : `<div style="text-align:center; padding:16px 0; color:var(--text-tertiary); font-size:0.85rem;">No hay archivos adjuntos en este pedido.</div>`;

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

        <!-- Adjuntos -->
        <div class="card card-padded">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <span>Archivos Adjuntos</span>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-attach-detail" style="padding: 2px 6px; font-size: 0.75rem; display:flex; align-items:center; gap:4px; background:var(--bg-hover); border:1px solid var(--border); border-radius:4px; cursor:pointer;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              Adjuntar
            </button>
          </div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${adjuntosHTML}
          </div>
        </div>

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
            <div style="display: flex; gap: 8px; margin-top: 14px;">
              <button class="btn btn-danger-outline btn-sm" id="btn-add-abono" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 4px; font-size: 0.72rem;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Registrar abono
              </button>
              <button class="btn btn-success-outline btn-sm" id="btn-pay-cash-shortcut" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 4px; font-size: 0.72rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Efectivo
              </button>
            </div>
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

  // Attach button in detail
  document.getElementById('btn-attach-detail')?.addEventListener('click', () => {
    const attachBtn = document.getElementById('btn-attach-detail');
    if (attachBtn) {
      window.abrirAdjuntosPedido(pedido._docId, attachBtn);
    }
  });

  // Delete attachment buttons in detail
  content.querySelectorAll('.btn-delete-attachment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.adjIdx, 10);
      const adjunto = pedido.adjuntos[idx];
      if (!adjunto) return;

      if (confirm(`¿Estás seguro de que deseas eliminar el archivo "${adjunto.nombre}"?`)) {
        btn.disabled = true;
        const originalColor = btn.style.color;
        btn.style.color = 'var(--text-tertiary)';
        
        try {
          const { eliminarAdjuntoPedido } = await import('../services/pedidos.service.js');
          await eliminarAdjuntoPedido(pedido._docId, adjunto);
          showToast('Archivo eliminado', 'success');
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar archivo', 'error');
          btn.disabled = false;
          btn.style.color = originalColor;
        }
      }
    });
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

  // Registrar pago rápido en efectivo (liquida todo)
  document.getElementById('btn-pay-cash-shortcut')?.addEventListener('click', async () => {
    const totalAbonar = pedido.saldo_pendiente;
    if (totalAbonar <= 0.001) return;
    
    if (!confirm(`¿Confirmar cobro de ${formatCurrency(totalAbonar)} en Efectivo? El pedido quedará saldado.`)) return;

    try {
      await agregarAbono(pedido._docId, totalAbonar, 'Efectivo', getCurrentUserProfile());
      showToast('Pedido saldado en efectivo con éxito', 'success');
    } catch (err) {
      showToast('Error al registrar abono: ' + err.message, 'error');
    }
  });

  // Deliver
  document.getElementById('btn-entregar')?.addEventListener('click', async () => {
    if (!confirm('¿Confirmar entrega al cliente?')) return;
    try {
      await actualizarEstadoProduccion(pedido._docId, 'ENTREGADO', getCurrentUserProfile());
      showToast('¡Pedido marcado como ENTREGADO!', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });
}
// ── Group Detail ──

async function openGroupDetail(grupoId) {
  if (!grupoId) return;
  const content = document.getElementById('taller-content');
  if (!content) return;

  content.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div><span>Cargando pedidos...</span></div>`;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  try {
    // Obtener todos los pedidos del grupo: el pedido con _docId = grupoId y todos los que tienen grupo_id = grupoId
    const pedido0 = await obtenerPedido(grupoId);
    if (!pedido0) { showToast('Pedido no encontrado', 'error'); loadRecent(); return; }

    const clienteId = pedido0.cliente_id;
    const todos = await obtenerPedidosActivosCliente(clienteId);
    const subPedidos = todos.filter(p => p._docId === grupoId || p.grupo_id === grupoId);
    // Asegurar que el pedido principal esté incluido aunque esté entregado
    if (!subPedidos.find(p => p._docId === grupoId)) subPedidos.unshift(pedido0);

    renderGroupDetail(subPedidos.sort((a, b) => {
      const ta = a.fecha_creacion?.toMillis?.() || 0;
      const tb = b.fecha_creacion?.toMillis?.() || 0;
      return ta - tb;
    }));
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    loadRecent();
  }
}

function renderGroupDetail(subPedidos) {
  const content = document.getElementById('taller-content');
  if (!content) return;

  const clienteNombre = subPedidos[0]?.cliente_nombre || '—';
  const clienteTelefono = subPedidos[0]?.cliente_telefono || '';

  const totalPagar    = subPedidos.reduce((s, p) => s + (Number(p.total_pagar) || 0), 0);
  const totalAbonado  = subPedidos.reduce((s, p) => s + (Number(p.total_abonado) || 0), 0);
  const saldoPendiente = subPedidos.reduce((s, p) => s + (Number(p.saldo_pendiente) || 0), 0);

  const badgeProd = (estado) => {
    if (estado === 'PENDIENTE') return 'badge-pendiente';
    if (estado === 'LISTO') return 'badge-listo';
    if (estado === 'EN PROCESO') return 'badge-proceso';
    if (estado === 'ENTREGADO') return 'badge-entregado';
    return '';
  };

  const subPedidosHTML = subPedidos.map(sub => {
    const productRows = sub.productos.map((p, i) => `
      <tr>
        <td style="font-weight:700; color:var(--text-tertiary);">${i + 1}</td>
        <td>
          <div style="font-weight:700; color:var(--accent);">${p.producto_tipo}</div>
          ${p.detalle_personalizado ? `<div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">${p.detalle_personalizado}</div>` : ''}
        </td>
        <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">${p.cantidad}</td>
        <td style="text-align:right; font-family:var(--font-mono);">${formatCurrency(p.precio_unitario)}</td>
        <td style="text-align:right; font-family:var(--font-mono); font-weight:800;">${formatCurrency(p.subtotal)}</td>
      </tr>
    `).join('');

    const isPaidSub = sub.saldo_pendiente <= 0;
    const isEntregadoSub = sub.estado_produccion === 'ENTREGADO';
    const estados = ['PENDIENTE', 'LISTO', 'ENTREGADO'];

    return `
      <div class="card" style="border-left: 3px solid var(--accent);" data-sub-docid="${sub._docId}">
        <!-- Sub-header -->
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-family:var(--font-mono); font-size:1rem; font-weight:800; color:var(--accent);">${sub.id_pedido}</span>
            <span class="badge ${badgeProd(sub.estado_produccion)}" style="font-size:0.72rem;">${sub.estado_produccion}</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="badge badge-${sub.estado_pago.toLowerCase().replace(' ', '-')}" style="font-size:0.72rem;">${sub.estado_pago}</span>
            <button type="button" class="btn-print-card group-sub-print" data-sub-print="${sub._docId}" title="Imprimir esta orden" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; padding:0; background:transparent; border:1px solid var(--border); border-radius:4px; cursor:pointer; color:var(--text-secondary);">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
          </div>
        </div>

        <!-- Products -->
        <div style="overflow-x:auto; padding:0 4px;">
          <table class="detail-table">
            <thead>
              <tr>
                <th>#</th><th>Producto / Detalle</th>
                <th style="text-align:center;">Cant.</th>
                <th style="text-align:right;">P.Unit.</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${productRows}</tbody>
          </table>
        </div>

        <!-- Totales individuales y estado de producción -->
        <div class="card-padded" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border); margin-top:4px;">
          <!-- Estado producción -->
          <div class="estado-tabs" style="gap:6px;" data-sub-id="${sub._docId}">
            ${estados.map(e => `
              <button class="estado-tab ${sub.estado_produccion === e ? 'active' : ''}" data-estado="${e}" data-sub-id="${sub._docId}">${e}</button>
            `).join('')}
          </div>
          <!-- Saldo -->
          <div style="text-align:right; font-size:0.82rem;">
            <div style="color:var(--text-tertiary);">Total: <strong>${formatCurrency(sub.total_pagar)}</strong></div>
            ${!isPaidSub ? `
              <div style="color:var(--danger-text); font-weight:700;">
                Saldo: ${formatCurrency(sub.saldo_pendiente)}
                <button type="button" class="btn btn-xs btn-danger-outline group-abono-btn" data-abono-id="${sub._docId}" style="margin-left:6px; font-size:0.72rem; padding:2px 6px;">Abonar</button>
              </div>
            ` : `<div style="color:var(--success-text); font-weight:700;">Pagado</div>`}
          </div>
        </div>

        ${sub.notas ? `
          <div class="card-padded" style="border-top:1px solid var(--border); font-size:0.82rem; color:var(--text-secondary);">
            <span style="font-weight:700; color:var(--text-tertiary); text-transform:uppercase; font-size:0.72rem;">Notas:</span> ${sub.notas}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const grupoId = subPedidos[0]._docId;

  content.innerHTML = `
    <!-- Back -->
    <button class="btn btn-ghost btn-sm" id="btn-back-taller" style="margin-bottom:16px;">
      ← Volver
    </button>

    <div class="taller-detail-layout">
      <!-- Left: sub-pedidos -->
      <div style="display:flex; flex-direction:column; gap:14px;">

        <!-- Header del cliente -->
        <div class="card card-padded">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:1.2rem; font-weight:800;">${clienteNombre}</div>
              ${clienteTelefono ? `<div style="color:var(--text-tertiary); font-size:0.85rem; margin-top:2px;">${clienteTelefono}</div>` : ''}
              <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:4px;">${subPedidos.length} pedido(s) unificado(s)</div>
            </div>
            <button type="button" class="btn-print-card" id="btn-print-group" title="Imprimir ticket consolidado" style="display:flex; align-items:center; gap:6px; padding:6px 10px; background:transparent; border:1px solid var(--border); border-radius:6px; cursor:pointer; font-size:0.82rem; color:var(--text-secondary);">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Imprimir todo
            </button>
          </div>
        </div>

        ${subPedidosHTML}
      </div>

      <!-- Right: resumen financiero consolidado -->
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card card-padded">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:12px;">Resumen consolidado</div>
          <div class="totals-box" style="margin-top:0;">
            <div class="totals-row">
              <span>Total</span>
              <span class="totals-val">${formatCurrency(totalPagar)}</span>
            </div>
            <div class="totals-row">
              <span>Abonado</span>
              <span class="totals-val" style="color:var(--success-text);">${formatCurrency(totalAbonado)}</span>
            </div>
            <div class="totals-row main">
              <span>Saldo</span>
              <span class="totals-val ${saldoPendiente > 0 ? 'totals-saldo-due' : 'totals-saldo-paid'}">${saldoPendiente > 0 ? formatCurrency(saldoPendiente) : 'Pagado'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Volver
  document.getElementById('btn-back-taller')?.addEventListener('click', () => {
    if (window.history.length > 2) window.history.back();
    else { history.pushState(null, '', '/taller'); window.dispatchEvent(new PopStateEvent('popstate')); }
  });

  // Imprimir todo el grupo
  document.getElementById('btn-print-group')?.addEventListener('click', () => {
    const grupoObj = {
      isGrupo: true,
      grupo_id: grupoId,
      cliente_nombre: clienteNombre,
      cliente_telefono: clienteTelefono,
      pedidos: subPedidos,
    };
    imprimirRecibo(grupoObj);
  });

  // Imprimir pedido individual
  content.querySelectorAll('.group-sub-print').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const docId = btn.dataset.subPrint;
      const sub = subPedidos.find(p => p._docId === docId);
      if (sub) imprimirRecibo(sub);
    });
  });

  // Estado tabs por sub-pedido
  content.querySelectorAll('.estado-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nuevoEstado = btn.dataset.estado;
      const subId = btn.dataset.subId;
      const sub = subPedidos.find(p => p._docId === subId);
      if (!sub) return;

      if (nuevoEstado === 'ENTREGADO') {
        if (sub.saldo_pendiente > 0) {
          if (!confirm(`El pedido #${sub.id_pedido} tiene un saldo de ${formatCurrency(sub.saldo_pendiente)}. ¿Marcar como ENTREGADO de todos modos?`)) return;
        } else {
          if (!confirm(`¿Confirmar entrega del pedido #${sub.id_pedido}?`)) return;
        }
      }
      try {
        await actualizarEstadoProduccion(subId, nuevoEstado, getCurrentUserProfile());
        showToast(`Pedido #${sub.id_pedido}: ${nuevoEstado}`, 'success');
        // Refrescar la vista
        openGroupDetail(grupoId);
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });
  });

  // Abonar por sub-pedido
  content.querySelectorAll('.group-abono-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sub = subPedidos.find(p => p._docId === btn.dataset.abonoId);
      if (sub) showAbonoModal(sub);
    });
  });
}

async function handleCardAction(pedido, action) {
  if (action === 'comenzar') {
    try {
      await actualizarEstadoProduccion(pedido._docId, 'LISTO', getCurrentUserProfile());
      showToast('Pedido marcado como listo', 'success');
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
