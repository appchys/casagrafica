import { generateProductId } from '../utils/formatters.js';
import { formatCurrency } from '../utils/formatters.js';

/**
 * Renders the compact card representation of an already added product.
 * @param {Object} product 
 * @param {number} index 
 */
export function renderProductListRow(product, index) {
  const qty = Number(product.cantidad) || 0;
  const price = Number(product.precio_unitario) || 0;
  const subtotal = qty * price;
  
  return `
    <div class="added-product-card" id="added-product-${index}">
      <div class="added-product-header">
        <div class="added-product-title-wrap">
          <span class="added-product-title">
            ${qty}x ${escapeHtml(product.producto_tipo)}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span class="added-product-subtotal">${formatCurrency(subtotal)}</span>
          <div class="product-dropdown">
            <button type="button" class="product-dropdown-toggle" data-dropdown-toggle="product-menu-${index}" aria-label="Acciones">⋮</button>
            <div class="product-dropdown-menu" id="product-menu-${index}">
              <button type="button" class="product-dropdown-item" data-edit-index="${index}">Editar</button>
              <button type="button" class="product-dropdown-item" data-remove-index="${index}">Quitar</button>
            </div>
          </div>
        </div>
      </div>
      
      ${product.detalle_personalizado ? `
      <div class="added-product-details-clean">
        ${escapeHtml(product.detalle_personalizado).replace(/\n/g, '<br>')}
      </div>` : ''}
    </div>
  `;
}

/**
 * Renders the form for adding or editing a product inside a modal popup.
 * @param {Object} product The product object representing the current edit state
 * @param {boolean} isEditing True if editing, false if adding a new product
 * @param {string[]} existingTypes List of existing tipos for autocomplete
 * @param {Object[]} savedProducts List of saved products from Firestore
 */
export function renderProductForm(product, isEditing = false, existingTypes = [], savedProducts = []) {
  const qty = Number(product.cantidad) || 1;
  const price = Number(product.precio_unitario) || 0;
  const subtotal = qty * price;

  const showSaved = !isEditing && savedProducts.length > 0;

  return `
    <div class="modal-overlay" id="product-modal" style="display: flex;">
      <div class="modal-card" style="margin: auto; max-width: 480px; width: 100%;">
        <div class="modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 18px;">${isEditing ? 'Editar Producto / Servicio' : 'Agregar Producto / Servicio'}</div>
        
        ${!isEditing ? `
        <div class="modal-tabs" id="product-modal-tabs">
          <button type="button" class="modal-tab-btn active" data-tab="new-product">Nuevo Producto</button>
          <button type="button" class="modal-tab-btn" data-tab="saved-products" id="tab-saved-btn">
            Productos Guardados
          </button>
        </div>
        ` : ''}

        <div id="tab-new-product">
          <div class="form-group">
            <label class="form-label form-required">Tipo</label>
            <input type="text" class="form-input temp-product-field" data-field="producto_tipo"
              placeholder="e.g. Banner, Sticker" value="${escapeHtml(product.producto_tipo || '')}"
              list="tipo-datalist" autofocus />
            <datalist id="tipo-datalist">
              ${existingTypes.map(t => `<option value="${escapeHtml(t)}">`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label class="form-label">Detalle / Personalización</label>
            <textarea class="form-textarea temp-product-field" data-field="detalle_personalizado"
              placeholder="Descripción del diseño, colores, texto, acabados..." rows="3">${escapeHtml(product.detalle_personalizado || '')}</textarea>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label form-required">Cantidad</label>
              <input type="number" class="form-input form-mono temp-product-field" data-field="cantidad"
                id="modal-product-qty" min="1" step="1" value="${qty}" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label form-required">Precio Unit.</label>
              <input type="number" class="form-input form-mono temp-product-field" data-field="precio_unitario"
                id="modal-product-price" min="0" step="0.01" placeholder="0.00" value="${price > 0 ? price : ''}" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Total</label>
              <input type="number" class="form-input form-mono" id="modal-product-total"
                min="0" step="0.01" placeholder="0.00" value="${subtotal > 0 ? subtotal.toFixed(2) : ''}" />
            </div>
          </div>

          <div id="temp-product-subtotal" style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: var(--text-secondary); text-align: right; margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; ${subtotal > 0 ? '' : 'display: none;'}">
            Subtotal del producto: <strong style="color: var(--accent); font-size: 1.05rem;" id="temp-subtotal-display">${formatCurrency(subtotal)}</strong>
          </div>

          <div style="margin-top: 14px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="save-product-checkbox" ${!isEditing ? '' : 'disabled'} />
            <label for="save-product-checkbox" style="font-size: 0.85rem; color: var(--text-secondary); cursor: pointer;">Conservar producto</label>
          </div>
        </div>

        ${!isEditing ? `
        <div id="tab-saved-products" style="display: none; padding: 4px 0;">
          <div id="saved-products-section" style="${showSaved ? '' : 'display: none;'}">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Selecciona un producto para cargarlo en el formulario:</div>
            <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <table class="modal-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Detalle</th>
                    <th style="text-align: right;">Precio</th>
                    <th style="text-align: right; width: 60px;">Acción</th>
                  </tr>
                </thead>
                <tbody id="saved-products-list">
                  ${savedProducts.map(sp => `
                    <tr class="saved-product-row" data-saved-doc-id="${escapeHtml(sp._docId)}" style="cursor: pointer;">
                      <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(sp.producto_tipo)}</td>
                      <td style="color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(sp.detalle_personalizado || '')}">${escapeHtml(sp.detalle_personalizado || '-')}</td>
                      <td style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem;">${sp.precio_unitario > 0 ? formatCurrency(sp.precio_unitario) : '0.00'}</td>
                      <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="btn btn-xs btn-outline saved-product-delete-btn" data-delete-doc-id="${escapeHtml(sp._docId)}" style="color: var(--danger-text); border-color: transparent; padding: 2px 6px;" title="Eliminar de la lista">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div id="saved-products-fallback" style="text-align: center; padding: 24px 8px; color: var(--text-tertiary); font-size: 0.85rem; ${!showSaved ? '' : 'display: none;'}">
            No tienes productos guardados.<br>
            <span style="font-size: 0.75rem; margin-top: 4px; display: inline-block;">Activa la opción "Conservar producto" al añadir uno nuevo para guardarlo aquí.</span>
          </div>
        </div>
        ` : ''}

        <div class="modal-actions" style="margin-top: 14px; display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-product" style="flex: 1;">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary" id="btn-confirm-product" style="flex: 2;">
            ${isEditing ? 'Guardar Cambios' : 'Añadir al Pedido'}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Creates an empty product schema
 */
export function createEmptyProduct() {
  return {
    id_producto: generateProductId(),
    producto_tipo: '',
    detalle_personalizado: '',
    cantidad: 1,
    precio_unitario: '',
  };
}

/**
 * Escapes HTML characters to prevent XSS issues when rendering input text
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
