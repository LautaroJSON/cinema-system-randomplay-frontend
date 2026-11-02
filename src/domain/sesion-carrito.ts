// Credencial privada (Principio III): solo sessionStorage, nunca en URL ni logs.
// Se usa solo desde componentes de cliente.
import type { Carrito } from "@/api/carritos";

export type SesionCarrito = {
  version: 2;
  carritoId: string;
  /** `null` cuando el carrito está cerrado: queda solo para el modo lectura. */
  token: string | null;
  tokenVenceEn: string | null;
  /** Último carrito recibido de la API. */
  carrito: Carrito;
  /** Hora del servidor menos hora del dispositivo, medida en la última respuesta. */
  desfaseMs: number;
};

const CLAVE = "randomplay:carrito";
const CLAVE_PRUEBA = "randomplay:prueba";
/** `storage` solo avisa a las otras pestañas: los cambios de esta se avisan con este evento. */
const EVENTO_CAMBIO = "randomplay:sesion";

const avisarCambio = () => window.dispatchEvent(new Event(EVENTO_CAMBIO));

/** Para `useSyncExternalStore`: avisa cuando cambia la sesión en esta pestaña o en otra. */
export function suscribirSesion(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_CAMBIO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_CAMBIO, avisar);
  };
}

export function almacenamientoDisponible(): boolean {
  try {
    sessionStorage.setItem(CLAVE_PRUEBA, "1");
    sessionStorage.removeItem(CLAVE_PRUEBA);
    return true;
  } catch {
    return false;
  }
}

/** Valor crudo de la clave, para comparar snapshots sin parsear (`useSyncExternalStore`). */
export function leerSesionCruda(): string | null {
  try {
    return sessionStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

const textoONulo = (valor: unknown) => typeof valor === "string" || valor === null;

export function parsearSesion(crudo: string | null): SesionCarrito | null {
  if (!crudo) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    if (
      typeof valor === "object" &&
      valor !== null &&
      "version" in valor &&
      valor.version === 2 &&
      "carritoId" in valor &&
      typeof valor.carritoId === "string" &&
      "token" in valor &&
      textoONulo(valor.token) &&
      "tokenVenceEn" in valor &&
      textoONulo(valor.tokenVenceEn) &&
      "desfaseMs" in valor &&
      typeof valor.desfaseMs === "number" &&
      "carrito" in valor &&
      typeof valor.carrito === "object" &&
      valor.carrito !== null
    ) {
      return valor as SesionCarrito;
    }
  } catch {
    // Un valor ilegible equivale a no tener sesión.
  }
  return null;
}

export function leerSesion(): SesionCarrito | null {
  return parsearSesion(leerSesionCruda());
}

/** Devuelve `false` si el navegador no permitió guardarla. */
export function guardarSesion(sesion: SesionCarrito): boolean {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    return false;
  }
  avisarCambio();
  return true;
}

/** Reemplaza el carrito guardado sin tocar la credencial. Solo si es el mismo carrito. */
export function actualizarCarrito(carrito: Carrito, desfaseMs: number): void {
  const sesion = leerSesion();
  if (sesion?.carritoId !== carrito.id) return;
  guardarSesion({ ...sesion, carrito, desfaseMs });
}

/** Borra la credencial y conserva el último carrito para el modo lectura (FR-005). */
export function cerrarSesion(carrito?: Carrito): void {
  const sesion = leerSesion();
  if (!sesion) return;
  guardarSesion({
    ...sesion,
    token: null,
    tokenVenceEn: null,
    carrito: carrito?.id === sesion.carritoId ? carrito : sesion.carrito,
  });
}

export function descartarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin acceso al almacenamiento no hay nada que descartar.
    return;
  }
  avisarCambio();
}
