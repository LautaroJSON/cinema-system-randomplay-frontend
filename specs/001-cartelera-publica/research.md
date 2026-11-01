# Research: Base del frontend y cartelera pública

Decisiones técnicas de la Fase 0. Versiones verificadas en npm el 2026-11-01.

## R1. Versión de Next.js, React y Node

- **Decisión**: Next.js 16.4.x (App Router, Turbopack por defecto), React 19.x, Node.js 24 LTS.
- **Rationale**: la constitución fija Next.js + App Router. 16.4.3 es la estable vigente; Node 24
  es el LTS instalado y cumple `engines` de Next (≥ 20.9) y de Vitest 5 (^22.12 || ^24).
- **Alternativas**: Next 15 (sin motivo para empezar en una versión mayor anterior).

## R2. Versión de TypeScript

- **Decisión**: TypeScript **6.0.x**, modo `strict`.
- **Rationale**: `latest` es 7.0.2, pero `typescript-eslint` 8.72 declara
  `typescript >=4.8.4 <6.1.0`. Con TS 7 no correría el lint con información de tipos (puerta de
  CI 2). MSW 3 pide ≥ 5.9, compatible.
- **Alternativas**: TS 7 (se reevalúa cuando `typescript-eslint` lo soporte).
- **Nota de implementación**: `openapi-typescript` 7.13 declara `typescript ^5.x` como peer. Se
  fuerza a usar TS 6.0 con `overrides` en `package.json`; genera `schema.d.ts` sin cambios. Es
  solo una herramienta de generación, no llega al bundle.

## R3. Modelo de caché y frescura por ruta (Principio IX, FR-044)

- **Decisión**: ISR clásico con configuración de segmento, **sin** `cacheComponents`:
  - `/` → `export const revalidate = 600`.
  - `/peliculas/[id]` → `export const revalidate = 60` (la ficha contiene los horarios; la
    página se revalida al ritmo del dato más volátil).
  - `sitemap.xml` → `revalidate = 600`.
  - Cada `fetch` del cliente de API declara su `next.revalidate` (600 catálogo/detalle, 60
    horarios) y `next.tags` por recurso para poder invalidar más adelante.
  - `generateStaticParams` devuelve `[]` en la ficha: las fichas se generan al primer pedido y
    quedan en caché (ISR on-demand), así el build no recorre todo el catálogo.
- **Rationale**: es literalmente lo que pide el Principio IX ("ISR / `revalidate`"), es el modelo
  más conocido y no requiere mezclar `"use cache"` con segmentos.
- **Límite conocido**: la regeneración la dispara una visita (stale-while-revalidate). Tras un
  período sin tráfico, la primera visita recibe la versión vieja, que puede traer horarios de
  ayer o ya comenzados. Se cubre con R16.
- **Alternativas**: Cache Components (`"use cache"` + `cacheLife`) de Next 16: válido, pero
  incompatible con `revalidate` de segmento y más nuevo; no aporta nada para tres rutas. Render
  por request en la ficha: descartado, pierde el beneficio de caché del catálogo/detalle para el
  LCP (SC-004).

## R4. Fallos del backend con ISR

- **Decisión**: el cliente de API **lanza** ante error de red o 5xx; el 404 se traduce a
  `null` y la página llama a `notFound()`. Los errores lanzados llegan a `app/error.tsx`
  (componente de cliente con botón "Reintentar" que llama a `reset()` + `router.refresh()`).
  En la ficha, el bloque de horarios captura su propio error y muestra un aviso recuperable
  dentro de la página (FR-033), mientras la sinopsis se renderiza igual.
- **Rationale**: Next no reemplaza una página en caché por una regeneración fallida (sirve la
  anterior), así que lanzar evita cachear una página de error durante 10 minutos. En la ficha,
  el fallo de horarios queda cacheado como máximo 60 s, aceptable.
- **Alternativas**: devolver una página de error con `200` (rompe el Principio IX y cachea el
  error).

## R5. El build necesita datos

- **Decisión**: `next build` prerenderiza `/` y `sitemap.xml`, que piden el catálogo. En CI y en
  local sin backend se levanta un **mock de la API** (`scripts/mock-api.mjs`, `node:http`, sin
  dependencias) que sirve los fixtures de `tests/fixtures/`. En despliegue, el backend debe ser
  accesible desde el entorno de build (se documenta en el quickstart).
- **Rationale**: mantiene `/` como página estática con ISR sin trucos, y el mismo mock sirve a
  los tests e2e y a la validación manual.
- **Alternativas**: forzar render dinámico en `/` (viola el Principio IX); `@mswjs/http-middleware`
  (dependencia extra para algo que resuelven 40 líneas de `node:http`). Confirmada por el usuario en `/speckit-clarify` (2026-11-01).

## R6. Cliente de API y tipos (Principio I)

- **Decisión**: `openapi-typescript` 7.x genera `src/api/schema.d.ts` desde `docs/openapi.json`
  (script `gen:api`; CI regenera y falla si hay diff). El cliente es un módulo propio y chico
  (`src/api/client.ts`) sobre `fetch`, tipado con `paths` del esquema generado.
- **Rationale**: `openapi-fetch` construye un `Request` y descarta la opción `next` de `fetch`,
  que es la que declara la revalidación. Un wrapper propio de ~50 líneas evita la dependencia y
  conserva `next.revalidate`/`next.tags`. Prioridad de plataforma (Restricciones).
- **Alcance**: aplica a **todo el proyecto**, incluido el carrito (elegido por el usuario en
  `/speckit-clarify`, 2026-11-01). Para compensar que las rutas no se verifican solas, cada
  función toma su tipo de respuesta del esquema generado
  (`paths[ruta]['get']['responses'][200]['content']['application/json']`), así un cambio de forma
  en `openapi.json` rompe la compilación.
- **Alternativas**: `openapi-fetch` con `fetch` custom (funciona, pero agrega una dependencia y
  una capa para cuatro endpoints GET); propio ahora y reevaluar en el carrito (descartada:
  se prefiere un único estilo).

## R7. Números que llegan como `integer | string`

- **Decisión**: el contrato tipa `duracionMinutos` y los enteros como `integer | string` (patrón
  numérico de .NET). Se normalizan a `number` **en el borde** (mapeo en `src/api/`), con
  validación: si no es entero positivo, la duración se omite en la vista.
- **Rationale**: los componentes reciben modelos limpios; la rareza del contrato queda en un lugar.

## R8. Fechas, horas y dinero (Principio V, FR-007)

- **Decisión**:
  - Hora: `Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })`, un único formateador en
    `src/domain/formato.ts`. El `Date` se construye desde el ISO con offset.
  - Dinero: `Intl.NumberFormat('es-AR', { style: 'currency', currency })` pasando `monto` como
    **string** (Intl.NumberFormat v3, soportado en Node 24 y navegadores actuales), sin
    `Number()`.
  - Duración: "118 min" y, para JSON-LD, ISO 8601 `PT118M`.
- **Rationale**: zona y formato explícitos y únicos; el string decimal evita pérdida de precisión.

## R9. Estilos, tipografía y tema (DESIGN.md)

- **Decisión**: CSS Modules + `src/app/globals.css` con los tokens de DESIGN.md como custom
  properties en `:root` (tema oscuro único). Fuentes con `next/font/google`: Archivo con
  `axes: ['wdth']` y Martian Mono, `display: 'swap'`, expuestas como variables CSS. Corte en
  diagonal con `clip-path`, sombra dura con `box-shadow` sin blur, trama halftone con un patrón
  estático de puntos. Movimiento solo en hover/focus/active y anulado bajo
  `prefers-reduced-motion`.
- **Rationale**: sin dependencias de estilo; `next/font` autoaloja las fuentes (sin requests de
  terceros que bloqueen, ayuda a LCP/CLS).
- **Alternativas**: Tailwind (dependencia y capa extra para un sistema de tokens chico ya definido).

## R10. Íconos

- **Decisión**: no se agrega librería de íconos en esta funcionalidad; las vistas públicas no los
  necesitan (las etiquetas son texto). Si aparecen, Lucide con `stroke-linecap: square`
  (DESIGN.md §9), justificado en el PR.

## R11. Metadata, Open Graph y datos estructurados (FR-041, FR-042)

- **Decisión**:
  - `metadataBase` desde `SITE_URL` en `app/layout.tsx`; plantilla de título
    `%s · RandomPlay`.
  - `/`: `metadata` estática; `/peliculas/[id]`: `generateMetadata` con título de la película y
    descripción recortada de la sinopsis (≤ 160 caracteres, corte en palabra).
  - `alternates.canonical`, `openGraph` (`type: 'website'` / `'video.movie'`, `locale: 'es_AR'`)
    y `twitter: { card: 'summary' }`.
  - JSON-LD `Movie` (name, description, duration, contentRating, url) y un `ScreeningEvent`
    por horario (startDate, location `MovieTheater` con el nombre de la sucursal, offers con
    price y priceCurrency, url a la función). Se serializa escapando `<` para evitar cerrar el
    `<script>`.
  - `generateMetadata` y la página comparten la misma llamada al detalle (Next deduplica el
    `fetch` idéntico dentro del mismo render; se envuelve igual con `React.cache`).
- **Alternativas**: imagen OG generada (`opengraph-image.tsx`) con la carátula tipográfica:
  queda fuera; requiere cargar archivos de fuente en el runtime de imagen y no lo pide la spec.

## R12. Validación del id en la URL

- **Decisión**: la ficha valida que `id` sea un GUID antes de llamar a la API; si no lo es,
  `notFound()`.
- **Rationale**: un id mal formado debe dar 404, no 500 (edge case de la spec), y ahorra un
  pedido al backend.

## R13. Proxy del mismo origen

- **Decisión**: `next.config.ts` declara `rewrites` de `/api/:path*` a `${API_URL}/api/:path*`
  desde ahora. Las páginas públicas no lo usan (piden al backend desde el servidor), pero es la
  base que necesita el flujo de compra.

## R14. Testing (Principio VII)

- **Decisión**: Vitest 5 + Testing Library + MSW 3 para unitarios y componentes; Playwright 1.64
  + `@axe-core/playwright` para e2e con JavaScript desactivado (verifica la puerta de CI 5 y
  SC-002/SC-005). Ver la tabla "Qué se testea" en `plan.md`.
- **Rationale**: los componentes de servidor asíncronos no se renderizan bien en Testing
  Library; la lógica se extrae a funciones puras testeables y la página completa se verifica
  con e2e contra el mock de la API.

## R15. Lint y formato

- **Decisión**: ESLint 9 (flat config) con `eslint-config-next` 16 (core-web-vitals +
  typescript) y `eslint-plugin-jsx-a11y` en `recommended`; Prettier. En Next 16 `next lint` ya
  no existe: se corre `eslint .` directo.

## R16. Horarios vencidos en una versión en caché (FR-034, SC-007)

- **Decisión**: isla de cliente `HorariosVigentes` que envuelve la tira de horarios renderizada en
  el servidor. Recibe los `horaInicio` (ISO con offset), compara con `Date.now()` al montar y en
  un intervalo de 30 s, y oculta los horarios ya comenzados. Si no queda ninguno y el servidor
  había enviado al menos uno, muestra "Actualizando horarios…" (región `aria-live` de cortesía) y
  llama a `router.refresh()` una sola vez tras 2 s, dando tiempo a que termine la regeneración
  que disparó esa misma visita. Si después del refresh siguen sin quedar vigentes, muestra
  "Hoy no hay más funciones". Sin JavaScript, se ve la lista del HTML inicial.
- **Rationale**: conserva un render cacheado para todos y protege justo el caso del primer
  visitante tras horas sin tráfico (incluido el cambio de día: los horarios de ayer ya pasaron
  todos). El contenido sigue en el HTML inicial (Principio IX); el cliente solo oculta.
- **Alternativas**: horarios sin caché en cada visita (render por pedido, más carga al backend);
  aceptar el caso sin protección; cron externo que visite las fichas (depende del hosting y de
  mantener la lista). Elegida por el usuario en `/speckit-clarify` (2026-11-01).

## R17. 404 de rutas dinámicas en Next 16.4 (hallazgo de implementación)

- **Hallazgo**: con `notFound()` en una ruta dinámica (ficha inexistente o id mal formado), Next
  16.4.3 responde `404` con `<meta name="robots" content="noindex">`, pero el cuerpo HTML es un
  shell de error (`<html id="__next_error__">`) y el texto de la página "no encontrada" lo dibuja
  el navegador con JavaScript. Pasa también con una página mínima y un layout vacío, así que es
  del framework. La documentación incluida en `node_modules/next/dist/docs` dice que la UI de
  not-found debería venir en la respuesta. Las rutas que no existen (`/cualquier-cosa`) sí traen
  el HTML completo.
- **Decisión**: se acepta. Lo que exige el Principio IX (status `404` real y fuera del índice) se
  cumple; el e2e verifica status y `noindex` sin JavaScript y el texto visible con JavaScript.
  Se reevalúa al actualizar Next. Alternativa descartada: un Proxy que valide el id antes del
  render (cubriría solo los ids mal formados; para los inexistentes habría que consultar la API
  en el Proxy, que la documentación desaconseja).
- **Sin `loading.tsx`**: una frontera de carga hace que la respuesta empiece a transmitirse con
  `200` y un `notFound()` posterior ya no podría devolver `404` (documentación de `loading.js`,
  "Status codes"). Las páginas públicas se sirven desde caché; el único estado de carga visible es
  "Actualizando horarios…" (R16).
