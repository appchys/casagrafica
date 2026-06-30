import { db } from '../firebase.js';
import {
  collection, doc, setDoc, getDocs, query,
  where, orderBy, limit, Timestamp, getDoc, updateDoc, increment
} from 'firebase/firestore';
import { normalizarTelefono } from '../utils/formatters.js';

const COL = 'clientes';

/**
 * Search clients by name prefix (case-insensitive, client-side filter on top 100)
 */
export async function buscarClientesPorNombre(texto) {
  if (!texto || texto.trim().length < 2) return [];

  // Fetch ordered by nombre, filter client-side (Firestore no supports case-insensitive search natively)
  const q = query(
    collection(db, COL),
    orderBy('nombre_lower'),
    limit(100)
  );
  const snap = await getDocs(q);
  const lower = texto.trim().toLowerCase();

  return snap.docs
    .map(d => ({ _docId: d.id, ...d.data() }))
    .filter(c => c.nombre_lower?.includes(lower))
    .slice(0, 8);
}

/**
 * Search clients by phone number (prefix match, ignoring country code +593 or local leading zero)
 */
export async function buscarClientesPorTelefono(telefono) {
  if (!telefono || telefono.trim().length < 2) return [];

  const q = query(
    collection(db, COL),
    orderBy('telefono'),
    limit(100)
  );
  const snap = await getDocs(q);
  
  const cleanTerm = cleanPhoneForSearch(telefono);
  if (!cleanTerm) return []; // avoid matching empty strings

  return snap.docs
    .map(d => ({ _docId: d.id, ...d.data() }))
    .filter(c => {
      const cleanDbPhone = cleanPhoneForSearch(c.telefono || '');
      return cleanDbPhone.includes(cleanTerm);
    })
    .slice(0, 8);
}

/**
 * Normaliza un número telefónico extrayendo solo dígitos y removiendo el 0 inicial 
 * o el prefijo de país 593 para permitir búsquedas cruzadas fluidas.
 */
function cleanPhoneForSearch(num) {
  if (!num) return '';
  // 1. Solo dígitos
  let clean = num.replace(/\D/g, '');
  // 2. Remover cero inicial si lo tiene
  if (clean.startsWith('0')) {
    clean = clean.slice(1);
  }
  // 3. Remover código de Ecuador si lo tiene
  if (clean.startsWith('593')) {
    clean = clean.slice(3);
  }
  return clean;
}

/**
 * Create or update a client record.
 * Returns the docId of the client.
 */
export async function guardarCliente({ nombre, telefono, _docId, ruc, email, direccion }) {
  const normalizedPhone = normalizarTelefono(telefono);

  if (_docId) {
    const ref = doc(db, COL, _docId);
    const updateData = {
      telefono: normalizedPhone,
      updated_at: Timestamp.now(),
    };
    if (nombre) {
      updateData.nombre = nombre.trim();
      updateData.nombre_lower = nombre.trim().toLowerCase();
    }
    if (ruc) updateData.ruc = ruc;
    if (email) updateData.email = email;
    if (direccion) updateData.direccion = direccion;
    await updateDoc(ref, updateData);
    return _docId;
  }

  // New client
  const ref = doc(collection(db, COL));
  const extraFields = {};
  if (ruc) extraFields.ruc = ruc;
  if (email) extraFields.email = email;
  if (direccion) extraFields.direccion = direccion;
  await setDoc(ref, {
    nombre: nombre.trim(),
    nombre_lower: nombre.trim().toLowerCase(),
    telefono: normalizedPhone,
    fecha_creacion: Timestamp.now(),
    updated_at: Timestamp.now(),
    total_pedidos: 0,
    ...extraFields,
  });
  return ref.id;
}

/**
 * Increment total_pedidos counter on a client document
 */
export async function incrementarPedidosCliente(clienteDocId) {
  if (!clienteDocId) return;
  try {
    const ref = doc(db, COL, clienteDocId);
    await updateDoc(ref, { total_pedidos: increment(1) });
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Get a single client by docId
 */
export async function obtenerCliente(docId) {
  const snap = await getDoc(doc(db, COL, docId));
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}
