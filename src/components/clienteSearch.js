import { buscarClientesPorNombre, buscarClientesPorTelefono } from '../services/clientes.service.js';

/**
 * ClienteState — shared state representing the currently selected/written client
 */
export const clienteState = {
  docId: null,       // Firestore docId if existing client
  nombre: '',
  telefono: '',
  isNew: true,       // true = will be created on save
};

export function resetClienteState() {
  clienteState.docId = null;
  clienteState.nombre = '';
  clienteState.telefono = '';
  clienteState.isNew = true;
}

// Inline SVGs instead of emojis
const searchIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const phoneIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;
const userIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
const plusIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const checkIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

/**
 * Render the client search widget HTML
 */
export function renderClienteSearch() {
  return `
    <div class="cliente-search" id="cliente-search-widget">

      <!-- SEARCH MODE CONTAINER -->
      <div id="cs-search-mode-container">
        <!-- Search input -->
        <div class="cs-input-wrap" id="cs-input-wrap">
          <span class="cs-icon" id="cs-icon">${searchIconSvg}</span>
          <input
            type="text"
            class="cs-input"
            id="cs-input"
            placeholder="Buscar o registrar cliente (nombre o celular)..."
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="cs-clear" id="cs-clear" style="display:none;" title="Limpiar">✕</button>
        </div>

        <!-- Dropdown autocomplete results -->
        <div class="cs-dropdown" id="cs-dropdown" style="display:none;"></div>
      </div>

      <!-- SELECTED CLIENT CARD (Shown when existing/new client is locked in) -->
      <div class="cs-selected" id="cs-selected" style="display:none; margin-top: 8px;"></div>

    </div>
  `;
}

/**
 * Bind autocomplete and interface toggles for the client search widget
 */
export function bindClienteSearch(callbacks = {}) {
  const { onNewClient, onEditClient } = callbacks;
  let debounceTimer = null;

  const searchContainer = document.getElementById('cs-search-mode-container');
  const input           = document.getElementById('cs-input');
  const dropdown        = document.getElementById('cs-dropdown');
  const clearBtn        = document.getElementById('cs-clear');

  const selectedChip    = document.getElementById('cs-selected');
  const iconEl          = document.getElementById('cs-icon');

  if (!input) return;

  // Helper helper to check if value typed is a phone number pattern
  function checkIsPhonePattern(val) {
    return /^\+?[0-9\s\-()]+$/.test(val) && val.replace(/\D/g, '').length >= 2;
  }

  // ── Input on search field ──
  input.addEventListener('input', () => {
    let val = input.value;
    const isPhone = checkIsPhonePattern(val);
    if (isPhone) {
      // Strip spaces, dashes, parentheses instantly
      val = val.replace(/[\s\-\(\)]/g, '');
      input.value = val;
    }
    const cleanVal = val.trim();

    // Show/hide clear button
    clearBtn.style.display = cleanVal ? 'flex' : 'none';

    // Search trigger: starting at 2 letters
    if (cleanVal.length < 2) {
      hideDropdown();
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(cleanVal), 220);
  });

  // ── Clear button ──
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    hideDropdown();
    resetToSearch();
    input.focus();
  });

  // ── Close dropdown when clicking outside ──
  document.addEventListener('mousedown', (e) => {
    if (!document.getElementById('cliente-search-widget')?.contains(e.target)) {
      hideDropdown();
    }
  });

  // ── Search logic ──
  async function doSearch(val) {
    showDropdownLoading();

    try {
      let results = [];
      const isPhone = checkIsPhonePattern(val);
      
      if (isPhone) {
        results = await buscarClientesPorTelefono(val);
        if (iconEl) iconEl.innerHTML = phoneIconSvg;
      } else {
        results = await buscarClientesPorNombre(val);
        if (iconEl) iconEl.innerHTML = searchIconSvg;
      }
      
      if (results.length === 0) {
        // No results found: show only the "create new" option
        renderEmptyDropdown(val);
      } else {
        renderDropdown(results, val);
      }
    } catch (err) {
      console.error("Error al buscar cliente:", err);
      renderEmptyDropdown(val);
    }
  }

  function renderEmptyDropdown(searchVal) {
    if (!dropdown) return;
    dropdown.innerHTML = `
      <div class="cs-option cs-option-new" data-action="new">
        <span class="cs-option-icon" style="display:inline-flex; align-items:center;">${plusIconSvg}</span>
        <div>
          <div class="cs-option-label">Crear cliente nuevo</div>
          <div class="cs-option-sub">"${searchVal}"</div>
        </div>
      </div>
    `;
    dropdown.style.display = 'block';
    dropdown.querySelector('.cs-option')?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      hideDropdown();
      if (typeof onNewClient === 'function') onNewClient(searchVal);
    });
  }

  function renderDropdown(clients, searchVal) {
    if (!dropdown) return;

    const items = clients.map(c => `
      <div class="cs-option" data-doc-id="${c._docId}"
        data-nombre="${c.nombre}" data-telefono="${c.telefono || ''}">
        <span class="cs-option-icon" style="display:inline-flex; align-items:center;">${userIconSvg}</span>
        <div>
          <div class="cs-option-label">${highlightMatch(c.nombre, searchVal)}</div>
          ${c.telefono ? `<div class="cs-option-sub">Celular: ${c.telefono}</div>` : ''}
          ${c.total_pedidos > 0 ? `<div class="cs-option-sub">${c.total_pedidos} pedido(s) anteriores</div>` : ''}
        </div>
      </div>
    `).join('');

    const createOption = `
      <div class="cs-option cs-option-new" data-action="new">
        <span class="cs-option-icon" style="display:inline-flex; align-items:center;">${plusIconSvg}</span>
        <div>
          <div class="cs-option-label">Crear cliente nuevo</div>
          <div class="cs-option-sub">"${searchVal}"</div>
        </div>
      </div>
    `;

    dropdown.innerHTML = items + createOption;
    dropdown.style.display = 'block';

    // Bind option clicks
    dropdown.querySelectorAll('.cs-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur before click
        if (opt.dataset.action === 'new') {
          hideDropdown();
          if (typeof onNewClient === 'function') onNewClient(searchVal);
        } else {
          selectExisting({
            _docId:   opt.dataset.docId,
            nombre:   opt.dataset.nombre,
            telefono: opt.dataset.telefono,
          });
        }
      });
    });
  }

  function selectExisting(client) {
    clienteState.docId    = client._docId;
    clienteState.nombre   = client.nombre;
    clienteState.telefono = client.telefono || '';
    clienteState.isNew    = false;

    // UI state
    input.value = '';
    clearBtn.style.display = 'none';
    hideDropdown();
    
    if (searchContainer) searchContainer.style.display = 'none';
    
    showSelectedCard(client.nombre, client.telefono);
  }

  function resetToSearch() {
    resetClienteState();

    if (searchContainer) searchContainer.style.display = 'block';
    if (selectedChip) selectedChip.style.display = 'none';
    
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (iconEl) iconEl.innerHTML = searchIconSvg;
    hideDropdown();
  }

  function showSelectedCard(nombre, telefono) {
    if (!selectedChip) return;
    selectedChip.style.display = 'block';
    selectedChip.innerHTML = `
      <div class="cs-selected-client-row">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="cs-client-avatar">
            ${nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="cs-client-name">${nombre}</div>
            <div class="cs-client-phone">${telefono || 'Sin celular'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 2px;">
          <button type="button" class="cs-icon-btn" id="cs-chip-edit" title="Editar cliente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          <button type="button" class="cs-icon-btn cs-icon-btn-remove" id="cs-chip-remove" title="Quitar cliente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    `;

    document.getElementById('cs-chip-remove')?.addEventListener('click', () => {
      resetToSearch();
      input.focus();
    });
    document.getElementById('cs-chip-edit')?.addEventListener('click', () => {
      if (typeof onEditClient === 'function') {
        onEditClient(nombre, telefono);
      }
    });
  }

  function showDropdownLoading() {
    if (!dropdown) return;
    dropdown.innerHTML = `<div class="cs-loading"><div class="spinner"></div> Buscando...</div>`;
    dropdown.style.display = 'block';
  }

  function hideDropdown() {
    if (dropdown) dropdown.style.display = 'none';
  }
}

/**
 * Programmatically select a client and show the selected card.
 * Used when loading an existing pedido in the edit sidebar.
 */
export function selectClient(nombre, telefono, docId) {
  clienteState.docId = docId;
  clienteState.nombre = nombre;
  clienteState.telefono = telefono || '';
  clienteState.isNew = false;

  const searchContainer = document.getElementById('cs-search-mode-container');
  if (searchContainer) searchContainer.style.display = 'none';

  const selectedChip = document.getElementById('cs-selected');
  if (!selectedChip) return;

  selectedChip.style.display = 'block';
  selectedChip.innerHTML = `
    <div class="cs-selected-client-row">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="cs-client-avatar">${nombre.charAt(0).toUpperCase()}</div>
        <div>
          <div class="cs-client-name">${nombre}</div>
          <div class="cs-client-phone">${telefono || 'Sin celular'}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 2px;">
        <button type="button" class="cs-icon-btn" id="cs-chip-edit" title="Editar cliente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button type="button" class="cs-icon-btn cs-icon-btn-remove" id="cs-chip-remove" title="Quitar cliente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `;

  // Find the edit callback from DOM (stored on the bound instance) — default to re-open modal
  const dispatchEdit = () => {
    const searchInput = document.getElementById('cs-input');
    if (searchInput) {
      searchInput.value = nombre;
      searchInput.dispatchEvent(new Event('input'));
    }
  };

  document.getElementById('cs-chip-remove')?.addEventListener('click', () => {
    clienteState.docId = null;
    clienteState.nombre = '';
    clienteState.telefono = '';
    clienteState.isNew = true;
    if (searchContainer) searchContainer.style.display = 'block';
    selectedChip.style.display = 'none';
    const input = document.getElementById('cs-input');
    if (input) { input.value = ''; input.focus(); }
  });
  document.getElementById('cs-chip-edit')?.addEventListener('click', dispatchEdit);
}

/** Highlight matching substring in search result */
function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark class="cs-highlight">${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}
