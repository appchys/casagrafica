import { db } from '../firebase.js';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, Timestamp
} from 'firebase/firestore';

const COLECCION = 'productos_guardados';

export async function guardarProducto(producto) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    const data = {
      _docId: 'mock-sp-' + Date.now(),
      producto_tipo: producto.producto_tipo.trim(),
      detalle_personalizado: (producto.detalle_personalizado || '').trim(),
      precio_unitario: Number(producto.precio_unitario) || 0,
      fecha_creacion: { seconds: Math.floor(Date.now() / 1000) }
    };
    const list = await obtenerProductosGuardados();
    list.unshift(data);
    localStorage.setItem('mock_productos_guardados', JSON.stringify(list));
    return data;
  }

  const data = {
    producto_tipo: producto.producto_tipo.trim(),
    detalle_personalizado: (producto.detalle_personalizado || '').trim(),
    precio_unitario: Number(producto.precio_unitario) || 0,
    fecha_creacion: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, COLECCION), data);
  return { _docId: docRef.id, ...data };
}

export async function obtenerProductosGuardados() {
  if (localStorage.getItem('dev_bypass') === 'true') {
    const localSaved = localStorage.getItem('mock_productos_guardados');
    if (localSaved) {
      return JSON.parse(localSaved);
    }
    const defaults = [
      { _docId: 'mock-sp-1', producto_tipo: 'Banner publicitario', detalle_personalizado: 'Lona de 13oz con ojalillos cada metro', precio_unitario: 15.00 },
      { _docId: 'mock-sp-2', producto_tipo: 'Stickers troquelados', detalle_personalizado: 'Vinil autoadhesivo brillante con corte personalizado', precio_unitario: 0.50 },
      { _docId: 'mock-sp-3', producto_tipo: 'Volantes A5', detalle_personalizado: 'Papel couché de 115g, full color ambas caras', precio_unitario: 0.12 }
    ];
    localStorage.setItem('mock_productos_guardados', JSON.stringify(defaults));
    return defaults;
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

export async function eliminarProductoGuardado(docId) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    const list = await obtenerProductosGuardados();
    const filtered = list.filter(item => item._docId !== docId);
    localStorage.setItem('mock_productos_guardados', JSON.stringify(filtered));
    return;
  }

  await deleteDoc(doc(db, COLECCION, docId));
}
