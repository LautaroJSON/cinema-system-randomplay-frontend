import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { abandonarCarrito, crearCarrito } from "@/api/carritos";
import { carritoCreado, ID_FUNCION_8X12 } from "../../fixtures";
import { server } from "../../msw/setup";

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
    const asientos = [
      { fila: "F", numero: 8 },
      { fila: "F", numero: 9 },
    ];
    const resultado = await crearCarrito(ID_FUNCION_8X12, asientos);

    expect(new URL(pedido?.url ?? "").pathname).toBe(`/api/funciones/${ID_FUNCION_8X12}/carritos`);
    expect(pedido?.headers.get("Authorization")).toBeNull();
    expect(cuerpo).toEqual({ asientos, desafio: null });
    expect(resultado).toEqual({
      ok: true,
      datos: {
        token: carritoCreado.token,
        tokenVenceEn: carritoCreado.tokenVenceEn,
        carrito: {
          id: carritoCreado.carrito.id,
          estado: "Activo",
          venceEn: carritoCreado.carrito.venceEn,
          asientos,
          funcion: {
            funcionId: carritoCreado.carrito.funcion.funcionId,
            horaInicio: carritoCreado.carrito.funcion.horaInicio,
            peliculaId: carritoCreado.carrito.funcion.peliculaId,
            peliculaTitulo: carritoCreado.carrito.funcion.peliculaTitulo,
            sucursalNombre: carritoCreado.carrito.funcion.sucursalNombre,
            salaNombre: carritoCreado.carrito.funcion.salaNombre,
          },
          total: carritoCreado.carrito.total,
        },
      },
    });
  });
});

describe("abandonarCarrito", () => {
  afterEach(() => vi.restoreAllMocks());

  it("envía el token como Bearer al abandono de ese carrito, con timeout corto", async () => {
    let pedido: Request | undefined;
    server.use(
      http.post("*/api/carritos/:carritoId/abandono", ({ request }) => {
        pedido = request;
        return HttpResponse.json(carritoCreado.carrito);
      }),
    );
    const espia = vi.spyOn(AbortSignal, "timeout");
    const resultado = await abandonarCarrito("c1", "token-de-prueba-no-real");

    expect(resultado.ok).toBe(true);
    expect(new URL(pedido?.url ?? "").pathname).toBe("/api/carritos/c1/abandono");
    expect(pedido?.headers.get("Authorization")).toBe("Bearer token-de-prueba-no-real");
    expect(espia).toHaveBeenCalledWith(3000);
  });
});
