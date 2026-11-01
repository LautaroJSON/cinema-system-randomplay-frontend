# Contrato de interfaz: mapa de butacas

Lo que los tests consultan por rol y nombre accesible (Principio VII). Si esto cambia, cambian
los tests.

## Roles y nombres

| Elemento | Rol | Nombre accesible |
|---|---|---|
| Contenedor del mapa | `grid` | "Butacas de {salaNombre}" |
| Fila | `row` | — |
| Letra de fila (izquierda) | `rowheader` | "Fila {letra}" |
| Letra de fila (derecha) | presentacional (`aria-hidden`) | — |
| Pantalla | texto "PANTALLA" (`aria-hidden`; el `grid` ya da el contexto) | — |
| Butaca | `button` dentro de `gridcell` | "Fila {letra}, butaca {n}, libre" / "…, seleccionada" / "…, ocupada" |
| Butaca ocupada | además `aria-disabled="true"` | — |
| Resumen | `status` (`aria-live="polite"`) | Texto: "{n} butaca(s) elegida(s): F7, F8. Total {total}" o "Todavía no elegiste butacas." |
| Botón primario | `button` | "Confirmar {n} butacas" / "Confirmar 1 butaca". Deshabilitado con 0, durante el envío, en `esperando` y en `funcionCerrada`. |
| Aviso de error de la confirmación | `alert` | Texto del aviso (research B11). |
| Mensajes de `pedido-invalido` | asociados al resumen con `aria-describedby` | — |
| Reintentar o actualizar mapa | `button` | "Reintentar" / "Actualizar mapa" |
| Volver a horarios | `link` | "Ver otros horarios" |

## Teclado

| Tecla (foco en una butaca) | Efecto |
|---|---|
| Tab / Shift+Tab | Entra al mapa o sale de él. Es una sola parada. |
| ← / → | Butaca anterior o siguiente de la fila. No pasa de fila. |
| ↑ / ↓ | Fila anterior o siguiente, en el número más cercano. |
| Inicio / Fin | Primera o última butaca de la fila. |
| Enter / Espacio | Alterna la butaca, si no está ocupada. |

El foco siempre queda a la vista dentro del área desplazable.

## Visual (DESIGN.md §7, dial 1/1/1)

| Estado | Fondo | Contorno | Marca |
|---|---|---|---|
| Libre | `--surface` | `--paper-muted` | — |
| Seleccionada | `--oro` | — | ✓ en `--oro-ink` |
| Ocupada | `--surface-2` con trama diagonal | ninguno | — |
| Foco | — | anillo de 2 px `--oro` con 2 px de separación | — |

El número de butaca se ve siempre dentro de la butaca, en `label` a un tamaño que entra en 24 px
para números de hasta 2 cifras. En la seleccionada, la ✓ va junto al número o en lugar de él,
según lo que entre, y el número sigue estando en el nombre accesible y en el resumen. La fila se
lee en las letras de los costados.

Tamaño: entre 24 y 32 px (research B8). Las letras quedan fijas a ambos lados y la página no
tiene scroll horizontal desde 360 px.
