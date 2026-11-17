import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { registrarPagoSimulado } from "@/api/pagos-simulados";
import { ID_CARRITO } from "../../fixtures";
import { server } from "../../msw/setup";

/** Captura el pedido al endpoint de desarrollo y responde con `respuesta`. */
function capturar(
  respuesta: () => Response = () => HttpResponse.json({ pagoId: "sim-1", estadoCarrito: "Pagado" }),
) {
  const captura: { pedido?: Request; cuerpo?: unknown } = {};
  server.use(
    http.post("*/api/dev/pagos-simulados", async ({ request }) => {
      captura.pedido = request;
      captura.cuerpo = await request.json();
      return respuesta();
    }),
  );
  return captura;
}

describe("registrarPagoSimulado", () => {
  it("envía el resultado elegido sin la credencial del carrito", async () => {
    const captura = capturar();
    const resultado = await registrarPagoSimulado({ carritoId: ID_CARRITO, estado: "Aprobado" });

    expect(new URL(captura.pedido?.url ?? "").pathname).toBe("/api/dev/pagos-simulados");
    expect(captura.pedido?.headers.get("Authorization")).toBeNull();
    expect(captura.cuerpo).toEqual({ carritoId: ID_CARRITO, estado: "Aprobado" });
    expect(resultado).toMatchObject({
      ok: true,
      datos: { pagoId: "sim-1", estadoCarrito: "Pagado" },
    });
  });

  it("envía el monto como número", async () => {
    const captura = capturar();
    await registrarPagoSimulado({ carritoId: ID_CARRITO, estado: "Aprobado", monto: 100.5 });
    expect(captura.cuerpo).toEqual({ carritoId: ID_CARRITO, estado: "Aprobado", monto: 100.5 });
  });

  it("un 404 vuelve como resultado no ok", async () => {
    capturar(() => new HttpResponse(null, { status: 404 }));
    const resultado = await registrarPagoSimulado({ carritoId: ID_CARRITO, estado: "Rechazado" });
    expect(resultado).toMatchObject({ ok: false, problema: { status: 404 } });
  });
});
