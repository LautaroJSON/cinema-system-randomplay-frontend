// Estado del carrito y decisiones por `codigo` (Principios II y IV): lógica pura, sin React.
import type { Carrito } from "@/api/carritos";
import type { Problema } from "@/api/problema";
import type { Tramo } from "./cuenta-regresiva";
import type { SesionCarrito } from "./sesion-carrito";

const ETIQUETAS: Record<string, string> = {
  Activo: "Activo",
  Abandonado: "Abandonado",
  Expirado: "Vencido",
};

/** Etiqueta visible del `estado`; un valor nuevo de la API no se muestra crudo (Principio V). */
export function etiquetaEstado(estado: string): string {
  return ETIQUETAS[estado] ?? "Estado desconocido";
}

/** Según la API, el carrito todavía retiene sus butacas. */
export const estaActivo = (carrito: Carrito) => carrito.estado === "Activo";

/** Solo un carrito `Activo` con tiempo restante admite cambios (FR-011, FR-014). */
export function esModificable(carrito: Carrito, tramoActual: Tramo | null): boolean {
  return estaActivo(carrito) && tramoActual !== "vencido";
}

/** El token ya no sirve: `carrito-no-encontrado`, o un 401, que llega sin `codigo` (FR-034). */
export function credencialPerdida(problema: Problema): boolean {
  return problema.tipo === "carrito-no-encontrado" || problema.status === 401;
}

export type MotivoLectura = "abandonado" | "vencido" | "noActivo";

export type VistaPantalla =
  | { tipo: "sinLeer" }
  | { tipo: "sinSesion" }
  | { tipo: "activo"; sesion: SesionCarrito & { token: string } }
  | { tipo: "lectura"; motivo: MotivoLectura; carrito: Carrito }
  | { tipo: "perdido"; peliculaId: string | null };

function motivoLectura(carrito: Carrito, tramoActual: Tramo | null): MotivoLectura {
  if (carrito.estado === "Abandonado") return "abandonado";
  if (carrito.estado === "Expirado" || tramoActual === "vencido") return "vencido";
  return "noActivo";
}

/** Estado visible en modo lectura: un carrito vencido por el contador figura "Vencido". */
export function etiquetaLectura(motivo: MotivoLectura, carrito: Carrito): string {
  if (motivo === "abandonado") return "Abandonado";
  if (motivo === "vencido") return "Vencido";
  return estaActivo(carrito) ? "No activo" : etiquetaEstado(carrito.estado);
}

/**
 * Qué muestra la pantalla del carrito, derivado de la sesión de la pestaña (la fuente de verdad)
 * y del contador. Una sesión sin token nunca vuelve a activo.
 */
export function vistaPantalla({
  leida,
  sesion,
  carritoId,
  tramo: tramoActual,
  perdido,
}: {
  leida: boolean;
  sesion: SesionCarrito | null;
  carritoId: string;
  tramo: Tramo | null;
  perdido: { peliculaId: string | null } | null;
}): VistaPantalla {
  if (!leida) return { tipo: "sinLeer" };
  if (perdido) return { tipo: "perdido", peliculaId: perdido.peliculaId };
  if (sesion?.carritoId !== carritoId) return { tipo: "sinSesion" };
  const { token, carrito } = sesion;
  if (token !== null && esModificable(carrito, tramoActual)) {
    return { tipo: "activo", sesion: { ...sesion, token } };
  }
  return { tipo: "lectura", motivo: motivoLectura(carrito, tramoActual), carrito };
}

/**
 * Separa los mensajes de `pedido-invalido` del campo (sin distinguir mayúsculas, la API manda
 * `Email` o `email`) de los generales, que van como aviso aparte (FR-027).
 */
export function repartirErrores(
  errors: Record<string, string[]>,
  campo: string,
): { campo: string[]; generales: string[] } {
  const delCampo: string[] = [];
  const generales: string[] = [];
  for (const [nombre, mensajes] of Object.entries(errors)) {
    (nombre.toLowerCase() === campo ? delCampo : generales).push(...mensajes);
  }
  if (delCampo.length === 0 && generales.length === 0) {
    generales.push("Revisá los datos y probá de nuevo.");
  }
  return { campo: delCampo, generales };
}

export type OperacionCarrito = "obtener" | "cambiar" | "email" | "abandonar";

/** Qué hace la interfaz con el error de una operación del carrito (research C10). */
export type TransicionError =
  /** La credencial ya no sirve: se descarta la sesión (FR-034). */
  | { tipo: "perdido" }
  /** El carrito dejó de estar activo: se cierra la sesión y queda en modo lectura (FR-035). */
  | { tipo: "cerrar"; estadoActual?: string; aviso: boolean }
  /** `pedido-invalido`: los mensajes van junto al campo o a la selección. */
  | { tipo: "invalido" }
  /** Códigos de butacas o de la función: los resuelve el selector, como en la creación. */
  | { tipo: "butacas" }
  /** Error genérico recuperable; sin conexión lleva la cinta de peligro (FR-040, FR-041). */
  | { tipo: "error"; sinConexion: boolean };

export function resolverProblemaCarrito(
  problema: Problema,
  operacion: OperacionCarrito,
): TransicionError {
  if (credencialPerdida(problema)) return { tipo: "perdido" };
  const { tipo } = problema;
  switch (tipo) {
    case "carrito-no-activo":
      // Al abandonar, que ya no esté activo es el resultado buscado: no es un error.
      return {
        tipo: "cerrar",
        estadoActual: problema.estadoActual,
        aviso: operacion !== "abandonar",
      };
    case "pedido-invalido":
      return operacion === "email" || operacion === "cambiar"
        ? { tipo: "invalido" }
        : { tipo: "error", sinConexion: false };
    case "asientos-no-disponibles":
    case "asientos-inexistentes":
    case "funcion-sin-cupo":
    case "funcion-no-disponible":
    case "funcion-no-encontrada":
      return operacion === "cambiar" ? { tipo: "butacas" } : { tipo: "error", sinConexion: false };
    case "red":
      return { tipo: "error", sinConexion: true };
    case "carrito-no-encontrado":
    case "demasiados-pedidos":
    case "desafio-rechazado":
    case "desconocido":
      return { tipo: "error", sinConexion: false };
    default: {
      const exhaustivo: never = tipo;
      return exhaustivo;
    }
  }
}
