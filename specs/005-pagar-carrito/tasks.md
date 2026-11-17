---

description: "Tareas de implementación: pagar el carrito"
---

# Tasks: Pagar el carrito

**Input**: documentos de diseño en `specs/005-pagar-carrito/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: solo los que fija la tabla "Qué se testea y qué no" de `plan.md` (Principio VII):
redirección y destino de `urlPago`, espera con intervalo y tope, transiciones de estado, cada
`codigo` nuevo, guardado y descarte del token, validación del monto simulado. `ListaEntradas`,
CSS Modules, configuración, fixtures y la ampliación de `mock-api.mjs` no llevan test propio.

**Organization**: tareas agrupadas por historia de usuario.
- La Fase 2 deja listos el contrato regenerado, el mapeo de `pago` y `entradas`, los códigos
  nuevos, la lógica pura de `domain/pago.ts`, las vistas `pagando`/`pagado`, la sesión y los
  mocks.
- US1 agrega "Pagar", la redirección y la página de vuelta con Pagado y Expirado.
- US2 agrega la página de pago simulado.
- US3 bloquea el carrito en Pagando.
- US4 agrega "Volver a la página de pago", el tope de la espera y el cero en Pagando.
- US5 agrega el manejo de cada código del inicio de pago.
- US6 muestra la compra cerrada en el carrito y en el cambio de butacas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de `spec.md` (US1 a US6)
- Proyecto único en la raíz: `src/`, `tests/`, `scripts/`

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: contrato al día, constitución enmendada y modo de antislop resuelto.

- [X] T001 Copiar `../cinema-system-randomplay-backend/docs/openapi.json` sobre `docs/openapi.json` y correr `npm run gen:api` para regenerar `src/api/schema.d.ts`. Verificar que el schema nuevo trae `PagoIniciadoResponse`, `PagoResponse`, `EntradaResponse`, `CarritoResponse.pago`/`entradas` y `paths["/api/carritos/{carritoId}/pago"]`. No editar `schema.d.ts` a mano (Principio I, research P1). `npm run typecheck` va a fallar en `mapearCarrito` hasta T006: es lo esperado
- [X] T002 [P] Copiar `../cinema-system-randomplay-backend/docs/api.md` sobre `docs/api.md` solo si difiere (hoy es idéntico; dejar constancia en el PR de que no documenta los códigos nuevos, contracts/api-consumida.md "Para reportar al backend")
- [X] T003 [P] Enmendar `.specify/memory/constitution.md` a 1.2.0 según research P15:
  - en "Restricciones de Plataforma y Tecnología", reemplazar el punto "Solo existe el flujo del comprador (…) ninguna pantalla DEBE simular un pago como si fuera real." por: el flujo llega hasta el pago en Mercado Pago y la entrega de entradas; el frontend **NO DEBE** pedir, mostrar ni transmitir datos de tarjeta; la simulación de pago **DEBE** existir solo en desarrollo y pruebas, identificarse visiblemente como simulación y responder `404` en producción;
  - en el Principio III, agregar que el token **NO DEBE** enviarse a la página de pago (`urlPago`) ni a endpoints públicos como el de pago simulado;
  - actualizar el Sync Impact Report (1.1.0 → 1.2.0, MINOR, motivo: feature 005 / backend 008), `Version` y `Last Amended: 2026-11-17`
- [X] T004 Resolver el modo de antislop siguiendo `CLAUDE.md` (sección "antislop": instrucción explícita de la sesión, después la preferencia global, después preguntar) y leer `.claude/skills/antislop/SKILL.md`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile` y `antislop-copywriting` antes de la primera tarea de UI (T029). Dial del flujo privado: 1/1/1 (DESIGN.md §11)

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: borde con la API, lógica pura, sesión y datos de prueba que usan las seis historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Configuración

- [X] T005 [P] Ampliar `src/config/experiencia.ts` con `INTERVALO_CONSULTA_PAGO_MS = 2000` (comentario: lo recomienda el contrato del backend) y `ESPERA_PAGO_MAXIMA_MS = 2 * 60 * 1000` (tope de consultas automáticas de la página de vuelta), data-model.md "Valores de experiencia"
- [X] T006 [P] Ampliar `src/config/entorno.ts` con el getter `pagoSimulado`: `true` si `process.env.NODE_ENV === "development"` o `process.env.PAGO_SIMULADO === "1"`. Comentario: lo leen solo Server Components y lo pasan como prop; no es secreto y no lleva `NEXT_PUBLIC_` (research P3). Agregar a `.env.example`, comentada, `# PAGO_SIMULADO=1` con una línea que explique que habilita `/carritos/{id}/pago-simulado` fuera de `next dev` (e2e) y que nunca se activa en producción
- [X] T007 [P] Agregar `PAGO_SIMULADO: "1"` al `env` del webServer del sitio en `playwright.config.ts` y en `playwright.api-real.config.ts` (research P3)

### Datos de prueba

- [X] T008 [P] Ampliar `tests/fixtures/carritos-estados.json`: agregar `pago: null` y `entradas: []` a los cuatro estados existentes, y dos nuevos:
  - `pagando`: igual a `conEmail` con `estado: "Pagando"`, `pago: { urlPago: "/api/dev/pagos-simulados/pref-prueba", iniciadoEn: <ISO -03:00>, pagadoEn: null }`;
  - `pagado`: igual a `pagando` con `estado: "Pagado"`, `pago.pagadoEn` con fecha, y una entrada por asiento (F8 y F9) con `codigo` (`"K7M2Q-X9PDA"`, `"B4N8R-T2LWE"`), `pelicula` = `funcion.peliculaTitulo`, `sucursal` = `funcion.sucursalNombre`, `sala` = `funcion.salaNombre`, `horaInicio` = `funcion.horaInicio`, `asiento` y `precioUnitario` del carrito.
  Ajustar también `tests/fixtures/carritos.json` (`carrito.pago: null`, `carrito.entradas: []`) para que siga cumpliendo `satisfies` con el schema regenerado
- [X] T009 Ampliar `tests/fixtures/index.ts`: exportar `URL_PAGO_SIMULADA = carritosEstados.pagando.pago.urlPago` y `URL_PAGO_REAL = "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=prueba"`. Verificar que `carritosEstados` sigue tipando con `satisfies Record<string, Schemas["CarritoResponse"]>` (depende de T001, T008)
- [X] T010 Ampliar `tests/msw/handlers.ts` (depende de T009):
  - `http.post("*/api/carritos/:carritoId/pago", …)` con `conCredencial`, que responde `{ urlPago: URL_PAGO_SIMULADA, carrito: conVencimiento(carritosEstados.pagando, 5 * 60_000) }`;
  - `http.post("*/api/dev/pagos-simulados", …)` que responde `{ pagoId: "sim-1", estadoCarrito: "Pagado" }` y devuelve `401` si el pedido trae `Authorization` (así los tests detectan que el token no se filtra);
  - exportar un helper `respuestaProblema(status, codigo, extras?)` para que los tests armen `server.use(...)` con `application/problem+json` y header `Date`
- [X] T011 [P] Ampliar `scripts/mock-api.mjs` (research P14), con el contrato de `contracts/api-consumida.md`:
  - los carritos creados nacen con `pago: null` y `entradas: []`;
  - `POST /api/carritos/{id}/pago` (en `resolverPost`, con la misma validación de token que `operarCarrito`): sin email → `409 email-entrega-faltante`; no Activo ni Pagando → `409 carrito-no-activo` con `estadoActual`; Activo → `estado: "Pagando"`, `venceEn` + 60 s, `pago = { urlPago: "/api/dev/pagos-simulados/pref-{n}", iniciadoEn, pagadoEn: null }`; Pagando → la misma respuesta sin tocar `venceEn`. Responde `{ urlPago, carrito }`;
  - `POST /api/dev/pagos-simulados` (sin token): 404 si el carrito no existe; `estado: "Aprobado"` sin `monto` o con `monto` igual al total y carrito Pagando vigente → `Pagado`, `pago.pagadoEn`, una entrada por asiento con código aleatorio `XXXXX-XXXXX`; cualquier otro caso deja el carrito igual. Responde `{ pagoId: "sim-{n}", estadoCarrito }`;
  - `operarCarrito` para `asientos`, `email` y `abandonar` con el carrito en Pagando → `409 carrito-en-pago`;
  - `vigente()`: un carrito Pagando con `venceEn` pasado pasa a `Expirado` (como el backend sin pago aprobado)

### Tests de la base (escribirlos antes de implementar; deben fallar)

- [X] T012 [P] Crear `tests/unit/domain/pago.test.ts`:
  - `destinoPago`: `https://…mercadopago…` → externo; `/api/dev/pagos-simulados/pref-1` con habilitado → `{ tipo: "simulado", ruta: "/carritos/{id}/pago-simulado" }` (con el id codificado); la misma sin habilitar → inválido; `http://…`, `javascript:alert(1)`, `//evil.com`, `/otra/ruta`, `""` → inválido;
  - `siguientePaso(estado, transcurridoMs)`: Pagando antes del tope → `consultar`; Pagando en el tope o después → `detener`; Pagado, Expirado, Abandonado y desconocido → `terminar`;
  - `validarMontoSimulado`: `"4500.00"`, `"1"`, `"0.5"` válidos (devuelve `number`); `""`, `"0"`, `"0.00"`, `"-1"`, `"1,5"`, `"1.234"`, `"abc"` inválidos con el mensaje de contracts/ui-pago.md
- [X] T013 [P] Ampliar `tests/unit/domain/carrito.test.ts`:
  - `etiquetaEstado`: `Pagando` → "Pago en curso", `Pagado` → "Pagado", desconocido → "Estado desconocido";
  - `vistaPantalla`: Pagado con y sin token, con tramo `vencido` → `pagado`; Pagando con token y tramo `vencido` → `pagando`; Pagando sin token → `lectura`;
  - `resolverProblemaCarrito` con la tabla de research P9: `email-entrega-faltante`/pagar → `pedirEmail`; `carrito-no-activo`/pagar → `cerrar` con `estadoActual`; `carrito-modificado`/pagar → `releer`; `pago-no-disponible`/pagar → `error` con `pagoNoDisponible: true`; `carrito-en-pago` en cambiar, email y abandonar → `enPago`; `401` y `carrito-no-encontrado`/pagar → `perdido`
- [X] T014 [P] Ampliar `tests/unit/domain/sesion-carrito.test.ts`: una sesión v2 guardada sin `pago` ni `entradas` se lee con `pago: null` y `entradas: []`; `cerrarSesion(carritoPagado)` borra el token y conserva `entradas`
- [X] T015 [P] Ampliar `tests/unit/api/carritos.test.ts`: `mapearCarrito` mapea `pago` (y `null`) y `entradas` con `asiento.numero` como `number` aunque llegue como texto; `iniciarPago(ID_CARRITO, TOKEN_PRUEBA)` hace `POST /api/carritos/{id}/pago` sin body, con `Authorization: Bearer`, y devuelve `{ urlPago, carrito }` mapeado
- [X] T016 [P] Ampliar el test de `problema.ts` (en `tests/unit/api/`, junto a los existentes): los cuatro códigos nuevos se leen como `tipo`; `estadoActual: "Pagado"` se conserva en `carrito-no-activo`
- [X] T017 [P] Crear `tests/unit/api/pagos-simulados.test.ts`: `registrarPagoSimulado({ carritoId, estado: "Aprobado" })` hace `POST /api/dev/pagos-simulados` con ese JSON y **sin** header `Authorization`; con `monto` lo envía como número; `404` vuelve como resultado no ok

### Implementación de la base

- [X] T018 Ampliar `src/api/carritos.ts` (depende de T001):
  - tipos `Pago` (`urlPago`, `iniciadoEn`, `pagadoEn: string | null`) y `Entrada` (`codigo`, `pelicula`, `sucursal`, `sala`, `horaInicio`, `asiento: Asiento`, `precioUnitario: Dinero`) derivados de `components["schemas"]`; `Carrito` suma `pago: Pago | null` y `entradas: Entrada[]`; actualizar el comentario de `estado` con los cinco valores;
  - `mapearCarrito` mapea los dos campos (`numero` con `Number`, como `asientos`);
  - `export type PagoIniciado = { urlPago: string; carrito: Carrito }` y `iniciarPago(carritoId, token)`: `pedirDesdeNavegador<PagoIniciadoResponse>(\`${rutaCarrito(carritoId)}/pago\`, { metodo: "POST", token })` mapeado con `mapearCarrito`
- [X] T019 [P] Ampliar `CODIGOS` en `src/api/problema.ts` con `email-entrega-faltante`, `carrito-en-pago`, `carrito-modificado` y `pago-no-disponible`; actualizar el comentario de `estadoActual` (`Abandonado`, `Expirado`, `Pagado` u otro)
- [X] T020 [P] Crear `src/api/pagos-simulados.ts`: comentario de cabecera que explique que el endpoint no está en `openapi.json` (`IgnoreApi` en `PagosSimuladosController` del backend), que es la única excepción a los tipos generados y que solo lo usa la página simulada (research P2, plan Complexity Tracking); tipos `PedidoPagoSimulado = { carritoId: string; estado: "Aprobado" | "Rechazado"; monto?: number }` y `PagoSimuladoRegistrado = { pagoId: string; estadoCarrito: string }`; `registrarPagoSimulado(pedido)` con `pedirDesdeNavegador` `POST` y **sin** `token`
- [X] T021 [P] Crear `src/domain/pago.ts` (lógica pura, sin React):
  - `PREFIJO_PAGO_SIMULADO = "/api/dev/pagos-simulados/"`;
  - `destinoPago(urlPago, carritoId, simuladoHabilitado)` según research P4: intentar `new URL(urlPago)` sin base; `https:` → `{ tipo: "externo", url }`; si empieza con el prefijo y está habilitado → `{ tipo: "simulado", ruta: \`/carritos/${encodeURIComponent(carritoId)}/pago-simulado\` }`; resto → `{ tipo: "invalido" }`;
  - `rutaVuelta(carritoId)` → `/carritos/{id}/pago`;
  - `siguientePaso(estado, transcurridoMs)` con `ESPERA_PAGO_MAXIMA_MS`;
  - `validarMontoSimulado(texto)` → `{ ok: true, monto: number } | { ok: false, mensaje }` con `/^\d{1,9}(\.\d{1,2})?$/` y mayor que cero, sin aritmética (research P11)
- [X] T022 Ampliar `src/domain/carrito.ts` (depende de T018, T019):
  - `ETIQUETAS` suma `Pagando: "Pago en curso"` y `Pagado: "Pagado"`;
  - `estaPagando`, `estaPagado`; `cierraSesion(carrito)` = no es `Activo` ni `Pagando` (incluye Pagado, research P5);
  - `VistaPantalla` suma `{ tipo: "pagado"; carrito }` y `{ tipo: "pagando"; sesion: SesionCarrito & { token: string } }`, evaluadas en `vistaPantalla` después de `sinSesion` y antes de `activo`, con el orden de data-model.md "Vistas";
  - `OperacionCarrito` suma `"pagar"`; `TransicionError` suma `{ tipo: "pedirEmail" }`, `{ tipo: "releer" }`, `{ tipo: "enPago" }` y `pagoNoDisponible?: boolean` en `error`; `resolverProblemaCarrito` implementa la tabla de research P9 manteniendo el `switch` exhaustivo
- [X] T023 Ampliar `src/domain/sesion-carrito.ts` (depende de T018): en `parsearSesion`, normalizar `carrito.pago ?? null` y `carrito.entradas ?? []` para sesiones guardadas antes de esta feature (sin subir de versión); comentario en `cerrarSesion` de que también se usa con Pagado y conserva las entradas
- [X] T024 Actualizar los usos existentes de `estaActivo(carrito)` para cerrar la sesión en `src/components/PantallaCarrito/PantallaCarrito.tsx` (`actualizar`) y `src/components/CambioButacas/CambioButacas.tsx`: usar `cierraSesion(carrito)` para que Pagando conserve el token (depende de T022)
- [X] T025 Correr `npm run typecheck` y `npm test`: los tests de T012–T017 pasan y los de la 004 siguen pasando

**Checkpoint**: contrato, dominio, sesión y mocks listos. `npm run mock:api` responde el pago.

---

## Phase 3: User Story 1 - Pagar y ver las entradas (Priority: P1) 🎯 MVP

**Goal**: "Pagar" en un carrito activo con email inicia el pago, redirige según `urlPago` y la
página de vuelta espera hasta mostrar las entradas o el vencimiento.

**Independent Test**: con MSW, tocar "Pagar" y verificar el pedido, el estado "Pago en curso" y la
navegación; en `/carritos/{id}/pago`, pasar de Pagando a Pagado y ver una tarjeta por entrada.

### Tests for User Story 1 (escribirlos antes de implementar; deben fallar)

- [X] T026 [P] [US1] Ampliar `tests/components/PantallaCarrito.test.tsx`: con sesión `conEmail` vigente, "Pagar $ …" está; al tocarlo se hace un solo `POST …/pago` aunque se toque dos veces, el botón dice "Iniciando el pago…", la sesión guarda el carrito en Pagando con el `venceEn` nuevo y se navega: con `URL_PAGO_REAL` se llama a `window.location.assign` (espiado) y con `URL_PAGO_SIMULADA` y `pagoSimulado` a `router.push("/carritos/{id}/pago-simulado")` (mock de `next/navigation`). Con una `urlPago` `http://` no se navega y aparece "No pudimos abrir la página de pago. Probá de nuevo."; el bloque "Qué sigue" ya no menciona que el pago no existe
- [X] T027 [P] [US1] Crear `tests/components/VueltaPago.test.tsx` con timers simulados: con sesión Pagando, el primer GET responde Pagando → `h1` "Estamos confirmando tu pago…"; a los 2 s otro GET responde `pagado` → `h1` "¡Listo!" con foco, una `listitem` por entrada con código, película, sucursal, sala, fila, asiento y precio, el texto del email, y la sesión queda sin token con las entradas; no se hacen más GET. Otro caso: GET responde `expirado` → "Se terminó el tiempo para pagar" con el texto de FR-020. La región `role="status"` cambia una sola vez por fase. Un GET con error de red no corta la espera (sigue consultando)

### Implementation for User Story 1

- [X] T028 [P] [US1] Crear `src/components/ListaEntradas/ListaEntradas.tsx` y `.module.css` (presentacional, research P12, contracts/ui-pago.md "ListaEntradas"): `<ul>` de una columna; por entrada, código con la clase de contador mono de `globals.css` (DESIGN.md §5 `counter`) y etiqueta "Código", película, `sucursal · sala`, fecha y hora con `formatearFecha`/`formatearHora`, "Fila {fila} · Asiento {numero}", precio con `formatearPrecio`. Sin scroll horizontal a 360 px; códigos largos con `overflow-wrap: anywhere`
- [X] T029 [US1] Crear `src/components/PantallaCarrito/useIrAPago.ts` (`"use client"`): recibe `carritoId`, `token`, `pagoSimulado`; expone `irAPago(): Promise<ResultadoIrAPago>` y `enCurso`. Llama a `iniciarPago` (ignora llamadas mientras hay una en curso, con `useRef`), guarda el carrito con `actualizarCarrito(carrito, medirDesfase(...))`, resuelve `destinoPago` y navega: externo → `window.location.assign(url)`; simulado → `router.push(ruta)`; inválido → devuelve `{ tipo: "destinoInvalido" }`. Ante error devuelve el `Problema` para que lo resuelva la pantalla (US5)
- [X] T030 [US1] Crear `src/components/PantallaCarrito/SeccionPago.tsx` (+ `.module.css`): sección con `h2` "Pago", botón primario "Pagar {formatearPrecio(total)}" / "Iniciando el pago…", y `AvisoOperacion` para destino inválido y error genérico con "Reintentar" (contracts/ui-pago.md). Recibe `total`, `emailGuardado`, `irAPago` y `enfocarEmail`. Con `emailGuardado === null` no llama a `irAPago`: muestra "Primero guardá el email para recibir las entradas." asociado con `aria-describedby` y llama a `enfocarEmail()` (research P10)
- [X] T031 [US1] Modificar `src/components/PantallaCarrito/EmailEntrega.tsx`: aceptar `campoRef` (ref al `input`) para que la pantalla pueda enfocarlo, y reemplazar el texto de "Qué sigue" por "Guardamos tu email: **{email}**. Ahí te mandamos las entradas cuando pagues." (FR-037)
- [X] T032 [US1] Modificar `src/components/PantallaCarrito/PantallaCarrito.tsx`: prop nueva `pagoSimulado: boolean`; en la vista `activo`, renderizar `SeccionPago` entre `EmailEntrega` y `AbandonoCarrito`, con `useIrAPago` y `enfocarEmail` que, si `EmailEntrega` está en modo "Qué sigue", no aplica (ya hay email) y si no, enfoca `campoRef`. Por ahora cualquier `Problema` del inicio de pago va a `aplicarError(problema, "pagar", activa)` y, si queda `error`, al aviso genérico de `SeccionPago` (US5 lo refina)
- [X] T033 [US1] Modificar `src/app/carritos/[carritoId]/page.tsx`: pasar `pagoSimulado={entorno.pagoSimulado}` a `PantallaCarrito`
- [X] T034 [US1] Crear `src/components/VueltaPago/useEsperaPago.ts` (`"use client"`, research P8): con `carritoId` y `token`, consulta al montar con `obtenerCarrito`; mientras `siguientePaso` diga `consultar`, programa la siguiente consulta `INTERVALO_CONSULTA_PAGO_MS` después de recibir la anterior (cadena de `setTimeout`, nunca superpuestas); cada respuesta ok hace `actualizarCarrito` y, si `cierraSesion(carrito)`, `cerrarSesion(carrito)`; error de red o desconocido no corta; `credencialPerdida` → descarta la sesión y devuelve fase `perdido`; con `document.hidden` no consulta y al volver (`visibilitychange`) consulta si la espera sigue viva; al desmontar cancela el timeout e ignora la respuesta en vuelo. Devuelve `{ fase, reiniciar }` con las fases de data-model.md "Espera de la página de vuelta"
- [X] T035 [US1] Crear `src/components/VueltaPago/VueltaPago.tsx` (+ `.module.css`, `"use client"`): lee la sesión con `useSyncExternalStore` como `PantallaCarrito`; usa `vistaPantalla`; con `pagado` muestra fase `listo` sin consultar; con `pagando` usa `useEsperaPago`; muestra los `h1` y textos de contracts/ui-pago.md para `esperando`, `listo` (con `ListaEntradas` y el email) y `vencido` (con `EnlaceEmpezarDeNuevo`); `cerrado` reutiliza `VistaLectura`; `perdido` reutiliza `VistaPerdido`. Región `role="status"` con el texto de la fase (cambia solo al cambiar de fase) y foco al `h1` al cambiar de fase, como en `PantallaCarrito` (research P13). Indicador de espera sin animación si `prefers-reduced-motion`
- [X] T036 [US1] Crear `src/app/carritos/[carritoId]/pago/page.tsx` y `page.module.css`: Server Component `force-dynamic`, `metadata` con `title: "Tu pago"` y `robots: { index: false, follow: false }`, `<noscript>` como en la página del carrito, y `<VueltaPago carritoId={carritoId} pagoSimulado={entorno.pagoSimulado} />`

**Checkpoint**: con MSW, pagar y ver las entradas funciona. La redirección simulada lleva a una
ruta que todavía no existe (US2).

---

## Phase 4: User Story 2 - Pago simulado en desarrollo (Priority: P1)

**Goal**: `/carritos/{id}/pago-simulado` con "Aprobar pago", "Rechazar pago" y "Pagar otro
monto", solo con `entorno.pagoSimulado`.

**Independent Test**: con el mock o el backend en modo simulado, iniciar el pago, aprobar y ver
las entradas; rechazar y ver que sigue en Pagando; con `npm start` sin `PAGO_SIMULADO` la ruta
responde 404.

### Tests for User Story 2 (escribirlos antes de implementar; deben fallar)

- [X] T037 [P] [US2] Crear `tests/components/PagoSimulado.test.tsx`: muestra "Simulación de desarrollo. No se cobra nada." y el total de la sesión; el campo "Monto a pagar" viene con `total.monto`; "Aprobar pago" envía `{ carritoId, estado: "Aprobado" }` sin `monto`, "Rechazar pago" `{ carritoId, estado: "Rechazado" }`, "Pagar otro monto" con `"100.50"` envía `monto: 100.5`; tras cada 200 llama a `router.push("/carritos/{id}/pago")`; con `"0"` muestra el error junto al campo y no envía; durante el envío los tres botones están deshabilitados; un 500 muestra "No pudimos registrar el pago simulado." y "Reintentar" repite el mismo pedido

### Implementation for User Story 2

- [X] T038 [US2] Crear `src/components/PagoSimulado/PagoSimulado.tsx` (+ `.module.css`, `"use client"`) según contracts/ui-pago.md "Página de pago simulado": cinta de texto de simulación, `h1` "Pago simulado", total si la sesión es de este carrito (sin sesión, funciona igual y el campo arranca vacío), campo con `label`, `inputmode="decimal"`, `aria-invalid` y `aria-describedby` al error; los tres botones llaman a `registrarPagoSimulado` (nunca con token) y, si sale bien, `router.push(rutaVuelta(carritoId))`; validación con `validarMontoSimulado`
- [X] T039 [US2] Crear `src/app/carritos/[carritoId]/pago-simulado/page.tsx` y `page.module.css`: `force-dynamic`, `metadata` con `title: "Pago simulado"` y `robots: { index: false, follow: false }`; si `!entorno.pagoSimulado` llama a `notFound()` antes de renderizar; si no, `<PagoSimulado carritoId={carritoId} />`
- [X] T040 [US2] Crear `tests/e2e/pago.spec.ts` (contra `mock-api.mjs`, con `PAGO_SIMULADO=1` de T007): cartelera → función → butacas → crear carrito → guardar email → "Pagar" → llega a `/pago-simulado` → "Aprobar pago" → `/pago` muestra "¡Listo!" con dos entradas; recargar `/carritos/{id}` muestra "Tu compra" (cubre también US6). Otro caso: "Rechazar pago" → `/pago` sigue en "Estamos confirmando tu pago…". En los dos, el token de `sessionStorage` no aparece en `page.url()` en ningún paso ni en los mensajes de consola
- [X] T041 [US2] Verificar a mano la 404 en producción: `npm run build && npm start` sin `PAGO_SIMULADO` y abrir `/carritos/x/pago-simulado` → 404 (SC-008). Dejar el resultado anotado en el PR (Playwright corre siempre con la variable activa)

**Checkpoint**: el recorrido manual del quickstart (pasos 1, 2, 4 y 5) funciona contra el backend.

---

## Phase 5: User Story 3 - Carrito bloqueado mientras se paga (Priority: P2)

**Goal**: en Pagando no se cambian butacas, email ni se abandona; "Pago en curso" visible;
`carrito-en-pago` lleva a ese modo.

**Independent Test**: con sesión `pagando`, abrir el carrito y el cambio de butacas y comprobar
el bloqueo; forzar `409 carrito-en-pago` en email y abandono.

### Tests for User Story 3 (escribirlos antes de implementar; deben fallar)

- [X] T042 [P] [US3] Ampliar `tests/components/PantallaCarrito.test.tsx`: con sesión `pagando` vigente, estado "Pago en curso", aviso "Pago en curso. Mientras pagás…", email como texto sin "Cambiar email", "Cambiar butacas" y "Abandonar carrito" con `aria-disabled="true"` y descripción accesible del aviso, que al activarlos no navegan ni abren la confirmación, y botón "Volver a la página de pago". Con sesión `conEmail` y `PUT email-entrega` → `409 carrito-en-pago` (y GET → `pagando`): se pasa a la vista `pagando`, se anuncia el aviso y la sesión conserva el token. Ídem con `POST abandono`
- [X] T043 [P] [US3] Ampliar `tests/components/CambioButacas.test.tsx`: con sesión `pagando`, `h1` "No podés cambiar las butacas", texto "Hay un pago en curso." y enlace "Volver al carrito"; no se pide el mapa. Con `PUT asientos` → `409 carrito-en-pago` desde una sesión activa, se vuelve al carrito sin descartar la credencial

### Implementation for User Story 3

- [X] T044 [US3] Modificar `src/components/PantallaCarrito/AbandonoCarrito.tsx`: prop `bloqueado?: { idMotivo: string }`; bloqueado, el botón "Abandonar carrito" lleva `aria-disabled="true"`, `aria-describedby={idMotivo}` y su `onClick` no hace nada
- [X] T045 [US3] Modificar `src/components/PantallaCarrito/EmailEntrega.tsx`: prop `soloLectura?: boolean` que muestra "Email de entrega: **{email}**" sin formulario ni "Cambiar email"
- [X] T046 [US3] Modificar `src/components/PantallaCarrito/PantallaCarrito.tsx`: renderizar la vista `pagando` (contracts/ui-pago.md): `h1` "Tu carrito", `CuentaRegresiva`, `ResumenCarrito` con "Pago en curso", aviso con `id` usado como motivo, "Cambiar butacas" como `<button aria-disabled="true">` con ese `aria-describedby`, `EmailEntrega soloLectura`, `SeccionPago` en modo "Volver a la página de pago" (texto en curso "Abriendo la página de pago…", mismo `useIrAPago`) y `AbandonoCarrito bloqueado`. En `aplicarError`, la transición `enPago` ejecuta `actualizar(actual)` y guarda un aviso "Pago en curso" que se muestra una vez en la vista `pagando`. La consulta al abrir (`consultado`) también corre en la vista `pagando`
- [X] T047 [US3] Modificar `src/components/CambioButacas/CambioButacas.tsx`: con vista `pagando` o `pagado`, en lugar del selector, `h1` "No podés cambiar las butacas", "Hay un pago en curso." o "Esta compra ya está pagada." y `Link` "Volver al carrito"; no pedir el mapa. Al recibir `carrito-en-pago` en el `PUT`, `router.push(rutaCarrito)` sin descartar la sesión
- [X] T048 [US3] Ampliar `tests/e2e/pago.spec.ts`: tras "Pagar" (sin elegir resultado), volver con `page.goBack()` o abrir `/carritos/{id}`: "Pago en curso", "Cambiar butacas" y "Abandonar carrito" bloqueados; `/carritos/{id}/butacas` muestra "No podés cambiar las butacas"

**Checkpoint**: quickstart paso 6 y 7.

---

## Phase 6: User Story 4 - Volver a pagar cuando el pago no se confirmó (Priority: P2)

**Goal**: "Volver a la página de pago" desde la vuelta, tope de 2 minutos con "Revisar de nuevo",
y contador en cero en Pagando sin declarar vencido.

**Independent Test**: con timers simulados, dejar Pagando hasta el tope y probar "Revisar de
nuevo" y "Volver a la página de pago"; llevar el contador de una sesión `pagando` a cero.

### Tests for User Story 4 (escribirlos antes de implementar; deben fallar)

- [X] T049 [P] [US4] Ampliar `tests/components/VueltaPago.test.tsx`: "Volver a la página de pago" está desde el primer render en `esperando`, hace `POST …/pago` y navega a la ruta simulada; con GET siempre Pagando, a los 120 s se deja de consultar (contar pedidos), `h1` "Todavía no se confirmó tu pago", y "Revisar de nuevo" consulta al instante y reinicia el tope (otros 120 s); con la pestaña oculta (`document.hidden` simulado) no se consulta y al disparar `visibilitychange` consulta enseguida
- [X] T050 [P] [US4] Ampliar `tests/components/PantallaCarrito.test.tsx`: con sesión `pagando` a 3 s de vencer, al avanzar el reloj a cero se llama a `router.push("/carritos/{id}/pago")`, la sesión conserva el token y no se muestra "Se terminó el tiempo"

### Implementation for User Story 4

- [X] T051 [US4] Modificar `src/components/VueltaPago/VueltaPago.tsx`: botón "Volver a la página de pago" con `useIrAPago` en las fases `esperando` y `sinConfirmar`; fase `sinConfirmar` con su `h1`, texto, `CuentaRegresiva` y "Revisar de nuevo" (llama a `reiniciar` de `useEsperaPago`); el contador en cero dentro de la vuelta (`useAlVencer` con `vigilar` en Pagando) dispara `reiniciar()` para consultar ya. Errores de `useIrAPago` → aviso genérico con "Reintentar" (los códigos los refina US5)
- [X] T052 [US4] Modificar `src/components/PantallaCarrito/PantallaCarrito.tsx` y `src/components/CambioButacas/CambioButacas.tsx`: `useAlVencer` cierra la sesión solo si el carrito guardado es `Activo`; si es `Pagando`, hace `router.push(rutaVuelta(carritoId))` (research P7)
- [X] T053 [US4] Ampliar `tests/e2e/pago.spec.ts`: tras "Rechazar pago", en `/pago` tocar "Volver a la página de pago" y llegar de nuevo a `/pago-simulado`; "Pagar otro monto" con un monto distinto del total deja `/pago` en "Estamos confirmando tu pago…"

**Checkpoint**: quickstart pasos 4, 8 y 9.

---

## Phase 7: User Story 5 - Errores al iniciar el pago (Priority: P2)

**Goal**: cada código del inicio de pago con su mensaje y su acción (FR-031).

**Independent Test**: con MSW, responder al `POST …/pago` con cada código y verificar mensaje y
acción.

### Tests for User Story 5 (escribirlos antes de implementar; deben fallar)

- [X] T054 [P] [US5] Ampliar `tests/components/PantallaCarrito.test.tsx` con un caso por fila de contracts/api-consumida.md "Errores nuevos" para la operación pagar: `email-entrega-faltante` (mensaje junto a "Pagar"; si el email estaba en "Qué sigue", se abre el formulario; el foco queda en el campo del email; sin navegación); `carrito-no-activo` con `estadoActual: "Expirado"` (GET → `expirado`: vista "Se terminó el tiempo") y con `"Pagado"` (GET → `pagado`: vista "Tu compra"); `carrito-modificado` (GET y aviso "Tu reserva cambió…"); `pago-no-disponible` (texto exacto "No pudimos iniciar el pago, probá de nuevo." y "Reintentar" repite el `POST`); `401` y `carrito-no-encontrado` ("No pudimos recuperar tu carrito" y sesión borrada); red (aviso sin conexión con reintento). En ninguno se llama a `window.location.assign` ni a `router.push`

### Implementation for User Story 5

- [X] T055 [US5] Modificar `src/components/PantallaCarrito/PantallaCarrito.tsx` y `SeccionPago.tsx`: resolver el `Problema` del inicio de pago con `aplicarError(problema, "pagar", activa)`:
  - `pedirEmail` → mensaje de falta de email y `enfocarEmail` (si el email estaba en "Qué sigue", abrir el formulario y enfocarlo);
  - `cerrar` → además de `cerrarSesion`, pedir `obtenerCarrito` con el token **antes** de cerrar para traer el carrito real (Pagado con entradas); si el GET falla, cerrar con `estadoActual`;
  - `releer` → `actualizar(activa)` y aviso "Tu reserva cambió mientras iniciábamos el pago. Revisala y tocá Pagar de nuevo.";
  - `error` con `pagoNoDisponible` → "No pudimos iniciar el pago, probá de nuevo." con "Reintentar"; resto de `error` → aviso genérico (con cinta si es sin conexión);
  - `perdido` → como hoy
- [X] T056 [US5] Aplicar la misma resolución en `src/components/VueltaPago/VueltaPago.tsx` para "Volver a la página de pago" (reutilizar la función de resolución en vez de duplicarla: extraerla a `src/components/PantallaCarrito/useIrAPago.ts` o a un helper del mismo directorio). En la vuelta, `pedirEmail` y `releer` no aplican en Pagando y caen en el aviso genérico

**Checkpoint**: SC-005.

---

## Phase 8: User Story 6 - Ver una compra cerrada (Priority: P3)

**Goal**: un carrito Pagado se ve siempre como compra cerrada con sus entradas.

**Independent Test**: sesión `pagado` con `venceEn` pasado en el carrito, la vuelta y el cambio de
butacas.

### Tests for User Story 6 (escribirlos antes de implementar; deben fallar)

- [X] T057 [P] [US6] Ampliar `tests/components/PantallaCarrito.test.tsx`: sesión `pagado` sin token y `venceEn` en el pasado → `h1` "Tu compra", estado "Pagado", entradas, sin `role="timer"`, sin cinta de peligro, sin "Cambiar butacas" ni "Abandonar carrito", y ningún pedido a la API. Ampliar `tests/components/VueltaPago.test.tsx`: sesión `pagado` → "¡Listo!" directo, sin pedidos

### Implementation for User Story 6

- [X] T058 [US6] Agregar `VistaPagado` a `src/components/PantallaCarrito/Vistas.tsx` (`h1` "Tu compra", `ResumenCarrito` con "Pagado", `ListaEntradas`, "Te mandamos las entradas a **{email}**.", `Link` "Ver la cartelera") y renderizarla en `PantallaCarrito.tsx` para la vista `pagado`; `AvisoTiempo` y `useAlVencer` no vigilan un carrito Pagado (depende de T028)
- [X] T059 [US6] Ajustar `src/components/CambioButacas/CambioButacas.tsx` si T047 no cubrió el caso sin token: la vista `pagado` sin token también muestra "Esta compra ya está pagada." y el enlace al carrito

**Checkpoint**: quickstart paso 3.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T060 [P] Ampliar `tests/e2e/accesibilidad.spec.ts`: axe sin violaciones en `/carritos/{id}` en Pagando y Pagado, en `/pago` (esperando y listo) y en `/pago-simulado`; a 360 px de ancho, sin scroll horizontal (`document.documentElement.scrollWidth <= 360`) en esas vistas
- [X] T061 [P] Ampliar `tests/e2e/pago.spec.ts` o `tests/e2e/sitemap-robots.spec.ts`: `/pago` y `/pago-simulado` llevan `<meta name="robots" content="noindex, nofollow">` y el HTML del servidor no contiene datos del carrito ni el token
- [X] T062 Ampliar `tests/e2e-api-real/compra.spec.ts` con un caso contra el backend real: crear carrito, guardar email, "Pagar", "Aprobar pago" y ver "¡Listo!" con una entrada por butaca cuyos códigos tengan formato `XXXXX-XXXXX`. Liberar con `abandonarEnApi` solo si no quedó Pagado. Actualizar el comentario de cabecera con el nuevo total de carritos por corrida (límite de 10 por IP cada 10 minutos)
- [X] T063 [P] Agregar a `specs/004-carrito-retencion/contracts/routes.md` las filas de `/carritos/{id}` en Pagando y Pagado y un enlace a `specs/005-pagar-carrito/contracts/routes.md`
- [X] T064 Correr las puertas de calidad: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`; con el backend levantado, `npm run test:e2e:api-real`
- [ ] T065 Recorrer a mano [quickstart.md](quickstart.md) sección 2 (pasos 1–10) contra el backend con `docker compose up` y verificar el email en Mailpit
- [X] T066 Preparar la descripción del PR: principios tocados (I con la excepción de `pagos-simulados.ts`, II, III, IV, VI, IX y la enmienda 1.2.0), cambio de FR-030 (las entradas se conservan sin token), y lo que hay que reportar al backend (`docs/api.md` sin los códigos nuevos; `MercadoPago:UrlRetorno` en `:5173`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T001 primero; T002–T004 en paralelo.
- **Foundational (Fase 2)**: depende de T001. Bloquea todas las historias.
- **US1 (Fase 3)**: depende de la Fase 2.
- **US2 (Fase 4)**: depende de la Fase 2. Su e2e (T040) necesita US1 para el recorrido completo.
- **US3 (Fase 5)**: depende de US1 (reutiliza `SeccionPago` y `useIrAPago` para "Volver a la página de pago").
- **US4 (Fase 6)**: depende de US1 (`VueltaPago`, `useEsperaPago`).
- **US5 (Fase 7)**: depende de US1; T056 depende también de US4 (T051).
- **US6 (Fase 8)**: depende de la Fase 2 y de `ListaEntradas` (T028).
- **Polish (Fase 9)**: después de las historias que se vayan a entregar.

### User Story Dependencies

- **US1 (P1)**: sin dependencias de otras historias. Testeable con MSW sola.
- **US2 (P1)**: independiente en código; el recorrido manual completo necesita US1.
- **US3, US4, US5 (P2)**: sobre US1. Entre sí se pueden hacer en paralelo salvo que tocan los mismos archivos (`PantallaCarrito.tsx`, `VueltaPago.tsx`): conviene hacerlas en orden US3 → US4 → US5.
- **US6 (P3)**: sobre la base y `ListaEntradas`.

### Within Each User Story

- Tests primero; deben fallar antes de implementar.
- Dominio y API (Fase 2) antes que componentes; componentes antes que páginas; e2e al final.
- Commit al cerrar cada tarea o grupo lógico.

### Parallel Opportunities

- Fase 1: T002, T003, T004.
- Fase 2: T005–T008 y T011 en paralelo; T012–T017 en paralelo; T019, T020 y T021 en paralelo.
- US1: T026, T027 y T028 en paralelo.
- US2: T037 en paralelo con cualquier tarea de US1 que no toque `PagoSimulado`.
- US3: T042 y T043 en paralelo.
- US6: T057 y T058 se pueden adelantar después de T028.
- Polish: T060, T061 y T063 en paralelo.

---

## Parallel Example: Fase 2

```text
Task: "T012 tests/unit/domain/pago.test.ts"
Task: "T013 tests/unit/domain/carrito.test.ts"
Task: "T014 tests/unit/domain/sesion-carrito.test.ts"
Task: "T015 tests/unit/api/carritos.test.ts"
Task: "T017 tests/unit/api/pagos-simulados.test.ts"
```

## Parallel Example: User Story 1

```text
Task: "T026 tests/components/PantallaCarrito.test.tsx (Pagar y redirección)"
Task: "T027 tests/components/VueltaPago.test.tsx (espera, Pagado, Expirado)"
Task: "T028 src/components/ListaEntradas/ListaEntradas.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Fase 1 y Fase 2.
2. US1: pagar, redirigir y ver las entradas (validado con MSW).
3. US2: página simulada, para validar el recorrido real contra el backend (quickstart pasos 1, 2,
   4 y 5).
4. **Parar y validar**: el objetivo de la feature (probar front + back a mano) ya se cumple.

US1 sola no alcanza para la prueba manual porque en desarrollo la `urlPago` es simulada; por eso
el MVP son las dos historias P1.

### Incremental Delivery

1. Base → US1 + US2 → MVP probable a mano.
2. US3 → el carrito no se puede romper durante el pago.
3. US4 → salida ante rechazos y demoras.
4. US5 → cada error con su mensaje.
5. US6 → compra cerrada en todas las pantallas.
6. Polish → accesibilidad, e2e contra la API real, PR.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- El token nunca va a `urlPago`, a `/pago-simulado` ni a `/api/dev/pagos-simulados` (T017 y el
  handler de T010 lo verifican).
- `src/api/schema.d.ts` no se edita a mano; `src/api/pagos-simulados.ts` es la única excepción de
  tipos escritos a mano y está documentada.
- Commit al cerrar cada tarea o grupo lógico; parar en cada checkpoint para validar.
