# Quickstart: validar el carrito

Guía para comprobar que la funcionalidad cumple la spec. Los detalles de rutas, API y roles
están en [contracts/](contracts/) y [data-model.md](data-model.md).

## 1. Contra el backend real (desarrollo y validación manual)

Prerrequisitos y arranque: los mismos de la
[sección 1 del quickstart de la 003](../003-mapa-butacas/quickstart.md) (backend con Docker,
`.env.local` con `API_URL=http://localhost:8080` y `API_MOCK=0`, `npm run dev`).

La retención del backend es de 5 minutos. Para recorrer el vencimiento sin esperar, se puede
bajar en el `appsettings.Development.json` del backend. El frontend no cambia, porque cuenta
desde `venceEn`.

### Recorridos

| # | Pasos | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Desde una función de hoy, elegir dos butacas y confirmar. | `/carritos/{id}` con película, sucursal, sala, fecha, hora, las dos butacas, precio por entrada, total, estado "Activo" y el contador en dorado cerca de `05:00`. | US1-1, US1-2 |
| 2 | En DevTools → Network, revisar el `GET /api/carritos/{id}`. | Lleva `Authorization: Bearer …`. La URL no lleva el token. La respuesta trae el header `Date`. | FR-003, FR-004, research C3 |
| 3 | Cambiar la hora del sistema 3 minutos hacia adelante y recargar. | El contador sigue mostrando el tiempo real (corrige con el header `Date`). | FR-016, SC-002 |
| 4 | Dejar la pestaña en segundo plano 1 minuto y volver. | El contador muestra el tiempo real, sin saltos raros. | US1-6, FR-015 |
| 5 | Esperar a `02:00`. | El contador pasa a rojo, sin parpadear. Con NVDA/VoiceOver se oye un solo aviso. | US1-3, FR-017 |
| 6 | Esperar a `00:00`. | Pantalla "Se terminó el tiempo" con cinta de peligro, aviso de una vez y "Elegir otra función". En Session Storage, `randomplay:carrito` tiene `token: null`. Al recargar, sigue el modo lectura. | US1-5, FR-005, FR-014 |
| 7 | Con otro carrito, escribir `nombre@` y guardar. | Mensaje junto al campo, sin pedido en Network, foco en el campo. | US2-2 |
| 8 | Escribir un email válido y guardar. | Bloque "Qué sigue" con el email y el aviso de que no hay pago ni entradas todavía. Ningún texto de "compra confirmada". | US2-4, FR-028, SC-009 |
| 9 | "Cambiar butacas": quitar una, agregar otra y guardar. | En Network, el `PUT .../asientos` lleva la selección completa. Vuelve al carrito con las butacas nuevas y el contador con el mismo tiempo que antes. | US3-1, US3-2, SC-004 |
| 10 | "Cambiar butacas" y volver sin guardar. | Ningún `PUT` en Network. El carrito sigue igual. | US3-3 |
| 11 | Conflicto real: en una ventana privada, retener la butaca que se quiere agregar; en la principal, agregarla en el cambio y guardar. | "Alguien tomó la F9 antes que vos…", mapa actualizado, las demás butacas siguen seleccionadas. | US3-5 |
| 12 | "Abandonar carrito" → "Sí, abandonar". | Modo lectura "Abandonaste el carrito". Al abrir el mapa de esa función, las butacas figuran libres. | US4-2, SC-007 |
| 13 | Con un carrito activo, recargar la página. | El carrito sigue activo. No hay `POST .../abandono` en Network. | US4-4, FR-033 |
| 14 | Abrir `/carritos/{id}` en otra pestaña. | "No hay un carrito activo en esta pestaña" sin ningún pedido a `/api/carritos`. | US5-8, FR-002 |
| 15 | En Session Storage, cambiar el token por cualquier texto y recargar. | "No pudimos recuperar tu carrito". La clave `randomplay:carrito` ya no existe. | US5-1, FR-034 |
| 16 | Con DevTools → Network en "Offline", guardar el email. | Aviso de que no hay conexión con cinta de peligro y "Reintentar". El texto escrito se conserva. Al volver a "Online" y reintentar, la cinta desaparece. | US5-7, FR-041 |
| 17 | Teclado: Tab por toda la pantalla, abrir y cerrar la confirmación del abandono con Escape. | Orden lógico, foco visible, el foco vuelve a "Abandonar carrito". | FR-043, contracts/ui-carrito.md |
| 18 | DevTools con 360 × 800. | Sin scroll horizontal en el carrito ni en el cambio de butacas. | FR-043 |
| 19 | Ver el código fuente de `/carritos/{id}`. | `<meta name="robots" content="noindex, nofollow">`, ningún dato del carrito ni token en el HTML. `Cache-Control: private, no-cache, no-store…`. | FR-006, SC-006 |

`carrito-no-activo` por una pestaña duplicada se puede probar a mano: duplicar la pestaña del
carrito, abandonar en una y guardar el email en la otra. Los demás códigos se validan con los
tests (sección 2).

## 2. Tests automáticos

```bash
npm run gen:api
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

- `npm run gen:api` no debería generar diff (el contrato no cambia).
- `npm test` corre Vitest + MSW con reloj simulado.
- `npm run test:e2e` corre Playwright contra `scripts/mock-api.mjs` con carritos en memoria y
  `page.clock`.

Qué tiene que pasar:

| Comprobación | Dónde |
|---|---|
| Restante, tramos, `MM:SS` redondeado hacia arriba, texto accesible y desfase (incluido header ausente o absurdo) | `tests/unit/domain/cuenta-regresiva.test.ts` |
| Exactamente 2 avisos en una retención completa; color por tramo; vencido a los 0 s; corrección tras un salto del reloj | `tests/components/PantallaCarrito.test.tsx` |
| Sesión v2: guardar, actualizar sin tocar el token, cerrar, descartar, versión 1 ignorada, id distinto | `tests/unit/domain/sesion-carrito.test.ts` |
| Transiciones de vista y `credencialPerdida` | `tests/unit/domain/carrito.test.ts` |
| Cada `codigo` de GET, PUT asientos, PUT email y abandono, más `401`, desconocido y red | `tests/components/PantallaCarrito.test.tsx`, `tests/components/CambioButacas.test.tsx` |
| El cuerpo del `PUT .../asientos` es la selección completa; "Guardar" deshabilitado sin cambios | `tests/components/CambioButacas.test.tsx` |
| `marcarPropias` y `mismaSeleccion` | `tests/unit/domain/butacas.test.ts` |
| Validación del email | `tests/unit/domain/email.test.ts` |
| PUT con Bearer, `horaServidorMs`, `estadoActual`, ruta con el id de la sesión | `tests/unit/api/navegador.test.ts`, `carritos.test.ts`, `problema.test.ts` |
| Recorrido mapa → carrito → email → cambio → abandono; vencimiento con `page.clock`; token fuera de URL, HTML y consola; recarga sin abandono | `tests/e2e/carrito.spec.ts` |
| 0 violaciones de axe en carrito activo, vencido y cambio de butacas | `tests/e2e/accesibilidad.spec.ts` |
