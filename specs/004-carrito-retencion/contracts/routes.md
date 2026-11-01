# Contrato de rutas: carrito

Esta spec reemplaza el contenido de `/carritos/{carritoId}` que dejó la 003 y agrega
`/carritos/{carritoId}/butacas`. Al implementar, se actualizan también las filas del carrito en
[specs/003-mapa-butacas/contracts/routes.md](../../003-mapa-butacas/contracts/routes.md).

| Ruta | Status | Frescura | Indexable | En sitemap | `h1` |
|---|---|---|---|---|---|
| `/carritos/{carritoId}` con carrito activo en la pestaña | 200 | dinámica (el contenido sale del navegador) | **no** (`noindex, nofollow`) | no | "Tu carrito" |
| `/carritos/{carritoId}` con carrito abandonado | 200 | dinámica | no | no | "Abandonaste el carrito" |
| `/carritos/{carritoId}` con carrito vencido (por la API o por el contador) | 200 | dinámica | no | no | "Se terminó el tiempo" |
| `/carritos/{carritoId}` con `401` o `carrito-no-encontrado` | 200 | dinámica | no | no | "No pudimos recuperar tu carrito" |
| `/carritos/{carritoId}` sin sesión de ese id | 200 | dinámica | no | no | "No hay un carrito activo en esta pestaña" (como en la 003) |
| `/carritos/{carritoId}/butacas` con carrito activo | 200 | dinámica | no | no | "Cambiá tus butacas" |
| `/carritos/{carritoId}/butacas` sin sesión o con carrito cerrado | 200 | dinámica | no | no | el de la vista equivalente del carrito |

Todas responden 200 porque el servidor no tiene forma de saber el estado: la credencial está en
la pestaña. El estado se decide en el navegador.

`robots.txt` no cambia: ya tiene `Disallow: /carritos/`, que cubre las dos rutas.
`sitemap.xml` no cambia.

## Metadata

| Ruta | `title` | `description` | Canónica | Open Graph | `robots` |
|---|---|---|---|---|---|
| `/carritos/{id}` | "Tu carrito" → "Tu carrito · RandomPlay" | — | — | — | `{ index: false, follow: false }` |
| `/carritos/{id}/butacas` | "Cambiar butacas" | — | — | — | ídem |

El título del documento no incluye el estado ni datos del carrito: el servidor no los conoce.

## Caché

Las dos rutas son `force-dynamic`, así que Next responde con
`Cache-Control: private, no-cache, no-store…`. Los pedidos del navegador a la API van con
`cache: "no-store"`.

## Estructura semántica

`/carritos/{id}` en la vista `activo`, en este orden (una columna):

1. `h1` "Tu carrito" (`tabIndex={-1}` para recibir el foco al cambiar de vista).
2. Contador (`role="timer"`) con su rótulo "Tus butacas están reservadas por" y la región de
   cortesía de avisos de tiempo.
3. Resumen: `<dl>` con película, sucursal, sala, fecha y hora (`<time dateTime>`), butacas
   (lista), precio por entrada, total y estado.
4. Enlace "Cambiar butacas" a `/carritos/{id}/butacas`.
5. `<section aria-labelledby>` con `h2` "Email de entrega": formulario o bloque "Qué sigue".
6. `<section aria-labelledby>` con `h2` "¿No vas a seguir?" y el botón "Abandonar carrito"
   con su confirmación.

En `lectura` quedan el `h1` del estado, el aviso (con cinta si está vencido), el resumen con el
estado y el enlace "Elegir otra función". No hay contador, formulario ni botones de cambio.

`/carritos/{id}/butacas`: enlace "Volver al carrito", `h1` "Cambiá tus butacas", contador,
cabecera de la función, y el mapa y el panel "Tu selección" de la 003 con el botón "Guardar N
butacas".

Navegación: "Cambiar butacas", "Volver al carrito", "Elegir otra función" y "Ver la cartelera"
son enlaces (`next/link`). Solo "Guardar N butacas" navega desde un botón, porque primero tiene
que guardar el cambio.

## Credencial

- Las URLs llevan solo el `carritoId`. El token nunca aparece en la ruta, la query, el hash, la
  metadata, `history.state` ni el HTML que genera el servidor.
- Ninguna de las dos páginas recibe datos del carrito desde el servidor.
- Cerrar, recargar o salir de la página no dispara ningún pedido (FR-033).
