# API consumida

Las formas exactas están en `docs/openapi.json`. Acá se documenta quién llama a cada endpoint,
desde dónde y qué hace el frontend con cada respuesta.

| Endpoint | Desde | Transporte | Caché | Auth |
|---|---|---|---|---|
| `GET /api/funciones/{funcionId}/asientos` | Servidor (carga de la página) | `pedirSinCache` → `{API_URL}` | `no-store` | — |
| `GET /api/funciones/{funcionId}/asientos` | Navegador (refresco tras un conflicto) | `navegador.ts` → `/api/...` (proxy del mismo origen) | `no-store` | — |
| `POST /api/funciones/{funcionId}/carritos` | Navegador | `navegador.ts` | `no-store` | — |
| `POST /api/carritos/{carritoId}/abandono` | Navegador (carrito anterior, FR-032) | `navegador.ts`, timeout de 3 s | `no-store` | `Authorization: Bearer {token}` |

Ningún otro endpoint con token se usa en esta spec.

## `GET /api/funciones/{funcionId}/asientos`

| Respuesta | En el servidor | En el navegador (refresco) |
|---|---|---|
| 200 | Se mapea a `MapaFuncion` (data-model.md) y se renderiza. | `reemplazarMapa`. |
| 404 (sin `codigo`) | `notFound()` | Pasa a `funcionCerrada`. |
| 410 (sin `codigo`) | Estado "Esta función ya empezó". | Pasa a `funcionCerrada`. |
| Otro status, red o timeout (5 s en el servidor, 8 s en el navegador) | `error.tsx` | Mantiene el mapa, muestra el aviso de refresco fallido y el botón "Actualizar mapa". |

## `POST /api/funciones/{funcionId}/carritos`

Request:

```json
{ "asientos": [{ "fila": "F", "numero": 7 }, { "fila": "F", "numero": 8 }], "desafio": null }
```

- `asientos` es la selección completa, en el orden en que se eligió, sin repetidos.
- `desafio` siempre va en `null`: el anti-bots queda fuera de alcance.

| Respuesta | `codigo` | Manejo (research B11) |
|---|---|---|
| 201 | — | Guardar la sesión y navegar a `/carritos/{carrito.id}`. |
| 400 | `pedido-invalido` | `errors` junto a la selección. |
| 403 | `desafio-rechazado` | Error genérico (fuera de alcance). |
| 404 | `funcion-no-encontrada` | `funcionCerrada`. |
| 409 | `asientos-no-disponibles` | Marcar `asientos` como ocupadas, refrescar y avisar con la lista. |
| 409 | `funcion-sin-cupo` | Pedir que se intente más tarde. |
| 410 | `funcion-no-disponible` | `funcionCerrada`. |
| 422 | `asientos-inexistentes` | Refrescar y avisar. |
| 429 | `demasiados-pedidos` | Esperar `Retry-After`: segundos o fecha HTTP, 60 si falta, con tope de 600. |
| Otro / sin `codigo` / red / timeout | — | Error genérico recuperable. |

## `POST /api/carritos/{carritoId}/abandono`

Solo se usa para el carrito anterior guardado en la pestaña antes de crear uno nuevo. Cualquier
respuesta (200, 401, 404, 409, red, timeout) se ignora. Después se descarta la sesión anterior
y se sigue con la creación.

## Discrepancia con el contrato (para reportar al backend)

`ProblemDetails` en `openapi.json` describe `errors`, `asientos` y `estadoActual` en su
`description`, pero no los declara como propiedades. El frontend los valida a mano
(research B3).
