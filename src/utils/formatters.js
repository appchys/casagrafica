/**
 * Format a number as currency
 */
export function formatCurrency(amount) {
  return '$' + Number(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a Firestore Timestamp or Date to readable string
 */
export function formatDate(timestamp) {
  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format just the date portion
 */
export function formatDateShort(timestamp) {
  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function timeAgo(timestamp) {
  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}sem`;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

/**
 * Generate a unique abono ID
 */
export function generateAbonoId() {
  return 'ab_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

/**
 * Generate a unique product ID
 */
export function generateProductId() {
  return 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

/**
 * Normaliza un número de celular al formato internacional de WhatsApp (sin espacios, sin guiones, con prefijo)
 * Prefijo por defecto para Ecuador es +593
 */
export function normalizarTelefono(tel) {
  if (!tel) return '';
  
  // Limpiar espacios, guiones, paréntesis
  let limpio = tel.trim().replace(/[\s\-\(\)]/g, '');

  if (!limpio) return '';

  // Si ya tiene el símbolo +, limpiar otros caracteres no numéricos excepto el +
  if (limpio.startsWith('+')) {
    return '+' + limpio.replace(/\D/g, '');
  }

  // Si empieza con 00, tratarlo como indicativo internacional (reemplazar por +)
  if (limpio.startsWith('00')) {
    return '+' + limpio.slice(2).replace(/\D/g, '');
  }

  // Caso típico de Ecuador: 09XXXXXXXX -> +5939XXXXXXXX (remover el 0 del inicio)
  if (limpio.startsWith('09') && limpio.length === 10) {
    return '+593' + limpio.slice(1).replace(/\D/g, '');
  }

  // Si empieza con 9 y tiene 9 dígitos (celular sin el 0 inicial) -> +5939XXXXXXXX
  if (limpio.startsWith('9') && limpio.length === 9) {
    return '+593' + limpio.replace(/\D/g, '');
  }

  // Si empieza con 593 (código Ecuador sin el +) -> +593XXXXXXXX
  if (limpio.startsWith('593')) {
    return '+' + limpio.replace(/\D/g, '');
  }

  // Para cualquier otro número local, si empieza con 0, remover y poner prefijo Ecuador
  if (limpio.startsWith('0')) {
    return '+593' + limpio.slice(1).replace(/\D/g, '');
  }

  // Si no cumple ninguna pero tiene longitud de celular local sin prefijo (ej: 9XXXXXXXX)
  if (limpio.length === 9) {
    return '+593' + limpio.replace(/\D/g, '');
  }

  // Si contiene código pero no tiene el +, y tiene más de 10 dígitos (ej: 573123456789)
  return '+' + limpio.replace(/\D/g, '');
}

/**
 * Normaliza un texto eliminando tildes, diéresis y convirtiendo la ñ en n
 * de forma case-insensitive, recortando espacios al inicio y final.
 */
export function normalizarTexto(str) {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve tildes y diéresis
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .trim();
}


