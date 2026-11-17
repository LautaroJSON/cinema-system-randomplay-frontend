import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/api/schema";
import { VueltaPago } from "@/components/VueltaPago/VueltaPago";
import { leerSesion } from "@/domain/sesion-carrito";
import {
  carritosEstados,
  conVencimiento,
  guardarSesionDePrueba,
  ID_CARRITO,
  URL_PAGO_SIMULADA,
} from "../fixtures";
import { server } from "../msw/setup";

type CarritoApi = components["schemas"]["CarritoResponse"];

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const AHORA = new Date("2026-11-01T17:00:00-03:00");
const MIN = 60_000;

/** Responde el GET del carrito con la lista en orden; la última se repite. */
function responderEnOrden(...respuestas: (CarritoApi | "error")[]) {
  const pedidos = { n: 0 };
  server.use(
    http.get("*/api/carritos/:carritoId", () => {
      const respuesta = respuestas[Math.min(pedidos.n, respuestas.length - 1)];
      pedidos.n++;
      return respuesta === "error" ? HttpResponse.error() : HttpResponse.json(respuesta);
    }),
  );
  return pedidos;
}

const avanzar = async (ms: number) => {
  for (let paso = 0; paso < ms; paso += 1000) {
    await act(() => vi.advanceTimersByTimeAsync(Math.min(1000, ms - paso)));
  }
};

const pagando = (vence = 10 * MIN) => conVencimiento(carritosEstados.pagando, vence, AHORA);
const titulo = () => screen.getByRole("heading", { level: 1 });
const anuncio = () => screen.getByRole("status");

function abrir(sesion: CarritoApi = pagando(), cambios = {}) {
  guardarSesionDePrueba(sesion, cambios);
  render(<VueltaPago carritoId={ID_CARRITO} pagoSimulado />);
}

beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(AHORA);
});
afterEach(() => {
  server.events.removeAllListeners();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("VueltaPago: confirmación (US1)", () => {
  it("espera mientras está en pago y muestra las entradas al confirmarse", async () => {
    const pedidos = responderEnOrden(pagando(), carritosEstados.pagado);
    abrir();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Estamos confirmando tu pago…" }),
    ).toBeInTheDocument();
    expect(anuncio()).toHaveTextContent("Estamos confirmando tu pago.");
    await waitFor(() => expect(pedidos.n).toBe(1));

    await avanzar(2000);
    expect(await screen.findByRole("heading", { level: 1, name: "¡Listo!" })).toHaveFocus();
    expect(anuncio()).toHaveTextContent("Pago confirmado. Ya tenés tus entradas.");
    const entradas = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(entradas).toHaveLength(2);
    expect(entradas[0]).toHaveTextContent("K7M2Q-X9PDA");
    expect(entradas[0]).toHaveTextContent("La noche del videoclub");
    expect(entradas[0]).toHaveTextContent("Sucursal Centro");
    expect(entradas[0]).toHaveTextContent("Sala 1");
    expect(entradas[0]).toHaveTextContent(/Fila\s*F/);
    expect(entradas[0]).toHaveTextContent(/Butaca\s*8/);
    expect(entradas[0]).toHaveTextContent(/4\.500,00/);
    expect(screen.getByText(/También te mandamos las entradas a/)).toHaveTextContent(
      "comprador@ejemplo.com",
    );
    expect(leerSesion()).toMatchObject({ token: null, carrito: { estado: "Pagado" } });

    await avanzar(10_000);
    expect(pedidos.n).toBe(2);
  });

  it("si vence sin pago, explica la devolución y ofrece otra función", async () => {
    responderEnOrden({ ...pagando(), estado: "Expirado" });
    abrir();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Se terminó el tiempo para pagar" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Si se cobró algo, se devuelve automáticamente\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir otra función" })).toBeInTheDocument();
    expect(anuncio()).toHaveTextContent("Se terminó el tiempo para pagar.");
  });

  it("un error de red no corta la espera", async () => {
    const pedidos = responderEnOrden("error", carritosEstados.pagado);
    abrir();
    await waitFor(() => expect(pedidos.n).toBe(1));
    await avanzar(2000);
    expect(await screen.findByRole("heading", { level: 1, name: "¡Listo!" })).toBeInTheDocument();
  });

  it("un 401 descarta la credencial", async () => {
    server.use(
      http.get("*/api/carritos/:carritoId", () => new HttpResponse(null, { status: 401 })),
    );
    abrir();
    expect(
      await screen.findByRole("heading", { level: 1, name: "No pudimos recuperar tu carrito" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("randomplay:carrito")).toBeNull();
  });

  it("sin sesión en la pestaña no consulta y avisa que las entradas llegan por email", async () => {
    const pedidos = responderEnOrden(pagando());
    render(<VueltaPago carritoId={ID_CARRITO} pagoSimulado />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No encontramos tu pago en esta pestaña",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/las entradas te llegan al email que indicaste/)).toBeInTheDocument();
    await avanzar(5000);
    expect(pedidos.n).toBe(0);
  });
});

describe("VueltaPago: volver a pagar y tope (US4)", () => {
  it("ofrece volver a la página de pago desde el principio", async () => {
    responderEnOrden(pagando());
    server.use(
      http.post("*/api/carritos/:carritoId/pago", () =>
        HttpResponse.json({ urlPago: URL_PAGO_SIMULADA, carrito: pagando() }),
      ),
    );
    abrir();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await usuario.click(await screen.findByRole("button", { name: "Volver a la página de pago" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/carritos/${ID_CARRITO}/pago-simulado`));
  });

  it("a los 2 minutos deja de consultar; Revisar de nuevo consulta y reinicia el tope", async () => {
    const pedidos = responderEnOrden(pagando());
    abrir();
    await screen.findByRole("heading", { level: 1, name: "Estamos confirmando tu pago…" });

    await avanzar(125_000);
    expect(titulo()).toHaveTextContent("Todavía no se confirmó tu pago");
    expect(anuncio()).toHaveTextContent("Todavía no se confirmó tu pago.");
    const hechos = pedidos.n;
    expect(hechos).toBeGreaterThan(50);
    await avanzar(10_000);
    expect(pedidos.n).toBe(hechos);

    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(screen.getByRole("button", { name: "Revisar de nuevo" }));
    await waitFor(() => expect(pedidos.n).toBe(hechos + 1));
    expect(titulo()).toHaveTextContent("Estamos confirmando tu pago…");
    await avanzar(4000);
    expect(pedidos.n).toBe(hechos + 3);
  });

  it("con la pestaña oculta no consulta; al volver, consulta enseguida", async () => {
    const pedidos = responderEnOrden(pagando());
    abrir();
    await waitFor(() => expect(pedidos.n).toBe(1));

    const oculta = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await avanzar(10_000);
    expect(pedidos.n).toBe(1);

    oculta.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(pedidos.n).toBe(2));
  });
});

describe("VueltaPago: compra cerrada (US6)", () => {
  it("con el carrito ya pagado muestra las entradas sin consultar", async () => {
    const pedidos = responderEnOrden(pagando());
    abrir(conVencimiento(carritosEstados.pagado, -60 * MIN, AHORA), {
      token: null,
      tokenVenceEn: null,
    });
    expect(await screen.findByRole("heading", { level: 1, name: "¡Listo!" })).toBeInTheDocument();
    expect(screen.getByText("B4N8R-T2LWE")).toBeInTheDocument();
    await avanzar(5000);
    expect(pedidos.n).toBe(0);
  });
});
