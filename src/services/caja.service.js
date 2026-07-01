import { db } from '../firebase.js';
import { collection, addDoc, doc, updateDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

const COLECCION = 'sesiones_caja';

// Variables para listeners reactivos del modo bypass local de desarrollo
let bypassActiveListeners = [];
let bypassHistorialListeners = [];

function getBypassActiveSesion() {
  const data = localStorage.getItem('mock_sesion_caja');
  return data ? JSON.parse(data) : null;
}

function getBypassHistorial() {
  const data = localStorage.getItem('mock_historial_sesiones_caja');
  if (!data) {
    // Inicializar con algunos datos de ejemplo simulados
    const mockHistorial = [
      {
        _docId: 'mock-sesion-1',
        estado: 'cerrada',
        monto_apertura: 150.00,
        fecha_apertura: { seconds: Math.floor((Date.now() - 48 * 3600 * 1000) / 1000) },
        usuario_apertura: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' },
        fecha_cierre: { seconds: Math.floor((Date.now() - 40 * 3600 * 1000) / 1000) },
        usuario_cierre: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' },
        monto_cierre_efectivo_estimado: 280.00,
        monto_cierre_efectivo_real: 280.00,
        monto_cierre_transferencia_estimado: 120.00,
        monto_cierre_tarjeta_estimado: 0.00,
        diferencia_efectivo: 0.00,
        observaciones: 'Arqueo perfecto en el cierre del lunes.'
      },
      {
        _docId: 'mock-sesion-2',
        estado: 'cerrada',
        monto_apertura: 100.00,
        fecha_apertura: { seconds: Math.floor((Date.now() - 24 * 3600 * 1000) / 1000) },
        usuario_apertura: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' },
        fecha_cierre: { seconds: Math.floor((Date.now() - 16 * 3600 * 1000) / 1000) },
        usuario_cierre: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' },
        monto_cierre_efectivo_estimado: 235.00,
        monto_cierre_efectivo_real: 232.00,
        monto_cierre_transferencia_estimado: 80.00,
        monto_cierre_tarjeta_estimado: 50.00,
        diferencia_efectivo: -3.00,
        observaciones: 'Faltaron 3 soles en caja chica por cambio de monedas.'
      }
    ];
    localStorage.setItem('mock_historial_sesiones_caja', JSON.stringify(mockHistorial));
    return mockHistorial;
  }
  return JSON.parse(data);
}

function notifyBypassActive() {
  const active = getBypassActiveSesion();
  bypassActiveListeners.forEach(cb => cb(active));
}

function notifyBypassHistorial() {
  const hist = getBypassHistorial();
  bypassHistorialListeners.forEach(cb => cb(hist));
}

/**
 * Escucha en tiempo real la sesión de caja activa (la última abierta)
 */
export function escucharSesionActiva(callback) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    if (!bypassActiveListeners.includes(callback)) {
      bypassActiveListeners.push(callback);
    }
    // Notificar inmediatamente el valor actual
    setTimeout(() => callback(getBypassActiveSesion()), 50);
    return () => {
      bypassActiveListeners = bypassActiveListeners.filter(cb => cb !== callback);
    };
  }

  // Consultamos el último documento de caja registrado
  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_apertura', 'desc'),
    limit(1)
  );

  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
      return;
    }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (data.estado === 'abierta') {
      callback({
        _docId: docSnap.id,
        ...data
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Escucha el historial de sesiones de caja registradas
 */
export function escucharHistorialSesiones(limiteResultados = 50, callback) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    if (!bypassHistorialListeners.includes(callback)) {
      bypassHistorialListeners.push(callback);
    }
    setTimeout(() => callback(getBypassHistorial().slice(0, limiteResultados)), 50);
    return () => {
      bypassHistorialListeners = bypassHistorialListeners.filter(cb => cb !== callback);
    };
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_apertura', 'desc'),
    limit(limiteResultados)
  );

  return onSnapshot(q, (snap) => {
    const historial = snap.docs.map(doc => ({
      _docId: doc.id,
      ...doc.data()
    }));
    callback(historial);
  });
}

/**
 * Abre una nueva sesión de caja
 */
export async function abrirSesionCaja({ monto_apertura, usuario }) {
  const nuevaSesion = {
    fecha_apertura: Timestamp.now(),
    usuario_apertura: {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    },
    monto_apertura: Number(monto_apertura) || 0,
    estado: 'abierta'
  };

  if (localStorage.getItem('dev_bypass') === 'true') {
    const mockSesion = {
      _docId: 'mock-sesion-' + Date.now(),
      ...nuevaSesion,
      // Para simular timestamps de firestore
      fecha_apertura: { seconds: Math.floor(Date.now() / 1000) }
    };
    localStorage.setItem('mock_sesion_caja', JSON.stringify(mockSesion));
    notifyBypassActive();
    return mockSesion;
  }

  const docRef = collection(db, COLECCION);
  return await addDoc(docRef, nuevaSesion);
}

/**
 * Cierra una sesión de caja activa
 */
export async function cerrarSesionCaja(sesionId, {
  monto_cierre_efectivo_real,
  observaciones,
  usuario_cierre,
  monto_cierre_efectivo_estimado,
  monto_cierre_transferencia_estimado,
  monto_cierre_tarjeta_estimado
}) {
  const realEf = Number(monto_cierre_efectivo_real) || 0;
  const estEf = Number(monto_cierre_efectivo_estimado) || 0;
  const dif = realEf - estEf;

  const datosCierre = {
    fecha_cierre: Timestamp.now(),
    usuario_cierre: {
      uid: usuario_cierre.uid || '',
      nombre: usuario_cierre.nombre || '',
      email: usuario_cierre.email || ''
    },
    monto_cierre_efectivo_estimado: estEf,
    monto_cierre_transferencia_estimado: Number(monto_cierre_transferencia_estimado) || 0,
    monto_cierre_tarjeta_estimado: Number(monto_cierre_tarjeta_estimado) || 0,
    monto_cierre_efectivo_real: realEf,
    diferencia_efectivo: dif,
    observaciones: (observaciones || '').trim(),
    estado: 'cerrada'
  };

  if (localStorage.getItem('dev_bypass') === 'true') {
    const active = getBypassActiveSesion();
    if (!active) throw new Error('No hay una sesión activa de caja para cerrar en modo bypass.');

    const mockCerrada = {
      ...active,
      ...datosCierre,
      fecha_cierre: { seconds: Math.floor(Date.now() / 1000) }
    };

    // Actualizar historial
    const historial = getBypassHistorial();
    historial.unshift(mockCerrada);
    localStorage.setItem('mock_historial_sesiones_caja', JSON.stringify(historial));

    // Limpiar activa
    localStorage.removeItem('mock_sesion_caja');

    notifyBypassActive();
    notifyBypassHistorial();
    return mockCerrada;
  }

  const docRef = doc(db, COLECCION, sesionId);
  return await updateDoc(docRef, datosCierre);
}
