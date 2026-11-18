// Valores de experiencia, no de validación: la API decide (Principio IV).
export const MAX_BUTACAS_POR_COMPRA = 10;

/** Desde cuánto antes del vencimiento el contador cambia de color y se avisa. */
export const AVISO_VENCIMIENTO_MS = 2 * 60 * 1000;

/** Entre consultas de la página de vuelta del pago: lo recomienda el contrato del backend. */
export const INTERVALO_CONSULTA_PAGO_MS = 2000;

/** Tope de consultas automáticas de la página de vuelta; después se ofrece revisar a mano. */
export const ESPERA_PAGO_MAXIMA_MS = 2 * 60 * 1000;

/** Cuándo el aviso de carga de un horario suma la línea de demora (spec 006, FR-005). */
export const AVISO_DEMORA_MS = 5000;

/**
 * Timeout de la lectura del mapa de la función en el servidor. El backend gratuito tarda unos
 * 30 s en despertar; con el corte de 5 s por defecto, la espera terminaba en error (spec 006).
 */
export const ESPERA_LECTURA_MS = 45_000;
