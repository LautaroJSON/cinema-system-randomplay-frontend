import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagoSimulado } from "@/components/PagoSimulado/PagoSimulado";
import { carritosEstados, guardarSesionDePrueba, ID_CARRITO } from "../fixtures";
import { server } from "../msw/setup";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const VUELTA = `/carritos/${ID_CARRITO}/pago`;

/** Captura los cuerpos enviados a la pasarela simulada y si llevaban credencial. */
function capturar(
  respuesta: () => Response | Promise<Response> = () =>
    HttpResponse.json({ pagoId: "sim-1", estadoCarrito: "Pagado" }),
) {
  const pedidos: { cuerpo: unknown; conCredencial: boolean }[] = [];
  server.use(
    http.post("*/api/dev/pagos-simulados", async ({ request }) => {
      pedidos.push({
        cuerpo: await request.json(),
        conCredencial: request.headers.has("Authorization"),
      });
      return respuesta();
    }),
  );
  return pedidos;
}

function abrir() {
  guardarSesionDePrueba(carritosEstados.pagando);
  render(<PagoSimulado carritoId={ID_CARRITO} />);
  return userEvent.setup();
}

const campo = () => screen.getByRole("textbox", { name: "Monto a pagar" });

beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("PagoSimulado (US2)", () => {
  it("dice que es una simulación y muestra el total precargado", () => {
    abrir();
    expect(screen.getByText("Simulación de desarrollo")).toBeInTheDocument();
    expect(screen.getByText(/No se cobra nada\./)).toBeInTheDocument();
    expect(screen.getByText(/9\.000,00/)).toBeInTheDocument();
    expect(campo()).toHaveValue("9000.00");
  });

  it.each([
    ["Aprobar pago", { carritoId: ID_CARRITO, estado: "Aprobado" }],
    ["Rechazar pago", { carritoId: ID_CARRITO, estado: "Rechazado" }],
  ])("%s envía su resultado sin credencial y vuelve", async (boton, cuerpo) => {
    const pedidos = capturar();
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: boton }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(VUELTA));
    expect(pedidos).toEqual([{ cuerpo, conCredencial: false }]);
  });

  it("Pagar otro monto envía el monto como número", async () => {
    const pedidos = capturar();
    const usuario = abrir();
    await usuario.clear(campo());
    await usuario.type(campo(), "100.50");
    await usuario.click(screen.getByRole("button", { name: "Pagar otro monto" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(VUELTA));
    expect(pedidos[0]?.cuerpo).toEqual({ carritoId: ID_CARRITO, estado: "Aprobado", monto: 100.5 });
  });

  it("con un monto inválido avisa junto al campo y no envía", async () => {
    const pedidos = capturar();
    const usuario = abrir();
    await usuario.clear(campo());
    await usuario.type(campo(), "0");
    await usuario.click(screen.getByRole("button", { name: "Pagar otro monto" }));

    expect(campo()).toHaveAccessibleDescription(
      "Escribí un monto mayor que cero, con hasta dos decimales.",
    );
    expect(campo()).toHaveFocus();
    expect(pedidos).toEqual([]);
  });

  it("mientras registra deshabilita las tres opciones", async () => {
    let soltar = () => {};
    const espera = new Promise<void>((resolver) => (soltar = resolver));
    capturar(async () => {
      await espera;
      return HttpResponse.json({ pagoId: "sim-1", estadoCarrito: "Pagado" });
    });
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Aprobar pago" }));

    expect(screen.getByRole("button", { name: "Registrando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar pago" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pagar otro monto" })).toBeDisabled();
    soltar();
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("si falla avisa y Reintentar repite el mismo pedido", async () => {
    let falla = true;
    const pedidos = capturar(() =>
      falla
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json({ pagoId: "sim-2", estadoCarrito: "Pagando" }),
    );
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Rechazar pago" }));

    expect(await screen.findByText("No pudimos registrar el pago simulado.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    falla = false;
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(VUELTA));
    expect(pedidos.map((p) => p.cuerpo)).toEqual([
      { carritoId: ID_CARRITO, estado: "Rechazado" },
      { carritoId: ID_CARRITO, estado: "Rechazado" },
    ]);
  });
});
