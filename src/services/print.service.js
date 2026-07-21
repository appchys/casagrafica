import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the thermal receipt HTML
 * Prints two identical copies: Cliente + Taller, separated by page break (triggers cutter)
 */
export function generarReciboHTML(pedido) {
  const isGrupo = !!pedido.isGrupo || Array.isArray(pedido.pedidos);
  const subPedidos = isGrupo ? pedido.pedidos : [pedido];

  // Obtener usuario creador y limitar a los 2 primeros nombres
  // Tomamos el creador del primer sub-pedido
  const creadorEvent = (subPedidos[0].historial_estados || []).find(h => h.tipo === 'creacion');
  const nombreUsuario = (creadorEvent && creadorEvent.usuario && (creadorEvent.usuario.nombre || creadorEvent.usuario.email))
    ? (creadorEvent.usuario.nombre || creadorEvent.usuario.email)
    : 'SISTEMA';
  const atendidoPor = nombreUsuario.trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase();

  // Los IDs de pedido unificados
  const orderNumberStr = subPedidos.map(p => p.id_pedido).join(' + ');

  // Formatear los productos en el HTML del ticket
  let productosHTML = '';
  if (isGrupo) {
    productosHTML = subPedidos.map(sub => {
      const items = sub.productos.map(p => `
        <div class="receipt-product-item" style="margin-left: 6px;">
          <div class="receipt-product-main">
            <span class="receipt-product-qty-name">${p.cantidad}x ${p.producto_tipo.toUpperCase()}</span>
            <span class="receipt-product-price">${formatCurrency(p.subtotal)}</span>
          </div>
          ${p.detalle_personalizado ? `
            <div class="receipt-product-details">${p.detalle_personalizado.toUpperCase()}</div>
          ` : ''}
        </div>
      `).join('');
      return `
        <div class="receipt-group-order-block" style="margin-bottom: 8px;">
          <div style="font-weight: 700; font-size: 0.82rem; margin-bottom: 2px; border-bottom: 1px dashed #ccc; padding-bottom: 2px;">ORDEN #${sub.id_pedido}</div>
          <div style="font-size: 0.72rem; color: #666; margin-bottom: 4px;">${formatDate(sub.fecha_creacion).toUpperCase()}</div>
          ${items}
        </div>
      `;
    }).join('');
  } else {
    productosHTML = pedido.productos.map(p => `
      <div class="receipt-product-item">
        <div class="receipt-product-main">
          <span class="receipt-product-qty-name">${p.cantidad}x ${p.producto_tipo.toUpperCase()}</span>
          <span class="receipt-product-price">${formatCurrency(p.subtotal)}</span>
        </div>
        ${p.detalle_personalizado ? `
          <div class="receipt-product-details">${p.detalle_personalizado.toUpperCase()}</div>
        ` : ''}
      </div>
    `).join('');
  }

  // Totales consolidados
  const total_pagar = subPedidos.reduce((sum, p) => sum + (Number(p.total_pagar) || 0), 0);
  const total_abonado = subPedidos.reduce((sum, p) => sum + (Number(p.total_abonado) || 0), 0);
  const saldo_pendiente = subPedidos.reduce((sum, p) => sum + (Number(p.saldo_pendiente) || 0), 0);

  // Función auxiliar para renderizar una copia del ticket
  const generarTicketCopia = (labelCopia) => `
    <div class="receipt-page">
      <div class="receipt-header">
        <img src="/logocompleto-05.png" class="receipt-logo-img" alt="Casa Gráfica" />
        <div class="receipt-order-info">
          <span class="receipt-order-label">${isGrupo ? 'ÓRDENES' : 'PEDIDO'}</span>
          <span class="receipt-order-number">${orderNumberStr}</span>
        </div>
      </div>
      
      <div class="receipt-divider-solid"></div>
      
      <div class="receipt-client-section">
        <div class="receipt-client-label">CLIENTE</div>
        <div class="receipt-client-name">${subPedidos[0].cliente_nombre.toUpperCase()}</div>
        <div class="receipt-date">FECHA: ${formatDate(subPedidos[0].fecha_creacion).toUpperCase()}</div>
        <div class="receipt-date">ATENDIDO POR: ${atendidoPor}</div>
      </div>
      
      <div class="receipt-divider-solid"></div>
      
      <div class="receipt-products-section">
        <div class="receipt-section-title-left">PRODUCTOS</div>
        <div class="receipt-products-list">
          ${productosHTML}
        </div>
      </div>
      
      <div class="receipt-divider-solid"></div>
      
      ${saldo_pendiente > 0 ? `
        <div class="receipt-totals-section">
          <div class="receipt-total-row">
            <span class="receipt-total-label">Total:</span>
            <span class="receipt-total-val">
              <span class="currency-symbol">$</span>
              <span class="currency-amount">${Number(total_pagar || 0).toFixed(2)}</span>
            </span>
          </div>
          <div class="receipt-total-row">
            <span class="receipt-total-label">Abonado:</span>
            <span class="receipt-total-val">
              <span class="currency-symbol">$</span>
              <span class="currency-amount">${Number(total_abonado || 0).toFixed(2)}</span>
            </span>
          </div>
          <div class="receipt-total-row receipt-pending-box">
            <span class="receipt-pending-label">Pendiente:</span>
            <span class="receipt-pending-val">
              <span class="currency-symbol">$</span>
              <span class="currency-amount">${Number(saldo_pendiente || 0).toFixed(2)}</span>
            </span>
          </div>
        </div>
      ` : `
        <div class="receipt-paid-section">
          <span class="receipt-paid-text">✓ PAGADO</span>
        </div>
      `}
      
      <div style="margin-top: 6mm;"></div>
      
      <div class="receipt-footer">
        TODO TRABAJO, ANTES DE IMPRIMIR SERÁ REVISADO Y CONFIRMADO POR EL CLIENTE ASUMIENDO TODA LA RESPONSABILIDAD DEL DISEÑO
      </div>
      
      ${labelCopia ? `<div class="receipt-copy-label">${labelCopia}</div>` : ''}
    </div>
  `;

  return generarTicketCopia('');
}

/**
 * Imprime el recibo utilizando el área de impresión del documento principal.
 * Esto soluciona el bloqueo de impresión desde iframes ocultos en macOS (Safari y Chrome).
 */
export function imprimirReciboDirecto(pedido) {
  imprimirRecibo(pedido);
}

/**
 * Standard print in the main window.
 * Shows the native browser print preview dialog.
 */
export function imprimirRecibo(pedido) {
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  printArea.innerHTML = generarReciboHTML(pedido);

  const images = printArea.querySelectorAll('img');
  let printed = false;

  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    requestAnimationFrame(() => {
      window.print();
    });
  };

  if (images.length === 0) {
    triggerPrint();
  } else {
    // Temporizador de respaldo por si la carga de imágenes tarda o se detiene
    const fallbackTimer = setTimeout(triggerPrint, 600);

    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= images.length) {
        clearTimeout(fallbackTimer);
        triggerPrint();
      }
    };

    images.forEach(img => {
      if (img.complete) {
        checkAllLoaded();
      } else {
        img.onload = checkAllLoaded;
        img.onerror = checkAllLoaded;
      }
    });
  }
}
