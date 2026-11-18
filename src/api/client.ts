// Único punto de acceso a la API del backend (Principio I).
import { entorno } from "@/config/entorno";
import { leerProblema } from "./problema";

export class ApiError extends Error {
  readonly status?: number;
  readonly codigo?: string;

  constructor(
    mensaje: string,
    opciones: { status?: number; codigo?: string; cause?: unknown } = {},
  ) {
    super(mensaje, { cause: opciones.cause });
    this.name = "ApiError";
    this.status = opciones.status;
    this.codigo = opciones.codigo;
  }
}

type OpcionesPedido = {
  /** Segundos que Next puede reutilizar la respuesta en caché. */
  revalidate: number;
  tags: string[];
  timeoutMs?: number;
};

async function leerCodigo(respuesta: Response): Promise<string | undefined> {
  const { tipo } = await leerProblema(respuesta);
  return tipo === "desconocido" ? undefined : tipo;
}

/**
 * GET contra la API. Devuelve `null` ante 404 y lanza `ApiError` ante cualquier otro error,
 * para que Next no cachee una página rota en lugar de la última versión buena.
 */
export async function pedir<T>(ruta: string, opciones: OpcionesPedido): Promise<T | null> {
  if (entorno.usarDatosMock) {
    // TEMPORAL (spec 002): catálogo de prueba local en lugar del backend.
    const { responderConDatosMock } = await import("./datos-mock");
    try {
      return (await responderConDatosMock(ruta)) as T | null;
    } catch (causa) {
      throw new ApiError(`No se pudo leer el catálogo de prueba (${ruta}).`, { cause: causa });
    }
  }

  return pedirConFetch<T>(ruta, opciones.timeoutMs, {
    next: { revalidate: opciones.revalidate, tags: opciones.tags },
  });
}

/**
 * GET contra la API sin caché de datos, para lo que nunca se cachea (disponibilidad de
 * asientos, Principio IX). Mismo contrato que `pedir`: `null` ante 404, `ApiError` en el resto.
 * Con `reintentar`, un fallo de red o un 502/503/504 se vuelve a pedir mientras quede tiempo.
 */
export async function pedirSinCache<T>(
  ruta: string,
  opciones: { timeoutMs?: number; reintentar?: { pausaMs: number } } = {},
): Promise<T | null> {
  return pedirConFetch<T>(ruta, opciones.timeoutMs, { cache: "no-store" }, opciones.reintentar);
}

// Lo que responde el proxy del hosting mientras el backend arranca o no está listo.
const STATUS_DE_ARRANQUE = new Set([502, 503, 504]);

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

async function pedirConFetch<T>(
  ruta: string,
  timeoutMs: number | undefined,
  cacheo: Pick<RequestInit, "cache" | "next">,
  reintentar?: { pausaMs: number },
): Promise<T | null> {
  const total = timeoutMs ?? 5000;
  const limite = Date.now() + total;
  // Solo se reintenta si después de la pausa queda tiempo para otro pedido.
  const quedaTiempo = () => reintentar !== undefined && limite - Date.now() > reintentar.pausaMs;

  for (let intento = 0; ; intento++) {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${entorno.apiUrl}${ruta}`, {
        headers: { Accept: "application/json" },
        ...cacheo,
        signal: AbortSignal.timeout(intento === 0 ? total : limite - Date.now()),
      });
    } catch (causa) {
      const agotado = causa instanceof DOMException && causa.name === "TimeoutError";
      if (!agotado && quedaTiempo()) {
        await esperar(reintentar!.pausaMs);
        continue;
      }
      throw new ApiError(`No se pudo conectar con la API (${ruta}).`, { cause: causa });
    }

    if (STATUS_DE_ARRANQUE.has(respuesta.status) && quedaTiempo()) {
      await respuesta.body?.cancel();
      await esperar(reintentar!.pausaMs);
      continue;
    }
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) {
      throw new ApiError(`La API respondió ${respuesta.status} (${ruta}).`, {
        status: respuesta.status,
        codigo: await leerCodigo(respuesta),
      });
    }
    return (await respuesta.json()) as T;
  }
}
