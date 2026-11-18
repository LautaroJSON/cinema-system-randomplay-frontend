import { expect, test, type Page } from "@playwright/test";
import { ID_FUNCION_LENTA, ID_TITULO_LARGO } from "../fixtures";

// El mock demora 8 s el mapa de la función lenta: más que el corte viejo de 5 s del servidor
// (spec 006, US3) y más que el umbral de 5 s del aviso de demora (US2).
const ID_FUNCION_RAPIDA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b007";
const ESPERA_FUNCION_LENTA = 15_000;

const horario = (page: Page, funcionId: string) =>
  page.locator(`a[href="/funciones/${funcionId}"]`);
// "Cargando…" siempre está en el DOM (invisible): lo que cambia es `data-pendiente`.
const enCarga = (enlace: ReturnType<typeof horario>) => enlace.locator("[data-pendiente]");
const aviso = (page: Page) => page.getByText(/^Cargando las butacas de las /, { exact: false });

test.describe("aviso de carga al elegir un horario", () => {
  test.skip(({ javaScriptEnabled }) => !javaScriptEnabled, "El aviso necesita JavaScript");

  test.beforeEach(async ({ page }) => {
    await page.goto(`/peliculas/${ID_TITULO_LARGO}`);
    await expect(horario(page, ID_FUNCION_LENTA)).toBeVisible();
  });

  test("el horario tocado avisa al instante y la espera termina en la función", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    const lento = horario(page, ID_FUNCION_LENTA);
    const hora = await lento.locator("time").innerText();
    // Solo el tamaño: el clic hace scroll y la posición en la ventana cambia.
    const tamano = async () => {
      const caja = await lento.boundingBox();
      return caja && { width: caja.width, height: caja.height };
    };
    const antes = await tamano();

    await lento.click();

    await expect(enCarga(lento)).toBeVisible({ timeout: 500 });
    await expect(enCarga(lento)).toHaveText("Cargando…");
    await expect(
      page.getByText(`Cargando las butacas de las ${hora}, Sala 3…`).first(),
    ).toBeVisible({ timeout: 500 });
    expect(await tamano()).toEqual(antes);

    await expect(page).toHaveURL(new RegExp(`/funciones/${ID_FUNCION_LENTA}$`), {
      timeout: ESPERA_FUNCION_LENTA,
    });
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
  });

  test("con una función rápida se abre sin dejar el aviso", async ({ page }) => {
    await horario(page, ID_FUNCION_RAPIDA).click();
    await expect(page).toHaveURL(new RegExp(`/funciones/${ID_FUNCION_RAPIDA}$`));
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
  });

  test("tocar otro horario durante la carga abre el último", async ({ page }) => {
    await horario(page, ID_FUNCION_LENTA).click();
    await expect(enCarga(horario(page, ID_FUNCION_LENTA))).toBeVisible();

    await horario(page, ID_FUNCION_RAPIDA).click();
    await expect(page).toHaveURL(new RegExp(`/funciones/${ID_FUNCION_RAPIDA}$`));
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
  });

  test("a los 5 s suma la línea de demora", async ({ page }) => {
    test.setTimeout(30_000);
    const demora = page.getByText(
      "Esto puede tardar un poco más. No hace falta recargar la página.",
    );
    await horario(page, ID_FUNCION_LENTA).click();
    await expect(enCarga(horario(page, ID_FUNCION_LENTA))).toBeVisible();

    await page.waitForTimeout(3000);
    await expect(demora).toHaveCount(0);
    await expect(demora.first()).toBeVisible({ timeout: 3000 });

    await expect(page).toHaveURL(new RegExp(`/funciones/${ID_FUNCION_LENTA}$`), {
      timeout: ESPERA_FUNCION_LENTA,
    });
    await expect(demora).toHaveCount(0);
  });
});
