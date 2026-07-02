import { escucharPedidosRecientes } from '../services/pedidos.service.js';
import { escucharEgresos, registrarEgreso } from '../services/egresos.service.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast, getCurrentUserProfile } from '../main.js';
import {
  escucharSesionActiva,
  escucharHistorialSesiones,
  abrirSesionCaja,
  cerrarSesionCaja
} from '../services/caja.service.js';

let unsubscribePedidos = null;
let unsubscribeEgresos = null;
let unsubscribeSesionActiva = null;
let unsubscribeHistorialSesiones = null;

let allPedidos = [];
let allEgresos = [];
let sesionActiva = null;
let historialSesiones = [];

let activeTab = 'hoy'; // 'hoy' o 'rango' (Filtro de movimientos)
let activePageTab = 'apertura_cierre'; // 'apertura_cierre' o 'historial' (Pestañas principales)

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
      
      .caja-tab-container-hidden {
        display: none !important;
      }
      
      .caja-page-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0;
      }
      
      .page-tab-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 10px 20px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        position: relative;
        transition: all var(--t-fast);
      }
      
      .page-tab-btn:hover {
        color: var(--text-primary);
      }
      
      .page-tab-btn.active {
        color: var(--text-primary);
      }
      
      .page-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--accent);
        border-radius: var(--radius-full) var(--radius-full) 0 0;
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
        font-size: 16px; /* Evita zoom automático al enfocar en iOS */
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
      <header class="page-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 class="page-title">Flujo de Caja</h1>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-egreso" type="button">
          Registrar Egreso
        </button>
      </header>
      
      <!-- Pestañas Principales de la Página -->
      <div class="caja-page-tabs">
        <button class="page-tab-btn active" id="btn-tab-apertura-cierre" type="button">
          Apertura y Cierre
        </button>
        <button class="page-tab-btn" id="btn-tab-historial" type="button">
          Movimientos
        </button>
      </div>

      <!-- PESTAÑA 2: Historial de Movimientos -->
      <div class="caja-tab-container caja-tab-container-hidden" id="container-historial-movimientos">
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
                    <td colspan="7" style="text-align:center; padding: 40px 0;">
                      <div class="spinner" style="margin: 0 auto 10px;"></div>
                      <span style="color:var(--text-secondary);">Cargando movimientos de dinero...</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 1: Apertura y Cierre de Caja -->
      <div class="caja-tab-container" id="container-apertura-cierre">
        <div id="apertura-cierre-content">
          <div style="text-align: center; padding: 40px 0;">
            <div class="spinner" style="margin: 0 auto 10px;"></div>
            <span style="color:var(--text-secondary);">Cargando estado del turno de caja...</span>
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

  // Eventos para Tabs de Filtros de movimientos
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

  // Eventos de intercambio de Pestañas Principales de la Página
  const btnTabHistorial = document.getElementById('btn-tab-historial');
  const btnTabAperturaCierre = document.getElementById('btn-tab-apertura-cierre');
  const containerHistorial = document.getElementById('container-historial-movimientos');
  const containerAperturaCierre = document.getElementById('container-apertura-cierre');

  const updatePageTabUI = () => {
    if (activePageTab === 'historial') {
      btnTabHistorial?.classList.add('active');
      btnTabAperturaCierre?.classList.remove('active');
      containerHistorial?.classList.remove('caja-tab-container-hidden');
      containerAperturaCierre?.classList.add('caja-tab-container-hidden');
    } else {
      btnTabAperturaCierre?.classList.add('active');
      btnTabHistorial?.classList.remove('active');
      containerAperturaCierre?.classList.remove('caja-tab-container-hidden');
      containerHistorial?.classList.add('caja-tab-container-hidden');
    }
  };

  btnTabHistorial?.addEventListener('click', () => {
    activePageTab = 'historial';
    updatePageTabUI();
  });

  btnTabAperturaCierre?.addEventListener('click', () => {
    activePageTab = 'apertura_cierre';
    updatePageTabUI();
  });

  // Inicializar UI de pestañas
  updatePageTabUI();

  // 1. Escuchar la sesión de caja activa en tiempo real
  unsubscribeSesionActiva = escucharSesionActiva((sesion) => {
    sesionActiva = sesion;
    renderAperturaCierreData();
  });

  // 2. Escuchar el historial de turnos de caja cerrados
  unsubscribeHistorialSesiones = escucharHistorialSesiones(50, (sesiones) => {
    historialSesiones = sesiones;
    renderAperturaCierreData();
  });

  // Escuchar cambios en los pedidos (tiempo real)
  unsubscribePedidos = escucharPedidosRecientes(500, (pedidos) => {
    allPedidos = pedidos;
    renderCajaData();
    renderAperturaCierreData();
  });

  // Escuchar cambios en los egresos (tiempo real)
  unsubscribeEgresos = escucharEgresos(500, (egresos) => {
    allEgresos = egresos;
    renderCajaData();
    renderAperturaCierreData();
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
  if (unsubscribeSesionActiva) {
    unsubscribeSesionActiva();
    unsubscribeSesionActiva = null;
  }
  if (unsubscribeHistorialSesiones) {
    unsubscribeHistorialSesiones();
    unsubscribeHistorialSesiones = null;
  }
  allPedidos = [];
  allEgresos = [];
  sesionActiva = null;
  historialSesiones = [];
  activeTab = 'hoy';
  activePageTab = 'apertura_cierre';
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

function renderAperturaCierreData() {
  const contentEl = document.getElementById('apertura-cierre-content');
  if (!contentEl) return;

  if (!sesionActiva) {
    // CAJA CERRADA
    contentEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr; gap: 24px; max-width: 800px; margin: 0 auto; padding-top: 10px;">
        
        <!-- Estado y Formulario de Apertura -->
        <div class="caja-table-card" style="padding: 30px; border-top: 4px solid var(--accent);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-full); background: var(--danger-subtle); color: var(--danger-text); margin-bottom: 16px;">
              <svg class="icon icon-xl" style="width:28px; height:28px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Caja Cerrada</h2>
          </div>

          <form id="form-abrir-caja" style="max-width: 360px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label form-required">Monto Inicial en Efectivo</label>
              <div style="position: relative; display: flex; align-items: center;">
                <span style="position: absolute; left: 12px; font-family: var(--font-mono); font-weight: 700; color: var(--text-secondary);">$</span>
                <input type="number" id="apertura-monto" class="form-input form-mono" style="padding-left: 28px;" step="0.01" min="0" placeholder="0.00" required value="0.00">
              </div>
            </div>
            <button type="submit" class="btn btn-primary" id="btn-abrir-caja-submit" style="width: 100%; margin-top: 8px;">
              Abrir Caja
            </button>
          </form>
        </div>

        <!-- Historial de Sesiones -->
        ${renderHistorialSesionesHTML()}
      </div>
    `;

    // Vincular evento de apertura
    document.getElementById('form-abrir-caja')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const montoEl = document.getElementById('apertura-monto');
      const monto = Number(montoEl?.value);
      const btn = document.getElementById('btn-abrir-caja-submit');

      if (isNaN(monto) || monto < 0) {
        showToast('Ingresa un monto inicial válido.', 'error');
        return;
      }

      if (!confirm(`¿Estás seguro de que deseas ABRIR la caja con un monto inicial de ${formatCurrency(monto)}?`)) {
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Abriendo...';
      }

      try {
        await abrirSesionCaja({
          monto_apertura: monto,
          usuario: getCurrentUserProfile()
        });
        showToast('Caja abierta exitosamente.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Error al abrir la caja: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Abrir Caja';
        }
      }
    });

  } else {
    // CAJA ABIERTA
    // Calcular totales de la sesión activa
    const fechaApertura = sesionActiva.fecha_apertura?.toDate 
      ? sesionActiva.fecha_apertura.toDate() 
      : (sesionActiva.fecha_apertura?.seconds ? new Date(sesionActiva.fecha_apertura.seconds * 1000) : new Date());

    let ingresosEfectivo = 0;
    let ingresosTransferencia = 0;
    let ingresosTarjeta = 0;

    let egresosEfectivo = 0;
    let egresosTransferencia = 0;
    let egresosTarjeta = 0;

    const movimientosSesion = [];

    allPedidos.forEach(pedido => {
      const abonos = pedido.abonos || [];
      abonos.forEach(abono => {
        const dateObj = abono.fecha_pago?.toDate ? abono.fecha_pago.toDate() : new Date(abono.fecha_pago || 0);
        if (dateObj >= fechaApertura) {
          const monto = Number(abono.monto) || 0;
          const met = (abono.metodo_pago || 'Efectivo').toLowerCase();
          
          if (met === 'efectivo') ingresosEfectivo += monto;
          else if (met === 'transferencia') ingresosTransferencia += monto;
          else if (met === 'tarjeta') ingresosTarjeta += monto;

          movimientosSesion.push({
            id: abono.id_abono,
            tipo: 'ingreso',
            concepto: `Abono: ${pedido.id_pedido} - ${pedido.cliente_nombre}`,
            metodo_pago: abono.metodo_pago || 'Efectivo',
            monto,
            fecha: dateObj,
            usuario: abono.usuario?.nombre || 'Sistema'
          });
        }
      });
    });

    allEgresos.forEach(egreso => {
      const dateObj = egreso.fecha?.toDate ? egreso.fecha.toDate() : new Date(egreso.fecha || 0);
      if (dateObj >= fechaApertura) {
        const monto = Number(egreso.monto) || 0;
        const met = (egreso.metodo_pago || 'Efectivo').toLowerCase();

        if (met === 'efectivo') egresosEfectivo += monto;
        else if (met === 'transferencia') egresosTransferencia += monto;
        else if (met === 'tarjeta') egresosTarjeta += monto;

        movimientosSesion.push({
          id: egreso._docId,
          tipo: 'egreso',
          concepto: egreso.descripcion || 'Egreso registrado',
          metodo_pago: egreso.metodo_pago || 'Efectivo',
          monto,
          fecha: dateObj,
          usuario: egreso.usuario?.nombre || 'Sistema'
        });
      }
    });

    movimientosSesion.sort((a, b) => b.fecha - a.fecha);

    const totalIngresos = ingresosEfectivo + ingresosTransferencia + ingresosTarjeta;
    const totalEgresos = egresosEfectivo + egresosTransferencia + egresosTarjeta;
    const efectivoEstimado = sesionActiva.monto_apertura + ingresosEfectivo - egresosEfectivo;

    const fechaAperturaStr = fechaApertura.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    contentEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; padding-top: 10px;">
        
        <!-- Tarjeta de Estado y Resumen Financiero -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          
          <!-- Estado Caja Abierta -->
          <div class="caja-table-card" style="padding: 20px; border-top: 4px solid var(--success);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <div>
                <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">Turno de Caja Activo</h2>
                <div style="font-size: 0.8rem; color: var(--text-secondary); display:flex; flex-direction:column; gap:2px; margin-top:6px;">
                  <span>Abierto: <strong>${fechaAperturaStr}</strong></span>
                  <span>Por: <strong>${sesionActiva.usuario_apertura?.nombre || 'Desconocido'}</strong></span>
                </div>
              </div>
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--success-subtle); color: var(--success-text);">
                <svg class="icon" style="width:20px; height:20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border); padding-top: 16px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">Monto Inicial (Efectivo):</span>
                <span style="font-family:var(--font-mono); font-weight:700;">${formatCurrency(sesionActiva.monto_apertura)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">(+) Ingresos Efectivo:</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:var(--success-text);">+${formatCurrency(ingresosEfectivo)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">(-) Egresos Efectivo:</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:var(--danger-text);">${egresosEfectivo > 0 ? '-' : ''}${formatCurrency(egresosEfectivo)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:1.05rem; border-top: 1.5px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                <strong style="color:var(--text-primary);">Efectivo Estimado:</strong>
                <strong style="font-family:var(--font-mono); color:var(--accent);">${formatCurrency(efectivoEstimado)}</strong>
              </div>
            </div>
          </div>

          <!-- Otros Medios de Pago (Conciliación) -->
          <div class="caja-table-card" style="padding: 20px;">
            <h3 style="font-size: 0.85rem; font-weight: 800; color: var(--text-secondary); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Otros Métodos (Sesión)</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">Transferencias Netas:</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:var(--info);">${formatCurrency(ingresosTransferencia - egresosTransferencia)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">Tarjetas Netas:</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:#8e44ad;">${formatCurrency(ingresosTarjeta - egresosTarjeta)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.9rem; border-top:1px solid var(--border); padding-top:10px; margin-top:4px;">
                <span style="color:var(--text-secondary);">Balance General en Turno:</span>
                <strong style="font-family:var(--font-mono);">${formatCurrency(totalIngresos - totalEgresos)}</strong>
              </div>
            </div>
          </div>

        </div>

        <!-- Formulario de Arqueo y Cierre -->
        <div style="display: flex; flex-direction: column;">
          
          <div class="caja-table-card" style="padding: 20px;">
            <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 16px;">Arqueo y Cierre</h2>
            
            <form id="form-cerrar-caja" style="display: flex; flex-direction: column; gap: 16px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label form-required">Efectivo Real Físico en Caja</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <span style="position: absolute; left: 12px; font-family: var(--font-mono); font-weight: 700; color: var(--text-secondary);">$</span>
                  <input type="number" id="cierre-real" class="form-input form-mono" style="padding-left: 28px;" step="0.01" min="0" placeholder="0.00" required>
                </div>
              </div>
              <div class="form-group" style="margin: 0;">
                <label class="form-label">Observaciones</label>
                <textarea id="cierre-observaciones" class="form-input" style="min-height: 80px; resize: vertical;" placeholder="Justifica cualquier descuadre de efectivo..."></textarea>
              </div>
              <button type="submit" class="btn btn-primary" id="btn-cerrar-caja-submit" style="width: 100%; margin-top: 8px;">
                Cerrar Caja
              </button>
            </form>
          </div>

        </div>

        <!-- Movimientos de la Sesión Activa -->
        <div class="caja-table-card" style="grid-column: 1 / -1;">
          <div class="caja-table-header" style="padding: 16px 20px;">
            <span class="caja-table-title" style="font-size: 0.95rem;">Movimientos del Turno Activo</span>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); background:var(--bg-app); padding:4px 10px; border-radius:var(--radius-full);">${movimientosSesion.length} movimientos</span>
          </div>
          <div class="caja-table-wrap">
            <table class="caja-table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Usuario</th>
                  <th style="text-align: right;">Monto</th>
                </tr>
              </thead>
              <tbody>
                ${movimientosSesion.length === 0 
                  ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color:var(--text-tertiary);">No hay movimientos registrados en este turno.</td></tr>`
                  : movimientosSesion.map(mov => {
                      const horaStr = mov.fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                      const sign = mov.tipo === 'ingreso' ? '+' : '-';
                      const color = mov.tipo === 'ingreso' ? 'var(--success-text)' : 'var(--danger-text)';
                      const badgeType = mov.tipo === 'ingreso' 
                        ? `<span class="badge-metodo badge-efectivo" style="font-size:0.65rem; padding: 1px 6px;">Ingreso</span>`
                        : `<span class="badge-metodo" style="background:rgba(229,57,53,0.1); color:var(--danger-text); font-size:0.65rem; padding: 1px 6px;">Egreso</span>`;
                      
                      let badgeMethod = 'badge-otro';
                      const met = mov.metodo_pago.toLowerCase();
                      if (met === 'efectivo') badgeMethod = 'badge-efectivo';
                      else if (met === 'transferencia') badgeMethod = 'badge-transferencia';
                      else if (met === 'tarjeta') badgeMethod = 'badge-tarjeta';

                      return `
                        <tr>
                          <td>${horaStr}</td>
                          <td>${badgeType}</td>
                          <td style="font-weight: 600;">${mov.concepto}</td>
                          <td><span class="badge-metodo ${badgeMethod}" style="font-size: 0.65rem; padding: 1px 6px;">${mov.metodo_pago}</span></td>
                          <td>${mov.usuario}</td>
                          <td style="font-family: var(--font-mono); font-weight:700; text-align: right; color: ${color};">
                            ${sign}${formatCurrency(mov.monto)}
                          </td>
                        </tr>
                      `;
                    }).join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Historial de Sesiones -->
        <div style="grid-column: 1 / -1;">
          ${renderHistorialSesionesHTML()}
        </div>
      </div>
    `;

    // Vincular evento de cierre
    document.getElementById('form-cerrar-caja')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const realEl = document.getElementById('cierre-real');
      const obsEl = document.getElementById('cierre-observaciones');
      const real = Number(realEl?.value);
      const observaciones = obsEl?.value || '';
      const btn = document.getElementById('btn-cerrar-caja-submit');

      if (isNaN(real) || real < 0) {
        showToast('Ingresa un monto real de efectivo válido.', 'error');
        return;
      }

      if (!confirm(`¿Estás seguro de que deseas CERRAR la caja con un monto real de ${formatCurrency(real)}?`)) {
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Cerrando turno...';
      }

      try {
        await cerrarSesionCaja(sesionActiva._docId, {
          monto_cierre_efectivo_real: real,
          observaciones,
          usuario_cierre: getCurrentUserProfile(),
          monto_cierre_efectivo_estimado: efectivoEstimado,
          monto_cierre_transferencia_estimado: ingresosTransferencia - egresosTransferencia,
          monto_cierre_tarjeta_estimado: ingresosTarjeta - egresosTarjeta
        });
        showToast('Turno de caja cerrado exitosamente.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Error al cerrar la caja: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Cerrar Caja';
        }
      }
    });
  }
}

function renderHistorialSesionesHTML() {
  if (historialSesiones.length === 0) {
    return `
      <div class="caja-table-card" style="padding: 24px; text-align: center;">
        <h3 style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">Historial de Turnos Cerrados</h3>
        <p style="color: var(--text-tertiary); font-size: 0.85rem;">No se encontraron registros de turnos de caja anteriores.</p>
      </div>
    `;
  }

  const filas = historialSesiones.map(sesion => {
    const fApertura = sesion.fecha_apertura?.toDate 
      ? sesion.fecha_apertura.toDate() 
      : (sesion.fecha_apertura?.seconds ? new Date(sesion.fecha_apertura.seconds * 1000) : new Date());
      
    const fCierre = sesion.fecha_cierre?.toDate 
      ? sesion.fecha_cierre.toDate() 
      : (sesion.fecha_cierre?.seconds ? new Date(sesion.fecha_cierre.seconds * 1000) : null);

    const fAperturaStr = fApertura.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) + ' ' + 
                         fApertura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                         
    const fCierreStr = fCierre 
      ? fCierre.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) + ' ' + 
        fCierre.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : '-';

    const dif = sesion.diferencia_efectivo || 0;
    let colorDif = 'var(--text-primary)';
    let prefijoDif = '';
    if (dif < 0) {
      colorDif = 'var(--danger-text)';
    } else if (dif > 0) {
      colorDif = 'var(--success-text)';
      prefijoDif = '+';
    }

    return `
      <tr>
        <td style="color: var(--text-secondary); font-size: 0.8rem;">${fAperturaStr}</td>
        <td style="color: var(--text-secondary); font-size: 0.8rem;">${fCierreStr}</td>
        <td style="font-family: var(--font-mono); font-weight: 600;">${formatCurrency(sesion.monto_apertura)}</td>
        <td style="font-family: var(--font-mono); font-weight: 600;">${formatCurrency(sesion.monto_cierre_efectivo_estimado || 0)}</td>
        <td style="font-family: var(--font-mono); font-weight: 600;">${formatCurrency(sesion.monto_cierre_efectivo_real || 0)}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: ${colorDif};">${prefijoDif}${formatCurrency(dif)}</td>
        <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: var(--text-secondary);" title="${sesion.observaciones || ''}">
          ${sesion.observaciones || '<span style="color:var(--text-tertiary); font-style:italic;">Sin notas</span>'}
        </td>
        <td style="font-size: 0.8rem; color: var(--text-secondary);">${sesion.usuario_cierre?.nombre || sesion.usuario_apertura?.nombre || 'Sistema'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="caja-table-card">
      <div class="caja-table-header" style="padding: 16px 20px;">
        <span class="caja-table-title" style="font-size: 0.9rem;">Historial de Turnos Cerrados</span>
        <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary); background:var(--bg-app); padding:4px 10px; border-radius:var(--radius-full);">${historialSesiones.length} turnos</span>
      </div>
      <div class="caja-table-wrap">
        <table class="caja-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th>Apertura</th>
              <th>Cierre</th>
              <th>Monto Inicial</th>
              <th>Efectivo Est.</th>
              <th>Efectivo Real</th>
              <th>Diferencia</th>
              <th>Notas</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
