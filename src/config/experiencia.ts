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

/** Cuándo esa línea pasa a "Ya casi terminamos": el backend dormido tarda unos 30 s (spec 006). */
export const AVISO_CASI_MS = 20_000;

/**
 * Timeout de las lecturas que hacen esperar a quien abre una página: el mapa de la función, y
 * la ficha y los horarios de una película. El backend gratuito tarda unos 30 s en despertar; con
 * el corte de 5 s por defecto, la espera terminaba en error (spec 006).
 */
export const ESPERA_LECTURA_MS = 45_000;

/**
 * Pausa entre reintentos de esas lecturas. Mientras el backend arranca, el proxy del
 * hosting puede responder 502/503 o cortar la conexión al instante (spec 006).
 */
export const PAUSA_REINTENTO_MS = 2000;
