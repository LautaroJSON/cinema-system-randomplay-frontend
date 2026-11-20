// Variables de entorno del servidor. Ninguna lleva prefijo NEXT_PUBLIC_: no llegan al navegador.
import { resolverBackend } from "./backend";

function leerUrl(nombre: "SITE_URL"): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Ver .env.example.`);
  }
  try {
    new URL(valor);
  } catch {
    throw new Error(`La variable de entorno ${nombre} no es una URL absoluta: "${valor}".`);
  }
  return valor.replace(/\/+$/, "");
}

export const entorno = {
  /** Sale de API_URL o de BACKEND (local, hosteado o mock). Ver src/config/backend.ts. */
  get apiUrl() {
    return resolverBackend(process.env).url;
  },
  get siteUrl() {
    return leerUrl("SITE_URL");
  },
  /** TEMPORAL (spec 002): con API_MOCK=1 el cliente responde con el catálogo de prueba local. */
  get usarDatosMock() {
    return process.env.API_MOCK === "1";
  },
  /**
   * Página de pago simulado (`/carritos/{id}/pago-simulado`): con `next dev`, o con
   * PAGO_SIMULADO=1 para los e2e, que corren con `next start`. La leen solo Server Components y la
   * pasan como prop; no es un secreto (research P3).
   */
  get pagoSimulado() {
    return process.env.NODE_ENV === "development" || process.env.PAGO_SIMULADO === "1";
  },
};
