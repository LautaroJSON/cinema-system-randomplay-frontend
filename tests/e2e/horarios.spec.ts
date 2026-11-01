import { expect, test } from "@playwright/test";
import { ID_CON_FUNCIONES, ID_HORARIOS_FALLAN, ID_SIN_FUNCIONES } from "../fixtures";

test.describe("horarios de hoy en el HTML inicial", () => {
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled, "Contenido en el HTML inicial");

  test("agrupa por sucursal, ordena y enlaza a cada función", async ({ page }) => {
    await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);
    await expect(page.getByRole("heading", { level: 2, name: "Horarios de hoy" })).toBeVisible();

    const sucursales = page.getByRole("heading", { level: 3 });
    await expect(sucursales).toHaveText(["Sucursal Centro", "Sucursal Palermo"]);

    const centro = page.locator(`section[aria-labelledby^="sucursal-"]`, {
      has: page.getByRole("heading", { name: "Sucursal Centro" }),
    });
    const instantes = await centro
      .locator("time")
      .evaluateAll((nodos) =>
        nodos.map((n) => new Date(n.getAttribute("datetime") ?? "").getTime()),
      );
    expect(instantes).toHaveLength(3);
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));

    await expect(centro.getByRole("link").first()).toHaveAttribute(
      "href",
      /^\/funciones\/[0-9a-f-]{36}$/,
    );

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    );
    expect(jsonLd.filter((n: { "@type": string }) => n["@type"] === "ScreeningEvent")).toHaveLength(
      5,
    );
  });

  test("avisa cuando hoy no hay funciones", async ({ page }) => {
    await page.goto(`/peliculas/${ID_SIN_FUNCIONES}`);
    await expect(page.getByText("Hoy no hay funciones de esta película.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0);
  });

  test("un fallo en los horarios no oculta la ficha", async ({ page }) => {
    await page.goto(`/peliculas/${ID_HORARIOS_FALLAN}`);
    await expect(page.getByRole("heading", { level: 2, name: "Sinopsis" })).toBeVisible();
    await expect(page.getByText("No pudimos cargar los horarios.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});

test.describe("horarios vencidos en una versión en caché", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "Lo resuelve una isla de cliente");

  test("con el reloj en el día siguiente, oculta todo y termina sin funciones", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);

    const estado = page.getByRole("status");
    await expect(estado).toHaveText("Actualizando horarios…");
    await expect(page.locator('a[href^="/funciones/"]')).toHaveCount(0);

    await page.clock.runFor(2_000);
    await page.clock.runFor(8_000);
    await expect(estado).toHaveText("Hoy no hay más funciones de esta película.");
  });
});
