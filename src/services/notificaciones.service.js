import { db } from '../firebase.js';
import { collection, getDocs, orderBy, query, limit, where, doc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';

const COLECCION = 'pedido_notificaciones';
const COLECCION_PEDIDOS = 'pedidos';

export async function obtenerNotificacionesPedido(maxResults = 50) {
  const q = query(
    collection(db, COLECCION),
    orderBy('fecha', 'desc'),
    limit(maxResults)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

export async function obtenerPedidoPorIdPedido(idPedido) {
  const pedidoId = String(idPedido || '').trim().toUpperCase();
  if (!pedidoId) return null;

  const q = query(
    collection(db, COLECCION_PEDIDOS),
    where('id_pedido', '==', pedidoId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const pedido = snap.docs[0];
  return { _docId: pedido.id, ...pedido.data() };
}

export async function marcarComoLeida(notificacionId) {
  const ref = doc(db, COLECCION, notificacionId);
  await updateDoc(ref, { leida: true, fecha_lectura: Timestamp.now() });
}

export async function marcarTodasComoLeidas() {
  const q = query(
    collection(db, COLECCION),
    where('leida', '==', false),
    limit(100)
  );
  const snap = await getDocs(q);
  const now = Timestamp.now();
  const updates = snap.docs.map(d => updateDoc(doc(db, COLECCION, d.id), { leida: true, fecha_lectura: now }));
  await Promise.all(updates);
}

export function escucharNotificacionesNoLeidas(callback) {
  const q = query(
    collection(db, COLECCION),
    where('leida', '==', false)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.size);
  }, (err) => {
    console.error('Error en escucharNotificacionesNoLeidas:', err);
  });
}
