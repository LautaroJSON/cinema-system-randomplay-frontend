// Qué backend usa el sitio. Lo leen next.config.ts (proxy /api) y entorno.ts (pedidos del
// servidor), así que no importa nada de Next: tiene que poder cargarse desde la config.

export const BACKENDS = {
  local: "http://localhost:8080",
  hosteado: "https://cinema-system-randomplay-backend.onrender.com",
  mock: "http://127.0.0.1:4010",
} as const;

export type Backend = keyof typeof BACKENDS;

type Variables = {
  API_URL?: string;
  BACKEND?: string;
  API_URL_LOCAL?: string;
  [otra: string]: string | undefined;
};

/**
 * Base del backend, sin barra final.
 *
 * `API_URL` gana si está definida: la usan los despliegues y los e2e, que tienen que apuntar a
 * una URL exacta aunque `.env.local` diga otra cosa. Si no, `BACKEND` elige entre `local`,
 * `hosteado` y `mock`. `API_URL_LOCAL` cambia la URL de `local` si tu backend no usa el 8080.
 */
export function resolverBackend(variables: Variables): { url: string; origen: string } {
  if (variables.API_URL) return { url: validar("API_URL", variables.API_URL), origen: "API_URL" };

  const backend = variables.BACKEND;
  if (!backend) {
    throw new Error(
      "Falta elegir el backend: definí BACKEND=local, hosteado o mock (o API_URL). Ver .env.example.",
    );
  }
  if (!Object.hasOwn(BACKENDS, backend)) {
    throw new Error(
      `BACKEND="${backend}" no existe. Opciones: ${Object.keys(BACKENDS).join(", ")}.`,
    );
  }

  const url =
    backend === "local" && variables.API_URL_LOCAL
      ? validar("API_URL_LOCAL", variables.API_URL_LOCAL)
      : BACKENDS[backend as Backend];
  return { url, origen: `BACKEND=${backend}` };
}

function validar(nombre: string, valor: string): string {
  try {
    new URL(valor);
  } catch {
    throw new Error(`La variable de entorno ${nombre} no es una URL absoluta: "${valor}".`);
  }
  return valor.replace(/\/+$/, "");
}
