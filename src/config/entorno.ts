// Variables de entorno del servidor. Ninguna lleva prefijo NEXT_PUBLIC_: no llegan al navegador.

function leerUrl(nombre: "API_URL" | "SITE_URL"): string {
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
  get apiUrl() {
    return leerUrl("API_URL");
  },
  get siteUrl() {
    return leerUrl("SITE_URL");
  },
  /** TEMPORAL (spec 002): con API_MOCK=1 el cliente responde con el catálogo de prueba local. */
  get usarDatosMock() {
    return process.env.API_MOCK === "1";
  },
};
