# Data Model: Base del frontend y cartelera pública

El frontend no persiste datos: todo viene de la API. Este documento define los **modelos de
vista** que reciben los componentes y cómo se mapean desde los tipos generados
(`src/api/schema.d.ts`). El mapeo vive en `src/api/` (Principio VIII: los componentes no hacen
transporte ni normalización).

## Origen → modelo de vista

| Esquema de la API | Modelo de vista | Endpoint |
|---|---|---|
| `PeliculaListItemResponse` | `PeliculaResumen` | `GET /api/catalogo/peliculas` |
| `PeliculaDetalleResponse` | `PeliculaDetalle` | `GET /api/catalogo/peliculas/{id}` |
| `SucursalConFuncionesHoyResponse` | `Sucursal` | `GET /api/funciones/peliculas/{peliculaId}/sucursales-hoy` |
| `HorarioFuncionResponse` | `Horario` | `GET /api/funciones/peliculas/{peliculaId}/sucursales/{sucursalId}/horarios-hoy` |

## Entidades

### PeliculaResumen

| Campo | Tipo | Origen | Regla |
|---|---|---|---|
| `id` | string (GUID) | `id` | Identificador estable; forma la URL `/peliculas/{id}`. |
| `titulo` | string | `titulo` | Se muestra tal cual; puede ser largo (cortar en líneas, nunca desbordar). |
| `duracionMinutos` | number \| null | `duracionMinutos` (`integer \| string`) | Se normaliza a entero; `null` si no es entero positivo y la vista omite la duración. |
| `clasificacion` | `Clasificacion` | `clasificacion` | Ver abajo. |
| `tieneFuncionesHoy` | boolean | `!sinFuncionesDisponibles` | Se invierte para leer en positivo. |
| `codigoCinta` | string | derivado | `RP-` + 4 caracteres del id en mayúsculas, solo decorativo (carátula). No se usa como identificador. |

### PeliculaDetalle

`PeliculaResumen` + :

| Campo | Tipo | Origen | Regla |
|---|---|---|---|
| `sinopsis` | string \| null | `sinopsis` | Cadena vacía o solo espacios → `null` (la vista omite el bloque). |

### Clasificacion

| Valor API | Etiqueta | Nombre accesible |
|---|---|---|
| `ATP` | ATP | Apta para todo público |
| `Mas13` | +13 | Solo mayores de 13 años |
| `Mas16` | +16 | Solo mayores de 16 años |
| `Mas18` | +18 | Solo mayores de 18 años |
| otro | el valor recibido | "Clasificación: {valor}" |

Modelo: `{ codigo: string; etiqueta: string; descripcion: string; conocida: boolean }`. Se
traduce en un único lugar (`src/domain/clasificacion.ts`). Para JSON-LD `contentRating` se usa
la etiqueta.

### Sucursal

| Campo | Tipo | Origen |
|---|---|---|
| `id` | string (GUID) | `id` |
| `nombre` | string | `nombre` |

### Horario

| Campo | Tipo | Origen | Regla |
|---|---|---|---|
| `funcionId` | string (GUID) | `funcionId` | Forma el enlace a `/funciones/{funcionId}`. |
| `horaInicio` | string (ISO 8601 con offset) | `horaInicio` | Se conserva el original para JSON-LD y `<time dateTime>`; se formatea a `HH:mm` en zona de Argentina para mostrar. |
| `salaNombre` | string | `salaNombre` | |
| `precio` | `{ monto: string; moneda: string }` | `precioEntrada` | `monto` sigue siendo texto; se formatea sin pasar por `number`. |

### HorariosPorSucursal (agregado de la ficha)

```text
{ sucursal: Sucursal; horarios: Horario[] }[]
```

Reglas de armado (`src/domain/horarios.ts`):

1. Se piden las sucursales de hoy y luego, en paralelo, los horarios de cada una.
2. Los horarios se ordenan por `horaInicio` ascendente (comparando instantes, no texto).
3. Una sucursal sin horarios se **omite** (edge case: todas sus funciones ya comenzaron).
4. Sucursales en el orden que devuelve la API.
5. Resultado vacío → estado "Hoy no hay funciones".
6. Si falla cualquier pedido de horarios → el bloque entero queda en estado de error recuperable
   (no se muestra una lista parcial que parezca completa).

Estado del bloque de horarios: `{ tipo: 'ok', grupos } | { tipo: 'vacio' } | { tipo: 'error' }`.

### Vigencia en el navegador (FR-034)

`filtrarVigentes(grupos, ahora)` (función pura en `src/domain/horarios.ts`, usada por la isla
`HorariosVigentes`): quita los horarios con `horaInicio <= ahora` y las sucursales que quedan
vacías. Estados de la isla:

```text
vigentes ── (todos pasaron, servidor envió ≥ 1) ──▶ actualizando ── router.refresh() ──▶ vigentes
                                                                    └─ (sigue sin vigentes) ──▶ sin-funciones
```

El refresh se intenta una sola vez por carga de página.

### Película destacada (catálogo)

`elegirDestacada(peliculas)`: la primera con `tieneFuncionesHoy`; si ninguna tiene, no hay
destacada y el estante es solo grilla. El resto mantiene el orden de la API.

## Resultado del cliente de API

| Respuesta | Resultado |
|---|---|
| 200 | datos mapeados |
| 404 (detalle, sucursales-hoy, horarios-hoy) | `null` → la página decide (`notFound()` en el detalle; en horarios, se trata como sin funciones para esa sucursal) |
| otro status, `problem+json` inválido o error de red | lanza `ApiError { status?: number; codigo?: string }` |

Las consultas públicas no traen `codigo` (`docs/api.md`): se decide por `status` (Principio II).

## Validaciones de entrada

- `params.id` de `/peliculas/[id]`: debe cumplir el patrón de GUID; si no, `notFound()` sin
  llamar a la API.
