import { renderPedidoCard } from '../components/pedidoCard.js';
import { obtenerNotificacionesPedido, obtenerPedidoPorIdPedido } from '../services/notificaciones.service.js';
import { formatDate } from '../utils/formatters.js';

let allNotifications = [];

export function renderNotificaciones() {
  return `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Notificaciones de pedidos</h1>
          <p class="page-subtitle">Comparación visual del pedido antes y después del cambio</p>
        </div>
      </div>

      <div class="card" style="padding: 16px; overflow: auto;">
        <div id="notifications-list" style="display:grid; gap:12px;">
          <div class="loading-center">
            <div class="spinner spinner-lg"></div>
            <span>Cargando notificaciones...</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindNotificacionesEvents() {
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;

  try {
    allNotifications = await obtenerNotificacionesPedido(100);
    if (allNotifications.length === 0) {
      listEl.innerHTML = '<div class="empty-msg">No hay notificaciones registradas aún.</div>';
      return;
    }

    const itemsHtml = await Promise.all(allNotifications.map(async (item) => {
      const fecha = item.fecha?.toDate ? item.fecha.toDate() : new Date(item.fecha?.seconds ? item.fecha.seconds * 1000 : Date.now());
      const actor = item.usuario?.nombre || item.usuario?.email || 'Sistema';
      const resumen = item.resumen || 'Se realizaron cambios importantes en este pedido.';
      const pedidoActual = await obtenerPedidoPorIdPedido(item.id_pedido || item.pedido_id);
      const originalPedido = construirSnapshotPedido(item, 'original', pedidoActual);
      const nuevoPedido = construirSnapshotPedido(item, 'nuevo', pedidoActual);

      return `
        <div class="notification-item" style="border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; background:var(--bg-card); display:grid; gap:12px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary);">Cambio detectado</div>
            </div>
            <div style="font-size:0.78rem; color:var(--text-secondary);">${formatDate(fecha)}</div>
          </div>

          <div style="color:var(--text-secondary); font-size:0.88rem;">
            <strong>Editor:</strong> ${escapeHtml(actor)}
          </div>

          <div style="display:flex; gap:12px; align-items:stretch; flex-wrap:nowrap;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); margin-bottom:6px;">Antes</div>
              ${renderPedidoCard(originalPedido)}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:0 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); margin-bottom:6px;">Actual</div>
              ${renderPedidoCard(nuevoPedido)}
            </div>
          </div>
        </div>
      `;
    }));

    listEl.innerHTML = itemsHtml.join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="empty-msg" style="color:var(--danger-text);">Error al cargar las notificaciones.</div>';
  }
}

export function cleanupNotificaciones() {
  allNotifications = [];
}

function construirSnapshotPedido(item, lado, pedidoActual = null) {
  const cambios = Array.isArray(item.cambios) ? item.cambios : [];
  const clienteCambio = cambios.find(c => c.campo === 'cliente');
  const productosCambio = cambios.find(c => c.campo === 'productos');
  const clienteBase = lado === 'original' ? clienteCambio?.anterior : clienteCambio?.nuevo;
  const productosBase = lado === 'original' ? productosCambio?.anterior : productosCambio?.nuevo;
  const fallbackCliente = pedidoActual || {};
  const fallbackProductos = Array.isArray(pedidoActual?.productos) ? pedidoActual.productos : [];

  const clienteNombre = clienteBase?.nombre || fallbackCliente.cliente_nombre || 'Sin cliente';
  const clienteTelefono = clienteBase?.telefono || fallbackCliente.cliente_telefono || '';
  const productos = Array.isArray(productosBase)
    ? productosBase.map(normalizarProductoSnapshot)
    : fallbackProductos.map(normalizarProductoSnapshot);

  return {
    _docId: `${item._docId || item.pedido_id || 'notification'}-${lado}`,
    id_pedido: item.id_pedido || item.pedido_id || 'N/A',
    cliente_nombre: clienteNombre,
    cliente_telefono: clienteTelefono,
    productos,
    saldo_pendiente: Number(pedidoActual?.saldo_pendiente || 0),
    fecha_creacion: item.fecha || pedidoActual?.fecha_creacion || new Date(),
  };
}

function normalizarProductoSnapshot(producto) {
  return {
    producto_tipo: producto?.producto_tipo || producto?.tipo || 'Producto',
    detalle_personalizado: producto?.detalle_personalizado || '',
    cantidad: Number(producto?.cantidad || 1),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
