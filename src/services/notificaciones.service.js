import { db } from '../firebase.js';
import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';

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
