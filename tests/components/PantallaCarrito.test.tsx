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
  ID_CARRITO_AJENO,
  TOKEN_PRUEBA,
} from "../fixtures";
import { server } from "../msw/setup";

type CarritoApi = components["schemas"]["CarritoResponse"];

const AHORA = new Date("2026-11-01T17:00:00-03:00");
const MIN = 60_000;

/** Responde el GET del carrito con este cuerpo y un header `Date` opcional. */
function responderCarrito(carrito: CarritoApi, fecha?: Date) {
  server.use(
    http.get("*/api/carritos/:carritoId", () =>
      HttpResponse.json(carrito, {
        headers: { Date: (fecha ?? new Date()).toUTCString() },
      }),
    ),
  );
}

/** Cuenta los pedidos a /api/carritos que salen durante el test. */
function contarPedidosCarrito() {
  const conteo = { n: 0 };
  server.events.on("request:start", ({ request }) => {
    if (new URL(request.url).pathname.startsWith("/api/carritos")) conteo.n++;
  });
  return conteo;
}

const contador = () => screen.getByRole("timer");
const avisosTiempo = () => screen.getByRole("status", { name: "Avisos sobre el tiempo" });
const avanzar = async (ms: number) => {
  for (let paso = 0; paso < ms; paso += 1000) {
    await act(() => vi.advanceTimersByTimeAsync(Math.min(1000, ms - paso)));
  }
};

describe("PantallaCarrito: vistas y cuenta regresiva", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    server.events.removeAllListeners();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sin sesión en la pestaña avisa y no consulta la API", async () => {
    const pedidos = contarPedidosCarrito();
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No hay un carrito activo en esta pestaña",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la cartelera" })).toHaveAttribute("href", "/");
    await avanzar(1000);
    expect(pedidos.n).toBe(0);
  });

  it("con la sesión de otro carrito tampoco consulta la API", async () => {
    guardarSesionDePrueba();
    const pedidos = contarPedidosCarrito();
    render(<PantallaCarrito carritoId={ID_CARRITO_AJENO} />);

    expect(
      await screen.findByRole("heading", { name: "No hay un carrito activo en esta pestaña" }),
    ).toBeInTheDocument();
    await avanzar(1000);
    expect(pedidos.n).toBe(0);
  });

  it("muestra enseguida el carrito guardado y después el que devuelve la API", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 4 * MIN, AHORA);
    guardarSesionDePrueba(carrito);
    // El GET espera hasta que el test confirma que se vio lo guardado.
    let responder = () => {};
    const respuesta = new Promise<void>((resolver) => (responder = resolver));
    server.use(
      http.get("*/api/carritos/:carritoId", async () => {
        await respuesta;
        return HttpResponse.json({
          ...carrito,
          funcion: { ...carrito.funcion, peliculaTitulo: "Otra cinta" },
        });
      }),
    );
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tu carrito" }),
    ).toBeInTheDocument();
    expect(screen.getByText("La noche del videoclub")).toBeInTheDocument();
    responder();
    expect(await screen.findByText("Otra cinta")).toBeInTheDocument();

    expect(screen.getByText("Sucursal Centro")).toBeInTheDocument();
    expect(screen.getByText("Sala 1")).toBeInTheDocument();
    expect(screen.getByText("Fila F, butaca 8")).toBeInTheDocument();
    expect(screen.getByText("Fila F, butaca 9")).toBeInTheDocument();
    expect(screen.getByText(/4\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/9\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("el contador arranca desde venceEn, baja cada segundo y tiene un texto completo", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 9 * MIN + 42_000, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByText("09:42")).toBeInTheDocument();
    expect(contador()).toHaveTextContent("Quedan 9 minutos y 42 segundos");
    expect(contador()).toHaveAttribute("data-tramo", "normal");
    await avanzar(1000);
    expect(screen.getByText("09:41")).toBeInTheDocument();
  });

  it("a los 2 minutos cambia de tramo y avisa; al vencer pasa a lectura con cinta", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 2 * MIN + 3000, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    const { container } = render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByText("02:03")).toBeInTheDocument();
    expect(avisosTiempo()).toHaveTextContent("");
    await avanzar(3000);
    expect(contador()).toHaveAttribute("data-tramo", "final");
    expect(avisosTiempo()).toHaveTextContent(
      "Quedan 2 minutos o menos. Después, tus butacas se liberan.",
    );

    await avanzar(2 * MIN);
    const titulo = await screen.findByRole("heading", { level: 1, name: "Se terminó el tiempo" });
    expect(titulo).toHaveFocus();
    expect(avisosTiempo()).toHaveTextContent("Se terminó el tiempo. Liberamos tus butacas.");
    expect(container.querySelector(".cinta-peligro")).not.toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(leerSesion()).toMatchObject({ token: null, carritoId: ID_CARRITO });
  });

  it("en una retención completa da exactamente dos avisos de tiempo", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 5 * MIN, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);
    await screen.findByText("05:00");

    const textos = new Set<string>();
    for (let s = 0; s <= 5 * 60; s++) {
      const texto = avisosTiempo().textContent ?? "";
      if (texto) textos.add(texto);
      await avanzar(1000);
    }
    expect([...textos]).toHaveLength(2);
  });

  it("corrige el contador con la hora del servidor", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 9 * MIN + 42_000, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito, new Date(AHORA.getTime() + 3 * MIN));
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByText("06:42")).toBeInTheDocument();
    expect(leerSesion()?.desfaseMs).toBeGreaterThan(3 * MIN - 2000);
  });

  it("al volver a la pestaña muestra el tiempo real", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 9 * MIN + 42_000, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);
    await screen.findByText("09:42");

    vi.setSystemTime(Date.now() + MIN);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByText("08:42")).toBeInTheDocument();
  });

  it("con venceEn ya pasado se muestra vencido aunque la API diga Activo", async () => {
    const carrito = conVencimiento(carritosEstados.activo, -MIN, AHORA);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Se terminó el tiempo" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(leerSesion()?.token).toBeNull());
  });

  it.each([
    ["abandonado", "Abandonaste el carrito", "Abandonado"],
    ["expirado", "Se terminó el tiempo", "Vencido"],
  ] as const)("si la API lo informa %s, pasa a lectura", async (clave, titulo, estado) => {
    guardarSesionDePrueba(conVencimiento(carritosEstados.activo, 4 * MIN, AHORA));
    responderCarrito(conVencimiento(carritosEstados[clave], 4 * MIN, AHORA));
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByRole("heading", { level: 1, name: titulo })).toBeInTheDocument();
    expect(screen.getByText(estado)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cambiar butacas" })).toBeNull();
    expect(screen.getByRole("link", { name: "Elegir otra función" })).toHaveAttribute(
      "href",
      `/peliculas/${carritosEstados.activo.funcion.peliculaId}#titulo-horarios`,
    );
    await waitFor(() => expect(leerSesion()?.token).toBeNull());
  });

  it("con la sesión ya cerrada muestra el modo lectura sin consultar la API", async () => {
    guardarSesionDePrueba(carritosEstados.abandonado, { token: null, tokenVenceEn: null });
    const pedidos = contarPedidosCarrito();
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Abandonaste el carrito" }),
    ).toBeInTheDocument();
    await avanzar(1000);
    expect(pedidos.n).toBe(0);
  });

  it("si la actualización falla, sigue mostrando el carrito y ofrece reintentar", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 4 * MIN, AHORA);
    guardarSesionDePrueba(carrito);
    server.use(
      http.get("*/api/carritos/:carritoId", () => new HttpResponse(null, { status: 500 })),
    );
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos actualizar tu carrito.");
    expect(screen.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeInTheDocument();
    expect(screen.getByText("La noche del videoclub")).toBeInTheDocument();

    responderCarrito(carrito);
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

describe("PantallaCarrito: email de entrega", () => {
  const campo = () => screen.getByRole("textbox", { name: "Email para recibir las entradas" });
  const guardar = () => screen.getByRole("button", { name: /^Guardar email|^Guardando/ });

  /** Captura los PUT de email que salen durante el test. */
  function capturarEmails() {
    const cuerpos: unknown[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PUT" && request.url.endsWith("/email-entrega")) {
        cuerpos.push(await request.clone().json());
      }
    });
    return cuerpos;
  }

  function responderEmail(respuesta: () => Response | Promise<Response>) {
    server.use(http.put("*/api/carritos/:carritoId/email-entrega", respuesta));
  }

  const problemaEmail = (errors: Record<string, string[]>) =>
    HttpResponse.json(
      {
        type: "https://httpstatuses.io/400",
        title: "Error",
        status: 400,
        codigo: "pedido-invalido",
        errors,
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );

  async function abrir(carrito: CarritoApi = carritosEstados.activo) {
    const vigente = conVencimiento(carrito, 4 * MIN);
    guardarSesionDePrueba(vigente);
    responderCarrito(vigente);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);
    await screen.findByRole("heading", { level: 1, name: "Tu carrito" });
    return userEvent.setup();
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
  });

  it("ofrece el campo con su etiqueta y el botón para guardarlo", async () => {
    await abrir();
    expect(campo()).toHaveValue("");
    expect(campo()).toHaveAttribute("type", "email");
    expect(guardar()).toBeEnabled();
  });

  it.each([
    ["", "Escribí tu email."],
    ["nombre@", "Revisá el email: le falta la arroba o el dominio."],
  ])("con %j no envía nada y explica qué corregir junto al campo", async (texto, mensaje) => {
    const usuario = await abrir();
    const cuerpos = capturarEmails();
    if (texto) await usuario.type(campo(), texto);
    await usuario.click(guardar());

    expect(campo()).toHaveAttribute("aria-invalid", "true");
    expect(campo()).toHaveAccessibleDescription(mensaje);
    expect(campo()).toHaveFocus();
    expect(cuerpos).toHaveLength(0);
  });

  it("muestra los errors de pedido-invalido junto al campo y conserva lo escrito", async () => {
    const usuario = await abrir();
    responderEmail(() => problemaEmail({ Email: ["El dominio no recibe correo."] }));
    await usuario.type(campo(), "alguien@ejemplo.com");
    await usuario.click(guardar());

    await waitFor(() =>
      expect(campo()).toHaveAccessibleDescription("El dominio no recibe correo."),
    );
    expect(campo()).toHaveValue("alguien@ejemplo.com");
  });

  it("los errors que no son del email van como aviso general", async () => {
    const usuario = await abrir();
    responderEmail(() => problemaEmail({ otro: ["Algo no está bien."] }));
    await usuario.type(campo(), "alguien@ejemplo.com");
    await usuario.click(guardar());

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo no está bien.");
    expect(campo()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("al guardarlo explica qué sigue, sin simular una compra", async () => {
    const usuario = await abrir();
    const cuerpos = capturarEmails();
    await usuario.type(campo(), "  comprador@ejemplo.com ");
    await usuario.click(guardar());

    const queSigue = await screen.findByRole("region", { name: "Qué sigue" });
    expect(cuerpos).toEqual([{ email: "comprador@ejemplo.com" }]);
    expect(queSigue).toHaveTextContent("comprador@ejemplo.com");
    expect(queSigue).toHaveTextContent("El pago todavía no está disponible");
    expect(queSigue).toHaveTextContent("no se emiten ni envían entradas");
    expect(screen.getByRole("heading", { level: 3, name: "Qué sigue" })).toHaveFocus();
    expect(document.body).not.toHaveTextContent(/compra confirmada|número de orden|pagar/i);
    expect(leerSesion()?.carrito.emailEntrega).toBe("comprador@ejemplo.com");
  });

  it("con el email ya guardado muestra qué sigue y deja cambiarlo", async () => {
    const usuario = await abrir(carritosEstados.conEmail);
    expect(screen.getByRole("region", { name: "Qué sigue" })).toHaveTextContent(
      "comprador@ejemplo.com",
    );
    await usuario.click(screen.getByRole("button", { name: "Cambiar email" }));
    expect(campo()).toHaveValue("comprador@ejemplo.com");
  });

  it("dos clics seguidos mandan un solo pedido", async () => {
    const usuario = await abrir();
    const cuerpos = capturarEmails();
    responderEmail(async () => {
      await new Promise((resolver) => setTimeout(resolver, 100));
      return HttpResponse.json({ ...carritosEstados.activo, emailEntrega: "a@b.co" });
    });
    await usuario.type(campo(), "a@b.co");
    await usuario.dblClick(guardar());

    await screen.findByRole("region", { name: "Qué sigue" });
    expect(cuerpos).toHaveLength(1);
  });

  it("si falla, avisa con Reintentar y conserva lo escrito", async () => {
    const usuario = await abrir();
    responderEmail(() => new HttpResponse(null, { status: 500 }));
    await usuario.type(campo(), "alguien@ejemplo.com");
    await usuario.click(guardar());

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos guardar el email.");
    expect(campo()).toHaveValue("alguien@ejemplo.com");

    responderEmail(() =>
      HttpResponse.json({ ...carritosEstados.activo, emailEntrega: "alguien@ejemplo.com" }),
    );
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("region", { name: "Qué sigue" })).toBeInTheDocument();
  });
});

describe("PantallaCarrito: cambiar butacas", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => server.events.removeAllListeners());

  it("un carrito activo ofrece cambiar las butacas", async () => {
    const carrito = conVencimiento(carritosEstados.activo, 4 * MIN);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);

    expect(await screen.findByRole("link", { name: "Cambiar butacas" })).toHaveAttribute(
      "href",
      `/carritos/${ID_CARRITO}/butacas`,
    );
  });
});

describe("PantallaCarrito: abandono", () => {
  const abandonar = () => screen.getByRole("button", { name: "Abandonar carrito" });
  const confirmacion = () => screen.queryByRole("group", { name: "Confirmar abandono" });

  function contarAbandonos() {
    const conteo = { n: 0 };
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/abandono")) conteo.n++;
    });
    return conteo;
  }

  async function abrir() {
    const carrito = conVencimiento(carritosEstados.activo, 4 * MIN);
    guardarSesionDePrueba(carrito);
    responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);
    await screen.findByRole("heading", { level: 1, name: "Tu carrito" });
    return userEvent.setup();
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
  });

  it("pide confirmar y deja el foco en la opción que no destruye nada", async () => {
    const usuario = await abrir();
    await usuario.click(abandonar());

    const grupo = confirmacion();
    expect(grupo).toHaveTextContent(
      "Si abandonás, liberamos tus butacas ahora y no las vas a poder recuperar.",
    );
    expect(screen.getByRole("button", { name: "Seguir con mi carrito" })).toHaveFocus();
  });

  it("Escape o Seguir con mi carrito cierran sin pedir nada y devuelven el foco", async () => {
    const usuario = await abrir();
    const abandonos = contarAbandonos();

    await usuario.click(abandonar());
    await usuario.keyboard("{Escape}");
    expect(confirmacion()).toBeNull();
    expect(abandonar()).toHaveFocus();

    await usuario.click(abandonar());
    await usuario.click(screen.getByRole("button", { name: "Seguir con mi carrito" }));
    expect(confirmacion()).toBeNull();
    expect(abandonar()).toHaveFocus();
    expect(abandonos.n).toBe(0);
  });

  it("al confirmar libera el carrito una sola vez y pasa a lectura", async () => {
    const usuario = await abrir();
    const abandonos = contarAbandonos();
    // La respuesta espera a que terminen los dos clics, como pasa con una red real.
    let responder = () => {};
    const respuesta = new Promise<void>((resolver) => (responder = resolver));
    server.use(
      http.post("*/api/carritos/:carritoId/abandono", async () => {
        await respuesta;
        return HttpResponse.json(carritosEstados.abandonado);
      }),
    );
    await usuario.click(abandonar());
    await usuario.dblClick(screen.getByRole("button", { name: "Sí, abandonar" }));
    responder();

    const titulo = await screen.findByRole("heading", { level: 1, name: "Abandonaste el carrito" });
    expect(titulo).toHaveFocus();
    expect(abandonos.n).toBe(1);
    expect(leerSesion()).toMatchObject({ token: null, carrito: { estado: "Abandonado" } });
    expect(document.querySelector(".cinta-peligro")).toBeNull();
  });

  it("si falla la red, el carrito sigue activo y se puede reintentar", async () => {
    const usuario = await abrir();
    server.use(http.post("*/api/carritos/:carritoId/abandono", () => HttpResponse.error()));
    await usuario.click(abandonar());
    await usuario.click(screen.getByRole("button", { name: "Sí, abandonar" }));

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos abandonar el carrito.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeInTheDocument();
    expect(leerSesion()?.token).not.toBeNull();
  });

  it("no intenta abandonar al cerrar o recargar la pestaña", async () => {
    const registrados: string[] = [];
    const original = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((tipo, ...resto) => {
      registrados.push(tipo);
      return original(tipo, ...resto);
    });
    const beacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });

    const { unmount } = render(<PantallaCarrito carritoId={ID_CARRITO} />);
    guardarSesionDePrueba(conVencimiento(carritosEstados.activo, 4 * MIN));
    unmount();

    expect(registrados).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^(pagehide|beforeunload|unload)$/)]),
    );
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe("PantallaCarrito: errores y credencial", () => {
  const PELICULA = carritosEstados.activo.funcion.peliculaId;

  const problemaJson = (status: number, codigo: string, extras: Record<string, unknown> = {}) =>
    HttpResponse.json(
      { type: `https://httpstatuses.io/${status}`, title: "Error", status, codigo, ...extras },
      { status, headers: { "Content-Type": "application/problem+json" } },
    );

  async function abrir(respuestaGet?: () => Response) {
    const carrito = conVencimiento(carritosEstados.activo, 4 * MIN);
    guardarSesionDePrueba(carrito);
    if (respuestaGet) server.use(http.get("*/api/carritos/:carritoId", respuestaGet));
    else responderCarrito(carrito);
    render(<PantallaCarrito carritoId={ID_CARRITO} />);
    return userEvent.setup();
  }

  async function esperarPerdido() {
    expect(
      await screen.findByRole("heading", { level: 1, name: "No pudimos recuperar tu carrito" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir otra función" })).toHaveAttribute(
      "href",
      `/peliculas/${PELICULA}#titulo-horarios`,
    );
    expect(sessionStorage.getItem("randomplay:carrito")).toBeNull();
  }

  async function guardarEmail(usuario: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("heading", { level: 1, name: "Tu carrito" });
    await usuario.type(
      screen.getByRole("textbox", { name: "Email para recibir las entradas" }),
      "a@b.co",
    );
    await usuario.click(screen.getByRole("button", { name: "Guardar email" }));
  }

  async function confirmarAbandono(usuario: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("heading", { level: 1, name: "Tu carrito" });
    await usuario.click(screen.getByRole("button", { name: "Abandonar carrito" }));
    await usuario.click(screen.getByRole("button", { name: "Sí, abandonar" }));
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
  });

  it.each([
    ["un 401", () => new HttpResponse(null, { status: 401 })],
    ["carrito-no-encontrado", () => problemaJson(404, "carrito-no-encontrado")],
  ])("%s al abrir descarta la credencial", async (_, respuesta) => {
    await abrir(respuesta);
    await esperarPerdido();
  });

  it("un 401 al guardar el email descarta la credencial", async () => {
    const usuario = await abrir();
    server.use(
      http.put(
        "*/api/carritos/:carritoId/email-entrega",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    await guardarEmail(usuario);
    await esperarPerdido();
  });

  it("carrito-no-encontrado al abandonar descarta la credencial", async () => {
    const usuario = await abrir();
    server.use(
      http.post("*/api/carritos/:carritoId/abandono", () =>
        problemaJson(404, "carrito-no-encontrado"),
      ),
    );
    await confirmarAbandono(usuario);
    await esperarPerdido();
  });

  it("carrito-no-activo al guardar el email pasa a lectura con aviso", async () => {
    const usuario = await abrir();
    server.use(
      http.put("*/api/carritos/:carritoId/email-entrega", () =>
        problemaJson(409, "carrito-no-activo", { estadoActual: "Expirado" }),
      ),
    );
    await guardarEmail(usuario);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Se terminó el tiempo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No se guardó el email");
    expect(leerSesion()).toMatchObject({ token: null, carrito: { estado: "Expirado" } });
  });

  it("carrito-no-activo al abandonar muestra el estado sin aviso de error", async () => {
    const usuario = await abrir();
    server.use(
      http.post("*/api/carritos/:carritoId/abandono", () =>
        problemaJson(409, "carrito-no-activo", { estadoActual: "Abandonado" }),
      ),
    );
    await confirmarAbandono(usuario);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Abandonaste el carrito" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(leerSesion()?.token).toBeNull();
  });

  it("sin conexión, el aviso lleva la cinta de peligro y se va con la siguiente respuesta", async () => {
    const usuario = await abrir();
    server.use(http.put("*/api/carritos/:carritoId/email-entrega", () => HttpResponse.error()));
    await guardarEmail(usuario);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos guardar el email.");
    expect(aviso.querySelector(".cinta-peligro")).not.toBeNull();

    server.use(
      http.put("*/api/carritos/:carritoId/email-entrega", () =>
        HttpResponse.json({ ...carritosEstados.activo, emailEntrega: "a@b.co" }),
      ),
    );
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("region", { name: "Qué sigue" });
    expect(document.querySelector(".cinta-peligro")).toBeNull();
  });

  it("un código desconocido es un error genérico sin cinta", async () => {
    const usuario = await abrir();
    server.use(
      http.put("*/api/carritos/:carritoId/email-entrega", () => problemaJson(418, "algo-nuevo")),
    );
    await guardarEmail(usuario);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos guardar el email.");
    expect(aviso.querySelector(".cinta-peligro")).toBeNull();
    expect(document.body).not.toHaveTextContent(TOKEN_PRUEBA);
  });
});
