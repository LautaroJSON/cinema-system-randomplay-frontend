import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abandonarCarrito,
  crearCarrito,
  indicarEmail,
  mapearCarrito,
  obtenerCarrito,
  reemplazarAsientos,
} from "@/api/carritos";
import type { components } from "@/api/schema";
import {
  carritoCreado,
  carritosEstados,
  ID_CARRITO,
  ID_FUNCION_8X12,
  TOKEN_PRUEBA,
} from "../../fixtures";
import { server } from "../../msw/setup";

const F8 = { fila: "F", numero: 8 };
const F9 = { fila: "F", numero: 9 };
const F10 = { fila: "F", numero: 10 };

/** El `Carrito` que se espera de una respuesta `CarritoResponse`. */
function carritoEsperado(api: components["schemas"]["CarritoResponse"]) {
  const { funcion } = api;
  return {
    id: api.id,
    estado: api.estado,
    venceEn: api.venceEn,
    abandonadoEn: api.abandonadoEn,
    asientos: api.asientos.map(({ fila, numero }) => ({ fila, numero: Number(numero) })),
    funcion: {
      funcionId: funcion.funcionId,
      horaInicio: funcion.horaInicio,
      peliculaId: funcion.peliculaId,
      peliculaTitulo: funcion.peliculaTitulo,
      sucursalNombre: funcion.sucursalNombre,
      salaNombre: funcion.salaNombre,
    },
    precioUnitario: api.precioUnitario,
    total: api.total,
    emailEntrega: api.emailEntrega,
  };
}

describe("mapearCarrito", () => {
  it("mapea todos los campos que usa la pantalla y normaliza el número de butaca", () => {
    const api: components["schemas"]["CarritoResponse"] = {
      ...carritosEstados.conEmail,
      asientos: [{ fila: "F", numero: "8" }],
    };
    expect(mapearCarrito(api)).toEqual({ ...carritoEsperado(api), asientos: [F8] });
  });
});

describe("crearCarrito", () => {
  it("envía la selección sin desafío ni token y mapea el 201", async () => {
    let pedido: Request | undefined;
    let cuerpo: unknown;
    server.use(
      http.post("*/api/funciones/:funcionId/carritos", async ({ request }) => {
        pedido = request;
        cuerpo = await request.json();
        return HttpResponse.json(carritoCreado, { status: 201 });
      }),
    );
    const resultado = await crearCarrito(ID_FUNCION_8X12, [F8, F9]);

    expect(new URL(pedido?.url ?? "").pathname).toBe(`/api/funciones/${ID_FUNCION_8X12}/carritos`);
    expect(pedido?.headers.get("Authorization")).toBeNull();
    expect(cuerpo).toEqual({ asientos: [F8, F9], desafio: null });
    expect(resultado).toMatchObject({
      ok: true,
      datos: {
        token: carritoCreado.token,
        tokenVenceEn: carritoCreado.tokenVenceEn,
        carrito: carritoEsperado(carritoCreado.carrito),
      },
    });
  });
});

describe("operaciones con token", () => {
  afterEach(() => vi.restoreAllMocks());

  it("obtenerCarrito pide el carrito con Bearer y trae la hora del servidor", async () => {
    let pedido: Request | undefined;
    server.events.on("request:start", ({ request }) => {
      pedido = request;
    });
    const resultado = await obtenerCarrito(ID_CARRITO, TOKEN_PRUEBA);
    server.events.removeAllListeners();

    expect(new URL(pedido?.url ?? "").pathname).toBe(`/api/carritos/${ID_CARRITO}`);
    expect(pedido?.headers.get("Authorization")).toBe(`Bearer ${TOKEN_PRUEBA}`);
    expect(resultado).toMatchObject({ ok: true, datos: carritoEsperado(carritosEstados.activo) });
    expect(resultado.horaServidorMs).toEqual(expect.any(Number));
  });

  it("reemplazarAsientos envía la selección completa, nunca diferencias", async () => {
    let cuerpo: unknown;
    let ruta = "";
    server.events.on("request:start", async ({ request }) => {
      ruta = new URL(request.url).pathname;
      cuerpo = await request.clone().json();
    });
    const resultado = await reemplazarAsientos(ID_CARRITO, TOKEN_PRUEBA, [F8, F10]);
    server.events.removeAllListeners();

    expect(ruta).toBe(`/api/carritos/${ID_CARRITO}/asientos`);
    expect(cuerpo).toEqual({ asientos: [F8, F10] });
    expect(resultado).toMatchObject({ ok: true, datos: { asientos: [F8, F10] } });
  });

  it("indicarEmail envía el email", async () => {
    let cuerpo: unknown;
    server.events.on("request:start", async ({ request }) => {
      cuerpo = await request.clone().json();
    });
    const resultado = await indicarEmail(ID_CARRITO, TOKEN_PRUEBA, "comprador@ejemplo.com");
    server.events.removeAllListeners();

    expect(cuerpo).toEqual({ email: "comprador@ejemplo.com" });
    expect(resultado).toMatchObject({ ok: true, datos: { emailEntrega: "comprador@ejemplo.com" } });
  });

  it("abandonarCarrito devuelve el carrito abandonado; el timeout corto es opcional", async () => {
    const espia = vi.spyOn(AbortSignal, "timeout");
    const resultado = await abandonarCarrito(ID_CARRITO, TOKEN_PRUEBA);
    expect(resultado).toMatchObject({ ok: true, datos: { estado: "Abandonado" } });
    expect(espia).toHaveBeenLastCalledWith(8000);

    await abandonarCarrito(ID_CARRITO, TOKEN_PRUEBA, 3000);
    expect(espia).toHaveBeenLastCalledWith(3000);
  });

  it("escapa el id en la ruta y no expone el token en el problema", async () => {
    let ruta = "";
    server.use(
      http.get("*/api/carritos/*", ({ request }) => {
        ruta = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const resultado = await obtenerCarrito("a/b", TOKEN_PRUEBA);
    expect(ruta).toBe("/api/carritos/a%2Fb");
    expect(resultado).toMatchObject({ ok: false, problema: { status: 401 } });
    expect(JSON.stringify(resultado)).not.toContain(TOKEN_PRUEBA);
  });
});
