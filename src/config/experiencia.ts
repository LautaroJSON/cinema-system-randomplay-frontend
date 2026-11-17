// Valores de experiencia, no de validación: la API decide (Principio IV).
export const MAX_BUTACAS_POR_COMPRA = 10;

/** Desde cuánto antes del vencimiento el contador cambia de color y se avisa. */
export const AVISO_VENCIMIENTO_MS = 2 * 60 * 1000;

/** Entre consultas de la página de vuelta del pago: lo recomienda el contrato del backend. */
export const INTERVALO_CONSULTA_PAGO_MS = 2000;

/** Tope de consultas automáticas de la página de vuelta; después se ofrece revisar a mano. */
export const ESPERA_PAGO_MAXIMA_MS = 2 * 60 * 1000;
