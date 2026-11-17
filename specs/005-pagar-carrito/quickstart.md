# Quickstart: Pagar el carrito

Guía para validar la feature a mano y con los tests. Detalle de rutas y textos en
[contracts/](contracts/); estados en [data-model.md](data-model.md).

## Requisitos

- Backend `cinema-system-randomplay-backend` en master (feature 008), en el directorio hermano.
- Node 24 y dependencias instaladas (`npm ci`).

## 1. Contrato al día

```bash
cp ../cinema-system-randomplay-backend/docs/openapi.json docs/openapi.json
```

```bash
npm run gen:api
```

```bash
npm run typecheck
```

`typecheck` debe pasar (tras implementar, `mapearCarrito` mapea `pago` y `entradas`).

## 2. Prueba manual contra el backend real (pasarela simulada)

Backend (en su repo):

```bash
docker compose up -d --build
```

API en `http://localhost:8080`, Mailpit en `http://localhost:8025`. El compose ya define
`MercadoPago__Modo: Simulado`.

Front, con `.env.local` así: `API_URL=http://localhost:8080`, `SITE_URL=http://localhost:3000`,
`API_MOCK=0`:

```bash
npm run dev
```

`next dev` habilita la página de pago simulado sin más configuración (research P3).

| # | Pasos | Resultado esperado |
|---|---|---|
| 1 | Cartelera → película → sucursal → horario → butacas → "Confirmar" → guardar email → "Pagar". | El estado pasa a "Pago en curso", el contador suma un minuto y se abre `/carritos/{id}/pago-simulado`. |
| 2 | "Aprobar pago". | `/carritos/{id}/pago` muestra "Estamos confirmando tu pago…" y en segundos "¡Listo!" con una entrada por butaca. En Mailpit aparece el email con las entradas. |
| 3 | Recargar `/carritos/{id}`. | "Tu compra", con las entradas y sin contador. |
| 4 | Otro carrito → Pagar → "Rechazar pago". | Página de vuelta en "confirmando"; "Volver a la página de pago" vuelve a la página simulada con la misma dirección. |
| 5 | Otro carrito → Pagar → cambiar el monto → "Pagar otro monto". | Sigue en Pagando. El backend devuelve ese pago (ver su log). |
| 6 | Con un carrito en Pagando, abrir `/carritos/{id}`. | "Pago en curso", "Cambiar butacas" y "Abandonar" deshabilitados con el motivo, email sin "Cambiar email". |
| 7 | Con un carrito en Pagando, abrir `/carritos/{id}/butacas`. | "No podés cambiar las butacas" y enlace al carrito. |
| 8 | Dejar un carrito en Pagando hasta que el contador llegue a cero. | Se pasa a `/carritos/{id}/pago` y termina en "Se terminó el tiempo para pagar". |
| 9 | En la página de vuelta en Pagando, esperar 2 minutos. | Se detienen las consultas (pestaña Red) y aparece "Todavía no se confirmó tu pago". |
| 10 | Revisar URLs, historial y consola durante todo el recorrido. | El token no aparece en ninguna parte. |

Con la pasarela real (`MercadoPago__Modo=Real`), el backend necesita además
`MercadoPago__UrlRetorno=http://localhost:3000/carritos/{carritoId}/pago`.

## 3. Producción: la página simulada no existe

```bash
npm run build
```

```bash
npm start
```

`/carritos/cualquier-id/pago-simulado` responde 404. Con `PAGO_SIMULADO=1 npm start` responde 200
(así corren los e2e).

## 4. Tests automáticos

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run test:e2e:api-real
```

Los e2e del mock usan `scripts/mock-api.mjs` (pago y pago simulado en memoria). Los de la API real
necesitan el backend levantado; el recorrido de pago crea un carrito más (respetar el límite de
10 por IP cada 10 minutos).

## 5. Puertas de calidad

```bash
npm run lint
```

```bash
npm run build
```
