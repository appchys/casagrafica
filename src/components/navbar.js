/**
 * Renders the top navigation bar (dark theme)
 */
export function renderNavbar(currentPage, userEmail, permissions = [], userName = '') {
  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Usuario');
  const initials = displayName.slice(0, 2).toUpperCase();
  
  const showPedidos = permissions.includes('crear_pedidos') || permissions.includes('editar_pedidos');
  const showTaller = permissions.includes('gestionar_taller');
  const showUsuarios = permissions.includes('gestionar_usuarios');

  return `
    <nav class="navbar" id="main-navbar">
      <!-- Hamburguesa móvil -->
      <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menú" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <a class="navbar-brand" href="/pedidos">
        <div class="brand-mark">CG</div>
        <span>Casa <span class="brand-sub">Gráfica</span></span>
      </a>
    </nav>
 
    <!-- Overlay y Cajón del menú (Sidebar en PC / Drawer en móvil) -->
    <div class="mobile-menu-overlay" id="mobile-menu-overlay"></div>
    <div class="mobile-menu-drawer" id="mobile-menu-drawer">
      <div class="drawer-header">
        <a class="navbar-brand" href="/pedidos">
          <div class="brand-mark">CG</div>
          <span>Casa <span class="brand-sub">Gráfica</span></span>
        </a>
        <button class="menu-close" id="menu-close" aria-label="Cerrar menú" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="drawer-divider"></div>
      <ul class="drawer-nav">
        ${showPedidos ? `
        <li>
          <a href="/pedidos" class="drawer-nav-item ${currentPage === 'pedidos' ? 'active' : ''}">
            <span class="nav-icon" style="display:inline-flex; align-items:center;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </span>
            <span class="nav-label">Pedidos</span>
          </a>
        </li>
        <li>
          <a href="/historial" class="drawer-nav-item ${currentPage === 'historial' ? 'active' : ''}">
            <span class="nav-icon" style="display:inline-flex; align-items:center;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </span>
            <span class="nav-label">Historial</span>
          </a>
        </li>
        ` : ''}
        ${showTaller ? `
        <li>
          <a href="/taller" class="drawer-nav-item ${currentPage === 'taller' ? 'active' : ''}">
            <span class="nav-icon" style="display:inline-flex; align-items:center;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"></path><path d="M5 17V8l4-4v13"></path><path d="M9 17v-6l4-3v9"></path><path d="M13 17v-8l4-4v12"></path><path d="M17 17v-4l4-3v7"></path></svg>
            </span>
            <span class="nav-label">Taller & Entrega</span>
          </a>
        </li>
        ` : ''}
        ${showUsuarios ? `
        <li>
          <a href="/usuarios" class="drawer-nav-item ${currentPage === 'usuarios' ? 'active' : ''}">
            <span class="nav-icon" style="display:inline-flex; align-items:center;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </span>
            <span class="nav-label">Usuarios</span>
          </a>
        </li>
        ` : ''}
      </ul>
      <div class="drawer-footer">
        <div class="user-chip-vertical">
          <div class="user-avatar-large">${initials}</div>
          <div class="user-info">
            <span class="user-name">${displayName}</span>
            <span class="user-email">${userEmail || ''}</span>
          </div>
        </div>
        <button class="btn-logout-mobile" id="btn-logout-mobile" type="button">Cerrar sesión</button>
      </div>
    </div>
  `;
}

export function bindNavbarEvents(onLogout) {
  // Logout de escritorio (si existiera)
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
  
  // Logout de móvil / sidebar
  document.getElementById('btn-logout-mobile')?.addEventListener('click', onLogout);

  // Manejo de eventos para menú hamburguesa
  const menuToggle = document.getElementById('menu-toggle');
  const menuClose = document.getElementById('menu-close');
  const overlay = document.getElementById('mobile-menu-overlay');
  const drawer = document.getElementById('mobile-menu-drawer');

  const openDrawer = () => {
    drawer?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden'; // Evita scroll de fondo
  };

  const closeDrawer = () => {
    drawer?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  };

  menuToggle?.addEventListener('click', openDrawer);
  menuClose?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Cerrar drawer al hacer click en los enlaces del drawer
  const drawerLinks = drawer?.querySelectorAll('.drawer-nav-item');
  drawerLinks?.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}
