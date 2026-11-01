# Implementation Plan: Mapa de butacas y retención de asientos

**Branch**: `003-mapa-butacas` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-mapa-butacas/spec.md`

## Summary

Reemplazar el 404 de `/funciones/{funcionId}` por la página de elección de butacas.

- **Página:** un Server Component dinámico y sin caché pide el mapa al backend, renderiza la
  cabecera y le pasa el mapa normalizado a la isla de cliente `SelectorButacas`.
- **Mapa:** la isla dibuja una grilla accesible con foco itinerante y maneja la selección (hasta
  10, total en centavos) con un reducer puro.
- **Confirmación:** primero abandona el carrito anterior de la pestaña si lo hay y después crea
  el carrito por el proxy del mismo origen. Cada `codigo` de error tiene su propio estado.
- **Carrito:** con el carrito creado, guarda credencial y snapshot en `sessionStorage` y navega
  a `/carritos/{carritoId}`. Esa pantalla provisoria lee la sesión de la pestaña sin llamar a
  la API.

No se agregan dependencias.

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`) sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 (App Router), React 19. Sin dependencias nuevas.

**Storage**: `sessionStorage` del navegador, clave `randomplay:carrito` (data-model.md). Sin
caché de datos de Next en estas rutas.

**Testing**: Vitest 5 + Testing Library + user-event + MSW 3 (lógica y componentes);
Playwright 1.64 + @axe-core/playwright contra `scripts/mock-api.mjs` ampliado (e2e con JS)

**Target Platform**: navegadores actuales, mobile-first desde 360 px; servidor Node para Next.js

**Project Type**: aplicación web (solo frontend; el backend es otro repositorio)

**Performance Goals**: SC-001 (de horario a butacas retenidas en menos de 60 s); INP ≤ 200 ms
al alternar butacas en la sala más grande (96 butacas); HTML inicial con cabecera y mapa, sin
estado de carga

**Constraints**:
- Disponibilidad sin caché, y sin actualización en vivo salvo después de un conflicto.
- El token solo en el cliente y en `sessionStorage`.
- WCAG 2.2 AA y butacas de 24 a 32 px.
- Sin scroll horizontal de la página desde 360 px.
- Timeouts de 5 s en el servidor, 8 s en el navegador y 3 s en el abandono previo.

**Scale/Scope**:
- 2 rutas nuevas (`/funciones/[funcionId]` y `/carritos/[carritoId]`).
- 3 endpoints consumidos.
- Salas de hasta 10 filas × 14 butacas en los datos sembrados.

No quedan puntos NEEDS CLARIFICATION. Las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Contrato OpenAPI | Tipos de `schema.d.ts` (sin cambios de contrato). Todo acceso pasa por `src/api/`: `client.ts` (servidor), `navegador.ts` (navegador), `problema.ts`, `asientos.ts` y `carritos.ts`. Ningún componente llama a `fetch`. La discrepancia de `ProblemDetails` se reporta al backend (B3). | ✅ |
| II. Errores por `codigo` | `leerProblema` normaliza `codigo` a una unión cerrada más `"desconocido"` y `"red"`. Cada `codigo` de la creación tiene un estado (B11). Los 404 y 410 del mapa se deciden por `status`. `pedido-invalido` va junto a la selección y `Retry-After` se respeta (B4). | ✅ |
| III. Token del carrito | Solo en `sessionStorage` (B9), nunca en URL, logs, errores ni props del servidor. Se envía como Bearer solo al abandono de su carrito. El abandono previo libera las butacas (FR-032). Todo lo que lo toca es `"use client"`. | ✅ |
| IV. La API decide | El 10 es un valor de experiencia en `config/experiencia.ts`. El total de la pantalla provisoria es el que devuelve la API. Tras un conflicto se refresca desde la API (B11). | ✅ |
| V. Formatos exactos | Total en centavos enteros desde el texto (B5). Fecha y hora con el formato único de `formato.ts`. Asientos como `{ fila, numero }` construidos desde `cantidadAsientos` y `asientosDisponibles`. | ✅ |
| VI. WCAG 2.2 AA y mobile-first | Grilla APG con foco itinerante, estado en el nombre accesible, `aria-disabled` en ocupadas, regiones `status` y `alert` (B7). Butacas de 24 a 32 px con letras fijas y desplazamiento contenido (B8). e2e con axe y 360 px. | ✅ |
| VII. Testing por criterio | Ver "Qué se testea" abajo. | ✅ |
| VIII. Calidad y bordes | Las páginas son Server Components. Solo `SelectorButacas`, `MapaButacas` y `CarritoCreado` son de cliente. Los componentes no tienen lógica: usan `domain/butacas.ts`, `domain/dinero.ts`, `domain/sesion-carrito.ts` y `src/api/`. Sin `NEXT_PUBLIC_`. | ✅ |
| IX. SEO | Ambas rutas son `noindex, nofollow`, quedan fuera del sitemap y ya están en el `Disallow` de robots. 404 real con `notFound()`. `h1` único. Enlaces con `next/link`. El 410 al cargar responde 200 con el estado explícito, porque el App Router no permite fijar 410 (B12). | ✅ (con nota B12) |
| Restricciones | El proxy `/api` ya existe. No se simula pago: la pantalla provisoria solo confirma que el carrito se creó. `API_MOCK=1` no se extiende. | ✅ |
| Puerta CI 5 | Aplica solo a páginas públicas. Estas son privadas, pero el e2e igual verifica `noindex` y la cabecera en el HTML inicial. | ✅ N/A |

**Re-check post-diseño**: sin violaciones. La nota de B12 no es una desviación de principio: el
Principio IX exige 404 reales para páginas inexistentes, y el 410 es un estado de una página
existente y no indexable.

### Qué se testea y qué no (Principio VII)

| Unidad | ¿Test? | Justificación |
|---|---|---|
| `src/domain/dinero.ts` (`aCentavos`, `multiplicar`, montos mal formados) | Sí | Cálculo de dinero: criterio explícito de la constitución y SC-004. |
| `src/domain/butacas.ts` (construir mapa, `alternar` con máximo efectivo, `marcarOcupadas`, `reemplazarMapa` con butacas que salen, filas inválidas, `listarAsientos`) | Sí | Lógica de selección y conflictos: un bug acá retiene o pierde butacas en silencio. |
| `src/api/problema.ts` (`codigo` conocido, desconocido y ausente; `asientos` y `errors` válidos e inválidos; `Retry-After` en segundos, fecha, ausente y absurdo) | Sí, con `Response` reales | Base de todo el manejo por `codigo`. Un parseo laxo rompe el Principio II. |
| `src/api/navegador.ts`, `asientos.ts`, `carritos.ts` (URL relativa, `no-store`, Bearer solo en abandono, timeout → `red`, mapeo 201) | Sí, MSW | Transporte del token y clasificación de fallos de red. |
| `src/api/client.ts` (`pedirSinCache`, 410 → `ApiError` con status) | Sí, ampliando el test existente | Decide entre 404 real, estado "ya empezó" y error. |
| `src/domain/sesion-carrito.ts` (guardar, leer con forma inválida, descartar, almacenamiento bloqueado) | Sí | Almacenamiento y descarte del token: criterio explícito. |
| `SelectorButacas` (los 6 `codigo` + desconocido + red; abandono previo antes de crear; doble envío; navegación al 201; cuenta de `Retry-After` con reloj simulado; aviso de máximo) | Sí, Testing Library + MSW por rol | Transiciones de estado ante cada `codigo`: el núcleo del riesgo de la spec. |
| `MapaButacas` (nombres accesibles, una parada de Tab, flechas con filas de distinto largo, Inicio/Fin, Enter/Espacio, ocupada no alterna) | Sí, Testing Library + user-event | Principio VI y US3. Un bug de teclado no se ve con el mouse. |
| `CarritoCreado` (sesión coincidente, sin sesión, otro id) | Sí, mínimo | Decide si se muestra un carrito ajeno o se avisa (FR-033). |
| `formatearFecha` en `formato.ts` | Sí, mínimo | Fecha en la zona de Argentina: criterio de la constitución. |
| Páginas, metadata `noindex`, 404, 360 px, axe, recorrido ficha → carrito, token fuera de URL y HTML | Sí, Playwright | Integración real de Server Components, CSS de desplazamiento y proxy. SC-002, SC-005, SC-006 y SC-007. |
| CSS Modules, `config/experiencia.ts`, fixtures, ampliación de `mock-api.mjs` | No | Estilos, configuración y herramientas de test: los cubren el e2e o el typecheck. |

## Project Structure

### Documentation (this feature)

```text
specs/003-mapa-butacas/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   ├── api-consumida.md
│   └── ui-mapa.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

Archivos nuevos (`+`) y modificados (`~`):

```text
src/
├── app/
│   ├── funciones/[funcionId]/
│   │   ├── page.tsx              + Server Component dinámico: mapa sin caché, cabecera, 404/410, metadata noindex
│   │   └── page.module.css       +
│   └── carritos/[carritoId]/
│       ├── page.tsx              + shell noindex con la isla CarritoCreado
│       └── page.module.css       +
├── api/
│   ├── client.ts                 ~ opción cache "no-store" (pedirSinCache); usa leerProblema
│   ├── problema.ts               + leerProblema, CodigoCarrito, Retry-After
│   ├── navegador.ts              + transporte del navegador: URL relativa, no-store, timeout, Bearer opcional
│   ├── asientos.ts               + mapearMapa, obtenerMapaDesdeNavegador (sin imports de servidor)
│   ├── asientos-servidor.ts      + obtenerMapa (servidor, sin caché)
│   └── carritos.ts               + crearCarrito, abandonarCarrito
├── domain/
│   ├── butacas.ts                + construirMapa, reducirSeleccion, etiquetas
│   ├── dinero.ts                 + aCentavos, desdeCentavos, multiplicar
│   ├── sesion-carrito.ts         + sessionStorage: disponible, leer, guardar, descartar
│   └── formato.ts                ~ formatearFecha
├── config/
│   └── experiencia.ts            + MAX_BUTACAS_POR_COMPRA (valor de experiencia)
└── components/
    ├── CabeceraFuncion/          + <dl> con película, sucursal, sala, fecha/hora y precio (servidor)
    ├── SelectorButacas/          + "use client": reducer, confirmación, estados de error, resumen
    ├── MapaButacas/              + "use client": grilla accesible, foco itinerante, CSS de tamaño y desplazamiento
    └── CarritoCreado/            + "use client": lee la sesión con useSyncExternalStore

tests/
├── fixtures/
│   ├── mapas.json                + una sala por cada sala sembrada (8×12, 6 filas de 8 a 14, 10×10)
│   ├── carritos.json             + CarritoCreadoResponse de ejemplo
│   ├── horarios.json             ~ funcionId alineados con mapas.json
│   └── index.ts                  ~ exports tipados nuevos
├── msw/handlers.ts               ~ handlers */api/funciones/:id/asientos, */carritos, */abandono
├── unit/api/                     + problema, navegador, asientos, carritos; ~ client
├── unit/domain/                  + butacas, dinero, sesion-carrito; ~ formato
├── components/                   + SelectorButacas, MapaButacas, CarritoCreado
└── e2e/
    ├── butacas.spec.ts           + recorrido, 360 px, noindex, 404, token fuera de URL y HTML
    └── accesibilidad.spec.ts     ~ axe en /funciones/{id} y /carritos/{id}

scripts/mock-api.mjs              ~ GET asientos (con id 410), POST carritos (201), POST abandono (200)
specs/001-cartelera-publica/contracts/routes.md   ~ fila /funciones/{funcionId} actualizada
```

**Structure Decision**: se mantiene el proyecto único con `src/` de la spec 001.
- `src/api/` sigue siendo el único módulo cliente, ahora con dos transportes (servidor y
  navegador) que comparten el parseo de problemas.
- La lógica pura va en `src/domain/` para testearla sin DOM.
- Solo tres componentes son de cliente: los dos que manejan estado o el token, y el mapa
  interactivo.
- Nombres en español, como el resto del código.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
