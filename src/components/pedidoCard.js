import { formatCurrency, timeAgo } from '../utils/formatters.js';

function badgeProd(estado) {
  const map = { 'PENDIENTE': 'badge-pendiente', 'EN PROCESO': 'badge-en-proceso', 'LISTO': 'badge-listo', 'ENTREGADO': 'badge-entregado' };
  return map[estado] || 'badge-pendiente';
}

export function renderPedidoCard(pedido, options = {}) {
  const { showTallerActions = false } = options;
  const maxPreview = 3;
  const preview = pedido.productos.slice(0, maxPreview)
    .map(p => `<div>${p.producto_tipo}${p.detalle_personalizado ? ` — ${p.detalle_personalizado}` : ''}</div>`)
    .join('');
  const extra = pedido.productos.length > maxPreview
    ? `<div style="font-size:0.75rem; color:var(--text-tertiary);">+${pedido.productos.length - maxPreview} más</div>`
    : '';

  return `
    <div class="pedido-card" data-doc-id="${pedido._docId}">
      <div class="pedido-card-top">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="pedido-card-id">${pedido.id_pedido}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
          <!-- Preservando diseño del indicador de estado para uso futuro:
          <span class="badge ${badgeProd(pedido.estado_produccion)}">${pedido.estado_produccion}</span>
          -->
          <button type="button" class="btn-print-card" data-card-print="${pedido._docId}" title="Imprimir Recibo" style="display: flex; align-items: center; justify-content: center;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
          <div class="product-dropdown" style="margin-left:2px;">
            <button type="button" class="product-dropdown-toggle" data-card-dropdown-toggle="card-menu-${pedido._docId}" aria-label="Acciones">⋮</button>
            <div class="product-dropdown-menu" id="card-menu-${pedido._docId}">
              <button type="button" class="product-dropdown-item" data-card-edit="${pedido._docId}">Editar</button>
              <button type="button" class="product-dropdown-item" data-card-remove="${pedido._docId}">Eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div>
          <div class="pedido-card-name" style="display:flex; align-items:center; gap:8px;">
            <span>${pedido.cliente_nombre}</span>
            ${pedido.cliente_telefono ? `
              <a href="https://wa.me/${pedido.cliente_telefono.replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="pedido-card-wa-link" title="Contactar por WhatsApp" style="display:inline-flex; align-items:center; text-decoration:none;">
                <svg class="icon icon-wa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; color:#25D366;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>
            ` : ''}
          </div>
        </div>
        ${showTallerActions && pedido.estado_produccion !== 'ENTREGADO' ? `
          <div style="flex-shrink:0;">
            ${pedido.estado_produccion === 'PENDIENTE' ? `
              <button type="button" class="btn btn-icon-round btn-info taller-card-action" data-taller-action="comenzar" data-doc-id="${pedido._docId}" title="Marcar como listo" style="width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
              </button>
            ` : ''}
            ${(pedido.estado_produccion === 'LISTO' || pedido.estado_produccion === 'EN PROCESO') ? `
              <button type="button" class="btn btn-icon-round btn-success taller-card-action" data-taller-action="entregar" data-doc-id="${pedido._docId}" title="Entregar" style="width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center;">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <div class="pedido-card-products">${preview}${extra}</div>

      <div class="pedido-card-bottom">
        ${pedido.saldo_pendiente > 0
          ? `<span class="pedido-card-amount" style="color:var(--danger-text);">${formatCurrency(pedido.saldo_pendiente)}</span>`
          : `<span class="pedido-card-amount" style="color:var(--success-text);">✓ Pagado</span>`
        }
        <div class="pedido-card-date" title="${pedido.fecha_creacion?.toDate?.()?.toLocaleString?.('es-MX') || ''}">${timeAgo(pedido.fecha_creacion)}</div>
      </div>
    </div>
  `;
}
