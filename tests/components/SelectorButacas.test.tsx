import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapearMapa } from "@/api/asientos";
import { SelectorButacas } from "@/components/SelectorButacas/SelectorButacas";
import { formatearPrecio } from "@/domain/formato";
import { guardarSesion, leerSesion } from "@/domain/sesion-carrito";
import { carritoCreado, ID_FUNCION_8X12, mapas, problemaCarrito } from "../fixtures";
import { server } from "../msw/setup";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const mapa8x12 = () => mapearMapa(mapas[ID_FUNCION_8X12]);
const butaca = (nombre: string) => screen.getByRole("button", { name: nombre });
const confirmar = () => screen.getByRole("button", { name: /^Confirmar/ });
const resumen = () => screen.getByRole("status");

describe("SelectorButacas: recorrido feliz", () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("sin selección, el botón está deshabilitado y el resumen lo dice", () => {
    render(<SelectorButacas mapa={mapa8x12()} />);
    expect(confirmar()).toHaveAccessibleName("Confirmar butacas");
    expect(confirmar()).toBeDisabled();
    expect(resumen()).toHaveTextContent("Todavía no elegiste butacas.");
  });

  it("elige y quita butacas con cantidad y total exactos", async () => {
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);

    await usuario.click(butaca("Fila F, butaca 8, libre"));
    await usuario.click(butaca("Fila F, butaca 9, libre"));
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
    expect(resumen()).toHaveTextContent("2 butacas elegidas: F8, F9");
    expect(resumen()).toHaveTextContent(
      formatearPrecio({ monto: "9000.00", moneda: "ARS" }).replace(/\s/g, " "),
    );
    expect(confirmar()).toHaveAccessibleName("Confirmar 2 butacas");
    expect(confirmar()).toBeEnabled();

    await usuario.click(butaca("Fila F, butaca 8, seleccionada"));
    expect(resumen()).toHaveTextContent("1 butaca elegida: F9");
    expect(confirmar()).toHaveAccessibleName("Confirmar 1 butaca");
  });

  it("una butaca ocupada no cambia", async () => {
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    const ocupada = butaca("Fila C, butaca 5, ocupada");
    expect(ocupada).toHaveAttribute("aria-disabled", "true");
    await usuario.click(ocupada);
    expect(butaca("Fila C, butaca 5, ocupada")).toBeInTheDocument();
    expect(resumen()).toHaveTextContent("Todavía no elegiste butacas.");
  });

  it("no pasa de 10 butacas y avisa", async () => {
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    for (let n = 1; n <= 10; n++) await usuario.click(butaca(`Fila A, butaca ${n}, libre`));
    await usuario.click(butaca("Fila A, butaca 11, libre"));
    expect(butaca("Fila A, butaca 11, libre")).toBeInTheDocument();
    expect(resumen()).toHaveTextContent("Llegaste al máximo de 10 butacas por compra.");
    expect(confirmar()).toHaveAccessibleName("Confirmar 10 butacas");
  });

  it("confirma una sola vez, guarda la sesión y va al carrito", async () => {
    let pedidos = 0;
    server.use(
      http.post("*/api/funciones/:funcionId/carritos", async () => {
        pedidos++;
        await delay(30);
        return HttpResponse.json(carritoCreado, { status: 201 });
      }),
    );
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    await usuario.click(butaca("Fila F, butaca 8, libre"));
    await usuario.dblClick(confirmar());

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/carritos/${carritoCreado.carrito.id}`));
    expect(pedidos).toBe(1);
    expect(leerSesion()).toMatchObject({
      carritoId: carritoCreado.carrito.id,
      token: carritoCreado.token,
    });
  });

  it("abandona el carrito anterior antes de crear el nuevo, aunque el abandono falle", async () => {
    guardarSesion({
      version: 1,
      carritoId: "anterior",
      token: "token-anterior",
      tokenVenceEn: carritoCreado.tokenVenceEn,
      carrito: { ...carritoCreado.carrito, id: "anterior", funcion: carritoCreado.carrito.funcion },
    });
    const orden: string[] = [];
    server.use(
      http.post("*/api/carritos/:carritoId/abandono", ({ params, request }) => {
        orden.push(`abandono:${String(params.carritoId)}:${request.headers.get("Authorization")}`);
        return new HttpResponse(null, { status: 500 });
      }),
      http.post("*/api/funciones/:funcionId/carritos", () => {
        orden.push("creacion");
        return HttpResponse.json(carritoCreado, { status: 201 });
      }),
    );
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    await usuario.click(butaca("Fila F, butaca 8, libre"));
    await usuario.click(confirmar());

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(orden).toEqual(["abandono:anterior:Bearer token-anterior", "creacion"]);
    expect(leerSesion()?.carritoId).toBe(carritoCreado.carrito.id);
  });

  it("si no se puede guardar en la pestaña, avisa y no crea el carrito", async () => {
    let pedidos = 0;
    server.use(
      http.post("*/api/funciones/:funcionId/carritos", () => {
        pedidos++;
        return HttpResponse.json(carritoCreado, { status: 201 });
      }),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    await usuario.click(butaca("Fila F, butaca 8, libre"));
    await usuario.click(confirmar());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu navegador no deja guardar el carrito en esta pestaña.",
    );
    expect(pedidos).toBe(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("ante un error del servidor muestra un error recuperable y conserva la selección", async () => {
    server.use(
      http.post(
        "*/api/funciones/:funcionId/carritos",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const usuario = userEvent.setup();
    render(<SelectorButacas mapa={mapa8x12()} />);
    await usuario.click(butaca("Fila F, butaca 8, libre"));
    await usuario.click(confirmar());

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No pudimos reservar las butacas.");
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

const problemJson = (status: number, codigo: string, extras = {}, headers = {}) =>
  HttpResponse.json(problemaCarrito(status, codigo, extras), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });

const responderCreacion = (respuesta: () => Response) =>
  server.use(http.post("*/api/funciones/:funcionId/carritos", respuesta));

/** El mapa de la API con algunas butacas de la fila F ocupadas. */
const mapaConOcupadas = (ocupadas: number[]) => {
  const api = structuredClone(mapas[ID_FUNCION_8X12]);
  const filaF = api.filas.find((f) => f.fila === "F");
  if (filaF) {
    filaF.asientosDisponibles = filaF.asientosDisponibles.filter(
      (n) => !ocupadas.includes(Number(n)),
    );
  }
  return api;
};

async function elegirYConfirmar(...numeros: number[]) {
  const usuario = userEvent.setup();
  render(<SelectorButacas mapa={mapa8x12()} />);
  for (const n of numeros) await usuario.click(butaca(`Fila F, butaca ${n}, libre`));
  await usuario.click(confirmar());
  return usuario;
}

describe("SelectorButacas: manejo por codigo", () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  describe("asientos-no-disponibles", () => {
    it("marca la butaca perdida, refresca el mapa y conserva el resto", async () => {
      let pedidosMapa = 0;
      server.use(
        http.get("*/api/funciones/:funcionId/asientos", () => {
          pedidosMapa++;
          return HttpResponse.json(mapaConOcupadas([8]));
        }),
      );
      responderCreacion(() =>
        problemJson(409, "asientos-no-disponibles", { asientos: [{ fila: "F", numero: 8 }] }),
      );
      await elegirYConfirmar(8, 9, 10);

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("Alguien tomó la F8 antes que vos.");
      await waitFor(() => expect(pedidosMapa).toBe(1));
      await waitFor(() => expect(alerta).not.toHaveTextContent("Actualizando el mapa"));
      expect(butaca("Fila F, butaca 8, ocupada")).toBeInTheDocument();
      expect(butaca("Fila F, butaca 9, seleccionada")).toBeInTheDocument();
      expect(butaca("Fila F, butaca 10, seleccionada")).toBeInTheDocument();
      expect(confirmar()).toHaveAccessibleName("Confirmar 2 butacas");
    });

    it("nombra todas las butacas perdidas, incluidas las que revela el refresco", async () => {
      server.use(
        http.get("*/api/funciones/:funcionId/asientos", () =>
          HttpResponse.json(mapaConOcupadas([8, 9, 10])),
        ),
      );
      responderCreacion(() =>
        problemJson(409, "asientos-no-disponibles", {
          asientos: [
            { fila: "F", numero: 8 },
            { fila: "F", numero: 9 },
          ],
        }),
      );
      await elegirYConfirmar(8, 9, 10);
      const alerta = await screen.findByRole("alert");
      await waitFor(() =>
        expect(alerta).toHaveTextContent(
          "Alguien tomó la F8, la F9 y la F10 antes que vos. Actualizamos el mapa; elegí otras.",
        ),
      );
      expect(butaca("Fila F, butaca 10, ocupada")).toBeInTheDocument();
    });

    it("si el refresco falla, deja la butaca ocupada y ofrece actualizar el mapa", async () => {
      server.use(http.get("*/api/funciones/:funcionId/asientos", () => HttpResponse.error()));
      responderCreacion(() =>
        problemJson(409, "asientos-no-disponibles", { asientos: [{ fila: "F", numero: 8 }] }),
      );
      await elegirYConfirmar(8, 9);
      expect(await screen.findByRole("button", { name: "Actualizar mapa" })).toBeInTheDocument();
      expect(butaca("Fila F, butaca 8, ocupada")).toBeInTheDocument();
      expect(butaca("Fila F, butaca 9, seleccionada")).toBeInTheDocument();
    });
  });

  it.each([
    [404, "funcion-no-encontrada"],
    [410, "funcion-no-disponible"],
  ])("%s %s bloquea el mapa y lleva a otros horarios", async (status, codigo) => {
    responderCreacion(() => problemJson(status, codigo));
    const usuario = await elegirYConfirmar(8);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Esta función ya no está disponible.");
    expect(within(alerta).getByRole("link", { name: "Ver otros horarios" })).toHaveAttribute(
      "href",
      `/peliculas/${mapas[ID_FUNCION_8X12].peliculaId}#titulo-horarios`,
    );
    expect(confirmar()).toBeDisabled();
    await usuario.click(butaca("Fila F, butaca 9, libre"));
    expect(butaca("Fila F, butaca 9, libre")).toBeInTheDocument();
  });

  it("funcion-sin-cupo pide probar más tarde y conserva la selección", async () => {
    responderCreacion(() => problemJson(409, "funcion-sin-cupo"));
    await elegirYConfirmar(8);
    expect(await screen.findByRole("alert")).toHaveTextContent("Probá de nuevo en unos minutos.");
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
    expect(confirmar()).toBeEnabled();
  });

  describe("demasiados-pedidos", () => {
    it("respeta Retry-After antes de permitir reintentar", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
      responderCreacion(() => problemJson(429, "demasiados-pedidos", {}, { "Retry-After": "30" }));
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SelectorButacas mapa={mapa8x12()} />);
      await usuario.click(butaca("Fila F, butaca 8, libre"));
      await usuario.click(confirmar());

      expect(await screen.findByText(/Podés volver a intentar en/)).toHaveTextContent("30 s");
      expect(confirmar()).toBeDisabled();
      // Cada segundo React programa el siguiente en un efecto: se avanza de a uno.
      const avanzarSegundos = async (n: number) => {
        for (let i = 0; i < n; i++) await act(() => vi.advanceTimersByTimeAsync(1_000));
      };
      await avanzarSegundos(29);
      expect(confirmar()).toBeDisabled();
      expect(screen.getByText(/Podés volver a intentar en/)).toHaveTextContent("1 s");
      await avanzarSegundos(1);
      expect(confirmar()).toBeEnabled();
      expect(resumen()).toHaveTextContent("Ya podés volver a intentar.");
    });

    it("sin Retry-After espera 60 segundos", async () => {
      responderCreacion(() => problemJson(429, "demasiados-pedidos"));
      await elegirYConfirmar(8);
      expect(await screen.findByText(/Podés volver a intentar en/)).toHaveTextContent("60 s");
    });
  });

  it("pedido-invalido muestra los mensajes junto a la selección", async () => {
    responderCreacion(() =>
      problemJson(400, "pedido-invalido", {
        errors: { Asientos: ["No se pueden repetir butacas."], email: ["Email inválido."] },
      }),
    );
    await elegirYConfirmar(8);
    const alerta = await screen.findByRole("alert");
    const mensajes = within(alerta).getByRole("list");
    expect(mensajes).toHaveTextContent("No se pueden repetir butacas.");
    expect(resumen()).toHaveAttribute("aria-describedby", mensajes.id);
    expect(alerta).toHaveTextContent("Email inválido.");
  });

  it("asientos-inexistentes refresca el mapa y saca lo que ya no existe", async () => {
    const sinFilaF = structuredClone(mapas[ID_FUNCION_8X12]);
    sinFilaF.filas = sinFilaF.filas.filter((f) => f.fila !== "F");
    server.use(http.get("*/api/funciones/:funcionId/asientos", () => HttpResponse.json(sinFilaF)));
    responderCreacion(() =>
      problemJson(422, "asientos-inexistentes", { asientos: [{ fila: "F", numero: 8 }] }),
    );
    await elegirYConfirmar(8);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algunas butacas ya no existen en esta sala.",
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Fila F,/ })).toBeNull());
    expect(resumen()).toHaveTextContent("Todavía no elegiste butacas.");
  });

  it.each([
    ["desafio-rechazado", () => problemJson(403, "desafio-rechazado")],
    ["un codigo desconocido", () => problemJson(409, "algo-nuevo")],
    ["un error sin codigo", () => new HttpResponse(null, { status: 502 })],
    ["un fallo de red", () => HttpResponse.error()],
  ])("%s cae en el error genérico recuperable", async (_caso, respuesta) => {
    responderCreacion(respuesta);
    await elegirYConfirmar(8);
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No pudimos reservar las butacas.");
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(butaca("Fila F, butaca 8, seleccionada")).toBeInTheDocument();
  });

  it("cambiar la selección limpia un aviso pasajero", async () => {
    responderCreacion(() => problemJson(409, "funcion-sin-cupo"));
    const usuario = await elegirYConfirmar(8);
    await screen.findByRole("alert");
    await usuario.click(butaca("Fila F, butaca 9, libre"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
