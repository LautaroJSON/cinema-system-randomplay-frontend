# Research: Pagar el carrito

Decisiones técnicas de la spec 005. Siguen vigentes las R de la 001, las B de la 003 y las C de
la 004. Acá la numeración empieza con prefijo `P`.

Fuentes: `specs/008-pago-mercado-pago/contracts/pagos-api.md` del backend, su `docs/openapi.json`
y el código de `PagosSimuladosController` (para la parte que el contrato OpenAPI no publica).

## P1. Contrato: copiar `openapi.json` y regenerar; `docs/api.md` no cambió

- **Decision**: copiar `docs/openapi.json` del backend a este repo y correr `npm run gen:api`.
  El diff contra la copia actual agrega `PagoIniciadoResponse`, `PagoResponse`,
  `EntradaResponse`, los campos `pago` y `entradas` (requeridos) de `CarritoResponse`, el
  endpoint `POST /api/carritos/{carritoId}/pago` (200, 401, 404, 409, 503) y el webhook (que el
  front no usa). `docs/api.md` del backend es idéntico al de este repo: no documenta los códigos
  nuevos. Para los códigos manda `pagos-api.md`; la falta se reporta al backend (Principio I).
- **Rationale**: Principio I. Al ser `pago` y `entradas` requeridos, `mapearCarrito` deja de
  compilar hasta que los mapea: el cambio de contrato se vuelve un error de compilación.
- **Alternatives considered**: escribir los tipos nuevos a mano a partir de `pagos-api.md`
  (prohibido por el Principio I).

## P2. El endpoint de pago simulado no está en el contrato

- **Decision**: `POST /api/dev/pagos-simulados` tiene `[ApiExplorerSettings(IgnoreApi = true)]`
  en el backend, así que no aparece en `openapi.json`. Su tipo se escribe a mano en un módulo
  propio, `src/api/pagos-simulados.ts`, que solo usa la página de pago simulado:
  `{ carritoId: string; estado: "Aprobado" | "Rechazado"; monto?: number }` →
  `{ pagoId: string; estadoCarrito: string }`. El archivo cita el controlador del backend como
  fuente.
- **Rationale**: es una herramienta de desarrollo que no existe en producción; pedirle al backend
  que la publique en el contrato público la documentaría como parte de la API real. Aislarla en un
  archivo propio deja el resto del cliente 100 % generado.
- **Alternatives considered**: pedir al backend que la publique (contamina el contrato público);
  llamarla con `fetch` desde el componente (prohibido por el Principio I). Se registra en
  Complexity Tracking.

## P3. Dónde se decide "desarrollo": variable del servidor, no `NODE_ENV` a secas

- **Decision**: `entorno.pagoSimulado` (en `src/config/entorno.ts`) vale `true` si
  `NODE_ENV === "development"` o si `PAGO_SIMULADO=1`. Lo leen solo Server Components:
  - `/carritos/[carritoId]/pago-simulado/page.tsx` responde `notFound()` si es `false`.
  - `/carritos/[carritoId]/page.tsx` y `/pago/page.tsx` le pasan el booleano a su isla como prop,
    para que el cliente sepa si puede seguir una dirección simulada (FR-009, FR-010).
- **Rationale**: los e2e corren con `npm run build && npm start` (producción). Con `NODE_ENV` solo,
  la página simulada daría 404 en los e2e del mock y de la API real. `PAGO_SIMULADO=1` se agrega a
  los dos `playwright.config` y a `.env.example` (comentada). El booleano no es un secreto y no
  necesita prefijo `NEXT_PUBLIC_`: viaja como prop.
- **Alternatives considered**: `NEXT_PUBLIC_PAGO_SIMULADO` (se hornea en el build y obliga a
  rebuild para cambiarlo); correr los e2e con `next dev` (más lentos y distintos de producción);
  decidir solo por `NODE_ENV` (rompe los e2e).

## P4. Destino de la dirección de pago: función pura con lista blanca

- **Decision**: `destinoPago(urlPago, carritoId, simuladoHabilitado)` en `src/domain/pago.ts`
  devuelve:
  - `{ tipo: "externo", url }` si `new URL(urlPago)` parsea sin base y el protocolo es `https:`;
  - `{ tipo: "simulado", ruta: "/carritos/{id}/pago-simulado" }` si empieza con
    `/api/dev/pagos-simulados/` y `simuladoHabilitado`;
  - `{ tipo: "invalido" }` en cualquier otro caso (incluida la simulada sin habilitar,
    `http:`, `javascript:`, rutas relativas distintas).
  Externo → `window.location.assign(url)` (misma pestaña, queda en el historial para volver).
  Simulado → `router.push(ruta)`. Inválido → error genérico, sin navegar.
- **Rationale**: FR-008 a FR-010. No se restringe el host a `mercadopago.*` porque los dominios
  de sandbox y producción varían por país; el backend es de confianza y `https:` corta los
  esquemas peligrosos. Una función pura se testea sin DOM.
- **Alternatives considered**: abrir en otra pestaña (la credencial está en `sessionStorage` de
  esta pestaña: la vuelta llegaría sin token); lista de hosts de Mercado Pago (frágil).

## P5. Sesión de la pestaña: Pagando conserva el token; Pagado guarda las entradas sin token

- **Decision**: la clave `randomplay:carrito` sigue en versión 2; `Carrito` suma `pago` y
  `entradas` (data-model.md). Cambia cuándo se cierra la sesión:
  - `Activo` y `Pagando`: token conservado (en Pagando hace falta para volver a la página de pago
    y para consultar).
  - `Pagado`: `cerrarSesion(carrito)`. Se borra el token y queda el carrito con sus entradas. Es
    un estado final: no hay nada más que pedir a la API, y recargar muestra las entradas desde la
    pestaña sin consultar.
  - `Expirado`, `Abandonado` o desconocido: `cerrarSesion`, como hoy.
  `parsearSesion` no exige `pago` ni `entradas` (una sesión guardada antes de esta feature los
  tiene `undefined`); `normalizarCarritoGuardado` los completa con `null` y `[]`.
- **Rationale**: Principio III pide el menor alcance posible para la credencial. Con Pagado el
  token ya no sirve para nada, y conservarlo hasta que venza (`tokenVenceEn`) haría que un `401`
  posterior descarte la sesión y con ella las entradas. Se corrige FR-030 de la spec en ese
  sentido (lo que se conserva son las entradas, no la credencial).
- **Alternatives considered**: conservar el token en Pagado (más superficie y riesgo de perder las
  entradas por un `401`); subir a versión 3 (no hace falta: los campos nuevos son aditivos).

## P6. Vistas nuevas: `pagando` y `pagado`

- **Decision**: `vistaPantalla` (domain/carrito.ts) suma dos vistas, evaluadas antes de las
  existentes:
  - `{ tipo: "pagado", carrito }` si el carrito guardado está `Pagado`, haya token o no y aunque el
    contador esté en cero (FR-029).
  - `{ tipo: "pagando", sesion }` si está `Pagando` y hay token, aunque el contador esté en cero.
  `esModificable` sigue exigiendo `Activo`. `etiquetaEstado` suma `Pagando → "Pago en curso"` y
  `Pagado → "Pagado"`. `PantallaCarrito`, `CambioButacas` y la nueva `VueltaPago` comparten
  `vistaPantalla`.
- **Rationale**: un solo lugar decide qué se ve, como en la 004. Evaluar Pagado primero evita que
  un `venceEn` pasado lo muestre vencido.
- **Alternatives considered**: un booleano `bloqueado` dentro de la vista `activo` (mezcla dos
  conjuntos de acciones en la misma vista y obliga a ramas en cada componente).

## P7. Contador en Pagando: al llegar a cero se va a la página de vuelta

- **Decision**: `useAlVencer` sigue cerrando la sesión solo para `Activo`. Para `Pagando`, la
  pantalla del carrito y la de cambio de butacas navegan a `/carritos/{id}/pago` al llegar a cero;
  la página de vuelta consulta y muestra lo que decida la API (FR-028). En la página de vuelta el
  contador en cero dispara una consulta inmediata.
- **Rationale**: el backend verifica pagos aprobados al consultar un carrito Pagando "vigente o
  vencido": un pago aprobado en el último segundo termina en Pagado, no en Expirado. Declararlo
  vencido en el cliente contradiría a la API (Principio IV). Reusar la página de vuelta evita una
  segunda implementación de la espera.
- **Alternatives considered**: tratarlo como vencido (como el Activo): muestra "se terminó el
  tiempo" sobre un pago que pudo aprobarse.

## P8. Espera en la página de vuelta: cadena de `setTimeout`, tope y visibilidad

- **Decision**: hook `useEsperaPago` en `src/components/VueltaPago/`, con la lógica de decisión
  pura en `domain/pago.ts` (`siguientePaso(estado, transcurridoMs)` → `consultar` | `detener` |
  `terminar`):
  - Al montar, consulta enseguida. Mientras la respuesta sea `Pagando`, programa la siguiente
    consulta 2 s después de recibir la anterior (`setTimeout`, nunca se superponen).
  - Tope: 2 minutos desde el inicio de la espera (`ESPERA_PAGO_MAXIMA_MS` e
    `INTERVALO_CONSULTA_PAGO_MS` en `config/experiencia.ts`, valores de experiencia).
  - Error de red o código desconocido: no corta; cuenta como un ciclo más (FR-023). `401` o
    `carrito-no-encontrado`: descarta la sesión y muestra la vista "perdido" (Principio III).
  - "Revisar de nuevo" reinicia el reloj de la espera.
  - Con la pestaña oculta no se consulta; al volver (`visibilitychange`) se consulta de
    inmediato si la espera sigue viva (edge case).
  - Al desmontar, se cancela el timeout pendiente y se ignora la respuesta en vuelo.
- **Rationale**: el contrato recomienda 2 s. Una cadena de timeouts evita pedidos superpuestos si
  la API tarda (el backend puede tardar hasta 3 s consultando a Mercado Pago). Separar la decisión
  pura del hook permite testear el tope con timers simulados.
- **Alternatives considered**: `setInterval` (superpone pedidos); polling con
  `useSyncExternalStore` del reloj existente (el reloj marca segundos para el contador y no
  conviene acoplar la red a él).

## P9. Errores del inicio de pago y `carrito-en-pago`

- **Decision**: `CODIGOS` en `problema.ts` suma `email-entrega-faltante`, `carrito-en-pago`,
  `carrito-modificado` y `pago-no-disponible`. `OperacionCarrito` suma `"pagar"`.
  `resolverProblemaCarrito` suma transiciones:

  | Código | Operación | Transición |
  |---|---|---|
  | `401`, `carrito-no-encontrado` | todas | `perdido` (descartar sesión) |
  | `email-entrega-faltante` | pagar | `pedirEmail` |
  | `carrito-no-activo` | pagar | `cerrar` con `estadoActual`, y además se pide `GET` del carrito para traer las entradas si quedó Pagado |
  | `carrito-modificado` | pagar | `releer` (GET y aviso "revisá y tocá Pagar de nuevo") |
  | `pago-no-disponible` | pagar | `error` con el texto de FR-031 |
  | `carrito-en-pago` | cambiar, email, abandonar | `enPago` (GET; la vista pasa a `pagando`) |
  | `carrito-en-pago` | pagar, obtener | `error` (no debería ocurrir) |
  | red / desconocido | todas | `error` como hoy |

  El `switch` sigue siendo exhaustivo (`never`), así que agregar los códigos obliga a manejarlos.
- **Rationale**: Principio II. `carrito-no-activo` con `estadoActual: "Pagado"` llega sin
  entradas: hace falta el `GET` para mostrar la compra cerrada (FR-031, US5-3).
- **Alternatives considered**: tratar `carrito-modificado` como reintento automático (podría
  pagar una selección distinta de la que el comprador cree; mejor que mire y vuelva a tocar).

## P10. Botón "Pagar" sin email

> **Reemplazada (2026-11-17, pedido del dueño):** sin email guardado la sección "Pago" no se
> muestra; aparece al guardarlo. Mientras se edita el email, "Pagar" va con contorno. El aviso y
> el foco en el campo quedan solo para `email-entrega-faltante`. Lo que sigue es la decisión
> original.

- **Decision**: con `emailEntrega === null`, "Pagar" está habilitado; al tocarlo no llama a la API,
  muestra "Primero guardá el email para recibir las entradas" junto al botón y lleva el foco al
  campo del email (EmailEntrega expone una `ref` al campo). El mismo comportamiento se usa ante
  `email-entrega-faltante`.
- **Rationale**: un botón deshabilitado no recibe foco y no explica por qué; habilitado con
  mensaje cumple FR-004 y WCAG (el motivo es texto visible, asociado con `aria-describedby`).
- **Alternatives considered**: ocultar "Pagar" hasta tener email (el comprador no sabe que hay un
  paso más); deshabilitarlo (inaccesible).

## P11. Dinero del pago simulado

- **Decision**: el campo de "Pagar otro monto" se precarga con `total.monto` (texto) y se valida
  con `/^\d{1,9}(\.\d{1,2})?$/` y mayor que cero. Se envía como `number` (`Number(texto)`) porque
  el backend lo recibe como `decimal` JSON. No se hace aritmética con él.
- **Rationale**: Principio V prohíbe aritmética en punto flotante, no serializar un valor que el
  usuario escribió. Un decimal con 2 decimales y hasta 9 enteros se representa sin pérdida
  visible al serializar.
- **Alternatives considered**: enviarlo como texto (el backend espera número: 400).

## P12. Entradas en pantalla

- **Decision**: componente `ListaEntradas` (presentacional, servible en cliente) que recibe
  `Entrada[]`: una `<li>` por entrada con el código en tipografía grande y monoespaciada
  (`DESIGN.md`), película, sucursal, sala, fecha y hora (`formatearFecha`, `formatearHora`), fila
  y número, y precio (`formatearPrecio`). Se usa en la página de vuelta y en la vista `pagado` del
  carrito. El aviso de email nombra `emailEntrega`.
- **Rationale**: FR-019 y FR-029 piden la misma información en dos lugares; un solo componente.
- **Alternatives considered**: tabla (en 360 px obliga a scroll horizontal).

## P13. Anuncios a tecnologías de asistencia

- **Decision**: la página de vuelta tiene una región `role="status"` (`aria-live="polite"`) que
  cambia solo al cambiar de fase (esperando → listo / vencido / sin confirmar), no en cada
  consulta. Al llegar a Pagado o Expirado el foco va al nuevo `h1`, como en la 004 (C12).
- **Rationale**: FR-024 y Principio VI.

## P14. Mocks: `mock-api.mjs` y MSW

- **Decision**:
  - `scripts/mock-api.mjs`: `POST /api/carritos/{id}/pago` (exige email; primera vez pasa a
    Pagando con `venceEn + 1 min` y `urlPago = /api/dev/pagos-simulados/pref-{n}`; segunda vez
    devuelve lo mismo), `POST /api/dev/pagos-simulados` (Aprobado con el total → Pagado con
    entradas generadas; Rechazado u otro monto → sigue Pagando), y `409 carrito-en-pago` en
    asientos, email y abandono. Un carrito Pagando con `venceEn` pasado y sin pago aprobado pasa a
    Expirado al consultarlo, como el backend.
  - `tests/msw/handlers.ts`: handlers de `POST …/pago` y `POST /api/dev/pagos-simulados` y
    fixtures `pagando` y `pagado` en `carritos-estados.json`. Los tests de cada código usan
    `server.use(...)`.
- **Rationale**: Principio VII pide simular la red con los tipos generados. El mock local
  mantiene `API_MOCK`/e2e funcionando sin backend.

## P15. Constitución: enmienda MINOR a 1.2.0

- **Decision**: el plan incluye enmendar la sección "Restricciones de Plataforma y Tecnología":
  - Reemplazar "Solo existe el flujo del comprador (catálogo → función → asientos → carrito →
    email). El pago todavía no existe en la API; ninguna pantalla DEBE simular un pago como si fuera
    real." por: el flujo llega hasta el pago en Mercado Pago y las entradas; el frontend **NO
    DEBE** pedir ni transmitir datos de tarjeta; la simulación de pago **DEBE** existir solo en
    desarrollo y pruebas, identificarse como tal y responder 404 en producción.
  - Principio III: aclarar que el token tampoco viaja a la página de pago ni al endpoint de pago
    simulado (público).
  Versión 1.1.0 → 1.2.0 (MINOR: amplía materialmente una guía).
- **Rationale**: Gobernanza. La restricción vigente quedó desactualizada con la feature 008 del
  backend.

## P16. Dirección de vuelta del backend

- **Decision**: no se cambia nada en el front. Para la pasarela real, el backend necesita
  `MercadoPago__UrlRetorno=http://localhost:3000/carritos/{carritoId}/pago` (su `appsettings.json`
  trae el puerto 5173). Con la pasarela simulada no hace falta: el front navega solo. Se documenta
  en quickstart.md y se reporta al backend.
