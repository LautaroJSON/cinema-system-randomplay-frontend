// Errores de la API (RFC 9457) decididos por `codigo`, nunca por `title` ni `detail` (Principio II).

/** Los `codigo` documentados en docs/api.md. */
const CODIGOS = [
  "pedido-invalido",
  "desafio-rechazado",
  "funcion-no-encontrada",
  "carrito-no-encontrado",
  "asientos-no-disponibles",
  "funcion-sin-cupo",
  "carrito-no-activo",
  "funcion-no-disponible",
  "asientos-inexistentes",
  "demasiados-pedidos",
] as const;

export type CodigoCarrito = (typeof CODIGOS)[number];

export type Asiento = { fila: string; numero: number };

export type Problema = {
  tipo: CodigoCarrito | "desconocido" | "red";
  /** `undefined` cuando no hubo respuesta (red o timeout). */
  status?: number;
  asientos: Asiento[];
  errors: Record<string, string[]>;
  /** Solo en `demasiados-pedidos`: segundos a esperar antes de reintentar. */
  retryAfterSegundos?: number;
  /** Solo en `carrito-no-activo`: `Abandonado`, `Expirado` u otro texto de la API. */
  estadoActual?: string;
};

const RETRY_AFTER_POR_DEFECTO = 60;
const RETRY_AFTER_MAXIMO = 600;

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const esCodigo = (valor: unknown): valor is CodigoCarrito =>
  typeof valor === "string" && (CODIGOS as readonly string[]).includes(valor);

/** `ProblemDetails` en openapi.json no declara `asientos` ni `errors`: se validan acá. */
function leerAsientos(valor: unknown): Asiento[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!esObjeto(item) || typeof item.fila !== "string" || !/^[A-Z]$/.test(item.fila)) return [];
    const numero =
      typeof item.numero === "number"
        ? item.numero
        : typeof item.numero === "string" && /^\d+$/.test(item.numero)
          ? Number(item.numero)
          : NaN;
    return Number.isInteger(numero) && numero >= 1 ? [{ fila: item.fila, numero }] : [];
  });
}

function leerErrors(valor: unknown): Record<string, string[]> {
  if (!esObjeto(valor)) return {};
  const errors: Record<string, string[]> = {};
  for (const [campo, mensajes] of Object.entries(valor)) {
    if (!Array.isArray(mensajes)) continue;
    const textos = mensajes.filter((m): m is string => typeof m === "string");
    if (textos.length > 0) errors[campo] = textos;
  }
  return errors;
}

/** Segundos o fecha HTTP (RFC 9110); la fecha se convierte a duración una sola vez. */
function leerRetryAfter(valor: string | null): number {
  let segundos = NaN;
  if (valor && /^\d+$/.test(valor.trim())) {
    segundos = Number(valor.trim());
  } else if (valor) {
    segundos = Math.ceil((Date.parse(valor) - Date.now()) / 1000);
  }
  if (!Number.isFinite(segundos) || segundos < 1) return RETRY_AFTER_POR_DEFECTO;
  return Math.min(segundos, RETRY_AFTER_MAXIMO);
}

export function problemaDeRed(): Problema {
  return { tipo: "red", asientos: [], errors: {} };
}

export async function leerProblema(respuesta: Response): Promise<Problema> {
  const problema: Problema = {
    tipo: "desconocido",
    status: respuesta.status,
    asientos: [],
    errors: {},
  };
  if (!respuesta.headers.get("Content-Type")?.includes("problem+json")) return problema;

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Un cuerpo ilegible no cambia la decisión: queda como desconocido con su status.
    return problema;
  }
  if (!esObjeto(cuerpo)) return problema;

  if (esCodigo(cuerpo.codigo)) problema.tipo = cuerpo.codigo;
  problema.asientos = leerAsientos(cuerpo.asientos);
  problema.errors = leerErrors(cuerpo.errors);
  if (problema.tipo === "demasiados-pedidos") {
    problema.retryAfterSegundos = leerRetryAfter(respuesta.headers.get("Retry-After"));
  }
  if (problema.tipo === "carrito-no-activo" && typeof cuerpo.estadoActual === "string") {
    problema.estadoActual = cuerpo.estadoActual;
  }
  return problema;
}
