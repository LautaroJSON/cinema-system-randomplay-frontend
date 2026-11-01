# Contrato de rutas: flujo privado

Esta spec completa la fila `/funciones/{funcionId}` de
[specs/001-cartelera-publica/contracts/routes.md](../../001-cartelera-publica/contracts/routes.md)
y agrega `/carritos/{carritoId}`. Al implementar, se actualiza también esa fila en el contrato
de la 001.

| Ruta | Status | Frescura | Indexable | En sitemap | `h1` |
|---|---|---|---|---|---|
| `/funciones/{funcionId}` (función vigente) | 200 | dinámica, sin caché (`private, no-store`) | **no** (`noindex, nofollow`) | no | "Elegí tus butacas" |
| `/funciones/{funcionId}` ya comenzada (mapa 410) | 200 (B12) | dinámica | no | no | "Esta función ya empezó" |
| `/funciones/{funcionId}` inexistente o id no GUID | 404 | — | no | no | el de la 404 de la marca |
| `/carritos/{carritoId}` con sesión de ese id en la pestaña | 200 | dinámica (el contenido sale del navegador) | no | no | "Tu carrito quedó creado" |
| `/carritos/{carritoId}` sin sesión de ese id | 200 | dinámica | no | no | "No hay un carrito activo en esta pestaña" |

`robots.txt` no cambia: ya tiene `Disallow: /funciones/` y `Disallow: /carritos/`.
`sitemap.xml` no cambia.

## Metadata

| Ruta | `title` | `description` | Canónica | Open Graph | `robots` |
|---|---|---|---|---|---|
| `/funciones/{id}` | "Butacas · {peliculaTitulo}" → "Butacas · {peliculaTitulo} · RandomPlay" | — | — | — | `{ index: false, follow: false }` |
| `/funciones/{id}` comenzada | "Función comenzada" | — | — | — | ídem |
| `/carritos/{id}` | "Tu carrito" | — | — | — | ídem |

## Estructura semántica

- `/funciones/{id}`:
  - Un enlace "Volver a {peliculaTitulo}" (`next/link` a `/peliculas/{peliculaId}`).
  - `h1` "Elegí tus butacas".
  - Cabecera como lista de definiciones (`<dl>`) con película, sucursal, sala, fecha y hora
    (`<time dateTime>`) y precio por entrada.
  - `<section aria-labelledby>` con el `h2` "Sala" (visualmente oculto) y el mapa.
  - `<section>` con el `h2` "Tu selección": resumen, total, mensajes y botón primario.
- `/carritos/{id}`: `h1` y, cuando hay sesión, una lista de butacas y el total. Un enlace a la
  cartelera.
- Navegación: el único botón que navega es "Confirmar N butacas", porque primero crea el
  carrito y después navega con `router.push`. Todos los otros desplazamientos son enlaces.

## Credencial

- La URL lleva solo el `carritoId`. El token nunca aparece en la ruta, la query, el hash, la
  metadata ni el HTML que genera el servidor.
- `/carritos/{id}` no recibe datos del carrito desde el servidor: todo lo lee la isla de
  cliente desde `sessionStorage`.
