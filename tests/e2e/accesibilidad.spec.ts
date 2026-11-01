import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ID_CON_FUNCIONES, ID_TITULO_LARGO } from "../fixtures";

const rutas = [
  "/",
  `/peliculas/${ID_CON_FUNCIONES}`,
  `/peliculas/${ID_TITULO_LARGO}`,
  "/cualquier-cosa",
];
const anchos = [
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
];

test.describe("accesibilidad y mobile-first", () => {
  test.skip(
    ({ javaScriptEnabled }) => !javaScriptEnabled,
    "Se audita la página tal como la usa una persona",
  );

  for (const ruta of rutas) {
    for (const viewport of anchos) {
      test(`${ruta} a ${viewport.width} px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(ruta);
        await expect(page.locator("h1")).toBeVisible();

        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
        ).toEqual([]);

        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde).toBe(0);

        const niveles = await page
          .locator("h1, h2, h3, h4, h5, h6")
          .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
        expect(niveles.filter((n) => n === 1)).toHaveLength(1);
        niveles.forEach((nivel, i) => {
          if (i > 0) expect(nivel - (niveles[i - 1] ?? 1)).toBeLessThanOrEqual(1);
        });
      });
    }
  }

  test("el teclado llega al contenido con foco visible", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const saltar = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(saltar).toBeFocused();
    await expect(saltar).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#contenido")).toBeFocused();

    // Desde el contenido, el siguiente Tab llega a la primera tarjeta.
    await page.keyboard.press("Tab");
    const enlace = page.locator('article a[href^="/peliculas/"]').first();
    await expect(enlace).toBeFocused();
    const contorno = await enlace.evaluate((a) => {
      const tarjeta = a.closest("article");
      return tarjeta ? getComputedStyle(tarjeta).outlineWidth : "0px";
    });
    expect(contorno).toBe("2px");
  });

  test("los horarios cumplen el tamaño táctil", async ({ page }) => {
    await page.goto(`/peliculas/${ID_CON_FUNCIONES}`);
    const cajas = await page
      .locator('a[href^="/funciones/"]')
      .evaluateAll((as) =>
        as.map((a) => a.getBoundingClientRect()).map((r) => [r.width, r.height]),
      );
    expect(cajas.length).toBeGreaterThan(0);
    for (const [ancho, alto] of cajas) {
      expect(ancho).toBeGreaterThanOrEqual(44);
      expect(alto).toBeGreaterThanOrEqual(44);
    }
  });

  test("con movimiento reducido, nada se desplaza", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const tarjeta = page.locator("article").first();
    await tarjeta.hover();
    await expect(tarjeta).toHaveCSS("transform", "none");
  });
});
