import { db } from '../firebase.js';
import {
  collection, doc, addDoc, getDocs, query,
  where, orderBy, limit, Timestamp, getDoc, updateDoc, onSnapshot
} from 'firebase/firestore';

const COLECCION = 'anticipos';

// Listeners reactivos para dev_bypass
let bypassListeners = [];

function getBypassAnticipos() {
  const data = localStorage.getItem('mock_anticipos');
  if (!data) {
    // Inicializar con algunos datos de ejemplo simulados
    const mock = [
      {
        _docId: 'mock-anticipo-1',
        cliente_id: 'mock-cliente-1',
        cliente_nombre: 'Carlos Pérez',
        cliente_telefono: '0987654321',
        monto: 100.00,
        saldo: 100.00,
        estado: 'activo',
        fecha_creacion: { seconds: Math.floor((Date.now() - 2 * 3600 * 1000) / 1000) },
        metodo_pago: 'Efectivo',
        usuario: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' }
      },
      {
        _docId: 'mock-anticipo-2',
        cliente_id: 'mock-cliente-2',
        cliente_nombre: 'María Rodríguez',
        cliente_telefono: '0999999999',
        monto: 50.00,
        saldo: 0.00,
        estado: 'usado',
        fecha_creacion: { seconds: Math.floor((Date.now() - 24 * 3600 * 1000) / 1000) },
        metodo_pago: 'Transferencia',
        usuario: { nombre: 'Desarrollador', email: 'dev@casagrafica.com' }
      }
    ];
    localStorage.setItem('mock_anticipos', JSON.stringify(mock));
    return mock;
  }
  return JSON.parse(data);
}

function saveBypassAnticipos(list) {
  localStorage.setItem('mock_anticipos', JSON.stringify(list));
  bypassListeners.forEach(cb => cb(list));
}

/**
 * Registra un anticipo nuevo en Firestore
 */
export async function crearAnticipo({ cliente, monto, metodo_pago, usuario }) {
  const numMonto = Number(monto);
  if (isNaN(numMonto) || numMonto <= 0) {
    throw new Error('El monto del anticipo debe ser mayor a 0');
  }

  const nuevoAnticipo = {
    cliente_id: cliente.docId || cliente._docId,
    cliente_nombre: cliente.nombre.trim(),
    cliente_telefono: cliente.telefono || '',
    monto: numMonto,
    saldo: numMonto,
    estado: 'activo',
    fecha_creacion: Timestamp.now(),
    metodo_pago: metodo_pago || 'Efectivo',
    usuario: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null
  };

  if (localStorage.getItem('dev_bypass') === 'true') {
    const mockList = getBypassAnticipos();
    const newDoc = {
      _docId: 'mock-anticipo-' + Date.now(),
      ...nuevoAnticipo,
      fecha_creacion: { seconds: Math.floor(Date.now() / 1000) }
    };
    mockList.unshift(newDoc);
    saveBypassAnticipos(mockList);
    return newDoc;
  }

  const docRef = collection(db, COLECCION);
  const docAdded = await addDoc(docRef, nuevoAnticipo);
  return { _docId: docAdded.id, ...nuevoAnticipo };
}

/**
 * Obtiene los anticipos activos (con saldo > 0) de un cliente específico
 */
export async function obtenerAnticiposActivosCliente(clienteId) {
  if (!clienteId) return [];

  if (localStorage.getItem('dev_bypass') === 'true') {
    const list = getBypassAnticipos();
    return list.filter(a => a.cliente_id === clienteId && a.estado === 'activo' && a.saldo > 0);
  }

  const q = query(
    collection(db, COLECCION),
    where('cliente_id', '==', clienteId),
    where('estado', '==', 'activo')
  );

  const snap = await getDocs(q);
  return snap.docs
    .map(doc => ({ _docId: doc.id, ...doc.data() }))
    .filter(a => a.saldo > 0.001); // Doble validación de seguridad por decimales
}

/**
 * Escucha en tiempo real todos los anticipos registrados
 */
export function escucharAnticipos(callback) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    if (!bypassListeners.includes(callback)) {
      bypassListeners.push(callback);
    }
    // Disparar inmediatamente
    setTimeout(() => callback(getBypassAnticipos()), 50);
    return () => {
      bypassListeners = bypassListeners.filter(cb => cb !== callback);
    };
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(doc => ({
      _docId: doc.id,
      ...doc.data()
    }));
    callback(list);
  });
}

/**
 * Anula un anticipo (solo si está activo y con su saldo original completo)
 */
export async function anularAnticipo(docId, usuario) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    const list = getBypassAnticipos();
    const idx = list.findIndex(a => a._docId === docId);
    if (idx === -1) throw new Error('Anticipo no encontrado');
    const ant = list[idx];
    if (ant.estado !== 'activo' || ant.saldo !== ant.monto) {
      throw new Error('Solo se pueden anular anticipos activos que no hayan sido utilizados.');
    }

    list[idx] = {
      ...ant,
      estado: 'anulado',
      saldo: 0,
      usuario_anulacion: usuario ? { nombre: usuario.nombre, email: usuario.email } : null,
      fecha_anulacion: { seconds: Math.floor(Date.now() / 1000) }
    };
    saveBypassAnticipos(list);
    return list[idx];
  }

  const docRef = doc(db, COLECCION, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Anticipo no encontrado');

  const data = snap.data();
  if (data.estado !== 'activo' || data.saldo !== data.monto) {
    throw new Error('Solo se pueden anular anticipos activos que no hayan sido utilizados.');
  }

  const updates = {
    estado: 'anulado',
    saldo: 0,
    usuario_anulacion: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null,
    fecha_anulacion: Timestamp.now()
  };

  await updateDoc(docRef, updates);
  return { ...data, ...updates, _docId: docId };
}
