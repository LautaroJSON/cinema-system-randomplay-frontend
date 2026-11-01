// Credencial privada (Principio III): solo sessionStorage, nunca en URL ni logs.
// Se usa solo desde componentes de cliente.
import type { CarritoCreado } from "@/api/carritos";

export type SesionCarrito = {
  version: 1;
  carritoId: string;
  token: string;
  tokenVenceEn: string;
  carrito: CarritoCreado["carrito"];
};

const CLAVE = "randomplay:carrito";
const CLAVE_PRUEBA = "randomplay:prueba";

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

export function parsearSesion(crudo: string | null): SesionCarrito | null {
  if (!crudo) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    if (
      typeof valor === "object" &&
      valor !== null &&
      "version" in valor &&
      valor.version === 1 &&
      "carritoId" in valor &&
      typeof valor.carritoId === "string" &&
      "token" in valor &&
      typeof valor.token === "string" &&
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
    return true;
  } catch {
    return false;
  }
}

export function descartarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin acceso al almacenamiento no hay nada que descartar.
  }
}
