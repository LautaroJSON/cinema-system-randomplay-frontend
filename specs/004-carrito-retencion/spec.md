# Feature Specification: Carrito con retención corta

**Feature Branch**: `004-carrito-retencion`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Carrito con retención corta: la pantalla a la que llega el comprador después de confirmar butacas en la spec 003. Ahí ve su reserva temporal, puede cambiarla, carga el email de entrega o la abandona. Resumen con película, sucursal, sala, hora, butacas, precio unitario, total y estado; cuenta regresiva desde `venceEn` en el contador dorado de DESIGN.md §7, que en los últimos 2 minutos pasa a `--telon-ink` y al llegar a cero trata el carrito como expirado, con avisos puntuales a lector de pantalla; cambiar la selección volviendo al mapa con la selección completa y sin extender el vencimiento; email de entrega con validación y errores junto al campo; abandono que libera las butacas al instante y, cuando el navegador lo permita, al cerrar la pestaña; carritos Abandonado o Expirado en modo lectura con opción de empezar de nuevo; el flujo termina con el email cargado y un mensaje claro de lo que sigue, sin simular pago. Cada `codigo` tiene su manejo. El token se lee de sessionStorage, viaja solo como Authorization: Bearer a los endpoints de ese carrito y nunca aparece en URL, logs, analítica ni errores. La pantalla no se cachea, lleva noindex y queda fuera del sitemap. Dial 1/1/1; la cinta de peligro se reserva para el carrito expirado o sin conexión."

## Clarifications

### Session 2026-11-01

- Q: Cerrar la pestaña y recargarla son indistinguibles para el navegador. ¿Qué pasa con un
  carrito activo en ese momento? → A: No se intenta abandonar. Una recarga nunca pierde el
  carrito; si se cierra la pestaña, las butacas se liberan solas al vencer. La salida explícita
  es "Abandonar carrito".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la reserva y cuánto tiempo queda (Priority: P1)

Después de confirmar sus butacas, el comprador llega a la pantalla del carrito. Ve qué tiene
retenido (película, sucursal, sala, fecha y hora, cada butaca, precio por entrada y total), en
qué estado está el carrito y cuánto tiempo le queda, en un contador `09:42` que baja segundo a
segundo. Cuando faltan 2 minutos el contador cambia de color y se le avisa una sola vez. Al
llegar a cero, el carrito pasa a vencido: las butacas ya no son suyas y se le ofrece empezar de
nuevo.

**Why this priority**: sin esta pantalla, la confirmación de la spec 003 termina en un destino
provisorio y el comprador no sabe que tiene un tiempo límite. La cuenta regresiva es la única
forma de que entienda que la reserva es temporal.

**Independent Test**: con el backend local, crear un carrito desde el mapa, comprobar que la
pantalla muestra los datos que devuelve la API para ese carrito y que el contador coincide con
`venceEn`; con el reloj simulado en los tests, avanzar hasta los 2 minutos y hasta cero y
verificar el cambio de color, los dos avisos y el paso a vencido.

**Acceptance Scenarios**:

1. **Given** un carrito activo guardado en la pestaña, **When** el comprador abre
   `/carritos/{carritoId}`, **Then** ve el título de la película, la sucursal, la sala, la
   fecha y la hora de inicio (con el formato y la zona horaria del sitio), cada butaca por fila
   y número, el precio por entrada y el total con su moneda, y el estado "Activo" con una
   etiqueta legible.
2. **Given** un carrito activo cuyo vencimiento está a 9 minutos y 42 segundos, **When** se
   muestra la pantalla, **Then** el contador dice `09:42` en dorado y baja un segundo por
   segundo.
3. **Given** el contador por encima de 2 minutos, **When** llega a `02:00`, **Then** pasa a
   rojo legible, sin parpadear, y un lector de pantalla anuncia una vez que quedan 2 minutos
   para que se liberen las butacas.
4. **Given** el contador corriendo, **When** pasan los segundos, **Then** el lector de
   pantalla no anuncia cada cambio; quien quiera saber el tiempo exacto lo puede leer en el
   contador.
5. **Given** un carrito activo, **When** el contador llega a `00:00`, **Then** el carrito se
   muestra como vencido en modo lectura, aparece la cinta de peligro, se anuncia una vez que
   las butacas se liberaron y hay un enlace para elegir otra función de esa película.
6. **Given** la pestaña en segundo plano durante un minuto, **When** el comprador vuelve a
   ella, **Then** el contador muestra el tiempo real que queda, no el que tenía al irse.
7. **Given** un carrito que la API ya informa como `Abandonado` o `Expirado`, **When** se abre
   la pantalla, **Then** se muestra en modo lectura con su estado, sin acciones de cambio, y
   con la opción de empezar de nuevo desde los horarios.

---

### User Story 2 - Cargar el email y saber qué sigue (Priority: P1)

Con el carrito activo, el comprador escribe el email al que se mandarían las entradas y lo
guarda. Si el formato está mal, lo ve junto al campo antes de enviar. Si la API lo rechaza, el
mensaje de la API aparece en el mismo lugar. Cuando el email queda guardado, la pantalla le dice
con claridad qué pasa ahora: el pago todavía no existe, así que no se emiten entradas, y sus
butacas siguen retenidas hasta que venza el contador.

**Why this priority**: es el último paso que la API permite. Sin él, el flujo del comprador no
tiene final. Comparte prioridad con la Historia 1 porque los dos juntos forman el carrito mínimo.

**Independent Test**: en un carrito activo, enviar un email mal formado, uno que la API rechace
con `pedido-invalido` y uno válido; comprobar el mensaje junto al campo en los dos primeros y,
en el tercero, que la API devuelve el carrito con ese email y que la pantalla muestra el
mensaje final.

**Acceptance Scenarios**:

1. **Given** un carrito activo sin email, **When** el comprador mira la pantalla, **Then** ve un
   campo de email con su etiqueta visible y un botón para guardarlo.
2. **Given** el campo vacío o con un texto sin forma de email, **When** el comprador intenta
   guardar, **Then** no se envía nada y ve junto al campo qué tiene que corregir, con el foco
   en el campo.
3. **Given** un email con forma válida, **When** la API responde `pedido-invalido` con
   mensajes para `email`, **Then** esos mensajes aparecen junto al campo y el texto escrito se
   conserva.
4. **Given** un email válido, **When** la API lo acepta, **Then** la pantalla muestra el email
   guardado y un mensaje que dice que el pago todavía no está disponible, que no se envían
   entradas y que las butacas se liberan cuando termine el contador.
5. **Given** un carrito activo con email guardado, **When** el comprador quiere cambiarlo,
   **Then** puede editarlo y guardarlo de nuevo mientras el carrito siga activo.
6. **Given** un pedido de guardado en curso, **When** el comprador vuelve a tocar el botón,
   **Then** no se envía un segundo pedido.

---

### User Story 3 - Cambiar las butacas sin perder el lugar (Priority: P2)

Desde el carrito, el comprador decide cambiar butacas. Vuelve al mapa de la misma función, ve
sus butacas actuales marcadas como seleccionadas y el contador todavía corriendo, agrega o quita
butacas y confirma. La selección nueva reemplaza a la anterior y vuelve al carrito con el mismo
vencimiento que tenía.

**Why this priority**: elegir mal una butaca es común y rehacer el carrito desde cero cuesta un
intento de creación limitado por IP y arriesga perder las butacas que sí quería. Va después de
P1 porque el carrito ya sirve sin esta opción.

**Independent Test**: en un carrito con F7 y F8, entrar a cambiar, quitar la F8, agregar la F9 y
confirmar; comprobar que la API recibió exactamente F7 y F9, que el carrito muestra esas dos
butacas y que el vencimiento no cambió.

**Acceptance Scenarios**:

1. **Given** un carrito activo con F7 y F8, **When** el comprador elige "Cambiar butacas",
   **Then** llega al mapa de esa función con F7 y F8 seleccionadas como propias (no como
   ocupadas), y ve el contador con el mismo tiempo que en el carrito.
2. **Given** el mapa en modo cambio, **When** el comprador quita la F8, agrega la F9 y
   confirma, **Then** se envía la selección completa F7 y F9, nunca solo la diferencia, y
   vuelve al carrito con esas butacas, el total recalculado por la API y el mismo vencimiento.
3. **Given** el mapa en modo cambio, **When** el comprador vuelve al carrito sin confirmar,
   **Then** el carrito sigue con F7 y F8 y no se envió ningún pedido.
4. **Given** el mapa en modo cambio, **When** el comprador quita todas sus butacas, **Then** no
   puede confirmar una selección vacía y se le indica que, si no quiere ninguna, puede
   abandonar el carrito.
5. **Given** el mapa en modo cambio, **When** la API responde `asientos-no-disponibles` con la
   F9, **Then** el mapa se actualiza, la F9 sale de la selección, F7 sigue seleccionada y el
   comprador lee que alguien tomó la F9 antes que él; el carrito sigue como estaba.
6. **Given** el mapa en modo cambio, **When** el contador llega a cero, **Then** el modo cambio
   se cierra y el comprador ve el carrito vencido en modo lectura.

---

### User Story 4 - Abandonar el carrito (Priority: P2)

El comprador decide no seguir. Toca "Abandonar carrito", confirma, y las butacas quedan libres
para otros en ese momento. El carrito se muestra como abandonado y puede empezar de nuevo.

**Why this priority**: liberar butacas que no se van a usar es lo que espera la sala y lo que
pide la constitución (Principio III). Va en P2 porque, si no se abandona, el carrito vence solo.

**Independent Test**: abandonar un carrito activo y comprobar que la API lo informa como
`Abandonado`, que el mapa de la función muestra esas butacas libres y que la credencial ya no
está guardada en la pestaña.

**Acceptance Scenarios**:

1. **Given** un carrito activo, **When** el comprador toca "Abandonar carrito", **Then** se le
   pide confirmar indicando que sus butacas se liberan en ese momento.
2. **Given** la confirmación del abandono, **When** la API responde con el carrito abandonado,
   **Then** la pantalla pasa a modo lectura con el estado "Abandonado", la credencial se
   descarta y hay un enlace para empezar de nuevo desde los horarios.
3. **Given** la confirmación del abandono, **When** la red falla, **Then** el comprador ve que
   no se pudo abandonar, el carrito sigue activo y puede reintentar.
4. **Given** un carrito activo, **When** el comprador cierra la pestaña, la recarga o sale del
   sitio, **Then** no se pide el abandono: al recargar el carrito sigue intacto y, si cerró la
   pestaña, las butacas se liberan cuando vence la retención.

---

### User Story 5 - Recuperarse de errores y de una credencial perdida (Priority: P3)

La API rechaza una operación del carrito: la credencial venció o no corresponde, el carrito ya
no está activo, la función empezó, otra persona tomó una butaca o la red se cortó. En cada caso
el comprador entiende qué pasó y qué puede hacer, y nunca queda frente a una pantalla rota.

**Why this priority**: con una retención de pocos minutos, que el carrito venza o que la
credencial deje de servir es parte del uso normal. Va en P3 porque construye sobre las
operaciones de P1 y P2.

**Independent Test**: con la red simulada, responder a cada operación del carrito con cada
`codigo` que puede devolver, con un `401`, con un código desconocido y con un corte de red, y
verificar el mensaje, el estado de la credencial y la acción disponible en cada caso.

**Acceptance Scenarios**:

1. **Given** cualquier operación del carrito, **When** la API responde `401` o
   `carrito-no-encontrado`, **Then** la credencial se descarta de la pestaña y el comprador ve
   que no se pudo recuperar el carrito, con un enlace para empezar de nuevo.
2. **Given** un cambio de butacas, de email o un abandono, **When** la API responde
   `carrito-no-activo` con `estadoActual` `Expirado`, **Then** el comprador ve que el carrito
   venció, el carrito pasa a modo lectura y se le ofrece empezar uno nuevo.
3. **Given** un abandono, **When** la API responde `carrito-no-activo`, **Then** el carrito se
   muestra en modo lectura con el estado que informa la API, sin mostrarlo como error.
4. **Given** un cambio de butacas, **When** la API responde `funcion-no-disponible` o
   `funcion-no-encontrada`, **Then** el comprador ve que esa función ya no se puede comprar,
   el cambio se bloquea y tiene un enlace a la cartelera.
5. **Given** un cambio de butacas, **When** la API responde `pedido-invalido`,
   `asientos-inexistentes` o `funcion-sin-cupo`, **Then** se maneja igual que en la
   confirmación de la spec 003 (mensajes junto a la selección, mapa actualizado, o aviso de
   intentar en unos minutos conservando la selección).
6. **Given** cualquier operación, **When** la API responde con un `codigo` desconocido, sin
   `codigo`, o la red falla, **Then** el comprador ve un error claro con una acción para
   reintentar, la credencial se conserva y lo que había escrito o elegido no se pierde.
7. **Given** una operación que falla por falta de conexión, **When** se muestra el error,
   **Then** aparece la cinta de peligro junto al aviso de que no hay conexión, y desaparece
   cuando una operación vuelve a responder.
8. **Given** una pestaña sin credencial para ese carrito (otra pestaña, enlace compartido,
   pestaña cerrada y vuelta a abrir), **When** se abre `/carritos/{carritoId}`, **Then** el
   comprador ve que no hay un carrito activo en esa pestaña y un enlace a la cartelera, y no se
   consulta la API.

---

### Edge Cases

- **Credencial de otro carrito en la pestaña**: si la pestaña guarda la credencial de un
  carrito distinto del que dice la dirección, se trata como si no hubiera credencial. La
  credencial nunca se envía a un carrito que no es el suyo.
- **Reloj del dispositivo corrido**: la cuenta regresiva NO DEBE depender de que el reloj del
  dispositivo esté en hora. Se calcula como duración a partir de `venceEn` y de la hora del
  servidor que informa la última respuesta; si la respuesta no la informa, se usa el reloj del
  dispositivo.
- **`venceEn` ya pasado al abrir la pantalla** (por ejemplo, la pestaña estuvo suspendida): el
  carrito se muestra vencido de entrada, aunque la API todavía diga `Activo`.
- **La API dice `Activo` después de que el contador llegó a cero**: manda el contador; el
  carrito se trata como vencido y no se ofrecen acciones de cambio (Principio IV).
- **Cambio de butacas en curso cuando el contador llega a cero**: el resultado que devuelva la
  API se respeta; si confirma el cambio pero el contador ya está en cero, el carrito se muestra
  vencido igual.
- **Pestaña duplicada**: duplicar una pestaña copia lo guardado en ella, así que dos pestañas
  pueden controlar el mismo carrito. Cada una refleja lo que responde la API en sus propias
  operaciones; si una abandona, la otra se entera en su próxima operación o al volver a
  mostrarse (por `carrito-no-activo`).
- **Volver a la pantalla después de abandonarlo o de que venza, y recargar**: el resumen en modo
  lectura se sigue viendo con los últimos datos recibidos, sin credencial.
- **Volver al mapa con "atrás" del navegador**: la página de la función de la spec 003 sigue
  funcionando como siempre; si el comprador confirma ahí una selección nueva, se aplica el
  abandono del carrito anterior que define esa spec (FR-032 de la 003).
- **Salir por la navegación del sitio** (logo, cartelera) con el carrito activo: no se abandona;
  el carrito sigue retenido hasta que venza y el comprador puede volver mientras tanto.
- **Email con espacios al principio o al final**: se recortan antes de validar y enviar.
- **Email ya guardado igual al escrito**: guardar de nuevo no es un error.
- **Almacenamiento de la pestaña bloqueado** al llegar al carrito: equivale a no tener
  credencial (Historia 5, escenario 8).

## Requirements *(mandatory)*

### Functional Requirements

**Pantalla y credencial**

- **FR-001**: La dirección `/carritos/{carritoId}`, a la que llega el comprador al confirmar
  butacas en la spec 003, DEBE mostrar la pantalla del carrito en lugar del destino provisorio.
  La dirección lleva solo el id del carrito, que no es una credencial.
- **FR-002**: La pantalla DEBE leer la credencial del carrito desde el almacenamiento de la
  pestaña y usarla solo si corresponde al id de la dirección. Sin credencial válida para ese id,
  DEBE avisar que no hay un carrito activo en esa pestaña, ofrecer volver a la cartelera y NO
  DEBE consultar la API.
- **FR-003**: La credencial DEBE enviarse solo como `Authorization: Bearer` y solo a las
  operaciones de ese carrito (consulta, cambio de butacas, email y abandono).
- **FR-004**: La credencial NO DEBE aparecer en la URL, en registros del navegador o del
  servidor, en herramientas de analítica o reporte de errores, en mensajes de error ni en
  ningún dato enviado o renderizado por el servidor del sitio. Todo lo que la toca DEBE
  ejecutarse en el navegador y llegar a la API por el proxy del mismo origen.
- **FR-005**: La credencial DEBE descartarse de la pestaña ante `401`, ante
  `carrito-no-encontrado` y cuando el carrito queda `Abandonado` o `Expirado` (por respuesta de
  la API o porque el contador llegó a cero).
- **FR-006**: La pantalla NO DEBE guardarse en ninguna caché, DEBE marcarse como no indexable y
  NO DEBE aparecer en el sitemap.
- **FR-007**: Al abrir la pantalla con credencial válida, DEBE pedirse el carrito a la API y
  mostrar lo que devuelve. Mientras llega la respuesta, se muestra un estado de carga sin datos
  inventados.

**Resumen y estado**

- **FR-008**: La pantalla DEBE mostrar título de la película, sucursal, sala, fecha y hora de
  inicio (formato y zona horaria del sitio), cada butaca por fila y número, precio por entrada,
  total y estado del carrito.
- **FR-009**: El precio por entrada y el total DEBEN mostrarse tal como los devuelve la API, con
  su moneda y en el formato de precios del sitio. La pantalla NO DEBE recalcular el total.
- **FR-010**: El estado del carrito DEBE mostrarse con una etiqueta legible definida en un solo
  lugar para `Activo`, `Abandonado` y `Expirado`, con un manejo explícito para un valor
  desconocido, que se trata como no modificable.
- **FR-011**: Solo un carrito activo con tiempo restante DEBE ofrecer cambiar butacas, editar el
  email y abandonar. Un carrito `Abandonado`, `Expirado` o con el contador en cero DEBE
  mostrarse en modo lectura con un enlace para empezar de nuevo desde los horarios de esa
  película.

**Cuenta regresiva**

- **FR-012**: La pantalla DEBE mostrar el tiempo restante hasta `venceEn` en minutos y segundos
  (`09:42`), con el estilo de contador dorado de DESIGN.md §7, actualizado cada segundo.
- **FR-013**: Cuando quedan 2 minutos o menos, el contador DEBE pasar a `--telon-ink`, sin
  parpadeo ni animación. Los 2 minutos son un valor de experiencia definido en un solo lugar.
- **FR-014**: Al llegar a cero, el carrito DEBE tratarse como vencido en la interfaz, aunque la
  API todavía no lo haya informado, y la pantalla DEBE pasar a modo lectura.
- **FR-015**: El contador DEBE reflejar el tiempo real restante después de que la pestaña estuvo
  en segundo plano, suspendida o sin conexión.
- **FR-016**: El contador DEBE calcularse a partir de `venceEn` y de la hora del servidor
  informada en la última respuesta de la API, para no depender del reloj del dispositivo. Sin
  esa hora, se usa el reloj del dispositivo.
- **FR-017**: A tecnologías de asistencia se DEBEN anunciar solo dos momentos, de forma no
  intrusiva: cuando quedan 2 minutos y cuando el carrito vence. El contador NO DEBE anunciarse
  segundo a segundo, pero su valor DEBE poder leerse en cualquier momento con un texto
  completo ("Quedan 4 minutos y 12 segundos").
- **FR-018**: Cambiar butacas o el email NO DEBE reiniciar ni extender la cuenta regresiva; el
  contador sigue el `venceEn` que devuelve la API en cada respuesta.

**Cambio de butacas**

- **FR-019**: Un carrito activo DEBE ofrecer "Cambiar butacas", que lleva al mapa de la misma
  función en modo cambio, en `/carritos/{carritoId}/butacas`. Esa dirección lleva solo el id
  del carrito y cumple FR-002 a FR-006.
- **FR-020**: En modo cambio, las butacas del carrito DEBEN mostrarse como seleccionadas y
  propias, aunque la disponibilidad de la función las informe como ocupadas. El resto del mapa
  se comporta como en la spec 003 (estados, teclado, lector de pantalla, 360 px, máximo de 10).
- **FR-021**: El modo cambio DEBE mostrar el mismo contador que el carrito, con las mismas
  reglas (FR-012 a FR-018), y un enlace para volver al carrito sin cambios.
- **FR-022**: Confirmar el cambio DEBE enviar la selección completa resultante, nunca
  diferencias, y al responder la API DEBE volver al carrito con los datos que devolvió.
- **FR-023**: Una selección vacía NO DEBE poder confirmarse; se DEBE indicar que, para no
  quedarse con ninguna butaca, se abandona el carrito.
- **FR-024**: El botón de confirmar el cambio DEBE deshabilitarse mientras hay un pedido en
  curso y cuando la selección es igual a la del carrito.

**Email de entrega**

- **FR-025**: Un carrito activo DEBE ofrecer un campo de email con etiqueta visible, precargado
  con el email guardado si existe, y un botón para guardarlo.
- **FR-026**: Antes de enviar, el email DEBE recortarse y validarse con un formato básico
  (texto, una arroba, dominio). La validación es de experiencia: la respuesta de la API siempre
  prevalece. Un error de formato DEBE mostrarse junto al campo y llevar el foco al campo.
- **FR-027**: Los mensajes de `errors` de `pedido-invalido` para el email DEBEN mostrarse junto
  al campo, conservando lo escrito; los que no correspondan al campo se muestran como aviso
  general.
- **FR-028**: Con el email guardado, la pantalla DEBE mostrar el email y un mensaje que diga qué
  sigue: el pago todavía no está disponible, no se emiten ni envían entradas y las butacas
  siguen retenidas hasta que termine el contador. Ninguna pantalla DEBE simular un pago, un
  número de orden ni una confirmación de compra.
- **FR-029**: El email DEBE poder cambiarse mientras el carrito esté activo.

**Abandono**

- **FR-030**: Un carrito activo DEBE ofrecer "Abandonar carrito", que pide confirmación
  explicando que las butacas se liberan en ese momento.
- **FR-031**: Al confirmar, se DEBE pedir el abandono a la API. Con la respuesta, la pantalla
  pasa a modo lectura con el estado devuelto y la credencial se descarta (FR-005).
- **FR-032**: Si el abandono falla por red o por un código desconocido, el carrito DEBE seguir
  activo en la pantalla, la credencial se conserva y el comprador puede reintentar.
- **FR-033**: Cerrar, recargar o abandonar la página NO DEBE pedir el abandono del carrito ni
  mostrar avisos del navegador antes de salir. La única forma de abandonar es "Abandonar
  carrito" (FR-030).

**Errores** (decididos por `codigo`, nunca por el texto del error)

- **FR-034**: `401` y `carrito-no-encontrado`, en cualquier operación: descartar la credencial y
  mostrar que no se pudo recuperar el carrito, con un enlace para empezar de nuevo desde los
  horarios de la película (o la cartelera si no se conoce la película).
- **FR-035**: `carrito-no-activo`: mostrar el carrito en modo lectura con el `estadoActual`
  informado, avisar que ya no se puede modificar y ofrecer empezar un carrito nuevo. En el
  abandono, se muestra como resultado y no como error.
- **FR-036**: `asientos-no-disponibles` y `asientos-inexistentes` en el cambio de butacas: se
  manejan como en la spec 003 (butacas afuera de la selección, mapa actualizado, aviso que las
  nombra). El carrito queda como estaba.
- **FR-037**: `pedido-invalido` en el cambio de butacas: mensajes junto al resumen de la
  selección, como en la spec 003.
- **FR-038**: `funcion-sin-cupo` en el cambio de butacas: avisar que la función tiene demasiadas
  butacas retenidas en este momento y que intente en unos minutos, conservando la selección.
- **FR-039**: `funcion-no-disponible` y `funcion-no-encontrada` en el cambio de butacas: avisar
  que esa función ya no se puede comprar, bloquear el cambio y ofrecer volver a la cartelera.
- **FR-040**: Un `codigo` desconocido, un error sin `codigo` o un fallo de red, en cualquier
  operación: error genérico con acción para reintentar, conservando la credencial, lo escrito y
  lo elegido.
- **FR-041**: La cinta de peligro de DESIGN.md §6.5 DEBE aparecer solo cuando el carrito está
  vencido o cuando una operación falló por falta de conexión. No se usa para ningún otro error
  ni estado.
- **FR-042**: Todos los avisos DEBEN decir qué pasó y qué hacer, en español rioplatense con
  voseo y sin humor (DESIGN.md §10), y DEBEN anunciarse a tecnologías de asistencia sin mover
  el foco.

**Accesibilidad y diseño**

- **FR-043**: La pantalla DEBE tener un único título principal, funcionar completa con teclado
  y lector de pantalla y no tener scroll horizontal desde 360 px de ancho.
- **FR-044**: El flujo privado usa el dial 1/1/1 (DESIGN.md §11): una sola columna, un solo
  botón rojo por vista (la acción principal del momento), y movimiento solo en hover, foco y
  presión.
- **FR-045**: Al pasar a modo lectura (vencido, abandonado o sin credencial), el foco NO DEBE
  quedar en un control que desapareció; DEBE ir a un lugar con sentido, como el aviso o el
  título.

### Key Entities

- **Carrito**: reserva temporal del comprador anónimo. Atributos que se muestran: id, estado
  (`Activo`, `Abandonado`, `Expirado`), vencimiento, butacas retenidas, función, precio por
  entrada, total y email de entrega (vacío hasta que se indica).
- **Función del carrito**: película (id y título), sucursal, sala y hora de inicio. Sirve para
  el resumen y para volver a los horarios de esa película.
- **Credencial del carrito**: token que la API entrega una sola vez al crear el carrito (spec
  003) y que vence. Vive solo en la pestaña junto con el id del carrito; se descarta al dejar de
  servir.
- **Cuenta regresiva**: tiempo restante hasta el vencimiento, derivado de `venceEn`. Tiene tres
  tramos: normal, últimos 2 minutos y vencido.
- **Selección en cambio**: conjunto completo de 1 a 10 butacas que reemplaza al del carrito.
  Arranca con las butacas del carrito y existe solo mientras dura el modo cambio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un comprador que llega desde el mapa puede guardar su email en menos de 60
  segundos.
- **SC-002**: El contador difiere del vencimiento real en 1 segundo o menos, incluso después de
  dejar la pestaña 5 minutos en segundo plano y con el reloj del dispositivo corrido.
- **SC-003**: Durante una retención completa, un lector de pantalla recibe exactamente 2 avisos
  sobre el tiempo (a los 2 minutos y al vencer).
- **SC-004**: Después de cambiar butacas, el vencimiento del carrito es el mismo que antes del
  cambio en el 100 % de los casos, y lo enviado a la API es siempre la selección completa.
- **SC-005**: Cada `codigo` que pueden devolver las operaciones del carrito, más el `401`, el
  código desconocido y el fallo de red, tiene un comportamiento verificado por un test, y en
  ninguno el comprador queda frente a una pantalla rota o sin acción posible.
- **SC-006**: La credencial aparece 0 veces en URLs, registros del navegador o del servidor y en
  el HTML que entrega el sitio durante el flujo completo, y queda descartada de la pestaña en el
  100 % de los casos de `401`, `carrito-no-encontrado`, abandono y vencimiento.
- **SC-007**: Al abandonar, las butacas figuran libres en el mapa de la función en la siguiente
  carga, sin esperar al vencimiento.
- **SC-008**: El flujo completo (ver, cambiar butacas, guardar email, abandonar) se puede hacer
  solo con teclado y solo con lector de pantalla, y una revisión automática de accesibilidad
  reporta 0 violaciones en el carrito activo, en el vencido y en el modo cambio.
- **SC-009**: En ninguna pantalla del flujo aparece un paso de pago, un número de orden o un
  texto que dé la compra por hecha.

## Assumptions

- La dirección del carrito es `/carritos/{carritoId}`, la que fijó la spec 003 (FR-022 y FR-033
  de esa spec). El id del carrito no da acceso sin la credencial, así que puede ir en la URL. El
  aviso de "no hay un carrito activo en esta pestaña" de la 003 se mantiene.
- El modo cambio usa una dirección propia, `/carritos/{carritoId}/butacas`, y no la página de la
  función de la spec 003, porque ahí confirmar crea un carrito nuevo y abandona el anterior. Las
  dos comparten el mismo mapa.
- La única salida explícita del flujo es "Abandonar carrito". Navegar a otra parte del sitio no
  abandona; el carrito vence solo si no se vuelve.
- No intentar el abandono al cerrar la pestaña es una desviación consciente de un **DEBERÍA**
  del Principio III: el navegador no distingue cierre de recarga y perder el carrito al recargar
  le cuesta la compra al comprador, mientras que la retención vence sola en pocos minutos. Se
  documenta así en el PR.
- Tras guardar el email, el carrito queda activo hasta que vence, como describe `docs/api.md`
  ("el flujo termina con el carrito activo y el email indicado"). No se abandona solo.
- Al vencer o abandonarse, la pantalla conserva en la pestaña los últimos datos del carrito sin
  la credencial, para poder mostrar el modo lectura después de recargar. Esos datos no permiten
  operar sobre el carrito.
- La retención de 5 minutos y el máximo de 10 butacas los decide la API. La pantalla usa
  `venceEn` para el contador y no necesita conocer los 5 minutos; el máximo de 10 se reutiliza
  del valor de experiencia que ya definió la spec 003.
- "Empezar de nuevo desde los horarios" es ir a la sección "Horarios de hoy" de la ficha de la
  película del carrito. Si no se conoce la película (sin credencial ni datos guardados), se va a
  la cartelera.
- La API no tiene pago. Esta spec no agrega pantallas posteriores al email.
- `robots.txt` ya excluye `/carritos/`; el proxy del mismo origen y el guardado de la credencial
  ya existen desde la spec 003.
- El desarrollo se hace contra el backend local y los tests simulan la red y el reloj. Los tests
  cubren, como mínimo: la cuenta regresiva y el vencimiento, el guardado y descarte de la
  credencial, las transiciones de estado del carrito, la selección completa en el cambio de
  butacas y el manejo de cada `codigo` (Principio VII).
