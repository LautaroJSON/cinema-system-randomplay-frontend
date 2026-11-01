# Feature Specification: Mapa de butacas y retención de asientos

**Feature Branch**: `003-mapa-butacas`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Mapa de butacas y retención de asientos, en /funciones/{funcionId}, que es el destino de cada horario de la ficha de película (hoy responde 404). El comprador ve una cabecera con película, sucursal, sala, fecha, hora y precio; ve el mapa de la sala con la pantalla arriba y las letras de fila a ambos lados; elige y quita hasta 10 butacas con cantidad y total sumado en centavos; confirma con 'Confirmar N butacas', que retiene los asientos y devuelve el carrito y su token; el token y el id del carrito se guardan en sessionStorage y se pasa a un destino provisorio del carrito (la pantalla real es la spec 004). Cada `codigo` de error de la creación del carrito tiene su manejo. La página no se cachea, lleva noindex, el token nunca sale del navegador ni aparece en URL o logs, y el mapa funciona con teclado y lector de pantalla desde 360 px."

## Clarifications

### Session 2026-11-01

- Q: Si ya hay un carrito guardado en la pestaña y se confirma una selección nueva, ¿qué pasa con el anterior? → A: Antes de crear el nuevo se abandona el anterior con su credencial; si esa liberación falla, se crea el nuevo igual.
- Q: ¿En qué dirección queda la pantalla del carrito a la que se llega al confirmar? → A: `/carritos/{carritoId}`; busca la credencial de ese id en la pestaña y, si no está, avisa que no hay un carrito activo y ofrece volver a la cartelera.
- Q: Cuando la sala no entra a lo ancho en el teléfono, ¿cómo se resuelve el mapa? → A: Las butacas se achican hasta 24 px como mínimo (32 px cuando hay lugar); si igual no entran, el mapa se desplaza a lo ancho dentro de su área con las letras de fila fijas a los costados. Sin controles de zoom.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir butacas y retenerlas (Priority: P1)

Desde la ficha de una película, el comprador toca un horario y llega a la página de esa función.
Arriba ve qué está por comprar: película, sucursal, sala, fecha, hora de inicio y precio por
entrada. Debajo ve la sala: la pantalla arriba, las filas con su letra a ambos lados y cada
butaca marcada como libre u ocupada. Toca las butacas libres que quiere (y vuelve a tocarlas
para quitarlas), ve cuántas lleva y cuánto suman, y confirma con "Confirmar N butacas". Las
butacas quedan retenidas a su nombre y pasa a la pantalla del carrito.

**Why this priority**: es el paso que convierte una visita en una compra. Sin esta página, cada
horario de la ficha termina en un 404 y el flujo del comprador se corta.

**Independent Test**: con el backend local sembrado, abrir un horario de hoy de Interstellar
desde su ficha, elegir dos butacas libres, confirmar y comprobar que se llega al destino del
carrito, que el carrito existe en la API con esas dos butacas y que, al recargar el mapa, esas
butacas figuran ocupadas.

**Acceptance Scenarios**:

1. **Given** una función vigente, **When** el comprador abre `/funciones/{funcionId}`, **Then**
   ve el título de la película, la sucursal, la sala, la fecha y la hora de inicio con zona
   horaria de Argentina, y el precio por entrada con su moneda.
2. **Given** el mapa cargado, **When** el comprador lo mira, **Then** la pantalla aparece arriba
   con el texto "PANTALLA", cada fila muestra su letra a la izquierda y a la derecha, y cada
   butaca libre, ocupada o seleccionada se distingue por forma o marca además del color.
3. **Given** ninguna butaca elegida, **When** el comprador elige la F7 y la F8, **Then** ambas
   pasan a "seleccionada", el resumen dice 2 butacas y el total es exactamente el doble del
   precio por entrada, y el botón dice "Confirmar 2 butacas".
4. **Given** la F7 seleccionada, **When** el comprador vuelve a elegirla, **Then** deja de estar
   seleccionada y el resumen y el total se actualizan.
5. **Given** una butaca ocupada, **When** el comprador intenta elegirla, **Then** no cambia de
   estado.
6. **Given** 10 butacas seleccionadas, **When** el comprador intenta elegir otra libre, **Then**
   no se agrega y se le avisa que llegó al máximo de 10 por compra.
7. **Given** ninguna butaca seleccionada, **When** el comprador mira el botón de confirmar,
   **Then** está deshabilitado y se entiende que primero tiene que elegir al menos una.
8. **Given** butacas seleccionadas, **When** el comprador confirma y la API crea el carrito,
   **Then** la credencial del carrito y su id quedan guardados solo para esa pestaña y el
   comprador llega a una pantalla que confirma que el carrito quedó creado con sus butacas.
9. **Given** una confirmación en curso, **When** el comprador vuelve a tocar el botón, **Then**
   no se envía un segundo pedido.
10. **Given** un carrito anterior guardado en la pestaña, **When** el comprador confirma una
    selección nueva, **Then** el carrito anterior se abandona antes de crear el nuevo y queda
    guardada solo la credencial del nuevo, aunque el abandono haya fallado.

---

### User Story 2 - Recuperarse cuando la retención falla (Priority: P2)

El comprador confirma, pero la API rechaza el pedido: otra persona tomó una de sus butacas, la
función ya empezó, la sala llegó al tope de butacas retenidas, se hicieron demasiados intentos
o la red falló. En cada caso el comprador entiende qué pasó y qué puede hacer, sin perder el
resto de su selección cuando sigue siendo válida.

**Why this priority**: con varios compradores a la vez, perder una butaca entre que se ve el
mapa y se confirma es un caso normal, no una excepción. Un error mal manejado le cuesta la compra
al comprador.

**Independent Test**: con la red simulada, responder a la confirmación con cada `codigo`
documentado (y con uno desconocido y un corte de red) y verificar el mensaje, el estado del mapa
y la acción disponible en cada caso.

**Acceptance Scenarios**:

1. **Given** la F7, la F8 y la F9 seleccionadas, **When** la API responde
   `asientos-no-disponibles` con la F7, **Then** la F7 pasa a ocupada y sale de la selección, el
   mapa se vuelve a pedir y refleja el estado actual, la F8 y la F9 siguen seleccionadas si
   siguen libres, y el comprador lee un aviso del tipo "Alguien tomó la F7 antes que vos.
   Actualizamos el mapa; elegí otra."
2. **Given** un conflicto con más de una butaca, **When** llega `asientos-no-disponibles` con la
   F7 y la F8, **Then** el aviso nombra las dos.
3. **Given** una selección, **When** la API responde `funcion-no-disponible` o
   `funcion-no-encontrada`, **Then** el comprador ve que ya no se puede comprar esa función, la
   selección queda bloqueada y tiene un enlace a los horarios de hoy de esa película.
4. **Given** una selección, **When** la API responde `funcion-sin-cupo`, **Then** el comprador
   lee que la función tiene demasiadas butacas retenidas en este momento y que pruebe en unos
   minutos; su selección se conserva.
5. **Given** una selección, **When** la API responde `demasiados-pedidos` con `Retry-After: 30`,
   **Then** el botón de confirmar queda deshabilitado durante 30 segundos, el comprador ve cuánto
   falta y, al terminar la espera, puede volver a confirmar.
6. **Given** una selección, **When** la API responde `pedido-invalido` con mensajes para
   `asientos`, **Then** esos mensajes aparecen junto al resumen de la selección.
7. **Given** una selección, **When** la API responde `asientos-inexistentes`, **Then** el mapa se
   vuelve a pedir, las butacas que ya no existen salen de la selección y el comprador recibe un
   aviso.
8. **Given** una selección, **When** la API responde con un `codigo` desconocido, sin `codigo`,
   o la red falla, **Then** el comprador ve un error claro con una acción para reintentar y su
   selección se conserva.

---

### User Story 3 - Usar el mapa con teclado, lector de pantalla o teléfono chico (Priority: P3)

Una persona que navega solo con teclado o con lector de pantalla, o desde un teléfono de 360 px,
puede recorrer la sala, saber qué butaca tiene enfocada y en qué estado está, elegir y quitar
butacas y confirmar, igual que con el mouse.

**Why this priority**: la mayoría de las compras de entradas se hacen desde el teléfono, y un
mapa inaccesible deja afuera a quien depende del teclado o del lector de pantalla
(Principio VI). Va después de P1 y P2 porque construye sobre el mismo mapa, pero es requisito
para salir a producción.

**Independent Test**: recorrer el flujo completo de P1 solo con teclado y con un lector de
pantalla, y abrir el mapa de la sala más grande sembrada en un ancho de 360 px.

**Acceptance Scenarios**:

1. **Given** el foco antes del mapa, **When** el comprador presiona Tab, **Then** entra al mapa
   en una sola parada y, con las flechas, se mueve entre butacas vecinas de la misma fila y entre
   filas, sin tener que pasar con Tab por cada butaca.
2. **Given** el foco en una butaca, **When** el lector de pantalla la anuncia, **Then** dice la
   fila, el número y el estado, por ejemplo "Fila F, butaca 7, libre".
3. **Given** el foco en una butaca libre, **When** el comprador presiona Enter o Espacio,
   **Then** queda seleccionada y el cambio se anuncia; si la vuelve a activar, se deselecciona.
4. **Given** cualquier cambio de cantidad, total o error, **When** ocurre, **Then** se anuncia a
   tecnologías de asistencia sin mover el foco ni interrumpir lo que se está leyendo.
5. **Given** un teléfono de 360 px de ancho y la sala más ancha disponible, **When** se abre el
   mapa, **Then** la página no tiene scroll horizontal, cada butaca mide al menos 24 × 24 px y,
   si la sala no entra, las butacas se desplazan dentro del área del mapa mientras las letras de
   fila quedan fijas a los costados.

---

### Edge Cases

- **La función no existe** al abrir la página (el mapa responde 404 o el id no es un GUID
  válido): la página responde con un 404 real, igual que una ficha inexistente.
- **La función ya comenzó** al abrir la página (el mapa responde 410): se informa que esa
  función ya empezó y se ofrece volver a la cartelera, sin mostrar mapa.
- **El mapa no se puede cargar** por un error del servidor o de red: error genérico con acción
  para reintentar.
- **No quedan butacas libres**: el mapa se muestra entero, el comprador ve que la función está
  completa y tiene un enlace a los horarios de la película.
- **Quedan menos butacas libres que las que el comprador quiere**: puede elegir las que hay; el
  máximo efectivo es el menor entre 10 y las libres.
- **Filas de distinto largo**: cada fila muestra sus butacas numeradas de 1 a N, alineadas
  respecto del centro de la pantalla.
- **El refresco automático tras un conflicto falla**: las butacas reportadas quedan marcadas como
  ocupadas igual, y se ofrece reintentar el refresco.
- **El navegador no permite guardar datos de la pestaña** (modo privado restringido o
  almacenamiento bloqueado): se detecta antes de confirmar y se avisa, para no crear un carrito
  cuya credencial se perdería.
- **`Retry-After` ausente o inválido** en `demasiados-pedidos`: se usa una espera de 60 segundos.
- **El comprador recarga la página** con butacas seleccionadas sin confirmar: la selección se
  pierde y el mapa muestra la disponibilidad actual. Esto es esperado; nada se retuvo todavía.
- **Alguien abre `/carritos/{carritoId}` sin la credencial en su pestaña** (enlace compartido,
  otra pestaña): ve que no hay un carrito activo y un enlace a la cartelera.
- **El comprador ya tiene un carrito guardado en la pestaña** y vuelve al mapa para confirmar
  otra selección: al confirmar, primero se libera el carrito anterior con su credencial y
  después se crea el nuevo (FR-032). Hasta ese momento, sus propias butacas retenidas se ven
  como ocupadas. Si la liberación falla (red, credencial vencida, carrito ya expirado), se
  descarta igual la credencial anterior y se sigue con la creación.
- **El reloj del dispositivo está corrido**: la espera de `Retry-After` se cuenta como duración
  desde que llegó la respuesta, no contra la hora del dispositivo.

## Requirements *(mandatory)*

### Functional Requirements

**Página y cabecera**

- **FR-001**: La dirección `/funciones/{funcionId}`, a la que enlaza cada horario de la ficha de
  película, DEBE mostrar el mapa de butacas de esa función en lugar del 404 actual.
- **FR-002**: La página DEBE mostrar, con los datos del mapa de la función: título de la
  película, sucursal, sala, fecha y hora de inicio (en la zona horaria y el formato que ya usa
  el sitio) y precio por entrada con su moneda.
- **FR-003**: La página DEBE tener un único título principal y un enlace de vuelta a la ficha de
  la película.
- **FR-004**: La disponibilidad de butacas NO DEBE guardarse en ninguna caché; cada carga de la
  página DEBE pedirla de nuevo a la API.
- **FR-005**: La página DEBE marcarse como no indexable y NO DEBE aparecer en el sitemap.
- **FR-006**: Si la función no existe o el id no es válido, la página DEBE responder con un 404
  real. Si la función ya comenzó, DEBE informarlo y ofrecer volver a la cartelera.

**Mapa**

- **FR-007**: El mapa DEBE mostrar la pantalla arriba, rotulada "PANTALLA", y debajo las filas en
  el orden que indica la API, con la letra de fila a ambos lados.
- **FR-008**: Cada fila DEBE mostrar sus butacas numeradas de 1 a la cantidad de la fila. Una
  butaca DEBE figurar libre si su número está entre los disponibles de la fila, y ocupada en caso
  contrario.
- **FR-009**: Los estados libre, ocupada y seleccionada DEBEN distinguirse por algo más que el
  color: la seleccionada lleva una marca ✓, la ocupada una trama y aspecto deshabilitado, la
  libre solo contorno (DESIGN.md §7).
- **FR-010**: Cada butaca DEBE exponer a tecnologías de asistencia su fila, su número y su estado.
- **FR-011**: El mapa DEBE ser una sola parada de tabulación y permitir moverse entre butacas con
  las flechas; Enter o Espacio DEBEN elegir o quitar la butaca enfocada.
- **FR-012**: Cada butaca DEBE medir 32 × 32 px cuando la sala entra a lo ancho y achicarse para
  entrar cuando no, sin bajar nunca de 24 × 24 px de objetivo táctil.
- **FR-013**: Desde 360 px de ancho la página NO DEBE tener scroll horizontal. Si la sala no
  entra ni con butacas de 24 px, las butacas DEBEN desplazarse a lo ancho dentro del área del
  mapa, con las letras de fila fijas a ambos lados. Al moverse con el teclado, la butaca enfocada
  DEBE quedar a la vista. No hay controles de zoom.
- **FR-014**: La disponibilidad del mapa NO DEBE actualizarse en vivo. Solo se actualiza al
  recargar la página y, como única excepción, automáticamente después de un conflicto de
  butacas (FR-024) o de butacas inexistentes (FR-029).

**Selección y total**

- **FR-015**: El comprador DEBE poder elegir butacas libres y quitar butacas elegidas. Las
  ocupadas NO DEBEN poder elegirse.
- **FR-016**: La selección DEBE limitarse a 10 butacas. Al intentar superar el límite, el
  comprador DEBE recibir un aviso. El 10 es un valor de experiencia definido en un solo lugar; la
  respuesta de la API siempre prevalece (Principio IV).
- **FR-017**: La página DEBE mostrar la cantidad de butacas elegidas, cuáles son (por fila y
  número) y el total.
- **FR-018**: El total DEBE calcularse en centavos enteros a partir del texto del precio por
  entrada, sin aritmética de punto flotante, y mostrarse con su moneda en el mismo formato que el
  resto de los precios del sitio.
- **FR-019**: Los cambios de cantidad y total DEBEN anunciarse a tecnologías de asistencia de
  forma no intrusiva.

**Confirmación y credencial**

- **FR-020**: El botón principal DEBE decir "Confirmar N butacas" (con "butaca" en singular para
  una), estar deshabilitado sin selección y deshabilitarse mientras hay un pedido en curso.
- **FR-021**: Confirmar DEBE pedir a la API que cree el carrito con la selección completa, sin el
  desafío anti-bots.
- **FR-022**: Al crearse el carrito, la credencial y el id del carrito DEBEN guardarse con alcance
  de la pestaña, y el comprador DEBE pasar a `/carritos/{carritoId}`, un destino provisorio
  que confirme que el carrito quedó creado y muestre sus butacas. La pantalla definitiva del
  carrito (spec 004) reemplaza ese contenido en la misma dirección.
- **FR-033**: `/carritos/{carritoId}` DEBE buscar en la pestaña la credencial guardada para ese
  id. Si no la encuentra (otra pestaña, enlace compartido, sesión cerrada), DEBE avisar que no
  hay un carrito activo y ofrecer volver a la cartelera, sin consultar la API. La página DEBE
  ser no indexable y quedar fuera del sitemap; la exclusión de `/carritos/` en `robots.txt` ya
  existe.
- **FR-023**: La credencial del carrito NO DEBE aparecer en la URL, en registros, en mensajes de
  error ni en ningún dato enviado o renderizado por el servidor del sitio. Todo lo que la toca
  DEBE ejecutarse en el navegador, y el navegador DEBE llegar a la API por el proxy del mismo
  origen.
- **FR-032**: Si al confirmar ya hay un carrito guardado en la pestaña, primero se DEBE pedir a
  la API que lo abandone usando su credencial, y recién después crear el nuevo. Un fallo de esa
  liberación NO DEBE impedir la creación; en cualquier caso, la credencial anterior DEBE
  descartarse y reemplazarse por la nueva.

**Errores de la confirmación** (decididos por `codigo`, nunca por el texto del error)

- **FR-024**: `asientos-no-disponibles`: las butacas informadas DEBEN pasar a ocupadas y salir de
  la selección, el mapa DEBE volver a pedirse (y cualquier otra butaca seleccionada que ahora
  figure ocupada también sale de la selección) y el comprador DEBE ver un aviso que nombre las
  butacas perdidas, del tipo "Alguien tomó la F7 antes que vos. Actualizamos el mapa; elegí
  otra."
- **FR-025**: `funcion-no-disponible` y `funcion-no-encontrada`: el comprador DEBE ver que ya no
  se puede comprar esa función, la selección y la confirmación DEBEN bloquearse y DEBE haber un
  enlace a los horarios de hoy de la película.
- **FR-026**: `funcion-sin-cupo`: el comprador DEBE ver que la función tiene demasiadas butacas
  retenidas en este momento y que intente en unos minutos, conservando su selección.
- **FR-027**: `demasiados-pedidos`: la confirmación DEBE quedar deshabilitada durante los
  segundos que indica `Retry-After` (60 si falta o no es válido), mostrando cuánto falta.
- **FR-028**: `pedido-invalido`: los mensajes de `errors` DEBEN mostrarse junto al resumen de la
  selección; los que no correspondan a la selección se muestran como aviso general.
- **FR-029**: `asientos-inexistentes`: el mapa DEBE volver a pedirse, las butacas inexistentes
  DEBEN salir de la selección y el comprador DEBE recibir un aviso.
- **FR-030**: Un `codigo` desconocido, un error sin `codigo` o un fallo de red DEBEN mostrar un
  error genérico con acción para reintentar, conservando la selección.
- **FR-031**: Todos los avisos de error DEBEN decir qué pasó y qué hacer, en español rioplatense
  con voseo y sin humor (DESIGN.md §10), y DEBEN anunciarse a tecnologías de asistencia.

### Key Entities

- **Función**: una proyección concreta. Atributos que se muestran: película (id y título),
  sucursal, sala, hora de inicio con offset y precio por entrada.
- **Mapa de la sala**: filas en orden; cada fila tiene una letra, una cantidad de butacas
  (numeradas desde 1) y la lista de números libres. También trae el total de butacas y cuántas
  quedan libres.
- **Butaca**: identificada por fila (letra A–Z) y número. Su estado para el comprador es libre,
  ocupada (incluye retenida por otro carrito) o seleccionada.
- **Selección**: conjunto de 1 a 10 butacas libres que el comprador eligió y todavía no confirmó.
  Existe solo en la página; no persiste al recargar.
- **Carrito creado**: resultado de confirmar. Trae el carrito (id, estado, vencimiento, butacas
  retenidas, total) y una credencial que se entrega una sola vez y vence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador puede ir de tocar un horario en la ficha a tener dos butacas retenidas
  en menos de 60 segundos.
- **SC-002**: El 100 % de los horarios de la ficha llevan a una página de función que funciona;
  ninguno termina en 404 mientras la función exista.
- **SC-003**: Cada uno de los 6 códigos de error de la confirmación, más el caso desconocido y el
  fallo de red, tiene un comportamiento verificado por un test, y en ninguno el comprador queda
  frente a una pantalla rota o sin acción posible.
- **SC-004**: Para cualquier precio y cualquier cantidad entre 1 y 10, el total mostrado coincide
  al centavo con precio × cantidad.
- **SC-005**: La credencial del carrito aparece 0 veces en URLs, registros del navegador o del
  servidor y en el HTML que entrega el sitio, verificado durante el flujo completo.
- **SC-006**: El flujo completo (elegir, quitar, confirmar) se puede hacer solo con teclado y solo
  con lector de pantalla, y una revisión automática de accesibilidad reporta 0 violaciones en la
  página.
- **SC-007**: En un ancho de 360 px, con la sala más ancha sembrada (filas de 14 butacas), la
  página no tiene scroll horizontal, ninguna butaca mide menos de 24 × 24 px y las letras de fila
  siguen visibles mientras se desplazan las butacas.
- **SC-008**: Tras un conflicto de butacas, el comprador ve el mapa actualizado y el aviso con las
  butacas perdidas sin tener que recargar la página.

## Assumptions

- La pantalla real del carrito (cuenta regresiva, cambiar butacas, email, abandono desde el
  carrito) es la spec 004. De esa spec, esta solo adelanta el abandono del carrito anterior al
  confirmar una selección nueva (FR-032). El id del carrito en la URL no es una credencial: sin
  el token, la API no da acceso. Esta spec solo deja un destino provisorio, fuera del índice, que confirma que el carrito
  se creó leyendo los datos guardados en la pestaña.
- El anti-bots (`desafio`) es opcional en la API y queda fuera de alcance. Si el backend empieza
  a exigirlo, `desafio-rechazado` se trata como error genérico hasta que una spec lo cubra.
- El máximo de 10 butacas y el tope de cupo por función son valores del backend; el frontend
  anticipa solo el máximo de 10 como ayuda de experiencia.
- La zona horaria y el formato de fecha, hora y precio son los que ya usa el sitio (Argentina,
  pesos con `Intl`).
- "Volver a los horarios" significa ir a la sección "Horarios de hoy" de la ficha de la
  película, usando el id de película que trae el mapa. Cuando el mapa no se pudo cargar (función
  inexistente o ya comenzada al abrir la página) no hay id de película, y se vuelve a la
  cartelera.
- La sala no informa pasillos ni butacas especiales; el mapa se dibuja como una grilla de filas
  con butacas consecutivas.
- `robots.txt` ya excluye `/funciones/` y el proxy del mismo origen ya existe; no hace falta
  crearlos.
- El desarrollo se hace contra el backend local (`cinema-system-randomplay-backend`, con
  funciones sembradas para hoy de Interstellar, Dune y Relatos salvajes) y los tests simulan la
  red. El modo de datos de prueba de la spec 002 no se extiende a asientos ni carritos.
- En el flujo privado la personalidad de marca baja al mínimo (dial 1/1/1, DESIGN.md §11): un
  solo botón rojo por vista, sin animaciones más allá de hover, foco y presión.
