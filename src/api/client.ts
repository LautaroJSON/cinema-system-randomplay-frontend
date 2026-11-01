// Único punto de acceso a la API del backend (Principio I).
import { entorno } from "@/config/entorno";

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
  if (!respuesta.headers.get("Content-Type")?.includes("problem+json")) return undefined;
  try {
    const cuerpo: unknown = await respuesta.json();
    if (cuerpo && typeof cuerpo === "object" && "codigo" in cuerpo) {
      return typeof cuerpo.codigo === "string" ? cuerpo.codigo : undefined;
    }
  } catch {
    // Un cuerpo ilegible no cambia la decisión: se decide por status.
  }
  return undefined;
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

  let respuesta: Response;
  try {
    respuesta = await fetch(`${entorno.apiUrl}${ruta}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: opciones.revalidate, tags: opciones.tags },
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 5000),
    });
  } catch (causa) {
    throw new ApiError(`No se pudo conectar con la API (${ruta}).`, { cause: causa });
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
