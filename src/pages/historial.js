import { escucharPedidosRecientes, eliminarPedido } from '../services/pedidos.service.js';
import { renderPedidoCard } from '../components/pedidoCard.js';
import { showAbonoModal } from '../components/abonoForm.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast, getCurrentUserProfile } from '../main.js';
import { imprimirRecibo } from '../services/print.service.js';

let unsubscribe = null;
let allPedidos = [];
let selectedDateKey = null;

export function renderHistorial() {
  return `
    <main class="page-container" style="height: 100%; display: flex; flex-direction: column;">
      <header class="page-header" style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 class="page-title">Historial de Pedidos</h1>
          <p class="page-subtitle">Registro histórico agrupado por fechas</p>
        </div>
        <div class="search-wrap" style="max-width: 400px; width: 100%;">
          <svg class="search-icon icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" id="search-historial" placeholder="Buscar por cliente o número...">
        </div>
      </header>

      <div class="history-layout" id="history-layout">
        <!-- Left Pane: Dates List -->
        <div class="history-left-pane" id="history-left-pane">
          <div class="loading-center" style="padding: 40px 0;">
            <div class="spinner"></div>
            <span>Cargando fechas...</span>
          </div>
        </div>

        <!-- Right Pane: Selected Date Orders -->
        <div class="history-right-pane" id="history-right-pane">
          <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:var(--text-tertiary); text-align:center; padding:40px;">
            <svg class="icon icon-xl" style="margin-bottom:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span style="font-weight:600;">Selecciona una fecha</span>
            <span style="font-size:0.8rem; margin-top:4px;">Elige un día de la lista para ver sus pedidos</span>
          </div>
        </div>
      </div>
    </main>
  `;
}

export function bindHistorialEvents() {
  const searchInput = document.getElementById('search-historial');
  
  // Real-time listener (up to 500 recent orders for comprehensive history)
  unsubscribe = escucharPedidosRecientes(500, (pedidos) => {
    allPedidos = pedidos;
    renderFilteredHistory();
  });

  searchInput?.addEventListener('input', () => {
    renderFilteredHistory();
  });

  // Global click to dismiss dropdown menus
  document.addEventListener('click', dismissDropdowns);
}

export function cleanupHistorial() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  document.removeEventListener('click', dismissDropdowns);
  selectedDateKey = null;
}

function dismissDropdowns() {
  document.querySelectorAll('.product-dropdown-menu.show').forEach(m => m.classList.remove('show'));
}

function renderFilteredHistory() {
  const leftPane = document.getElementById('history-left-pane');
  const rightPane = document.getElementById('history-right-pane');
  const layout = document.getElementById('history-layout');
  if (!leftPane || !rightPane || !layout) return;

  const searchTerm = document.getElementById('search-historial')?.value.trim().toLowerCase() || '';

  // Filter orders by search term
  const filtered = allPedidos.filter(p => {
    return !searchTerm ||
      p.cliente_nombre.toLowerCase().includes(searchTerm) ||
      p.id_pedido.toLowerCase().includes(searchTerm);
  });

  // Group orders chronologically by date (YYYY-MM-DD)
  const groupsMap = new Map();
  
  filtered.forEach(p => {
    const dateObj = p.fecha_creacion?.toDate ? p.fecha_creacion.toDate() : new Date(p.fecha_creacion || 0);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;

    if (!groupsMap.has(key)) {
      const label = dateObj.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
      groupsMap.set(key, {
        label: capitalizedLabel,
        pedidos: []
      });
    }
    groupsMap.get(key).pedidos.push(p);
  });

  const keys = Array.from(groupsMap.keys());
  const isMobile = window.innerWidth <= 768;

  // On desktop, auto-select first date if none active or no longer exists
  if (keys.length > 0 && !isMobile) {
    if (!selectedDateKey || !groupsMap.has(selectedDateKey)) {
      selectedDateKey = keys[0];
    }
  }

  // 1. Render Left Pane (Dates List)
  if (keys.length === 0) {
    leftPane.innerHTML = `
      <div style="color:var(--text-tertiary); text-align:center; padding:40px 10px; font-size:0.85rem;">
        No hay registros
      </div>
    `;
  } else {
    leftPane.innerHTML = keys.map(key => {
      const group = groupsMap.get(key);
      const isActive = selectedDateKey === key;
      return `
        <div class="history-date-item ${isActive ? 'active' : ''}" data-date-key="${key}">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span class="history-date-label">${group.label}</span>
            <span class="history-date-count">${group.pedidos.length} pedido(s)</span>
          </div>
          <div style="color:var(--text-tertiary); font-size:0.8rem;">▶</div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Right Pane (Selected Date Orders)
  if (isMobile) {
    if (selectedDateKey) {
      layout.classList.add('show-detail');
    } else {
      layout.classList.remove('show-detail');
    }
  }

  if (!selectedDateKey || !groupsMap.has(selectedDateKey)) {
    rightPane.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:var(--text-tertiary); text-align:center; padding:40px;">
        <svg class="icon icon-xl" style="margin-bottom:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <span style="font-weight:600;">Selecciona una fecha</span>
        <span style="font-size:0.8rem; margin-top:4px;">Elige un día de la lista de la izquierda para ver sus pedidos</span>
      </div>
    `;
  } else {
    const selectedGroup = groupsMap.get(selectedDateKey);
    const backBtnHtml = isMobile ? `
      <button class="btn btn-secondary btn-sm" id="btn-back-to-dates" style="margin-bottom: 16px; display:inline-flex; align-items:center; gap:6px; padding:6px 12px;">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Volver a las fechas
      </button>
    ` : '';

    rightPane.innerHTML = `
      ${backBtnHtml}
      <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <span>${selectedGroup.label}</span>
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); background:var(--border-strong); padding:2px 8px; border-radius:var(--radius-full);">${selectedGroup.pedidos.length} pedido(s)</span>
      </div>
      <div class="pedidos-grid" style="grid-template-columns: 1fr; gap:12px;">
        ${selectedGroup.pedidos.map(p => renderPedidoCard(p)).join('')}
      </div>
    `;
  }

  // 3. Bind Event Listeners
  // Click on left-pane date item
  leftPane.querySelectorAll('.history-date-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedDateKey = item.dataset.dateKey;
      renderFilteredHistory();
    });
  });

  // Click on mobile back button
  if (isMobile) {
    document.getElementById('btn-back-to-dates')?.addEventListener('click', () => {
      selectedDateKey = null;
      renderFilteredHistory();
    });
  }

  // Click on cards or card actions
  rightPane.querySelectorAll('.pedido-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Check if abono amount was clicked
      const abonoBtn = e.target.closest('.pedido-card-amount-action');
      if (abonoBtn) {
        e.stopPropagation();
        const docId = abonoBtn.dataset.abonoPedidoId;
        const ped = allPedidos.find(p => p._docId === docId);
        if (ped) {
          showAbonoModal(ped);
        }
        return;
      }

      // Toggle card dropdown
      const toggle = e.target.closest('[data-card-dropdown-toggle]');
      if (toggle) {
        e.stopPropagation();
        const menuId = toggle.dataset.cardDropdownToggle;
        document.querySelectorAll('.product-dropdown-menu.show').forEach(m => {
          if (m.id !== menuId) m.classList.remove('show');
        });
        document.getElementById(menuId)?.classList.toggle('show');
        return;
      }

      // Edit action
      const editBtn = e.target.closest('[data-card-edit]');
      if (editBtn) {
        e.stopPropagation();
        const docId = editBtn.dataset.cardEdit;
        history.pushState(null, '', `/pedidos?edit=${docId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      // Delete action
      const removeBtn = e.target.closest('[data-card-remove]');
      if (removeBtn) {
        e.stopPropagation();
        const docId = removeBtn.dataset.cardRemove;
        handleDeletePedido(docId);
        return;
      }

      // Print action
      const printBtn = e.target.closest('[data-card-print]');
      if (printBtn) {
        e.stopPropagation();
        const docId = printBtn.dataset.cardPrint;
        const ped = allPedidos.find(p => p._docId === docId);
        if (ped) {
          imprimirRecibo(ped);
        }
        return;
      }

      // Default click: View detail on Taller page
      if (e.target.closest('.product-dropdown-menu')) return;
      const docId = card.dataset.docId;
      history.pushState(null, '', `/taller/${docId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}

async function handleDeletePedido(docId) {
  if (!confirm('¿Estás seguro de eliminar este pedido permanentemente?')) return;
  try {
    await eliminarPedido(docId);
    showToast('Pedido eliminado', 'success');
  } catch (err) {
    showToast('Error al eliminar: ' + err.message, 'error');
  }
}
