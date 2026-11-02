import { defineConfig, devices } from "@playwright/test";

// E2E contra el backend real (docker compose del repo backend), sin mocks. No corre en CI:
// necesita la API levantada en API_REAL_URL con los datos de prueba sembrados.
const API_URL = process.env.API_REAL_URL ?? "http://localhost:8080";
const SITE_URL = "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e-api-real",
  // Un solo worker: las pruebas comparten butacas reales y el límite de 10 carritos por IP.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: SITE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 360, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm start -- -p 3100",
    url: SITE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { API_URL, SITE_URL, API_MOCK: "0" },
  },
});
