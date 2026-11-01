# Implementation Plan: Base del frontend y cartelera pública

**Branch**: `001-cartelera-publica` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-cartelera-publica/spec.md`

## Summary

Montar el proyecto Next.js desde cero (no hay código todavía) y entregar las tres vistas públicas:
catálogo en `/`, ficha con horarios del día por sucursal en `/peliculas/{id}`, y los 404 y
estados de error comunes. Todo el contenido se obtiene en Server Components con ISR (600 s el
catálogo, 60 s la ficha con horarios, más una isla de cliente que oculta los horarios vencidos de
una versión vieja), metadata por página, JSON-LD, sitemap y robots. La capa de
API se genera desde `docs/openapi.json` y se consume con un cliente propio sobre `fetch`. La
identidad visual sale de DESIGN.md con CSS Modules y tokens en custom properties, sin
dependencias de estilo.

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`) sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 (App Router), React 19; dev: openapi-typescript 7,
ESLint 9 + eslint-config-next 16 + eslint-plugin-jsx-a11y, Prettier

**Storage**: N/A (sin persistencia; caché de datos de Next para ISR)

**Testing**: Vitest 5 + Testing Library + MSW 3 (unitarios y componentes); Playwright 1.64 +
@axe-core/playwright (e2e con JavaScript desactivado)

**Target Platform**: navegadores actuales, mobile-first desde 360 px; servidor Node para
Next.js

**Project Type**: aplicación web (solo frontend; el backend es otro repositorio)

**Performance Goals**: Core Web Vitals "buenos" en perfil móvil (LCP ≤ 2,5 s, INP ≤ 200 ms,
CLS ≤ 0,1)

**Constraints**: contenido principal en el HTML inicial; ningún horario comenzado visible más de
60 s (ISR + isla `HorariosVigentes`, R16);
WCAG 2.2 AA; sin scroll horizontal desde 360 px; timeout de 5 s por pedido al backend

**Scale/Scope**: 3 rutas de página (`/`, `/peliculas/[id]`, 404) + sitemap y robots; 4
endpoints GET; catálogo de decenas de películas

No quedan puntos NEEDS CLARIFICATION: las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Contrato OpenAPI | Tipos generados en `src/api/schema.d.ts` con `openapi-typescript`; CI regenera y falla si hay diff; todo acceso pasa por `src/api/` (R6). | ✅ |
| II. Errores por `codigo` | Las consultas públicas no traen `codigo`: se decide por `status` (404 → `notFound()`, resto → `ApiError` → error recuperable). Sin decisiones por `title`/`detail`. | ✅ |
| III. Token del carrito | Fuera de alcance; las rutas `/funciones/` y `/carritos/` quedan con `Disallow` desde ya y la futura página se marca `noindex`. | ✅ N/A |
| IV. La API decide | "Hoy", los horarios no comenzados y la disponibilidad los decide la API; el frontend ordena, agrupa y solo oculta en el navegador los que vencieron después de cachear la página (R16), sin inventar horarios. | ✅ |
| V. Formatos exactos | Formateadores únicos de hora (zona de Argentina, 24 h) y dinero (`monto` como string a `Intl.NumberFormat`); clasificación traducida en un solo lugar con fallback para valores desconocidos (R8, data-model). | ✅ |
| VI. WCAG 2.2 AA y mobile-first | Tokens con contrastes verificados en DESIGN.md, foco dorado visible, objetivos ≥ 24 px, e2e con axe y viewport 360 (R14). | ✅ |
| VII. Testing por criterio | Ver "Qué se testea" abajo. | ✅ |
| VIII. Calidad y bordes | `strict`, ESLint con jsx-a11y, Server Components por defecto; solo `error.tsx`, el botón "Reintentar" y la isla `HorariosVigentes` son de cliente; sin `NEXT_PUBLIC_` (contracts/routes.md). | ✅ |
| IX. Páginas indexables | Datos en el servidor, ISR por ruta, `generateMetadata`, canónicas, OG, `lang="es"`, `h1` único, `next/link`, JSON-LD `Movie` + `ScreeningEvent`, sitemap/robots, `notFound()` real (R3, R11, contracts/routes.md). Sin pósters: no se usan imágenes todavía. | ✅ |
| Restricciones | Stack fijo; proxy `/api` por `rewrites` con URL por variable de entorno (R13); sin simular pago; dependencias nuevas justificadas en research. | ✅ |
| Puerta CI 5 | e2e con JavaScript desactivado verifica metadata y contenido en el HTML inicial. | ✅ |

**Re-check post-diseño**: sin cambios. El diseño no introduce violaciones, así que la tabla de
Complexity Tracking queda vacía.

### Qué se testea y qué no (Principio VII)

| Unidad | ¿Test? | Justificación |
|---|---|---|
| `src/api/client.ts` (404 → `null`, 5xx/red/timeout → `ApiError`, mapeo `integer \| string`) | Sí, Vitest + MSW | Un error mal clasificado cachea páginas rotas o da 200 en vez de 404: silencioso y caro. |
| `src/domain/formato.ts` (hora en zona de Argentina, dinero desde string, duración ISO) | Sí | Formateo de dinero y fechas: criterio explícito de la constitución. |
| `src/domain/clasificacion.ts` (valores conocidos y desconocido) | Sí | Enum con fallback; un valor nuevo no debe romper la página. |
| `src/domain/horarios.ts` (orden, omitir sucursal vacía, estado de error, `filtrarVigentes`) | Sí | Lógica de agrupación y de vigencia por hora con casos borde de la spec (cambio de día, todos vencidos). |
| `HorariosVigentes` (oculta vencidos, "Actualizando horarios…", un solo refresh) | Sí, Testing Library con reloj simulado | Comportamiento dependiente del tiempo: un bug deja visibles funciones ya empezadas o recarga en bucle. |
| `src/domain/destacada.ts` | Sí, mínimo | Regla de negocio de presentación con un caso borde (ninguna con funciones). |
| `src/domain/jsonld.ts` (forma y escape de `<`) | Sí | Un JSON-LD inválido o un `</script>` sin escapar falla en silencio para los buscadores. |
| `src/domain/descripcion.ts` (recorte ≤ 160 en palabra) | Sí, mínimo | Metadata visible en buscadores; casos de borde de longitud. |
| Componentes de presentación (tarjeta, carátula, etiqueta, tira de horarios) | Solo la tira de horarios, con Testing Library por rol | La tira expone el nombre accesible del enlace "{hora}, {sala}, {precio}"; el resto es presentacional sin lógica. |
| Páginas completas, metadata, 404, sitemap, robots, a11y, 360 px | Sí, Playwright con JS desactivado + axe | Puerta de CI 5 y SC-002/003/005/006/008; los Server Components asíncronos solo se verifican bien renderizados de verdad. |
| `globals.css`, tokens, fuentes, `next.config.ts`, `schema.d.ts` | No | Estilos, configuración y tipos generados: triviales o cubiertos por build/typecheck. |
| `scripts/mock-api.mjs` | No | Herramienta de test; si falla, fallan los e2e. |

## Project Structure

### Documentation (this feature)

```text
specs/001-cartelera-publica/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   └── api-consumida.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx            # <html lang="es">, fuentes, metadataBase, Encabezado/Pie
│   ├── globals.css           # tokens de DESIGN.md, reset, foco, reduced-motion
│   ├── page.tsx              # catálogo (revalidate 600)
│   ├── page.module.css
│   ├── not-found.tsx         # 404 de la marca, noindex
│   ├── error.tsx             # "use client": error recuperable con Reintentar
│   ├── peliculas/[id]/
│   │   ├── page.tsx          # ficha + horarios (revalidate 60, generateMetadata, JSON-LD)
│   │   └── page.module.css
│   ├── sitemap.ts
│   └── robots.ts
├── api/
│   ├── schema.d.ts           # generado, no se edita
│   ├── client.ts             # fetch + timeout + ApiError + next.revalidate/tags
│   ├── catalogo.ts           # listarPeliculas, obtenerPelicula (+ mapeo)
│   └── funciones.ts          # listarSucursalesHoy, listarHorariosHoy (+ mapeo)
├── domain/
│   ├── clasificacion.ts
│   ├── formato.ts
│   ├── horarios.ts
│   ├── destacada.ts
│   ├── descripcion.ts
│   └── jsonld.ts
├── components/
│   ├── Encabezado/  Pie/
│   ├── TarjetaPelicula/      # lomo de cinta
│   ├── Caratula/             # carátula tipográfica con halftone
│   ├── EtiquetaPegada/       # chips: clasificación, "Sin funciones hoy"
│   ├── TiraHorarios/         # bloque por sucursal con enlaces
│   ├── HorariosVigentes/     # "use client": oculta horarios vencidos y refresca una vez
│   ├── EstadoVacio/
│   └── BotonReintentar/      # "use client"
└── config/
    └── entorno.ts            # lee y valida API_URL y SITE_URL (solo servidor)

tests/
├── fixtures/                 # respuestas tipadas compartidas
├── msw/                      # handlers y setup de Vitest
├── unit/                     # api/ y domain/
├── components/               # TiraHorarios
└── e2e/                      # Playwright: SEO, 404, a11y, 360 px

scripts/
└── mock-api.mjs              # mock de la API sobre node:http con los fixtures
```

**Structure Decision**: proyecto único en la raíz del repositorio con `src/`. `src/api/` es el
módulo cliente único que exige el Principio I; `src/domain/` concentra la lógica pura testeable
para que los componentes solo rendericen (Principio VIII). Los nombres van en español, como el
dominio y la API.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
