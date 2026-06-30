import { db } from '../firebase.js';
import { collection, addDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

const COLECCION = 'egresos';

// Variables para manejo reactivo en modo de desarrollo local bypass
let localEgresosBypass = [];
let bypassCallbacks = [];

function notifyBypassListeners() {
  const mockEgresos = [
    {
      _docId: 'mock-egreso-1',
      descripcion: 'Compra de papel bond A4',
      monto: 25.50,
      metodo_pago: 'Efectivo',
      fecha: Timestamp.fromDate(new Date(Date.now() - 3600 * 1000)),
      usuario: { nombre: 'Desarrollador' }
    },
    ...localEgresosBypass
  ];
  
  // Ordenar de forma descendente por fecha
  mockEgresos.sort((a, b) => {
    const tA = a.fecha?.toDate ? a.fecha.toDate().getTime() : (a.fecha?.seconds ? a.fecha.seconds * 1000 : 0);
    const tB = b.fecha?.toDate ? b.fecha.toDate().getTime() : (b.fecha?.seconds ? b.fecha.seconds * 1000 : 0);
    return tB - tA;
  });

  bypassCallbacks.forEach(cb => cb(mockEgresos));
}

/**
 * Registrar un nuevo egreso en Firestore (o local si es bypass)
 */
export async function registrarEgreso({ descripcion, monto, metodo_pago, usuario }) {
  const nuevoEgreso = {
    descripcion: (descripcion || '').trim(),
    monto: Number(monto) || 0,
    metodo_pago: metodo_pago || 'Efectivo',
    fecha: Timestamp.now(),
    usuario: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null
  };

  // Si está en bypass de desarrollo, agregarlo a la lista local para respuesta inmediata
  if (localStorage.getItem('dev_bypass') === 'true') {
    const mockDoc = {
      _docId: 'mock-egreso-' + Date.now(),
      ...nuevoEgreso
    };
    localEgresosBypass.push(mockDoc);
    notifyBypassListeners();

    // Intentar guardarlo en Firestore en segundo plano de forma silenciosa
    try {
      const docRef = collection(db, COLECCION);
      await addDoc(docRef, nuevoEgreso);
    } catch (e) {
      console.warn("Firestore bypass save failed (expected if not authenticated in backend):", e);
    }

    return mockDoc;
  }

  const docRef = collection(db, COLECCION);
  return await addDoc(docRef, nuevoEgreso);
}

/**
 * Escuchar los egresos en tiempo real ordenados por fecha descendente
 */
export function escucharEgresos(maxResults = 200, callback) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    if (!bypassCallbacks.includes(callback)) {
      bypassCallbacks.push(callback);
    }
    notifyBypassListeners();
    return () => {
      bypassCallbacks = bypassCallbacks.filter(cb => cb !== callback);
    };
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha', 'desc'),
    limit(maxResults)
  );

  return onSnapshot(q, (snap) => {
    const egresos = snap.docs.map(doc => ({
      _docId: doc.id,
      ...doc.data()
    }));
    callback(egresos);
  });
}
