// Solo navegador: llega a la API por el proxy de next.config.ts (URL relativa, mismo origen).
import { leerProblema, problemaDeRed, type Problema } from "./problema";

/** Hora del servidor (header `Date`) y del dispositivo al recibir la respuesta, para el contador. */
type Recepcion = { horaServidorMs: number | null; recibidoEnMs: number };

export type Resultado<T> =
  ({ ok: true; datos: T } & Recepcion) | ({ ok: false; problema: Problema } & Recepcion);

type OpcionesNavegador = {
  metodo?: "GET" | "POST" | "PUT";
  cuerpo?: unknown;
  /** Credencial del carrito: viaja solo como header, nunca en la URL (Principio III). */
  token?: string;
  timeoutMs?: number;
};

function leerRecepcion(respuesta: Response | undefined): Recepcion {
  const fecha = respuesta?.headers.get("Date");
  const horaServidorMs = fecha ? Date.parse(fecha) : NaN;
  return {
    horaServidorMs: Number.isNaN(horaServidorMs) ? null : horaServidorMs,
    recibidoEnMs: Date.now(),
  };
}

/** Transforma los datos de un éxito y deja pasar el resto del resultado tal cual. */
export function mapearResultado<T, U>(
  resultado: Resultado<T>,
  mapear: (datos: T) => U,
): Resultado<U> {
  return resultado.ok ? { ...resultado, datos: mapear(resultado.datos) } : resultado;
}

/**
 * Pedido sin caché que nunca lanza: devuelve el resultado o el problema, para que cada
 * pantalla tenga que decidir qué hacer con cada `codigo`.
 */
export async function pedirDesdeNavegador<T>(
  ruta: string,
  { metodo = "GET", cuerpo, token, timeoutMs = 8000 }: OpcionesNavegador = {},
): Promise<Resultado<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, problema: problemaDeRed(), ...leerRecepcion(undefined) };
  }

  const recepcion = leerRecepcion(respuesta);
  if (!respuesta.ok) return { ok: false, problema: await leerProblema(respuesta), ...recepcion };
  if (respuesta.status === 204) return { ok: true, datos: undefined as T, ...recepcion };
  try {
    return { ok: true, datos: (await respuesta.json()) as T, ...recepcion };
  } catch {
    return { ok: true, datos: undefined as T, ...recepcion };
  }
}
