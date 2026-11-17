// Decisiones del pago (spec 005): lógica pura, sin React ni navegador.
import { ESPERA_PAGO_MAXIMA_MS } from "@/config/experiencia";

/** Con la pasarela simulada, la `urlPago` del backend empieza así (research P4). */
export const PREFIJO_PAGO_SIMULADO = "/api/dev/pagos-simulados/";

export type DestinoPago =
  { tipo: "externo"; url: string } | { tipo: "simulado"; ruta: string } | { tipo: "invalido" };

const rutaCarrito = (carritoId: string) => `/carritos/${encodeURIComponent(carritoId)}`;

/** Página a la que vuelve el comprador desde la pasarela. */
export const rutaVuelta = (carritoId: string) => `${rutaCarrito(carritoId)}/pago`;

/**
 * Adónde llevar al comprador con la `urlPago` del backend. Solo se sigue una dirección `https:`
 * absoluta o, si está habilitada, la ruta simulada, que se cambia por la página propia del sitio.
 * Cualquier otra cosa no se abre (FR-008 a FR-010).
 */
export function destinoPago(
  urlPago: string,
  carritoId: string,
  simuladoHabilitado: boolean,
): DestinoPago {
  if (urlPago.startsWith(PREFIJO_PAGO_SIMULADO)) {
    return simuladoHabilitado
      ? { tipo: "simulado", ruta: `${rutaCarrito(carritoId)}/pago-simulado` }
      : { tipo: "invalido" };
  }
  let url: URL;
  try {
    // Sin base: una ruta relativa o `//host` no parsea y queda inválida.
    url = new URL(urlPago);
  } catch {
    return { tipo: "invalido" };
  }
  return url.protocol === "https:" ? { tipo: "externo", url: urlPago } : { tipo: "invalido" };
}

export type PasoEspera = "consultar" | "detener" | "terminar";

/** Qué hace la página de vuelta con el estado recibido y el tiempo que lleva esperando. */
export function siguientePaso(estado: string, transcurridoMs: number): PasoEspera {
  if (estado !== "Pagando") return "terminar";
  return transcurridoMs < ESPERA_PAGO_MAXIMA_MS ? "consultar" : "detener";
}

const MONTO = /^\d{1,9}(\.\d{1,2})?$/;
const MENSAJE_MONTO = "Escribí un monto mayor que cero, con hasta dos decimales.";

/**
 * Monto de "Pagar otro monto". Se valida como texto y se convierte a número solo para enviarlo:
 * no se hace aritmética con él (Principio V, research P11).
 */
export function validarMontoSimulado(
  texto: string,
): { ok: true; monto: number } | { ok: false; mensaje: string } {
  const limpio = texto.trim();
  if (!MONTO.test(limpio) || /^0+(\.0*)?$/.test(limpio))
    return { ok: false, mensaje: MENSAJE_MONTO };
  return { ok: true, monto: Number(limpio) };
}
