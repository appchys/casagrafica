import { renderPedidoCard } from '../components/pedidoCard.js';
import { obtenerNotificacionesPedido, obtenerPedidoPorIdPedido, marcarComoLeida, marcarTodasComoLeidas } from '../services/notificaciones.service.js';
import { formatDate } from '../utils/formatters.js';
import { showToast } from '../main.js';

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
        <div id="notifications-toolbar" style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <button type="button" class="btn btn-sm btn-secondary" id="btn-marcar-todas-leidas">Marcar todas como leídas</button>
        </div>
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

  document.getElementById('btn-marcar-todas-leidas')?.addEventListener('click', async () => {
    try {
      await marcarTodasComoLeidas();
      showToast('Todas las notificaciones marcadas como leídas', 'success');
      await bindNotificacionesEvents();
    } catch {
      showToast('Error al marcar notificaciones', 'error');
    }
  });

  try {
    allNotifications = await obtenerNotificacionesPedido(100);
    if (allNotifications.length === 0) {
      listEl.innerHTML = '<div class="empty-msg">No hay notificaciones registradas aún.</div>';
      return;
    }

    const itemsHtml = await Promise.all(allNotifications.map(async (item) => {
      const fecha = item.fecha?.toDate ? item.fecha.toDate() : new Date(item.fecha?.seconds ? item.fecha.seconds * 1000 : Date.now());
      const actor = item.usuario?.nombre || item.usuario?.email || 'Sistema';
      const esLeida = item.leida === true;

      const notifBodyId = `notif-body-${item._docId}`;

      const cardHtml = (bodyContent) => `
        <div class="notification-item" style="border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-card); display:grid;" data-notif-id="${item._docId}">
          <div class="notif-header" style="display:grid; gap:4px; padding:12px 14px; cursor:pointer;" data-target="${notifBodyId}">
            <div style="display:flex; align-items:center; gap:8px; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                ${!esLeida ? '<span class="notif-unread-dot" style="width:8px; height:8px; border-radius:50%; background:var(--accent); flex-shrink:0;"></span>' : ''}
                <span class="pedido-card-id" style="${esLeida ? 'color:var(--text-tertiary); background:transparent;' : ''}">#${item.id_pedido || item.pedido_id || 'N/A'}</span>
                <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary);">${item.tipo === 'eliminado' ? 'Pedido eliminado' : obtenerTextoCambio(item)}</div>
              </div>
              <svg class="notif-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; color:var(--text-tertiary); transition:transform 0.2s; transform:rotate(-90deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div style="display:flex; align-items:center; gap:12px; font-size:0.78rem; color:var(--text-secondary);">
              <span>${escapeHtml(actor)}</span>
              <span>${formatDate(fecha)}</span>
              ${!esLeida
                ? `<button type="button" class="btn-marcar-leida" data-notif-id="${item._docId}" style="background:none; border:none; cursor:pointer; color:var(--accent); padding:0; display:inline-flex; align-items:center;" title="Marcar como leída">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                   </button>`
                : `<span style="color:var(--text-tertiary); display:inline-flex; align-items:center;" title="Leída">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                   </span>`}
            </div>
          </div>
          <div id="${notifBodyId}" class="notif-body" style="display:none; gap:12px; padding:0 14px 14px;">
            ${bodyContent}
          </div>
        </div>
      `;

      if (item.tipo === 'eliminado') {
        const pedidoEliminado = construirSnapshotPedidoEliminado(item.pedido_eliminado);
        return { html: cardHtml(`
          <div style="display:flex; gap:12px; align-items:stretch; flex-wrap:nowrap;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); margin-bottom:6px;">Antes</div>
              ${renderPedidoCard(pedidoEliminado)}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:0 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>
            <div style="flex:1; min-width:0; display:flex; align-items:center; justify-content:center;">
              <div style="text-align:center; padding:32px 16px; border:2px dashed var(--danger-text); border-radius:var(--radius-md); background:var(--danger-subtle, #fef2f2); color:var(--danger-text); width:100%;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:40px; height:40px; margin-bottom:8px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <div style="font-weight:800; font-size:1rem;">Eliminado</div>
              </div>
            </div>
          </div>
        `), leida: esLeida, fechaLectura: item.fecha_lectura || null };
      }

      const pedidoActual = await obtenerPedidoPorIdPedido(item.id_pedido || item.pedido_id);
      const originalPedido = construirSnapshotPedido(item, 'original', pedidoActual);
      const nuevoPedido = construirSnapshotPedido(item, 'nuevo', pedidoActual);

      return { html: cardHtml(`
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
      `), leida: esLeida, fechaLectura: item.fecha_lectura || null };
    }));

    const noLeidas = itemsHtml.filter(r => !r.leida).map(r => r.html).join('');
    const leidas = itemsHtml.filter(r => r.leida)
      .sort((a, b) => {
        const fa = a.fechaLectura?.toDate?.() || new Date(0);
        const fb = b.fechaLectura?.toDate?.() || new Date(0);
        return fb - fa;
      })
      .map(r => r.html).join('');

    const sectionHtml = (title, content, isFirst, startCollapsed) => content ? `
      <div class="notif-section" style="margin-top:${isFirst ? '0' : '24px'};">
        <div class="notif-section-header" style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 0; user-select:none;" data-section-target="${title}-body">
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; transition:transform 0.2s; ${startCollapsed ? 'transform:rotate(-90deg);' : ''}"><polyline points="6 9 12 15 18 9"></polyline></svg>
          <div style="font-size:0.82rem; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.5px;">${title}</div>
        </div>
        <div id="${title}-body" class="notif-section-body" style="display:${startCollapsed ? 'none' : 'grid'}; gap:8px; margin-top:8px;">
          ${content}
        </div>
      </div>
    ` : '';

    listEl.innerHTML = `
      ${sectionHtml('No leídas', noLeidas, true, false)}
      ${sectionHtml('Leídas', leidas, false, true)}
    `;

    document.querySelectorAll('.notif-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.sectionTarget;
        const body = document.getElementById(targetId);
        const chevron = header.querySelector('.section-chevron');
        if (!body) return;
        if (body.style.display === 'none') {
          body.style.display = '';
          if (chevron) chevron.style.transform = '';
        } else {
          body.style.display = 'none';
          if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }
      });
    });

    document.querySelectorAll('.btn-marcar-leida').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const notifId = btn.dataset.notifId;
        const card = document.querySelector(`.notification-item[data-notif-id="${notifId}"]`);
        if (!card) return;

        const unreadDot = card.querySelector('.notif-unread-dot');
        const idSpan = card.querySelector('.pedido-card-id');

        if (unreadDot) unreadDot.remove();

        if (idSpan) {
          idSpan.style.color = 'var(--text-tertiary)';
          idSpan.style.background = 'transparent';
        }

        btn.outerHTML = `<span style="color:var(--text-tertiary); display:inline-flex; align-items:center;" title="Leída"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`;

        const leidasBody = document.getElementById('Leídas-body');
        if (leidasBody) {
          leidasBody.insertBefore(card, leidasBody.firstChild);
          const noLeidasHeader = document.querySelector('.notif-section-header[data-section-target="No leídas-body"]');
          if (noLeidasHeader && !document.querySelector('#No leídas-body .notification-item')) {
            noLeidasHeader.parentElement.style.display = 'none';
          }
          const leidasHeader = document.querySelector('.notif-section-header[data-section-target="Leídas-body"]');
          if (leidasHeader) {
            leidasHeader.parentElement.style.display = '';
          }
        }

        try {
          await marcarComoLeida(notifId);
        } catch {
          showToast('Error al marcar notificación', 'error');
          await bindNotificacionesEvents();
        }
      });
    });

    document.querySelectorAll('.notif-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const targetId = header.dataset.target;
        const body = document.getElementById(targetId);
        if (!body) return;
        const chevron = header.querySelector('.notif-chevron');
        if (body.style.display === 'none') {
          body.style.display = '';
          if (chevron) chevron.style.transform = '';
        } else {
          body.style.display = 'none';
          if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }
      });
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="empty-msg" style="color:var(--danger-text);">Error al cargar las notificaciones.</div>';
  }
}

export function cleanupNotificaciones() {
  allNotifications = [];
}

function obtenerTextoCambio(item) {
  const cambios = Array.isArray(item.cambios) ? item.cambios : [];
  let cambioCliente = false;
  let cambioProductos = false;

  const clienteCambio = cambios.find(c => c.campo === 'cliente');
  if (clienteCambio) {
    const ant = clienteCambio.anterior || {};
    const nue = clienteCambio.nuevo || {};
    if (ant.nombre !== nue.nombre || ant.telefono !== nue.telefono) {
      cambioCliente = true;
    }
  }

  const productosCambio = cambios.find(c => c.campo === 'productos');
  if (productosCambio) {
    const ant = JSON.stringify(productosCambio.anterior || []);
    const nue = JSON.stringify(productosCambio.nuevo || []);
    if (ant !== nue) {
      cambioProductos = true;
    }
  }

  if (cambioCliente && cambioProductos) return 'Cambio en datos del cliente y productos';
  if (cambioCliente) return 'Cambio en datos del cliente';
  if (cambioProductos) return 'Cambio en los productos registrados';
  return 'Cambio detectado';
}

function construirSnapshotPedidoEliminado(pedidoData) {
  if (!pedidoData) {
    return {
      _docId: 'eliminado',
      id_pedido: 'N/A',
      cliente_nombre: 'Sin cliente',
      cliente_telefono: '',
      productos: [],
      saldo_pendiente: 0,
      fecha_creacion: new Date(),
    };
  }
  const productos = Array.isArray(pedidoData.productos)
    ? pedidoData.productos.map(normalizarProductoSnapshot)
    : [];
  return {
    _docId: `${pedidoData.id_pedido || 'eliminado'}-eliminado`,
    id_pedido: pedidoData.id_pedido || 'N/A',
    cliente_nombre: pedidoData.cliente_nombre || 'Sin cliente',
    cliente_telefono: pedidoData.cliente_telefono || '',
    productos,
    saldo_pendiente: Number(pedidoData.saldo_pendiente || 0),
    fecha_creacion: pedidoData.fecha_creacion || new Date(),
  };
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
