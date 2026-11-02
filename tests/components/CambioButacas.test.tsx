import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CambioButacas } from "@/components/CambioButacas/CambioButacas";
import { leerSesion } from "@/domain/sesion-carrito";
import {
  carritosEstados,
  conVencimiento,
  guardarSesionDePrueba,
  ID_CARRITO,
  ID_FUNCION_8X12,
  mapas,
  problemaCarrito,
} from "../fixtures";
import { server } from "../msw/setup";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const MIN = 60_000;
const F8 = { fila: "F", numero: 8 };
const F10 = { fila: "F", numero: 10 };

/** El mapa como lo ve la API: la F8 y la F9 figuran ocupadas porque las retiene este carrito. */
function mapaConPropiasOcupadas(otrasOcupadasEnF: number[] = []) {
  const mapa = structuredClone(mapas[ID_FUNCION_8X12]);
  const ocupadas = [8, 9, ...otrasOcupadasEnF];
  const filaF = mapa.filas.find((f) => f.fila === "F");
  if (filaF) {
    filaF.asientosDisponibles = filaF.asientosDisponibles.filter((n) => !ocupadas.includes(n));
  }
  return mapa;
}

function responderMapa(responder = () => HttpResponse.json(mapaConPropiasOcupadas())) {
  let pedidos = 0;
  server.use(
    http.get("*/api/funciones/:funcionId/asientos", () => {
      pedidos++;
      return responder();
    }),
  );
  return { pedidos: () => pedidos };
}

function responderCambio(responder: () => Response) {
  server.use(http.put("*/api/carritos/:carritoId/asientos", responder));
}

const problema = (status: number, codigo: string, extras: Record<string, unknown> = {}) =>
  HttpResponse.json(problemaCarrito(status, codigo, extras), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

const butaca = (nombre: string) => screen.getByRole("button", { name: nombre });
const guardar = () => screen.getByRole("button", { name: /^Guardar|^Guardando/ });

async function abrir() {
  const carrito = conVencimiento(carritosEstados.activo, 4 * MIN);
  guardarSesionDePrueba(carrito);
  render(<CambioButacas carritoId={ID_CARRITO} />);
  await screen.findByRole("grid");
  return { carrito, usuario: userEvent.setup() };
}

describe("CambioButacas", () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => {
    server.events.removeAllListeners();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sin sesión avisa que no hay carrito y no pide nada", async () => {
    const mapa = responderMapa();
    render(<CambioButacas carritoId={ID_CARRITO} />);
    expect(
      await screen.findByRole("heading", { name: "No hay un carrito activo en esta pestaña" }),
    ).toBeInTheDocument();
    expect(mapa.pedidos()).toBe(0);
  });

  it("muestra el mapa con las butacas del carrito seleccionadas y el contador", async () => {
    responderMapa();
    guardarSesionDePrueba(conVencimiento(carritosEstados.activo, 4 * MIN));
    render(<CambioButacas carritoId={ID_CARRITO} />);

    expect(screen.getByText("Cargando el mapa de la sala…")).toBeInTheDocument();
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
    expect(butaca("Fila F, butaca 9, seleccionada")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Cambiá tus butacas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al carrito" })).toHaveAttribute(
      "href",
      `/carritos/${ID_CARRITO}`,
    );
  });

  it("sin cambios no deja guardar; con cambios envía la selección completa", async () => {
    responderMapa();
    const { carrito, usuario } = await abrir();
    expect(guardar()).toHaveAccessibleName("Guardar 2 butacas");
    expect(guardar()).toBeDisabled();

    // Como la API: reemplaza las butacas y no toca el vencimiento.
    let cuerpo: unknown;
    server.use(
      http.put("*/api/carritos/:carritoId/asientos", async ({ request }) => {
        cuerpo = await request.json();
        const { asientos } = cuerpo as { asientos: typeof carrito.asientos };
        return HttpResponse.json({ ...carrito, asientos });
      }),
    );
    await usuario.click(butaca("Fila F, butaca 9, seleccionada"));
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    expect(guardar()).toBeEnabled();
    await usuario.click(guardar());

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/carritos/${ID_CARRITO}`));
    expect(cuerpo).toEqual({ asientos: [F8, F10] });
    expect(leerSesion()?.carrito.asientos).toEqual([F8, F10]);
    expect(leerSesion()?.carrito.venceEn).toBe(carrito.venceEn);
    expect(leerSesion()?.token).not.toBeNull();
  });

  it("sin butacas no deja guardar y sugiere abandonar el carrito", async () => {
    responderMapa();
    const { usuario } = await abrir();
    await usuario.click(butaca("Fila F, butaca 8, seleccionada"));
    await usuario.click(butaca("Fila F, butaca 9, seleccionada"));

    expect(guardar()).toBeDisabled();
    expect(
      screen.getByText("Para no quedarte con ninguna butaca, abandoná el carrito."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al carrito" })).toHaveAttribute(
      "href",
      `/carritos/${ID_CARRITO}`,
    );
  });

  it("asientos-no-disponibles saca la butaca tomada y conserva las propias", async () => {
    // El refresco ya trae la F10 tomada por otro comprador.
    let pedidosMapa = 0;
    const mapa = responderMapa(() =>
      HttpResponse.json(mapaConPropiasOcupadas(pedidosMapa++ === 0 ? [] : [10])),
    );
    const { usuario } = await abrir();
    responderCambio(() => problema(409, "asientos-no-disponibles", { asientos: [F10] }));
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    await usuario.click(guardar());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alguien tomó la F10 antes que vos.",
    );
    await waitFor(() => expect(mapa.pedidos()).toBe(2));
    expect(butaca("Fila F, butaca 10, ocupada")).toBeInTheDocument();
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["funcion-sin-cupo", 409, "Hay muchas butacas reservadas en esta función"],
    ["funcion-no-disponible", 410, "Esta función ya no está disponible."],
    ["asientos-inexistentes", 422, "Algunas butacas ya no existen en esta sala."],
  ])("%s se maneja como en la creación", async (codigo, status, texto) => {
    responderMapa();
    const { usuario } = await abrir();
    responderCambio(() => problema(status, codigo));
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    await usuario.click(guardar());
    expect(await screen.findByRole("alert")).toHaveTextContent(texto);
  });

  it("la función que ya no está disponible ofrece volver a la cartelera", async () => {
    responderMapa();
    const { usuario } = await abrir();
    responderCambio(() => problema(410, "funcion-no-disponible"));
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    await usuario.click(guardar());
    const aviso = await screen.findByRole("alert");
    expect(within(aviso).getByRole("link", { name: "Ver la cartelera" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("pedido-invalido muestra los mensajes junto a la selección", async () => {
    responderMapa();
    const { usuario } = await abrir();
    responderCambio(() =>
      problema(400, "pedido-invalido", { errors: { asientos: ["Repetiste una butaca."] } }),
    );
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    await usuario.click(guardar());
    expect(await screen.findByText("Repetiste una butaca.")).toBeInTheDocument();
  });

  it("si el contador llega a cero, cierra la sesión y vuelve al carrito", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "Date"] });
    responderMapa();
    guardarSesionDePrueba(conVencimiento(carritosEstados.activo, 3000));
    render(<CambioButacas carritoId={ID_CARRITO} />);
    await screen.findByRole("grid");

    for (let i = 0; i < 4; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/carritos/${ID_CARRITO}`));
    expect(leerSesion()?.token).toBeNull();
  });
});

describe("CambioButacas: errores del carrito", () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  async function guardarCambio() {
    responderMapa();
    const { usuario } = await abrir();
    await usuario.click(butaca("Fila F, butaca 10, libre"));
    await usuario.click(guardar());
  }

  it.each([
    ["un 401", () => new HttpResponse(null, { status: 401 })],
    ["carrito-no-encontrado", () => problema(404, "carrito-no-encontrado")],
  ])("%s muestra que no se pudo recuperar el carrito y borra la sesión", async (_, respuesta) => {
    responderCambio(respuesta);
    await guardarCambio();
    expect(
      await screen.findByRole("heading", { level: 1, name: "No pudimos recuperar tu carrito" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("randomplay:carrito")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("carrito-no-activo cierra la sesión y vuelve al carrito", async () => {
    responderCambio(() => problema(409, "carrito-no-activo", { estadoActual: "Expirado" }));
    await guardarCambio();
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/carritos/${ID_CARRITO}`));
    expect(leerSesion()).toMatchObject({ token: null, carrito: { estado: "Expirado" } });
  });

  it("sin conexión muestra la cinta de peligro", async () => {
    responderCambio(() => HttpResponse.error());
    await guardarCambio();
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos guardar el cambio.");
    expect(aviso.querySelector(".cinta-peligro")).not.toBeNull();
  });

  it("un código desconocido es un error genérico sin cinta", async () => {
    responderCambio(() => problema(418, "algo-nuevo"));
    await guardarCambio();
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos guardar el cambio.");
    expect(aviso.querySelector(".cinta-peligro")).toBeNull();
  });
});
