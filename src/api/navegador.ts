// Solo navegador: llega a la API por el proxy de next.config.ts (URL relativa, mismo origen).
import { leerProblema, problemaDeRed, type Problema } from "./problema";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; problema: Problema };

type OpcionesNavegador = {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
  /** Credencial del carrito: viaja solo como header, nunca en la URL (Principio III). */
  token?: string;
  timeoutMs?: number;
};

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
    return { ok: false, problema: problemaDeRed() };
  }

  if (!respuesta.ok) return { ok: false, problema: await leerProblema(respuesta) };
  if (respuesta.status === 204) return { ok: true, datos: undefined as T };
  try {
    return { ok: true, datos: (await respuesta.json()) as T };
  } catch {
    return { ok: true, datos: undefined as T };
  }
}
