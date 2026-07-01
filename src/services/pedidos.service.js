import { db, storage } from '../firebase.js';
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp, limit, runTransaction,
  arrayUnion, arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  calcularSubtotal, calcularTotalPagar, calcularTotalAbonado,
  calcularSaldoPendiente, determinarEstadoPago, recalcularOrden
} from '../utils/calculations.js';
import { generateAbonoId, generateProductId, normalizarTelefono } from '../utils/formatters.js';
import { guardarCliente, incrementarPedidosCliente } from './clientes.service.js';

const COLECCION = 'pedidos';

/**
 * Create a new order with products and optional first payment inside a transaction to ensure unique sequential IDs
 */
export async function crearPedido({ cliente, productos, primerAbono, abonosIniciales, notas, usuario }) {
  const normalizedPhone = normalizarTelefono(cliente.telefono);

  // Save/Update client to get their Firestore docId
  const clienteId = await guardarCliente({
    nombre: cliente.nombre,
    telefono: normalizedPhone,
    _docId: cliente.docId
  });

  // Process products with subtotals
  const productosProcessed = productos.map((p) => ({
    id_producto: generateProductId(),
    producto_tipo: p.producto_tipo.trim(),
    detalle_personalizado: p.detalle_personalizado.trim(),
    cantidad: Number(p.cantidad) || 1,
    precio_unitario: Number(p.precio_unitario) || 0,
    subtotal: calcularSubtotal(p.cantidad, p.precio_unitario),
  }));

  // Build abonos array
  const abonos = [];
  if (Array.isArray(abonosIniciales) && abonosIniciales.length > 0) {
    abonosIniciales.forEach((ab) => {
      if (Number(ab.monto) > 0) {
        abonos.push({
          id_abono: generateAbonoId(),
          fecha_pago: Timestamp.now(),
          monto: Number(ab.monto),
          metodo_pago: ab.metodo_pago || 'Efectivo',
          usuario: usuario ? {
            uid: usuario.uid || '',
            nombre: usuario.nombre || '',
            email: usuario.email || ''
          } : null
        });
      }
    });
  } else if (primerAbono && Number(primerAbono.monto) > 0) {
    abonos.push({
      id_abono: generateAbonoId(),
      fecha_pago: Timestamp.now(),
      monto: Number(primerAbono.monto),
      metodo_pago: primerAbono.metodo_pago || 'Efectivo',
      usuario: usuario ? {
        uid: usuario.uid || '',
        nombre: usuario.nombre || '',
        email: usuario.email || ''
      } : null
    });
  }

  // Calculate derived fields
  const { total_pagar, total_abonado, saldo_pendiente, estado_pago } = recalcularOrden(productosProcessed, abonos);

  // 1. Get the highest ID from legacy query if the counter document does not exist yet to seed it
  const counterRef = doc(db, 'config', 'pedidos_counter');
  const counterSnap = await getDoc(counterRef);
  let initialCount = 0;
  if (!counterSnap.exists()) {
    const q = query(
      collection(db, COLECCION),
      orderBy('fecha_creacion', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const lastId = snap.docs[0].data().id_pedido || '000';
      initialCount = parseInt(lastId, 10) || 0;
    }
  }

  const docRef = doc(collection(db, COLECCION));
  let finalPedido = null;

  // 2. Run Firestore transaction to atomically get next sequential ID and set the order
  await runTransaction(db, async (transaction) => {
    const freshCounterSnap = await transaction.get(counterRef);
    let lastNum = initialCount;
    if (freshCounterSnap.exists()) {
      lastNum = freshCounterSnap.data().current_id || 0;
    }
    const nextNum = lastNum + 1;
    const id_pedido = String(nextNum).padStart(3, '0');

    const initialHistorial = [
      {
        tipo: 'creacion',
        estado_nuevo: 'PENDIENTE',
        fecha: Timestamp.now(),
        usuario: usuario ? {
          uid: usuario.uid || '',
          nombre: usuario.nombre || '',
          email: usuario.email || ''
        } : null
      }
    ];

    if (estado_pago !== 'SIN PAGO') {
      initialHistorial.push({
        tipo: 'pago',
        estado_anterior: 'SIN PAGO',
        estado_nuevo: estado_pago,
        fecha: Timestamp.now(),
        usuario: usuario ? {
          uid: usuario.uid || '',
          nombre: usuario.nombre || '',
          email: usuario.email || ''
        } : null
      });
    }

    const pedido = {
      id_pedido,
      cliente_id: clienteId,
      cliente_nombre: cliente.nombre.trim(),
      cliente_telefono: normalizedPhone,
      productos: productosProcessed,
      abonos,
      total_pagar,
      total_abonado,
      saldo_pendiente,
      default_estado_pago: estado_pago,
      estado_pago,
      estado_produccion: 'PENDIENTE',
      fecha_creacion: Timestamp.now(),
      notas: (notas || '').trim(),
      historial_estados: initialHistorial,
    };

    transaction.set(counterRef, { current_id: nextNum });
    transaction.set(docRef, pedido);

    finalPedido = { ...pedido, _docId: docRef.id };
  });

  // Increment total_pedidos on client record asynchronously
  incrementarPedidosCliente(clienteId);

  return finalPedido;
}


/**
 * Add a new payment (abono) to an existing order and recalculate
 */
export async function agregarAbono(docId, monto, metodo_pago, usuario) {
  const docRef = doc(db, COLECCION, docId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) throw new Error('Pedido no encontrado');

  const data = snap.data();
  const nuevoAbono = {
    id_abono: generateAbonoId(),
    fecha_pago: Timestamp.now(),
    monto: Number(monto),
    metodo_pago: metodo_pago || 'Efectivo',
    usuario: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null
  };

  const abonos = [...data.abonos, nuevoAbono];
  const { total_abonado, saldo_pendiente, estado_pago } = recalcularOrden(data.productos, abonos);

  const updates = {
    abonos,
    total_abonado,
    saldo_pendiente,
    estado_pago,
  };

  if (data.estado_pago !== estado_pago) {
    const historial = data.historial_estados || [];
    historial.push({
      tipo: 'pago',
      estado_anterior: data.estado_pago || 'SIN PAGO',
      estado_nuevo: estado_pago,
      fecha: Timestamp.now(),
      usuario: usuario ? {
        uid: usuario.uid || '',
        nombre: usuario.nombre || '',
        email: usuario.email || ''
      } : null
    });
    updates.historial_estados = historial;
  }

  await updateDoc(docRef, updates);

  return { ...data, ...updates };
}

/**
 * Search orders by ID or client name
 */
export async function buscarPedidos(searchTerm) {
  const term = searchTerm.trim().toUpperCase();
  if (!term) return [];

  // Try exact match on id_pedido
  const qId = query(
    collection(db, COLECCION),
    where('id_pedido', '==', term),
    limit(20)
  );
  const snapId = await getDocs(qId);

  if (!snapId.empty) {
    return snapId.docs.map(d => ({ _docId: d.id, ...d.data() }));
  }

  // Fallback: get recent and filter client-side by name
  const qAll = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc'),
    limit(100)
  );
  const snapAll = await getDocs(qAll);
  const results = [];
  const lowerTerm = searchTerm.trim().toLowerCase();

  snapAll.docs.forEach(d => {
    const data = d.data();
    if (
      data.cliente_nombre.toLowerCase().includes(lowerTerm) ||
      data.id_pedido.toLowerCase().includes(lowerTerm)
    ) {
      results.push({ _docId: d.id, ...data });
    }
  });

  return results;
}

/**
 * Get a single order by doc ID
 */
export async function obtenerPedido(docId) {
  const docRef = doc(db, COLECCION, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}

/**
 * Listen to real-time changes on a single order
 */
export function escucharPedido(docId, callback) {
  const docRef = doc(db, COLECCION, docId);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback({ _docId: snap.id, ...snap.data() });
    }
  });
}

/**
 * Update production status
 */
export async function actualizarEstadoProduccion(docId, estado, usuario) {
  const docRef = doc(db, COLECCION, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Pedido no encontrado');
  const existing = snap.data();

  const estadoAnterior = existing.estado_produccion || 'PENDIENTE';
  const historial = existing.historial_estados || [];

  const nuevoCambio = {
    tipo: 'produccion',
    estado_anterior: estadoAnterior,
    estado_nuevo: estado,
    fecha: Timestamp.now(),
    usuario: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null
  };

  const updates = {
    estado_produccion: estado,
    historial_estados: [...historial, nuevoCambio]
  };

  if (estado === 'ENTREGADO') {
    updates.fecha_entrega = Timestamp.now();
  } else {
    updates.fecha_entrega = null;
  }

  await updateDoc(docRef, updates);
}

/**
 * Get recent orders
 */
/**
 * Get all unique product types from recent orders
 */
export async function obtenerTiposProducto() {
  if (localStorage.getItem('dev_bypass') === 'true') {
    return ['Banner', 'Sticker', 'Volante', 'Taza personalizada', 'Tarjeta de presentación'];
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc'),
    limit(200)
  );
  const snap = await getDocs(q);
  const tiposSet = new Set();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.productos)) {
      data.productos.forEach(p => {
        if (p.producto_tipo) tiposSet.add(p.producto_tipo.trim());
      });
    }
  });
  return Array.from(tiposSet).sort();
}

/**
 * Update an existing order: replaces productos, notes, and recalculates totals.
 * Preserves id_pedido, cliente, existing abonos, and fecha_creacion.
 */
export async function actualizarPedido(docId, { productos, notas, abonos, usuario }) {
  const productosProcessed = productos.map((p) => ({
    id_producto: p.id_producto || generateProductId(),
    producto_tipo: p.producto_tipo.trim(),
    detalle_personalizado: p.detalle_personalizado.trim(),
    cantidad: Number(p.cantidad) || 1,
    precio_unitario: Number(p.precio_unitario) || 0,
    subtotal: calcularSubtotal(p.cantidad, p.precio_unitario),
  }));

  const docRef = doc(db, COLECCION, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Pedido no encontrado');

  const existing = snap.data();

  // Procesar abonos manteniendo los existentes y generando datos completos para los nuevos
  let abonosFinales = [];
  if (abonos !== undefined) {
    if (Array.isArray(abonos)) {
      abonos.forEach((ab) => {
        if (Number(ab.monto) > 0) {
          if (ab.id_abono) {
            abonosFinales.push({
              id_abono: ab.id_abono,
              fecha_pago: ab.fecha_pago,
              monto: Number(ab.monto),
              metodo_pago: ab.metodo_pago || 'Efectivo',
              usuario: ab.usuario || null,
            });
          } else {
            abonosFinales.push({
              id_abono: generateAbonoId(),
              fecha_pago: Timestamp.now(),
              monto: Number(ab.monto),
              metodo_pago: ab.metodo_pago || 'Efectivo',
              usuario: usuario || null,
            });
          }
        }
      });
    }
  } else {
    abonosFinales = existing.abonos || [];
  }

  const { total_pagar, total_abonado, saldo_pendiente, estado_pago } = recalcularOrden(productosProcessed, abonosFinales);

  await updateDoc(docRef, {
    productos: productosProcessed,
    notas: (notas || '').trim(),
    abonos: abonosFinales,
    total_pagar,
    total_abonado,
    saldo_pendiente,
    estado_pago,
    updated_at: Timestamp.now(),
  });
}

export async function obtenerPedidosRecientes(maxResults = 20) {
  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

export function escucharPedidosRecientes(maxResults = 20, callback) {
  if (localStorage.getItem('dev_bypass') === 'true') {
    const defaultPedidos = [
      {
        _docId: 'mock-p-1',
        id_pedido: '001',
        cliente_nombre: 'Juan Pérez',
        cliente_telefono: '987654321',
        fecha_creacion: { seconds: Math.floor(Date.now() / 1000) },
        estado_pago: 'PAGADO',
        estado_produccion: 'PENDIENTE',
        total_pagar: 150.00,
        total_abonado: 150.00,
        saldo_pendiente: 0.00,
        productos: [
          { producto_tipo: 'Banner publicitario', cantidad: 1, precio_unitario: 150.00, detalle_personalizado: '1.5x2m con ojales' }
        ],
        abonos: []
      }
    ];
    // Trigger callback immediately asynchronously
    setTimeout(() => callback(defaultPedidos), 50);
    return () => {};
  }

  const q = query(
    collection(db, COLECCION),
    orderBy('fecha_creacion', 'desc'),
    limit(maxResults)
  );
  return onSnapshot(q, (snap) => {
    const pedidos = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    callback(pedidos);
  });
}

export async function eliminarPedido(docId) {
  await deleteDoc(doc(db, COLECCION, docId));
}

export async function adjuntarArchivoAPedido(pedidoId, file, usuario) {
  // Generar un nombre único para evitar colisiones
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `pedidos/${pedidoId}/${timestamp}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  // Subir el archivo
  await uploadBytes(storageRef, file);

  // Obtener URL de descarga
  const downloadURL = await getDownloadURL(storageRef);

  // Guardar en Firestore en el array 'adjuntos'
  const pedidoRef = doc(db, COLECCION, pedidoId);
  const nuevoAdjunto = {
    nombre: file.name,
    url: downloadURL,
    tipo: file.type,
    fecha: new Date().toISOString(),
    usuario: usuario ? {
      uid: usuario.uid || '',
      nombre: usuario.nombre || '',
      email: usuario.email || ''
    } : null
  };

  await updateDoc(pedidoRef, {
    adjuntos: arrayUnion(nuevoAdjunto)
  });

  return nuevoAdjunto;
}

export async function eliminarAdjuntoPedido(pedidoId, adjuntoObj) {
  const pedidoRef = doc(db, COLECCION, pedidoId);
  
  // Eliminar de Firestore
  await updateDoc(pedidoRef, {
    adjuntos: arrayRemove(adjuntoObj)
  });

  // Intentar borrar físicamente de Firebase Storage
  if (adjuntoObj.url && adjuntoObj.url.includes('firebasestorage.googleapis.com')) {
    try {
      const fileRef = ref(storage, adjuntoObj.url);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn('Error al eliminar archivo físico de Storage:', err);
    }
  }
}
