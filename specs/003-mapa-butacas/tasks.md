---

description: "Tareas de implementación: mapa de butacas y retención de asientos"
---

# Tasks: Mapa de butacas y retención de asientos

**Input**: documentos de diseño en `specs/003-mapa-butacas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: solo los que fija la tabla "Qué se testea y qué no" de `plan.md` (Principio VII). Los
CSS Modules, la configuración, los fixtures y la ampliación del mock no llevan test propio.

**Organization**: tareas agrupadas por historia de usuario.
- La Fase 2 deja listos el parseo de problemas, los dos transportes, el dinero en centavos, el
  formato de fecha y los datos de prueba.
- US1 entrega el recorrido feliz completo, con un error genérico para cualquier fallo.
- US2 agrega el manejo de cada `codigo`.
- US3 agrega el teclado, el tamaño adaptable y la verificación de accesibilidad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de `spec.md` (US1, US2, US3)
- Proyecto único en la raíz: `src/`, `tests/`, `scripts/`

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: confirmar el punto de partida. No hay dependencias nuevas ni configuración que
crear.

- [X] T001 Correr `npm run gen:api` y confirmar que `src/api/schema.d.ts` no cambia: el contrato de `docs/openapi.json` ya trae `MapaAsientosResponse`, `CrearCarritoRequest` y `CarritoCreadoResponse`. Si cambia, versionar el archivo regenerado y resolver los errores de `npm run typecheck` antes de seguir (Principio I)
- [X] T002 Resolver el modo de antislop siguiendo `CLAUDE.md` (sección "antislop": instrucción explícita de la sesión, después la preferencia global, después preguntar) y leer `.claude/skills/antislop/SKILL.md`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile` y `antislop-copywriting` antes de la primera tarea de UI (T029). El dial del flujo privado es 1/1/1 (DESIGN.md §11)

---

## Phase 2: Foundational (prerequisitos bloqueantes)

**Purpose**: el borde con la API y la lógica pura que usan las tres historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Configuración y datos de prueba

- [X] T003 [P] Crear `src/config/experiencia.ts` con `export const MAX_BUTACAS_POR_COMPRA = 10;`. Arriba, un comentario de una línea: "Valor de experiencia, no de validación: la API decide (Principio IV)"
- [X] T004 [P] Crear `tests/fixtures/mapas.json`: un objeto indexado por `funcionId` con respuestas `MapaAsientosResponse` completas. Usar los `funcionId` que ya están en `tests/fixtures/horarios.json` (por ejemplo `9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b001`), con `peliculaId`, `salaNombre` y `precioEntrada` coherentes con ese horario. Incluir:
  - una sala de 8 filas × 12 (A–H) con ocupadas `C5`, `C6`, `F7`;
  - una sala de 6 filas de 8, 10, 12, 12, 14 y 14 (A–F), la más ancha, con precio `"7250.50"`;
  - una sala de 10 × 10 (A–J);
  - una función con `cantidadDisponibles: 0` y todos los `asientosDisponibles` vacíos.

  Algunos `cantidadAsientos` van como string (`"12"`), para cubrir `integer | string`
- [X] T005 [P] Crear `tests/fixtures/carritos.json` con un `CarritoCreadoResponse` de ejemplo: `carrito.id` GUID fijo, `estado: "Activo"`, `asientos` F7 y F8, `funcion` coherente con la sala de 8 × 12 de `mapas.json`, `precioUnitario` y `total` como texto, `token: "token-de-prueba-no-real"` y `tokenVenceEn` ISO con `-03:00`
- [X] T006 Ampliar `tests/fixtures/index.ts`:
  - exportar `mapas` y `carritoCreado` tipados con `satisfies` contra `components["schemas"]["MapaAsientosResponse"]` y `["CarritoCreadoResponse"]`;
  - exportar las constantes `ID_FUNCION_8X12`, `ID_FUNCION_ANCHA`, `ID_FUNCION_10X10`, `ID_FUNCION_COMPLETA`, `ID_FUNCION_COMENZADA` (un GUID sin mapa, para el 410) y `ID_FUNCION_INEXISTENTE`;
  - exportar el helper `problemaCarrito(status, codigo, extras?)`, que arma el cuerpo `application/problem+json` con `codigo` y extensiones (`asientos`, `errors`).

  Depende de T004 y T005
- [X] T007 Ampliar `tests/msw/handlers.ts` con handlers del navegador sobre `*/api/...`. En jsdom, el `fetch` relativo se resuelve contra `http://localhost:3000` (research B15):
  - `GET */api/funciones/:funcionId/asientos`: devuelve `mapas`, 410 para `ID_FUNCION_COMENZADA` y 404 sin `codigo` para el resto;
  - `POST */api/funciones/:funcionId/carritos`: devuelve 201 con `carritoCreado`;
  - `POST */api/carritos/:carritoId/abandono`: devuelve 200.

  Mantener los handlers de `http://api.test` para el servidor y agregar `GET http://api.test/api/funciones/:funcionId/asientos` con la misma lógica. Depende de T006
- [X] T008 Ampliar `scripts/mock-api.mjs` (herramienta de los e2e; **no** es el modo `API_MOCK=1`, que no se toca):
  - leer `tests/fixtures/mapas.json` y `carritos.json`;
  - `GET /api/funciones/{id}/asientos`: devuelve el mapa, 410 `problem+json` sin `codigo` para `ID_FUNCION_COMENZADA` y 404 para el resto;
  - `POST /api/funciones/{id}/carritos`: lee el cuerpo y responde 201 con `carritos.json`, reemplazando `carrito.asientos` y `carrito.id` (un GUID nuevo por pedido) y recalculando `total`;
  - `POST /api/carritos/{id}/abandono`: responde 200;
  - quitar el `405` para estos POST.

  Mantener el log de método, ruta y status sin imprimir cuerpos ni headers. Depende de T004 y T005

### Tests de la base (escribirlos antes de implementar; deben fallar)

- [X] T009 [P] Test de `tests/unit/api/problema.test.ts` con objetos `Response` reales:
  - cada uno de los 10 `codigo` documentados se reconoce;
  - un `codigo` nuevo da `tipo: "desconocido"`, y un cuerpo sin `codigo` también;
  - un `Content-Type` que no es `problem+json` no se parsea;
  - `asientos` válidos se conservan y los inválidos (fila `"c"`, `"AA"`, número 0 o `"x"`) se descartan;
  - `errors` con valores no-string se filtra;
  - `Retry-After: 30` da 30; una fecha HTTP 45 s en el futuro da 45 (con `vi.setSystemTime`); si falta, da 60; `0` o `"abc"` dan 60; `99999` da 600;
  - `title` y `detail` nunca aparecen en el resultado
- [X] T010 [P] Test de `tests/unit/api/navegador.test.ts` con MSW:
  - pide a la URL relativa `/api/...` con `cache: "no-store"`;
  - agrega `Authorization: Bearer x` solo cuando se pasa `token`;
  - 2xx da `{ ok: true, datos }`;
  - 4xx con `problem+json` da `{ ok: false, problema }` con su `tipo`;
  - un fallo de red da `problema.tipo === "red"` sin `status`;
  - un timeout (con `AbortSignal` y timers simulados) da `"red"`;
  - ni el mensaje ni el `problema` contienen el token
- [X] T011 [P] Ampliar `tests/unit/api/client.test.ts`:
  - `pedirSinCache` pide sin `next.revalidate` y con `cache: "no-store"`;
  - 404 da `null`;
  - 410 lanza `ApiError` con `status: 410`;
  - un `codigo` en `problem+json` sigue llegando a `ApiError.codigo` (ahora a través de `leerProblema`)
- [X] T012 [P] Test de `tests/unit/domain/dinero.test.ts`:
  - `aCentavos("4500.00")` da `450000`, `aCentavos("7250.50")` da `725050` y `aCentavos("0.05")` da `5`;
  - `"4500"`, `"4500.5"`, `"-1.00"`, `"1e3"` y `""` dan `null`;
  - `multiplicar({ monto: "7250.50", moneda: "ARS" }, 2)` da `{ monto: "14501.00", moneda: "ARS" }`;
  - para precios `"0.10"`, `"0.20"`, `"4999.99"` y `"7250.50"`, y cantidades de 1 a 10, `aCentavos(multiplicar(p, n).monto) === aCentavos(p.monto) * n` (SC-004);
  - un monto inválido da `null`
- [X] T013 [P] Ampliar `tests/unit/domain/formato.test.ts`: `formatearFecha("2026-11-01T23:30:00-03:00")` da la fecha del 1 de noviembre en la zona de Argentina (por ejemplo, "domingo 1 de noviembre"), y `"2026-11-02T01:30:00Z"` sigue siendo el 1 de noviembre en Argentina

### Implementación de la base

- [X] T014 Crear `src/api/problema.ts`:
  - el tipo `CodigoCarrito` es la unión de los 10 códigos de `docs/api.md`;
  - `type Problema = { tipo: CodigoCarrito | "desconocido" | "red"; status?: number; asientos: Asiento[]; errors: Record<string, string[]>; retryAfterSegundos?: number }`, con `Asiento = { fila: string; numero: number }`;
  - `leerProblema(respuesta: Response): Promise<Problema>` valida las extensiones a mano y lee `Retry-After` solo para `demasiados-pedidos` (segundos o fecha HTTP; 60 por defecto; entre 1 y 600);
  - `problemaDeRed(): Problema`.

  No lee `title` ni `detail` (research B3, B4). Debe pasar T009
- [X] T015 Modificar `src/api/client.ts`:
  - reemplazar `leerCodigo` por `leerProblema` (el `ApiError.codigo` se conserva, con `codigo` solo si `tipo` no es `"desconocido"`);
  - agregar `pedirSinCache<T>(ruta, { timeoutMs? })`, que comparte la lógica de `pedir` pero usa `cache: "no-store"` en lugar de `next: { revalidate, tags }`. Mantiene el modo `API_MOCK` solo en `pedir`.

  Depende de T014. Debe pasar T011
- [X] T016 Crear `src/api/navegador.ts`:
  - `pedirDesdeNavegador<T>(ruta, { metodo?: "GET" | "POST"; cuerpo?: unknown; token?: string; timeoutMs?: number }): Promise<{ ok: true; datos: T } | { ok: false; problema: Problema }>`;
  - `fetch` relativo con `cache: "no-store"`, `Accept: application/json`, `Content-Type: application/json` si hay cuerpo, `Authorization: Bearer {token}` si hay token, y `AbortSignal.timeout(timeoutMs ?? 8000)`;
  - las respuestas 204 o sin cuerpo dan `datos: undefined`.

  Comentario de una línea: "Solo navegador: llega a la API por el proxy de next.config.ts". No importa `entorno`. Nunca loguea. Depende de T014. Debe pasar T010
- [X] T017 [P] Crear `src/domain/dinero.ts` con `aCentavos(monto: string): number | null` (regex `^\d+\.\d{2}$`, entero por partes, sin `parseFloat` ni `Number(monto)`), `desdeCentavos(centavos: number, moneda: string): Dinero` y `multiplicar(precio: Dinero, cantidad: number): Dinero | null`. Reutilizar el tipo `Dinero` de `src/domain/formato.ts`. Debe pasar T012
- [X] T018 [P] Agregar `formatearFecha(iso)` en `src/domain/formato.ts`: `Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, weekday: "long", day: "numeric", month: "long" })`, junto a `formatearHora`. Debe pasar T013

**Checkpoint**: borde con la API, dinero y fechas listos; los datos de prueba sirven a Vitest y Playwright.

---

## Phase 3: User Story 1 - Elegir butacas y retenerlas (Priority: P1) 🎯 MVP

**Goal**: `/funciones/{funcionId}` muestra cabecera y mapa. El comprador elige hasta 10
butacas, ve cantidad y total y confirma. Si ya había un carrito en la pestaña, se abandona; el
nuevo queda guardado en la pestaña y se llega a `/carritos/{id}`. Cualquier error de la
confirmación da un error genérico recuperable (US2 lo refina).

**Independent Test**: con el backend local sembrado, abrir un horario de hoy de Interstellar,
elegir dos butacas, confirmar y llegar a `/carritos/{id}` con esas butacas. Al recargar el mapa,
figuran ocupadas (quickstart, recorridos 1–6, 8, 9 y 13).

### Tests de US1 (escribirlos antes de implementar; deben fallar)

- [X] T019 [P] [US1] Test de `tests/unit/domain/butacas.test.ts` (primera parte):
  - `construirMapa` arma una butaca por número de 1 a `cantidadAsientos`, con `libre` según `asientosDisponibles`;
  - normaliza `"12"` a 12;
  - descarta filas con letra inválida o cantidad ≤ 0 e ignora disponibles fuera de rango;
  - `reducirSeleccion` con `alternar` agrega y quita, ignora una ocupada y, con `MAX_BUTACAS_POR_COMPRA` seleccionadas, no agrega y devuelve `limiteAlcanzado: true`;
  - el máximo efectivo es `min(10, libres)`: con 3 libres, la cuarta no entra;
  - `etiquetaButaca({ fila: "F", numero: 7 })` da `"F7"`;
  - `listarAsientos` de 1, 2 y 3 asientos da `"la F7"`, `"la F7 y la F8"` y `"la F7, la F8 y la F9"`
- [X] T020 [P] [US1] Test de `tests/unit/domain/sesion-carrito.test.ts`:
  - `guardarSesion` y `leerSesion` hacen ida y vuelta;
  - `leerSesion` da `null` con JSON roto, con `version` distinta o sin `token`;
  - `descartarSesion` borra la clave `randomplay:carrito`;
  - con un `sessionStorage` que lanza en `setItem`, `almacenamientoDisponible()` da `false` y `leerSesion()` da `null` sin lanzar;
  - ninguna función llama a `console.*` (espiarlos)
- [X] T021 [P] [US1] Test de `tests/unit/api/asientos.test.ts` y `tests/unit/api/carritos.test.ts` con MSW:
  - `obtenerMapa(id)` (servidor) mapea a `MapaFuncion` de [data-model.md](data-model.md), da `null` con 404 y lanza `ApiError` con status 410;
  - `crearCarrito(funcionId, asientos)` envía `{ asientos, desafio: null }` sin `Authorization` y con 201 da `{ ok: true, datos: CarritoCreado }`;
  - `abandonarCarrito(id, token)` envía `Authorization: Bearer {token}` a `/api/carritos/{id}/abandono` con un timeout de 3 s
- [X] T022 [P] [US1] Test de `tests/components/SelectorButacas.test.tsx` (recorrido feliz), con MSW y `next/navigation` simulado (`useRouter().push` espiado):
  - render con el mapa 8 × 12;
  - sin selección, el botón dice "Confirmar butacas" y está deshabilitado (nunca "Confirmar 0 butacas");
  - clic en "Fila F, butaca 8, libre" y "Fila F, butaca 9, libre" da el `status` "2 butacas elegidas: F8, F9. Total …" con el doble del precio formateado y el botón "Confirmar 2 butacas";
  - un segundo clic en F8 deja "1 butaca" y "Confirmar 1 butaca";
  - "Fila C, butaca 5, ocupada" no cambia;
  - con 10 elegidas, la undécima no entra y el `status` avisa del máximo;
  - confirmar envía un solo POST aunque se haga doble clic, guarda la sesión y llama a `push("/carritos/{id}")`;
  - con una sesión previa guardada, el POST de abandono llega **antes** que el de creación, y si el abandono responde 500, la creación sigue;
  - con `sessionStorage` bloqueado, no hay POST y se ve el aviso de almacenamiento;
  - un 500 de la creación da el aviso genérico con "Reintentar" y conserva la selección
- [X] T023 [P] [US1] Test de `tests/components/CarritoCreado.test.tsx`:
  - con una sesión del mismo `carritoId`, muestra "Tu carrito quedó creado", la película, la sala, las butacas F7 y F8 y el total de la API;
  - sin sesión, o con sesión de otro id, muestra "No hay un carrito activo en esta pestaña" y el enlace "Volver a la cartelera";
  - el token no aparece en el DOM (`container.innerHTML` no contiene `"token-de-prueba-no-real"`)
- [X] T024 [P] [US1] E2E `tests/e2e/butacas.spec.ts` (proyecto `con-js`; con `sin-js` solo los casos de HTML: cabecera, `noindex` y 404):
  - **recorrido:** desde `/peliculas/{ID_CON_FUNCIONES}`, clic en el primer horario lleva a `/funciones/{id}` con `h1` "Elegí tus butacas" y la cabecera; se eligen dos butacas, se confirma y se llega a `/carritos/{id}` con "Tu carrito quedó creado";
  - **credencial:** `page.url()` nunca contiene el token, el HTML de `/carritos/{id}` (`response.text()`) no lo contiene y ningún mensaje de consola lo contiene (`page.on("console")`);
  - **indexación:** `/funciones/{id}` tiene `<meta name="robots" content="noindex, nofollow">` y el header `Cache-Control` incluye `no-store`;
  - **función inexistente o comenzada:** `/funciones/no-es-guid` y `/funciones/{ID_FUNCION_INEXISTENTE}` dan 404; `/funciones/{ID_FUNCION_COMENZADA}` muestra "Esta función ya empezó"

### Implementación de US1

- [X] T025 [US1] Crear `src/domain/butacas.ts`:
  - tipos `Butaca`, `Fila` y `EstadoSelector` de [data-model.md](data-model.md);
  - `construirMapa(filasApi)` usa `normalizarEntero` de `formato.ts` y la regex `^[A-Z]$` para la letra;
  - `maximoEfectivo(estado)`;
  - `reducirSeleccion(estado, accion)` con `alternar` y `limpiar`; devuelve `{ estado, limiteAlcanzado? }` o expone `limiteAlcanzado` en el estado, lo que resulte más simple con `useReducer`;
  - `etiquetaButaca` y `listarAsientos`.

  Importa `MAX_BUTACAS_POR_COMPRA` de `src/config/experiencia.ts`. Sin React. Debe pasar T019
- [X] T026 [P] [US1] Crear `src/domain/sesion-carrito.ts`:
  - `type SesionCarrito = { version: 1; carritoId: string; token: string; tokenVenceEn: string; carrito: CarritoCreado["carrito"] }`;
  - la clave `randomplay:carrito`;
  - `almacenamientoDisponible()`, `leerSesion()` (valida la forma y devuelve `null` ante cualquier excepción), `guardarSesion()` y `descartarSesion()`, todas con try/catch.

  Sin `console.*`. Comentario de una línea: "Credencial privada (Principio III): solo sessionStorage, nunca en URL ni logs". Debe pasar T020
- [X] T027 [P] [US1] Crear `src/api/asientos.ts`:
  - `type MapaFuncion` según [data-model.md](data-model.md), con `filas: Fila[]` construido con `construirMapa`;
  - `obtenerMapa(funcionId)` usa `pedirSinCache` desde el servidor, da `null` con 404 y propaga `ApiError` (410 incluido);
  - `mapearMapa(respuesta)`, reutilizable desde el navegador en US2.

  Tipos de entrada desde `paths["/api/funciones/{funcionId}/asientos"]` de `schema.d.ts`. Depende de T015 y T025. Debe pasar la parte de asientos de T021
- [X] T028 [P] [US1] Crear `src/api/carritos.ts`:
  - `type CarritoCreado` (data-model.md);
  - `crearCarrito(funcionId, asientos)` hace un POST a `/api/funciones/{id}/carritos` con `{ asientos, desafio: null }` usando `pedirDesdeNavegador` y mapea el 201;
  - `abandonarCarrito(carritoId, token)` hace un POST a `/api/carritos/{id}/abandono` con `token` y `timeoutMs: 3000`.

  Ambas devuelven el resultado discriminado. Tipos desde `schema.d.ts`. Depende de T016. Debe pasar la parte de carritos de T021
- [X] T029 [P] [US1] Crear `src/components/CabeceraFuncion/CabeceraFuncion.tsx` y `.module.css` (Server Component): un `<dl>` con "Película", "Sucursal", "Sala", "Fecha y hora" (`<time dateTime={horaInicio}>` con `formatearFecha` + `formatearHora`) y "Entrada" (`formatearPrecio`, en `counter`). Dial 1/1/1: sin halftone ni etiquetas pegadas
- [X] T030 [US1] Crear `src/components/MapaButacas/MapaButacas.tsx` y `.module.css` (`"use client"`), versión de US1, sin teclado de flechas, que se agrega en US3:
  - props `{ filas, seleccion, salaNombre, bloqueado, onAlternar }`;
  - franja "PANTALLA" arriba (`aria-hidden`), contenedor `role="grid"` con `aria-label="Butacas de {salaNombre}"`, cada fila en `role="row"` con `rowheader` "Fila X" a la izquierda y la letra repetida a la derecha con `aria-hidden`;
  - cada butaca es un `<button type="button">` en `role="gridcell"`, con `aria-label` "Fila F, butaca 7, libre", "…, seleccionada" u "…, ocupada", y con `aria-disabled="true"` y sin efecto cuando está ocupada;
  - el número siempre visible y estilos por estado según [contracts/ui-mapa.md](contracts/ui-mapa.md): libre con contorno `--paper-muted` sobre `--surface`; seleccionada con `--oro` y ✓ `--oro-ink`; ocupada con `--surface-2` y trama diagonal;
  - foco con un anillo `--oro` de 2 px;
  - tamaño fijo de 32 px por ahora (US3 lo hace adaptable).

  Depende de T025
- [X] T031 [US1] Crear `src/components/SelectorButacas/SelectorButacas.tsx` y `.module.css` (`"use client"`):
  - props `{ mapa: MapaFuncion }` (sin token ni nada sensible) y `useReducer(reducirSeleccion)`;
  - renderiza `MapaButacas`;
  - sección "Tu selección" con un `h2` y una región `role="status"` (`aria-live="polite"`) con "N butaca(s) elegida(s): F7, F8. Total {formatearPrecio(multiplicar(...))}", "Total no disponible" si `multiplicar` da `null`, o "Todavía no elegiste butacas.";
  - aviso de máximo por la misma región;
  - con `cantidadDisponibles` 0: "No quedan butacas libres para esta función." y el enlace "Ver otros horarios" a `/peliculas/{peliculaId}#titulo-horarios`;
  - botón primario rojo (`.boton-primario`) "Confirmar N butacas" / "Confirmar 1 butaca" / "Confirmar butacas", deshabilitado con 0 o mientras envía;
  - `confirmar()` sigue research B10:
    1. bloquea;
    2. si `!almacenamientoDisponible()`, aviso "Tu navegador no permite guardar el carrito en esta pestaña. Probá en una ventana normal." y corta;
    3. si `leerSesion()` existe, `abandonarCarrito` y después `descartarSesion` (ignorando el resultado);
    4. `crearCarrito`;
    5. con `ok`, `guardarSesion` y `router.push`.
  - cualquier otro resultado da el estado `errorGenerico` (`role="alert"` "No pudimos reservar las butacas. Probá de nuevo." con "Reintentar", que vuelve a llamar a `confirmar`), conservando la selección.

  Copy con voseo y sin humor (DESIGN.md §10). Depende de T026, T028 y T030. Debe pasar T022
- [X] T032 [US1] Crear `src/app/funciones/[funcionId]/page.tsx` y `page.module.css`:
  - `export const dynamic = "force-dynamic"`;
  - `cargarMapa = cache(async (id) => …)` con `React.cache`: si el id no es GUID (misma regex que `peliculas/[id]/page.tsx`), `notFound()`; llama a `obtenerMapa`; con `null`, `notFound()`; con `ApiError` status 410, devuelve `{ tipo: "comenzada" }`; con otro error, lo propaga a `error.tsx`;
  - `generateMetadata`: "Butacas · {peliculaTitulo}" o "Función comenzada", siempre con `robots: { index: false, follow: false }`, sin canónica ni Open Graph;
  - página: enlace `next/link` "Volver a {peliculaTitulo}", `h1` "Elegí tus butacas", `CabeceraFuncion`, y `<section aria-labelledby>` con un `h2` "Sala" visualmente oculto y `SelectorButacas mapa={mapa}`;
  - estado comenzada: `EstadoVacio` con `nivel="h1"`, título "Esta función ya empezó", mensaje "Elegí otro horario desde la cartelera." y enlace a `/`.

  Ver [contracts/routes.md](contracts/routes.md). Depende de T027, T029 y T031
- [X] T033 [US1] Crear `src/components/CarritoCreado/CarritoCreado.tsx` y `.module.css` (`"use client"`):
  - prop `{ carritoId }`;
  - lee la sesión con `useSyncExternalStore` (`subscribe` a `storage`, snapshot del servidor `null`, snapshot del cliente memoizado por el valor crudo de la clave);
  - si `sesion?.carritoId === carritoId`, muestra un `h1` "Tu carrito quedó creado", película, sucursal, sala, fecha y hora, la lista de butacas ("Fila F, butaca 7") y el `total` de la API con `formatearPrecio`, más la nota "Las butacas quedan retenidas unos minutos. El siguiente paso llega pronto.";
  - si no, muestra el `h1` "No hay un carrito activo en esta pestaña" y el enlace "Volver a la cartelera";
  - mientras el snapshot sea el del servidor, no muestra contenido (evita el parpadeo del mensaje negativo).

  No pide nada a la API y no simula pago. Depende de T026. Debe pasar T023
- [X] T034 [US1] Crear `src/app/carritos/[carritoId]/page.tsx` y `page.module.css`: `export const dynamic = "force-dynamic"`, `generateMetadata` con `title: "Tu carrito"` y `robots: { index: false, follow: false }`, y página que renderiza `<CarritoCreado carritoId={carritoId} />` dentro de `.contenedor`. No le pasa datos del carrito desde el servidor. Depende de T033
- [X] T035 [US1] Actualizar la fila `/funciones/{funcionId}` de `specs/001-cartelera-publica/contracts/routes.md` (200, sin caché, `noindex`, `h1` "Elegí tus butacas"), agregar la fila `/carritos/{carritoId}` y reemplazar el párrafo "responde 404 hasta que se implemente…" por un enlace a `specs/003-mapa-butacas/contracts/routes.md`. Actualizar la línea 60 de `README.md` ("…que todavía no existe") para describir la página de butacas
- [X] T036 [US1] Correr `npm test` y `npm run test:e2e`: deben pasar T019–T024 y todos los tests previos. En particular, `tests/e2e/horarios.spec.ts` y `accesibilidad.spec.ts` siguen enlazando a `/funciones/` sin romperse

**Checkpoint**: US1 funciona sola: de la ficha al carrito creado, con error genérico para cualquier fallo.

---

## Phase 4: User Story 2 - Recuperarse cuando la retención falla (Priority: P2)

**Goal**: cada `codigo` de la confirmación tiene su comportamiento (research B11). Tras un
conflicto, el mapa se refresca solo.

**Independent Test**: con MSW, responder a la confirmación con cada `codigo`, con uno
desconocido y con un fallo de red, y verificar mensaje, mapa y acción disponible
(quickstart, recorrido 7; sección 2).

### Tests de US2 (escribirlos antes de implementar; deben fallar)

- [X] T037 [P] [US2] Ampliar `tests/unit/domain/butacas.test.ts`:
  - `marcarOcupadas([F7])` pasa F7 a ocupada y la saca de la selección, e ignora asientos inexistentes;
  - `reemplazarMapa(filasNuevas)` conserva las seleccionadas que siguen libres, saca las que ahora están ocupadas o ya no existen y expone la lista de las que salieron
- [X] T038 [P] [US2] Ampliar `tests/unit/api/asientos.test.ts`: `obtenerMapaDesdeNavegador(id)` pide `/api/funciones/{id}/asientos` relativo y sin caché; 200 da `{ ok: true, datos: MapaFuncion }`; 404 y 410 dan `{ ok: false }` con ese `status`; un fallo de red da `"red"`
- [X] T039 [P] [US2] Ampliar `tests/components/SelectorButacas.test.tsx` con un `describe` por resultado, usando `server.use(...)` y `problemaCarrito` de los fixtures:
  - **`asientos-no-disponibles`** con `[F7]`, con F7, F8 y F9 seleccionadas: F7 queda "ocupada", hay un segundo GET del mapa, F8 y F9 siguen seleccionadas, y el `alert` contiene "Alguien tomó la F7 antes que vos". Con `[F7, F8]`, el texto nombra "la F7 y la F8". Si el refresco devuelve F9 ocupada, F9 también sale. Si el refresco falla, F7 queda ocupada igual y aparece el botón "Actualizar mapa";
  - **`funcion-no-encontrada`** (404) y **`funcion-no-disponible`** (410): el mapa queda bloqueado (las butacas no alternan), el botón deshabilitado y el enlace "Ver otros horarios" apunta a `/peliculas/{peliculaId}#titulo-horarios`;
  - **`funcion-sin-cupo`**: el aviso para probar en unos minutos, con la selección y el botón habilitado;
  - **`demasiados-pedidos`** con `Retry-After: 30` y timers simulados: el botón queda deshabilitado con "Podés volver a intentar en 30 s"; a los 29 s, sigue deshabilitado; a los 30 s, se habilita. Sin header, la espera es de 60 s;
  - **`pedido-invalido`** con `errors: { asientos: ["Máximo 10"] , email: ["x"] }`: "Máximo 10" aparece junto al resumen (asociado por `aria-describedby`) y "x" como aviso general;
  - **`asientos-inexistentes`**: se refresca el mapa, las seleccionadas inexistentes salen y se ve el aviso;
  - **`desafio-rechazado`**, un `codigo` desconocido, un cuerpo sin `codigo` y un fallo de red: el aviso genérico con "Reintentar" y la selección intacta;
  - **cambiar la selección** después de un aviso de `sinCupo`, `invalido` o `errorGenerico` lo limpia

### Implementación de US2

- [X] T040 [US2] Agregar a `src/domain/butacas.ts` las acciones `marcarOcupadas` y `reemplazarMapa` del reducer, con la lista de asientos que salieron de la selección (data-model.md, "Acciones"). Depende de T025. Debe pasar T037
- [X] T041 [P] [US2] Agregar a `src/api/asientos.ts` `obtenerMapaDesdeNavegador(funcionId)`, que usa `pedirDesdeNavegador` y `mapearMapa`. Depende de T027. Debe pasar T038
- [X] T042 [US2] En `src/components/SelectorButacas/SelectorButacas.tsx`, reemplazar el estado de confirmación por la unión `EstadoConfirmacion` de [data-model.md](data-model.md) (`inactivo`, `enviando`, `sinAlmacenamiento`, `conflicto`, `funcionCerrada`, `sinCupo`, `esperando`, `invalido`, `errorGenerico`) y resolver `problema.tipo` con un `switch` exhaustivo (`satisfies never` en el `default`) según la tabla de research B11:
  - **`asientos-no-disponibles`:** `marcarOcupadas`, después `obtenerMapaDesdeNavegador` y `reemplazarMapa`. El aviso usa `listarAsientos` con las perdidas: "Alguien tomó {la F7} antes que vos. Actualizamos el mapa; elegí otra." (en plural "elegí otras"). Si el refresco falla, el botón "Actualizar mapa" reintenta solo el refresco. Si el refresco da 404 o 410, pasa a `funcionCerrada`;
  - **`asientos-inexistentes`:** refresca y reemplaza el mapa. Aviso "Algunas butacas ya no existen en esta sala. Actualizamos el mapa.";
  - **`funcion-no-encontrada` y `funcion-no-disponible`:** pasa a `funcionCerrada`, con `bloqueado` en `MapaButacas`, el botón deshabilitado y el aviso "Esta función ya no está disponible." con el enlace "Ver otros horarios";
  - **`funcion-sin-cupo`:** aviso "Hay muchas butacas reservadas en este momento. Probá de nuevo en unos minutos.";
  - **`demasiados-pedidos`:** pasa a `esperando` con `retryAfterSegundos` y un `setInterval` de 1 s que descuenta, se limpia al desmontar y al llegar a 0 vuelve a `inactivo`. El botón queda deshabilitado con el texto auxiliar "Podés volver a intentar en N s" (el anuncio en vivo, solo al empezar y al terminar, no cada segundo);
  - **`pedido-invalido`:** los mensajes de la clave `asientos` (sin distinguir mayúsculas) van en un párrafo con `id` referenciado por `aria-describedby` del resumen; el resto, en el aviso general;
  - **`desafio-rechazado`, `carrito-no-encontrado`, `carrito-no-activo`, `desconocido` y `red`:** `errorGenerico`.

  Los avisos van en `role="alert"`. Cambiar la selección limpia los avisos no terminales. Depende de T040 y T041. Debe pasar T039
- [X] T043 [US2] Correr `npm test`: deben pasar T037–T039 y los tests de US1

**Checkpoint**: US1 y US2 funcionan; cada `codigo` tiene su manejo verificado (SC-003).

---

## Phase 5: User Story 3 - Usar el mapa con teclado, lector de pantalla o teléfono chico (Priority: P3)

**Goal**: el mapa es una sola parada de Tab y se recorre con flechas. Las butacas se achican
entre 32 y 24 px, y se desplazan dentro del mapa con las letras fijas. Sin scroll horizontal
desde 360 px.

**Independent Test**: recorrer US1 solo con teclado y con lector de pantalla; abrir la sala
de filas de 14 en 360 px (quickstart, recorridos 10–12).

### Tests de US3 (escribirlos antes de implementar; deben fallar)

- [X] T044 [P] [US3] Test de `tests/components/MapaButacas.test.tsx` con user-event:
  - hay exactamente un botón con `tabIndex=0` dentro del `grid`;
  - Tab desde un botón anterior entra al mapa y otro Tab sale hacia el siguiente control (una sola parada);
  - → y ← se mueven dentro de la fila y no pasan de fila en los extremos;
  - ↓ desde "Fila B, butaca 10" en la sala ancha (B tiene 10 y C tiene 12) va a la C10, y ↑ desde la E14 (E tiene 14 y D tiene 12) va a la D12;
  - Inicio y Fin van al extremo de la fila;
  - Enter y Espacio llaman a `onAlternar` con la butaca enfocada, y no lo llaman en una ocupada;
  - el foco inicial es la primera butaca libre de la fila del medio;
  - con `bloqueado`, ninguna tecla alterna;
  - los nombres accesibles siguen [contracts/ui-mapa.md](contracts/ui-mapa.md);
  - `scrollIntoView` (simulado en jsdom) se llama con `{ block: "nearest", inline: "nearest" }` al mover el foco
- [X] T045 [P] [US3] Ampliar `tests/e2e/butacas.spec.ts` (proyecto `con-js`, 360 × 800):
  - con `/funciones/{ID_FUNCION_ANCHA}`, `document.documentElement.scrollWidth <= innerWidth`;
  - toda butaca tiene un `boundingBox` de 24 × 24 px o más;
  - el área del mapa tiene `scrollWidth > clientWidth`;
  - después de desplazarla hasta el final, el `rowheader` "Fila E" sigue visible (`toBeInViewport`);
  - a 1440 px, las butacas miden 32 px;
  - **teclado:** Tab hasta el mapa, → → Enter da "Confirmar 1 butaca"
- [X] T046 [P] [US3] Ampliar `tests/e2e/accesibilidad.spec.ts`: agregar `/funciones/{ID_FUNCION_8X12}`, `/funciones/{ID_FUNCION_ANCHA}` y `/carritos/{id}` (este último después de crear un carrito en el mismo test, para auditar la vista con sesión) al recorrido de axe en 360 y 1440 px, con 0 violaciones (SC-006)

### Implementación de US3

- [X] T047 [US3] Agregar el foco itinerante a `src/components/MapaButacas/MapaButacas.tsx` (research B7):
  - estado `foco: { fila, numero }` inicializado en la primera libre de la fila del medio (o la primera butaca si no hay libres);
  - `tabIndex={esFoco ? 0 : -1}` y refs por clave;
  - `onKeyDown` en el `grid` con ←/→, ↑/↓ al número más cercano de la fila vecina, Inicio/Fin y Enter/Espacio (`preventDefault` en flechas y Espacio para no desplazar la página);
  - al mover, `ref.focus()` + `scrollIntoView({ block: "nearest", inline: "nearest" })`;
  - un clic también mueve el foco itinerante;
  - si `filas` cambia (refresco) y la butaca enfocada ya no existe, el foco va a la más cercana.

  Debe pasar T044
- [X] T048 [US3] Hacer adaptable el tamaño en `src/components/MapaButacas/MapaButacas.module.css` (research B8):
  - el contenedor externo con `container-type: inline-size` y la variable inline `--max-asientos` (la fila más larga) fijada desde el componente;
  - `--butaca: clamp(24px, calc((100cqi - 2 * var(--ancho-letra) - (var(--max-asientos) - 1) * var(--hueco)) / var(--max-asientos)), 32px)`;
  - el área de butacas con `overflow-x: auto` y `overscroll-behavior-x: contain`;
  - las celdas de letra con `position: sticky`, `inset-inline-start: 0` / `inset-inline-end: 0` y fondo `--ink` opaco;
  - filas centradas respecto de la más larga, y la franja "PANTALLA" con el ancho de esa fila;
  - número en `label` legible a 24 px;
  - `prefers-reduced-motion` sin transiciones de desplazamiento.

  Verificar a mano que ningún ancestro de `page.tsx` tenga `overflow: hidden` que rompa el `sticky`. Debe pasar la parte de 360 px de T045
- [X] T049 [US3] Revisar los anuncios en `src/components/SelectorButacas/SelectorButacas.tsx`: la región `status` anuncia cada cambio de selección una vez (sin duplicar con el `aria-label` de la butaca), el aviso de máximo no se repite si se insiste, la cuenta de `Retry-After` no anuncia cada segundo y los `alert` no roban el foco. Ajustar el texto con `antislop-copywriting` y `antislop-human` (T002)
- [X] T050 [US3] Correr `npm test` y `npm run test:e2e`: deben pasar T044–T046 y todo lo anterior

**Checkpoint**: las tres historias funcionan y están verificadas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: puertas de CI, validación manual contra el backend real y cierre.

- [X] T051 [P] Correr `npm run typecheck`, `npm run lint` (incluye `jsx-a11y`) y `npx prettier --check .`, y corregir lo que marquen. Sin `any` ni `@ts-ignore` sin justificación (Principio VIII)
- [X] T052 [P] Buscar fugas de credencial: `grep -rn "console\." src/` no debe mostrar usos en `src/api/navegador.ts`, `src/api/carritos.ts`, `src/domain/sesion-carrito.ts` ni en los componentes de cliente nuevos; ningún `ApiError` ni `Problema` incluye headers ni cuerpos del pedido; `SelectorButacas` y `CarritoCreado` no reciben datos del carrito como props desde un Server Component (Principio III, SC-005)
- [ ] T053 Validar contra el backend real los recorridos 1–13 de [quickstart.md](quickstart.md) (`docker compose` del backend, `API_URL=http://localhost:8080`, `API_MOCK=0`), incluido el conflicto real con dos ventanas privadas (recorrido 7) y la lectura con NVDA o VoiceOver (recorrido 11). Anotar en el PR lo que no se pudo probar
- [X] T054 Redactar en la descripción del PR los principios que toca (II, III, IV, V, VI, IX), la nota de B12 (410 que responde 200) y el texto para reportar al backend que `ProblemDetails` declare `errors`, `asientos` y `estadoActual` (research B3). No abrir issues en el repositorio del backend sin confirmación

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias. T002 tiene que estar resuelta antes de T029.
- **Foundational (Fase 2)**: depende de la Fase 1.
  - T003, T004 y T005 en paralelo; T006 depende de T004 y T005; T007 y T008 dependen de T006 (T008 solo de T004 y T005).
  - Los tests T009–T013 se escriben antes que T014–T018.
  - T014 → T015 y T016; T017 y T018 en paralelo con T014.
- **US1 (Fase 3)**: depende de la Fase 2.
  - T025 → T027 y T030; T026 y T028 en paralelo con T025.
  - T030 + T026 + T028 → T031; T027 + T029 + T031 → T032; T026 → T033 → T034.
- **US2 (Fase 4)**: depende de US1, porque refina `SelectorButacas` y el reducer.
- **US3 (Fase 5)**: depende de US1 (`MapaButacas`). Puede hacerse en paralelo con US2 salvo T049, que toca `SelectorButacas` después de T042.
- **Polish (Fase 6)**: depende de todo lo anterior. T051 y T052 pueden adelantarse.

### User Story Dependencies

```text
Fase 1 → Fase 2 → US1 (P1) ─┬─ US2 (P2) ─┐
                            └─ US3 (P3) ─┴─ Polish
```

### Within Each User Story

- Los tests de la historia se escriben primero y deben fallar.
- `src/api/` y `src/domain/` → componentes → página.
- Cada tarea que cierra un test lo nombra ("Debe pasar T0xx").

### Parallel Opportunities

- Fase 2: T003, T004 y T005; T009–T013; T017 y T018 junto con T014.
- US1: T019–T024 juntos; después T025, T026, T028 y T029 en paralelo; T027 cuando termina T025.
- US2: T037, T038 y T039; T041 en paralelo con T040.
- US3: T044, T045 y T046; T047 y T048 tocan archivos distintos (`.tsx` y `.module.css`) y pueden ir en paralelo.

---

## Parallel Example: User Story 1

```bash
# Tests de US1, todos juntos:
Task: "Test de butacas en tests/unit/domain/butacas.test.ts"
Task: "Test de sesión en tests/unit/domain/sesion-carrito.test.ts"
Task: "Tests de asientos y carritos en tests/unit/api/"
Task: "Test de SelectorButacas en tests/components/SelectorButacas.test.tsx"
Task: "Test de CarritoCreado en tests/components/CarritoCreado.test.tsx"
Task: "E2E en tests/e2e/butacas.spec.ts"

# Luego, en paralelo:
Task: "Crear src/domain/butacas.ts"
Task: "Crear src/domain/sesion-carrito.ts"
Task: "Crear src/api/carritos.ts"
Task: "Crear src/components/CabeceraFuncion/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Fase 1 + Fase 2.
2. Fase 3 (US1): de la ficha al carrito creado.
3. **Parar y validar** con T019–T024 y los recorridos 1–6, 8, 9 y 13 del quickstart.
4. Demo en local. **No se publica en producción solo con US1**: sin US2, un conflicto de butacas termina en un error genérico. Sin US3, el mapa no cumple el Principio VI.

### Incremental Delivery

1. Setup + Foundational → borde con la API listo.
2. US1 → recorrido feliz validado.
3. US2 → cada `codigo` validado (SC-003, SC-008).
4. US3 → teclado, lector de pantalla y 360 px validados (SC-006, SC-007).
5. Polish → CI, backend real y PR.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Commit al cerrar cada tarea o grupo lógico. El PR describe qué principios toca (constitución, Flujo de Desarrollo).
- Copy visible en español rioplatense con voseo, sin humor en errores (DESIGN.md §10). Los textos de las tareas son la base. Se ajustan con antislop sin cambiar qué dicen.
- El token nunca se loguea, ni siquiera en tests: usar `"token-de-prueba-no-real"` y verificar su ausencia.
