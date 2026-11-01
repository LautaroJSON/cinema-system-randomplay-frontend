# Research: Mapa de butacas y retención de asientos

Decisiones técnicas de la spec 003. Cada una cita los requisitos que resuelve. Los R1–R16 de la
spec 001 siguen vigentes; acá la numeración empieza de nuevo con prefijo `B`.

## B1. Carga inicial del mapa en el servidor, sin caché

- **Decision**: `src/app/funciones/[funcionId]/page.tsx` es un Server Component con
  `export const dynamic = "force-dynamic"`. Pide el mapa con un `fetch` `cache: "no-store"` a
  través de una variante del cliente (`pedirSinCache`, B2) y le pasa el mapa ya normalizado a la
  isla de cliente `SelectorButacas`. `generateMetadata` reutiliza el mismo pedido con
  `React.cache` para no pedir dos veces por request.
- **Rationale**: el mapa es una consulta pública (Principio VIII: se resuelve en el servidor) y
  la disponibilidad no se cachea nunca (Principio IX, FR-004). Next sirve las rutas dinámicas con
  `Cache-Control: private, no-cache, no-store`, así que tampoco las guarda un CDN. La cabecera y
  el mapa ya vienen en el HTML inicial, sin un "cargando".
- **Alternatives considered**: pedir el mapa solo desde el navegador (agrega un estado de carga
  y contradice el Principio VIII); ISR con `revalidate: 0` (en Next 16 equivale a dinámica, pero
  `force-dynamic` deja la intención explícita y no depende de los `fetch` de la página).

## B2. Dos transportes en `src/api/`: servidor y navegador

- **Decision**:
  - `src/api/client.ts` (servidor) suma una opción `cache: "no-store"` a `pedir` (hoy exige
    `revalidate` y `tags`) para el mapa inicial. El 404 se sigue devolviendo como `null`, y el
    410 sale como `ApiError` con `status`.
  - `src/api/navegador.ts` (nuevo, importable solo desde componentes de cliente) es el
    transporte del navegador: URL relativa `/api/...` (llega al backend por el `rewrite` de
    `next.config.ts`), `cache: "no-store"`, timeout de 8 s con `AbortSignal.timeout` y header
    `Authorization` opcional. Devuelve un resultado discriminado
    `{ ok: true, datos } | { ok: false, problema }` en lugar de lanzar. Así cada pantalla tiene
    que tratar el error.
  - `src/api/problema.ts` (nuevo, compartido) parsea `application/problem+json` a un `Problema`
    tipado (data-model.md).
  - `src/api/asientos.ts` y `src/api/carritos.ts` exponen funciones de dominio
    (`obtenerMapa`, `obtenerMapaDesdeNavegador`, `crearCarrito`, `abandonarCarrito`) sobre esos
    transportes y mapean las respuestas generadas a tipos del frontend.
- **Rationale**: Principio I (un solo módulo cliente, los componentes no llaman a `fetch`).
  `entorno.apiUrl` lee `process.env`, que no existe en el navegador. Por eso el navegador
  necesita URLs relativas y un transporte propio. El resultado discriminado hace visible en los
  tipos que cada `codigo` tiene que tener su manejo (Principio II).
- **Alternatives considered**: reutilizar `pedir` en el navegador (depende de `entorno` y de las
  opciones `next` de caché); Server Actions para crear el carrito (el token pasaría por el
  servidor de Next, y el Principio III prefiere que todo lo que lo toca viva en el cliente);
  una librería de fetching como SWR o TanStack Query (dependencia nueva para tres llamadas, sin
  caché deseada).

## B3. Parseo de problemas y extensiones sin tipar en el contrato

- **Decision**: `leerProblema(respuesta)` devuelve
  `{ status, codigo?, asientos?, errors?, retryAfterSegundos? }`. Valida `asientos` (arreglo de
  `{ fila: A–Z, numero ≥ 1 }`) y `errors` (objeto de arreglos de strings) a mano y descarta lo que
  no cumple. `codigo` se normaliza a la unión `CodigoCarrito` o a `"desconocido"`. Nunca usa
  `title` ni `detail` para decidir (Principio II). El `ApiError` actual de `client.ts` pasa a
  usar `leerProblema` para no tener dos parseos.
- **Rationale**: `ProblemDetails` en `openapi.json` describe `errors`, `asientos` y
  `estadoActual` en el texto, pero no los declara como propiedades. Los tipos generados no los
  incluyen, así que hay que validar en el borde.
- **Follow-up**: reportar al backend que agregue `errors`, `asientos` y `estadoActual` al schema
  `ProblemDetails` (Principio I: ante una discrepancia, se reporta). No bloquea.

## B4. `Retry-After`

- **Decision**: se acepta un entero de segundos o una fecha HTTP (RFC 9110). Si falta, no se
  puede leer o no es positivo, se usan 60 s (edge case de la spec). El tope es de 600 s, para
  que un valor absurdo no deje el botón bloqueado. La espera se cuenta como duración con
  `setTimeout`/`setInterval` desde que llega la respuesta. Una fecha HTTP se convierte a
  duración una sola vez, al recibirla.
- **Rationale**: FR-027 y el edge case del reloj corrido. El backend hoy manda segundos, y
  aceptar la fecha cuesta una línea.

## B5. Dinero en centavos

- **Decision**: `src/domain/dinero.ts` con `aCentavos(monto): number | null` (exige
  `^\d+\.\d{2}$`, arma el entero con la parte entera × 100 + los decimales, sin `parseFloat`),
  `desdeCentavos(centavos, moneda): Dinero` (vuelve a texto `"9000.00"`) y
  `multiplicar(dinero, cantidad): Dinero | null`. El total se muestra con el `formatearPrecio`
  que ya existe. Si `monto` llega mal formado, el total se muestra como "Total no disponible" y
  la confirmación sigue habilitada: la API decide el precio (Principio IV).
- **Rationale**: Principio V y FR-018. `Number` representa centavos de forma exacta hasta
  2^53, muy por encima de 10 entradas de cualquier precio real. `bigint` complica sin ganar nada.
- **Alternatives considered**: una librería decimal (dependencia innecesaria para una
  multiplicación por un entero ≤ 10).

## B6. Estado del mapa y de la selección como reducer puro

- **Decision**: `src/domain/butacas.ts` concentra la lógica pura:
  - `construirMapa(filasApi)` arma las filas con sus butacas libres u ocupadas y normaliza
    `integer | string` con `normalizarEntero`.
  - `reducirSeleccion(estado, accion)` maneja estas acciones:
    - `alternar` respeta el máximo efectivo y nunca selecciona una ocupada.
    - `marcarOcupadas(asientos)` pasa butacas a ocupadas y las saca de la selección.
    - `reemplazarMapa(mapa)` saca de la selección lo que ya no está libre o ya no existe y
      devuelve cuáles salieron.
    - `limpiar`.
  - `etiquetaButaca` y `listarAsientos` (por ejemplo, "la F7 y la F8") arman los textos de
    butacas para avisos y nombres accesibles.

  El máximo vive en `src/config/experiencia.ts` (`MAX_BUTACAS_POR_COMPRA = 10`), documentado
  como valor de experiencia (Principio IV, FR-016).
- **Rationale**: Principio VII (la lógica de selección se testea sin DOM) y VIII (los
  componentes no tienen lógica de negocio). Un reducer hace explícitas las transiciones que
  disparan los errores (FR-024, FR-029).

## B7. Accesibilidad del mapa: grilla con foco itinerante

- **Decision**:
  - Contenedor `role="grid"` con `aria-label="Butacas de {sala}"`. Cada fila es `role="row"`,
    con la letra de cada lado como `role="rowheader"` (la derecha con `aria-hidden`, para no
    anunciarla dos veces). Cada butaca es `role="gridcell"` y contiene un `<button type="button">`.
  - Nombre accesible del botón: `"Fila F, butaca 7, libre"`, `"…, seleccionada"` u
    `"…, ocupada"`. El estado va en español dentro del nombre, como pide FR-010. No se usa
    `aria-pressed`, que haría que el lector anuncie "presionado" además del estado. Las ocupadas
    llevan `aria-disabled="true"`, siguen siendo enfocables para que se puedan explorar y no
    hacen nada al activarlas.
  - Foco itinerante: una sola butaca con `tabIndex=0` y el resto con `-1` (una parada de Tab,
    FR-011). Teclas: ← → dentro de la fila; ↑ ↓ a la fila vecina, al número más cercano si las
    filas tienen distinto largo; Inicio/Fin al extremo de la fila; Enter o Espacio alterna. El
    foco inicial es la primera butaca libre de la fila del medio, o la última enfocada.
  - Al mover el foco se llama a `scrollIntoView({ block: "nearest", inline: "nearest" })` para
    que la butaca quede a la vista en salas con desplazamiento (FR-013).
  - Una región `aria-live="polite"` anuncia el resumen ("2 butacas, total $ 11.000,00"). Los
    avisos de error de la confirmación van en `role="alert"`, porque responden a una acción del
    comprador. El aviso de máximo alcanzado va por la región de cortesía.
- **Rationale**: Principio VI y la US3. El patrón APG "Grid" con foco itinerante es el estándar
  para colecciones 2D. Los botones nativos dan Enter/Espacio y foco sin reimplementarlos.
- **Alternatives considered**: checkboxes nativos en un `fieldset` por fila (accesibles sin JS,
  pero obligan a recorrer con Tab cada butaca, hasta 96 paradas en la Sala 1 de Centro, y no
  cumplen FR-011); `aria-selected` en la celda con `aria-multiselectable` (el anuncio de
  "seleccionado" varía mucho entre lectores y no cubre "ocupada").

## B8. Butacas que se achican y letras fijas

- **Decision**:
  - El área del mapa es un *container* (`container-type: inline-size`). El tamaño de butaca se
    calcula en CSS: `--butaca: clamp(24px, (100cqi - 2 × letra - huecos) / var(--max-asientos),
    32px)`. `--max-asientos` lo fija el componente como variable inline, con la fila más larga.
  - Las filas se centran respecto de la más larga.
  - El área de butacas tiene `overflow-x: auto`. Las letras de fila son celdas con
    `position: sticky` (`inset-inline-start: 0` y `inset-inline-end: 0`) y fondo opaco, así que
    quedan fijas a los costados mientras las butacas se desplazan.
  - La pantalla ("PANTALLA") ocupa el ancho de la fila más larga.
  - Medidas para la Sala 2 de Centro (14 butacas) en 360 px: con 16 px de margen a cada lado
    quedan 328 px. Dos letras de 24 px y 13 huecos de 4 px dejan unos 228 px para 14 butacas,
    16 px cada una. Como 16 px está por debajo del mínimo, quedan en 24 px y el área se desplaza.
    Las salas de 8 a 10 butacas entran sin desplazamiento.
- **Rationale**: clarificación 3, FR-012, FR-013 y SC-007, solo con CSS de plataforma. No
  necesita `ResizeObserver` ni dependencias.

## B9. Credencial del carrito en `sessionStorage`

- **Decision**: `src/domain/sesion-carrito.ts` (se usa solo desde el cliente) guarda una sola
  clave, `randomplay:carrito`, con
  `{ version: 1, carritoId, token, tokenVenceEn, carrito }`, donde `carrito` es la respuesta
  mapeada. La pantalla provisoria la muestra sin pedir nada a la API. Funciones:
  - `almacenamientoDisponible()`: escribe y borra una clave de prueba dentro de un try/catch.
  - `leerSesion()`: valida la forma y devuelve `null` si no la reconoce.
  - `guardarSesion()` y `descartarSesion()`.

  Ningún `console.*` ni mensaje de error incluye el contenido. Los `ApiError` y los `Problema`
  no copian headers ni cuerpos del pedido.
- **Rationale**: Principio III, FR-022, FR-023 y FR-033. Una sola clave versionada facilita que
  la spec 004 la lea y la amplíe.
- **Alternatives considered**: guardar solo token e id y pedir el carrito con `GET` en la
  pantalla provisoria (agrega trabajo de la 004 sin necesidad); usar `localStorage` (lo prohíbe
  la constitución).

## B10. Secuencia de confirmación

- **Decision**: la confirmación hace estos pasos en orden:
  1. Bloquea el botón para evitar el doble envío (FR-020).
  2. Si `almacenamientoDisponible()` es falso, muestra un aviso y corta, sin llamar a la API.
  3. Si hay sesión guardada, llama a `abandonarCarrito(id, token)` con un timeout de 3 s,
     ignora cualquier resultado y llama a `descartarSesion()` (FR-032).
  4. Llama a `crearCarrito(funcionId, seleccion)` con `desafio: null`.
  5. Con un 201, llama a `guardarSesion()` y `router.push("/carritos/{id}")`. Si el error tiene
     un `codigo`, se resuelve con la tabla de B11.
- **Rationale**: clarificaciones 1 y 2. `router.push` conserva el estado de la pestaña y el
  token nunca toca la URL. El id sí, y no es credencial.

## B11. Manejo por `codigo` en la confirmación

| Resultado | Estado de la página | Acción |
|---|---|---|
| `asientos-no-disponibles` (409) | `conflicto` | `marcarOcupadas(problema.asientos)`. Después `obtenerMapaDesdeNavegador` + `reemplazarMapa`. Aviso: "Alguien tomó la F7 antes que vos. Actualizamos el mapa; elegí otra." Si el refresco falla, las butacas quedan marcadas y se ofrece "Actualizar mapa". |
| `funcion-no-encontrada` (404), `funcion-no-disponible` (410) | `funcionCerrada` | Bloquea el mapa y el botón. Enlace "Ver otros horarios" a `/peliculas/{peliculaId}#titulo-horarios`. |
| `funcion-sin-cupo` (409) | `sinCupo` | Aviso para que pruebe en unos minutos. La selección queda intacta y el botón habilitado. |
| `demasiados-pedidos` (429) | `esperando(segundos)` | Botón deshabilitado con "Podés volver a intentar en N s". Al llegar a 0 se habilita. |
| `pedido-invalido` (400) | `invalido(mensajes)` | Mensajes de `errors.asientos` (o `Asientos`, sin distinguir mayúsculas) junto al resumen. El resto, como aviso general. |
| `asientos-inexistentes` (422) | `conflicto` | Refresca el mapa y lo reemplaza (saca de la selección lo inexistente). Aviso: "Algunas butacas ya no existen en esta sala. Actualizamos el mapa." |
| `desafio-rechazado`, otro `codigo`, sin `codigo`, red o timeout | `errorGenerico` | "No pudimos reservar las butacas. Probá de nuevo." Botón "Reintentar" que vuelve a confirmar. La selección se conserva. |

Si el refresco que sigue a un conflicto responde 404 o 410, se pasa a `funcionCerrada`. Los
textos finales se escriben en la implementación siguiendo DESIGN.md §10. Los de esta tabla
fijan qué dicen, no la redacción definitiva.

## B12. Función inexistente o comenzada al cargar

- **Decision**:
  - Id que no es GUID o mapa con 404: `notFound()`. Es el 404 real de la marca, con
    `robots: noindex` (FR-006).
  - Mapa con 410: la página muestra "Esta función ya empezó" con un enlace a la cartelera
    (`EstadoVacio`) y responde 200, porque el App Router no permite fijar un 410 desde una
    página. Como la página es `noindex` y está en `Disallow`, el status no afecta al SEO.
  - Cualquier otro error: `error.tsx`, que ya existe (error recuperable con "Reintentar").
- **Rationale**: Principio IX (404 real) y edge cases de la spec.

## B13. Metadata y exclusión del índice

- **Decision**: `generateMetadata` devuelve `title: "Butacas · {pelicula}"`,
  `robots: { index: false, follow: false }` y nada de canónica ni Open Graph. `/carritos/[id]`
  devuelve `title: "Tu carrito"` y el mismo `robots`. `sitemap.ts` no cambia (solo lista
  películas) y `robots.ts` ya excluye `/funciones/` y `/carritos/`.
- **Rationale**: FR-005, FR-033 y Principio IX.

## B14. Pantalla provisoria `/carritos/[carritoId]`

- **Decision**: la página es un Server Component mínimo (metadata `noindex`) con la isla
  `CarritoCreado`. La isla lee la sesión con `useSyncExternalStore`: el snapshot del servidor es
  `null` y el del cliente sale de `leerSesion()`, así que no hay diferencias de hidratación.
  - Si `carritoId` coincide, muestra "Tu carrito quedó creado", la película, la sucursal, la
    sala, la hora, las butacas y el total.
  - Si no coincide, muestra "No hay un carrito activo en esta pestaña" con un enlace a la
    cartelera (FR-033).
  - No pide nada a la API y no muestra la cuenta regresiva, que es de la 004.
- **Rationale**: clarificación 2 y la pantalla mínima que pide la spec.

## B15. Tests

- **Decision**:
  - **Vitest + MSW** para la lógica y los componentes. En jsdom, el `fetch` relativo se resuelve
    contra `http://localhost:3000`, así que los handlers del navegador se registran como
    `*/api/...`. Fixtures nuevos: `tests/fixtures/mapas.json` (una sala por cada sala sembrada,
    con algunas ocupadas) y `carritos.json`, tipados con `satisfies` contra los schemas
    generados.
  - **Playwright** contra `scripts/mock-api.mjs`, ampliado con:
    - `GET /api/funciones/{id}/asientos` desde los fixtures. Un id especial responde 410.
    - `POST /api/funciones/{id}/carritos`: responde 201 con un token falso fijo.
    - `POST /api/carritos/{id}/abandono`: responde 200.

    Los `funcionId` de `horarios.json` se alinean con `mapas.json` para que el recorrido
    ficha → función funcione. Este mock es una herramienta de test, no el modo `API_MOCK=1` de
    la spec 002, que no se toca.
  - **Desarrollo manual** contra el backend real (quickstart.md).
- **Rationale**: Principio VII (red simulada, consultas por rol) y el pedido explícito de la spec.

## B16. Antislop y dial

- **Decision**: para la UI de esta spec, la implementación resuelve el modo de antislop según
  `CLAUDE.md` antes de editar. El dial del flujo privado es 1/1/1 (DESIGN.md §11):
  - un solo botón rojo, "Confirmar N butacas";
  - sin trama halftone ni etiquetas pegadas en el mapa;
  - solo transiciones de hover, foco y presión.
- **Excepción aprobada (2026-11-01)**: antislop R-03 pide objetivos táctiles de 44 px. El dueño
  eligió mantener las butacas del mapa entre 24 y 32 px (WCAG 2.5.8, FR-012). La excepción vale
  solo para las butacas; el resto de los controles tiene 44 px o más.
- **Rationale**: DESIGN.md §2 y §11.
