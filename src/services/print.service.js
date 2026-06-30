import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Generates the thermal receipt HTML
 * Prints two copies: Cliente + Taller, separated by page break (triggers cutter)
 */
export function generarReciboHTML(pedido) {
  const productosHTML = pedido.productos.map((p, i) => `
    <tr>
      <td class="receipt-item-num" style="font-weight: 800; font-size: 11.5px; vertical-align: top; padding-top: 2px;">${i + 1}.</td>
      <td class="receipt-item-detail" style="padding-bottom: 3px; text-align: left !important;">
        <div style="font-weight: 800; font-size: 11.5px; text-transform: uppercase; text-align: left !important;">
          ${p.cantidad}x ${p.producto_tipo}
        </div>
        ${p.detalle_personalizado ? `
          <div style="font-size: 11.5px; color: #111; margin-top: 3px; font-family: monospace; white-space: pre-wrap; padding-left: 6px; text-align: left !important; line-height: 1.2; display: block !important; width: 100%;">
            ${p.detalle_personalizado}
          </div>
        ` : ''}
      </td>
      <td class="receipt-item-price" style="font-family: monospace; font-size: 11.5px; font-weight: 800; vertical-align: top; padding-top: 2px;">
        ${formatCurrency(p.subtotal)}
      </td>
    </tr>
  `).join('');

  const produccionHTML = pedido.productos.map((p, i) => `
    <div class="receipt-prod-item" style="margin-bottom: 14px; border-bottom: 1px dashed #222; padding-bottom: 8px;">
      <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; color: #000; line-height: 1.2;">
        ${i + 1}. ${p.cantidad}x ${p.producto_tipo}
      </div>
      ${p.detalle_personalizado ? `
        <div style="font-size: 12.5px; font-family: monospace; font-weight: 700; color: #000; margin-top: 4px; padding-left: 10px; text-align: left !important; white-space: pre-wrap; line-height: 1.3; display: block !important; width: 100%;">
          ${p.detalle_personalizado}
        </div>
      ` : ''}
    </div>
  `).join('');

  const saldoPendienteAlert = pedido.saldo_pendiente > 0
    ? `<div class="receipt-saldo-alert">
        [ SALDO PENDIENTE: ${formatCurrency(pedido.saldo_pendiente)} ]<br/>
        <span>(NO ENTREGAR SIN PAGO TOTAL)</span>
      </div>`
    : '';

  return `
    <!-- COPIA 1: CLIENTE -->
    <div class="receipt-page">
      <div class="receipt-header">
        <div class="receipt-logo">CASA GRÁFICA</div>
        <div class="receipt-subtitle">Comprobante de Pedido</div>
      </div>
      <div class="receipt-divider-double"></div>
      <div class="receipt-info">
        <div class="receipt-row">
          <span>Pedido:</span>
          <strong>${pedido.id_pedido}</strong>
        </div>
        <div class="receipt-row">
          <span>Fecha:</span>
          <span>${formatDate(pedido.fecha_creacion)}</span>
        </div>
        <div class="receipt-row">
          <span>Cliente:</span>
          <span>${pedido.cliente_nombre}</span>
        </div>
        ${pedido.cliente_telefono ? `<div class="receipt-row"><span>Tel:</span><span>${pedido.cliente_telefono}</span></div>` : ''}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-section-title">PRODUCTOS</div>
      <table class="receipt-table">
        <tbody>${productosHTML}</tbody>
      </table>
      <div class="receipt-divider"></div>
      ${pedido.saldo_pendiente > 0 ? `
        <div class="receipt-saldo-alert">
          SALDO PENDIENTE: ${formatCurrency(pedido.saldo_pendiente)}
          <span>(NO ENTREGAR SIN PAGO TOTAL)</span>
        </div>
        <div class="receipt-divider"></div>
      ` : ''}
      <div class="receipt-totals">
        <div class="receipt-total-row">
          <span>TOTAL:</span>
          <strong>${formatCurrency(pedido.total_pagar)}</strong>
        </div>
        <div class="receipt-total-row">
          <span>ABONADO:</span>
          <span>${formatCurrency(pedido.total_abonado)}</span>
        </div>
        <div class="receipt-total-row receipt-total-saldo ${pedido.saldo_pendiente > 0 ? 'has-saldo' : 'paid'}">
          <span>${pedido.saldo_pendiente > 0 ? 'SALDO PEND.:' : 'ESTADO:'}</span>
          <strong>${pedido.saldo_pendiente > 0 ? formatCurrency(pedido.saldo_pendiente) : 'PAGADO'}</strong>
        </div>
      </div>
      <div class="receipt-divider-double"></div>
      <div class="receipt-footer">
        TODO TRABAJO, ANTES DE IMPRIMIR SERÁ REVISADO Y CONFIRMADO POR EL CLIENTE ASUMIENDO TODA LA RESPONSABILIDAD DEL DISEÑO
      </div>
      <div class="receipt-copy-label">— COPIA CLIENTE —</div>
    </div>

    <!-- COPIA 2: TALLER -->
    <div class="receipt-page">
      <div class="receipt-header">
        <div class="receipt-logo">ORDEN DE PRODUCCIÓN</div>
      </div>
      <div class="receipt-divider-double"></div>
      <div class="receipt-info">
        <div class="receipt-row">
          <span>Pedido:</span>
          <strong>${pedido.id_pedido}</strong>
        </div>
        <div class="receipt-row">
          <span>Cliente:</span>
          <span>${pedido.cliente_nombre}</span>
        </div>
      </div>
      <div class="receipt-divider"></div>
      ${saldoPendienteAlert}
      <div class="receipt-divider"></div>
      <div class="receipt-section-title">PRODUCTOS A PRODUCIR</div>
      <div class="receipt-produccion">
        ${produccionHTML}
      </div>
      ${pedido.notes || pedido.notas ? `
        <div class="receipt-divider"></div>
        <div class="receipt-section-title">NOTAS</div>
        <div class="receipt-notes">${pedido.notes || pedido.notas}</div>
      ` : ''}
      <div class="receipt-divider-double"></div>
      <div class="receipt-copy-label">— COPIA TALLER —</div>
    </div>
  `;
}

/**
 * Triggers direct/silent printing via hidden iframe.
 * If the user's environment/extension supports silent printing on iframes,
 * it will bypass the dialog.
 */
export function imprimirReciboDirecto(pedido) {
  let iframe = document.getElementById('silent-print-iframe');
  if (iframe) {
    iframe.remove();
  }

  iframe = document.createElement('iframe');
  iframe.id = 'silent-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const html = generarReciboHTML(pedido);

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Imprimir Recibo</title>
      </head>
      <body>
        <div id="print-area">${html}</div>
      </body>
    </html>
  `);
  doc.close();

  // Clone active stylesheets to ensure print styles apply correctly inside the iframe
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
    doc.head.appendChild(el.cloneNode(true));
  });

  // Trigger print in the iframe after stylesheet injection
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Error al imprimir desde iframe:', e);
    }
  }, 150);
}

/**
 * Standard print in the main window.
 * Shows the native browser print preview dialog.
 */
export function imprimirRecibo(pedido) {
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  printArea.innerHTML = generarReciboHTML(pedido);

  // Trigger native print on the main window to show native print preview
  requestAnimationFrame(() => {
    window.print();
  });
}
