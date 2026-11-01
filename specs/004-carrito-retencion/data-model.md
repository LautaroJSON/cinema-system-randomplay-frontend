# Data Model: Carrito con retención corta

Tipos del frontend que se derivan de los schemas generados (`src/api/schema.d.ts`). Los tipos de
la API no se escriben a mano. Estos son los tipos propios a los que se mapean en `src/api/`.
`MapaFuncion`, `Fila`, `Butaca`, `EstadoSelector` y `Problema` siguen como en
[la 003](../003-mapa-butacas/data-model.md), con los cambios que se indican.

## Carrito (`Carrito`)

Origen: `CarritoResponse`, que devuelven `GET /api/carritos/{id}`, `PUT .../asientos`,
`PUT .../email-entrega`, `POST .../abandono` y, dentro de `carrito`, la creación. Reemplaza al
`CarritoCreado["carrito"]` reducido de la 003.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `string` (GUID) | Va en la URL. No es credencial. |
| `estado` | `string` | `Activo`, `Abandonado` o `Expirado`. Se guarda tal cual y se traduce con `etiquetaEstado`. Un valor desconocido se trata como no modificable. |
| `venceEn` | ISO 8601 con offset | Base de la cuenta regresiva. Cada respuesta lo reemplaza: cambiar butacas o email no lo extiende (lo decide la API). |
| `abandonadoEn` | ISO 8601 o `null` | Se guarda; no se muestra. |
| `asientos` | `Asiento[]` | En el orden de la API. `numero` se normaliza a entero. |
| `funcion` | `{ funcionId, horaInicio, peliculaId, peliculaTitulo, sucursalNombre, salaNombre }` | `peliculaId` arma "Elegir otra función" (`/peliculas/{id}#titulo-horarios`). |
| `precioUnitario`, `total` | `Dinero` | Se muestran como llegan. El total **no** se recalcula (FR-009). |
| `emailEntrega` | `string` o `null` | Precarga el campo. Con valor, la pantalla muestra "Qué sigue". |

`creadoEn` no se usa y no se mapea.

## Sesión del carrito en la pestaña (`SesionCarrito`, versión 2)

Clave de `sessionStorage`: `randomplay:carrito` (la misma de la 003).

```json
{
  "version": 2,
  "carritoId": "…",
  "token": "… o null",
  "tokenVenceEn": "2026-11-01T22:30:00-03:00 o null",
  "carrito": { "…": "Carrito" },
  "desfaseMs": 1200
}
```

| Campo | Regla |
|---|---|
| `token` | **Credencial.** `null` cuando el carrito está cerrado (abandonado, vencido o no activo según la API). Nunca en logs, URLs, errores ni props de Server Components. |
| `carrito` | Último `Carrito` recibido de la API. Con `token: null` sirve solo para el modo lectura. |
| `desfaseMs` | Hora del servidor menos hora del dispositivo, medida en la última respuesta (research C4). |

| Operación (`domain/sesion-carrito.ts`) | Efecto |
|---|---|
| `guardarSesion(sesion)` | La crea la 003 al confirmar, ahora en versión 2. |
| `parsearSesion(crudo)` | Acepta solo la versión 2 (la 1 de la 003 no se publicó). Una versión o forma no reconocida devuelve `null`. |
| `actualizarCarrito(carrito, desfaseMs)` | Reemplaza `carrito` y `desfaseMs` sin tocar el token. Si no hay sesión o el id no coincide, no hace nada. |
| `cerrarSesion(carrito?)` | `token` y `tokenVenceEn` pasan a `null`; conserva el último carrito (o el recibido). |
| `descartarSesion()` | Borra la clave entera. |

Reglas:

| Regla | Origen |
|---|---|
| El token se usa solo si `sesion.carritoId` es igual al id de la URL, y se envía solo a rutas armadas con `sesion.carritoId`. | FR-002, FR-003 |
| `401` o `carrito-no-encontrado` → `descartarSesion()`. | FR-005, FR-034 |
| Abandono exitoso, `carrito-no-activo`, `estado` distinto de `Activo` en una respuesta, o contador en cero → `cerrarSesion()`. | FR-005 |
| La confirmación de la 003 abandona la sesión anterior solo si tiene token. | research C2 |

## Cuenta regresiva

Derivada; no se guarda. La calcula `domain/cuenta-regresiva.ts`.

| Valor | Cálculo |
|---|---|
| `desfaseMs` | `horaServidorMs − recibidoEnMs` de la última respuesta, o 0 si falta el header `Date`, si no se puede leer o si supera las 12 h. |
| `restanteMs` | `max(0, Date.parse(venceEn) − (Date.now() + desfaseMs))`. Un `venceEn` ilegible da 0. |
| `tramo` | `normal` si `restanteMs > AVISO_VENCIMIENTO_MS` (2 min); `final` si `0 < restanteMs ≤ 2 min`; `vencido` si `restanteMs = 0`. |
| Texto visible | `MM:SS`, segundos redondeados hacia arriba (`formatearContador`). |
| Texto accesible | "Quedan 4 minutos y 12 segundos" (`describirRestante`). |

```text
normal ──restante ≤ 2 min──▶ final ──restante = 0──▶ vencido   (sin retorno)
normal ──restante = 0 (pestaña suspendida)──▶ vencido
```

Avisos a la región de cortesía: uno al entrar a `final` y uno al entrar a `vencido`, una vez cada
uno por carga de la pantalla.

## Estado de la pantalla del carrito (`EstadoPantalla`)

Unión discriminada que maneja `reducirPantalla` en `domain/carrito.ts`.

| Vista | Cuándo | Qué muestra |
|---|---|---|
| `sinLeer` | Antes de leer la pestaña (servidor e hidratación). | Nada, para no parpadear. |
| `sinSesion` | Sin sesión, sesión de otro id o almacenamiento bloqueado. | "No hay un carrito activo en esta pestaña" + "Ver la cartelera". |
| `activo` | Sesión con token, `estado = Activo` y tramo distinto de `vencido`. | Resumen, contador, email, "Cambiar butacas", "Abandonar carrito". |
| `lectura` | Sesión cerrada, `estado` distinto de `Activo` o tramo `vencido`. | Resumen con estado, sin acciones. "Elegir otra función". Cinta de peligro si está vencido. |
| `perdido` | `401` o `carrito-no-encontrado`. | "No pudimos recuperar tu carrito." + "Elegir otra función" o "Ver la cartelera". |

Sub-estados de `activo` (uno por operación, independientes entre sí):

| Operación | Estados |
|---|---|
| Actualización (`GET`) | `actualizando` → `al día` / `falló { porRed }` |
| Email | `editando { texto, error? }` → `guardando` → `guardado` / `invalido { mensajes }` / `falló { porRed }` |
| Abandono | `inactivo` → `confirmando` → `abandonando` → (pasa a `lectura`) / `falló { porRed }` |

Transiciones de vista:

```text
sinLeer ──sesión de este id con token──▶ activo (con el carrito guardado) ──GET──▶ activo / lectura / perdido
sinLeer ──sesión de este id sin token──▶ lectura
sinLeer ──sin sesión / otro id──▶ sinSesion
activo ──contador en 0──▶ lectura (vencido)              cerrarSesion
activo ──abandono 200 / carrito-no-activo──▶ lectura     cerrarSesion
activo ──respuesta con estado ≠ Activo──▶ lectura        cerrarSesion
activo ──401 / carrito-no-encontrado──▶ perdido          descartarSesion
activo ──red / desconocido──▶ activo (con aviso y, si es red, cinta)
```

`lectura`, `perdido` y `sinSesion` son terminales hasta que el comprador empieza de nuevo.

## Selección en el cambio de butacas

Usa el `EstadoSelector` de la 003 con dos agregados en `domain/butacas.ts`:

| Función | Efecto |
|---|---|
| `marcarPropias(filas, asientos)` | Devuelve las filas con esas butacas en `libre = true`. Se aplica al mapa inicial y a cada mapa refrescado, con las butacas que el carrito retiene en ese momento. Las que no existen en el mapa se ignoran. |
| `estadoInicial(filas, seleccionInicial = [])` | La selección arranca con las butacas del carrito (las que existen y quedaron libres tras `marcarPropias`). |
| `mismaSeleccion(a, b)` | `true` si tienen las mismas butacas sin importar el orden. Deshabilita "Guardar" cuando no hay cambios. |

El cuerpo de `PUT .../asientos` es siempre `{ asientos: seleccion }` completo, en el orden de la
selección y sin repetidos.

## Estado de la confirmación del cambio (`EstadoCambio`)

Extiende el `EstadoConfirmacion` de la 003 (los estados de conflicto, `sinCupo`, `invalido`,
`funcionCerrada` y `errorGenerico` se comparten):

```text
inactivo ──guardar──▶ enviando
enviando ──200──▶ (actualizarCarrito, navega a /carritos/{id})
enviando ──asientos-no-disponibles / asientos-inexistentes──▶ conflicto (refresco + marcarPropias)
enviando ──funcion-no-encontrada / funcion-no-disponible──▶ funcionCerrada (terminal)
enviando ──funcion-sin-cupo──▶ sinCupo
enviando ──pedido-invalido──▶ invalido
enviando ──carrito-no-activo──▶ (cerrarSesion, navega a /carritos/{id} en lectura)
enviando ──401 / carrito-no-encontrado──▶ (descartarSesion, muestra la vista perdido en el lugar)
enviando ──otro / red──▶ errorGenerico (con cinta si es red)
cualquiera ──contador en 0──▶ (cerrarSesion, navega a /carritos/{id}: vencido)
```

Después de `cerrarSesion`, `/carritos/{id}` encuentra la sesión sin token y muestra el modo
lectura. Después de `descartarSesion` ya no hay nada que leer, así que la isla de cambio muestra
la vista `perdido` en el lugar, con el mismo componente que el carrito, en lugar de navegar.

## Email de entrega

| Campo | Regla |
|---|---|
| Texto | Se recorta antes de validar y enviar. Entre 1 y 254 caracteres y `^[^\s@]+@[^\s@]+\.[^\s@]+$` (`validarEmail`). Experiencia, no autoridad. |
| Cuerpo del `PUT` | `{ email }` recortado. |
| Mensajes | Error local de formato, o `errors.email` (sin distinguir mayúsculas) de `pedido-invalido`. Otros campos de `errors` → aviso general. |

## Problema de la API (`Problema`), cambios

| Campo | Cambio |
|---|---|
| `estadoActual` | Nuevo, opcional. Solo en `carrito-no-activo`: `Abandonado`, `Expirado` u otro texto (se trata como no modificable). |
| `401` | Sigue como `tipo: "desconocido"` con `status: 401`. `credencialPerdida(problema)` lo decide junto con `carrito-no-encontrado`. |

## Resultado del transporte del navegador (`Resultado<T>`), cambios

| Campo | Cambio |
|---|---|
| `horaServidorMs` | Nuevo: `Date.parse` del header `Date`, o `null`. En éxitos y en errores con respuesta. |
| `recibidoEnMs` | Nuevo: `Date.now()` al recibir la respuesta. |
