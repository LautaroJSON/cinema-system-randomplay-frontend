# API consumida: pago del carrito

Fuente: `specs/008-pago-mercado-pago/contracts/pagos-api.md` del backend y su `docs/openapi.json`.
Todo pasa por `src/api/` (Principio I) y por el proxy del mismo origen `/api/:path*`
(`next.config.ts`), que ya cubre `/api/dev/...`.

| Operación | Endpoint | Credencial | Función en `src/api/` | Respuesta usada |
|---|---|---|---|---|
| Iniciar pago / volver a la página de pago | `POST /api/carritos/{carritoId}/pago` (sin body) | `Authorization: Bearer {token}` | `iniciarPago(carritoId, token)` en `carritos.ts` | `PagoIniciadoResponse` → `{ urlPago, carrito }` |
| Consultar carrito | `GET /api/carritos/{carritoId}` | Bearer | `obtenerCarrito` (sin cambios de firma) | `CarritoResponse` con `pago` y `entradas` |
| Cambiar butacas, email, abandonar | sin cambios | Bearer | sin cambios | `409 carrito-en-pago` nuevo |
| Registrar pago simulado (solo desarrollo) | `POST /api/dev/pagos-simulados` | **ninguna** (público) | `registrarPagoSimulado(pedido)` en `pagos-simulados.ts` | `{ pagoId, estadoCarrito }` |

El token nunca se envía a `/api/dev/pagos-simulados`, a `urlPago` ni a ninguna dirección fuera de
las rutas de su carrito (Principio III).

## Errores nuevos y su manejo

| Status | `codigo` | Operación | Qué hace el front |
|---|---|---|---|
| 409 | `email-entrega-faltante` | pagar | Mensaje junto a "Pagar" y foco en el campo del email. |
| 409 | `carrito-no-activo` (`estadoActual`) | pagar | `GET` del carrito y vista según el estado (Pagado → compra cerrada; Expirado/Abandonado → lectura). Si el `GET` falla, lectura con `estadoActual`. |
| 409 | `carrito-modificado` | pagar | `GET` del carrito y aviso "Tu reserva cambió. Revisala y tocá Pagar de nuevo." |
| 503 | `pago-no-disponible` | pagar | "No pudimos iniciar el pago, probá de nuevo." con reintento; el carrito sigue activo. |
| 409 | `carrito-en-pago` | cambiar, email, abandonar | Aviso "Pago en curso", `GET` del carrito, vista `pagando`. Credencial conservada. |
| 401 | — | todas | Descartar la sesión, vista `perdido`. |
| 404 | `carrito-no-encontrado` | todas | Ídem. |
| — | red / desconocido | todas | Error genérico recuperable con "Reintentar". |
| 404 | — | pago simulado | "No encontramos ese carrito en la pasarela simulada" + reintentar. |

## Pedido de pago simulado

```json
{ "carritoId": "6f1c…", "estado": "Aprobado" }
{ "carritoId": "6f1c…", "estado": "Rechazado" }
{ "carritoId": "6f1c…", "estado": "Aprobado", "monto": 4500.5 }
```

"Pagar otro monto" envía `estado: "Aprobado"` con el monto del campo: el backend lo trata como
pago por un importe distinto del total y lo devuelve solo; el carrito sigue en `Pagando`.

## Para reportar al backend

- `docs/api.md` no documenta `email-entrega-faltante`, `carrito-en-pago`, `carrito-modificado` ni
  `pago-no-disponible`, ni el estado Pagando/Pagado.
- `MercadoPago:UrlRetorno` por defecto apunta a `:5173`; el front corre en `:3000`.
