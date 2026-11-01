# Quickstart: validar el mapa de butacas

Guía para comprobar que la funcionalidad cumple la spec. Los detalles de rutas, API y roles
están en [contracts/](contracts/) y [data-model.md](data-model.md).

## 1. Contra el backend real (desarrollo y validación manual)

Prerrequisitos: Docker y el repositorio `cinema-system-randomplay-backend` al lado de este.

```bash
docker compose -f ../cinema-system-randomplay-backend/docker-compose.yml up --build -d
```

En `.env.local` del frontend:

```text
API_URL=http://localhost:8080
SITE_URL=http://localhost:3000
API_MOCK=0
```

```bash
npm run dev
```

El seeder crea funciones de hoy para Interstellar, Dune y Relatos salvajes, a 1–5 horas del
momento en que arrancó el backend. Si pasaron horas y ya no hay horarios, recrear los datos:

```bash
docker compose -f ../cinema-system-randomplay-backend/docker-compose.yml down -v
```

Después se vuelve a levantar con el primer comando.

### Recorridos

| # | Pasos | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Abrir la ficha de Interstellar y tocar un horario. | `/funciones/{id}` con película, sucursal, sala, fecha, hora y precio. Mapa con "PANTALLA" arriba y letras a ambos lados. | US1-1, US1-2 |
| 2 | Elegir dos butacas y quitar una. | Resumen y total correctos al centavo (por ejemplo, la función de $ 7.250,50 da $ 14.501,00 con dos). | US1-3, US1-4, SC-004 |
| 3 | Elegir 10 e intentar una más. | No se agrega y aparece el aviso de máximo. | US1-6 |
| 4 | Confirmar 2. | Llega a `/carritos/{id}` con "Tu carrito quedó creado" y las dos butacas. En DevTools → Application → Session Storage existe `randomplay:carrito`. En Network, la URL no lleva el token. | US1-8, FR-022, FR-023 |
| 5 | Volver al mapa y recargar. | Las dos butacas figuran ocupadas. | Independent Test US1 |
| 6 | Desde ese mapa, elegir otras y confirmar. | En Network hay un `POST /api/carritos/{idAnterior}/abandono` antes del `POST .../carritos`. Las butacas anteriores quedan libres al recargar. | FR-032 |
| 7 | Conflicto real: abrir la misma función en dos ventanas privadas, elegir la misma butaca y confirmar primero en una. | La segunda ve "Alguien tomó la F7 antes que vos…" y el mapa actualizado. El resto de su selección se conserva. | US2-1, SC-008 |
| 8 | Abrir `/carritos/{id}` en otra pestaña. | "No hay un carrito activo en esta pestaña" y un enlace a la cartelera. | FR-033 |
| 9 | Abrir `/funciones/no-es-un-guid` y `/funciones/{GUID inexistente}`. | 404 de la marca. | FR-006 |
| 10 | Teclado: Tab hasta el mapa, flechas, Enter, Tab hasta "Confirmar". | Una sola parada de Tab en el mapa. El foco es visible y queda a la vista. | US3-1, US3-3 |
| 11 | Lector de pantalla (NVDA/VoiceOver) sobre una butaca. | Dice "Fila F, butaca 7, libre", y el cambio se anuncia al elegirla. | US3-2, US3-4 |
| 12 | DevTools con 360 × 800, función en Centro · Sala 2 (filas de 14). | Sin scroll horizontal en la página. Las butacas se desplazan dentro del mapa con las letras fijas, y miden 24 px o más. | US3-5, SC-007 |
| 13 | Ver el código fuente de `/funciones/{id}`. | `<meta name="robots" content="noindex, nofollow">`. En la respuesta: `Cache-Control: private, no-cache, no-store…`. | FR-004, FR-005 |

Los errores `funcion-sin-cupo`, `demasiados-pedidos`, `pedido-invalido` y
`asientos-inexistentes` son difíciles de provocar a mano contra el backend real. Se validan
con los tests (sección 2).

## 2. Tests automáticos

```bash
npm run gen:api
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

- `npm run gen:api` no debería generar diff.
- `npm test` corre Vitest + MSW: cada `codigo` de la confirmación, el cálculo de centavos, el
  reducer de selección, `Retry-After`, la sesión del carrito y el teclado del mapa.
- `npm run test:e2e` corre Playwright contra `scripts/mock-api.mjs` con fixtures: recorrido
  ficha → función → carrito, axe, 360 px, `noindex` y 404.

Qué tiene que pasar:

| Comprobación | Dónde |
|---|---|
| Los 6 `codigo` + desconocido + red, cada uno con su estado y mensaje | `tests/components/SelectorButacas.test.tsx` |
| El total coincide al centavo para 1–10 butacas y varios precios | `tests/unit/domain/dinero.test.ts` |
| El token no aparece en el HTML del servidor, la URL ni la consola | e2e `tests/e2e/butacas.spec.ts` (espía de `console` + `page.url()` + HTML de `/carritos/{id}`) |
| 0 violaciones de axe en `/funciones/{id}` y `/carritos/{id}` | `tests/e2e/accesibilidad.spec.ts` |
| Sin scroll horizontal en 360 px y butacas de 24 px o más | `tests/e2e/butacas.spec.ts` |
