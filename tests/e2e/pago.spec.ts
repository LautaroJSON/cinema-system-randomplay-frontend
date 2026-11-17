import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { carritoCreado, ID_FUNCION_8X12 } from "../fixtures";

// Pago con la pasarela simulada del mock (scripts/mock-api.mjs) y PAGO_SIMULADO=1
// (playwright.config.ts). El mock agrega un sufijo por carrito al token: si se filtra, aparece
// esta base.
const TOKEN = carritoCreado.token;

/** Crea un carrito con la F8 y la F9, guarda el email y toca Pagar. */
async function pagarCarrito(page: Page) {
  await page.goto(`/funciones/${ID_FUNCION_8X12}`);
  await page.getByRole("button", { name: "Fila F, butaca 8, libre" }).click();
  await page.getByRole("button", { name: "Fila F, butaca 9, libre" }).click();
  await page.getByRole("button", { name: "Confirmar 2 butacas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
  const carritoId = new URL(page.url()).pathname.split("/")[2] ?? "";

  await page
    .getByRole("textbox", { name: "Email para recibir las entradas" })
    .fill("comprador@ejemplo.com");
  await page.getByRole("button", { name: "Guardar email" }).click();
  await expect(page.getByRole("region", { name: "Qué sigue" })).toBeVisible();

  await page.getByRole("button", { name: /^Pagar \$/ }).click();
  await expect(page).toHaveURL(`/carritos/${carritoId}/pago-simulado`);
  await expect(page.getByRole("heading", { level: 1, name: "Pago simulado" })).toBeVisible();
  return carritoId;
}

/** Registra todas las URLs y los mensajes de consola, para buscar el token al final. */
function vigilarToken(page: Page) {
  const rastros: string[] = [];
  page.on("console", (mensaje) => rastros.push(mensaje.text()));
  page.on("framenavigated", (frame) => rastros.push(frame.url()));
  return () => expect(rastros.filter((rastro) => rastro.includes(TOKEN))).toEqual([]);
}

async function auditar(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
}

async function sinDesborde(page: Page) {
  const entra = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(entra).toBe(true);
}

test.describe("pago del carrito", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "El carrito vive en la pestaña");

  test("aprobar el pago muestra las entradas, también al recargar el carrito", async ({ page }) => {
    const sinToken = vigilarToken(page);
    const carritoId = await pagarCarrito(page);

    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await expect(page).toHaveURL(`/carritos/${carritoId}/pago`);
    await expect(page.getByRole("heading", { level: 1, name: "¡Listo!" })).toBeVisible();
    const entradas = page.getByRole("listitem").filter({ hasText: "Código" });
    await expect(entradas).toHaveCount(2);
    await expect(entradas.first()).toContainText(/[A-Z0-9]{5}-[A-Z0-9]{5}/);
    await expect(page.getByText(/También te mandamos las entradas a/)).toContainText(
      "comprador@ejemplo.com",
    );

    await page.goto(`/carritos/${carritoId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Tu compra" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Código" })).toHaveCount(2);
    const guardado = await page.evaluate(() => sessionStorage.getItem("randomplay:carrito"));
    expect(guardado).not.toContain(TOKEN);
    sinToken();
  });

  test("rechazar deja el pago en curso y se puede volver a la página de pago", async ({ page }) => {
    const sinToken = vigilarToken(page);
    const carritoId = await pagarCarrito(page);

    await page.getByRole("button", { name: "Rechazar pago" }).click();
    await expect(page).toHaveURL(`/carritos/${carritoId}/pago`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago…" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Volver a la página de pago" }).click();
    await expect(page).toHaveURL(`/carritos/${carritoId}/pago-simulado`);
    sinToken();
  });

  test("pagar otro monto deja el carrito esperando el pago", async ({ page }) => {
    const carritoId = await pagarCarrito(page);
    const campo = page.getByRole("textbox", { name: "Monto a pagar" });
    await campo.fill("100.00");
    await page.getByRole("button", { name: "Pagar otro monto" }).click();

    await expect(page).toHaveURL(`/carritos/${carritoId}/pago`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago…" }),
    ).toBeVisible();
  });

  test("con el pago en curso no se cambian las butacas, el email ni se abandona", async ({
    page,
  }) => {
    const carritoId = await pagarCarrito(page);

    await page.goto(`/carritos/${carritoId}`);
    await expect(page.getByText(/Pago en curso\./)).toBeVisible();
    for (const nombre of ["Cambiar butacas", "Abandonar carrito"]) {
      await expect(page.getByRole("button", { name: nombre })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    await expect(page.getByRole("button", { name: "Cambiar email" })).toHaveCount(0);

    await page.goto(`/carritos/${carritoId}/butacas`);
    await expect(
      page.getByRole("heading", { level: 1, name: "No podés cambiar las butacas" }),
    ).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(0);
  });

  test("las páginas del pago no se indexan y no llevan datos del carrito", async ({ page }) => {
    const carritoId = await pagarCarrito(page);
    for (const ruta of [`/carritos/${carritoId}/pago`, `/carritos/${carritoId}/pago-simulado`]) {
      const respuesta = await page.request.get(ruta);
      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()["cache-control"]).toContain("no-store");
      const html = await respuesta.text();
      expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
      expect(html).not.toContain(TOKEN);
      expect(html).not.toContain("comprador@ejemplo.com");
    }
  });

  test("las pantallas del pago pasan axe y entran en 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const carritoId = await pagarCarrito(page);
    await auditar(page);
    await sinDesborde(page);

    await page.goto(`/carritos/${carritoId}`);
    await expect(page.getByText(/Pago en curso\./)).toBeVisible();
    await auditar(page);
    await sinDesborde(page);

    await page.goto(`/carritos/${carritoId}/pago`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Estamos confirmando tu pago…" }),
    ).toBeVisible();
    await auditar(page);
    await sinDesborde(page);

    await page.goto(`/carritos/${carritoId}/pago-simulado`);
    await page.getByRole("button", { name: "Aprobar pago" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "¡Listo!" })).toBeVisible();
    await auditar(page);
    await sinDesborde(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await auditar(page);
  });
});
