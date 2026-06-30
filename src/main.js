import './styles/global.css';
import './styles/print.css';
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, limit, Timestamp } from 'firebase/firestore';
import { renderNavbar, bindNavbarEvents } from './components/navbar.js';
import { renderPedidos, bindPedidosEvents, cleanupPedidos } from './pages/pedidos.js';
import { renderTaller, bindTallerEvents, cleanupTaller } from './pages/taller.js';
import { renderUsuarios, bindUsuariosEvents, cleanupUsuarios } from './pages/usuarios.js';
import { renderHistorial, bindHistorialEvents, cleanupHistorial } from './pages/historial.js';
import { obtenerUsuario } from './services/usuarios.service.js';

const app = document.getElementById('app');
let currentUser = null;
let currentCleanup = null;

// ════════════════════════════════
// TOAST SYSTEM
// ════════════════════════════════
export function showToast(message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const successSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const errorSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  const infoSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  const icons = { success: successSvg, error: errorSvg, info: infoSvg };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${icons[type] || infoSvg}</span><span>${message}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 280);
  }, 3200);
}

// ════════════════════════════════
// LOGIN PAGE
// ════════════════════════════════
function renderLoginPage(errorMsg = '') {
  app.innerHTML = `
    <div class="login-page">
      <!-- Left panel — branding -->
      <div class="login-left">
        <div class="login-logo-mark">CG</div>
        <h1 class="login-title">Casa <span>Gráfica</span></h1>
        <p class="login-desc">Sistema interno de gestión de pedidos, producción y entregas</p>
      </div>

      <!-- Right panel — form -->
      <div class="login-right">
        <div class="login-form-card">
          <div class="login-form-title">Iniciar sesión</div>
          <div class="login-form-sub">Ingresa con tu cuenta de acceso</div>

          <div class="login-error ${errorMsg ? 'show' : ''}" id="login-error">${errorMsg}</div>

          <form id="login-form" novalidate>
            <div class="form-group">
              <label class="form-label form-required">Correo electrónico</label>
              <input type="email" class="form-input" id="login-email"
                placeholder="usuario@casagrafica.com" autocomplete="email" autofocus />
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label form-required">Contraseña</label>
              <input type="password" class="form-input" id="login-password"
                placeholder="••••••••" autocomplete="current-password" />
            </div>
            <button type="submit" class="btn btn-primary btn-lg btn-block" id="login-btn">
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Ingresando...'; }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      let msg = 'Error al iniciar sesión';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) {
        msg = 'Correo o contraseña incorrectos.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos. Espera un momento.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Formato de correo inválido.';
      }
      if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
      if (btn) { btn.disabled = false; btn.innerHTML = 'Iniciar sesión'; }
    }
  });
}

// ════════════════════════════════
// ROUTER
// ════════════════════════════════
function getRoute() {
  const path = window.location.pathname || '/pedidos';
  if (path.startsWith('/taller')) {
    const parts = path.split('/');
    return { page: 'taller', docId: parts[2] || null };
  }
  if (path.startsWith('/usuarios')) {
    return { page: 'usuarios', docId: null };
  }
  if (path.startsWith('/historial')) {
    return { page: 'historial', docId: null };
  }
  return { page: 'pedidos', docId: null };
}

function renderPage(user, profile) {
  // Cleanup previous page
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }

  let { page, docId } = getRoute();
  const permissions = profile ? profile.permisos || [] : [];

  // Verificar autorización para la página solicitada
  let authorized = false;
  if (page === 'pedidos' || page === 'historial') {
    authorized = permissions.includes('crear_pedidos') || permissions.includes('editar_pedidos');
  } else if (page === 'taller') {
    authorized = permissions.includes('gestionar_taller');
  } else if (page === 'usuarios') {
    authorized = permissions.includes('gestionar_usuarios');
  }

  // Redireccionar si no está autorizado
  if (!authorized) {
    if (permissions.includes('crear_pedidos') || permissions.includes('editar_pedidos')) {
      history.replaceState(null, '', '/pedidos');
      renderPage(user, profile);
      return;
    } else if (permissions.includes('gestionar_taller')) {
      history.replaceState(null, '', '/taller');
      renderPage(user, profile);
      return;
    } else if (permissions.includes('gestionar_usuarios')) {
      history.replaceState(null, '', '/usuarios');
      renderPage(user, profile);
      return;
    } else {
      // Sin permisos asignados
      app.innerHTML = `
        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--bg-app); color:var(--text-primary); text-align:center; padding: 20px;">
          <div style="font-size:1.5rem; font-weight:800; color:var(--danger-text); margin-bottom:12px;">Acceso Denegado</div>
          <p style="color:var(--text-secondary); margin-bottom:20px;">No tienes permisos asignados en el sistema.</p>
          <button class="btn btn-primary" id="btn-denied-logout">Cerrar sesión</button>
        </div>
      `;
      document.getElementById('btn-denied-logout')?.addEventListener('click', handleLogout);
      return;
    }
  }

  // Renderizar la navegación y contenido
  const nav = renderNavbar(page, user.email, permissions, profile ? profile.nombre : '');
  let content = '';

  if (page === 'taller') {
    content = renderTaller(docId);
  } else if (page === 'usuarios') {
    content = renderUsuarios();
  } else if (page === 'historial') {
    content = renderHistorial();
  } else {
    content = renderPedidos();
  }

  app.innerHTML = nav + content;

  // Bind navbar
  bindNavbarEvents(handleLogout);

  // Bind page events
  if (page === 'taller') {
    bindTallerEvents(docId);
    currentCleanup = cleanupTaller;
  } else if (page === 'usuarios') {
    bindUsuariosEvents();
    currentCleanup = cleanupUsuarios;
  } else if (page === 'historial') {
    bindHistorialEvents();
    currentCleanup = cleanupHistorial;
  } else {
    bindPedidosEvents();
    currentCleanup = cleanupPedidos;
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    history.replaceState(null, '', '/pedidos');
  } catch {
    showToast('Error al cerrar sesión', 'error');
  }
}

// ════════════════════════════════
// BOOTSTRAP
// ════════════════════════════════
let currentProfile = null;

export function getCurrentUserProfile() {
  return currentProfile;
}

onAuthStateChanged(auth, async (user) => {
  const devBypass = localStorage.getItem('dev_bypass') === 'true';
  if (devBypass) {
    currentUser = { uid: 'dev-uid', email: 'dev@casagrafica.com', displayName: 'Desarrollador' };
    currentProfile = {
      _docId: 'dev-uid',
      uid: 'dev-uid',
      email: 'dev@casagrafica.com',
      nombre: 'Desarrollador',
      rol: 'admin',
      permisos: ['crear_pedidos', 'editar_pedidos', 'gestionar_taller', 'gestionar_usuarios']
    };
    if (window.location.pathname === '/' || window.location.pathname === '') {
      history.replaceState(null, '', '/pedidos');
    }
    renderPage(currentUser, currentProfile);
    return;
  }

  currentUser = user;
  if (user) {
    // Cargar perfil desde Firestore
    try {
      currentProfile = await obtenerUsuario(user.uid);
      if (!currentProfile) {
        // Verificar si la base de datos de usuarios está vacía
        const qLimit = query(collection(db, 'usuarios'), limit(1));
        const snap = await getDocs(qLimit);
        if (snap.empty) {
          // Es el primer usuario: Auto-crearlo como administrador
          const newUserDoc = {
            uid: user.uid,
            email: user.email,
            nombre: user.displayName || user.email.split('@')[0],
            rol: 'admin',
            permisos: ['crear_pedidos', 'editar_pedidos', 'gestionar_taller', 'gestionar_usuarios'],
            creado_en: Timestamp.now()
          };
          await setDoc(doc(db, 'usuarios', user.uid), newUserDoc);
          currentProfile = { _docId: user.uid, ...newUserDoc };
          showToast('Primer usuario auto-configurado como Administrador', 'success');
        } else {
          // Colección no vacía pero usuario no registrado: Denegar acceso
          showToast('Usuario no registrado o inactivo.', 'error');
          await signOut(auth);
          return;
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error de autenticación y carga de perfil.', 'error');
      await signOut(auth);
      return;
    }

    if (window.location.pathname === '/' || window.location.pathname === '') {
      history.replaceState(null, '', '/pedidos');
    }
    renderPage(currentUser, currentProfile);
  } else {
    currentProfile = null;
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    renderLoginPage();
  }
});

// Intercept all internal relative link clicks to handle SPA routing via History API
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      history.pushState(null, '', href);
      if (currentUser && currentProfile) {
        renderPage(currentUser, currentProfile);
      }
    }
  }
});

window.addEventListener('popstate', () => {
  if (currentUser && currentProfile) renderPage(currentUser, currentProfile);
});
