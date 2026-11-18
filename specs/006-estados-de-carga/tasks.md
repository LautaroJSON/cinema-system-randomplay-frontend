---

description: "Tareas de implementación: aviso de carga al elegir un horario"
---

# Tasks: Aviso de carga al elegir un horario

**Input**: documentos de diseño en `specs/006-estados-de-carga/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui-aviso-carga.md](contracts/ui-aviso-carga.md), [quickstart.md](quickstart.md)

**Tests**: solo los que fija la tabla "Qué se testea y qué no" de `plan.md` (Principio VII):
temporizador y anuncios de `AvisoCargaHorario`, timeout de `obtenerMapa` y el recorrido real con
Playwright. `IndicadorCarga`, los CSS Modules, las constantes, los fixtures y `mock-api.mjs` no
llevan test propio.

**Organization**:
- La Fase 2 deja listos las constantes, el timeout de 45 s (US3) y la función lenta del mock.
- US1 agrega el estado de carga en el horario y el aviso inferior.
- US2 agrega la línea de demora.
- US3 (la espera llega al final) queda resuelta por el timeout de la Fase 2 y se verifica con el e2e de US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de `spec.md` (US1 a US3)
- Proyecto único en la raíz: `src/`, `tests/`, `scripts/`

---

## Phase 1: Setup

- [X] T001 Crear la rama `006-estados-de-carga` desde `main` actualizada (hoy la sesión está en `fix/navegador-llama-directo-al-backend`; si ese fix todavía no está mergeado, partir de esa rama y decirlo en el PR). Leer `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md` (pide `AGENTS.md`) y confirmar que lo de research R1–R2 vale en la versión instalada. Modo de antislop: resolverlo según `CLAUDE.md` y leer `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile` y `antislop-copywriting` antes de T007

---

## Phase 2: Foundational (prerequisitos bloqueantes)

- [X] T002 [P] Ampliar `src/config/experiencia.ts` con `AVISO_DEMORA_MS = 5000` (comentario: cuándo el aviso de carga de un horario suma la línea de demora, FR-005) y `ESPERA_LECTURA_MS = 45_000` (comentario: el backend gratuito tarda ~30 s en despertar; solo para la lectura del mapa de la función, research R4)
- [X] T003 [P] [US3] Test en `tests/unit/api/asientos.test.ts` (escribirlo antes de T004; debe fallar): con un handler de MSW para el mapa que responde a los 10 s (`await delay(10_000)`), `obtenerMapa` de `src/api/asientos-servidor.ts` devuelve el mapa. Usar `vi.useFakeTimers({ shouldAdvanceTime: true })` o, si el `AbortSignal.timeout` no respeta los timers simulados, verificar que el `signal` recibido por el handler no está abortado a los 6 s reales y dejar el caso con un `timeout` de test de 15 s
- [X] T004 [US3] En `src/api/asientos-servidor.ts`, pasar `{ timeoutMs: ESPERA_LECTURA_MS }` a `pedirSinCache` dentro de `obtenerMapa` y actualizar su comentario (research R4)
- [X] T005 [P] Agregar la función lenta a los fixtures y al mock:
  - `tests/fixtures/mapas.json`: entrada con id `9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0a1` copiando la sala de `…b001`;
  - `tests/fixtures/index.ts`: `export const ID_FUNCION_LENTA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0a1";` con comentario (el mock demora su mapa);
  - `tests/fixtures/horarios.json`: en la lista `3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a04/7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4a02` (película de título largo; ningún test cuenta sus horarios, solo `accesibilidad.spec.ts` la recorre con axe), un horario con `funcionId` lento y `offsetMinutos: 210`, copiando el resto de los campos del horario existente;
  - `scripts/mock-api.mjs`: constante `ID_FUNCION_LENTA` y `const demoraLenta = Number(process.env.MOCK_DEMORA_MS ?? 8000)`; en `createServer`, si la ruta es `/api/funciones/${ID_FUNCION_LENTA}/asientos`, esperar `demoraLenta` ms antes de `responder`. Documentar `MOCK_DEMORA_MS` en el comentario de cabecera. No demorar ninguna otra ruta

**Checkpoint**: `npm test` pasa T003; los e2e existentes siguen en verde con el horario nuevo.

---

## Phase 3: User Story 1 - Ver que el horario tocado está cargando (Priority: P1) 🎯 MVP

**Goal**: el horario tocado muestra "Cargando…" sin cambiar de tamaño y aparece un aviso fijo
abajo con la hora y la sala.

**Independent Test**: con la función lenta (8 s), tocar su horario muestra el estado y el aviso
en < 0,5 s; al terminar se abre la función.

### Tests for User Story 1 (escribirlos antes de implementar; deben fallar)

- [X] T006 [P] [US1] Crear `tests/components/AvisoCargaHorario.test.tsx`: con `hora="20:30"` y `sala="Sala 2"` muestra "Cargando las butacas de las 20:30, Sala 2…"; la región `role="status"` está vacía en el primer render y tiene ese texto después de montar; no hay elementos enfocables (`a, button, [tabindex]`)
- [X] T007 [P] [US1] Crear `tests/e2e/aviso-carga.spec.ts` (solo con JavaScript):
  - "estado en el horario": abrir `/peliculas/3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a04`, medir el `boundingBox` del enlace a `/funciones/${ID_FUNCION_LENTA}`, hacer clic; antes de 500 ms el enlace contiene "Cargando…", su `boundingBox` no cambió y se ve "Cargando las butacas de las"; al terminar, la URL es la de la función y se ve el `grid` de butacas (cubre también US3: con 8 s y el timeout viejo de 5 s, terminaría en error);
  - "horario rápido": clic en un horario de `ID_FUNCION_8X12` (película `3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a01`) abre la función y no deja aviso visible;
  - "otro horario durante la carga": clic en el lento y, antes de que termine, en otro horario de la misma página; el aviso nombra la hora del segundo

### Implementation for User Story 1

- [X] T008 [P] [US1] Crear `src/components/TiraHorarios/AvisoCargaHorario.tsx` (`"use client"`) y `AvisoCargaHorario.module.css` según contracts/ui-aviso-carga.md: props `hora` y `sala`; barra `position: fixed` abajo (`inset-inline: 0`, `bottom: 0`, gutter de 16 px, `padding-bottom` con `env(safe-area-inset-bottom)`), fondo `--surface`, borde superior `--line-strong`, sombra dura de DESIGN.md §6, texto `--paper`, `pointer-events: none`, `z-index` por encima del contenido; sin animación. Región `<p role="status">` que se llena con el texto en un `useEffect` después de montar (research R3). Verificar contraste con el checker de `antislop-human`
- [X] T009 [US1] Crear `src/components/TiraHorarios/IndicadorCarga.tsx` (`"use client"`): `const { pending } = useLinkStatus()`; siempre dibuja `<span aria-hidden="true" data-pendiente={pending || undefined} className={…}>Cargando…</span>` (visible solo con `pending`); con `pending`, además `createPortal(<AvisoCargaHorario hora={hora} sala={sala} />, document.body)`. Comentario: por qué el portal y `pointer-events: none` (research R3)
- [X] T010 [US1] Modificar `src/components/TiraHorarios/TiraHorarios.tsx` y `TiraHorarios.module.css`:
  - dentro del `<Link>`, envolver el precio y `<IndicadorCarga hora={hora} sala={horario.salaNombre} />` en una celda donde ambos comparten `grid-area`; el precio pasa a `visibility: hidden` cuando la celda contiene `[data-pendiente]` y el indicador a `visible` (mismo alto, research R2);
  - `.horario:has([data-pendiente])`: borde `--oro`;
  - no tocar las comas ocultas ni el orden del nombre accesible (el indicador es `aria-hidden`); correr `tests/components/TiraHorarios.test.tsx` sin cambios;
  - actualizar el comentario "Sin hooks…": sigue sin hooks propios, contiene una isla de cliente por horario

**Checkpoint**: T006 y T007 en verde; tocar un horario da señal inmediata.

---

## Phase 4: User Story 2 - Aviso cuando la espera se alarga (Priority: P1)

**Goal**: a los 5 s, el aviso suma "Esto puede tardar un poco más. No hace falta recargar la página."

**Independent Test**: con la función lenta, la línea no está a los 3 s y sí a los 6 s; con una rápida no aparece.

- [X] T011 [P] [US2] Ampliar `tests/components/AvisoCargaHorario.test.tsx` con `vi.useFakeTimers()`: a los 4 999 ms la línea de demora no está; a los 5 000 ms está visible y en la región `role="status"`; 60 s más no la duplican; al desmontar antes de 5 s, `vi.getTimerCount()` es 0. Ampliar `tests/e2e/aviso-carga.spec.ts`: con la función lenta, la línea no está a los 3 s y está a los 6 s
- [X] T012 [US2] Ampliar `src/components/TiraHorarios/AvisoCargaHorario.tsx`: estado `demorada` con `setTimeout(AVISO_DEMORA_MS)` en un `useEffect` que limpia al desmontar; con `demorada`, mostrar "Esto puede tardar un poco más. No hace falta recargar la página." en `--paper-muted`, sin animación, y agregarla al contenido de la región `role="status"`. Revisar el texto con `antislop-copywriting` y DESIGN.md §10

**Checkpoint**: US1 + US2 + US3 completas (MVP = la feature entera).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] Ampliar `tests/e2e/accesibilidad.spec.ts`: axe sin violaciones en el detalle de la película de título largo con el aviso visible (clic en el horario lento y analizar antes de que termine); a 360 px, sin scroll horizontal (`document.documentElement.scrollWidth <= 360`) con el aviso visible
- [X] T014 Revisar con la Delivery Gate de `.claude/skills/antislop/SKILL.md` y los checklists de `antislop-ui`, `antislop-human` y `antislop-layoutmobile` el horario en carga y el aviso. Correr `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` y `npm run test:e2e`; recorrer a mano quickstart.md secciones 2 a 4 con `MOCK_DEMORA_MS=30000`
- [X] T015 Preparar la descripción del PR: principios tocados (IV, VI, VIII); timeout de lectura del mapa a 45 s y requisito de hosting (pedidos ≥ 60 s); que la versión con `loading.tsx` se descartó por sus efectos sobre los códigos de estado (research R0); límite conocido: sin aviso al entrar por enlace directo o recargar

---

## Dependencies & Execution Order

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de T001. T002, T003 y T005 en paralelo; T004 después de T002 y T003.
- **US1 (Fase 3)**: depende de la Fase 2 (el e2e T007 necesita T004 y T005). T006, T007 y T008 en paralelo; T009 después de T008; T010 después de T009.
- **US2 (Fase 4)**: depende de T008. T011 antes de T012.
- **US3**: resuelta por T003–T004; verificada por T007.
- **Polish (Fase 5)**: después de US1 y US2.

### Parallel Example: Fase 2 + inicio de US1

```text
Task: "T002 src/config/experiencia.ts"
Task: "T003 tests/unit/api/asientos.test.ts"
Task: "T005 fixtures y scripts/mock-api.mjs"
Task: "T006 tests/components/AvisoCargaHorario.test.tsx"
```

---

## Implementation Strategy

### MVP

La feature entera es el MVP: sin el timeout (US3) el aviso termina en error a los 5 s, y sin la
línea de demora (US2) un "Cargando…" de 30 s se lee como colgado.

1. Fase 1 y Fase 2.
2. US1 → señal en el horario y aviso inferior.
3. US2 → línea de demora.
4. **Parar y validar** con `MOCK_DEMORA_MS=30000` (quickstart sección 2).
5. Polish → accesibilidad, Delivery Gate, PR.

---

## Notes

- Ninguna respuesta del servidor cambia: la función sigue con su `404` real, sus errores y su comportamiento sin JavaScript.
- El horario sigue siendo un `<a>` real con el mismo nombre accesible.
- Commit al cerrar cada tarea o grupo lógico.
