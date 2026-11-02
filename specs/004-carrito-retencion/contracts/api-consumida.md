# API consumida

Las formas exactas están en `docs/openapi.json`. Acá se documenta quién llama a cada endpoint,
desde dónde y qué hace el frontend con cada respuesta. El manejo detallado por `codigo` está en
[research.md C10](../research.md).

| Endpoint | Desde | Transporte | Caché | Auth |
|---|---|---|---|---|
| `GET /api/carritos/{carritoId}` | Navegador, al abrir el carrito | `navegador.ts` → `/api/...` (proxy del mismo origen) | `no-store` | `Authorization: Bearer {token}` |
| `PUT /api/carritos/{carritoId}/asientos` | Navegador, al guardar el cambio | `navegador.ts` | `no-store` | Bearer |
| `PUT /api/carritos/{carritoId}/email-entrega` | Navegador, al guardar el email | `navegador.ts` | `no-store` | Bearer |
| `POST /api/carritos/{carritoId}/abandono` | Navegador, al confirmar el abandono (y en la 003, antes de crear otro) | `navegador.ts` | `no-store` | Bearer |
| `GET /api/funciones/{funcionId}/asientos` | Navegador, al abrir el cambio y tras un conflicto | `navegador.ts` | `no-store` | — |

Timeout: 8 s en todas, salvo el abandono previo de la 003, que sigue en 3 s.

En todas, `{carritoId}` sale de la sesión guardada junto al token, no de la URL de la página
(FR-003). De cada respuesta se lee el header `Date` para medir el desfase del reloj (research
C3).

## `GET /api/carritos/{carritoId}`

| Respuesta | `codigo` | Manejo |
|---|---|---|
| 200 | — | `actualizarCarrito`. Si `estado` no es `Activo`, `cerrarSesion` y modo lectura. |
| 401 | — (sin cuerpo) | `descartarSesion`, vista `perdido`. |
| 404 | `carrito-no-encontrado` | `descartarSesion`, vista `perdido`. |
| Otro / sin `codigo` / red / timeout | — | Se sigue mostrando el último carrito guardado con un aviso y "Reintentar". Si fue red, cinta "Sin conexión". |

## `PUT /api/carritos/{carritoId}/asientos`

Request (siempre la selección completa, nunca diferencias):

```json
{ "asientos": [{ "fila": "F", "numero": 7 }, { "fila": "F", "numero": 9 }] }
```

| Respuesta | `codigo` | Manejo |
|---|---|---|
| 200 | — | `actualizarCarrito` y volver a `/carritos/{id}`. El `venceEn` nuevo reemplaza al anterior tal como llega. |
| 400 | `pedido-invalido` | `errors` junto a la selección. |
| 401 | — | `descartarSesion`, vista `perdido`. |
| 404 | `carrito-no-encontrado` | `descartarSesion`, vista `perdido`. |
| 404 | `funcion-no-encontrada` | `funcionCerrada`. |
| 409 | `asientos-no-disponibles` | Marcar `asientos` como ocupadas, refrescar el mapa, `marcarPropias` y avisar con la lista. |
| 409 | `funcion-sin-cupo` | Pedir que se intente más tarde. |
| 409 | `carrito-no-activo` | `cerrarSesion` y volver al carrito en modo lectura con aviso según `estadoActual`. |
| 410 | `funcion-no-disponible` | `funcionCerrada`. |
| 422 | `asientos-inexistentes` | Refrescar y avisar. |
| Otro / sin `codigo` / red / timeout | — | Error genérico con "Reintentar"; cinta si fue red. |

## `PUT /api/carritos/{carritoId}/email-entrega`

Request:

```json
{ "email": "nombre@ejemplo.com" }
```

| Respuesta | `codigo` | Manejo |
|---|---|---|
| 200 | — | `actualizarCarrito` y bloque "Qué sigue". |
| 400 | `pedido-invalido` | `errors.email` junto al campo; el resto como aviso general. El texto se conserva. |
| 401 | — | `descartarSesion`, vista `perdido`. |
| 404 | `carrito-no-encontrado` | `descartarSesion`, vista `perdido`. |
| 409 | `carrito-no-activo` | `cerrarSesion`, modo lectura con aviso. |
| Otro / sin `codigo` / red / timeout | — | Error genérico con "Reintentar"; el texto se conserva; cinta si fue red. |

## `POST /api/carritos/{carritoId}/abandono`

Sin cuerpo.

| Respuesta | `codigo` | Manejo |
|---|---|---|
| 200 | — | `cerrarSesion` con el carrito devuelto, modo lectura "Abandonado". |
| 401 | — | `descartarSesion`, vista `perdido`. |
| 404 | `carrito-no-encontrado` | `descartarSesion`, vista `perdido`. |
| 409 | `carrito-no-activo` | `cerrarSesion`, modo lectura con el `estadoActual`, sin aviso de error. |
| Otro / sin `codigo` / red / timeout | — | El carrito sigue activo, aviso con "Reintentar"; cinta si fue red. |

## Discrepancia con el contrato (ya reportada en la 003)

`ProblemDetails` no declara `errors`, `asientos` ni `estadoActual` como propiedades. El frontend
los valida a mano en `problema.ts`. `estadoActual` se suma a esa validación en esta spec.
