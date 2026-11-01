import { expect, test } from "@playwright/test";
import { peliculas } from "../fixtures";

test.describe("sitemap y robots", () => {
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled, "Una sola pasada alcanza");

  test("el sitemap lista la home y todas las fichas activas", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toMatch(/<loc>http:\/\/localhost:3000\/?<\/loc>/);
    for (const { id } of peliculas) {
      expect(xml).toContain(`<loc>http://localhost:3000/peliculas/${id}</loc>`);
    }
    expect(xml).not.toContain("/funciones/");
  });

  test("robots excluye el flujo privado y apunta al sitemap", async ({ request }) => {
    const texto = await (await request.get("/robots.txt")).text();
    expect(texto).toContain("Disallow: /funciones/");
    expect(texto).toContain("Disallow: /carritos/");
    expect(texto).toContain("Disallow: /api/");
    expect(texto).toContain("Sitemap: http://localhost:3000/sitemap.xml");
  });
});
