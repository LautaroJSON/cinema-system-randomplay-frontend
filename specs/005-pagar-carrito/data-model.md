# Data Model: Pagar el carrito

Tipos del frontend derivados de `src/api/schema.d.ts` (generado). Los nombres de la API se
mantienen; `mapearCarrito` normaliza `null`/`undefined` y los números de asiento.

## Carrito (amplía la 004)

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id`, `venceEn`, `abandonadoEn`, `asientos`, `funcion`, `precioUnitario`, `total`, `emailEntrega` | sin cambios | `CarritoResponse` | |
| `estado` | `string` | `CarritoResponse.estado` | `Activo`, `Pagando`, `Pagado`, `Expirado`, `Abandonado`; cualquier otro es "desconocido". |
| `pago` | `Pago \| null` | `CarritoResponse.pago` | `null` hasta iniciar el pago. |
| `entradas` | `Entrada[]` | `CarritoResponse.entradas` | Vacío salvo en `Pagado`. |

### Pago

| Campo | Tipo | Notas |
|---|---|---|
| `urlPago` | `string` | Absoluta `https://…` (real) o `/api/dev/pagos-simulados/{pref}` (simulada). Se valida con `destinoPago` antes de seguirla. |
| `iniciadoEn` | `string` (ISO 8601) | |
| `pagadoEn` | `string \| null` | |

### Entrada

| Campo | Tipo | Notas |
|---|---|---|
| `codigo` | `string` | Formato `XXXXX-XXXXX`; se muestra tal cual, destacado. |
| `pelicula`, `sucursal`, `sala` | `string` | Copiados al pagar. |
| `horaInicio` | `string` (ISO 8601) | `formatearFecha` + `formatearHora`. |
| `asiento` | `{ fila: string; numero: number }` | `numero` normalizado con `Number`, como en `asientos`. |
| `precioUnitario` | `Dinero` | `monto` como texto (Principio V). |

### PagoIniciado

`{ urlPago: string; carrito: Carrito }`, de `PagoIniciadoResponse`.

### PagoSimulado (escrito a mano, research P2)

- Pedido: `{ carritoId: string; estado: "Aprobado" | "Rechazado"; monto?: number }`.
- Respuesta 200: `{ pagoId: string; estadoCarrito: string }`. `404` si el carrito no existe o el
  endpoint no está habilitado.

## Estados del carrito y transiciones vistas desde el front

```text
           Pagar (200)                 pago aprobado (GET)
 Activo ───────────────▶ Pagando ─────────────────────────▶ Pagado   (final, sin contador)
   │                        │
   │ vence / abandono       │ vence sin pago aprobado (lo decide la API)
   ▼                        ▼
 Expirado / Abandonado    Expirado
```

| Estado | Etiqueta | Token en la pestaña | Acciones |
|---|---|---|---|
| `Activo` | "Activo" | sí | cambiar butacas, email, abandonar, Pagar |
| `Pagando` | "Pago en curso" | sí | Volver a la página de pago |
| `Pagado` | "Pagado" | **no** (se guarda el carrito con entradas) | ninguna |
| `Expirado` | "Vencido" | no | empezar de nuevo |
| `Abandonado` | "Abandonado" | no | empezar de nuevo |
| otro | "Estado desconocido" | no | empezar de nuevo |

Reglas:
- Solo `Activo` es modificable (`esModificable`).
- El contador se muestra en `Activo` y `Pagando`. En `Activo`, al llegar a cero, se cierra la
  sesión (004). En `Pagando`, al llegar a cero, se consulta la API (research P7).
- `Pagado` se muestra como compra cerrada aunque `venceEn` haya pasado.

## Sesión de la pestaña (`randomplay:carrito`, versión 2)

Sin cambios de forma: `{ version: 2, carritoId, token, tokenVenceEn, carrito, desfaseMs }`. Cambia
el contenido de `carrito` (suma `pago` y `entradas`) y cuándo se cierra (research P5). Una sesión
guardada antes de esta feature, sin `pago` ni `entradas`, se normaliza a `null` y `[]` al leerla.

## Vistas (`vistaPantalla`)

| Vista | Condición (en orden) |
|---|---|
| `sinLeer` | todavía no se leyó la pestaña |
| `perdido` | `401` o `carrito-no-encontrado` en esta visita |
| `sinSesion` | la sesión no es de este `carritoId` |
| `pagado` | `carrito.estado === "Pagado"` |
| `pagando` | `carrito.estado === "Pagando"` y hay token |
| `activo` | hay token y `esModificable` |
| `lectura` | el resto (abandonado, vencido, no activo) |

## Espera de la página de vuelta

| Fase | Se entra cuando | Muestra |
|---|---|---|
| `esperando` | Pagando y la espera tiene menos de 2 min | "Estamos confirmando tu pago…", "Volver a la página de pago" |
| `sinConfirmar` | Pagando y la espera llegó a 2 min | "Todavía no se confirmó…", "Revisar de nuevo", "Volver a la página de pago" |
| `listo` | Pagado | "¡Listo!", entradas, aviso de email |
| `vencido` | Expirado | texto de FR-020, "Elegir otra función" |
| `cerrado` | Abandonado u otro estado | modo lectura, "Elegir otra función" |
| `perdido` / `sinSesion` | como en la 004 | aviso de FR-022 |

## Valores de experiencia (`src/config/experiencia.ts`)

| Nombre | Valor | Uso |
|---|---|---|
| `INTERVALO_CONSULTA_PAGO_MS` | `2000` | Entre consultas de la página de vuelta (contrato del backend). |
| `ESPERA_PAGO_MAXIMA_MS` | `120000` | Tope de consultas automáticas. |
