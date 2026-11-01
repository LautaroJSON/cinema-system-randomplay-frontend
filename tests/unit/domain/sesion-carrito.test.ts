import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  almacenamientoDisponible,
  descartarSesion,
  guardarSesion,
  leerSesion,
  type SesionCarrito,
} from "@/domain/sesion-carrito";

const CLAVE = "randomplay:carrito";

const sesion: SesionCarrito = {
  version: 1,
  carritoId: "c1",
  token: "token-de-prueba-no-real",
  tokenVenceEn: "2026-11-01T18:00:00-03:00",
  carrito: {
    id: "c1",
    estado: "Activo",
    venceEn: "2026-11-01T17:05:00-03:00",
    asientos: [{ fila: "F", numero: 8 }],
    funcion: {
      funcionId: "f1",
      horaInicio: "2026-11-01T18:00:00-03:00",
      peliculaId: "p1",
      peliculaTitulo: "La noche del videoclub",
      sucursalNombre: "Sucursal Centro",
      salaNombre: "Sala 1",
    },
    total: { monto: "4500.00", moneda: "ARS" },
  },
};

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

  it("guarda y lee la sesión", () => {
    guardarSesion(sesion);
    expect(leerSesion()).toEqual(sesion);
  });

  it("devuelve null ante datos rotos o de otra versión", () => {
    sessionStorage.setItem(CLAVE, "{roto");
    expect(leerSesion()).toBeNull();
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...sesion, version: 2 }));
    expect(leerSesion()).toBeNull();
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...sesion, token: undefined }));
    expect(leerSesion()).toBeNull();
  });

  it("descarta la sesión", () => {
    guardarSesion(sesion);
    descartarSesion();
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
    expect(leerSesion()).toBeNull();
  });

  it("detecta un almacenamiento bloqueado sin lanzar", () => {
    expect(almacenamientoDisponible()).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(almacenamientoDisponible()).toBe(false);
    expect(leerSesion()).toBeNull();
    expect(() => guardarSesion(sesion)).not.toThrow();
    expect(() => descartarSesion()).not.toThrow();
  });
});
