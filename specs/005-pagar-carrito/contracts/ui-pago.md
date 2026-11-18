# Contrato de UI: pago

Textos y estructura acordados. Una columna, mobile-first desde 360 px, objetivos táctiles de al
menos 24 × 24 px (WCAG 2.5.8), estilos y tokens de `DESIGN.md`.

## Pantalla del carrito, vista `activo` (cambios sobre la 004)

Orden: `h1` "Tu carrito" → contador → resumen → "Cambiar butacas" → Email de entrega → **Pago** →
Abandono.

- Email guardado (FR-037), en una línea y sin recuadro: "Te mandamos las entradas a **{email}**
  cuando pagues." + "Me equivoqué, cambiar email" (texto subrayado al final de la frase). Al guardarlo se anuncia "Guardamos tu email." y el foco va al
  título "Pago", con la sección a la vista (rediseño del 2026-11-18: el recuadro competía con
  Pagar).
- Sección `h2` "Pago" (el botón va antes que la nota de Mercado Pago):
  - Botón primario "Pagar {total}" (por ejemplo "Pagar $ 9.000,00").
  - En curso: deshabilitado, "Iniciando el pago…".
  - Sin email guardado, la sección no se muestra. Mientras el formulario del email está abierto,
    "Pagar" va con contorno (el rojo es "Guardar email").
  - `email-entrega-faltante`: texto "Primero guardá el email para recibir las entradas." asociado
    al botón con `aria-describedby`, y se abre el formulario del email con el foco en el campo.
  - `pago-no-disponible`: "No pudimos iniciar el pago, probá de nuevo." + "Reintentar".
  - `carrito-modificado`: "Tu reserva cambió mientras iniciábamos el pago. Revisala y tocá Pagar de
    nuevo."
  - Red / desconocido: aviso genérico de `AvisoOperacion` con "Reintentar".
  - Dirección de pago inválida: "No pudimos abrir la página de pago. Probá de nuevo."

## Pantalla del carrito, vista `pagando`

- `h1` "Tu carrito"; contador; resumen con estado "Pago en curso".
- Aviso (no de error): "**Pago en curso.** Mientras pagás no se pueden cambiar las butacas ni el
  email, ni abandonar el carrito."
- Email en texto, sin "Cambiar email".
- "Cambiar butacas" y "Abandonar carrito" como botones con `aria-disabled="true"` y el aviso de
  arriba como descripción (siguen siendo enfocables para que el motivo se lea).
- Botón primario "Volver a la página de pago" (en curso: "Abriendo la página de pago…").
- Al recibir `carrito-en-pago` en otra acción, se llega a esta vista y el aviso se anuncia una vez.

## Pantalla del carrito, vista `pagado`

- `h1` "Tu compra"; sin contador ni cinta de peligro.
- Estado "Pagado" en el resumen; `ListaEntradas`; aviso de email; enlace "Ver la cartelera".

## Cambio de butacas en Pagando o Pagado

- `h1` "No podés cambiar las butacas"; texto "Hay un pago en curso." o "Esta compra ya está
  pagada."; enlace "Volver al carrito". Sin mapa.

## Página de vuelta `/carritos/{id}/pago`

| Fase | `h1` | Contenido | Acciones |
|---|---|---|---|
| esperando | "Estamos confirmando tu pago…" | "Esto tarda unos segundos. No cierres esta pestaña." Indicador de progreso sin animación obligatoria (`prefers-reduced-motion`). | "Volver a la página de pago" (secundario) |
| sinConfirmar | "Todavía no se confirmó tu pago" | "Si pagaste, puede tardar un poco más. Si el pago fue rechazado, podés volver a intentarlo antes de que termine el tiempo." + contador | "Revisar de nuevo" (primario), "Volver a la página de pago" |
| listo | "¡Listo!" | "Estas son tus entradas. También te las mandamos a **{email}**." + `ListaEntradas` | "Ver la cartelera" |
| vencido | "Se terminó el tiempo para pagar" | "El tiempo para pagar venció y tus butacas quedaron libres. Si se cobró algo, se devuelve automáticamente." | "Elegir otra función" |
| cerrado | según `VistaLectura` | | "Elegir otra función" |
| sinSesion | "No encontramos tu pago en esta pestaña" | "Si el pago se aprobó, las entradas llegan al email que indicaste." | "Ver la cartelera" |
| perdido | como `VistaPerdido` de la 004 | | |

- Región `role="status"` con el texto de la fase; cambia solo al cambiar de fase.
- Al pasar a `listo` o `vencido`, foco en el `h1`.

## `ListaEntradas`

`<ul>` con una `<li>` por entrada, en una columna:

```text
┌──────────────────────────────┐
│ K7M2Q-X9PDA                  │  ← código, grande y monoespaciado, con etiqueta "Código"
│ El viaje de Chihiro          │
│ Centro · Sala 2              │
│ lunes 16/11 · 21:00          │
│ Fila C · Asiento 5           │
│ $ 4.500,00                   │
└──────────────────────────────┘
```

Cada dato con su etiqueta visible o accesible ("Fila", "Asiento"), sin depender de la posición.

## Página de pago simulado `/carritos/{id}/pago-simulado`

- Cinta superior: "Simulación de desarrollo. No se cobra nada." (texto, no solo color).
- `h1` "Pago simulado"; "Total del carrito: {total}" si se puede leer la sesión.
- Campo "Monto a pagar" (`inputmode="decimal"`), precargado con el total; error junto al campo:
  "Escribí un monto mayor que cero, con hasta dos decimales."
- Botones: "Aprobar pago" (primario), "Rechazar pago", "Pagar otro monto". Durante el envío los
  tres se deshabilitan y el tocado dice "Registrando…".
- Error: "No pudimos registrar el pago simulado." + "Reintentar".
