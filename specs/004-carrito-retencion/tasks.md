---

description: "Tareas de implementación: carrito con retención corta"
---

# Tasks: Carrito con retención corta

**Input**: documentos de diseño en `specs/004-carrito-retencion/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: solo los que fija la tabla "Qué se testea y qué no" de `plan.md` (Principio VII). La
spec los pide de forma explícita para la cuenta regresiva y el vencimiento, el guardado y
descarte del token, las transiciones de estado del carrito, la selección completa en el `PUT` y
el manejo de cada `codigo`. Los CSS Modules, la configuración, los fixtures y la ampliación del
mock no llevan test propio.

**Organization**: tareas agrupadas por historia de usuario.
- La Fase 2 deja listos el transporte con `PUT` y hora del servidor, las cuatro operaciones del
  carrito, la sesión v2, la lógica de la cuenta regresiva y los datos de prueba.
- US1 entrega la pantalla con resumen, contador y vencimiento, con un error genérico para
  cualquier fallo.
- US2 agrega el email y el bloque "Qué sigue".
- US3 agrega el cambio de butacas.
- US4 agrega el abandono.
- US5 agrega el manejo de cada `codigo` de credencial y estado, y la cinta de "Sin conexión".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de `spec.md` (US1 a US5)
- Proyecto único en la raíz: `src/`, `tests/`, `scripts/`

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: confirmar el punto de partida. No hay dependencias nuevas ni configuración que
crear.

- [X] T001 Correr `npm run gen:api` y confirmar que `src/api/schema.d.ts` no cambia: el contrato de `docs/openapi.json` ya trae `CarritoResponse`, `ReemplazarAsientosRequest` y `EmailEntregaRequest`. Si cambia, versionar el archivo regenerado y resolver los errores de `npm run typecheck` antes de seguir (Principio I)
- [X] T002 Resolver el modo de antislop siguiendo `CLAUDE.md` (sección "antislop": instrucción explícita de la sesión, después la preferencia global, después preguntar) y leer `.claude/skills/antislop/SKILL.md`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile` y `antislop-copywriting` antes de la primera tarea de UI (T027). El dial del flujo privado es 1/1/1 (DESIGN.md §11, research C14)

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: el borde con la API, la sesión y la lógica pura que usan las cinco historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Configuración y datos de prueba

- [X] T003 [P] Ampliar `src/config/experiencia.ts` con `export const AVISO_VENCIMIENTO_MS = 2 * 60 * 1000;` debajo de `MAX_BUTACAS_POR_COMPRA`. El comentario de arriba ya dice que son valores de experiencia (Principio IV, FR-013)
- [X] T004 [P] Crear `tests/fixtures/carritos-estados.json` con respuestas `CarritoResponse` completas, indexadas por nombre: `activo` (el mismo `id`, `funcion`, `asientos` F8 y F9, `precioUnitario` y `total` que `carritos.json`, `emailEntrega: null`), `conEmail` (igual con `emailEntrega: "comprador@ejemplo.com"`), `abandonado` (`estado: "Abandonado"`, `abandonadoEn` ISO) y `expirado` (`estado: "Expirado"`). No tocar `carritos.json`, que usan los tests de la 003
- [X] T005 Ampliar `tests/fixtures/index.ts`:
  - exportar `carritosEstados` tipado con `satisfies Record<string, Schemas["CarritoResponse"]>`;
  - exportar `ID_CARRITO` (el `id` de `carritos.json`), `ID_CARRITO_AJENO` (otro GUID) y `TOKEN_PRUEBA` (`carritoCreado.token`);
  - exportar `sesionDePrueba(carrito, cambios?)`, que arma una `SesionCarrito` v2 (`version: 2`, `token: TOKEN_PRUEBA`, `desfaseMs: 0`) a partir de una respuesta de `carritosEstados` mapeada, y `guardarSesionDePrueba(...)`, que la escribe en `sessionStorage` con la clave `randomplay:carrito`;
  - exportar `conVencimiento(carrito, ms, ahora)`, que devuelve una copia con `venceEn` a `ms` milisegundos de `ahora`, en ISO con `-03:00`.

  Depende de T004
- [X] T006 Ampliar `tests/msw/handlers.ts` con los handlers del carrito sobre `*/api/carritos/...`:
  - todos responden `401` sin cuerpo si falta `Authorization` o el token no es `Bearer ${TOKEN_PRUEBA}`, y `404` `carrito-no-encontrado` si `:carritoId` no es `ID_CARRITO`;
  - `GET */api/carritos/:carritoId`: `carritosEstados.activo`;
  - `PUT */api/carritos/:carritoId/asientos`: devuelve `activo` con los `asientos` del cuerpo y el `total` recalculado en centavos, sin cambiar `venceEn`;
  - `PUT */api/carritos/:carritoId/email-entrega`: devuelve `activo` con `emailEntrega` del cuerpo;
  - `POST */api/carritos/:carritoId/abandono`: reemplazar el handler actual por uno que devuelve `carritosEstados.abandonado` (el abandono previo de la 003 sigue ignorando la respuesta);
  - todas las respuestas llevan el header `Date` con `new Date().toUTCString()` (con timers simulados, toma la hora simulada).

  Depende de T005
- [X] T007 Ampliar `scripts/mock-api.mjs` (herramienta de los e2e; **no** es el modo `API_MOCK=1`):
  - guardar los carritos en memoria en un `Map` por `id`, con su token, desde `POST /api/funciones/{id}/carritos`; el token de cada carrito nuevo es `token-de-prueba-no-real-{n}` y `venceEn` es ahora + 5 min;
  - `GET /api/carritos/{id}`, `PUT .../asientos`, `PUT .../email-entrega` y `POST .../abandono` con las mismas reglas que T006 (`401` sin token o con token de otro carrito, `404 carrito-no-encontrado` si no existe);
  - un carrito con `venceEn` pasado responde `estado: "Expirado"`, y cualquier cambio responde `409 carrito-no-activo` con `estadoActual`;
  - los carritos **no** restan butacas del mapa: los e2e corren en paralelo contra un solo mock y chocarían por las mismas butacas. La liberación de butacas al abandonar se valida contra el backend real (quickstart, recorrido 12);
  - aceptar `PUT` (hoy responde `405`) y agregar el header `Date`.

  Mantener el log de método, ruta y status sin imprimir cuerpos ni headers

### Tests de la base (escribirlos antes de implementar; deben fallar)

- [X] T008 [P] Ampliar `tests/unit/api/problema.test.ts`: `carrito-no-activo` con `estadoActual: "Expirado"` lo conserva; un `estadoActual` que no es string se descarta; los demás códigos no lo traen; un `401` sin cuerpo da `tipo: "desconocido"` con `status: 401`
- [X] T009 [P] Ampliar `tests/unit/api/navegador.test.ts`:
  - `metodo: "PUT"` envía el cuerpo JSON con `Content-Type`;
  - un éxito con header `Date` da `horaServidorMs` igual a `Date.parse` del header y `recibidoEnMs` igual al reloj simulado;
  - sin header `Date`, o con uno ilegible, `horaServidorMs` es `null`;
  - un error con respuesta también trae `horaServidorMs`; un fallo de red no;
  - el token nunca aparece en el `problema`
- [X] T010 [P] Ampliar `tests/unit/api/carritos.test.ts` con MSW:
  - `obtenerCarrito`, `reemplazarAsientos`, `indicarEmail` y `abandonarCarrito` mandan `Authorization: Bearer token-de-prueba-no-real` y piden a `/api/carritos/{encodeURIComponent(id)}/…`;
  - `reemplazarAsientos(id, token, [F7, F9])` envía exactamente `{ "asientos": [F7, F9] }`, la selección completa;
  - `indicarEmail` envía `{ "email": "…" }`;
  - las cuatro mapean la respuesta a `Carrito` completo (`precioUnitario`, `emailEntrega`, `abandonadoEn`, `numero` normalizado a entero) y pasan `horaServidorMs`;
  - `crearCarrito` sigue mapeando el 201 con el `Carrito` completo
- [X] T011 [P] Ampliar `tests/unit/domain/sesion-carrito.test.ts` (cambiar los fixtures de `version: 1` a la v2):
  - `guardarSesion` y `leerSesion` con la v2;
  - una sesión `version: 1` se lee como `null`;
  - `actualizarCarrito` reemplaza `carrito` y `desfaseMs` y conserva el token; con otro `carritoId` no hace nada;
  - `cerrarSesion` deja `token` y `tokenVenceEn` en `null` y conserva el carrito;
  - `descartarSesion` borra la clave;
  - con el almacenamiento bloqueado (`setItem` que lanza), ninguna función lanza
- [X] T012 [P] Crear `tests/unit/domain/cuenta-regresiva.test.ts`:
  - `medirDesfase(1000, 400)` da `600`; `medirDesfase(null, 400)` da `0`; un desfase de 13 h da `0`;
  - `restanteMs` con `venceEn` a 9:42 da 582000 ms; con desfase de +3 min da 3 min menos; con `venceEn` pasado o ilegible da `0`;
  - `tramo`: 2:01 → `"normal"`, 2:00 → `"final"`, 1 ms → `"final"`, 0 → `"vencido"`;
  - `formatearContador`: 582000 → `"09:42"`, 581001 → `"09:42"` (hacia arriba), 1 → `"00:01"`, 0 → `"00:00"`, 75 min → `"75:00"`;
  - `describirRestante`: "Quedan 4 minutos y 12 segundos", "Queda 1 minuto", "Quedan 30 segundos", "Queda 1 segundo"
- [X] T013 [P] Crear `tests/unit/domain/carrito.test.ts` con la base: `etiquetaEstado` para `Activo`, `Abandonado`, `Expirado` ("Vencido") y un valor desconocido ("Estado desconocido"); `esModificable` solo con `Activo` y tramo distinto de `vencido`; `credencialPerdida` para `carrito-no-encontrado`, para `status: 401` y no para `carrito-no-activo` ni `red`

### Implementación de la base

- [X] T014 Ampliar `src/api/navegador.ts` (research C3): `metodo` acepta `"PUT"`; `Resultado<T>` suma `horaServidorMs: number | null` y `recibidoEnMs: number` en el éxito y en el error con respuesta (en el de red, `horaServidorMs: null`). Leer `respuesta.headers.get("Date")` con `Date.parse` y devolver `null` si da `NaN`. Debe pasar T009
- [X] T015 [P] Ampliar `src/api/problema.ts`: `Problema` suma `estadoActual?: string`, leído solo si `codigo === "carrito-no-activo"` y el valor es string. Debe pasar T008
- [X] T016 Reescribir los tipos de `src/api/carritos.ts` (research C3, data-model.md "Carrito"):
  - `type CarritoApi = components["schemas"]["CarritoResponse"]` y `export type Carrito` con todos los campos menos `creadoEn`;
  - `mapearCarrito(api): Carrito` compartido; `CarritoCreado` pasa a `{ token, tokenVenceEn, carrito: Carrito }`;
  - nuevas `obtenerCarrito(carritoId, token)`, `reemplazarAsientos(carritoId, token, asientos)` e `indicarEmail(carritoId, token, email)`, todas con `encodeURIComponent(carritoId)`, que devuelven `Resultado<Carrito>`;
  - `abandonarCarrito` pasa a devolver `Resultado<Carrito>` y mantiene `timeoutMs` como parámetro opcional (3000 para el abandono previo de la 003, 8000 por defecto).

  Depende de T014. Debe pasar T010
- [X] T017 Pasar `src/domain/sesion-carrito.ts` a la versión 2 (research C2):
  - `SesionCarrito = { version: 2; carritoId; token: string | null; tokenVenceEn: string | null; carrito: Carrito; desfaseMs: number }`;
  - `parsearSesion` valida la v2 (incluido `typeof desfaseMs === "number"` y `token` string o `null`) y devuelve `null` para la v1;
  - nuevas `actualizarCarrito(carrito, desfaseMs)` y `cerrarSesion(carrito?)`.

  Ningún `console.*` con el contenido. Depende de T016. Debe pasar T011
- [X] T018 Adaptar `src/components/SelectorButacas/SelectorButacas.tsx` y su test a la sesión v2:
  - al crear, guardar `{ version: 2, …, desfaseMs: medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs) }`;
  - el abandono previo (FR-032 de la 003) se llama solo si `anterior.token` no es `null`. Una sesión cerrada se descarta sin pedir nada;
  - en `tests/components/SelectorButacas.test.tsx`, cambiar la sesión de `version: 1` a la v2 y agregar el caso "sesión cerrada: no se llama a abandono".

  Depende de T017 y T019. Todos los tests existentes de `SelectorButacas` deben seguir pasando
- [X] T019 [P] Crear `src/domain/cuenta-regresiva.ts` con `medirDesfase`, `restanteMs`, `tramo`, `formatearContador` y `describirRestante` (research C4), usando `AVISO_VENCIMIENTO_MS`. Funciones puras: reciben `ahoraMs` como parámetro. Depende de T003. Debe pasar T012
- [X] T020 [P] Crear `src/domain/carrito.ts` con `etiquetaEstado`, `esModificable` y `credencialPerdida` (research C7). Comentario de una línea arriba: estado del carrito y decisiones por `codigo` (Principios II y IV). Debe pasar T013
- [X] T021 [P] Agregar a `src/app/globals.css` la clase `.cinta-peligro`: bloque de 8 px de alto, ancho completo, `background: repeating-linear-gradient(-45deg, var(--telon) 0 10px, var(--ink) 10px 20px)` (paradas duras, research C6), sin animación. Comentario de una línea: "Solo carrito vencido o sin conexión (DESIGN.md §6.5)"

**Checkpoint**: la base está lista. `npm test` pasa T008–T013 y los tests de la 003.

---

## Phase 3: User Story 1 - Ver la reserva y cuánto tiempo queda (Priority: P1) 🎯 MVP

**Goal**: `/carritos/{id}` muestra el carrito real con la cuenta regresiva, pasa a vencido al
llegar a cero y muestra el modo lectura para carritos cerrados.

**Independent Test**: crear un carrito desde el mapa, ver los datos de la API y el contador
coincidiendo con `venceEn`; con el reloj simulado, verificar el cambio de color, los dos avisos y
el paso a vencido.

### Tests for User Story 1 (escribirlos antes de implementar; deben fallar)

- [X] T022 [P] [US1] Ampliar `tests/unit/domain/carrito.test.ts` con `reducirPantalla` (data-model.md "Estado de la pantalla"): `sinLeer` → `sinSesion` sin sesión o con otro id; → `activo` con sesión con token; → `lectura` con sesión sin token; `activo` + carrito de la API con `estado` distinto de `Activo` → `lectura`; `activo` + `vencio` → `lectura` con motivo vencido; `lectura` no vuelve a `activo`
- [X] T023 [P] [US1] Crear `tests/components/PantallaCarrito.test.tsx` (vistas y contador), con `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })`, `vi.setSystemTime` y `guardarSesionDePrueba`:
  - sin sesión, o con sesión de `ID_CARRITO_AJENO`: `heading` nivel 1 "No hay un carrito activo en esta pestaña", enlace "Ver la cartelera" y **ningún** pedido a `*/api/carritos/*` (verificar con un handler espía de MSW);
  - con sesión activa: muestra enseguida los datos guardados y después los del `GET` (cambiar `peliculaTitulo` en el handler para distinguirlos); se ven película, sucursal, sala, fecha y hora, "Fila F, butaca 8", precio por entrada, total y estado "Activo";
  - contador: con `venceEn` a 9:42, el `timer` muestra `09:42` y su texto accesible dice "Quedan 9 minutos y 42 segundos"; tras `vi.advanceTimersByTime(1000)` muestra `09:41`;
  - tramos: al llegar a `02:00` el contador tiene la clase del tramo final y la región `status` dice una vez el aviso de 2 minutos; al llegar a `00:00` el `h1` pasa a "Se terminó el tiempo", el foco va al `h1`, aparece la cinta (`.cinta-peligro`), la región `status` dice el aviso de vencimiento y la sesión queda con `token: null`;
  - en una retención completa de 5 minutos, la región `status` recibe exactamente 2 textos (SC-003);
  - desfase: con el header `Date` del `GET` 3 minutos adelantado respecto del reloj simulado, el contador muestra 3 minutos menos;
  - salto del reloj: `vi.setSystemTime(+60 s)` sin correr timers y un `visibilitychange` → el contador muestra el tiempo real;
  - con `venceEn` ya pasado al abrir: vencido de entrada, aunque el `GET` diga `Activo`;
  - el `GET` responde `Abandonado` o `Expirado`: modo lectura con su estado y sin "Cambiar butacas";
  - sesión sin token: modo lectura sin pedir nada;
  - el `GET` falla con 500: se sigue viendo el carrito guardado, con un `alert` y "Reintentar"
- [X] T024 [P] [US1] Crear `tests/e2e/carrito.spec.ts` (primera parte):
  - de `/funciones/{ID_FUNCION_8X12}` elegir F8 y F9 y confirmar; en `/carritos/{id}` se ven el `h1` "Tu carrito", las dos butacas, el total y el contador;
  - el pedido a `/api/carritos/{id}` lleva `Authorization: Bearer` (`page.waitForRequest`);
  - el token no aparece en `page.url()`, en el HTML de `GET /carritos/{id}` (`request.get`) ni en la consola (espía de `console` como en `butacas.spec.ts`);
  - `meta robots` `noindex, nofollow` y `Cache-Control` con `no-store`;
  - con `page.clock.install()` antes de navegar y `page.clock.runFor`, el contador llega a `02:00` y a `00:00`; al recargar sigue "Se terminó el tiempo";
  - la misma URL en una página nueva del mismo contexto muestra "No hay un carrito activo en esta pestaña"
- [X] T025 [US1] Actualizar los tests que esperaban el destino provisorio: borrar `tests/components/CarritoCreado.test.tsx` y cambiar el `h1` esperado de "Tu carrito quedó creado" a "Tu carrito" en `tests/e2e/butacas.spec.ts` y `tests/e2e/accesibilidad.spec.ts`

### Implementation for User Story 1

- [X] T026 [US1] Agregar `reducirPantalla` y el tipo `EstadoPantalla` a `src/domain/carrito.ts`, con las vistas `sinLeer`, `sinSesion`, `activo` y `lectura` y el sub-estado de actualización (`actualizando`, `alDia`, `fallo`). Acciones: `sesionLeida`, `carritoRecibido`, `actualizacionFallo`, `vencio`. Debe pasar T022
- [X] T027 [P] [US1] Crear `src/components/CuentaRegresiva/useCuentaRegresiva.ts` y `CuentaRegresiva.tsx` + `CuentaRegresiva.module.css` (`"use client"`, research C4 y C5):
  - el hook recibe `venceEn`, `desfaseMs` y `onVencer`; recalcula con `restanteMs(…, Date.now())` en cada tic; programa el tic con `setTimeout` al próximo cambio de segundo; recalcula en `visibilitychange` y `focus`; llama a `onVencer` una sola vez;
  - el componente renderiza el rótulo "Tus butacas están reservadas por", un `role="timer"` con el `MM:SS` visible en `.counter` (`aria-hidden`) y el texto de `describirRestante` en `.visualmente-oculto`, y una región `role="status"` aparte que recibe solo los dos avisos (con un `useRef` para no repetirlos);
  - CSS: `--oro` en tramo normal y `--telon-ink` en tramo final, sin `transition` ni animación
- [X] T028 [US1] Crear `src/components/PantallaCarrito/PantallaCarrito.tsx` y `PantallaCarrito.module.css` (`"use client"`, research C1):
  - lee la sesión con `useSyncExternalStore` como `CarritoCreado` (snapshot del servidor `"sin-leer"`) y despacha `sesionLeida`;
  - con sesión activa llama a `obtenerCarrito(sesion.carritoId, sesion.token)` una vez al montar, y con la respuesta llama a `actualizarCarrito(carrito, medirDesfase(…))` o a `cerrarSesion(carrito)` si `estado` no es `Activo`;
  - `onVencer` → `cerrarSesion()` y `vencio`;
  - vistas según contracts/routes.md: `activo` con `h1` "Tu carrito", `CuentaRegresiva`, resumen en `<dl>` (fecha y hora con `formatearFecha` y `formatearHora` dentro de `<time dateTime>`, butacas en lista, precios con `formatearPrecio`, estado con `etiquetaEstado`) en `--surface` con sombra dura; `lectura` con `h1` "Abandonaste el carrito" / "Se terminó el tiempo" / "Este carrito ya no está activo", cinta solo si está vencido, el resumen y el enlace "Elegir otra función" a `/peliculas/{peliculaId}#titulo-horarios`; `sinSesion` con el texto que hoy tiene `CarritoCreado`;
  - cada `h1` con `tabIndex={-1}`; al cambiar de vista, foco al `h1` (research C12);
  - error del `GET`: `alert` "No pudimos actualizar tu carrito. Probá de nuevo." con "Reintentar".

  Depende de T026 y T027. Debe pasar T023
- [X] T029 [US1] En `src/app/carritos/[carritoId]/page.tsx`, reemplazar `CarritoCreado` por `PantallaCarrito` (mantener `force-dynamic`, metadata y `<noscript>`) y borrar `src/components/CarritoCreado/`. Depende de T028. Deben pasar T024 y T025
- [X] T030 [P] [US1] Actualizar las filas de `/carritos/{carritoId}` en `specs/003-mapa-butacas/contracts/routes.md` con un enlace a `specs/004-carrito-retencion/contracts/routes.md`

**Checkpoint**: US1 funciona sola: el carrito se ve, cuenta y vence.

---

## Phase 4: User Story 2 - Cargar el email y saber qué sigue (Priority: P1)

**Goal**: el comprador guarda el email de entrega y lee qué pasa ahora, sin ninguna simulación de
pago.

**Independent Test**: enviar un email mal formado, uno que la API rechace con `pedido-invalido` y
uno válido; verificar el mensaje junto al campo en los dos primeros y el bloque "Qué sigue" en el
tercero.

### Tests for User Story 2 (escribirlos antes de implementar; deben fallar)

- [X] T031 [P] [US2] Crear `tests/unit/domain/email.test.ts`: `"  a@b.co  "` da `{ ok: true, email: "a@b.co" }`; `""` y `"   "` dan "Escribí tu email."; `"nombre@"`, `"@ejemplo.com"`, `"a b@c.com"` y `"a@b"` dan el mensaje de formato; 255 caracteres da error y 254 no
- [X] T032 [P] [US2] Ampliar `tests/components/PantallaCarrito.test.tsx` (email):
  - el `textbox` "Email para recibir las entradas" y el botón "Guardar email" existen; con `conEmail` el campo viene precargado y se ve "Qué sigue";
  - vacío o `"nombre@"`: no hay `PUT` (handler espía), el mensaje aparece junto al campo, `aria-invalid="true"`, `aria-describedby` apunta al mensaje y el foco queda en el campo;
  - `pedido-invalido` con `errors: { Email: ["…"] }`: el mensaje va junto al campo y el texto escrito se conserva; con `errors: { otro: ["…"] }` va como aviso general;
  - éxito: el `PUT` lleva `{ "email": "comprador@ejemplo.com" }` recortado; se ve la `region` "Qué sigue" con el email y los textos "El pago todavía no está disponible" y "no se emiten ni envían entradas"; el foco va a su `h3`; no aparece ningún texto con "compra confirmada", "orden" ni "pagar";
  - "Cambiar email" vuelve al formulario con el email cargado;
  - dos clics seguidos en "Guardar email" con el handler demorado (`delay`) mandan un solo `PUT`;
  - error 500: `alert` con "Reintentar" y el texto se conserva
- [X] T033 [P] [US2] Ampliar `tests/e2e/carrito.spec.ts`: guardar `nombre@` muestra el error sin pedido; guardar un email válido muestra "Qué sigue"; al recargar, el email sigue guardado

### Implementation for User Story 2

- [X] T034 [P] [US2] Crear `src/domain/email.ts` con `validarEmail` (research C9). Debe pasar T031
- [X] T035 [US2] Crear `src/components/PantallaCarrito/EmailEntrega.tsx` (`"use client"`):
  - `<section aria-labelledby>` con `h2` "Email de entrega";
  - `<form noValidate>` con `<label>` visible, `<input type="email" autoComplete="email" inputMode="email">`, mensaje con `id` asociado por `aria-describedby`, `aria-invalid` con error y botón primario "Guardar email" / "Guardando…";
  - valida con `validarEmail`; si falla, mensaje y foco en el campo; si pasa, llama a `onGuardar(email)` y bloquea el doble envío con una ref;
  - con `emailEntrega`: `section` con `h3` "Qué sigue", el email y el texto de FR-028, y el botón secundario "Cambiar email".

  Depende de T034
- [X] T036 [US2] Integrar `EmailEntrega` en `PantallaCarrito`: sub-estado de email en `reducirPantalla` (`editando`, `guardando`, `guardado`, `invalido`, `fallo`); `onGuardar` llama a `indicarEmail(sesion.carritoId, sesion.token, email)` y con el 200 llama a `actualizarCarrito`; `pedido-invalido` reparte `errors` entre el campo (`email` sin distinguir mayúsculas) y el aviso general; el resto de los fallos da error genérico con "Reintentar". "Guardar email" es el único botón rojo de la vista. Depende de T035. Deben pasar T032 y T033

**Checkpoint**: US1 + US2 forman el carrito mínimo con final del flujo.

---

## Phase 5: User Story 3 - Cambiar las butacas sin perder el lugar (Priority: P2)

**Goal**: desde el carrito, volver al mapa con las butacas propias seleccionadas y reemplazar la
selección completa sin extender el vencimiento.

**Independent Test**: con F8 y F9, quitar la F9, agregar la F10 y guardar; la API recibe
exactamente F8 y F10, el carrito las muestra y el vencimiento no cambió.

### Tests for User Story 3 (escribirlos antes de implementar; deben fallar)

- [X] T037 [P] [US3] Ampliar `tests/unit/domain/butacas.test.ts`:
  - `marcarPropias` pasa F8 y F9 ocupadas a libres e ignora una butaca que no existe;
  - `estadoInicial(filas, [F8, F9])` arranca con esa selección;
  - `mismaSeleccion([F8, F9], [F9, F8])` es `true`; con una distinta o de otro largo, `false`
- [X] T038 [P] [US3] Crear `tests/components/CambioButacas.test.tsx` (con `vi.mock("next/navigation")` como en `SelectorButacas.test.tsx`):
  - sin sesión: "No hay un carrito activo en esta pestaña" y ningún pedido;
  - con sesión: estado de carga y después el mapa con "Fila F, butaca 8, seleccionada" y "Fila F, butaca 9, seleccionada" (nunca "ocupada"), el `h1` "Cambiá tus butacas", el `timer` y el enlace "Volver al carrito";
  - "Guardar 2 butacas" está deshabilitado sin cambios; al quitar la F9 y agregar la F10 se habilita;
  - el `PUT` lleva exactamente `{ "asientos": [F8, F10] }` (capturar el cuerpo en el handler); con el 200, la sesión tiene las butacas nuevas, el mismo `venceEn` y `push("/carritos/{id}")`;
  - quitar todas: el botón queda deshabilitado y se ve "Para no quedarte con ninguna butaca, abandoná el carrito." con el enlace "Ir al carrito";
  - `asientos-no-disponibles` con la F10: el mapa se vuelve a pedir, la F10 sale, la F8 sigue seleccionada y el aviso dice "Alguien tomó la F10 antes que vos…" (la F7 ya está ocupada en la sala de 8 × 12);
  - `pedido-invalido`, `funcion-sin-cupo`, `funcion-no-disponible` y `asientos-inexistentes` se comportan como en la 003;
  - el contador llega a cero durante el cambio: la sesión queda con `token: null` y `push("/carritos/{id}")`
- [X] T039 [P] [US3] Ampliar `tests/e2e/carrito.spec.ts`: "Cambiar butacas", quitar una, agregar otra, guardar; el `PUT` lleva la selección completa (`page.waitForRequest` + `postDataJSON()`); el carrito muestra las butacas nuevas y el contador no se reinició

### Implementation for User Story 3

- [X] T040 [P] [US3] Ampliar `src/domain/butacas.ts` con `marcarPropias(filas, asientos)`, el segundo parámetro opcional `seleccionInicial` de `estadoInicial` (filtrado con `conservarLibres`) y `mismaSeleccion(a, b)` (data-model.md "Selección en el cambio de butacas"). Debe pasar T037
- [X] T041 [US3] Dividir `src/components/SelectorButacas/SelectorButacas.tsx` (research C8):
  - extraer la parte común a `SelectorComun.tsx` en la misma carpeta: mapa, reducer, refresco tras conflicto, `Aviso` y panel "Tu selección". Recibe `mapa`, `seleccionInicial?`, `propias?` (se aplica `marcarPropias` al mapa inicial y a cada refresco), `textoBoton(n)`, `textoEnviando`, `deshabilitar?(seleccion)`, un nodo `pie?` para contenido extra y `ejecutar(seleccion) → Promise<{ ok: true } | { ok: false; problema }>`. Más una prop `resolverPropio?(problema) → boolean` para los códigos que decide la estrategia;
  - `SelectorButacas` queda como envoltorio con la estrategia de crear (almacenamiento, abandono previo, `crearCarrito`, `guardarSesion`, `router.push`) y los mismos textos que hoy.

  Depende de T040. Todos los tests de `SelectorButacas.test.tsx` deben seguir pasando sin cambios
- [X] T042 [US3] Crear `src/components/CambioButacas/CambioButacas.tsx` y `CambioButacas.module.css` (`"use client"`):
  - lee la sesión como `PantallaCarrito`; sin sesión válida o con el carrito cerrado, muestra la vista equivalente;
  - pide `obtenerMapaDesdeNavegador(sesion.carrito.funcion.funcionId)` con un estado de carga;
  - renderiza "Volver al carrito", `h1` "Cambiá tus butacas", `CuentaRegresiva` (con `onVencer` → `cerrarSesion()` y `router.push`), la cabecera con los datos del carrito y `SelectorComun` con `propias` y `seleccionInicial` = `carrito.asientos`, `textoBoton` "Guardar N butacas" / "Guardar 1 butaca", `deshabilitar` = vacía o `mismaSeleccion` con el carrito, y el aviso de selección vacía;
  - `ejecutar` llama a `reemplazarAsientos(sesion.carritoId, sesion.token, seleccion)`; con el 200, `actualizarCarrito` y `router.push("/carritos/{id}")`.

  Depende de T041. Debe pasar T038
- [X] T043 [US3] Crear `src/app/carritos/[carritoId]/butacas/page.tsx` y `page.module.css`: Server Component con `force-dynamic`, `metadata` `{ title: "Cambiar butacas", robots: { index: false, follow: false } }`, `<noscript>` y la isla `CambioButacas`. No recibe datos del carrito. Depende de T042
- [X] T044 [US3] Agregar a la vista `activo` de `PantallaCarrito` el enlace "Cambiar butacas" (`next/link` a `/carritos/{id}/butacas`) debajo del resumen. Al volver, el foco va al `h1` "Tu carrito" (research C12). Depende de T043. Debe pasar T039

**Checkpoint**: el comprador puede corregir la selección sin rehacer el carrito.

---

## Phase 6: User Story 4 - Abandonar el carrito (Priority: P2)

**Goal**: el comprador abandona el carrito con confirmación y las butacas quedan libres en el
momento. Cerrar o recargar la pestaña no abandona.

**Independent Test**: abandonar un carrito activo y verificar que la API lo informa
`Abandonado`, que el mapa muestra las butacas libres y que la credencial ya no está en la pestaña.

### Tests for User Story 4 (escribirlos antes de implementar; deben fallar)

- [X] T045 [P] [US4] Ampliar `tests/components/PantallaCarrito.test.tsx` (abandono):
  - "Abandonar carrito" abre el `group` "Confirmar abandono" con el texto de research C11 y el foco en "Seguir con mi carrito";
  - Escape o "Seguir con mi carrito" lo cierran y devuelven el foco a "Abandonar carrito", sin pedido;
  - "Sí, abandonar": un solo `POST` aunque se toque dos veces; con el 200, `h1` "Abandonaste el carrito", el foco en el `h1`, la sesión con `token: null` y sin cinta;
  - fallo de red: el carrito sigue activo, `alert` con "Reintentar" y el token sigue guardado;
  - montar y desmontar la pantalla nunca registra `pagehide`, `beforeunload` ni `unload` (espía de `window.addEventListener`) ni llama a `navigator.sendBeacon` (FR-033)
- [X] T046 [P] [US4] Ampliar `tests/e2e/carrito.spec.ts`: recargar un carrito activo no dispara `POST .../abandono` (`page.on("request")`) y lo deja activo; "Abandonar carrito" → "Sí, abandonar" muestra "Abandonaste el carrito" y la sesión queda sin token (la liberación en el mapa se valida contra el backend real, ver T007)

### Implementation for User Story 4

- [X] T047 [US4] Crear `src/components/PantallaCarrito/AbandonoCarrito.tsx` (`"use client"`, research C11): `<section aria-labelledby>` con `h2` "¿No vas a seguir?", botón secundario "Abandonar carrito" y, al tocarlo, un `role="group"` con `aria-label="Confirmar abandono"`, el texto y los botones "Sí, abandonar" y "Seguir con mi carrito". Foco y Escape según contracts/ui-carrito.md. Los botones se deshabilitan durante el pedido
- [X] T048 [US4] Integrar `AbandonoCarrito` en `PantallaCarrito`: sub-estado de abandono en `reducirPantalla` (`inactivo`, `confirmando`, `abandonando`, `fallo`); al confirmar, `abandonarCarrito(sesion.carritoId, sesion.token)`; con el 200, `cerrarSesion(carrito)` y vista `lectura` "Abandonado"; cualquier otro fallo, error genérico con "Reintentar" y el carrito sigue activo. No registrar ningún listener de salida de página. Depende de T047. Deben pasar T045 y T046

**Checkpoint**: las cuatro operaciones del carrito funcionan.

---

## Phase 7: User Story 5 - Recuperarse de errores y de una credencial perdida (Priority: P3)

**Goal**: cada `codigo` que pueden devolver las operaciones del carrito, más el `401`, el código
desconocido y la red, tiene su manejo, y la cinta de peligro marca la falta de conexión.

**Independent Test**: con la red simulada, responder a cada operación con cada `codigo`, con
`401`, con un código desconocido y con un corte de red, y verificar mensaje, credencial y acción.

### Tests for User Story 5 (escribirlos antes de implementar; deben fallar)

- [X] T049 [P] [US5] Ampliar `tests/unit/domain/carrito.test.ts` con `resolverProblemaCarrito(problema, operacion)` para las operaciones `obtener`, `cambiar`, `email` y `abandonar`, recorriendo la tabla de research C10 fila por fila: `401` y `carrito-no-encontrado` → `perdido` con descarte; `carrito-no-activo` → `lectura` con cierre y aviso (sin aviso en `abandonar`); `red` → error genérico con `sinConexion: true`; `desconocido`, `demasiados-pedidos` y `desafio-rechazado` → error genérico sin cinta
- [X] T050 [P] [US5] Ampliar `tests/components/PantallaCarrito.test.tsx` (errores):
  - `401` y `carrito-no-encontrado` en el `GET`, en el email y en el abandono: `h1` "No pudimos recuperar tu carrito", enlace "Elegir otra función" a los horarios de la película y la clave `randomplay:carrito` borrada;
  - `carrito-no-activo` con `estadoActual: "Expirado"` en el email: modo lectura con aviso de que el carrito venció y sesión cerrada; en el abandono, modo lectura "Abandonado" o "Vencido" sin `alert`;
  - fallo de red en el email: `alert` de sin conexión con `.cinta-peligro`; al reintentar con éxito, la cinta desaparece;
  - un `codigo` desconocido: error genérico sin cinta;
  - en ningún caso el token aparece en el texto del documento
- [X] T051 [P] [US5] Ampliar `tests/components/CambioButacas.test.tsx` (errores): `401` y `carrito-no-encontrado` muestran "No pudimos recuperar tu carrito" en el lugar y borran la sesión; `carrito-no-activo` cierra la sesión y llama a `push("/carritos/{id}")`; red muestra la cinta; desconocido, error genérico

### Implementation for User Story 5

- [X] T052 [US5] Agregar a `src/domain/carrito.ts` `resolverProblemaCarrito` (research C10) y la vista `perdido` con la acción `credencialPerdida` en `reducirPantalla`. Exhaustivo sobre `Problema["tipo"]` con un `never` en el `default`, como `SelectorButacas`. Debe pasar T049
- [X] T053 [US5] Crear `src/components/PantallaCarrito/VistaPerdido.tsx` (`h1` "No pudimos recuperar tu carrito", texto que explica que la reserva ya no está disponible desde esta pestaña y enlace "Elegir otra función" o "Ver la cartelera") y `AvisoOperacion.tsx` (el `alert` con "Reintentar" y, si `sinConexion`, la `.cinta-peligro` arriba con `aria-hidden`). Exportarlos para `CambioButacas`
- [X] T054 [US5] Aplicar `resolverProblemaCarrito` en las tres operaciones de `PantallaCarrito` (`GET`, email, abandono): `descartarSesion()` o `cerrarSesion()` según la transición, guardando `peliculaId` antes de descartar para el enlace; usar `AvisoOperacion` para todos los errores; la cinta se apaga con la siguiente respuesta de la API. Depende de T052 y T053. Debe pasar T050
- [X] T055 [US5] Aplicar `resolverProblemaCarrito` en `CambioButacas` a través de `resolverPropio`: `perdido` se muestra en el lugar con `VistaPerdido`; `carrito-no-activo` → `cerrarSesion()` y `router.push`; red → `AvisoOperacion` con cinta. Los códigos de butacas los sigue resolviendo `SelectorComun`. Depende de T052 y T053. Debe pasar T051

**Checkpoint**: todas las historias funcionan solas y juntas.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T056 [P] Ampliar `tests/e2e/accesibilidad.spec.ts` con axe (0 violaciones) en `/carritos/{id}` activo, vencido (con `page.clock`), con "Qué sigue" visible y en `/carritos/{id}/butacas` (SC-008)
- [X] T057 [P] Ampliar `tests/e2e/carrito.spec.ts` con 360 × 800: sin scroll horizontal (`document.documentElement.scrollWidth <= clientWidth`) en el carrito y en el cambio de butacas, y controles (salvo butacas) de 44 px o más de alto (FR-043)
- [X] T058 Revisar todo el copy visible nuevo con `antislop-copywriting` y DESIGN.md §10: voseo, verbos al frente, sin humor en errores, sin "compra" ni "orden", cada aviso dice qué pasó y qué hacer. Ajustar la redacción sin cambiar qué dicen los textos de research C5, C9, C10 y C11, y actualizar los tests que los consultan
- [X] T059 Correr la Delivery Gate de antislop sobre `PantallaCarrito`, `CambioButacas`, `CuentaRegresiva` y `.cinta-peligro`: un solo botón rojo por vista, cinta solo en vencido y sin conexión, contrastes de research C6, foco visible, dial 1/1/1
- [X] T060 Correr `npm run gen:api` (sin diff), `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`, y corregir lo que falle (puertas de CI 1–4)
- [ ] T061 Recorrer la sección 1 de `quickstart.md` contra el backend real (recorridos 1–19) y anotar en el PR cualquier diferencia. En particular, confirmar que el proxy entrega el header `Date` del backend (recorrido 2)
- [ ] T062 Abrir el PR: describir qué principios toca y cómo, documentar las dos desviaciones de Complexity Tracking de `plan.md` (Principio III, cierre de pestaña; Principio VIII, mapa del cambio desde el navegador) y sumar `estadoActual` al reporte de la discrepancia de `ProblemDetails` para el backend

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T002 tiene que estar resuelta antes de T027.
- **Foundational (Fase 2)**: depende de la Fase 1.
  - T003 y T004 en paralelo; T005 depende de T004; T006 depende de T005; T007 es independiente.
  - Los tests T008–T013 se escriben antes que T014–T021.
  - T014 → T016 → T017 → T018 (T018 también necesita T019). T015, T019, T020 y T021 en paralelo con T014.
- **US1 (Fase 3)**: depende de la Fase 2. T026 y T027 en paralelo → T028 → T029.
- **US2 (Fase 4)**: depende de US1 (se integra en `PantallaCarrito`). T034 → T035 → T036.
- **US3 (Fase 5)**: depende de US1 (`CuentaRegresiva`, lectura de la sesión). Puede ir en paralelo con US2 hasta T044, que toca `PantallaCarrito`. T040 → T041 → T042 → T043 → T044.
- **US4 (Fase 6)**: depende de US1. Puede ir en paralelo con US2 y US3 salvo T048, que toca `PantallaCarrito`.
- **US5 (Fase 7)**: depende de US1 a US4, porque refina el manejo de errores de sus operaciones.
- **Polish (Fase 8)**: depende de todo lo anterior. T056 y T057 pueden adelantarse a medida que cierran las historias.

### User Story Dependencies

```text
Fase 1 → Fase 2 → US1 (P1) ─┬─ US2 (P1) ─┐
                            ├─ US3 (P2) ─┼─ US5 (P3) ─ Polish
                            └─ US4 (P2) ─┘
```

### Within Each User Story

- Los tests de la historia se escriben primero y deben fallar.
- `src/domain/` → componentes → página.
- Las tareas que tocan `PantallaCarrito.tsx` (T028, T036, T044, T048, T054) van una después de otra.
- Cada tarea que cierra un test lo nombra ("Debe pasar T0xx").

### Parallel Opportunities

- Fase 2: T003 y T004; T008–T013 juntos; T015, T019, T020 y T021 junto con T014.
- US1: T022–T024 juntos; T026 y T027 en paralelo; T030 en cualquier momento.
- US2: T031–T033 juntos; T034 en paralelo con tareas de US3 y US4.
- US3: T037–T039 juntos; T040–T043 en paralelo con US2 y US4 (archivos distintos).
- US4: T045 y T046 juntos; T047 en paralelo con US2 y US3.
- US5: T049–T051 juntos; T054 y T055 en paralelo después de T052 y T053.

---

## Parallel Example: User Story 1

```bash
# Tests de US1, todos juntos:
Task: "Reducer de la pantalla en tests/unit/domain/carrito.test.ts"
Task: "Vistas y contador en tests/components/PantallaCarrito.test.tsx"
Task: "E2E en tests/e2e/carrito.spec.ts"

# Luego, en paralelo:
Task: "reducirPantalla en src/domain/carrito.ts"
Task: "CuentaRegresiva y useCuentaRegresiva en src/components/CuentaRegresiva/"
```

## Parallel Example: después de US1

```bash
# Tres personas, archivos distintos:
Task: "validarEmail y EmailEntrega (US2): src/domain/email.ts, src/components/PantallaCarrito/EmailEntrega.tsx"
Task: "marcarPropias, SelectorComun y CambioButacas (US3): src/domain/butacas.ts, src/components/SelectorButacas/, src/components/CambioButacas/"
Task: "AbandonoCarrito (US4): src/components/PantallaCarrito/AbandonoCarrito.tsx"
# Las integraciones en PantallaCarrito.tsx (T036, T044, T048) van de a una.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Fase 1 + Fase 2.
2. Fase 3 (US1): el carrito se ve, cuenta y vence.
3. **Parar y validar** con T022–T025 y los recorridos 1–6, 14 y 19 del quickstart.
4. Demo en local. **No se publica en producción solo con US1**: sin US2 el flujo no tiene
   final, y sin US5 un `401` o un carrito ajeno caen en el error genérico sin descartar la
   credencial (Principio III).

### Incremental Delivery

1. Setup + Foundational → transporte, operaciones y sesión v2 listos.
2. US1 → pantalla y contador validados (SC-002, SC-003).
3. US2 → email y "Qué sigue" validados (SC-001, SC-009).
4. US3 → cambio de butacas validado (SC-004).
5. US4 → abandono validado (SC-007).
6. US5 → cada `codigo` y la credencial validados (SC-005, SC-006).
7. Polish → accesibilidad, 360 px, CI, backend real y PR.

La 003 y la 004 se pueden publicar juntas: la 003 todavía no está en `main`, y su destino
provisorio queda reemplazado por esta pantalla.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Commit al cerrar cada tarea o grupo lógico. El PR describe qué principios toca (constitución, Flujo de Desarrollo).
- Copy visible en español rioplatense con voseo, sin humor en errores (DESIGN.md §10). Los textos de las tareas son la base. Se ajustan con antislop sin cambiar qué dicen.
- El token nunca se loguea, ni siquiera en tests: usar `"token-de-prueba-no-real"` y verificar su ausencia.
- Ninguna pantalla simula un pago, un número de orden ni una compra confirmada (constitución, SC-009).

## Implementation Notes (2026-11-01)

Decisiones que se apartaron del plan al implementar:

- **Vista derivada en lugar de reducer (T022, T026)**: la sesión de la pestaña es la fuente de
  verdad. `vistaPantalla()` en `src/domain/carrito.ts` deriva la vista de la sesión, el tramo del
  contador y una marca de credencial perdida. `sesion-carrito.ts` avisa cada cambio en la misma
  pestaña (`suscribirSesion`), así que cada respuesta guardada actualiza la pantalla sin estado
  duplicado. Los estados de cada operación (email, abandono, actualización) viven en sus
  componentes.
- **Reloj compartido**: `src/components/CuentaRegresiva/reloj.ts` es un store para
  `useSyncExternalStore` que lee `Date.now()` cada 250 ms y al volver a la pestaña. Así la hora
  no se lee durante el render (`react-hooks/purity`) y cada componente se suscribe solo al valor
  que muestra (tramo o segundos).
- **Aviso del tramo final**: el texto es fijo ("Quedan 2 minutos o menos…") para que la región de
  cortesía no cambie cada segundo.
- **Mock de e2e (T007, T046)**: los carritos no restan butacas del mapa. La liberación al
  abandonar se valida contra el backend real.
- **e2e en otros puertos**: el 3000 estaba ocupado por un servidor de desarrollo. La suite se
  corrió con una copia de `playwright.config.ts` (mock en 4110, sitio en 3100, `SITE_URL` sin
  cambios).

Pendientes:

- **T061**: Docker no está disponible en este entorno (WSL sin integración) y el backend no
  estaba corriendo. Hay que recorrer el quickstart contra el backend real antes del PR.
- **T062**: el PR se abre cuando el dueño lo pida.
