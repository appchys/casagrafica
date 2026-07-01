import { formatCurrency } from '../utils/formatters.js';
import { agregarAbono } from '../services/pedidos.service.js';
import { showToast, getCurrentUserProfile } from '../main.js';

/**
 * Renders the custom abono form as a modal dialog for a new order.
 * @param {number} totalPedido 
 * @param {number|string} montoActual 
 * @param {string} metodoActual 
 */
export function renderAbonoFormModal(totalPedido, montoActual = '', metodoActual = 'Efectivo') {
  return `
    <div class="modal-overlay" id="abono-form-modal" style="display: flex;">
      <div class="modal-card" style="margin: auto; max-width: 420px; width: 100%;">
        <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Registrar Abono Parcial</div>
        <div class="modal-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 18px;">
          Total del pedido: <strong style="color:var(--text-primary); font-family:var(--font-mono);">${formatCurrency(totalPedido)}</strong>
        </div>

        <div class="form-group">
          <label class="form-label form-required">Monto del abono</label>
          <input type="number" class="form-input form-mono" id="abono-modal-monto"
            min="0.01" max="${totalPedido}" step="0.01" placeholder="0.00" value="${montoActual || ''}" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Método de pago</label>
          <select class="form-select" id="abono-modal-metodo">
            <option value="Efectivo" ${metodoActual === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="Transferencia" ${metodoActual === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
            <option value="Tarjeta" ${metodoActual === 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
          </select>
        </div>

        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-abono-modal" style="flex: 1;">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-abono-modal" style="flex: 2;">Aceptar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Abono modal (for adding payment to existing order)
 */
export function renderAbonoModal(pedido) {
  return `
    <div class="modal-overlay" id="abono-modal">
      <div class="modal-card">
        <div class="modal-title">Registrar Pago</div>
        <div class="modal-sub">
          Pedido <strong style="color:var(--accent); font-family:var(--font-mono);">${pedido.id_pedido}</strong>
          · Saldo: <strong style="color:var(--danger-text);">${formatCurrency(pedido.saldo_pendiente)}</strong>
        </div>

        <div class="form-group">
          <label class="form-label form-required">Monto</label>
          <input type="number" class="form-input form-mono" id="modal-abono-monto"
            min="0.01" max="${pedido.saldo_pendiente}" step="0.01" placeholder="0.00" value="${pedido.saldo_pendiente}" />
        </div>
        <div class="form-group">
          <label class="form-label">Método de pago</label>
          <select class="form-select" id="modal-abono-metodo">
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel" type="button" style="flex:1;">Cancelar</button>
          <button class="btn btn-primary" id="modal-confirm" type="button" style="flex:2;">Registrar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Controller to show the abono modal dynamically.
 * @param {object} pedido 
 * @param {function} onUpdateCallback 
 */
export function showAbonoModal(pedido, onUpdateCallback = null) {
  document.getElementById('abono-modal')?.remove();

  document.body.insertAdjacentHTML('beforeend', renderAbonoModal(pedido));

  const modal = document.getElementById('abono-modal');
  if (!modal) return;

  const inputMonto = document.getElementById('modal-abono-monto');

  document.getElementById('modal-cancel')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  document.getElementById('modal-confirm')?.addEventListener('click', async () => {
    const monto = Number(inputMonto?.value);
    const metodo = document.getElementById('modal-abono-metodo')?.value || 'Efectivo';

    if (!monto || monto <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }
    if (monto > pedido.saldo_pendiente + 0.001) {
      showToast('El monto excede el saldo pendiente', 'error');
      return;
    }

    try {
      await agregarAbono(pedido._docId, monto, metodo, getCurrentUserProfile());
      showToast(`Pago de ${formatCurrency(monto)} registrado`, 'success');
      modal.remove();
      if (typeof onUpdateCallback === 'function') {
        onUpdateCallback();
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  setTimeout(() => {
    if (inputMonto) {
      inputMonto.focus();
      inputMonto.select(); // Selecciona el texto para facilitar edición si desean un abono menor
    }
  }, 80);
}
