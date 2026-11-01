# Contrato de la API consumida

Endpoints del backend que usa esta funcionalidad. La forma exacta está en `docs/openapi.json`
(fuente de verdad, Principio I); acá se documenta solo cómo los usa el frontend.

| Endpoint | Función del cliente | `next.revalidate` | `next.tags` | 404 |
|---|---|---|---|---|
| `GET /api/catalogo/peliculas` | `listarPeliculas()` | 600 | `catalogo` | — |
| `GET /api/catalogo/peliculas/{id}` | `obtenerPelicula(id)` | 600 | `pelicula:{id}` | `null` → `notFound()` |
| `GET /api/funciones/peliculas/{peliculaId}/sucursales-hoy` | `listarSucursalesHoy(peliculaId)` | 60 | `horarios:{peliculaId}` | `null` → sin funciones hoy |
| `GET /api/funciones/peliculas/{peliculaId}/sucursales/{sucursalId}/horarios-hoy` | `listarHorariosHoy(peliculaId, sucursalId)` | 60 | `horarios:{peliculaId}` | `null` → sucursal omitida |

- No se usa el parámetro `titulo` del catálogo (búsqueda fuera de alcance).
- Todos los pedidos salen del servidor hacia `API_URL`; ninguno lleva autenticación.
- Cualquier otro status o error de red lanza `ApiError`; las consultas públicas no traen
  `codigo`, así que se decide por `status`.
- Timeout de 5 s por pedido (`AbortSignal.timeout`) para que un backend colgado no bloquee el
  render indefinidamente.

## Fixtures

`tests/fixtures/` guarda respuestas de ejemplo tipadas con el esquema generado y cubre:
catálogo con películas con y sin funciones hoy, una clasificación desconocida, un título largo,
una sinopsis vacía, dos sucursales con horarios desordenados y una sucursal sin horarios. Los
usan MSW (unitarios) y `scripts/mock-api.mjs` (build, e2e y validación manual).
