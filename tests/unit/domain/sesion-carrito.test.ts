import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapearCarrito } from "@/api/carritos";
import {
  actualizarCarrito,
  almacenamientoDisponible,
  cerrarSesion,
  descartarSesion,
  guardarSesion,
  leerSesion,
} from "@/domain/sesion-carrito";
import { carritosEstados, sesionDePrueba } from "../../fixtures";

const CLAVE = "randomplay:carrito";

describe("sesión del carrito", () => {
  const espias: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    sessionStorage.clear();
    for (const metodo of ["log", "info", "warn", "error", "debug"] as const) {
      espias.push(vi.spyOn(console, metodo));
    }
  });

  afterEach(() => {
    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
    espias.length = 0;
    vi.restoreAllMocks();
  });

  it("guarda y lee la sesión v2", () => {
    const sesion = sesionDePrueba();
    guardarSesion(sesion);
    expect(leerSesion()).toEqual(sesion);
  });

  it("lee una sesión cerrada, sin token", () => {
    const sesion = sesionDePrueba(carritosEstados.abandonado, { token: null, tokenVenceEn: null });
    guardarSesion(sesion);
    expect(leerSesion()).toEqual(sesion);
  });

  it("devuelve null ante datos rotos, de la versión 1 o con forma inválida", () => {
    const sesion = sesionDePrueba();
    sessionStorage.setItem(CLAVE, "{roto");
    expect(leerSesion()).toBeNull();
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...sesion, version: 1 }));
    expect(leerSesion()).toBeNull();
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...sesion, token: 42 }));
    expect(leerSesion()).toBeNull();
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...sesion, desfaseMs: "0" }));
    expect(leerSesion()).toBeNull();
  });

  it("actualizarCarrito reemplaza el carrito y el desfase sin tocar el token", () => {
    const sesion = sesionDePrueba();
    guardarSesion(sesion);
    const conEmail = mapearCarrito(carritosEstados.conEmail);
    actualizarCarrito(conEmail, 1500);
    expect(leerSesion()).toEqual({ ...sesion, carrito: conEmail, desfaseMs: 1500 });
  });

  it("actualizarCarrito no hace nada sin sesión o con otro carrito", () => {
    actualizarCarrito(mapearCarrito(carritosEstados.activo), 0);
    expect(leerSesion()).toBeNull();

    const sesion = sesionDePrueba();
    guardarSesion(sesion);
    actualizarCarrito({ ...mapearCarrito(carritosEstados.conEmail), id: "otro" }, 0);
    expect(leerSesion()).toEqual(sesion);
  });

  it("cerrarSesion borra la credencial y conserva el último carrito", () => {
    const sesion = sesionDePrueba();
    guardarSesion(sesion);
    cerrarSesion();
    expect(leerSesion()).toEqual({ ...sesion, token: null, tokenVenceEn: null });

    const abandonado = mapearCarrito(carritosEstados.abandonado);
    cerrarSesion(abandonado);
    expect(leerSesion()).toMatchObject({ token: null, carrito: abandonado });
  });

  it("descarta la sesión", () => {
    guardarSesion(sesionDePrueba());
    descartarSesion();
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
    expect(leerSesion()).toBeNull();
  });

  it("detecta un almacenamiento bloqueado sin lanzar", () => {
    const sesion = sesionDePrueba();
    expect(almacenamientoDisponible()).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(almacenamientoDisponible()).toBe(false);
    expect(leerSesion()).toBeNull();
    expect(guardarSesion(sesion)).toBe(false);
    expect(() => actualizarCarrito(sesion.carrito, 0)).not.toThrow();
    expect(() => cerrarSesion()).not.toThrow();
    expect(() => descartarSesion()).not.toThrow();
  });
});
