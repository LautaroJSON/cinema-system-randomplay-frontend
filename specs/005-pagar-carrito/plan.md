# Implementation Plan: Pagar el carrito

**Branch**: `005-pagar-carrito` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-pagar-carrito/spec.md`

## Summary

Sumar el pago al flujo del carrito, contra la feature 008 del backend.

- **Contrato:** copiar `openapi.json` del backend y regenerar tipos. `Carrito` suma `pago` y
  `entradas`. El endpoint de pago simulado no está en el contrato: su tipo se escribe a mano en un
  módulo aislado (research P1, P2).
- **Pagar:** sección "Pago" en la vista `activo` de `PantallaCarrito`. Llama a
  `POST /api/carritos/{id}/pago`, guarda el carrito en Pagando y sigue `urlPago` según
  `destinoPago`: `https://` en la misma pestaña, la ruta simulada a una página propia, cualquier
  otra cosa es error (P4).
- **Pago simulado:** `/carritos/[carritoId]/pago-simulado`, habilitada con `next dev` o
  `PAGO_SIMULADO=1`, 404 en el resto (P3). Aprobar, rechazar u otro monto, y navega a la vuelta.
- **Página de vuelta:** `/carritos/[carritoId]/pago`, con la isla `VueltaPago`. Consulta cada 2 s
  mientras esté Pagando, con tope de 2 minutos, "Revisar de nuevo" y "Volver a la página de pago"
  (P8). Pagado muestra `ListaEntradas`.
- **Bloqueo:** vistas nuevas `pagando` y `pagado` en `vistaPantalla`, compartidas por el carrito, el
  cambio de butacas y la vuelta (P6). En Pagando el contador en cero lleva a la página de vuelta
  en vez de declarar vencido (P7).
- **Sesión:** Pagando conserva el token; Pagado guarda el carrito con entradas y borra el token
  (P5).
- **Errores:** cuatro códigos nuevos con transición explícita (P9).
- **Constitución:** enmienda a 1.2.0 de la restricción "el pago todavía no existe" (P15).

No se agregan dependencias.

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`) sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 (App Router), React 19. Sin dependencias nuevas.

**Storage**: `sessionStorage`, clave `randomplay:carrito` versión 2 con `pago` y `entradas`
(data-model.md). Sin caché de datos en estas rutas.

**Testing**: Vitest 5 + Testing Library + user-event + MSW 3 con timers simulados; Playwright 1.64
+ @axe-core/playwright contra `scripts/mock-api.mjs` ampliado y contra el backend real
(`test:e2e:api-real`).

**Target Platform**: navegadores actuales, mobile-first desde 360 px; servidor Node para Next.js

**Project Type**: aplicación web (solo frontend; el backend es otro repositorio)

**Performance Goals**: SC-002 (entradas visibles en menos de 5 s tras aprobar); consultas cada 2 s
sin superponerse; INP ≤ 200 ms en los botones de pago.

**Constraints**:
- El token solo en `sessionStorage` y solo hacia las rutas de su carrito; nunca a `urlPago` ni al
  endpoint simulado.
- Redirección solo a `https://` o a la ruta simulada habilitada.
- Ningún dato de tarjeta pasa por el sitio.
- WCAG 2.2 AA, sin scroll horizontal desde 360 px.
- Timeout de 8 s por pedido (el backend puede tardar hasta 3 s verificando con Mercado Pago).

**Scale/Scope**:
- 2 rutas nuevas (`/pago`, `/pago-simulado`) y 2 modificadas (`/carritos/[id]`, `/butacas`).
- 1 endpoint nuevo con token, 1 de desarrollo sin token, 3 con un código nuevo.
- 1 carrito por pestaña, hasta 10 entradas.

No quedan puntos NEEDS CLARIFICATION. Las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Contrato OpenAPI | `openapi.json` copiado del backend y tipos regenerados (P1). `iniciarPago` en `carritos.ts` con tipos generados. Ningún componente llama a `fetch`. El pago simulado no está en el contrato y se tipa a mano en `src/api/pagos-simulados.ts` (Complexity Tracking). Se reporta al backend que `docs/api.md` no documenta los códigos nuevos. | ✅ (con desviación documentada) |
| II. Errores por `codigo` | `email-entrega-faltante`, `carrito-no-activo` (con `estadoActual`), `carrito-modificado`, `pago-no-disponible` y `carrito-en-pago` tienen transición propia; el `switch` exhaustivo obliga a manejarlos (P9). `401` por status. Red y desconocido → error genérico con reintento. | ✅ |
| III. Token del carrito | Sigue solo en `sessionStorage`. Viaja como Bearer solo a `/api/carritos/{id}/…`. No viaja a `urlPago`, a la ruta simulada ni a `/api/dev/pagos-simulados`. Las rutas nuevas llevan solo el `carritoId`. Pagado borra el token y conserva las entradas (P5). La redirección es en la misma pestaña para que la vuelta tenga la credencial (P4). | ✅ |
| IV. La API decide | El estado y el vencimiento vienen de la API: el contador usa el `venceEn` nuevo. En Pagando, el cero no se declara vencido: se consulta (P7). El "Pagar" sin email es ayuda; la API manda con `email-entrega-faltante`. Intervalo y tope son valores de experiencia en `config/experiencia.ts`. | ✅ |
| V. Formatos exactos | Precios de entradas y total con `formatearPrecio`. Fechas con `formato.ts`. Etiquetas de los 5 estados en `etiquetaEstado`, con desconocido. El monto simulado se valida como texto y se serializa sin aritmética (P11). | ✅ |
| VI. WCAG 2.2 AA y mobile-first | `role="status"` que cambia solo por fase (P13). Foco al `h1` al cambiar de vista. Motivo del bloqueo como texto visible y `aria-describedby`. "Pagar" sin email enfocable con su motivo (P10). Entradas en lista de una columna. e2e con axe y 360 px en vuelta, simulada y Pagando. | ✅ |
| VII. Testing por criterio | Ver "Qué se testea" abajo. | ✅ |
| VIII. Calidad y bordes | Páginas como Server Components mínimos que solo leen `entorno.pagoSimulado` y lo pasan como prop. Islas de cliente: `PantallaCarrito`, `VueltaPago`, `PagoSimulado`, `CambioButacas`. Lógica pura en `domain/pago.ts` y `domain/carrito.ts`. Sin `NEXT_PUBLIC_`. | ✅ |
| IX. SEO | `/pago` y `/pago-simulado` son `noindex, nofollow`, `force-dynamic`, fuera del sitemap y cubiertas por `Disallow: /carritos/`. `/pago-simulado` responde 404 real si no está habilitada. Un `h1` por vista. | ✅ |
| Restricciones | Hoy dicen "El pago todavía no existe en la API; ninguna pantalla DEBE simular un pago como si fuera real". La simulación es solo de desarrollo y se identifica como tal, pero el texto quedó viejo: se enmienda a 1.2.0 en esta feature (P15). | ✅ (con enmienda) |
| Puerta CI 5 | Solo páginas públicas: N/A. El e2e verifica `noindex` y que el HTML del servidor no tenga datos del carrito. | ✅ N/A |

**Re-check post-diseño**: sin violaciones nuevas. La desviación del Principio I y la enmienda
están en Complexity Tracking.

### Qué se testea y qué no (Principio VII)

| Unidad | ¿Test? | Justificación |
|---|---|---|
| `src/domain/pago.ts` (`destinoPago`, `siguientePaso`, `validarMontoSimulado`) | Sí | Redirección (riesgo de seguridad), tope de espera y validación de dinero. |
| `src/domain/carrito.ts` (`etiquetaEstado` con 5 estados, `vistaPantalla` con `pagando`/`pagado`, `resolverProblemaCarrito` con los códigos nuevos y `"pagar"`) | Sí, ampliando | Transiciones de estado y manejo de cada `codigo`. |
| `src/domain/sesion-carrito.ts` (sesión sin `pago`/`entradas` normalizada, cierre en Pagado conservando entradas) | Sí, ampliando | Guardado y descarte del token. |
| `src/api/carritos.ts` (`iniciarPago` con Bearer, mapeo de `pago` y `entradas`), `problema.ts` (códigos nuevos), `pagos-simulados.ts` (sin `Authorization`) | Sí, MSW | Transporte del token y forma del contrato. |
| `PantallaCarrito` (Pagar con y sin email, cada código del inicio de pago, `carrito-en-pago` desde email y abandono, vista `pagando` con acciones bloqueadas, vista `pagado` con `venceEn` pasado, cero en Pagando navega a la vuelta) | Sí, Testing Library + MSW | Núcleo del riesgo de la spec. |
| `VueltaPago` (Pagando → Pagado, → Expirado, tope de 2 min con timers simulados, "Revisar de nuevo", red durante la espera, sin sesión, `401`) | Sí, Testing Library + MSW | Espera y transiciones. |
| `PagoSimulado` (cada botón envía su cuerpo, monto inválido, error y reintento) | Sí, mínimo | Herramienta de desarrollo, pero es la vía del test manual. |
| `CambioButacas` en Pagando/Pagado | Sí, un caso | Que no deje confirmar. |
| `ListaEntradas` | No | Presentacional; lo cubren `VueltaPago` y `PantallaCarrito`. |
| Página `/pago-simulado` 404 sin habilitar | Sí, e2e | Requisito SC-008; depende de la variable del servidor. |
| Recorrido completo (mock): pagar → simulado → aprobar → entradas; rechazar → volver; Pagando bloqueado; token fuera de URL/consola; axe en las vistas nuevas; 360 px | Sí, Playwright | Integración de redirección, proxy y sesión. SC-001, SC-004, SC-007. |
| Recorrido contra la API real (`compra.spec.ts`): pagar y aprobar | Sí, un caso | Verifica el contrato real del simulado y del `GET` con entradas. |
| `config/experiencia.ts`, CSS Modules, fixtures, `mock-api.mjs`, `entorno.ts` | No | Configuración, estilos y herramientas de test. |

## Project Structure

### Documentation (this feature)

```text
specs/005-pagar-carrito/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-consumida.md
│   ├── routes.md
│   └── ui-pago.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

Archivos nuevos (`+`) y modificados (`~`):

```text
docs/openapi.json                       ~ copiado del backend (feature 008)

src/
├── api/
│   ├── schema.d.ts                     ~ regenerado
│   ├── carritos.ts                     ~ Carrito con pago y entradas; iniciarPago
│   ├── problema.ts                     ~ 4 códigos nuevos
│   └── pagos-simulados.ts              + registrarPagoSimulado (tipo a mano, solo desarrollo)
├── config/
│   ├── entorno.ts                      ~ pagoSimulado (NODE_ENV=development o PAGO_SIMULADO=1)
│   └── experiencia.ts                  ~ INTERVALO_CONSULTA_PAGO_MS, ESPERA_PAGO_MAXIMA_MS
├── domain/
│   ├── pago.ts                         + destinoPago, siguientePaso, validarMontoSimulado
│   ├── carrito.ts                      ~ etiquetas, vistas pagando/pagado, códigos y "pagar"
│   └── sesion-carrito.ts               ~ normalizar pago/entradas; cierre en Pagado
├── app/carritos/[carritoId]/
│   ├── page.tsx                        ~ pasa pagoSimulado a PantallaCarrito
│   ├── butacas/page.tsx                ~ (sin cambios de forma; CambioButacas bloquea)
│   ├── pago/page.tsx                   + shell noindex con la isla VueltaPago
│   ├── pago/page.module.css            +
│   ├── pago-simulado/page.tsx          + notFound() si no está habilitado; isla PagoSimulado
│   └── pago-simulado/page.module.css   +
└── components/
    ├── PantallaCarrito/
    │   ├── PantallaCarrito.tsx         ~ vistas pagando/pagado, aplicar carrito-en-pago, cero en Pagando
    │   ├── SeccionPago.tsx             + "Pagar" / "Volver a la página de pago" y sus errores
    │   ├── useIrAPago.ts               + iniciarPago + destinoPago + navegación (lo usa también VueltaPago)
    │   ├── EmailEntrega.tsx            ~ "Qué sigue" nuevo, ref al campo, modo solo lectura
    │   ├── AbandonoCarrito.tsx         ~ bloqueado con motivo
    │   └── Vistas.tsx                  ~ VistaPagado
    ├── ListaEntradas/                  + presentacional
    ├── VueltaPago/                     + "use client": VueltaPago, useEsperaPago
    ├── PagoSimulado/                   + "use client": monto y tres botones
    └── CambioButacas/CambioButacas.tsx ~ bloqueo en Pagando/Pagado; cero en Pagando

tests/
├── fixtures/carritos-estados.json      ~ pagando, pagado (con entradas)
├── fixtures/index.ts                   ~ exports
├── msw/handlers.ts                     ~ POST pago, POST pagos-simulados
├── unit/domain/                        + pago; ~ carrito, sesion-carrito
├── unit/api/                           ~ carritos (iniciarPago), problema; + pagos-simulados
├── components/                         + VueltaPago, PagoSimulado; ~ PantallaCarrito, CambioButacas
├── e2e/pago.spec.ts                    + recorrido con el mock, bloqueo, 404, token, axe, 360 px
└── e2e-api-real/compra.spec.ts         ~ pagar y aprobar contra el backend real

scripts/mock-api.mjs                    ~ pago, pago simulado, Pagando/Pagado, carrito-en-pago
playwright.config.ts                    ~ PAGO_SIMULADO=1 en el webServer del sitio
playwright.api-real.config.ts           ~ ídem
.env.example                            ~ PAGO_SIMULADO comentada
.specify/memory/constitution.md         ~ 1.2.0 (P15)
specs/004-carrito-retencion/contracts/routes.md  ~ filas de Pagando y Pagado
```

**Structure Decision**: se mantiene el proyecto único con `src/` de las specs anteriores.
`src/api/` sigue siendo el único módulo cliente. La lógica pura nueva va en `src/domain/pago.ts`.
Las islas de cliente son las que tocan el token, el reloj o la navegación. Nombres en español.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principio I, "los tipos NO DEBEN escribirse a mano": `src/api/pagos-simulados.ts` define a mano el pedido y la respuesta de `POST /api/dev/pagos-simulados`. | El backend lo excluye del contrato (`IgnoreApi`) porque solo existe en Development y Testing. El front lo necesita para la prueba manual pedida. El archivo es el único con tipos a mano, lo usa solo la página simulada y cita el controlador del backend como fuente. | Pedir al backend que lo publique: documentaría como API real algo que en producción no existe. Llamar con `fetch` desde el componente: viola el cliente único del mismo principio. |
| Restricciones: "ninguna pantalla DEBE simular un pago como si fuera real". | La prueba manual pedida necesita una pantalla de pago simulado. Se identifica como simulación, existe solo en desarrollo y pruebas y responde 404 en producción, así que no simula un pago "como si fuera real". Igual el texto quedó desactualizado y se enmienda (P15). | Usar la página de texto del backend (`GET /api/dev/pagos-simulados/{pref}`): obliga a hacer el `POST` con curl y saca la prueba del navegador. |

Las dos se documentan en el PR, como pide la gobernanza.
