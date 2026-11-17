# Contrato de rutas: pago

Suma dos rutas al flujo privado del carrito. Al implementar se agregan también a
[specs/004-carrito-retencion/contracts/routes.md](../../004-carrito-retencion/contracts/routes.md).

| Ruta | Status | Frescura | Indexable | En sitemap | `h1` |
|---|---|---|---|---|---|
| `/carritos/{carritoId}` con carrito Pagando | 200 | dinámica | no | no | "Tu carrito" (estado "Pago en curso") |
| `/carritos/{carritoId}` con carrito Pagado | 200 | dinámica | no | no | "Tu compra" |
| `/carritos/{carritoId}/pago` esperando | 200 | dinámica | no | no | "Estamos confirmando tu pago…" |
| `/carritos/{carritoId}/pago` sin confirmar tras el tope | 200 | dinámica | no | no | "Todavía no se confirmó tu pago" |
| `/carritos/{carritoId}/pago` Pagado | 200 | dinámica | no | no | "¡Listo!" |
| `/carritos/{carritoId}/pago` Expirado | 200 | dinámica | no | no | "Se terminó el tiempo para pagar" |
| `/carritos/{carritoId}/pago` sin sesión | 200 | dinámica | no | no | "No encontramos tu pago en esta pestaña" |
| `/carritos/{carritoId}/pago-simulado` con pago simulado habilitado | 200 | dinámica | no | no | "Pago simulado" |
| `/carritos/{carritoId}/pago-simulado` sin habilitar (producción) | **404** (`notFound()`) | — | no | no | el de `not-found.tsx` |

Todas salvo la 404 responden 200: el servidor no conoce el estado del carrito (la credencial está
en la pestaña). `robots.txt` ya tiene `Disallow: /carritos/`; `sitemap.xml` no cambia.

## Metadata

| Ruta | `title` | `robots` |
|---|---|---|
| `/carritos/{id}/pago` | "Tu pago" | `{ index: false, follow: false }` |
| `/carritos/{id}/pago-simulado` | "Pago simulado" | ídem |

Ninguna lleva canónica ni Open Graph. Las dos son `force-dynamic`.

## Navegación

| Desde | Acción | Hacia |
|---|---|---|
| `/carritos/{id}` (Activo) | Pagar → `urlPago` real | Mercado Pago (misma pestaña) |
| `/carritos/{id}` (Activo) | Pagar → `urlPago` simulada | `/carritos/{id}/pago-simulado` |
| `/carritos/{id}` (Pagando) | Volver a la página de pago | ídem según `urlPago` |
| `/carritos/{id}` o `/butacas` (Pagando) | contador en cero | `/carritos/{id}/pago` |
| Mercado Pago | vuelta (`MercadoPago:UrlRetorno`) | `/carritos/{id}/pago` |
| `/carritos/{id}/pago-simulado` | Aprobar / Rechazar / Otro monto (200) | `/carritos/{id}/pago` |
| `/carritos/{id}/pago` (Pagando) | Volver a la página de pago | según `urlPago` |
| `/carritos/{id}/pago` (Expirado, Abandonado) | Elegir otra función | `/peliculas/{peliculaId}#titulo-horarios` |
| `/carritos/{id}/pago` (sin sesión) | Ver la cartelera | `/` |

Ninguna de estas direcciones lleva el token ni datos del comprador.
