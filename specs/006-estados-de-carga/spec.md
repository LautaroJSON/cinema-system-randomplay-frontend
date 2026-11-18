# Feature Specification: Aviso de carga al elegir un horario

**Feature Branch**: `006-estados-de-carga`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "El backend corre en un plan gratuito que se duerme por inactividad y tarda unos 30 segundos en despertar. Cuando el visitante toca un horario en el detalle de una película, la página se queda congelada hasta que el servidor tiene las butacas, sin ninguna señal de que el toque funcionó. Quiero mostrarle un feedback visual de que se está cargando la función para que elija su butaca. Solamente eso." (Reemplaza la versión anterior de esta spec, que agregaba estados de carga a la página de la función y a las del carrito; se descartó por sus efectos sobre los códigos de estado y el comportamiento sin JavaScript.)

## Qué pasa hoy

1. El visitante está en el detalle de una película (servido desde la caché, carga rápido) y
   toca un horario.
2. El sitio se queda en el detalle, sin ningún cambio visible, mientras el servidor le pide el
   mapa de butacas al backend.
3. Con el backend despierto, la página de la función aparece en menos de un segundo.
4. Con el backend dormido, el servidor deja de esperar a los **5 segundos** y el visitante ve
   la página de error, aunque el backend iba a contestar a los 30.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver que el horario tocado está cargando (Priority: P1)

El visitante toca un horario. Al instante, ese horario cambia de aspecto y dice que está
cargando, y en la parte de abajo de la pantalla aparece un aviso que nombra la función que se
está abriendo. El visitante sabe que su toque funcionó. Cuando la página de la función está
lista, el sitio la abre como hoy.

**Why this priority**: es todo el pedido. Sin señal, el visitante vuelve a tocar, recarga o se
va antes de que el backend despierte.

**Independent Test**: con el backend demorado 8 segundos, tocar un horario en el detalle de una
película y comprobar que en menos de medio segundo ese horario muestra que está cargando y
aparece el aviso inferior; al llegar los datos se abre la página de la función.

**Acceptance Scenarios**:

1. **Given** el detalle de una película con horarios, **When** el visitante toca uno, **Then**
   en menos de medio segundo ese horario muestra un estado de carga visible y el resto de los
   horarios no cambia.
2. **Given** un horario cargando, **When** el visitante mira la parte inferior de la pantalla,
   **Then** ve un aviso con el horario y la sala de la función que se está abriendo (por
   ejemplo, "Cargando las butacas de las 20:30, Sala 2…").
3. **Given** un horario cargando, **When** la página de la función está lista, **Then** se
   abre como hoy y el aviso desaparece.
4. **Given** un horario cargando, **When** el visitante toca otro horario, **Then** el estado de
   carga y el aviso pasan al último horario tocado.
5. **Given** un visitante con lector de pantalla, **When** activa un horario, **Then** oye una
   vez que se están cargando las butacas de esa función.
6. **Given** el backend responde rápido, **When** el visitante toca un horario, **Then** la
   página de la función se abre sin demora extra; el aviso puede no llegar a verse.

---

### User Story 2 - Aviso cuando la espera se alarga (Priority: P1)

Si la carga tarda más de 5 segundos, el aviso inferior suma una línea que explica que puede
tardar un poco más y que no hace falta recargar. No culpa al visitante ni habla de servidores.

**Why this priority**: con 30 segundos de espera, un "Cargando…" solo se lee como colgado y el
visitante recarga, lo que vuelve a empezar la espera.

**Independent Test**: con el backend demorado 8 segundos, el aviso de demora no está a los 3
segundos y sí a los 6; con el backend rápido no aparece nunca.

**Acceptance Scenarios**:

1. **Given** un horario cargando, **When** pasan 5 segundos, **Then** el aviso suma "Esto puede
   tardar un poco más. No hace falta recargar la página."
2. **Given** la página llega antes de los 5 segundos, **When** se abre, **Then** la línea de
   demora nunca apareció.
3. **Given** un visitante con lector de pantalla, **When** aparece la línea de demora, **Then**
   la oye una sola vez.

---

### User Story 3 - La espera llega al final (Priority: P1)

Con el backend dormido, el sitio espera lo necesario para que despierte en lugar de mostrar un
error a los 5 segundos.

**Why this priority**: sin esto, el aviso aparece y a los 5 segundos lo reemplaza la página de
error; las historias 1 y 2 no sirven.

**Independent Test**: con el backend demorado 30 segundos, tocar un horario termina en la
página de la función, no en la de error.

**Acceptance Scenarios**:

1. **Given** el backend tarda 30 segundos, **When** el visitante toca un horario, **Then** ve
   la página de la función al terminar la espera.
2. **Given** el backend no responde en 45 segundos, **When** se cumple ese tiempo, **Then** el
   visitante ve la página de error recuperable de siempre.

---

### Edge Cases

- **Entrar a una función por enlace directo o recargar**: no hay horario tocado, así que no hay
  aviso; el visitante ve el indicador de carga propio del navegador, como hoy. Fuera de
  alcance.
- **El visitante vuelve atrás o toca otro enlace durante la carga**: la navegación funciona y
  el aviso desaparece o pasa al enlace nuevo.
- **El horario vence mientras carga**: la lista de horarios puede ocultarlo; el aviso
  desaparece si el enlace deja de existir y la navegación sigue su curso.
- **La función ya empezó, no existe o el backend falla**: al terminar la espera se muestra el
  mismo resultado que hoy ("Esta función ya empezó", 404 o error recuperable), con los mismos
  códigos de estado.
- **Sin JavaScript**: el enlace es un enlace común y el navegador muestra su propio indicador;
  la página de la función se ve completa como hoy.
- **Teclado**: el foco queda en el horario activado durante la carga; el aviso no recibe foco.

## Requirements *(mandatory)*

### Functional Requirements

**Señal en el horario tocado**

- **FR-001**: Al activar un horario del detalle de una película, ese horario DEBE mostrar un
  estado de carga visible en menos de medio segundo, que no dependa solo del color.
- **FR-002**: El estado de carga del horario NO DEBE cambiar su tamaño ni mover los demás
  horarios.
- **FR-003**: Solo el último horario activado DEBE mostrarse cargando.

**Aviso inferior**

- **FR-004**: Mientras un horario carga, DEBE verse un aviso fijo en la parte inferior de la
  pantalla que nombre el horario y la sala de la función (datos que ya están en el horario
  tocado) y diga que se están cargando las butacas.
- **FR-005**: Si la carga supera 5 segundos, el aviso DEBE sumar una línea que explique que
  puede tardar un poco más e indique que no hace falta recargar. No DEBE culpar al visitante
  ni mencionar servidores, planes ni "despertar"; sigue la voz de DESIGN.md (voseo, frase corta).
- **FR-006**: El aviso DEBE desaparecer cuando termina la navegación (con éxito o con error) o
  cuando ningún horario está cargando.
- **FR-007**: El aviso NO DEBE tapar contenido que el visitante necesite durante la espera ni
  impedir tocar otros horarios o enlaces.

**Tolerancia a la espera**

- **FR-008**: La lectura del mapa de la función NO DEBE darse por fallida antes de 45 segundos.
  Los demás pedidos conservan sus tiempos.

**Accesibilidad (Principio VI)**

- **FR-009**: El inicio de la carga y la línea de demora DEBEN anunciarse una vez cada uno a las
  tecnologías de asistencia, de forma cortés.
- **FR-010**: El aviso NO DEBE recibir foco ni moverlo; el foco queda en el horario activado.
- **FR-011**: Sin movimiento: el estado de carga y el aviso aparecen sin animación (DESIGN.md,
  MOTION 1), y con `prefers-reduced-motion` nada se mueve.
- **FR-012**: Textos con contraste WCAG 2.2 AA; el aviso se ve completo desde 360 px de ancho.

**Sin cambios**

- **FR-013**: La página de la función, las del carrito, la cartelera, el detalle y el sitemap
  NO DEBEN cambiar su contenido, sus códigos de estado ni su comportamiento sin JavaScript.
  Ningún pedido pasa del servidor al navegador (Principio IX).

### Key Entities

- **Horario en carga**: el horario que el visitante activó y cuya página de función todavía no
  se abrió. Lleva su hora y su sala para el aviso.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el backend demorado 30 segundos, el horario tocado muestra que está cargando
  en menos de medio segundo en un perfil de teléfono de gama media.
- **SC-002**: Con el backend demorado 30 segundos, el 100 % de los toques a un horario terminan
  en la página de la función y no en la de error.
- **SC-003**: La línea de demora aparece en el 100 % de las esperas de más de 5 segundos y en
  ninguna de menos de 5 segundos.
- **SC-004**: Mostrar el estado de carga no produce desplazamientos de diseño en el detalle
  (CLS sin cambios respecto de hoy).
- **SC-005**: Un recorrido con lector de pantalla oye un anuncio al activar el horario y, si
  corresponde, uno de demora, sin repeticiones.

## Assumptions

- **Solo navegación dentro del sitio.** El aviso cubre los toques a horarios del detalle de una
  película. Enlaces directos, recargas y las páginas del carrito quedan fuera de alcance.
- **Umbral del aviso de demora: 5 segundos**, valor de experiencia definido en un solo lugar
  (Principio IV).
- **Texto propuesto**: "Cargando las butacas de las {hora}, {sala}…" y "Esto puede tardar un
  poco más. No hace falta recargar la página." El texto final se ajusta en la implementación
  siguiendo DESIGN.md §10.
- **Timeout de 45 segundos** para la lectura del mapa: cubre el despertar de ~30 s con margen.
  El hosting del frontend tiene que permitir pedidos de al menos 60 segundos.
- **Mantener el backend despierto** (ping externo a `/health`) se resuelve fuera de este
  repositorio.
