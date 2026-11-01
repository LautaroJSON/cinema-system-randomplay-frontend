import { expect, test } from "@playwright/test";
import { ID_CON_FUNCIONES, ID_SIN_SINOPSIS, detalles } from "../fixtures";

const detalle = detalles[ID_CON_FUNCIONES];

test.describe("ficha de película", () => {
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled, "Contenido en el HTML inicial");

  test("muestra la ficha completa en el HTML inicial", async ({ page }) => {
    const respuesta = await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);
    expect(respuesta?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(detalle.titulo);
    await expect(page.getByRole("heading", { level: 2, name: "Sinopsis" })).toBeVisible();
    await expect(page.getByText(detalle.sinopsis)).toBeVisible();
    await expect(page.getByText("118 min").first()).toBeVisible();
    await expect(page.getByText("Solo mayores de 13 años").first()).toBeAttached();
  });

  test("declara metadata, canónica y JSON-LD", async ({ page }) => {
    await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);
    await expect(page).toHaveTitle(`${detalle.titulo} · RandomPlay`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `http://localhost:3000/peliculas/${ID_CON_FUNCIONES}`,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "video.movie",
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "es_AR");

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    );
    expect(jsonLd.some((nodo: { "@type": string }) => nodo["@type"] === "Movie")).toBe(true);
  });

  test("omite la sinopsis cuando viene vacía", async ({ page }) => {
    await page.goto(`/peliculas/${ID_SIN_SINOPSIS}`);
    await expect(page.getByRole("heading", { level: 2, name: "Sinopsis" })).toHaveCount(0);
  });

  test("la tarjeta del catálogo lleva a la ficha", async ({ page }) => {
    await page.goto("/");
    await page.locator(`a[href="/peliculas/${ID_CON_FUNCIONES}"]`).first().click();
    await expect(page).toHaveURL(`/peliculas/${ID_CON_FUNCIONES}`);
    await expect(page.locator("h1")).toHaveText(detalle.titulo);
  });
});

// Next 16.4 sirve los 404 de rutas dinámicas con un shell de error que el navegador completa con
// JavaScript: sin JS se verifica el status y el noindex; con JS, el texto visible.
test.describe("404 real", () => {
  for (const ruta of [
    "/peliculas/no-es-guid",
    "/peliculas/00000000-0000-0000-0000-000000000000",
    "/cualquier-cosa",
  ]) {
    test(`responde 404 en ${ruta}`, async ({ page, javaScriptEnabled }) => {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status()).toBe(404);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
      if (javaScriptEnabled) {
        await expect(page.locator("h1")).toHaveText("Esta cinta no está en el estante.");
      }
    });
  }
});
