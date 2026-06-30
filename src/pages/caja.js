import { escucharPedidosRecientes } from '../services/pedidos.service.js';
import { escucharEgresos, registrarEgreso } from '../services/egresos.service.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast, getCurrentUserProfile } from '../main.js';

let unsubscribePedidos = null;
let unsubscribeEgresos = null;
let allPedidos = [];
let allEgresos = [];
let activeTab = 'hoy'; // 'hoy' o 'rango'

export function renderCaja() {
  const hoyStr = new Date().toISOString().split('T')[0];

  return `
    <style>
      .caja-layout {
        display: flex;
        flex-direction: column;
        gap: 24px;
        height: 100%;
      }
      
      .caja-filters-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: var(--shadow-sm);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
      }
      
      .filter-tabs {
        display: inline-flex;
        background: var(--bg-app);
        padding: 4px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
      }
      
      .filter-tab-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 8px 16px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: var(--radius-xs);
        transition: all var(--t-fast);
      }
      
      .filter-tab-btn.active {
        background: var(--bg-card);
        color: var(--text-primary);
        box-shadow: var(--shadow-xs);
      }
      
      .date-inputs-container {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        transition: opacity var(--t-normal);
      }
      
      .date-inputs-container.hidden {
        display: none !important;
      }
      
      .caja-date-input {
        background: var(--bg-input);
        border: 1px solid var(--border);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: var(--radius-xs);
        font-family: var(--font-sans);
        font-size: 0.88rem;
        outline: none;
      }
      
      .caja-date-input:focus {
        border-color: var(--border-strong);
        background: var(--bg-input-focus);
      }
      
      .caja-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      
      .summary-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 4px;
        position: relative;
        overflow: hidden;
      }
      
      .summary-card.total-card {
        border-left: 4px solid var(--accent);
      }
      
      .summary-card.efectivo-card {
        border-left: 4px solid var(--success);
      }
      
      .summary-card.transferencia-card {
        border-left: 4px solid var(--info);
      }
      
      .summary-card.tarjeta-card {
        border-left: 4px solid #8e44ad;
      }
      
      .summary-card-title {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      
      .summary-card-value {
        font-size: 1.65rem;
        font-weight: 800;
        font-family: var(--font-mono);
        color: var(--text-primary);
        margin-top: 4px;
      }
      
      .caja-table-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
      }
      
      .caja-table-header {
        padding: 20px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
      }
      
      .caja-table-title {
        font-size: 1rem;
        font-weight: 800;
        color: var(--text-primary);
      }
      
      .caja-table-wrap {
        overflow-x: auto;
      }
      
      .caja-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
        text-align: left;
      }
      
      .caja-table th {
        background: #fafafa;
        color: var(--text-secondary);
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        padding: 14px 18px;
        border-bottom: 1.5px solid var(--border);
      }
      
      .caja-table td {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border);
        color: var(--text-primary);
        vertical-align: middle;
      }
      
      .caja-table tr:hover td {
        background: var(--bg-card-hover);
      }
      
      .badge-metodo {
        font-size: 0.72rem;
        padding: 3px 8px;
        border-radius: var(--radius-full);
        font-weight: 700;
        display: inline-block;
      }
      
      .badge-efectivo {
        background: var(--success-subtle);
        color: var(--success-text);
      }
      
      .badge-transferencia {
        background: var(--info-subtle);
        color: var(--info);
      }
      
      .badge-tarjeta {
        background: rgba(142, 68, 173, 0.1);
        color: #8e44ad;
      }
      
      .badge-otro {
        background: var(--border-strong);
        color: var(--text-secondary);
      }
      
      .no-movements {
        padding: 60px 20px;
        text-align: center;
        color: var(--text-tertiary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      
      .no-movements span {
        font-weight: 600;
        color: var(--text-secondary);
      }
    </style>
    
    <main class="page-container">
      <header class="page-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 class="page-title">Flujo de Caja</h1>
          <p class="page-subtitle">Monitoreo de ingresos y pagos registrados en el sistema</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-egreso" type="button">
          Registrar Egreso
        </button>
      </header>
      
      <div class="caja-layout">
        <!-- Filtros -->
        <div class="caja-filters-card">
          <div class="filter-tabs">
            <button class="filter-tab-btn active" id="tab-hoy" type="button">Hoy</button>
            <button class="filter-tab-btn" id="tab-rango" type="button">Rango de fechas</button>
          </div>
          
          <div class="date-inputs-container hidden" id="date-inputs">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">Desde:</span>
              <input type="date" class="caja-date-input" id="caja-date-start" value="${hoyStr}">
              <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">Hasta:</span>
              <input type="date" class="caja-date-input" id="caja-date-end" value="${hoyStr}">
            </div>
            <div class="caja-shortcuts" style="display:flex; gap:8px; border-left:1px solid var(--border); padding-left:12px; margin-left:4px;">
              <button type="button" class="btn btn-secondary btn-xs" id="shortcut-semana" style="padding: 6px 10px; font-size: 0.72rem; font-weight: 700; line-height: 1;">Semana en curso</button>
              <button type="button" class="btn btn-secondary btn-xs" id="shortcut-7dias" style="padding: 6px 10px; font-size: 0.72rem; font-weight: 700; line-height: 1;">Últimos 7 días</button>
              <button type="button" class="btn btn-secondary btn-xs" id="shortcut-30dias" style="padding: 6px 10px; font-size: 0.72rem; font-weight: 700; line-height: 1;">Últimos 30 días</button>
            </div>
          </div>
          
          <div class="search-wrap" style="max-width: 320px; width: 100%; margin: 0;">
            <svg class="search-icon icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" class="search-input" id="search-caja" placeholder="Buscar por cliente o pedido...">
          </div>
        </div>
        
        <!-- Resumen -->
        <div class="caja-summary-grid">
          <div class="summary-card total-card">
            <span class="summary-card-title">Balance Neto</span>
            <span class="summary-card-value" id="sum-total">$0.00</span>
          </div>
          <div class="summary-card efectivo-card">
            <span class="summary-card-title">Efectivo Neto</span>
            <span class="summary-card-value" id="sum-efectivo">$0.00</span>
          </div>
          <div class="summary-card transferencia-card">
            <span class="summary-card-title">Transferencia Neta</span>
            <span class="summary-card-value" id="sum-transferencia">$0.00</span>
          </div>
          <div class="summary-card tarjeta-card">
            <span class="summary-card-title">Tarjeta Neta</span>
            <span class="summary-card-value" id="sum-tarjeta">$0.00</span>
          </div>
        </div>
        
        <!-- Tabla de Detalle -->
        <div class="caja-table-card">
          <div class="caja-table-header">
            <div>
              <span class="caja-table-title" id="caja-table-title">Movimientos Registrados</span>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; display:flex; gap:16px;" id="caja-totals-detail">
                <span>Ingresos: <strong style="color:var(--success-text);" id="detail-ingresos">$0.00</strong></span>
                <span>Egresos: <strong style="color:var(--danger-text);" id="detail-egresos">$0.00</strong></span>
              </div>
            </div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); background:var(--bg-app); padding:4px 10px; border-radius:var(--radius-full);" id="movements-count">0 movimientos</span>
          </div>
          <div class="caja-table-wrap">
            <table class="caja-table">
              <thead>
                <tr>
                  <th id="caja-th-fecha">Fecha y Hora</th>
                  <th>Tipo</th>
                  <th>Pedido</th>
                  <th>Concepto / Cliente</th>
                  <th>Método de Pago</th>
                  <th>Registrado Por</th>
                  <th style="text-align: right;">Monto</th>
                </tr>
              </thead>
              <tbody id="caja-table-body">
                <tr>
                  <td colspan="6" style="text-align:center; padding: 40px 0;">
                    <div class="spinner" style="margin: 0 auto 10px;"></div>
                    <span style="color:var(--text-secondary);">Cargando movimientos de dinero...</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  `;
}

export function bindCajaEvents() {
  const tabHoy = document.getElementById('tab-hoy');
  const tabRango = document.getElementById('tab-rango');
  const dateInputs = document.getElementById('date-inputs');
  const dateStart = document.getElementById('caja-date-start');
  const dateEnd = document.getElementById('caja-date-end');
  const searchInput = document.getElementById('search-caja');

  // Eventos para Tabs
  tabHoy?.addEventListener('click', () => {
    if (activeTab === 'hoy') return;
    activeTab = 'hoy';
    tabHoy.classList.add('active');
    tabRango?.classList.remove('active');
    dateInputs?.classList.add('hidden');
    renderCajaData();
  });

  tabRango?.addEventListener('click', () => {
    if (activeTab === 'rango') return;
    activeTab = 'rango';
    tabRango.classList.add('active');
    tabHoy?.classList.remove('active');
    dateInputs?.classList.remove('hidden');
    renderCajaData();
  });

  // Eventos de Filtro
  dateStart?.addEventListener('change', renderCajaData);
  dateEnd?.addEventListener('change', renderCajaData);
  searchInput?.addEventListener('input', renderCajaData);

  // Atajos rápidos de fecha
  const shortcutSemana = document.getElementById('shortcut-semana');
  const shortcut7dias = document.getElementById('shortcut-7dias');
  const shortcut30dias = document.getElementById('shortcut-30dias');

  const setDatesAndRefresh = (start, end) => {
    if (dateStart) dateStart.value = toLocalYYYYMMDD(start);
    if (dateEnd) dateEnd.value = toLocalYYYYMMDD(end);
    renderCajaData();
  };

  shortcutSemana?.addEventListener('click', () => {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const lunes = new Date(hoy);
    const diffLunes = diaSemana === 0 ? -6 : -(diaSemana - 1);
    lunes.setDate(hoy.getDate() + diffLunes);
    setDatesAndRefresh(lunes, hoy);
  });

  shortcut7dias?.addEventListener('click', () => {
    const hoy = new Date();
    const hace7 = new Date(hoy);
    hace7.setDate(hoy.getDate() - 7);
    setDatesAndRefresh(hace7, hoy);
  });

  shortcut30dias?.addEventListener('click', () => {
    const hoy = new Date();
    const hace30 = new Date(hoy);
    hace30.setDate(hoy.getDate() - 30);
    setDatesAndRefresh(hace30, hoy);
  });

  // Registrar Egreso btn click
  document.getElementById('btn-nuevo-egreso')?.addEventListener('click', showEgresoModal);

  // Escuchar cambios en los pedidos (tiempo real)
  unsubscribePedidos = escucharPedidosRecientes(500, (pedidos) => {
    allPedidos = pedidos;
    renderCajaData();
  });

  // Escuchar cambios en los egresos (tiempo real)
  unsubscribeEgresos = escucharEgresos(500, (egresos) => {
    allEgresos = egresos;
    renderCajaData();
  });
}

export function cleanupCaja() {
  if (unsubscribePedidos) {
    unsubscribePedidos();
    unsubscribePedidos = null;
  }
  if (unsubscribeEgresos) {
    unsubscribeEgresos();
    unsubscribeEgresos = null;
  }
  allPedidos = [];
  allEgresos = [];
  activeTab = 'hoy';
}

function renderCajaData() {
  const tbody = document.getElementById('caja-table-body');
  if (!tbody) return;

  const dateStart = document.getElementById('caja-date-start');
  const dateEnd = document.getElementById('caja-date-end');
  const searchVal = document.getElementById('search-caja')?.value.trim().toLowerCase() || '';

  // 1. Extraer e integrar todos los ingresos (abonos) y egresos
  const movimientosList = [];

  // Ingresos (Abonos de Pedidos)
  allPedidos.forEach(pedido => {
    const abonos = pedido.abonos || [];
    abonos.forEach(abono => {
      movimientosList.push({
        id_movimiento: abono.id_abono,
        tipo_movimiento: 'ingreso',
        fecha_pago: abono.fecha_pago,
        monto: Number(abono.monto) || 0,
        metodo_pago: abono.metodo_pago || 'Efectivo',
        cliente_nombre: pedido.cliente_nombre,
        id_pedido: pedido.id_pedido,
        pedidoDocId: pedido._docId,
        usuario: abono.usuario,
        pedido_historial: pedido.historial_estados || []
      });
    });
  });

  // Egresos
  allEgresos.forEach(egreso => {
    movimientosList.push({
      id_movimiento: egreso._docId,
      tipo_movimiento: 'egreso',
      fecha_pago: egreso.fecha,
      monto: Number(egreso.monto) || 0,
      metodo_pago: egreso.metodo_pago || 'Efectivo',
      cliente_nombre: egreso.descripcion || 'Egreso registrado',
      id_pedido: '-',
      pedidoDocId: null,
      usuario: egreso.usuario,
      pedido_historial: []
    });
  });

  // 2. Filtrar por Fecha según la pestaña activa
  let startLimit = null;
  let endLimit = null;

  if (activeTab === 'hoy') {
    const hoy = new Date();
    startLimit = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    endLimit = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
  } else {
    const valStart = dateStart?.value;
    const valEnd = dateEnd?.value;
    if (valStart) startLimit = new Date(valStart + 'T00:00:00');
    if (valEnd) endLimit = new Date(valEnd + 'T23:59:59');
  }

  let filtered = movimientosList.filter(mov => {
    const dateObj = mov.fecha_pago?.toDate ? mov.fecha_pago.toDate() : new Date(mov.fecha_pago || 0);
    
    // Filtro por Fecha
    if (startLimit && dateObj < startLimit) return false;
    if (endLimit && dateObj > endLimit) return false;

    // Filtro por Búsqueda (Cliente/Concepto o Pedido ID)
    if (searchVal) {
      const matchCliente = mov.cliente_nombre.toLowerCase().includes(searchVal);
      const matchPedido = mov.id_pedido.toLowerCase().includes(searchVal);
      if (!matchCliente && !matchPedido) return false;
    }

    return true;
  });

  // Ordenar movimientos por fecha de forma descendente (más reciente primero)
  filtered.sort((a, b) => {
    const dateA = a.fecha_pago?.toDate ? a.fecha_pago.toDate() : new Date(a.fecha_pago || 0);
    const dateB = b.fecha_pago?.toDate ? b.fecha_pago.toDate() : new Date(b.fecha_pago || 0);
    return dateB - dateA;
  });

  // Update Title based on mode
  const titleEl = document.getElementById('caja-table-title');
  if (titleEl) {
    titleEl.textContent = activeTab === 'hoy' ? 'Movimientos de Hoy' : 'Movimientos en Rango';
  }

  // Update Count Badge
  const countEl = document.getElementById('movements-count');
  if (countEl) {
    countEl.textContent = `${filtered.length} movimiento(s)`;
  }

  // 3. Calcular Resúmenes y Balance Neto (Ingresos - Egresos)
  const resumen = {
    Efectivo: 0,
    Transferencia: 0,
    Tarjeta: 0,
    Total: 0
  };
  let totalIngresos = 0;
  let totalEgresos = 0;

  filtered.forEach(mov => {
    const monto = Number(mov.monto) || 0;
    const esIngreso = mov.tipo_movimiento === 'ingreso';
    const factor = esIngreso ? 1 : -1;

    resumen.Total += (monto * factor);
    if (esIngreso) {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }

    const met = (mov.metodo_pago || '').toLowerCase();
    if (met === 'efectivo') {
      resumen.Efectivo += (monto * factor);
    } else if (met === 'transferencia') {
      resumen.Transferencia += (monto * factor);
    } else if (met === 'tarjeta') {
      resumen.Tarjeta += (monto * factor);
    }
  });

  // Renderizar Resúmenes en la UI
  const totalValueEl = document.getElementById('sum-total');
  if (totalValueEl) {
    totalValueEl.textContent = formatCurrency(resumen.Total);
    totalValueEl.style.color = resumen.Total >= 0 ? 'var(--success-text)' : 'var(--danger-text)';
  }
  
  document.getElementById('sum-efectivo').textContent = formatCurrency(resumen.Efectivo);
  document.getElementById('sum-transferencia').textContent = formatCurrency(resumen.Transferencia);
  document.getElementById('sum-tarjeta').textContent = formatCurrency(resumen.Tarjeta);

  // Renderizar Totales Específicos
  const detailIngresos = document.getElementById('detail-ingresos');
  const detailEgresos = document.getElementById('detail-egresos');
  if (detailIngresos) detailIngresos.textContent = formatCurrency(totalIngresos);
  if (detailEgresos) detailEgresos.textContent = formatCurrency(totalEgresos);

  const thFecha = document.getElementById('caja-th-fecha');
  if (thFecha) {
    thFecha.textContent = activeTab === 'hoy' ? 'Hora' : 'Fecha y Hora';
  }

  // 4. Renderizar Filas de la Tabla
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="no-movements">
            <svg class="icon icon-xl" style="stroke: var(--text-tertiary);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>
            <span>Sin movimientos</span>
            <p style="font-size:0.8rem; max-width:320px; color: var(--text-tertiary); margin-top:2px;">No se registraron movimientos en el período seleccionado.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const dateObj = a.fecha_pago?.toDate ? a.fecha_pago.toDate() : new Date(a.fecha_pago || 0);
    
    let fechaStr = '';
    if (activeTab === 'hoy') {
      fechaStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } else {
      fechaStr = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                 dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }

    let registradoPor = 'Sistema';
    if (a.usuario?.nombre) {
      registradoPor = a.usuario.nombre;
    } else if (a.pedido_historial && a.pedido_historial.length > 0) {
      const timeAbono = dateObj.getTime();
      const entradasValidas = a.pedido_historial.filter(h => 
        (h.tipo === 'pago' || h.tipo === 'creacion') && h.usuario?.nombre
      );

      if (entradasValidas.length > 0) {
        let masCercana = entradasValidas[0];
        const getTimestamp = (h) => h.fecha?.toDate ? h.fecha.toDate().getTime() : new Date(h.fecha || 0).getTime();
        let minDiff = Math.abs(getTimestamp(masCercana) - timeAbono);

        for (let i = 1; i < entradasValidas.length; i++) {
          const diff = Math.abs(getTimestamp(entradasValidas[i]) - timeAbono);
          if (diff < minDiff) {
            minDiff = diff;
            masCercana = entradasValidas[i];
          }
        }
        registradoPor = masCercana.usuario.nombre;
      }
    }

    let badgeClass = 'badge-otro';
    const met = (a.metodo_pago || '').toLowerCase();
    if (met === 'efectivo') badgeClass = 'badge-efectivo';
    else if (met === 'transferencia') badgeClass = 'badge-transferencia';
    else if (met === 'tarjeta') badgeClass = 'badge-tarjeta';

    const esIngreso = a.tipo_movimiento === 'ingreso';
    const sign = esIngreso ? '+' : '-';
    const colorMonto = esIngreso ? 'var(--success-text)' : 'var(--danger-text)';
    
    const badgeTipo = esIngreso 
      ? `<span class="badge-metodo badge-efectivo" style="font-size:0.65rem;">Ingreso</span>`
      : `<span class="badge-metodo" style="background:rgba(229,57,53,0.1); color:var(--danger-text); font-size:0.65rem;">Egreso</span>`;

    const pedidoCol = a.pedidoDocId 
      ? `<a href="/taller/${a.pedidoDocId}" class="caja-pedido-link" data-doc-id="${a.pedidoDocId}" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent); text-decoration: none;">${a.id_pedido}</a>`
      : `<span style="color:var(--text-tertiary); font-family: var(--font-mono); font-size:0.85rem;">-</span>`;

    return `
      <tr>
        <td style="color: var(--text-secondary); font-size:0.85rem;">${fechaStr}</td>
        <td>${badgeTipo}</td>
        <td>${pedidoCol}</td>
        <td style="font-weight: 600;">${a.cliente_nombre}</td>
        <td>
          <span class="badge-metodo ${badgeClass}">${a.metodo_pago}</span>
        </td>
        <td style="color: var(--text-secondary); font-size:0.85rem;">${registradoPor}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; text-align: right; color: ${colorMonto}; font-size: 0.95rem;">
          ${sign}${formatCurrency(a.monto)}
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos de click en los enlaces a los pedidos
  tbody.querySelectorAll('.caja-pedido-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const docId = link.dataset.docId;
      if (docId) {
        history.pushState(null, '', `/taller/${docId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  });
}

function showEgresoModal() {
  document.getElementById('egreso-modal')?.remove();

  const modalHtml = `
    <div class="modal-overlay" id="egreso-modal" style="display: flex;">
      <div class="modal-card" style="margin: auto; max-width: 420px; width: 100%;">
        <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Registrar Egreso</div>

        <form id="egreso-form" novalidate style="display:flex; flex-direction:column; gap:16px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label form-required">Concepto / Descripción</label>
            <input type="text" class="form-input" id="egreso-descripcion"
              placeholder="Ej. Insumos, servicios, herramientas..." required autofocus />
          </div>
          
          <div class="form-group" style="margin:0;">
            <label class="form-label form-required">Monto</label>
            <input type="number" class="form-input form-mono" id="egreso-monto"
              min="0.01" step="0.01" placeholder="0.00" required />
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Método de pago</label>
            <select class="form-select" id="egreso-metodo">
              <option value="Efectivo" selected>Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
            </select>
          </div>

          <div class="modal-actions" style="margin-top: 8px; display: flex; gap: 10px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-egreso-modal" style="flex: 1;">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-confirm-egreso-modal" style="flex: 2;">Registrar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('egreso-modal');
  const form = document.getElementById('egreso-form');

  document.getElementById('btn-cancel-egreso-modal')?.addEventListener('click', () => modal?.remove());
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const descripcion = document.getElementById('egreso-descripcion')?.value.trim();
    const monto = Number(document.getElementById('egreso-monto')?.value);
    const metodo_pago = document.getElementById('egreso-metodo')?.value || 'Efectivo';
    const btn = document.getElementById('btn-confirm-egreso-modal');

    if (!descripcion) {
      showToast('Ingresa un concepto para el egreso.', 'error');
      return;
    }
    if (!monto || monto <= 0) {
      showToast('Ingresa un monto válido.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div> Registrando...';
    }

    try {
      await registrarEgreso({
        descripcion,
        monto,
        metodo_pago,
        usuario: getCurrentUserProfile()
      });
      showToast('Egreso registrado con éxito.', 'success');
      modal?.remove();
    } catch (err) {
      console.error(err);
      showToast('Error al registrar el egreso: ' + err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Registrar';
      }
    }
  });

  setTimeout(() => document.getElementById('egreso-descripcion')?.focus(), 80);
}

function toLocalYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
