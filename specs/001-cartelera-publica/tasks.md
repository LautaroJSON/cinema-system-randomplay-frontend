---

description: "Tareas de implementación: base del frontend y cartelera pública"
---

# Tasks: Base del frontend y cartelera pública

**Input**: documentos de diseño en `specs/001-cartelera-publica/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: se incluyen solo los que fija la tabla "Qué se testea y qué no" de `plan.md` (Principio VII
de la constitución). Los componentes presentacionales, estilos y configuración no llevan test.

**Organization**: tareas agrupadas por historia de usuario. La base común de la historia 4
(marco, 404, error) es prerequisito de todas y vive en la Fase 2; la Fase 6 verifica la
accesibilidad y el mobile-first de todo lo construido.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de `spec.md` (US1, US2, US3, US4)
- Proyecto único en la raíz: `src/`, `tests/`, `scripts/`

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: inicializar el proyecto Next.js con las herramientas y versiones de `research.md`.

- [X] T001 Crear `package.json` en la raíz (sin usar plantillas de `create-next-app`) con `"type": "module"`, `"engines": { "node": ">=24" }`, dependencias `next@16.4`, `react@19`, `react-dom@19` y devDependencies `typescript@~6.0`, `@types/react`, `@types/react-dom`, `@types/node`, `openapi-typescript@7`; scripts: `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format` (`prettier --write .`), `test` (`vitest run`), `test:e2e` (`playwright test`), `gen:api` (`openapi-typescript docs/openapi.json -o src/api/schema.d.ts`), `mock:api` (`node scripts/mock-api.mjs`); correr `npm install` y agregar `.next/`, `node_modules/`, `.env.local`, `test-results/`, `playwright-report/` a `.gitignore`
- [X] T002 Crear `tsconfig.json` con `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "bundler"`, `jsx: "preserve"`, `resolveJsonModule: true`, plugin `next`, alias `"@/*": ["./src/*"]` e `include` de `src`, `tests`, `next-env.d.ts`, `*.config.ts`
- [X] T003 [P] Crear `eslint.config.mjs` (flat config, ESLint 9) con `eslint-config-next` (core-web-vitals + typescript), `eslint-plugin-jsx-a11y` en `recommended`, `@typescript-eslint/no-explicit-any: error` y `@typescript-eslint/ban-ts-comment` con `allow-with-description`; ignorar `src/api/schema.d.ts`, `.next/`, `playwright-report/`; instalar `eslint@9`, `eslint-config-next@16.4`, `eslint-plugin-jsx-a11y`
- [X] T004 [P] Crear `.prettierrc.json` (`printWidth: 100`, `singleQuote: false`) y `.prettierignore` (`src/api/schema.d.ts`, `.next/`, `docs/openapi.json`); instalar `prettier`
- [X] T005 [P] Crear `vitest.config.ts` con `@vitejs/plugin-react`, entorno `jsdom`, alias `@` → `src`, `setupFiles: ["tests/msw/setup.ts"]`, `include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx"]` y `env: { API_URL: "http://api.test", SITE_URL: "https://randomplay.test" }`; instalar `vitest@5`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw@3`
- [X] T006 [P] Crear `playwright.config.ts`: `webServer` con dos comandos (`node scripts/mock-api.mjs` en el puerto 4010 y `npm run build && npm start` en el 3000, con `API_URL=http://127.0.0.1:4010` y `SITE_URL=http://localhost:3000`), `testDir: "tests/e2e"`, proyectos `sin-js` (`javaScriptEnabled: false`, viewport 360×800) y `con-js` (viewport 360×800); instalar `@playwright/test@1.64` y `@axe-core/playwright`
- [X] T007 [P] Crear `.env.example` con `API_URL=http://127.0.0.1:4010` y `SITE_URL=http://localhost:3000`, con un comentario por variable (ver [contracts/routes.md](contracts/routes.md#variables-de-entorno)); ninguna con prefijo `NEXT_PUBLIC_`
- [X] T008 Crear `next.config.ts` con `poweredByHeader: false` y `rewrites()` de `/api/:path*` a `${process.env.API_URL}/api/:path*` (research R13); si `API_URL` falta, lanzar un error que diga qué variable configurar

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: contrato de la API, cliente único, formatos, fixtures, mock y el marco común (base de US4).

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Contrato, configuración y datos de prueba

- [X] T009 Generar `src/api/schema.d.ts` con `npm run gen:api` desde `docs/openapi.json` y versionarlo (no se edita a mano, Principio I)
- [X] T010 [P] Crear `src/config/entorno.ts` que lea `API_URL` y `SITE_URL` de `process.env`, valide que sean URLs absolutas sin barra final y exporte `entorno = { apiUrl, siteUrl }`; ante un valor faltante o inválido, lanzar un error con el nombre de la variable. Solo se importa desde código de servidor
- [X] T011 [P] Crear los fixtures JSON en `tests/fixtures/`: `peliculas.json` (lista de 5 películas con GUIDs fijos: una con funciones, una con `sinFuncionesDisponibles: true`, una con `clasificacion: "Mas21"` desconocida, una con título de más de 80 caracteres, una cuyos horarios fallan), `detalles.json` (detalle por id; una con `sinopsis: ""`), `sucursales.json` (por película: la principal con dos sucursales con horarios y una tercera sin horarios; la sin funciones con `[]`) y `horarios.json` (por película y sucursal, en orden desordenado, con `offsetMinutos` relativo a "ahora" en lugar de `horaInicio`, `salaNombre` y `precioEntrada` `{ "monto": "4500.00", "moneda": "ARS" }`). Ver [contracts/api-consumida.md](contracts/api-consumida.md#fixtures)
- [X] T012 Crear `tests/fixtures/index.ts` que importe los JSON, los exponga tipados con `satisfies` contra `components["schemas"]` de `src/api/schema.d.ts` y exporte `conHoraInicio(horarios, ahora)`, que convierte `offsetMinutos` en `horaInicio` ISO con offset `-03:00`; exportar las constantes de ids (`ID_CON_FUNCIONES`, `ID_SIN_FUNCIONES`, `ID_CLASIF_DESCONOCIDA`, `ID_TITULO_LARGO`, `ID_HORARIOS_FALLAN`, `ID_SIN_SINOPSIS`)
- [X] T013 Crear `scripts/mock-api.mjs` con `node:http` (sin dependencias) en `MOCK_PORT` (default 4010) que sirva los 4 endpoints de [contracts/api-consumida.md](contracts/api-consumida.md) desde `tests/fixtures/*.json`: calcula `horaInicio` desde `offsetMinutos` con la hora actual en `-03:00`, responde `404` `application/problem+json` (sin `codigo`) para ids inexistentes, `500` en `horarios-hoy` para `ID_HORARIOS_FALLAN`, y `500` en todo si `MOCK_FALLAR=todo`; loguea método, ruta y status
- [X] T014 [P] Crear `tests/msw/handlers.ts` (handlers MSW de los 4 endpoints sobre `http://api.test` usando `tests/fixtures/index.ts` con una hora fija `2026-11-01T12:00:00-03:00`) y `tests/msw/setup.ts` (importa `@testing-library/jest-dom/vitest`, crea el `setupServer` con `onUnhandledRequest: "error"` y lo inicia, resetea y cierra en los hooks de Vitest)

### Tests de la base (escribirlos antes de implementar; deben fallar)

- [X] T015 [P] Test del cliente en `tests/unit/api/client.test.ts` con MSW: `200` devuelve el JSON; `404` devuelve `null`; `500` lanza `ApiError` con `status: 500`; un `problem+json` con `codigo` lo expone en `ApiError.codigo`; error de red lanza `ApiError` sin `status`; un servidor que no responde en 5 s lanza `ApiError` (usar `AbortSignal` con timers simulados)
- [X] T016 [P] Test de `tests/unit/domain/clasificacion.test.ts`: `ATP`, `Mas13`, `Mas16`, `Mas18` dan etiqueta y descripción de [data-model.md](data-model.md#clasificacion) con `conocida: true`; `"Mas21"` da etiqueta `"Mas21"`, descripción `"Clasificación: Mas21"` y `conocida: false`
- [X] T017 [P] Test de `tests/unit/domain/formato.test.ts`: `formatearHora("2026-11-01T21:30:00-03:00")` es `"21:30"`; `formatearHora("2026-11-02T00:30:00Z")` es `"21:30"` (conversión a la zona de Argentina); `formatearPrecio({ monto: "4500.00", moneda: "ARS" })` da el formato `es-AR` con símbolo de peso; `formatearPrecio({ monto: "12345678901234.10", moneda: "ARS" })` conserva todos los dígitos; `formatearDuracion(118)` es `"118 min"`; `duracionIso(118)` es `"PT118M"`; `normalizarEntero("118")` es `118` y `normalizarEntero("-3")`, `"abc"`, `0` dan `null`

### Implementación de la base

- [X] T018 Implementar `src/api/client.ts`: clase `ApiError extends Error { status?: number; codigo?: string }` y `pedir<T>(ruta: string, opciones: { revalidate: number; tags: string[] }): Promise<T | null>`, que hace `fetch(entorno.apiUrl + ruta, { headers: { Accept: "application/json" }, next: { revalidate, tags }, signal: AbortSignal.timeout(5000) })`; `200` → JSON tipado; `404` → `null`; otro status → `ApiError` con `codigo` si el cuerpo es `problem+json`; error de red o timeout → `ApiError` sin `status`. No loguea cuerpos ni headers (research R4, R6). Debe pasar T015
- [X] T019 [P] Implementar `src/domain/clasificacion.ts` con `traducirClasificacion(codigo: string): Clasificacion` según [data-model.md](data-model.md#clasificacion); único lugar del proyecto con estas etiquetas. Debe pasar T016
- [X] T020 [P] Implementar `src/domain/formato.ts` con `formatearHora` (`Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })`, instancia única), `formatearPrecio` (pasa `monto` como string a `Intl.NumberFormat("es-AR", { style: "currency", currency })`, nunca `Number()`), `formatearDuracion`, `duracionIso` y `normalizarEntero(valor: number | string): number | null` (research R7, R8). Debe pasar T017
- [X] T021 Crear `src/app/globals.css` con los tokens de DESIGN.md §4 como custom properties en `:root` (`--ink`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--paper`, `--paper-muted`, `--telon`, `--telon-ink`, `--oro`, `--oro-ink`), `color-scheme: dark`, `body { background: var(--ink); color: var(--paper) }`, reset mínimo, escala tipográfica de DESIGN.md §5 como variables (`--fs-display` 40→72 px con `clamp`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-label`, `--fs-counter`), foco `:focus-visible { outline: 2px solid var(--oro); outline-offset: 2px }`, utilidades `.corte-diagonal` (`clip-path` con esquina superior derecha a 45°), `.sombra-dura` (`4px 4px 0 var(--ink)` + borde `var(--line)`), `.halftone` (patrón estático de puntos monocromo), `.visualmente-oculto`, transiciones de 120–160 ms `ease-out` y un bloque `@media (prefers-reduced-motion: reduce)` que anula `transform` y transiciones de movimiento (FR-002, FR-053)
- [X] T022 Implementar `src/app/layout.tsx`: `<html lang="es">`, fuentes con `next/font/google` (`Archivo` con `axes: ["wdth"]` y `Martian_Mono`, `subsets: ["latin"]`, `display: "swap"`, expuestas como `--font-archivo` y `--font-mono`), `metadata` con `metadataBase: new URL(entorno.siteUrl)`, `title: { template: "%s · RandomPlay", default: "RandomPlay" }`, `openGraph: { siteName: "RandomPlay", locale: "es_AR" }`, `twitter: { card: "summary" }`; cuerpo con enlace "Saltar al contenido" (primer elemento enfocable, `href="#contenido"`), `<Encabezado />`, `<main id="contenido">{children}</main>` y `<Pie />`; importa `globals.css`
- [X] T023 [P] Crear `src/components/Encabezado/Encabezado.tsx` y `Encabezado.module.css`: `<header>` con la marca "RANDOMPLAY" (Archivo 800, `wdth` 70) como `next/link` a `/` (no es `h1`) y `<nav aria-label="Principal">` con el enlace "Cartelera"; objetivos táctiles ≥ 24 px; sin `"use client"`
- [X] T024 [P] Crear `src/components/Pie/Pie.tsx` y `Pie.module.css`: `<footer>` con "RandomPlay" y un enlace a la cartelera; texto en `--paper-muted`
- [X] T025 [P] Crear `src/components/EtiquetaPegada/EtiquetaPegada.tsx` y `EtiquetaPegada.module.css`: chip de papel con `children`, prop `inclinacion` (entre −1.5 y 1.5 grados, default 0), borde recto, radio 2 px, tipografía `label` (Martian Mono 500, mayúsculas); prop opcional `titulo` para el `title`/nombre accesible (DESIGN.md §6.2)
- [X] T026 [P] Crear `src/components/EstadoVacio/EstadoVacio.tsx` y `EstadoVacio.module.css`: props `titulo`, `nivel` (`"h1" | "h2" | "h3"`), `mensaje` y `enlace?: { href, texto }` con `next/link`; fondo `--surface` con `.halftone`
- [X] T027 [P] Crear `src/components/BotonReintentar/BotonReintentar.tsx` con `"use client"`: `<button type="button">` "Reintentar" (botón secundario de DESIGN.md §7) que llama a `onReintentar?.()` y luego `router.refresh()` de `next/navigation`
- [X] T028 Crear `src/app/not-found.tsx`: `metadata = { title: "No encontrada", robots: { index: false } }` y `<EstadoVacio nivel="h1" titulo="Esta cinta no está en el estante." mensaje="Puede que la hayan sacado de cartel o que el enlace esté mal." enlace={{ href: "/", texto: "Ver la cartelera" }} />` (FR-003)
- [X] T029 Crear `src/app/error.tsx` con `"use client"`: recibe `{ error, reset }`, muestra `h1` "No pudimos cargar esta página", el texto "Puede ser un problema de conexión o del servidor. Probá de nuevo en unos segundos.", `<BotonReintentar onReintentar={reset} />` y un enlace a `/`; no muestra `error.message` ni lo envía a ningún lado (FR-004)

**Checkpoint**: `npm run typecheck`, `npm run lint` y `npm test` pasan; `npm run dev` con el mock muestra el marco y el 404 en cualquier ruta.

---

## Phase 3: User Story 1 - Ver qué hay en cartelera (Priority: P1) 🎯 MVP

**Goal**: la home lista las películas activas como estante, con destacada, estado vacío y error recuperable, y todo su contenido en el HTML inicial.

**Independent Test**: con el mock, `curl -s localhost:3000/` contiene los 5 títulos de los fixtures, su duración, su clasificación, la marca "Sin funciones hoy" en la que corresponde, `<title>`, `meta description`, canónica y `lang="es"`; cada tarjeta enlaza a `/peliculas/{id}`.

### Tests for User Story 1

- [X] T030 [P] [US1] Test de `tests/unit/domain/destacada.test.ts`: devuelve la primera con `tieneFuncionesHoy` y el resto en el orden original sin ella; si ninguna tiene funciones, `destacada` es `null` y el resto es la lista completa; lista vacía da `{ destacada: null, resto: [] }`
- [X] T031 [P] [US1] Test de `tests/unit/api/catalogo.test.ts` con MSW: `listarPeliculas()` mapea a `PeliculaResumen` (`duracionMinutos` de string a number, `tieneFuncionesHoy` invertido, `codigoCinta` con formato `RP-XXXX`, clasificación traducida)
- [X] T032 [P] [US1] Test e2e `tests/e2e/catalogo.spec.ts` (proyecto `sin-js`): `GET /` responde 200; hay un único `h1` "En cartelera"; aparecen los 5 títulos de los fixtures, cada uno dentro de un `article` con un enlace a `/peliculas/{id}`; la película sin funciones muestra "Sin funciones hoy"; la de clasificación desconocida muestra "Mas21"; `<title>` es "RandomPlay · En cartelera hoy"; existen `meta[name=description]`, `link[rel=canonical][href="http://localhost:3000/"]` y `meta[property="og:locale"][content="es_AR"]`

### Implementation for User Story 1

- [X] T033 [US1] Implementar `listarPeliculas()` en `src/api/catalogo.ts`: `pedir` a `/api/catalogo/peliculas` con `revalidate: 600` y `tags: ["catalogo"]`, tipo de respuesta tomado de `paths["/api/catalogo/peliculas"]["get"]["responses"][200]["content"]["application/json"]`, mapeo a `PeliculaResumen` según [data-model.md](data-model.md#pelicularesumen) (exportar el tipo y la función `mapearResumen`); `null` se trata como lista vacía. Debe pasar T031
- [X] T034 [P] [US1] Implementar `src/domain/destacada.ts` con `elegirDestacada(peliculas)` → `{ destacada, resto }`. Debe pasar T030
- [X] T035 [P] [US1] Crear `src/components/Caratula/Caratula.tsx` y `Caratula.module.css`: carátula tipográfica con `aria-hidden="true"` (la información ya está en el texto de la tarjeta): título en display condensado (Archivo 800, `wdth` 70, mayúsculas) sobre `--surface` con `.halftone` y el código de cinta en `label` (`RP-XXXX · 118 MIN · +13`, omitiendo la duración si es `null`); variantes `estante` y `destacada`; `aspect-ratio` fijo para no generar CLS (DESIGN.md §9, FR-022)
- [X] T036 [US1] Crear `src/components/TarjetaPelicula/TarjetaPelicula.tsx` y `TarjetaPelicula.module.css`: `<article>` con lomo de cinta (franja izquierda con título en `label`, horizontal en móvil y rotada 90° desde 768 px), `<Caratula>`, título en `h3` con un único `next/link` a `/peliculas/{id}` que cubre la tarjeta (pseudo-elemento), duración, `EtiquetaPegada` de clasificación (con `titulo` = descripción accesible) y, si no tiene funciones hoy, `EtiquetaPegada` "Sin funciones hoy" (máximo dos etiquetas); sombra dura; títulos largos con `overflow-wrap: anywhere`; prop `destacada` para la variante de ancho completo con título en `display`
- [X] T037 [US1] Implementar `src/app/page.tsx` y `src/app/page.module.css`: `export const revalidate = 600`; `metadata` con `title: { absolute: "RandomPlay · En cartelera hoy" }`, descripción fija ("Películas en cartelera en RandomPlay y sus horarios de hoy en cada sucursal."), `alternates.canonical: "/"` y `openGraph.type: "website"`; obtiene `listarPeliculas()` y `elegirDestacada`; renderiza `h1` "En cartelera", la destacada en una sección con `h2` visualmente oculto "Destacada de hoy" y `TarjetaPelicula destacada`, y la grilla con `h2` "Todas las películas" (lista `ul` de 1 columna en 360 px, 2 desde 600 px, 4 desde 1024 px en grilla de 12 columnas, gutter 16 px); catálogo vacío → `EstadoVacio nivel="h2"` "El estante está vacío" / "Hoy no hay películas en cartelera. Volvé más tarde."; los errores de `ApiError` se dejan propagar a `error.tsx` (FR-010 a FR-013). Debe pasar T032

**Checkpoint**: la home funciona sola con el mock y pasa T030–T032.

---

## Phase 4: User Story 2 - Leer la ficha de una película (Priority: P2)

**Goal**: ficha indexable en `/peliculas/{id}` con título, sinopsis, duración y clasificación; 404 real; metadata, JSON-LD `Movie`, sitemap y robots.

**Independent Test**: `curl -s localhost:3000/peliculas/{ID_CON_FUNCIONES}` contiene `h1` con el título, la sinopsis, duración, clasificación, canónica, `og:type` `video.movie` y JSON-LD `Movie`; `/peliculas/no-es-guid`, un GUID inexistente y `/cualquier-cosa` responden 404.

### Tests for User Story 2

- [X] T038 [P] [US2] Test de `tests/unit/domain/descripcion.test.ts`: `recortarDescripcion` devuelve el texto tal cual si tiene ≤ 160 caracteres; si es más largo corta en el último espacio antes de 160 y agrega "…"; colapsa espacios y saltos de línea; una palabra de 200 caracteres se corta en 159 + "…"; `descripcionFicha(pelicula)` usa la sinopsis y, si es `null`, el texto alternativo de [contracts/routes.md](contracts/routes.md#metadata-por-ruta)
- [X] T039 [P] [US2] Test de `tests/unit/domain/jsonld.test.ts` (parte `Movie`): `construirJsonLd(pelicula, [], siteUrl)` devuelve un arreglo con un `Movie` con `name`, `description`, `duration: "PT118M"`, `contentRating` (etiqueta) y `url` canónica; omite `description` y `duration` cuando son `null`; `serializarJsonLd` reemplaza `<` por `<` (una sinopsis con `</script>` no cierra el script)
- [X] T040 [P] [US2] Test e2e `tests/e2e/ficha.spec.ts` (proyecto `sin-js`): `/peliculas/{ID_CON_FUNCIONES}` responde 200 con un único `h1` igual al título, `h2` "Sinopsis" seguido del texto, duración "118 min" y la clasificación; `<title>` "{titulo} · RandomPlay"; canónica `http://localhost:3000/peliculas/{id}`; `og:type` `video.movie`; el `script[type="application/ld+json"]` parsea y contiene `@type: "Movie"`; `/peliculas/{ID_SIN_SINOPSIS}` no tiene `h2` "Sinopsis"; `/peliculas/no-es-guid`, `/peliculas/00000000-0000-0000-0000-000000000000` y `/cualquier-cosa` responden **404** con el `h1` "Esta cinta no está en el estante." y `meta[name=robots]` con `noindex`; desde la home, el enlace de una tarjeta lleva a su ficha
- [X] T041 [P] [US2] Test e2e `tests/e2e/sitemap-robots.spec.ts`: `/sitemap.xml` contiene `http://localhost:3000/` y una URL `/peliculas/{id}` por cada película de los fixtures, y ninguna con `/funciones/`; `/robots.txt` contiene `Disallow: /funciones/`, `Disallow: /carritos/`, `Disallow: /api/` y `Sitemap: http://localhost:3000/sitemap.xml`

### Implementation for User Story 2

- [X] T042 [US2] Agregar a `src/api/catalogo.ts` `obtenerPelicula(id)` envuelta en `React.cache`: `pedir` a `/api/catalogo/peliculas/{id}` con `revalidate: 600` y `tags: [\`pelicula:${id}\`]`, mapeo a `PeliculaDetalle` (sinopsis vacía o solo espacios → `null`); `null` si la API responde 404
- [X] T043 [P] [US2] Implementar `src/domain/descripcion.ts` con `recortarDescripcion(texto, max = 160)` y `descripcionFicha(pelicula)`. Debe pasar T038
- [X] T044 [P] [US2] Implementar `src/domain/jsonld.ts` con `construirJsonLd(pelicula, grupos, siteUrl)` (por ahora solo `Movie`; `grupos` se usa en US3) y `serializarJsonLd(datos)` con escape de `<` (research R11, [contracts/routes.md](contracts/routes.md#datos-estructurados-peliculasid)). Debe pasar T039
- [X] T045 [US2] Implementar `src/app/peliculas/[id]/page.tsx` y `page.module.css`: `export const revalidate = 60`; `generateStaticParams` devuelve `[]`; `params` es una promesa (`const { id } = await params`); si `id` no cumple `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` o `obtenerPelicula` devuelve `null`, llamar a `notFound()`; `generateMetadata` con `title` = título, `description` = `descripcionFicha`, `alternates.canonical: \`/peliculas/${id}\``, `openGraph: { type: "video.movie", title, description, url }`; la página renderiza un bloque ficha (`Caratula variante="destacada"`, `h1` con el título en `display`, duración y `EtiquetaPegada` de clasificación, `h2` "Sinopsis" con el texto a 68 caracteres de ancho máximo si existe) y el `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(...) }} />`; enlace "Volver a la cartelera" (FR-020 a FR-022, FR-041, FR-042). Debe pasar T040
- [X] T046 [P] [US2] Implementar `src/app/sitemap.ts`: `export const revalidate = 600`; devuelve `{SITE_URL}/` (`changeFrequency: "daily"`, `priority: 1`) y una entrada `{SITE_URL}/peliculas/{id}` (`changeFrequency: "daily"`) por cada película de `listarPeliculas()` (FR-043)
- [X] T047 [P] [US2] Implementar `src/app/robots.ts` con `rules: { userAgent: "*", allow: "/", disallow: ["/funciones/", "/carritos/", "/api/"] }` y `sitemap: \`${entorno.siteUrl}/sitemap.xml\`` (FR-043). Debe pasar T041 junto con T046

**Checkpoint**: catálogo y ficha funcionan juntos; la ficha también se valida sola por URL directa.

---

## Phase 5: User Story 3 - Ver los horarios de hoy por sucursal (Priority: P3)

**Goal**: dentro de la ficha, bloques por sucursal con horarios de hoy ordenados (hora, sala, precio) como enlaces a `/funciones/{funcionId}`, con estados vacío y error, JSON-LD `ScreeningEvent` y ocultamiento en el navegador de horarios vencidos de una versión en caché.

**Independent Test**: con el mock, `/peliculas/{ID_CON_FUNCIONES}` sin JavaScript muestra un `h3` por cada una de las dos sucursales con horarios (la tercera, sin horarios, no aparece), horarios ascendentes con sala y precio, y cada uno es un `<a href="/funciones/{funcionId}">`; con el reloj del navegador adelantado a mañana, los horarios desaparecen y termina en "Hoy no hay más funciones".

### Tests for User Story 3

- [X] T048 [P] [US3] Test de `tests/unit/domain/horarios.test.ts`: `armarHorariosPorSucursal(peliculaId, { listarSucursalesHoy, listarHorariosHoy })` con dependencias inyectadas: ordena por instante de `horaInicio` (incluye horarios con offsets distintos), conserva el orden de sucursales de la API, omite sucursales sin horarios o con `null`, devuelve `{ tipo: "vacio" }` si no queda ninguna o si las sucursales son `null`, y `{ tipo: "error" }` si cualquier pedido lanza; `filtrarVigentes(grupos, ahora)` quita horarios con `horaInicio <= ahora` y sucursales que quedan vacías, y con `ahora` al día siguiente devuelve `[]`
- [X] T049 [P] [US3] Test de `tests/unit/api/funciones.test.ts` con MSW: `listarSucursalesHoy` y `listarHorariosHoy` mapean a `Sucursal` y `Horario` (conservando `horaInicio` original y `precio.monto` como string) y devuelven `null` ante 404
- [X] T050 [P] [US3] Test de componente `tests/components/TiraHorarios.test.tsx` con Testing Library por rol: renderiza un `heading` nivel 3 por sucursal; cada horario es un `link` con nombre accesible "21:30, Sala 2, $ 4.500,00" (formato real de `formatearPrecio`) y `href` `/funciones/{funcionId}`; contiene un `<time>` con `dateTime` igual al ISO original
- [X] T051 [P] [US3] Test de componente `tests/components/HorariosVigentes.test.tsx` con timers simulados (`vi.useFakeTimers`, `vi.setSystemTime`) y `vi.mock("next/navigation")` para `useRouter().refresh`: con horarios futuros los muestra todos; al avanzar el reloj 30 s después del inicio de uno, ese desaparece; si todos vencen, muestra "Actualizando horarios…" en una región `status`, llama a `refresh` una sola vez a los 2 s y, si después siguen sin vigentes, muestra "Hoy no hay más funciones" sin volver a llamar a `refresh`
- [X] T052 [P] [US3] Ampliar `tests/unit/domain/jsonld.test.ts`: con grupos, agrega un `ScreeningEvent` por horario con `name` "{titulo} en {sucursal}", `startDate` igual al ISO original, `location` `MovieTheater`, `workPresented` referenciando la `Movie`, `offers` con `price` = `monto` (string), `priceCurrency` y `url` `{siteUrl}/funciones/{funcionId}`, `eventStatus` y `eventAttendanceMode`
- [X] T053 [P] [US3] Test e2e `tests/e2e/horarios.spec.ts`: (`sin-js`) en `/peliculas/{ID_CON_FUNCIONES}` hay `h2` "Horarios de hoy", dos `h3` de sucursal en el orden de los fixtures, horarios ascendentes, la tercera sucursal ausente y enlaces a `/funciones/{funcionId}`; el JSON-LD incluye `ScreeningEvent`; en `/peliculas/{ID_SIN_FUNCIONES}` se ve "Hoy no hay funciones de esta película." y ningún `h3`; en `/peliculas/{ID_HORARIOS_FALLAN}` la sinopsis está visible y el bloque muestra "No pudimos cargar los horarios." con el botón "Reintentar"; (`con-js`) con `page.clock.setFixedTime` en el día siguiente antes de navegar, aparece "Actualizando horarios…" y luego "Hoy no hay más funciones" (quickstart escenario 12)

### Implementation for User Story 3

- [X] T054 [US3] Implementar `src/api/funciones.ts` con `listarSucursalesHoy(peliculaId)` y `listarHorariosHoy(peliculaId, sucursalId)`: `pedir` con `revalidate: 60`, `tags: [\`horarios:${peliculaId}\`]`, tipos de respuesta desde `paths`, mapeo a `Sucursal` y `Horario` de [data-model.md](data-model.md#horario). Debe pasar T049
- [X] T055 [US3] Implementar `src/domain/horarios.ts` con los tipos `HorariosPorSucursal` y `EstadoHorarios`, `armarHorariosPorSucursal(peliculaId, deps)` (sucursales y luego horarios de todas en paralelo con `Promise.all`) y `filtrarVigentes(grupos, ahora)` según [data-model.md](data-model.md#horariosporsucursal-agregado-de-la-ficha). Debe pasar T048
- [X] T056 [P] [US3] Crear `src/components/TiraHorarios/TiraHorarios.tsx` y `TiraHorarios.module.css` (sin hooks, usable desde servidor y cliente): por grupo, `<section>` con `h3` del nombre de la sucursal y una `ul` de horarios; cada uno es un `next/link` a `/funciones/{funcionId}` con `aria-label` "{hora}, {sala}, {precio}", hora en `counter` dentro de `<time dateTime={horaInicio}>`, sala en `label` y precio en `counter` con moneda; tira de contador horizontal con salto de línea en 360 px, objetivos ≥ 44 px de alto, foco dorado (DESIGN.md §6, §7). Debe pasar T050
- [X] T057 [US3] Crear `src/components/HorariosVigentes/HorariosVigentes.tsx` con `"use client"`: recibe `grupos` serializables y renderiza `<TiraHorarios grupos={filtrarVigentes(grupos, ahora)} />`; `ahora` se inicializa en un `useEffect` (en el render del servidor y la primera hidratación se muestran todos, para no desajustar el HTML) y se actualiza cada 30 s; si quedan 0 vigentes y había ≥ 1, muestra "Actualizando horarios…" en `<p role="status">` y llama a `router.refresh()` una sola vez a los 2 s (guardado en un `useRef`); si tras el refresh sigue en 0, muestra "Hoy no hay más funciones de esta película." (FR-034, research R16). Debe pasar T051
- [X] T058 [US3] Extender `construirJsonLd` en `src/domain/jsonld.ts` con los `ScreeningEvent` de `grupos`. Debe pasar T052
- [X] T059 [US3] Integrar los horarios en `src/app/peliculas/[id]/page.tsx` y `page.module.css`: obtener `armarHorariosPorSucursal(id, { listarSucursalesHoy, listarHorariosHoy })` en paralelo con el detalle; segundo bloque con `h2` "Horarios de hoy" y según el estado: `ok` → `<HorariosVigentes grupos={...} />`; `vacio` → "Hoy no hay funciones de esta película."; `error` → "No pudimos cargar los horarios." + `<BotonReintentar />`, sin ocultar la ficha (FR-030 a FR-034); pasar los grupos a `construirJsonLd`. Debe pasar T053

**Checkpoint**: las tres historias principales funcionan; `npm test` y `npm run test:e2e` pasan.

---

## Phase 6: User Story 4 - Navegar el sitio de forma consistente y accesible (Priority: P2)

**Goal**: verificar y asegurar WCAG 2.2 AA, teclado, jerarquía de encabezados y mobile-first desde 360 px en todas las páginas públicas (el marco común ya está en la Fase 2).

**Independent Test**: `tests/e2e/accesibilidad.spec.ts` pasa en 360 px y 1440 px.

### Tests for User Story 4

- [X] T060 [P] [US4] Test e2e `tests/e2e/accesibilidad.spec.ts` sobre `/`, `/peliculas/{ID_CON_FUNCIONES}`, `/peliculas/{ID_TITULO_LARGO}` y `/cualquier-cosa`, en viewports 360×800 y 1440×900: `AxeBuilder` con tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` sin violaciones; `document.documentElement.scrollWidth <= clientWidth`; exactamente un `h1` y niveles de encabezado sin saltos; el primer `Tab` enfoca "Saltar al contenido" y al activarlo el foco va a `#contenido`; recorrer con `Tab` hasta el enlace de una tarjeta y verificar con `getComputedStyle` un `outline` de 2 px visible; todo enlace de horario tiene una caja de al menos 24×24 px; con `reducedMotion: "reduce"`, ningún elemento interactivo tiene `transition` sobre `transform` (FR-050 a FR-053, SC-005, SC-006)

### Implementation for User Story 4

- [X] T061 [US4] Corregir cada violación que reporte T060 en el CSS Module o componente que la origina (`src/components/**`, `src/app/**/page.module.css`, `src/app/globals.css`) sin cambiar los tokens de DESIGN.md; si un contraste de DESIGN.md no alcanza, documentarlo en el PR en lugar de cambiar el token en silencio

**Checkpoint**: las cuatro historias pasan sus pruebas independientes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T062 [P] Crear `.github/workflows/ci.yml` con Node 24 y las puertas de la constitución en orden: `npm ci`; `npm run gen:api && git diff --exit-code src/api/schema.d.ts`; `npm run typecheck`; `npm run lint`; `npm test`; `npx playwright install --with-deps chromium` y `npm run test:e2e` (que levanta el mock y corre `build` + `start`, cubriendo la puerta 4 y la 5)
- [X] T063 [P] Crear `README.md` con qué es el proyecto, requisitos, puesta en marcha (enlazando a `specs/001-cartelera-publica/quickstart.md`), scripts, variables de entorno y la nota de despliegue: el build necesita llegar a `API_URL` y esta funcionalidad no se publica en producción sin la de selección de butacas
- [X] T064 Correr `npm run format` y revisar que no queden `any` explícitos, `@ts-ignore` sin justificación ni `fetch` contra la API fuera de `src/api/client.ts` (`grep -rn "fetch(" src | grep -v src/api/client.ts`)
- [X] T065 Ejecutar los 12 escenarios de `specs/001-cartelera-publica/quickstart.md` contra `npm start` con el mock (incluido Lighthouse en perfil móvil para SC-004: LCP ≤ 2,5 s, CLS ≤ 0,1) y anotar los resultados en la descripción del PR junto con los principios que toca la funcionalidad (I, II, V, VI, VII, VIII, IX)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T002 y T008 después de T001; T003–T007 en paralelo tras T001.
- **Foundational (Fase 2)**: depende de la Fase 1. T009 → T012 (tipos para `satisfies`); T011 → T012 → T013/T014; tests T015–T017 antes de T018–T020; T021 → T022; T023–T027 en paralelo; T028 depende de T026; T029 de T027.
- **US1 (Fase 3)**: depende de la Fase 2.
- **US2 (Fase 4)**: depende de la Fase 2. Usa `Caratula` y `EtiquetaPegada` de US1 (T035) y `listarPeliculas` (T033) para el sitemap; si se hace antes que US1, adelantar T033 y T035.
- **US3 (Fase 5)**: depende de US2 (los horarios viven en la ficha, T045).
- **US4 (Fase 6)**: depende de US1–US3 (verifica todas las páginas).
- **Polish (Fase 7)**: depende de todo lo anterior; T062 y T063 pueden adelantarse.

### User Story Dependencies

```text
Fase 1 → Fase 2 ─┬─ US1 (P1) ─┐
                 └─ US2 (P2) ─┴─ US3 (P3) ─ US4 (P2, verificación) ─ Polish
```

### Within Each User Story

- Los tests de la historia se escriben primero y deben fallar.
- `src/api/` → `src/domain/` → componentes → página.
- Cada tarea que cierra un test lo nombra ("Debe pasar T0xx").

### Parallel Opportunities

- Fase 1: T003, T004, T005, T006, T007.
- Fase 2: T010, T011 y T014 (tras T012); T015, T016, T017; T019 y T020; T023–T027.
- US1: T030, T031, T032; luego T034 y T035 en paralelo con T033.
- US2: T038–T041; luego T043, T044, T046, T047 en paralelo con T042.
- US3: T048–T053; T056 en paralelo con T054/T055.

---

## Parallel Example: User Story 3

```bash
# Tests de US3, todos juntos:
Task: "Test de horarios en tests/unit/domain/horarios.test.ts"
Task: "Test de funciones en tests/unit/api/funciones.test.ts"
Task: "Test de TiraHorarios en tests/components/TiraHorarios.test.tsx"
Task: "Test de HorariosVigentes en tests/components/HorariosVigentes.test.tsx"
Task: "JSON-LD ScreeningEvent en tests/unit/domain/jsonld.test.ts"
Task: "E2E de horarios en tests/e2e/horarios.spec.ts"

# Luego, en paralelo:
Task: "Implementar src/api/funciones.ts"
Task: "Crear src/components/TiraHorarios/TiraHorarios.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Fase 1 + Fase 2 (incluye el marco común, 404 y error).
2. Fase 3 (US1): la home con el catálogo.
3. **Parar y validar** con T030–T032 y el escenario 1 del quickstart.
4. Demo en local. **No se publica en producción**: el MVP público completo requiere US1–US3 más la funcionalidad de selección de butacas (decisión de `/speckit-clarify`).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → catálogo validado.
3. US2 → ficha, sitemap y robots validados.
4. US3 → horarios y vigencia validados.
5. US4 → accesibilidad y 360 px verificados en todo.
6. Polish → CI, README y quickstart completo.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Commit al cerrar cada tarea o grupo lógico; el PR describe qué principios toca (constitución, Flujo de Desarrollo).
- Copy visible en español rioplatense con voseo (FR-005); los textos exactos de estados están en las tareas.
- Para tareas de UI, aplicar la dirección de `DESIGN.md` y las skills de antislop según `CLAUDE.md`.
