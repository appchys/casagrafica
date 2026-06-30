/**
 * Calculate subtotal for a single product item
 */
export function calcularSubtotal(cantidad, precioUnitario) {
  return Math.round((Number(cantidad) || 0) * (Number(precioUnitario) || 0) * 100) / 100;
}

/**
 * Calculate the total to pay from an array of products
 */
export function calcularTotalPagar(productos) {
  return productos.reduce((sum, p) => {
    const subtotal = calcularSubtotal(p.cantidad, p.precio_unitario);
    return Math.round((sum + subtotal) * 100) / 100;
  }, 0);
}

/**
 * Calculate total paid from an array of abonos
 */
export function calcularTotalAbonado(abonos) {
  return abonos.reduce((sum, a) => {
    return Math.round((sum + (Number(a.monto) || 0)) * 100) / 100;
  }, 0);
}

/**
 * Calculate remaining balance
 */
export function calcularSaldoPendiente(totalPagar, totalAbonado) {
  return Math.round((totalPagar - totalAbonado) * 100) / 100;
}

/**
 * Determine payment status based on amounts
 */
export function determinarEstadoPago(totalPagar, totalAbonado) {
  if (totalPagar <= 0) return 'SIN PAGO';
  if (totalAbonado <= 0) return 'SIN PAGO';
  if (totalAbonado >= totalPagar) return 'PAGADO';
  return 'PARCIAL';
}

/**
 * Recalculate all derived fields for an order
 */
export function recalcularOrden(productos, abonos) {
  const total_pagar = calcularTotalPagar(productos);
  const total_abonado = calcularTotalAbonado(abonos);
  const saldo_pendiente = calcularSaldoPendiente(total_pagar, total_abonado);
  const estado_pago = determinarEstadoPago(total_pagar, total_abonado);

  return { total_pagar, total_abonado, saldo_pendiente, estado_pago };
}
