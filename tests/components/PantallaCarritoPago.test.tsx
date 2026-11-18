import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/api/schema";
import { PantallaCarrito } from "@/components/PantallaCarrito/PantallaCarrito";
import { leerSesion } from "@/domain/sesion-carrito";
import {
  carritosEstados,
  conVencimiento,
  guardarSesionDePrueba,
  ID_CARRITO,
  TOKEN_PRUEBA,
  URL_PAGO_REAL,
  URL_PAGO_SIMULADA,
} from "../fixtures";
import { respuestaProblema } from "../msw/handlers";
import { server } from "../msw/setup";

type CarritoApi = components["schemas"]["CarritoResponse"];

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const irAUrlExterna = vi.fn();
vi.mock("@/components/PantallaCarrito/navegacion", () => ({
  irAUrlExterna: (url: string) => irAUrlExterna(url),
}));

const MIN = 60_000;
const RUTA_SIMULADA = `/carritos/${ID_CARRITO}/pago-simulado`;

function responderCarrito(carrito: CarritoApi) {
  server.use(http.get("*/api/carritos/:carritoId", () => HttpResponse.json(carrito)));
}

function responderPago(respuesta: () => Response | Promise<Response>) {
  server.use(http.post("*/api/carritos/:carritoId/pago", respuesta));
}

/** Cuenta los pedidos que salen durante el test, por método y final de la ruta. */
function contarPedidos() {
  const pedidos: string[] = [];
  server.events.on("request:start", ({ request }) => {
    pedidos.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return pedidos;
}

async function abrir(
  carrito: CarritoApi = carritosEstados.conEmail,
  { pagoSimulado = true, vence = 4 * MIN }: { pagoSimulado?: boolean; vence?: number } = {},
) {
  const vigente = conVencimiento(carrito, vence);
  guardarSesionDePrueba(vigente);
  responderCarrito(vigente);
  render(<PantallaCarrito carritoId={ID_CARRITO} pagoSimulado={pagoSimulado} />);
  await screen.findByRole("heading", { level: 1, name: "Tu carrito" });
  return userEvent.setup();
}

const botonPagar = () => screen.getByRole("button", { name: /^Pagar \$/ });

beforeEach(() => {
  sessionStorage.clear();
  push.mockClear();
  irAUrlExterna.mockClear();
});
afterEach(() => {
  server.events.removeAllListeners();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PantallaCarrito: pagar (US1)", () => {
  it("inicia el pago una sola vez, guarda el carrito en pago y va a la página simulada", async () => {
    let soltar = () => {};
    const espera = new Promise<void>((resolver) => (soltar = resolver));
    const pagando = conVencimiento(carritosEstados.pagando, 5 * MIN);
    responderPago(async () => {
      await espera;
      return HttpResponse.json({ urlPago: URL_PAGO_SIMULADA, carrito: pagando });
    });
    const usuario = await abrir();
    const pedidos = contarPedidos();

    expect(botonPagar()).toHaveTextContent(/9\.000,00/);
    await usuario.click(botonPagar());
    expect(screen.getByRole("button", { name: "Iniciando el pago…" })).toBeDisabled();
    await usuario.click(screen.getByRole("button", { name: "Iniciando el pago…" }));
    soltar();

    await waitFor(() => expect(push).toHaveBeenCalledWith(RUTA_SIMULADA));
    expect(pedidos.filter((p) => p.startsWith("POST"))).toEqual([
      `POST /api/carritos/${ID_CARRITO}/pago`,
    ]);
    expect(leerSesion()).toMatchObject({
      token: TOKEN_PRUEBA,
      carrito: { estado: "Pagando", venceEn: pagando.venceEn },
    });
    expect(irAUrlExterna).not.toHaveBeenCalled();
  });

  it("con la pasarela real sale a la dirección https en la misma pestaña", async () => {
    responderPago(() =>
      HttpResponse.json({
        urlPago: URL_PAGO_REAL,
        carrito: conVencimiento(carritosEstados.pagando, 5 * MIN),
      }),
    );
    const usuario = await abrir(carritosEstados.conEmail, { pagoSimulado: false });
    await usuario.click(botonPagar());

    await waitFor(() => expect(irAUrlExterna).toHaveBeenCalledWith(URL_PAGO_REAL));
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["una dirección http", "http://sandbox.mercadopago.com.ar/checkout", true],
    ["la ruta simulada sin habilitar", URL_PAGO_SIMULADA, false],
  ])("con %s no navega y avisa", async (_, urlPago, pagoSimulado) => {
    responderPago(() =>
      HttpResponse.json({
        urlPago,
        carrito: conVencimiento(carritosEstados.pagando, 5 * MIN),
      }),
    );
    const usuario = await abrir(carritosEstados.conEmail, { pagoSimulado });
    await usuario.click(botonPagar());

    expect(
      await screen.findByText("No pudimos abrir la página de pago. Probá de nuevo."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(irAUrlExterna).not.toHaveBeenCalled();
  });

  it("sin email no hay sección de pago; aparece al guardarlo", async () => {
    const usuario = await abrir(carritosEstados.activo);
    expect(screen.queryByRole("region", { name: "Pago" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pagar/ })).not.toBeInTheDocument();

    server.use(
      http.put("*/api/carritos/:carritoId/email-entrega", () =>
        HttpResponse.json(conVencimiento(carritosEstados.conEmail, 4 * MIN)),
      ),
    );
    await usuario.type(
      screen.getByRole("textbox", { name: "Email para recibir las entradas" }),
      "comprador@ejemplo.com",
    );
    await usuario.click(screen.getByRole("button", { name: "Guardar email" }));

    expect(await screen.findByRole("region", { name: "Pago" })).toBeInTheDocument();
    // El formulario avisa que se cerró en un efecto: Pagar pasa a principal un render después.
    await waitFor(() => expect(botonPagar()).toHaveClass("boton-primario"));
  });

  it("mientras se cambia el email, Pagar no compite con Guardar email", async () => {
    const usuario = await abrir();
    expect(botonPagar()).toHaveClass("boton-primario");
    await usuario.click(screen.getByRole("button", { name: "Me equivoqué, cambiar email" }));
    expect(botonPagar()).toHaveClass("boton-secundario");
    expect(screen.getByRole("button", { name: "Guardar email" })).toHaveClass("boton-primario");
  });
});

describe("PantallaCarrito: pago en curso (US3)", () => {
  it("bloquea butacas, email y abandono, y ofrece volver a la página de pago", async () => {
    const usuario = await abrir(carritosEstados.pagando);

    expect(screen.getByText("Pago en curso")).toBeInTheDocument();
    expect(screen.getByText(/Mientras pagás no se pueden cambiar las butacas/)).toBeInTheDocument();
    const cambiar = screen.getByRole("button", { name: "Cambiar butacas" });
    const abandonar = screen.getByRole("button", { name: "Abandonar carrito" });
    for (const boton of [cambiar, abandonar]) {
      expect(boton).toHaveAttribute("aria-disabled", "true");
      expect(boton).toHaveAccessibleDescription(/Pago en curso/);
    }
    await usuario.click(abandonar);
    expect(screen.queryByRole("button", { name: "Sí, abandonar" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Me equivoqué, cambiar email" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("comprador@ejemplo.com")).toBeInTheDocument();

    responderPago(() =>
      HttpResponse.json({ urlPago: URL_PAGO_SIMULADA, carrito: carritosEstados.pagando }),
    );
    await usuario.click(screen.getByRole("button", { name: "Volver a la página de pago" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(RUTA_SIMULADA));
  });

  it.each([
    ["guardar el email", "put", "email-entrega"],
    ["abandonar", "post", "abandono"],
  ] as const)(
    "carrito-en-pago al %s pasa a pago en curso sin perder la credencial",
    async (accion, metodo, ruta) => {
      const usuario = await abrir(carritosEstados.conEmail);
      server.use(
        http[metodo](`*/api/carritos/:carritoId/${ruta}`, () =>
          respuestaProblema(409, "carrito-en-pago"),
        ),
      );
      responderCarrito(conVencimiento(carritosEstados.pagando, 4 * MIN));

      if (accion === "guardar el email") {
        await usuario.click(screen.getByRole("button", { name: "Me equivoqué, cambiar email" }));
        await usuario.click(screen.getByRole("button", { name: "Guardar email" }));
      } else {
        await usuario.click(screen.getByRole("button", { name: "Abandonar carrito" }));
        await usuario.click(screen.getByRole("button", { name: "Sí, abandonar" }));
      }

      expect(await screen.findByRole("alert")).toHaveTextContent(/Pago en curso/);
      expect(
        screen.getByRole("button", { name: "Volver a la página de pago" }),
      ).toBeInTheDocument();
      expect(leerSesion()).toMatchObject({ token: TOKEN_PRUEBA, carrito: { estado: "Pagando" } });
    },
  );
});

describe("PantallaCarrito: contador en pago (US4)", () => {
  it("al llegar a cero va a la página de vuelta y no lo declara vencido", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "Date"] });
    await abrir(carritosEstados.pagando, { vence: 3000 });

    for (let paso = 0; paso < 4; paso++) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }

    expect(push).toHaveBeenCalledWith(`/carritos/${ID_CARRITO}/pago`);
    expect(leerSesion()?.token).toBe(TOKEN_PRUEBA);
    expect(screen.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Se terminó el tiempo" })).not.toBeInTheDocument();
  });
});

describe("PantallaCarrito: errores al iniciar el pago (US5)", () => {
  async function pagarCon(respuesta: () => Response, despues?: CarritoApi | "error") {
    const usuario = await abrir();
    responderPago(respuesta);
    if (despues === "error") {
      server.use(http.get("*/api/carritos/:carritoId", () => HttpResponse.error()));
    } else if (despues) responderCarrito(despues);
    await usuario.click(botonPagar());
    return usuario;
  }

  afterEach(() => {
    expect(push).not.toHaveBeenCalled();
    expect(irAUrlExterna).not.toHaveBeenCalled();
  });

  it("email-entrega-faltante pide el email y abre el campo", async () => {
    await pagarCon(() => respuestaProblema(409, "email-entrega-faltante"));
    expect(
      await screen.findByText("Primero guardá el email para recibir las entradas."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Email para recibir las entradas" }),
      ).toHaveFocus(),
    );
  });

  it("carrito-no-activo Expirado relee el carrito y lo muestra vencido", async () => {
    await pagarCon(
      () => respuestaProblema(409, "carrito-no-activo", { estadoActual: "Expirado" }),
      carritosEstados.expirado,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Se terminó el tiempo" }),
    ).toBeInTheDocument();
    expect(leerSesion()?.token).toBeNull();
  });

  it("carrito-no-activo Pagado trae la compra cerrada con sus entradas", async () => {
    await pagarCon(
      () => respuestaProblema(409, "carrito-no-activo", { estadoActual: "Pagado" }),
      carritosEstados.pagado,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Tu compra" })).toBeInTheDocument();
    expect(screen.getByText("K7M2Q-X9PDA")).toBeInTheDocument();
  });

  it("carrito-no-activo sin poder releer cierra con el estado que dijo la API", async () => {
    await pagarCon(
      () => respuestaProblema(409, "carrito-no-activo", { estadoActual: "Abandonado" }),
      "error",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Abandonaste el carrito" }),
    ).toBeInTheDocument();
  });

  it("carrito-modificado relee y pide tocar Pagar de nuevo", async () => {
    const pedidos = contarPedidos();
    await pagarCon(() => respuestaProblema(409, "carrito-modificado"));
    expect(
      await screen.findByText("Tu reserva cambió mientras iniciábamos el pago."),
    ).toBeInTheDocument();
    await waitFor(() => expect(pedidos).toContain(`GET /api/carritos/${ID_CARRITO}`));
  });

  it("pago-no-disponible lo dice y Reintentar vuelve a pedir el pago", async () => {
    const pedidos = contarPedidos();
    const usuario = await pagarCon(() => respuestaProblema(503, "pago-no-disponible"));
    expect(
      await screen.findByText("No pudimos iniciar el pago, probá de nuevo."),
    ).toBeInTheDocument();
    expect(leerSesion()?.carrito.estado).toBe("Activo");

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(pedidos.filter((p) => p.endsWith("/pago"))).toHaveLength(2));
  });

  it.each([
    ["un 401", () => new HttpResponse(null, { status: 401 })],
    ["carrito-no-encontrado", () => respuestaProblema(404, "carrito-no-encontrado")],
  ])("%s descarta la credencial", async (_, respuesta) => {
    await pagarCon(respuesta);
    expect(
      await screen.findByRole("heading", { level: 1, name: "No pudimos recuperar tu carrito" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("randomplay:carrito")).toBeNull();
  });

  it("sin conexión avisa con la cinta y deja reintentar", async () => {
    await pagarCon(() => HttpResponse.error());
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos iniciar el pago.");
    expect(aviso).toHaveTextContent("Parece que no hay conexión");
    expect(aviso.querySelector(".cinta-peligro")).not.toBeNull();
  });
});

describe("PantallaCarrito: compra cerrada (US6)", () => {
  it("muestra la compra con sus entradas aunque haya vencido, sin pedir nada", async () => {
    const pedidos = contarPedidos();
    guardarSesionDePrueba(conVencimiento(carritosEstados.pagado, -60 * MIN), {
      token: null,
      tokenVenceEn: null,
    });
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Tu compra" })).toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: "" }).length).toBeGreaterThan(0);
    expect(screen.getByText("K7M2Q-X9PDA")).toBeInTheDocument();
    expect(screen.getByText("B4N8R-T2LWE")).toBeInTheDocument();
    expect(screen.getByText(/También te mandamos las entradas a/)).toHaveTextContent(
      "comprador@ejemplo.com",
    );
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(document.querySelector(".cinta-peligro")).toBeNull();
    expect(screen.queryByRole("button", { name: /Cambiar butacas|Abandonar/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cambiar butacas" })).toBeNull();
    expect(pedidos).toEqual([]);
  });
});
