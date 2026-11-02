import { expect, test, type Page } from "@playwright/test";
import {
  abandonarEnApi,
  API_URL,
  carritoEnApi,
  elegirLibres,
  estaLibre,
  funcionDePrueba,
  leerSesion,
  montoVisible,
  multiplicarMonto,
  nombreButaca,
  obtener,
  SEMBRADO,
  type Asiento,
  type Horario,
} from "./api";

// Flujo del comprador contra la API real (docs/api.md). Cada prueba crea como mucho dos
// carritos: la corrida completa usa 7 de los 10 permitidos por IP cada 10 minutos.

let funcion: Horario;
/** Carritos creados en la prueba en curso, para liberarlos aunque falle. */
let creados: { id: string; token: string }[] = [];

test.beforeAll(async ({ request }) => {
  const sano = await request.get(`${API_URL}/api/catalogo/peliculas`).catch(() => null);
  if (!sano?.ok()) {
    throw new Error(
      `La API no responde en ${API_URL}. Levantala con docker compose up -d --build.`,
    );
  }
  funcion = await funcionDePrueba(request);
});

test.afterEach(async ({ request }) => {
  for (const { id, token } of creados) await abandonarEnApi(request, id, token);
  creados = [];
});

/** Elige las butacas en el mapa abierto, confirma y devuelve el carrito creado. */
async function confirmarCarrito(page: Page, asientos: Asiento[]) {
  for (const asiento of asientos) {
    await page.getByRole("button", { name: nombreButaca(asiento, "libre") }).click();
  }
  const respuesta = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith(`/funciones/${funcion.funcionId}/carritos`),
  );
  const texto =
    asientos.length === 1 ? "Confirmar 1 butaca" : `Confirmar ${asientos.length} butacas`;
  await page.getByRole("button", { name: texto }).click();
  const creado = await respuesta;
  if (creado.status() === 429) {
    throw new Error(
      `Límite de carritos por IP (Retry-After: ${creado.headers()["retry-after"]} s). ` +
        "Esperá o reiniciá la API: docker compose restart api.",
    );
  }
  expect(creado.status()).toBe(201);
  await expect(page).toHaveURL(/\/carritos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
  const sesion = await leerSesion(page);
  expect(sesion.token).toBeTruthy();
  creados.push({ id: sesion.carritoId, token: sesion.token! });
  return { id: sesion.carritoId, token: sesion.token! };
}

/** El mapa público, visto por otro comprador (otro contexto, sin carrito). */
async function mapaPublico(page: Page) {
  const otro = await page
    .context()
    .browser()!
    .newPage({ viewport: { width: 360, height: 800 } });
  await otro.goto(`${new URL(page.url()).origin}/funciones/${funcion.funcionId}`);
  await expect(otro.getByRole("heading", { level: 1, name: "Elegí tus butacas" })).toBeVisible();
  return otro;
}

test("camino feliz: de la cartelera al carrito con email", async ({ page, request }) => {
  const asientos = await elegirLibres(request, funcion.funcionId, "C", 2);

  await page.goto("/");
  await page.getByRole("link", { name: "Interstellar (demo)" }).first().click();
  await expect(page).toHaveURL(`/peliculas/${SEMBRADO.interstellar}`);
  await expect(page.getByRole("heading", { level: 1, name: "Interstellar (demo)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sucursal Centro" })).toBeVisible();

  const horario = page.locator(`a[href="/funciones/${funcion.funcionId}"]`);
  await expect(horario).toContainText(funcion.salaNombre);
  await expect(horario).toContainText(montoVisible(funcion.precioEntrada.monto));
  await horario.click();
  await expect(page.getByRole("heading", { level: 1, name: "Elegí tus butacas" })).toBeVisible();

  const { id, token } = await confirmarCarrito(page, asientos);
  const totalEsperado = multiplicarMonto(funcion.precioEntrada.monto, 2);
  for (const { fila, numero } of asientos) {
    await expect(page.getByText(`Fila ${fila}, butaca ${numero}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(montoVisible(totalEsperado))).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(/0[45]:\d\d/);

  const email = "comprador@randomplay.test";
  await page.getByRole("textbox", { name: "Email para recibir las entradas" }).fill(email);
  await page.getByRole("button", { name: "Guardar email" }).click();
  await expect(page.getByRole("region", { name: "Qué sigue" })).toContainText(email);

  const carrito = await carritoEnApi(request, id, token);
  expect(carrito.estado).toBe("Activo");
  expect(carrito.total.monto).toBe(totalEsperado);
  expect(carrito.emailEntrega).toBe(email);

  const otro = await mapaPublico(page);
  for (const asiento of asientos) {
    await expect(
      otro.getByRole("button", { name: nombreButaca(asiento, "ocupada") }),
    ).toBeVisible();
  }
  await otro.close();
});

test("cambiar la selección libera las anteriores y no extiende el plazo", async ({
  page,
  request,
}) => {
  const [a, b, c] = await elegirLibres(request, funcion.funcionId, "D", 3);
  await page.goto(`/funciones/${funcion.funcionId}`);
  const { id, token } = await confirmarCarrito(page, [a, b]);
  const antes = await carritoEnApi(request, id, token);

  await page.getByRole("link", { name: "Cambiar butacas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cambiá tus butacas" })).toBeVisible();
  await page.getByRole("button", { name: nombreButaca(b, "seleccionada") }).click();
  await page.getByRole("button", { name: nombreButaca(c, "libre") }).click();
  await page.getByRole("button", { name: "Guardar 2 butacas" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
  await expect(page.getByText(`Fila ${c.fila}, butaca ${c.numero}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Fila ${b.fila}, butaca ${b.numero}`, { exact: true })).toHaveCount(
    0,
  );

  const despues = await carritoEnApi(request, id, token);
  expect(despues.asientos).toEqual(expect.arrayContaining([a, c]));
  expect(despues.asientos).toHaveLength(2);
  expect(despues.venceEn).toBe(antes.venceEn);

  const otro = await mapaPublico(page);
  await expect(otro.getByRole("button", { name: nombreButaca(b, "libre") })).toBeVisible();
  await expect(otro.getByRole("button", { name: nombreButaca(c, "ocupada") })).toBeVisible();
  await otro.close();
});

test("abandonar libera las butacas al instante", async ({ page, request }) => {
  const asientos = await elegirLibres(request, funcion.funcionId, "E", 2);
  await page.goto(`/funciones/${funcion.funcionId}`);
  const { id, token } = await confirmarCarrito(page, asientos);
  expect(await estaLibre(request, funcion.funcionId, asientos[0])).toBe(false);

  await page.getByRole("button", { name: "Abandonar carrito" }).click();
  await page.getByRole("button", { name: "Sí, abandonar" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Abandonaste el carrito" }),
  ).toBeVisible();

  expect((await carritoEnApi(request, id, token)).estado).toBe("Abandonado");
  const otro = await mapaPublico(page);
  for (const asiento of asientos) {
    await expect(otro.getByRole("button", { name: nombreButaca(asiento, "libre") })).toBeVisible();
  }
  await otro.close();
});

test("conflicto: dos pestañas toman la misma butaca", async ({ page, context, request }) => {
  const [disputada] = await elegirLibres(request, funcion.funcionId, "F", 1);
  const segunda = await context.newPage();
  await page.goto(`/funciones/${funcion.funcionId}`);
  await segunda.goto(`/funciones/${funcion.funcionId}`);

  await confirmarCarrito(page, [disputada]);

  await segunda.getByRole("button", { name: nombreButaca(disputada, "libre") }).click();
  const rechazo = segunda.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/carritos"),
  );
  await segunda.getByRole("button", { name: "Confirmar 1 butaca" }).click();
  const respuesta = await rechazo;
  expect(respuesta.status()).toBe(409);
  const problema = (await respuesta.json()) as { codigo: string; asientos: Asiento[] };
  expect(problema.codigo).toBe("asientos-no-disponibles");
  expect(problema.asientos).toEqual([disputada]);

  await expect(
    segunda.getByRole("button", { name: nombreButaca(disputada, "ocupada") }),
  ).toBeVisible();
  await expect(
    segunda.getByText(`Alguien tomó la ${disputada.fila}${disputada.numero} antes que vos.`),
  ).toBeVisible();
  await expect(segunda).toHaveURL(`/funciones/${funcion.funcionId}`);
  await segunda.close();
});

test("película sin funciones: marca en la cartelera y sin sucursales", async ({
  page,
  request,
}) => {
  const sucursales = await obtener<unknown[]>(
    request,
    `/api/funciones/peliculas/${SEMBRADO.secretoDeSusOjos}/sucursales-hoy`,
  );
  expect(sucursales).toEqual([]);

  await page.goto("/");
  const tarjeta = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "El secreto de sus ojos (demo)" }),
  });
  await expect(tarjeta.first()).toContainText("Sin funciones hoy");

  await page.goto(`/peliculas/${SEMBRADO.secretoDeSusOjos}`);
  await expect(page.getByText("Hoy no hay funciones de esta película.")).toBeVisible();
  await expect(page.locator('main a[href^="/funciones/"]')).toHaveCount(0);
});

test("imagen nula: carátula tipográfica en lugar del póster", async ({ page, request }) => {
  const peliculas = await obtener<{ id: string; titulo: string; imagenUrl: string | null }[]>(
    request,
    "/api/catalogo/peliculas",
  );
  // El seeder actual les pone póster a todas; una base sembrada antes puede tener alguna sin él.
  const sinPoster = peliculas.find((p) => p.imagenUrl === null);
  test.skip(!sinPoster, "Ninguna película de la base tiene imagenUrl null.");
  expect(peliculas.find((p) => p.id === SEMBRADO.dune)?.imagenUrl).toBeTruthy();

  await page.goto(`/peliculas/${sinPoster!.id}`);
  await expect(page.getByRole("heading", { level: 1, name: sinPoster!.titulo })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);

  await page.goto(`/peliculas/${SEMBRADO.dune}`);
  await expect(page.locator("main img").first()).toBeVisible();
});

test("validación: el servidor rechaza el email y más de 10 butacas", async ({ page, request }) => {
  const asientos = await elegirLibres(request, funcion.funcionId, "H", 11);
  await page.goto(`/funciones/${funcion.funcionId}`);
  const { id, token } = await confirmarCarrito(page, [asientos[0]]);

  // `a@b.c.` pasa la validación del cliente; la API lo rechaza y el mensaje va junto al campo.
  const campo = page.getByRole("textbox", { name: "Email para recibir las entradas" });
  await campo.fill("a@b.c.");
  const pedido = page.waitForResponse((r) => r.url().endsWith("/email-entrega"));
  await page.getByRole("button", { name: "Guardar email" }).click();
  const respuesta = await pedido;
  expect(respuesta.status()).toBe(400);
  expect(((await respuesta.json()) as { codigo: string }).codigo).toBe("pedido-invalido");
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(`#${await campo.getAttribute("aria-describedby")}`)).toHaveText(
    "El email es inválido.",
  );

  // El selector frena en 10; la API, por su lado, rechaza 11 con el error en `asientos`.
  await page.getByRole("link", { name: "Cambiar butacas" }).click();
  for (const asiento of asientos.slice(1)) {
    await page
      .getByRole("button", { name: new RegExp(`^Fila ${asiento.fila}, butaca ${asiento.numero},`) })
      .click();
  }
  await expect(page.getByText("Llegaste al máximo de 10 butacas por compra.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar 10 butacas" })).toBeVisible();

  const once = await request.put(`${API_URL}/api/carritos/${id}/asientos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { asientos },
  });
  expect(once.status()).toBe(400);
  const problema = (await once.json()) as { codigo: string; errors: Record<string, string[]> };
  expect(problema.codigo).toBe("pedido-invalido");
  expect(problema.errors.asientos).toBeDefined();
});

test("expiración: a los 5 minutos el carrito vence y no admite cambios", async ({
  page,
  request,
}) => {
  test.setTimeout(8 * 60_000);
  const asientos = await elegirLibres(request, funcion.funcionId, "G", 1);
  await page.goto(`/funciones/${funcion.funcionId}`);
  const { id, token } = await confirmarCarrito(page, asientos);
  const { venceEn } = await carritoEnApi(request, id, token);

  await expect(page.getByRole("heading", { level: 1, name: "Se terminó el tiempo" })).toBeVisible({
    timeout: Date.parse(venceEn) - Date.now() + 30_000,
  });

  const cambio = await request.put(`${API_URL}/api/carritos/${id}/asientos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { asientos },
  });
  expect(cambio.status()).toBe(409);
  const problema = (await cambio.json()) as { codigo: string; estadoActual?: string };
  expect(problema.codigo).toBe("carrito-no-activo");
  expect(problema.estadoActual).toBe("Expirado");
  expect((await carritoEnApi(request, id, token)).estado).toBe("Expirado");
  expect(await estaLibre(request, funcion.funcionId, asientos[0])).toBe(true);
});
