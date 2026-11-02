# Contrato de interfaz: carrito

Lo que los tests consultan por rol y nombre accesible (Principio VII). Si esto cambia, cambian
los tests. El mapa del cambio de butacas sigue el
[contrato de la 003](../../003-mapa-butacas/contracts/ui-mapa.md).

## Pantalla del carrito

| Elemento | Rol | Nombre accesible / texto |
|---|---|---|
| Título | `heading` nivel 1 | Según la vista (contracts/routes.md) |
| Contador | `timer` | Texto oculto "Quedan {m} minutos y {s} segundos". El visible `MM:SS` va con `aria-hidden`. |
| Rótulo del contador | texto | "Tus butacas están reservadas por" |
| Avisos de tiempo | `status` | Vacío salvo al entrar al tramo final y al vencer (un texto cada vez) |
| Estado | dentro del resumen (`<dl>`) | "Estado" → "Activo" / "Abandonado" / "Vencido" / "Estado desconocido" |
| Butacas | `list` dentro del resumen | Un `listitem` por butaca: "Fila F, butaca 7" |
| Cambiar butacas | `link` | "Cambiar butacas" |
| Campo de email | `textbox` | "Email para recibir las entradas" (`<label>` visible). `aria-invalid="true"` con error. `aria-describedby` → mensaje. |
| Guardar email | `button` | "Guardar email" / "Guardando…" (deshabilitado durante el envío) |
| Qué sigue | `region` (`section` con `h3` "Qué sigue", dentro de "Email de entrega") | Email guardado + aviso de que no hay pago ni entradas todavía |
| Cambiar email | `button` | "Cambiar email" |
| Abandonar | `button` | "Abandonar carrito" |
| Confirmación del abandono | `group` con nombre | "Confirmar abandono"; botones "Sí, abandonar" y "Seguir con mi carrito" |
| Aviso de error de una operación | `alert` | Qué pasó y qué hacer (research C10) |
| Reintentar | `button` | "Reintentar" |
| Cinta de peligro | presentacional (`aria-hidden`) | — (el aviso de al lado dice qué pasó) |
| Empezar de nuevo | `link` | "Elegir otra función" / "Ver la cartelera" |

## Cambio de butacas

| Elemento | Rol | Nombre accesible / texto |
|---|---|---|
| Volver | `link` | "Volver al carrito" |
| Título | `heading` nivel 1 | "Cambiá tus butacas" |
| Contador | `timer` | Igual que en el carrito |
| Butacas propias | `button` en `gridcell` | "Fila F, butaca 7, seleccionada" (nunca "ocupada") |
| Guardar | `button` | "Guardar {n} butacas" / "Guardar 1 butaca". Deshabilitado con 0, sin cambios, durante el envío y en `funcionCerrada`. |
| Selección vacía | texto + `link` | "Para no quedarte con ninguna butaca, abandoná el carrito." + "Ir al carrito" |

## Teclado

| Lugar | Tecla | Efecto |
|---|---|---|
| Campo de email | Enter | Envía el formulario |
| Confirmación del abandono | Escape | Cierra la confirmación y devuelve el foco a "Abandonar carrito" |
| Mapa del cambio | (como en la 003) | — |

## Foco

| Momento | Foco |
|---|---|
| Error de formato del email | Campo de email |
| Abrir la confirmación del abandono | "Seguir con mi carrito" |
| Cerrar la confirmación | "Abandonar carrito" |
| Pasar a `lectura`, `perdido` o vencido | `h1` de la vista nueva (si el foco no estaba en el campo de email, research C12) |
| Volver del cambio de butacas | `h1` "Tu carrito" |
| Guardar el email | Bloque "Qué sigue" (`h3`) |

## Visual (DESIGN.md §6, §7 y §11, dial 1/1/1)

| Elemento | Estilo |
|---|---|
| Contador, tramo normal | `counter` en `--oro`, Martian Mono 600, `tabular-nums` |
| Contador, tramo final (≤ 2 min) | `counter` en `--telon-ink`. Sin parpadeo, sin transición. |
| Cinta de peligro | Franja de 8 px, rayas diagonales `--telon` / `--ink` de corte duro, solo en vencido y sin conexión |
| Botón primario | "Guardar email" o "Guardar N butacas"; como máximo uno por vista |
| Abandonar, Cambiar email, Reintentar | Botón secundario (contorno `--line-strong`) |
| Resumen | `--surface` con sombra dura, una columna |

Contrastes medidos (research C6): `--oro` sobre `--surface` 9.77:1; `--telon-ink` sobre
`--surface` 5.89:1, sobre `--surface-2` 5.26:1 y sobre `--ink` 6.40:1.

Desde 360 px de ancho la página no tiene scroll horizontal y todos los controles, salvo las
butacas del mapa (excepción de la 003), miden 44 px o más de alto.
