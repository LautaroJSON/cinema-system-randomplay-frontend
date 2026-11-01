# Data Model: Mapa de butacas y retención de asientos

Tipos del frontend que se derivan de los schemas generados (`src/api/schema.d.ts`). Los tipos de
la API no se escriben a mano. Estos son los tipos propios a los que se mapean en `src/api/`.

## Función con mapa (`MapaFuncion`)

Origen: `MapaAsientosResponse` (`GET /api/funciones/{funcionId}/asientos`).

| Campo | Tipo | Regla |
|---|---|---|
| `funcionId` | `string` (GUID) | — |
| `horaInicio` | `string` ISO 8601 con offset | Se muestra con `formatearFecha` y `formatearHora` en la zona de Argentina (Principio V). `formatearFecha` es nueva y va en `src/domain/formato.ts`. |
| `peliculaId`, `peliculaTitulo` | `string` | `peliculaId` arma el enlace a los horarios (`/peliculas/{id}#titulo-horarios`). |
| `sucursalNombre`, `salaNombre` | `string` | — |
| `precioEntrada` | `Dinero` (`{ monto: string, moneda: string }`) | `monto` siempre como texto. |
| `filas` | `Fila[]` | En el orden de la API. |
| `cantidadDisponibles` | `number` | Si es 0, la función está completa (edge case). Se normaliza con `normalizarEntero`, y si no se puede leer, se cuenta desde `filas`. |

## Fila (`Fila`)

| Campo | Tipo | Regla |
|---|---|---|
| `letra` | `string` | Una letra A–Z. Una fila con otra letra se descarta (y se registra solo su letra, nunca datos del carrito). |
| `butacas` | `Butaca[]` | Una por número, de 1 a `cantidadAsientos`. |

Una fila con `cantidadAsientos` que no se puede leer o que vale ≤ 0 se omite.

## Butaca (`Butaca`)

| Campo | Tipo | Regla |
|---|---|---|
| `fila` | `string` | — |
| `numero` | `number` ≥ 1 | — |
| `libre` | `boolean` | `true` si `numero` está en `asientosDisponibles` de la fila. Los números de `asientosDisponibles` fuera de rango se ignoran. |

Clave de identidad: `"{fila}{numero}"` (por ejemplo, `"F7"`). Es la misma forma que usan los
avisos.

### Estado visible de una butaca

Se deriva de `Butaca.libre` y de la selección. No se guarda.

```text
ocupada       ← !libre
seleccionada  ← libre && clave ∈ seleccion
libre         ← libre && clave ∉ seleccion
```

## Estado del selector (`EstadoSelector`)

Lo maneja `reducirSeleccion` en `src/domain/butacas.ts`.

| Campo | Tipo | Regla |
|---|---|---|
| `filas` | `Fila[]` | Se reemplaza al refrescar. |
| `seleccion` | `Asiento[]` (`{ fila, numero }`), en orden de elección | Sin repetidos. Solo butacas libres. Tamaño ≤ `maximoEfectivo`. |
| `maximoEfectivo` | derivado | `min(MAX_BUTACAS_POR_COMPRA, butacas libres)`. |

### Acciones

| Acción | Efecto |
|---|---|
| `alternar(asiento)` | Si está seleccionada, la quita. Si está libre y no se llegó al máximo, la agrega. Si se llegó al máximo, no cambia nada y devuelve `{ limiteAlcanzado: true }` para el aviso. Si está ocupada, no cambia nada. |
| `marcarOcupadas(asientos)` | Cada asiento existente pasa a `libre = false` y sale de la selección. Los que no existen se ignoran. |
| `reemplazarMapa(filas)` | Reemplaza `filas` y saca de la selección las que no existen o ya no están libres. Expone cuáles salieron. |
| `limpiar()` | Vacía la selección. |

## Estado de la confirmación (`EstadoConfirmacion`)

Unión discriminada en la isla `SelectorButacas`.

```text
inactivo ──confirmar──▶ enviando
enviando ──201──────────▶ (navega a /carritos/{id})
enviando ──sin almacenamiento──▶ sinAlmacenamiento
enviando ──asientos-no-disponibles / asientos-inexistentes──▶ conflicto { perdidas, refrescando, refrescoFallo }
enviando ──funcion-no-encontrada / funcion-no-disponible──▶ funcionCerrada        (terminal)
enviando ──funcion-sin-cupo──▶ sinCupo
enviando ──demasiados-pedidos──▶ esperando { restanteSegundos } ──0──▶ inactivo
enviando ──pedido-invalido──▶ invalido { mensajesSeleccion, mensajesGenerales }
enviando ──otro / red──▶ errorGenerico
{conflicto, sinCupo, invalido, errorGenerico, sinAlmacenamiento} ──cambiar selección o confirmar──▶ inactivo / enviando
```

`funcionCerrada` bloquea el mapa y el botón hasta recargar. `esperando` solo bloquea el botón:
el comprador puede seguir cambiando la selección.

## Problema de la API (`Problema`)

Lo arma `leerProblema` en `src/api/problema.ts`.

| Campo | Tipo | Regla |
|---|---|---|
| `tipo` | `CodigoCarrito \| "desconocido" \| "red"` | `CodigoCarrito` = `pedido-invalido`, `desafio-rechazado`, `funcion-no-encontrada`, `carrito-no-encontrado`, `asientos-no-disponibles`, `funcion-sin-cupo`, `carrito-no-activo`, `funcion-no-disponible`, `asientos-inexistentes`, `demasiados-pedidos`. Se decide solo por `codigo`. |
| `status` | `number \| undefined` | `undefined` en fallos de red o timeout. Las consultas sin `codigo` (mapa 404/410) se deciden por `status`. |
| `asientos` | `Asiento[]` | Solo los que tienen fila A–Z y número ≥ 1. |
| `errors` | `Record<string, string[]>` | Solo pares válidos. |
| `retryAfterSegundos` | `number` | Solo en `demasiados-pedidos`: entre 1 y 600, con 60 si no se puede leer (research B4). |

`title` y `detail` no se leen.

## Carrito creado (`CarritoCreado`)

Origen: `CarritoCreadoResponse` (`POST /api/funciones/{funcionId}/carritos`, 201).

| Campo | Tipo | Regla |
|---|---|---|
| `carrito.id` | `string` (GUID) | Va en la URL `/carritos/{id}`. No es credencial. |
| `carrito.estado` | `string` | Se espera `Activo`. Se guarda tal cual; la traducción a etiqueta queda para la 004. |
| `carrito.venceEn` | ISO 8601 | Se guarda para la 004. Esta spec no muestra la cuenta regresiva. |
| `carrito.asientos` | `Asiento[]` | Se muestran en la pantalla provisoria. |
| `carrito.funcion` | `{ funcionId, horaInicio, peliculaId, peliculaTitulo, sucursalNombre, salaNombre }` | — |
| `carrito.precioUnitario`, `carrito.total` | `Dinero` | Se muestra el `total` de la API, no uno recalculado. |
| `token` | `string` | **Credencial.** Solo en `sessionStorage`. Nunca en logs, URLs, errores ni props de Server Components. |
| `tokenVenceEn` | ISO 8601 | Se guarda para la 004. |

## Sesión del carrito en la pestaña (`SesionCarrito`)

Clave de `sessionStorage`: `randomplay:carrito`.

```json
{
  "version": 1,
  "carritoId": "…",
  "token": "…",
  "tokenVenceEn": "2026-11-01T22:30:00-03:00",
  "carrito": { "…": "CarritoCreado.carrito mapeado" }
}
```

| Regla | Origen |
|---|---|
| Hay una sola sesión por pestaña. Una confirmación nueva abandona la anterior (best effort) y la reemplaza. | FR-032 |
| `leerSesion()` devuelve `null` si la versión o la forma no coinciden, o si el almacenamiento no está disponible. | B9 |
| `/carritos/{id}` muestra la sesión solo si `carritoId === id`. | FR-033 |
| Se descarta al abandonar, y ante `401` o `carrito-no-encontrado` (lo último se aplica en la 004). | Principio III |
