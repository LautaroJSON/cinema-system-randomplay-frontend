import { expect, test } from "@playwright/test";
import { ID_CLASIF_DESCONOCIDA, ID_SIN_FUNCIONES, peliculas } from "../fixtures";

test.describe("catálogo", () => {
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled, "Contenido en el HTML inicial");

  test("muestra el estante completo en el HTML inicial", async ({ page }) => {
    const respuesta = await page.goto("/");
    expect(respuesta?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("En cartelera");

    for (const pelicula of peliculas) {
      const tarjeta = page.locator("article", {
        has: page.locator(`a[href="/peliculas/${pelicula.id}"]`),
      });
      await expect(tarjeta).toHaveCount(1);
      await expect(tarjeta.getByRole("heading", { level: 3 })).toHaveText(pelicula.titulo);
    }

    const sinFunciones = page.locator("article", {
      has: page.locator(`a[href="/peliculas/${ID_SIN_FUNCIONES}"]`),
    });
    await expect(sinFunciones).toContainText("Sin funciones hoy");

    const desconocida = page.locator("article", {
      has: page.locator(`a[href="/peliculas/${ID_CLASIF_DESCONOCIDA}"]`),
    });
    await expect(desconocida).toContainText("Mas21");
  });

  test("declara la metadata de la home", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("RandomPlay · En cartelera hoy");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /cartelera/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^http:\/\/localhost:3000\/?$/,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "es_AR");
  });
});
