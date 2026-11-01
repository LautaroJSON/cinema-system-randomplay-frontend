# Implementation Plan: Carrito con retención corta

**Branch**: `004-carrito-retencion` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-carrito-retencion/spec.md`

## Summary

Reemplazar el destino provisorio `/carritos/{carritoId}` de la 003 por la pantalla real del
carrito, y agregar `/carritos/{carritoId}/butacas` para cambiar la selección.

- **Pantalla:** la página sigue siendo un Server Component mínimo y `noindex`. La isla
  `PantallaCarrito` lee la credencial de la pestaña, muestra enseguida el último carrito
  guardado y lo actualiza con `GET /api/carritos/{id}`. Sin credencial para ese id, avisa sin
  llamar a la API.
- **Cuenta regresiva:** se calcula desde `venceEn` y el desfase con la hora del servidor (header
  `Date`). Se recalcula desde el reloj en cada tic, cambia de color a los 2 minutos y avisa al
  lector de pantalla solo dos veces.
- **Email:** formulario con validación local de experiencia y errores de `pedido-invalido` junto
  al campo. Al guardarlo, un bloque "Qué sigue" explica que todavía no hay pago.
- **Cambio de butacas:** reutiliza el selector de la 003 con otra estrategia de confirmación.
  Las butacas propias aparecen seleccionadas y el `PUT` envía siempre la selección completa.
- **Abandono:** confirmación en el lugar. Nada se dispara al cerrar o recargar la pestaña.
- **Credencial:** la sesión pasa a la versión 2, con token opcional. Al abandonar o vencer se
  borra el token y se conserva el último carrito para el modo lectura. Ante `401` o
  `carrito-no-encontrado` se borra todo.

No se agregan dependencias.

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`) sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 (App Router), React 19. Sin dependencias nuevas.

**Storage**: `sessionStorage`, clave `randomplay:carrito` en versión 2 (data-model.md). Sin
caché de datos de Next en estas rutas.

**Testing**: Vitest 5 + Testing Library + user-event + MSW 3, con timers y `Date` simulados;
Playwright 1.64 + @axe-core/playwright + `page.clock` contra `scripts/mock-api.mjs` ampliado

**Target Platform**: navegadores actuales, mobile-first desde 360 px; servidor Node para Next.js

**Project Type**: aplicación web (solo frontend; el backend es otro repositorio)

**Performance Goals**: SC-001 (de llegar al carrito a guardar el email en menos de 60 s);
contador con error ≤ 1 s (SC-002); INP ≤ 200 ms en el formulario y el mapa

**Constraints**:
- El token solo en el cliente, en `sessionStorage`, y solo hacia las rutas de su carrito.
- Ningún pedido al cerrar o recargar la pestaña.
- Contador sin parpadeo ni anuncios por segundo.
- WCAG 2.2 AA, sin scroll horizontal desde 360 px.
- Timeout de 8 s en el navegador.

**Scale/Scope**:
- 1 ruta reemplazada (`/carritos/[carritoId]`) y 1 nueva (`/carritos/[carritoId]/butacas`).
- 4 endpoints con token y 1 público (mapa).
- 1 carrito por pestaña, hasta 10 butacas.

No quedan puntos NEEDS CLARIFICATION. Las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Contrato OpenAPI | Tipos de `schema.d.ts`, sin cambios de contrato. Todo acceso pasa por `src/api/` (`navegador.ts` suma PUT y la hora del servidor; `carritos.ts` suma tres operaciones). Ningún componente llama a `fetch`. La discrepancia de `ProblemDetails` (ahora también `estadoActual`) se reporta al backend. | ✅ |
| II. Errores por `codigo` | Cada `codigo` que pueden devolver las cuatro operaciones tiene su transición (research C10). `401`, que no trae `codigo`, se decide por `status` en un solo lugar (`credencialPerdida`). Desconocido y red → error genérico con "Reintentar". `pedido-invalido` va junto al campo o a la selección. | ✅ |
| III. Token del carrito | Solo en `sessionStorage` (C2). Se envía como Bearer solo a rutas armadas con el id guardado junto al token (C3). Nunca en URL, `history.state`, logs, errores ni props del servidor. Se descarta ante `401` y `carrito-no-encontrado`, y se borra al abandonar o vencer. La salida explícita llama a `abandono`. El intento al cerrar la pestaña **no** se hace (ver Complexity Tracking). | ✅ (con desviación documentada) |
| IV. La API decide | Contador desde `venceEn`. Al llegar a cero, se trata como expirado aunque la API diga `Activo`. El `PUT` envía la selección completa. Solo un carrito `Activo` se modifica. El total no se recalcula. Los 2 minutos del aviso y el máximo de 10 son valores de experiencia en `config/experiencia.ts`. La validación del email es ayuda. Tras un conflicto se refresca el mapa. | ✅ |
| V. Formatos exactos | Dinero mostrado como llega con `formatearPrecio`. Fecha y hora con `formato.ts`. `estado` traducido en un solo lugar (`etiquetaEstado`) con un valor desconocido explícito. Asientos `{ fila, numero }`. | ✅ |
| VI. WCAG 2.2 AA y mobile-first | `role="timer"` con texto completo oculto y región de cortesía con dos avisos (C5). El color del contador no es la única señal. Contrastes medidos (C6). Foco gestionado al cambiar de vista (C12). Formulario con `label`, `aria-invalid` y `aria-describedby`. Confirmación del abandono sin trampa de foco. e2e con axe y 360 px. | ✅ |
| VII. Testing por criterio | Ver "Qué se testea" abajo. | ✅ |
| VIII. Calidad y bordes | Las páginas son Server Components y no reciben datos del carrito. Solo `PantallaCarrito`, `CambioButacas`, `CuentaRegresiva` y los componentes de la 003 son de cliente. La lógica va en `domain/` (`carrito.ts`, `cuenta-regresiva.ts`, `email.ts`, `butacas.ts`, `sesion-carrito.ts`). El mapa del cambio se pide desde el navegador (ver Complexity Tracking). | ✅ (con nota) |
| IX. SEO | Las dos rutas son `noindex, nofollow`, quedan fuera del sitemap y del índice (`Disallow: /carritos/` ya existe). `h1` único por vista. Enlaces con `next/link`. Sin canónica ni Open Graph. | ✅ |
| Restricciones | El proxy `/api` ya existe. No se simula pago: el bloque "Qué sigue" dice que no hay pago ni entradas todavía (SC-009). | ✅ |
| Puerta CI 5 | Aplica solo a páginas públicas. El e2e igual verifica `noindex` y que el HTML no tenga datos del carrito. | ✅ N/A |

**Re-check post-diseño**: sin violaciones nuevas. Las dos notas están en Complexity Tracking.

### Qué se testea y qué no (Principio VII)

| Unidad | ¿Test? | Justificación |
|---|---|---|
| `src/domain/cuenta-regresiva.ts` (`medirDesfase`, `restanteMs`, `tramo`, `formatearContador`, `describirRestante`) | Sí | Cuenta regresiva y vencimiento: criterio explícito de la constitución y del pedido. |
| `src/domain/carrito.ts` (`etiquetaEstado`, `esModificable`, `credencialPerdida`, `reducirPantalla`, `resolverProblemaCarrito`) | Sí | Transiciones de estado del carrito y manejo de cada `codigo`. |
| `src/domain/sesion-carrito.ts` (versión 2, `actualizarCarrito`, `cerrarSesion`, versión 1 ignorada) | Sí, ampliando el test existente | Guardado y descarte del token: criterio explícito. |
| `src/domain/butacas.ts` (`marcarPropias`, `estadoInicial` con selección, `mismaSeleccion`) | Sí, ampliando | Selección completa en el `PUT`. Si `marcarPropias` falla, las butacas propias se ven ocupadas. |
| `src/domain/email.ts` (`validarEmail`) | Sí, mínimo | Evita enviar lo que la API va a rechazar. Bajo costo. |
| `src/api/navegador.ts`, `carritos.ts`, `problema.ts` (PUT, Bearer, `horaServidorMs`, `estadoActual`, ruta con el id de la sesión, mapeo de `Carrito`) | Sí, MSW | Transporte del token y datos del desfase. |
| `PantallaCarrito` (vistas, contador con reloj simulado, 2 avisos, cada `codigo` de GET, email y abandono, `401`, red con cinta, foco al cambiar de vista) | Sí, Testing Library + MSW por rol | El núcleo del riesgo de la spec. |
| `CambioButacas` (butacas propias seleccionadas, cuerpo completo del PUT, "Guardar" sin cambios, cada `codigo` del PUT, vencimiento durante el cambio) | Sí, Testing Library + MSW | Selección completa y conflictos. |
| `SelectorButacas` (refactor de la estrategia de confirmación; abandono previo solo con token) | Sí, los tests existentes deben seguir pasando + un caso de sesión cerrada | Evita romper la 003 al extraer la parte común. |
| `CuentaRegresiva` como componente aislado | No | Presentacional: lo cubren los tests de `PantallaCarrito` y los unitarios del dominio. |
| Páginas, `noindex`, recorrido completo, vencimiento con `page.clock`, token fuera de URL/HTML/consola, recarga sin abandono, 360 px, axe | Sí, Playwright | Integración real del proxy, la sesión y el reloj. SC-006, SC-007, SC-008. |
| CSS Modules, `.cinta-peligro`, `config/experiencia.ts`, fixtures, ampliación de `mock-api.mjs` | No | Estilos, configuración y herramientas de test. |

## Project Structure

### Documentation (this feature)

```text
specs/004-carrito-retencion/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   ├── api-consumida.md
│   └── ui-carrito.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

Archivos nuevos (`+`), modificados (`~`) y eliminados (`-`):

```text
src/
├── app/
│   ├── globals.css                   ~ .cinta-peligro
│   └── carritos/[carritoId]/
│       ├── page.tsx                  ~ usa PantallaCarrito en lugar de CarritoCreado
│       ├── page.module.css           ~
│       └── butacas/
│           ├── page.tsx              + shell noindex con la isla CambioButacas
│           └── page.module.css       +
├── api/
│   ├── navegador.ts                  ~ PUT, horaServidorMs, recibidoEnMs
│   ├── problema.ts                   ~ estadoActual
│   └── carritos.ts                   ~ Carrito completo; obtenerCarrito, reemplazarAsientos, indicarEmail; abandonarCarrito devuelve el carrito
├── domain/
│   ├── carrito.ts                    + etiquetaEstado, esModificable, credencialPerdida, reducirPantalla, resolverProblemaCarrito
│   ├── cuenta-regresiva.ts           + medirDesfase, restanteMs, tramo, formatearContador, describirRestante
│   ├── email.ts                      + validarEmail
│   ├── butacas.ts                    ~ marcarPropias, estadoInicial con selección, mismaSeleccion
│   └── sesion-carrito.ts             ~ versión 2, actualizarCarrito, cerrarSesion
├── config/
│   └── experiencia.ts                ~ AVISO_VENCIMIENTO_MS (valor de experiencia)
└── components/
    ├── PantallaCarrito/              + "use client": vistas, resumen, email, abandono, avisos
    ├── CuentaRegresiva/              + "use client": useCuentaRegresiva, role="timer", región de avisos
    ├── CambioButacas/                + "use client": sesión, mapa desde el navegador, marcarPropias, PUT
    ├── SelectorButacas/              ~ parte común + estrategia de confirmación (crear / cambiar)
    └── CarritoCreado/                - reemplazado por PantallaCarrito

tests/
├── fixtures/carritos.json            ~ activo, abandonado, expirado, con email
├── fixtures/index.ts                 ~ exports tipados
├── msw/handlers.ts                   ~ GET carrito, PUT asientos, PUT email, abandono con cuerpo; 401 sin token; header Date
├── unit/domain/                      + carrito, cuenta-regresiva, email; ~ butacas, sesion-carrito
├── unit/api/                         ~ navegador, carritos, problema
├── components/                       + PantallaCarrito, CambioButacas; ~ SelectorButacas; - CarritoCreado
└── e2e/
    ├── carrito.spec.ts               + recorrido, vencimiento con page.clock, token, recarga sin abandono, 360 px
    └── accesibilidad.spec.ts         ~ axe en carrito activo, vencido y cambio

scripts/mock-api.mjs                  ~ carritos en memoria: GET, PUT asientos, PUT email, abandono, 401 sin token
specs/003-mapa-butacas/contracts/routes.md   ~ filas de /carritos/{carritoId} actualizadas
```

**Structure Decision**: se mantiene el proyecto único con `src/` de las specs anteriores.
- `src/api/` sigue siendo el único módulo cliente.
- La lógica pura (reloj, estados, email, sesión) va en `src/domain/` para testearla sin DOM.
- Las islas de cliente son las que tocan el token o el reloj.
- Nombres en español, como el resto del código.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principio III, **DEBERÍA** "intentar el abandono al cerrar la pestaña": no se intenta. | El navegador no distingue cierre de recarga ni de salida por la barra de direcciones. Abandonar en `pagehide` haría que recargar el carrito lo pierda. El dueño eligió no abandonar (clarificación del 2026-11-01). La retención vence sola en minutos. | `pagehide` + `fetch` con `keepalive`: una recarga pierde el carrito sin aviso. `beforeunload` con aviso nativo: no se puede personalizar y molesta en cada recarga. `sendBeacon`: no permite el header `Authorization`. |
| Principio VIII, "las consultas públicas DEBEN resolverse en el servidor": el mapa del cambio de butacas se pide desde el navegador. | El `funcionId` vive en la sesión de la pestaña, junto al token. El servidor solo ve el `carritoId`, que sin token no da acceso a nada. La página no es pública: es `noindex` y depende de la credencial. El navegador ya pide el mismo mapa en la 003 tras un conflicto. | Poner el `funcionId` en la URL del cambio: contradice FR-019 ("la dirección lleva solo el id del carrito") y solo ahorra un estado de carga en una página que no se indexa. |

Las dos desviaciones se documentan en el PR, como pide la gobernanza.
