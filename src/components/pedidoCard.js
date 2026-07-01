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

  const adjuntos = pedido.adjuntos || [];
  const adjuntosHTML = adjuntos.length > 0
    ? `
      <div class="pedido-card-attachments" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; padding-top: 6px; border-top: 1px dashed #e0e0e0;">
        ${adjuntos.map((adj) => {
          const extension = adj.nombre.split('.').pop().toLowerCase();
          const esImagen = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
          const iconHTML = esImagen
            ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
            : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
          
          const subidoPor = adj.usuario && adj.usuario.nombre ? adj.usuario.nombre : 'SISTEMA';
          return `
            <div onclick="event.stopPropagation(); window.mostrarDetalleAdjunto('${adj.nombre.replace(/'/g, "\\'")}', '${adj.url}', '${adj.tipo || ''}', '${subidoPor.replace(/'/g, "\\'")}', '${adj.fecha || ''}')" class="pedido-attachment-item" title="Ver detalles de ${adj.nombre}" style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; background: #f5f5f5; border-radius: 4px; font-size: 0.7rem; color: #666; cursor: pointer; max-width: 100%; border: 1px solid #e0e0e0; transition: all 0.15s; overflow: hidden;" onmouseover="this.style.background='#e9e9e9'; this.style.borderColor='#ccc'; this.style.color='#333'" onmouseout="this.style.background='#f5f5f5'; this.style.borderColor='#e0e0e0'; this.style.color='#666'">
              <span style="display: inline-flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 18px);">
                ${iconHTML}
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${adj.nombre}</span>
              </span>
              <a href="${adj.url}" target="_blank" download="${adj.nombre}" onclick="event.stopPropagation()" class="pedido-attachment-download" title="Descargar archivo" style="display: inline-flex; align-items: center; color: #888; text-decoration: none; padding: 2px; border-radius: 2px; transition: all 0.15s;" onmouseover="this.style.color='var(--accent, #e53935)'; this.style.background='#e0e0e0'" onmouseout="this.style.color='#888'; this.style.background='transparent'">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 11px; height: 11px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </a>
            </div>
          `;
        }).join('')}
      </div>
    `
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
          <button type="button" class="btn-attach-card" onclick="event.stopPropagation(); window.abrirAdjuntosPedido('${pedido._docId}', this)" title="Adjuntar Archivo" style="display: flex; align-items: center; justify-content: center;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
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
      ${adjuntosHTML}

      <div class="pedido-card-bottom">
        ${pedido.saldo_pendiente > 0
          ? `<span class="pedido-card-amount pedido-card-amount-action" data-abono-pedido-id="${pedido._docId}" style="color:var(--danger-text);" title="Registrar pago o abono">
              <svg class="icon icon-abono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M6 12h.01M18 12h.01"></path>
              </svg>
              <span style="vertical-align: middle;">${formatCurrency(pedido.saldo_pendiente)}</span>
             </span>`
          : `<span class="pedido-card-amount" style="color:var(--success-text);">✓ Pagado</span>`
        }
        <div class="pedido-card-date" title="${pedido.fecha_creacion?.toDate?.()?.toLocaleString?.('es-MX') || ''}">${timeAgo(pedido.fecha_creacion)}</div>
      </div>
    </div>
  `;
}
