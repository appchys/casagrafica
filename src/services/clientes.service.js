import { db } from '../firebase.js';
import {
  collection, doc, setDoc, getDocs, query,
  orderBy, limit, Timestamp, getDoc, updateDoc
} from 'firebase/firestore';
import { normalizarTelefono, normalizarTexto } from '../utils/formatters.js';

const COL = 'clientes';

// Caché en memoria para clientes
let clientesCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutos

/**
 * Asegura que los clientes estén cargados en el caché en memoria
 */
async function asegurarClientesCargados() {
  const ahora = Date.now();
  if (clientesCache && (ahora - lastFetchTime < CACHE_DURATION)) {
    return clientesCache;
  }

  const q = query(
    collection(db, COL),
    orderBy('nombre_lower'),
    limit(3000)
  );
  const snap = await getDocs(q);
  clientesCache = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  lastFetchTime = ahora;
  return clientesCache;
}

/**
 * Precarga el listado de clientes en segundo plano
 */
export async function precargarClientes() {
  try {
    await asegurarClientesCargados();
  } catch (err) {
    console.error("Error precargando clientes:", err);
  }
}

/**
 * Search clients by name prefix (case-insensitive, using in-memory cache)
 */
export async function buscarClientesPorNombre(texto) {
  if (!texto || texto.trim().length < 2) return [];

  const clientes = await asegurarClientesCargados();
  const lower = normalizarTexto(texto);

  return clientes
    .filter(c => normalizarTexto(c.nombre || '').includes(lower))
    .slice(0, 8);
}

/**
 * Search clients by phone number (prefix match, using in-memory cache)
 */
export async function buscarClientesPorTelefono(telefono) {
  if (!telefono || telefono.trim().length < 2) return [];

  const clientes = await asegurarClientesCargados();
  const cleanTerm = cleanPhoneForSearch(telefono);
  if (!cleanTerm) return [];

  return clientes
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
  let clean = num.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = clean.slice(1);
  }
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
  let finalDocId = _docId;

  if (_docId) {
    const ref = doc(db, COL, _docId);
    const updateData = {
      telefono: normalizedPhone,
      updated_at: Timestamp.now(),
    };
    if (nombre) {
      updateData.nombre = nombre.trim().toUpperCase();
      updateData.nombre_lower = normalizarTexto(nombre);
    }
    if (ruc) updateData.ruc = ruc;
    if (email) updateData.email = email;
    if (direccion) updateData.direccion = direccion;
    await updateDoc(ref, updateData);
  } else {
    // New client
    const ref = doc(collection(db, COL));
    const extraFields = {};
    if (ruc) extraFields.ruc = ruc;
    if (email) extraFields.email = email;
    if (direccion) extraFields.direccion = direccion;
    await setDoc(ref, {
      nombre: nombre.trim().toUpperCase(),
      nombre_lower: normalizarTexto(nombre),
      telefono: normalizedPhone,
      fecha_creacion: Timestamp.now(),
      updated_at: Timestamp.now(),
      ...extraFields,
    });
    finalDocId = ref.id;
  }

  // Sincronizar el caché en memoria
  if (clientesCache) {
    const idx = clientesCache.findIndex(c => c._docId === finalDocId);
    const cliData = {
      _docId: finalDocId,
      nombre: nombre.trim().toUpperCase(),
      nombre_lower: normalizarTexto(nombre),
      telefono: normalizedPhone,
      ruc: ruc || '',
      email: email || '',
      direccion: direccion || '',
      updated_at: Timestamp.now()
    };
    if (idx !== -1) {
      clientesCache[idx] = { ...clientesCache[idx], ...cliData };
    } else {
      clientesCache.push({ ...cliData, fecha_creacion: Timestamp.now() });
      clientesCache.sort((a, b) => (a.nombre_lower || '').localeCompare(b.nombre_lower || ''));
    }
  }

  return finalDocId;
}

/**
 * Get a single client by docId
 */
export async function obtenerCliente(docId) {
  const snap = await getDoc(doc(db, COL, docId));
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}
