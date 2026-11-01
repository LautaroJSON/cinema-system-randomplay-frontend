# Quickstart: validar la cartelera pública

## Requisitos

- Node.js 24 LTS.
- Opcional: el backend `cinema-system-randomplay-backend` corriendo (por defecto en
  `http://localhost:5165`). Sin backend se usa el mock de la API.

## Puesta en marcha

```bash
npm install
npm run gen:api            # tipos desde docs/openapi.json
npm run mock:api           # mock en http://127.0.0.1:4010 (en otra terminal)
```

`.env.local`:

```text
API_URL=http://127.0.0.1:4010
SITE_URL=http://localhost:3000
```

Con el backend real, `API_URL=http://localhost:5165`.

## Puertas de calidad (las mismas de CI)

```bash
npm run gen:api && git diff --exit-code src/api/schema.d.ts   # tipos al día
npm run typecheck
npm run lint
npm test                                                     # Vitest
npm run build                                                # necesita API_URL accesible
npm run test:e2e                                             # Playwright contra build + mock
```

## Escenarios de validación

Ver rutas, metadata y estructura esperadas en [contracts/routes.md](contracts/routes.md) y
los fixtures en [contracts/api-consumida.md](contracts/api-consumida.md).

| # | Escenario | Cómo | Resultado esperado |
|---|---|---|---|
| 1 | Contenido en el HTML inicial (SC-002) | `curl -s localhost:3000/` y `curl -s localhost:3000/peliculas/{id}` | Títulos, sinopsis, duración, clasificación, sucursales y horarios presentes; `<title>`, `meta description`, `link rel=canonical` y `lang="es"`. |
| 2 | 404 reales (SC-003) | `curl -o /dev/null -w '%{http_code}' localhost:3000/peliculas/no-es-guid` y con un GUID inexistente y `/cualquier-cosa` | `404` en los tres. |
| 3 | Sin funciones hoy (US1-2, US3-3) | Abrir la película del fixture marcada sin funciones | Marca "sin funciones hoy" en el catálogo; aviso en la ficha, sin bloques de sucursal. |
| 4 | Horarios ordenados y agrupados (US3-1) | Abrir la película con dos sucursales | Un `h3` por sucursal, horarios ascendentes en hora de Argentina, sala y precio con moneda; la sucursal sin horarios no aparece. |
| 5 | Fallo de horarios (FR-033) | Mock con `MOCK_FALLAR=horarios` | Sinopsis visible; bloque de horarios con error y "Reintentar". |
| 6 | Backend caído (US1-4) | Detener el mock y pedir una ficha no cacheada | Página de error recuperable, sin pantalla rota. |
| 7 | Teclado y lector (SC-005) | Recorrer `/` → ficha → horario con Tab/Enter; e2e con axe | Foco visible en todo enlace; 0 violaciones A/AA. |
| 8 | 360 px (SC-006) | e2e con viewport 360 y 1440 | `scrollWidth <= clientWidth` en todas las páginas. |
| 9 | Sitemap y robots (SC-008) | `curl localhost:3000/sitemap.xml` y `/robots.txt` | Home + todas las fichas activas; `Disallow: /funciones/`. |
| 10 | JSON-LD | Copiar el bloque de la ficha al validador de schema.org | `Movie` y un `ScreeningEvent` por horario, sin errores. |
| 11 | Core Web Vitals (SC-004) | Lighthouse en perfil móvil sobre `npm start` | LCP ≤ 2,5 s, CLS ≤ 0,1, TBT bajo (INP se confirma en campo). |
| 12 | Versión vieja en caché (FR-034, SC-007) | e2e con el reloj del navegador adelantado a mañana sobre una ficha con horarios | Los horarios desaparecen, aparece "Actualizando horarios…", se recarga una sola vez y termina en "Hoy no hay más funciones". |

## Despliegue

El build prerenderiza `/` y `sitemap.xml`: el entorno de build tiene que llegar a `API_URL`.
Las fichas se generan al primer pedido y se revalidan cada 60 s.
