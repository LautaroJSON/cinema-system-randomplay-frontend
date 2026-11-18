# Implementation Plan: Aviso de carga al elegir un horario

**Branch**: `006-estados-de-carga` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-estados-de-carga/spec.md`

## Summary

Cuando el visitante toca un horario en el detalle de una película, ese horario muestra
"Cargando…" y aparece un aviso fijo abajo con la hora y la sala; a los 5 s el aviso suma una
línea de demora. Se usa `useLinkStatus` de `next/link` dentro de cada enlace de horario, sin
cambiar ninguna respuesta del servidor. La lectura del mapa de la función pasa de 5 s a 45 s de
timeout para que la espera termine en la función y no en el error.

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`) sobre Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 (`useLinkStatus` de `next/link`), React 19
(`createPortal`). Sin dependencias nuevas.

**Storage**: N/A

**Testing**: Vitest 5 + Testing Library con timers simulados; Playwright 1.64 +
@axe-core/playwright contra `scripts/mock-api.mjs` con una función lenta.

**Target Platform**: navegadores actuales, mobile-first desde 360 px; servidor Node para Next.js.

**Project Type**: aplicación web (solo frontend; el backend es otro repositorio)

**Performance Goals**: estado de carga visible < 0,5 s tras el toque (SC-001); sin cambios de
CLS en el detalle (SC-004).

**Constraints**:
- No cambia la respuesta de ninguna página ni el origen de los datos (FR-013).
- Sin animación (DESIGN.md MOTION 1).
- El hosting del frontend debe permitir pedidos de ≥ 60 s (timeout de 45 s, research R4).

**Scale/Scope**: 2 componentes de cliente nuevos, 1 componente modificado (`TiraHorarios`),
1 función de la API modificada (`obtenerMapa`), 2 constantes de experiencia.

No quedan puntos NEEDS CLARIFICATION. Las decisiones están en [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| I. Contrato OpenAPI | `obtenerMapa` sigue usando el cliente único con tipos generados; solo cambia el timeout. | ✅ |
| II. Errores por `codigo` | Sin cambios: `410`, `404` y errores siguen como hoy. | ✅ |
| III. Token del carrito | No interviene. | ✅ N/A |
| IV. La API decide | `AVISO_DEMORA_MS` y `ESPERA_LECTURA_MS` son valores de experiencia en `config/experiencia.ts`. | ✅ |
| V. Formatos exactos | La hora del aviso sale de `formatearHora`, ya usado por el horario. | ✅ |
| VI. WCAG 2.2 AA y mobile-first | Estado de carga con texto, no solo color; anuncio cortés después de montar; sin foco ni movimiento; barra con safe area y 360 px (R2, R3). | ✅ |
| VII. Testing por criterio | Ver "Qué se testea" abajo. | ✅ |
| VIII. Calidad y bordes | Dos islas de cliente chicas dentro de `TiraHorarios`; la página del detalle sigue siendo de servidor. | ✅ |
| IX. SEO | El horario sigue siendo un `<a>` real con el mismo nombre accesible. Ninguna respuesta cambia; el `404` real de la función se mantiene. | ✅ |

**Re-check post-diseño**: sin violaciones.

### Qué se testea y qué no (Principio VII)

| Unidad | ¿Test? | Justificación |
|---|---|---|
| `AvisoCargaHorario`: texto con hora y sala, anuncio después de montar, línea de demora a los 5 s y no antes, una sola vez, temporizador limpio al desmontar, sin elementos enfocables | Sí, Testing Library con timers simulados | Lógica de tiempo y anuncios; un error acá es silencioso. |
| `obtenerMapa` pasa `ESPERA_LECTURA_MS`: con MSW demorando 10 s la respuesta, devuelve el mapa | Sí, ampliando `tests/unit/api/asientos.test.ts` | Si el timeout no se pasa, vuelve el corte a los 5 s y solo se nota con el backend dormido. |
| `IndicadorCarga` (`useLinkStatus`) | No en Vitest | El hook solo funciona en el App Router real; lo cubre el e2e. |
| Recorrido: tocar el horario lento → "Cargando…" en el horario y aviso abajo; demora a los 5 s; se abre la función; horario rápido sin demora; mismo tamaño del horario | Sí, Playwright | Integración con la navegación real de Next. |
| axe con el aviso visible y 360 px | Sí, ampliando `accesibilidad.spec.ts` | Principio VI. |
| `TiraHorarios`: el nombre accesible del enlace no cambia | Sí, el test existente de `TiraHorarios.test.tsx` ya lo cubre; correrlo | WCAG 2.5.3. |
| CSS Modules, constantes, fixtures, `mock-api.mjs` | No | Estilos, configuración y herramientas de test. |

## Project Structure

### Documentation (this feature)

```text
specs/006-estados-de-carga/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-aviso-carga.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── api/
│   └── asientos-servidor.ts          # MOD: obtenerMapa con timeoutMs: ESPERA_LECTURA_MS
├── components/
│   └── TiraHorarios/
│       ├── TiraHorarios.tsx          # MOD: <IndicadorCarga hora sala /> dentro del Link; precio en la celda compartida
│       ├── TiraHorarios.module.css   # MOD: celda compartida precio/indicador, borde --oro con :has()
│       ├── IndicadorCarga.tsx        # NUEVO, "use client": useLinkStatus + portal del aviso
│       ├── AvisoCargaHorario.tsx     # NUEVO, "use client": barra fija, role="status", demora a los 5 s
│       └── AvisoCargaHorario.module.css
└── config/
    └── experiencia.ts                # MOD: AVISO_DEMORA_MS, ESPERA_LECTURA_MS

scripts/mock-api.mjs                  # MOD: función lenta (MOCK_DEMORA_MS)
tests/
├── fixtures/                         # MOD: ID_FUNCION_LENTA, su mapa y un horario que la enlaza
├── unit/api/asientos.test.ts         # MOD
├── components/AvisoCargaHorario.test.tsx  # NUEVO
└── e2e/
    ├── aviso-carga.spec.ts           # NUEVO
    └── accesibilidad.spec.ts         # MOD
```

**Structure Decision**: los componentes nuevos viven junto a `TiraHorarios`, el único lugar que
los usa. El comentario de `TiraHorarios` ("Sin hooks") se actualiza: sigue sin hooks propios,
pero contiene una isla de cliente por horario.

## Complexity Tracking

Sin violaciones de la constitución.
