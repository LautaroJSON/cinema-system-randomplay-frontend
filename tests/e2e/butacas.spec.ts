import { expect, test } from "@playwright/test";
import {
  carritoCreado,
  ID_CON_FUNCIONES,
  ID_FUNCION_8X12,
  ID_FUNCION_ANCHA,
  ID_FUNCION_COMENZADA,
  ID_FUNCION_INEXISTENTE,
} from "../fixtures";

const TOKEN = carritoCreado.token;

test.describe("página de la función en el HTML inicial", () => {
  test("cabecera, noindex y sin caché", async ({ page }) => {
    const respuesta = await page.goto(`/funciones/${ID_FUNCION_8X12}`);
    expect(respuesta?.status()).toBe(200);
    expect(respuesta?.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(page.getByRole("heading", { level: 1, name: "Elegí tus butacas" })).toBeVisible();
    await expect(page.getByText("La noche del videoclub").first()).toBeVisible();
    await expect(page.getByText("Sucursal Centro")).toBeVisible();
    await expect(page.getByText("Sala 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Butacas de Sala 1" })).toBeVisible();
  });

  test("404 real para una función inexistente o un id mal formado", async ({ page }) => {
    for (const ruta of ["/funciones/no-es-guid", `/funciones/${ID_FUNCION_INEXISTENTE}`]) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status()).toBe(404);
    }
  });

  test("avisa cuando la función ya empezó", async ({ page }) => {
    await page.goto(`/funciones/${ID_FUNCION_COMENZADA}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Esta función ya empezó" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
});

test.describe("de la ficha al carrito", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "La selección necesita JavaScript");

  test("elige dos butacas, confirma y llega al carrito sin exponer el token", async ({ page }) => {
    const consola: string[] = [];
    page.on("console", (mensaje) => consola.push(mensaje.text()));
    const urls: string[] = [];
    page.on("framenavigated", (frame) => urls.push(frame.url()));

    await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);
    await page.locator('a[href^="/funciones/"]').first().click();
    await expect(page).toHaveURL(/\/funciones\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Elegí tus butacas" })).toBeVisible();

    const libres = page.getByRole("button", { name: /, libre$/ });
    await libres.nth(0).click();
    await libres.nth(0).click();
    await page.getByRole("button", { name: "Confirmar 2 butacas" }).click();

    await expect(page).toHaveURL(/\/carritos\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Tu carrito quedó creado" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(2);

    const html = await (await page.request.get(page.url())).text();
    expect(html).not.toContain(TOKEN);
    expect(urls.some((url) => url.includes(TOKEN))).toBe(false);
    expect(consola.some((texto) => texto.includes(TOKEN))).toBe(false);
    const guardado = await page.evaluate(() => sessionStorage.getItem("randomplay:carrito"));
    expect(guardado).toContain(TOKEN);
  });

  test("sin la sesión en la pestaña, el carrito avisa que no hay uno activo", async ({ page }) => {
    await page.goto("/carritos/c4a7e2b1-3d5f-4c6e-9a8b-7f6e5d4c3b99");
    await expect(
      page.getByRole("heading", { level: 1, name: "No hay un carrito activo en esta pestaña" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
});

test.describe("mapa en pantallas chicas y con teclado", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "Se mide la página como se usa");

  test("a 360 px la sala ancha se desplaza dentro del mapa con las letras fijas", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/funciones/${ID_FUNCION_ANCHA}`);

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBe(0);

    const tamanos = await page
      .getByRole("button", { name: /^Fila [A-Z], butaca \d+/ })
      .evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).map((r) => [r.width, r.height]),
      );
    expect(tamanos).toHaveLength(70);
    for (const [ancho, alto] of tamanos) {
      expect(ancho).toBeGreaterThanOrEqual(24);
      expect(alto).toBeGreaterThanOrEqual(24);
    }

    const area = page.getByRole("grid").locator("xpath=ancestor::div[2]");
    const desplazable = await area.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(desplazable).toBe(true);
    await area.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(page.getByRole("rowheader", { name: "Fila E" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Fila E, butaca 14, libre" })).toBeInViewport();
  });

  test("en pantallas anchas las butacas miden 32 px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/funciones/${ID_FUNCION_ANCHA}`);
    const caja = await page.getByRole("button", { name: "Fila A, butaca 1, libre" }).boundingBox();
    expect(caja?.width).toBe(32);
    expect(caja?.height).toBe(32);
  });

  test("se elige una butaca solo con teclado", async ({ page }) => {
    await page.goto(`/funciones/${ID_FUNCION_8X12}`);
    await page.getByRole("link", { name: /^Volver a / }).focus();
    // Volver, mapa (una parada): el foco entra en la primera libre de la fila del medio.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Fila E, butaca 1, libre" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Fila E, butaca 3, seleccionada" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Confirmar 1 butaca" })).toBeFocused();
  });
});
