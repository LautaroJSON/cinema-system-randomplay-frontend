# RandomPlay — Dirección de Diseño

Este archivo define la dirección visual del frontend del comprador. Lo usa la skill
`anti-slop` como fuente de identidad, personalidad, paleta, tipografía, mood y diales. Las
reglas técnicas (accesibilidad, SEO, bordes servidor/cliente) viven en
`.specify/memory/constitution.md` y tienen precedencia: si algo de este archivo choca con la
constitución, manda la constitución.

**Design Read**: Reading this as: sitio de compra de entradas de cine para el público general
que compra desde el teléfono, en un estilo de *videoclub de barrio urbano de fines de los 90 y
principios de los 2000* (cultura callejera, cintas VHS, etiquetas impresas), dial 2/2/1.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

---

## 1. Identidad

RandomPlay es **el videoclub de la esquina convertido en cine**. La sala no se presenta como
un multicine de shopping, sino como un local de barrio: estantes de cintas, carteles pegados a
mano, etiquetas con código, un mostrador donde alguien te recomienda qué ver.

- **Concepto central**: cada película es una **cinta** en el estante. Su ficha es el lomo y la
  carátula; las funciones son el contador de la videocasetera; elegir asientos es "rebobinar y
  darle play".
- **Inspiración**: la estética urbana *retro-tech* y street de fines de los 90 (cintas VHS,
  monitores CRT, stickers, cinta de embalar, carteles fotocopiados, tipografía condensada y
  pesada). Es inspiración de **actitud y lenguaje gráfico**. **No** se copia ningún juego,
  personaje, logo, mascota, asset ni composición de pantalla de un producto existente (R-30).
- **Qué no es**: no es neón cyberpunk, no es glassmorphism, no es "dark SaaS" con gradientes
  violetas, no es una marquesina dorada art déco.

## 2. Personalidad

| Es | No es |
|---|---|
| Callejero, con oficio | Lujoso o solemne |
| Directo y con humor seco | Gracioso a la fuerza, lleno de emojis |
| Táctil: etiquetas, cintas, sellos | Plano y genérico |
| Rápido de usar | Decorado a costa de la compra |
| Seguro de sí mismo | Gritón |

La personalidad se expresa **en el catálogo, el detalle y los bordes** (encabezados, etiquetas,
vacíos y errores). En el flujo privado (asientos → carrito → email) la personalidad se baja al
mínimo: claridad primero.

## 3. Mood

Un local con la persiana a medio bajar a las diez de la noche: luz cálida sobre fondo oscuro,
el rojo de un cartel pintado y el amarillo dorado de una etiqueta de alquiler. Nada brilla:
**todo está impreso, pegado o estampado**. El color sale de tintas y papeles, no de luces.

Palabras clave: *impreso · etiquetado · cálido · nocturno · con grano · preciso*.

## 4. Paleta

Tema único: **oscuro** ("sala apagada"). No se ofrece tema claro por ahora (R-34: un solo
tema, completo y verificado). Si más adelante se agrega, entra con su propia sección de tokens.

### Tokens

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0F0D0C` | Fondo de página. Negro cálido, nunca `#000`. |
| `--surface` | `#1A1715` | Tarjetas, paneles, hoja del carrito. |
| `--surface-2` | `#26211E` | Superficies elevadas, filas alternas, estados hover. |
| `--line` | `#4A403A` | Divisores decorativos (no para delimitar controles). |
| `--line-strong` | `#7A6D64` | Bordes de inputs y controles (≥ 3:1 sobre `--ink` y `--surface`). |
| `--paper` | `#F2EBE0` | Texto principal. Papel envejecido, no blanco puro. |
| `--paper-muted` | `#B8AC9D` | Texto secundario, metadatos. |
| `--telon` | `#B4162C` | Rojo telón. **Solo como relleno** (botón primario, sellos, franjas). |
| `--telon-ink` | `#FF5C5C` | Variante legible del rojo para texto y errores sobre fondo oscuro. |
| `--oro` | `#E9B949` | Dorado de etiqueta: selección, foco, acentos, contadores. |
| `--oro-ink` | `#0F0D0C` | Texto sobre `--oro`. |

### Contrastes verificados (WCAG 2.2)

| Par | Ratio | Cumple |
|---|---|---|
| `--paper` sobre `--ink` | 16.4:1 | AAA |
| `--paper` sobre `--surface` | 15.1:1 | AAA |
| `--paper-muted` sobre `--ink` | 8.7:1 | AAA |
| `--paper-muted` sobre `--surface-2` | 7.2:1 | AAA |
| `--oro` sobre `--ink` | 10.6:1 | AAA |
| `--oro-ink` sobre `--oro` | 10.6:1 | AAA |
| `--paper` sobre `--telon` | 5.7:1 | AA |
| `--telon-ink` sobre `--ink` | 6.4:1 | AA |
| `--line-strong` sobre `--ink` | 3.1:1 | 1.4.11 (no texto) |
| `--telon` sobre `--ink` | 2.9:1 | ✗ **Nunca** como texto ni como único borde de un control |

### Reglas de color

- Proporción aproximada por pantalla: **85 % tinta y superficies, 10 % papel, 5 % acento**.
  Rojo y dorado no compiten: el **rojo es acción y alerta**, el **dorado es selección y foco**.
- Un solo botón rojo por vista (la acción principal).
- **Sin gradientes** de color a color (R-01). La única textura permitida es un grano o trama
  de puntos (halftone) sutil, monocroma y estática, sobre superficies grandes del catálogo.
- **Sin glow** ni sombras de color (R-13). El "brillo" se reemplaza por contraste.
- Las etiquetas de `clasificacion` usan forma + texto, no un color por categoría.

## 5. Tipografía

Dos familias, servidas con `next/font` (sin requests de terceros que bloqueen el render, R-40).

| Rol | Familia | Por qué |
|---|---|---|
| Display y cuerpo | **Archivo** (variable: `wght` 100–900, `wdth` 62–125) | Grotesca con eje de ancho: en condensado y pesado da el cartel callejero; en ancho normal es un cuerpo muy legible en teléfono. Una sola familia, dos voces. |
| Etiquetas técnicas | **Martian Mono** (variable) | Monoespaciada de aire técnico para horarios, contador, códigos de fila y asiento y precios: evoca el display de la videocasetera y la etiqueta impresa. |

### Escala (mobile-first, base 16 px)

| Estilo | Tamaño móvil → escritorio | Familia y ajustes |
|---|---|---|
| `display` (h1 de catálogo y detalle) | 40 → 72 px | Archivo 800, `wdth` 70, mayúsculas, `letter-spacing: -0.01em`, interlineado 0.95 |
| `h2` | 28 → 40 px | Archivo 750, `wdth` 75, mayúsculas |
| `h3` | 20 → 24 px | Archivo 650, `wdth` 90 |
| `body` | 16 → 17 px | Archivo 400, `wdth` 100, interlineado 1.55 |
| `small` | 14 px | Archivo 450 |
| `label` | 12 → 13 px | Martian Mono 500, mayúsculas, `letter-spacing: 0.08em` |
| `counter` (horarios, cuenta regresiva, precios) | 20 → 28 px | Martian Mono 600, `font-variant-numeric: tabular-nums` |

- Las mayúsculas condensadas son **solo para titulares cortos**. Las sinopsis y los mensajes
  van siempre en caja normal.
- El texto de cuerpo nunca baja de 16 px en móvil.
- Ancho de línea máximo de 68 caracteres para la sinopsis.

## 6. Forma y composición

### Lenguaje gráfico (los elementos firma)

1. **Lomo de cinta**: la tarjeta de película tiene una franja vertical a la izquierda con el
   título en `label` (rotado 90° en escritorio, horizontal en móvil), la clasificación y la
   duración, como el lomo de un VHS en el estante.
2. **Etiqueta pegada**: los chips (clasificación, "HOY", "ÚLTIMAS BUTACAS") son rectángulos de
   papel con una leve rotación (−1.5° a 1.5°) y borde recto. Máximo dos por tarjeta (R-09).
3. **Corte en diagonal**: los encabezados de sección y el botón primario tienen **una esquina
   cortada a 45°** (`clip-path`). Es la única "forma" de la marca; no se combina con esquinas
   redondeadas.
4. **Sombra dura**: las superficies que se levantan usan sombra desplazada sin desenfoque
   (`4px 4px 0 var(--ink)` + borde `--line`), como un papel pegado. **Nunca** sombras difusas
   grandes (R-12).
5. **Cinta de peligro**: una franja diagonal rojo/tinta se reserva **solo** para el estado de
   carrito expirado o sin conexión. Si aparece en otro lado, deja de significar algo.

### Bordes y radios

- Radio base: **2 px** (casi recto, material impreso). Los asientos usan 4 px en la parte
  superior para insinuar el respaldo de la butaca.
- Bordes de 1.5–2 px. Nada de bordes de 1 px gris claro "de plantilla".

### Grilla y ritmo (RHYTHM 2)

- Grilla de 4 columnas en móvil y 12 en escritorio, gutter de 16 px en móvil (página sin
  scroll horizontal desde 360 px).
- El catálogo **es un estante**: filas de lomos y carátulas con alineación consistente, y
  **una sola ruptura por página**. La película destacada del día ocupa el ancho completo con
  titular display; el resto es grilla regular.
- El detalle de película se arma en dos bloques (ficha arriba y horarios por sucursal abajo),
  con los horarios como **tira de contador**: horario en `counter`, sala y formato en `label`.
- Flujo privado: una sola columna, sin rupturas.

## 7. Componentes clave

- **Botón primario**: relleno `--telon`, texto `--paper` en Archivo 700 mayúsculas `wdth` 85,
  esquina superior derecha cortada, sombra dura. El texto describe la acción ("Elegir
  butacas", "Confirmar 3 butacas"); **sin flechas decorativas** (R-08). El estado presionado
  baja la sombra a 0 y desplaza el botón 2 px (sensación de tecla de videocasetera).
- **Botón secundario**: contorno `--line-strong` y texto `--paper`; hover con relleno
  `--surface-2`.
- **Foco**: anillo de 2 px `--oro` con 2 px de separación, siempre visible en teclado.
- **Mapa de asientos** (sin depender del color, Principio VI de la constitución):
  - libre: contorno `--paper-muted` y fondo `--surface`;
  - seleccionado: relleno `--oro` y marca ✓ en `--oro-ink`;
  - ocupado: fondo `--surface-2` con trama diagonal y sin contorno, deshabilitado;
  - las letras de fila van en `label` a ambos lados y la pantalla es una franja `--paper-muted`
    con el texto "PANTALLA".
  - El objetivo táctil mínimo es de 24 × 24 px (2.5.8); se recomiendan 32 px con zoom/pan
    en salas grandes.
- **Cuenta regresiva del carrito**: contador `counter` en dorado, estilo display de
  videocasetera (`09:42`). En los últimos 2 minutos pasa a `--telon-ink`, sin parpadeo.
- **Precio**: siempre en `counter`, con moneda explícita.

## 8. Movimiento (MOTION 1)

- Solo **hover, focus y press**, con transiciones de 120–160 ms `ease-out` sobre color,
  sombra y desplazamiento de 2 px.
- **Sin** scroll-reveal, parallax, carruseles automáticos ni animaciones de entrada.
- La única animación "de marca" permitida es un barrido corto de líneas de tracking VHS
  (≤ 300 ms, una vez) al cambiar de página en el catálogo. Es opcional, y si no suma se quita.
- `prefers-reduced-motion: reduce` elimina todo desplazamiento y deja solo cambios de color.

## 9. Iconografía e imagen

- Íconos de trazo de 2 px, esquinas rectas, en un único set (por ejemplo, Lucide con
  `stroke-linecap: square`). Los íconos acompañan al texto y no lo reemplazan (R-04).
- La API **no expone pósters** todavía. Hasta entonces, la carátula se resuelve
  **tipográficamente**: título en display condensado sobre `--surface` con trama halftone, más
  un "código de cinta" en `label` (por ejemplo, `RP-0042 · 118 MIN · +13`). Es un placeholder
  honesto y con estilo (R-38), no una foto de stock.
- Sin ilustraciones genéricas 3D ni blobs (R-22).

## 10. Voz y copy

- Español rioplatense, con **voseo** ("Elegí tus butacas", "Te quedan 4 minutos").
- Frases cortas, verbos al frente. Humor seco solo en estados vacíos y 404
  ("Esta cinta no está en el estante."), **nunca** en errores que afectan la compra.
- Los errores dicen qué pasó y qué hacer: "Alguien tomó la F7 antes que vos. Actualizamos el
  mapa; elegí otra." (Principio II: cada `codigo` tiene su mensaje).
- Sin buzzwords, sin "experiencia inolvidable", sin cifras inventadas (R-16, R-36).

## 11. Dónde se modulan los diales

| Zona | ENERGY | RHYTHM | MOTION |
|---|---|---|---|
| Catálogo, detalle y sucursales (públicas, indexables) | 2 | 2 | 1 |
| Asientos, carrito y email (flujo privado) | 1 | 1 | 1 |
| Estados vacíos, 404 y errores genéricos | 2 | 1 | 1 |

El dial global sigue siendo 2/2/1. El flujo privado lo baja de forma deliberada porque ahí
la claridad pesa más que la marca (R-31).

## 12. Fuera de alcance / prohibido

- Neón, glow, glassmorphism, gradientes de color y fondos con blobs.
- Personajes, mascotas, logos o assets de juegos o marcas existentes.
- Ruido VHS animado permanente o "glitch" sobre texto (daña legibilidad y accesibilidad).
- Más de un acento compitiendo por vista; rojo como texto sobre fondo oscuro.
- Simular un paso de pago (no existe en la API; ver la constitución).
