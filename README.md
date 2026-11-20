# RandomPlay: frontend del comprador

Sitio de compra de entradas de cine en Next.js (App Router), React y TypeScript. Consume la API de
`cinema-system-randomplay-backend`. Las reglas del proyecto están en
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) y la dirección visual en
[`DESIGN.md`](DESIGN.md).

Hoy incluye las páginas públicas e indexables (la cartelera en `/` y la ficha de cada película con
sus horarios del día por sucursal en `/peliculas/{id}`) y el flujo privado de compra completo:

1. `/funciones/{funcionId}`: elección de butacas. Retiene los asientos en un carrito.
2. `/carritos/{carritoId}`: el carrito, con la cuenta regresiva, el email de entrega, el
   abandono y el botón de pago. Desde ahí se vuelve a `/carritos/{carritoId}/butacas` para
   cambiar de butacas.
3. Pago en Mercado Pago. El sitio nunca pide datos de tarjeta. El comprador vuelve a
   `/carritos/{carritoId}/pago`, que muestra el estado del pago y, si está aprobado, las
   entradas como tickets con talón.

`/carritos/{carritoId}/pago-simulado` reemplaza a la pasarela en desarrollo y en los e2e. En
cualquier otro entorno responde 404.

## Requisitos

- Node.js 24 LTS.
- El backend corriendo, o el mock de la API incluido en el repositorio.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
npm run mock:api
```

En otra terminal:

```bash
npm run dev
```

Para cambiar de backend, editá `BACKEND` en `.env.local` y reiniciá `npm run dev`:

- `mock`: el mock de `npm run mock:api`, en `http://127.0.0.1:4010`.
- `local`: tu backend en `http://localhost:8080`. Si usa otro puerto, definí `API_URL_LOCAL`.
- `hosteado`: el backend de Render. Si estuvo inactivo, tarda unos 30 segundos en despertar.

Al arrancar, la terminal muestra contra qué backend corre el sitio.
La guía de validación completa está en
[`specs/001-cartelera-publica/quickstart.md`](specs/001-cartelera-publica/quickstart.md).

## Scripts

| Script                        | Qué hace                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                 | Servidor de desarrollo                                                          |
| `npm run build` / `npm start` | Build de producción y servidor                                                  |
| `npm run gen:api`             | Regenera `src/api/schema.d.ts` desde `docs/openapi.json` (no se edita a mano)   |
| `npm run typecheck`           | TypeScript en modo `strict`                                                     |
| `npm run lint`                | ESLint con reglas de Next.js y `jsx-a11y`                                       |
| `npm test`                    | Tests unitarios y de componentes (Vitest + MSW)                                 |
| `npm run test:e2e`            | Playwright: levanta el mock, hace el build y prueba con y sin JavaScript        |
| `npm run mock:api`            | Mock de la API en `http://127.0.0.1:4010` con los fixtures de `tests/fixtures/` |
| `npm run test:e2e:api-real`   | Playwright contra el backend real en `API_REAL_URL` (por defecto el 8080)       |

`test:e2e:api-real` no corre en CI: necesita el backend levantado con los datos sembrados, usa el
puerto 3100 y crea 7 de los 10 carritos que la API permite por IP cada 10 minutos.

## Variables de entorno

| Variable              | Uso                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND`             | Backend que usa el sitio: `local`, `hosteado` o `mock`. Lo usan los pedidos del servidor y el proxy `/api`. Obligatoria si no hay `API_URL`.                           |
| `API_URL_LOCAL`       | Opcional. Otra URL para `BACKEND=local`, si el backend no usa el 8080.                                                                                                 |
| `API_URL`             | Opcional. Una URL exacta del backend, que gana sobre `BACKEND`. La usan los despliegues y los e2e.                                                                     |
| `SITE_URL`            | Origen público del sitio, para canónicas, sitemap, robots y JSON-LD. Obligatoria.                                                                                      |
| `NEXT_PUBLIC_API_URL` | Opcional. Se fija al compilar. Con ella el navegador llama directo al backend, que tiene que aceptar el sitio por CORS. Sin ella usa el proxy `/api`. Solo producción. |
| `API_MOCK`            | Temporal (spec 002). Con `1` el sitio usa el catálogo local de `scripts/mock-data/catalogo.json` en vez del backend.                                                   |
| `PAGO_SIMULADO`       | Con `1` habilita la página de pago simulado fuera de `next dev`. La usan los e2e. Nunca en producción.                                                                 |

`BACKEND`, `API_URL_LOCAL`, `API_URL`, `SITE_URL`, `API_MOCK` y `PAGO_SIMULADO` no llevan el prefijo `NEXT_PUBLIC_`, así que no
llegan al navegador. `NEXT_PUBLIC_API_URL` sí llega: es la URL pública del backend.

## Despliegue

- El build genera la cartelera y el sitemap, así que el entorno de build tiene que llegar al
  backend. En producción se define `API_URL` o `BACKEND=hosteado`. Las fichas se generan al primer pedido y se revalidan cada 60 segundos.
- Cada horario enlaza a `/funciones/{funcionId}`, la selección de butacas. Esa página pide el
  mapa sin caché en cada visita y crea el carrito desde el navegador por el proxy `/api`, así
  que el servidor de producción también tiene que llegar al backend. Después de confirmar, el
  comprador pasa a `/carritos/{carritoId}`. Esa página no se cachea y todos sus pedidos salen
  del navegador por el proxy, con el token de `sessionStorage`. La cuenta regresiva corrige el
  reloj del dispositivo con el header `Date` del backend, así que el proxy tiene que dejarlo
  pasar.
- Con `NEXT_PUBLIC_API_URL` el navegador no pasa por el proxy: el backend tiene que aceptar el
  dominio del sitio por CORS y exponer el header `Date`. Los previews tienen otro dominio, así
  que ahí se deja sin definir.
- `PAGO_SIMULADO` no se define en producción.
