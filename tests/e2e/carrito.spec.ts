import { expect, test, type Page } from "@playwright/test";
import { carritoCreado, ID_FUNCION_8X12 } from "../fixtures";

// El mock agrega un sufijo por carrito: si el token aparece en algún lado, aparece esta base.
const TOKEN = carritoCreado.token;
const MIN = 60_000;

/** Elige la F8 y la F9 de la sala de 8 × 12, confirma y espera la pantalla del carrito. */
async function crearCarrito(page: Page) {
  await page.goto(`/funciones/${ID_FUNCION_8X12}`);
  await page.getByRole("button", { name: "Fila F, butaca 8, libre" }).click();
  await page.getByRole("button", { name: "Fila F, butaca 9, libre" }).click();
  await page.getByRole("button", { name: "Confirmar 2 butacas" }).click();
  await expect(page).toHaveURL(/\/carritos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
}

test.describe("pantalla del carrito", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "El carrito vive en la pestaña");

  test("muestra el carrito con su contador y no expone el token", async ({ page }) => {
    const consola: string[] = [];
    page.on("console", (mensaje) => consola.push(mensaje.text()));
    const urls: string[] = [];
    page.on("framenavigated", (frame) => urls.push(frame.url()));
    const pedidoCarrito = page.waitForRequest(
      (pedido) => /\/api\/carritos\/[0-9a-f-]{36}$/.test(pedido.url()) && pedido.method() === "GET",
    );

    await crearCarrito(page);
    const pedido = await pedidoCarrito;
    expect(pedido.headers().authorization).toMatch(/^Bearer /);

    await expect(page.getByText("Fila F, butaca 8")).toBeVisible();
    await expect(page.getByText("Fila F, butaca 9")).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText(/0[45]:\d\d/);

    const respuesta = await page.request.get(page.url());
    expect(respuesta.headers()["cache-control"]).toContain("no-store");
    const html = await respuesta.text();
    expect(html).not.toContain(TOKEN);
    expect(urls.some((url) => url.includes(TOKEN))).toBe(false);
    expect(consola.some((texto) => texto.includes(TOKEN))).toBe(false);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("el contador cambia a los 2 minutos y al vencer pasa a lectura", async ({ page }) => {
    await page.clock.install();
    await crearCarrito(page);

    await page.clock.runFor(3 * MIN + 1000);
    await expect(page.getByRole("timer")).toHaveAttribute("data-tramo", "final");

    await page.clock.runFor(2 * MIN);
    await expect(
      page.getByRole("heading", { level: 1, name: "Se terminó el tiempo" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Se terminó el tiempo" }),
    ).toBeVisible();
    const guardado = await page.evaluate(() => sessionStorage.getItem("randomplay:carrito"));
    expect(guardado).not.toContain(TOKEN);
  });

  test("guarda el email y explica qué sigue", async ({ page }) => {
    await crearCarrito(page);
    const campo = page.getByRole("textbox", { name: "Email para recibir las entradas" });
    const guardar = page.getByRole("button", { name: "Guardar email" });
    let pedidosEmail = 0;
    page.on("request", (pedido) => {
      if (pedido.url().endsWith("/email-entrega")) pedidosEmail++;
    });

    await campo.fill("nombre@");
    await guardar.click();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(pedidosEmail).toBe(0);

    await campo.fill("comprador@ejemplo.com");
    await guardar.click();
    const queSigue = page.getByRole("region", { name: "Qué sigue" });
    await expect(queSigue).toContainText("comprador@ejemplo.com");
    await expect(queSigue).toContainText("El pago todavía no está disponible");

    await page.reload();
    await expect(page.getByRole("region", { name: "Qué sigue" })).toContainText(
      "comprador@ejemplo.com",
    );
  });

  test("cambia las butacas enviando la selección completa, sin extender el vencimiento", async ({
    page,
  }) => {
    const vencimiento = () =>
      page.evaluate(
        () => JSON.parse(sessionStorage.getItem("randomplay:carrito") ?? "{}").carrito?.venceEn,
      );
    await crearCarrito(page);
    const antes = await vencimiento();

    await page.getByRole("link", { name: "Cambiar butacas" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cambiá tus butacas" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fila F, butaca 8, seleccionada" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fila F, butaca 9, seleccionada" }).click();
    await page.getByRole("button", { name: "Fila F, butaca 10, libre" }).click();

    const pedido = page.waitForRequest(
      (p) => p.method() === "PUT" && p.url().endsWith("/asientos"),
    );
    await page.getByRole("button", { name: "Guardar 2 butacas" }).click();
    expect((await pedido).postDataJSON()).toEqual({
      asientos: [
        { fila: "F", numero: 8 },
        { fila: "F", numero: 10 },
      ],
    });

    await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
    await expect(page.getByText("Fila F, butaca 10")).toBeVisible();
    await expect(page.getByText("Fila F, butaca 9")).toHaveCount(0);
    expect(await vencimiento()).toBe(antes);
  });

  test("recargar no abandona; abandonar libera el carrito", async ({ page }) => {
    await crearCarrito(page);
    let abandonos = 0;
    page.on("request", (pedido) => {
      if (pedido.method() === "POST" && pedido.url().endsWith("/abandono")) abandonos++;
    });

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
    expect(abandonos).toBe(0);

    await page.getByRole("button", { name: "Abandonar carrito" }).click();
    await page.getByRole("button", { name: "Sí, abandonar" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Abandonaste el carrito" }),
    ).toBeVisible();
    expect(abandonos).toBe(1);
    const guardado = await page.evaluate(() => sessionStorage.getItem("randomplay:carrito"));
    expect(guardado).not.toContain(TOKEN);
  });

  test("en otra pestaña no hay carrito activo", async ({ page, context }) => {
    await crearCarrito(page);
    const otra = await context.newPage();
    await otra.goto(page.url());
    await expect(
      otra.getByRole("heading", { level: 1, name: "No hay un carrito activo en esta pestaña" }),
    ).toBeVisible();
  });
});

test.describe("carrito en un teléfono de 360 px", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "Se mide la página como se usa");

  /** Sin scroll horizontal y con todos los controles (salvo las butacas) de 44 px o más de alto. */
  async function medir(page: Page) {
    const sinDesborde = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinDesborde).toBe(true);
    const altos = await page
      .locator("main button:not([role=gridcell] button), main a.boton-secundario, main input")
      .evaluateAll((controles) =>
        controles.map((c) => ({
          texto: c.textContent?.trim() ?? "",
          alto: c.getBoundingClientRect().height,
        })),
      );
    for (const { texto, alto } of altos) expect(alto, texto).toBeGreaterThanOrEqual(44);
  }

  test("el carrito y el cambio de butacas entran sin desbordar", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await crearCarrito(page);
    await medir(page);

    await page.getByRole("button", { name: "Abandonar carrito" }).click();
    await medir(page);
    await page.getByRole("button", { name: "Seguir con mi carrito" }).click();

    await page.getByRole("link", { name: "Cambiar butacas" }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    const sinDesborde = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinDesborde).toBe(true);
  });
});
