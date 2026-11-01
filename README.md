# RandomPlay: frontend del comprador

Sitio de compra de entradas de cine en Next.js (App Router), React y TypeScript. Consume la API de
`cinema-system-randomplay-backend`. Las reglas del proyecto están en
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) y la dirección visual en
[`DESIGN.md`](DESIGN.md).

Hoy incluye las páginas públicas e indexables: la cartelera (`/`) y la ficha de cada película con
sus horarios del día por sucursal (`/peliculas/{id}`).

## Requisitos

- Node.js 24 LTS.
- El backend corriendo, o el mock de la API incluido en el repositorio.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
npm run mock:api
```

En otra terminal:

```bash
npm run dev
```

Para usar el backend real, cambiá `API_URL` en `.env.local` (por ejemplo, `http://localhost:5165`).
La guía de validación completa está en
[`specs/001-cartelera-publica/quickstart.md`](specs/001-cartelera-publica/quickstart.md).

## Scripts

| Script                        | Qué hace                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                 | Servidor de desarrollo                                                          |
| `npm run build` / `npm start` | Build de producción y servidor                                                  |
| `npm run gen:api`             | Regenera `src/api/schema.d.ts` desde `docs/openapi.json` (no se edita a mano)   |
| `npm run typecheck`           | TypeScript en modo `strict`                                                     |
| `npm run lint`                | ESLint con reglas de Next.js y `jsx-a11y`                                       |
| `npm test`                    | Tests unitarios y de componentes (Vitest + MSW)                                 |
| `npm run test:e2e`            | Playwright: levanta el mock, hace el build y prueba con y sin JavaScript        |
| `npm run mock:api`            | Mock de la API en `http://127.0.0.1:4010` con los fixtures de `tests/fixtures/` |

## Variables de entorno

| Variable   | Uso                                                                   |
| ---------- | --------------------------------------------------------------------- |
| `API_URL`  | Base del backend. La usan los pedidos del servidor y el proxy `/api`. |
| `SITE_URL` | Origen público del sitio, para canónicas, sitemap, robots y JSON-LD.  |

Ninguna lleva el prefijo `NEXT_PUBLIC_`: no llegan al navegador.

## Despliegue

- El build genera la cartelera y el sitemap, así que el entorno de build tiene que llegar a
  `API_URL`. Las fichas se generan al primer pedido y se revalidan cada 60 segundos.
- Cada horario enlaza a `/funciones/{funcionId}`, la selección de butacas, que todavía no existe.
  Esta parte no se publica en producción hasta que esa página esté lista.
