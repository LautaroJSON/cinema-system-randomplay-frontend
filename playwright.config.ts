import { defineConfig, devices } from "@playwright/test";

const API_URL = "http://127.0.0.1:4010";
const SITE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: SITE_URL },
  projects: [
    {
      name: "sin-js",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "con-js",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } },
    },
  ],
  // Sin reutilizar servidores: uno abierto con otros datos (por ejemplo, el catálogo generado)
  // daría fallos confusos. Si los puertos 3000 o 4010 están ocupados, Playwright lo avisa.
  webServer: [
    {
      // Los e2e verifican datos concretos: siempre con los fixtures, no con el catálogo generado.
      command: "node scripts/mock-api.mjs",
      env: { MOCK_DATOS: "fixtures" },
      url: `${API_URL}/api/catalogo/peliculas`,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npm start",
      url: SITE_URL,
      timeout: 240_000,
      reuseExistingServer: false,
      // Los e2e piden siempre al mock de la API, aunque .env.local active el catálogo local.
      env: { API_URL, SITE_URL, API_MOCK: "0" },
    },
  ],
});
