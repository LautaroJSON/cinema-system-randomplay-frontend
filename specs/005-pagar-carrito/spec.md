# Feature Specification: Pagar el carrito

**Feature Branch**: `005-pagar-carrito`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Pagar el carrito (Mercado Pago, pasarela simulada en desarrollo). Que el comprador pague su carrito desde el sitio y vea sus entradas, para probar a mano front + back con la feature 008 del backend. En desarrollo el back usa una pasarela simulada; el front nunca maneja datos de tarjeta. Botón \"Pagar\" en el carrito activo con email; inicio del pago que pasa el carrito a Pagando y extiende el vencimiento un minuto; redirección a la página de pago de Mercado Pago o, en desarrollo, a una página propia de pago simulado con Aprobar / Rechazar / Pagar otro monto; página de vuelta que consulta el carrito cada 2 segundos mientras esté en Pagando y muestra las entradas al quedar Pagado; en Pagando no se cambian butacas ni email ni se abandona; cada `codigo` de error tiene su manejo; un carrito Pagado se muestra siempre como compra cerrada; el token nunca va en la URL ni en logs. Fuera de alcance: SDK o Brick de Mercado Pago, QR de las entradas, historial de compras y reembolsos pedidos por el comprador."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pagar y ver las entradas (Priority: P1)

Con el carrito activo y el email de entrega guardado, el comprador toca "Pagar". El carrito
pasa a "Pago en curso", el contador suma un minuto y el comprador va a la página de pago de
Mercado Pago. Cuando paga, Mercado Pago lo devuelve al sitio, a la página de vuelta del
carrito. Ahí ve "Estamos confirmando tu pago…" mientras el sitio espera la confirmación, y
después "¡Listo!" con sus entradas: el código de cada una en grande, la película, la sucursal,
la sala, la fecha y hora, la fila y el asiento y el precio. Se le avisa que las entradas también
le llegan por email.

**Why this priority**: es el objetivo de la feature. Sin esto el flujo del comprador termina en
un email cargado y ninguna entrada emitida.

**Independent Test**: con el backend local en modo simulado, crear un carrito, guardar el email,
tocar "Pagar", aprobar el pago desde la página de pago simulado (Historia 2) y comprobar que la
página de vuelta pasa de "confirmando" a "¡Listo!" con una entrada por butaca y los datos que
devuelve la API. Con la red simulada en los tests, cubrir el paso de Pagando a Pagado durante
la espera.

**Acceptance Scenarios**:

1. **Given** un carrito activo con email de entrega, **When** el comprador abre la pantalla del
   carrito, **Then** ve el botón "Pagar" habilitado.
2. **Given** un carrito activo sin email de entrega, **When** el comprador mira la pantalla,
   **Then** no ve la sección de pago; aparece recién cuando guarda el email.
3. **Given** un carrito activo con email, **When** toca "Pagar" y la API acepta, **Then** el
   estado pasa a "Pago en curso", el contador muestra el vencimiento nuevo que devolvió la API
   y el comprador va a la página de pago.
4. **Given** el pago iniciado con la pasarela real, **When** el sitio redirige, **Then** el
   comprador llega a la dirección de Mercado Pago que devolvió la API, en la misma pestaña.
5. **Given** el comprador volviendo de Mercado Pago a `/carritos/{carritoId}/pago` con el
   carrito todavía en Pagando, **When** carga la página, **Then** ve "Estamos confirmando tu
   pago…" y el sitio vuelve a consultar el carrito cada 2 segundos.
6. **Given** la página de vuelta esperando, **When** la API informa el carrito como Pagado,
   **Then** la espera termina y la página muestra "¡Listo!", una tarjeta por entrada con el
   código destacado, película, sucursal, sala, fecha y hora, fila y número de asiento y precio,
   y el aviso de que las entradas también llegan al email de entrega (mostrando ese email).
7. **Given** la página de vuelta esperando, **When** la API informa el carrito como Expirado,
   **Then** la espera termina y la página dice que el tiempo para pagar venció y que, si se
   cobró algo, se devuelve automáticamente, con la opción de elegir otra función.
8. **Given** el carrito Pagado, **When** cambia el estado en pantalla, **Then** un lector de
   pantalla anuncia una sola vez que el pago se confirmó (o, en el caso Expirado, que venció).

---

### User Story 2 - Pago simulado en desarrollo (Priority: P1)

En desarrollo no hay Mercado Pago. Cuando la API devuelve una dirección de pago simulada, el
sitio no la abre: lleva al comprador a una página propia, `/carritos/{carritoId}/pago-simulado`,
que solo existe en desarrollo. Ahí quien prueba elige el resultado: "Aprobar pago", "Rechazar
pago" o "Pagar otro monto". Cada opción registra ese pago en la pasarela simulada y lleva a la
página de vuelta, igual que haría Mercado Pago.

**Why this priority**: es la única forma de probar el flujo completo a mano en local, que es el
objetivo declarado de la feature. Comparte prioridad con la Historia 1 porque sin ella la
Historia 1 no se puede probar.

**Independent Test**: con el backend local en modo simulado, iniciar el pago y comprobar que el
sitio va a la página de pago simulado del carrito; probar cada uno de los tres botones y
verificar el estado resultante en la página de vuelta (Pagado, sigue en Pagando, sigue en
Pagando). Con el sitio en modo producción, comprobar que la página responde "no encontrada".

**Acceptance Scenarios**:

1. **Given** el pago iniciado y una dirección de pago simulada, **When** el sitio redirige,
   **Then** el comprador llega a `/carritos/{carritoId}/pago-simulado` y no a la dirección de
   la API.
2. **Given** la página de pago simulado, **When** se muestra, **Then** dice con claridad que es
   una simulación de desarrollo y que no se cobra nada, muestra el total del carrito y ofrece
   "Aprobar pago", "Rechazar pago" y "Pagar otro monto" con un campo para el monto.
3. **Given** la página de pago simulado, **When** se toca "Aprobar pago", **Then** se registra
   un pago aprobado por el total del carrito y el comprador va a la página de vuelta, que
   termina mostrando el carrito Pagado con sus entradas.
4. **Given** la página de pago simulado, **When** se toca "Rechazar pago", **Then** se registra
   un pago rechazado y el comprador va a la página de vuelta, donde el carrito sigue en Pagando
   y puede volver a la página de pago.
5. **Given** la página de pago simulado con un monto distinto del total en el campo, **When** se
   toca "Pagar otro monto", **Then** se registra un pago aprobado por ese monto y el comprador
   va a la página de vuelta, donde el carrito sigue en Pagando.
6. **Given** el sitio funcionando en modo producción, **When** alguien abre
   `/carritos/{carritoId}/pago-simulado`, **Then** recibe una página "no encontrada" real.
7. **Given** la página de pago simulado, **When** el registro del pago falla, **Then** se
   muestra un error recuperable junto a los botones y quien prueba puede reintentar.

---

### User Story 3 - Carrito bloqueado mientras se paga (Priority: P2)

Mientras el carrito está en "Pago en curso", el comprador no puede cambiar las butacas, cambiar
el email ni abandonar el carrito. La pantalla del carrito lo dice ("Pago en curso"), muestra
esas acciones deshabilitadas y ofrece "Volver a la página de pago". Si por alguna vía el
comprador intenta igual una de esas acciones y la API la rechaza porque hay un pago en curso,
la pantalla muestra el mismo mensaje.

**Why this priority**: evita que el comprador pague por butacas que ya cambió o que abandone un
carrito que está pagando. La API ya lo impide; la pantalla tiene que reflejarlo para que el
comprador no choque con errores.

**Independent Test**: con un carrito en Pagando, abrir la pantalla del carrito y la de cambio de
butacas y comprobar que no se puede cambiar nada; con la red simulada, forzar que la API
responda "carrito en pago" a cada una de las tres acciones y comprobar el mensaje.

**Acceptance Scenarios**:

1. **Given** un carrito en Pagando, **When** el comprador abre `/carritos/{carritoId}`, **Then**
   ve el estado "Pago en curso", el contador con el vencimiento vigente, los datos de la reserva
   y el email en modo lectura, "Cambiar butacas" y "Abandonar carrito" deshabilitados con el
   motivo visible, y el botón "Volver a la página de pago".
2. **Given** un carrito en Pagando, **When** el comprador abre `/carritos/{carritoId}/butacas`,
   **Then** ve que hay un pago en curso, no puede confirmar una selección nueva y tiene un
   enlace para volver al carrito.
3. **Given** cualquier acción de cambio sobre el carrito, **When** la API responde "carrito en
   pago", **Then** la pantalla muestra "Pago en curso", vuelve a leer el carrito y pasa al modo
   bloqueado, sin perder la credencial.
4. **Given** un carrito en Pagando, **When** el comprador toca "Volver a la página de pago",
   **Then** el sitio vuelve a pedir el inicio del pago, recibe la misma dirección de pago sin
   cambios en el vencimiento y lo redirige ahí (o a la página de pago simulado en desarrollo).

---

### User Story 4 - Volver a pagar cuando el pago no se confirmó (Priority: P2)

Si el pago fue rechazado, si el comprador cerró Mercado Pago sin pagar o si la confirmación se
demora, la página de vuelta no lo deja sin salida: mientras el carrito siga en Pagando le
ofrece "Volver a la página de pago". Si la espera llega a su tope sin novedades, deja de
consultar sola y le explica que todavía no hay confirmación, con la opción de revisar de nuevo.

**Why this priority**: un rechazo de tarjeta es común y el carrito sigue vivo; sin una salida
clara el comprador pierde las butacas por no saber cómo reintentar.

**Independent Test**: con la red simulada, dejar el carrito en Pagando y avanzar el reloj hasta
el tope de la espera; comprobar que se dejó de consultar, que aparece el mensaje y que "Revisar
de nuevo" y "Volver a la página de pago" funcionan.

**Acceptance Scenarios**:

1. **Given** la página de vuelta con el carrito en Pagando, **When** se muestra, **Then** el
   botón "Volver a la página de pago" está disponible desde el primer momento, junto al mensaje
   de espera.
2. **Given** la página de vuelta consultando, **When** pasan 2 minutos y el carrito sigue en
   Pagando, **Then** las consultas automáticas se detienen, se informa que el pago todavía no
   se confirmó y se ofrecen "Revisar de nuevo" y "Volver a la página de pago".
3. **Given** las consultas detenidas por el tope, **When** el comprador toca "Revisar de nuevo",
   **Then** se consulta el carrito al instante y, si sigue en Pagando, la espera vuelve a
   empezar con un tope nuevo.
4. **Given** el carrito en Pagando, **When** su vencimiento llega a cero en el contador, **Then**
   la pantalla no lo declara vencido por su cuenta: vuelve a consultar a la API, que decide si
   quedó Pagado o Expirado.

---

### User Story 5 - Errores al iniciar el pago (Priority: P2)

Si la API no puede iniciar el pago, el comprador ve qué pasó y qué hacer, según el código del
error: falta el email, el carrito ya no está activo, la selección cambió mientras se creaba el
pago, Mercado Pago no responde, la credencial dejó de servir o el carrito no existe.

**Why this priority**: cada uno de estos casos ocurre en uso real (vencimiento justo antes de
pagar, caída momentánea de Mercado Pago) y la constitución exige un manejo explícito por código.

**Independent Test**: con la red simulada, responder al inicio del pago con cada código y
comprobar el mensaje y la acción de cada caso.

**Acceptance Scenarios**:

1. **Given** el inicio de pago, **When** la API responde "falta el email de entrega", **Then**
   la pantalla pide el email, lleva el foco al campo y no redirige.
2. **Given** el inicio de pago, **When** la API responde "carrito no activo" con estado actual
   Expirado o Abandonado, **Then** la pantalla vuelve a leer el carrito y lo muestra en modo
   lectura con la opción de empezar de nuevo.
3. **Given** el inicio de pago, **When** la API responde "carrito no activo" con estado actual
   Pagado, **Then** la pantalla muestra la compra cerrada con sus entradas.
4. **Given** el inicio de pago, **When** la API responde "carrito modificado", **Then** la
   pantalla vuelve a leer el carrito y le pide al comprador que revise la reserva y toque
   "Pagar" de nuevo.
5. **Given** el inicio de pago, **When** la API responde "pago no disponible", **Then** la
   pantalla dice "No pudimos iniciar el pago, probá de nuevo", el carrito sigue activo y el
   botón "Pagar" vuelve a estar disponible.
6. **Given** el inicio de pago, **When** la API responde 401 o "carrito no encontrado", **Then**
   la credencial guardada se descarta y el comprador ve el mismo aviso de carrito perdido que
   ya existe, con la opción de empezar de nuevo.
7. **Given** el inicio de pago, **When** la red falla o llega un código desconocido, **Then** se
   muestra un error genérico recuperable con la opción de reintentar, sin redirigir.

---

### User Story 6 - Ver una compra cerrada (Priority: P3)

Un carrito Pagado es una compra terminada. Cada vez que el comprador abre su carrito en esa
pestaña, lo ve como compra cerrada con sus entradas, aunque haya pasado su vencimiento y sin
contador ni acciones de cambio.

**Why this priority**: es el estado final del flujo; el comprador puede volver a la pestaña
horas después y no debe ver "vencido" sobre una compra pagada.

**Independent Test**: con la red simulada, devolver un carrito Pagado con `venceEn` en el pasado
y comprobar que la pantalla del carrito y la de vuelta lo muestran como compra cerrada con sus
entradas.

**Acceptance Scenarios**:

1. **Given** un carrito Pagado con vencimiento ya pasado, **When** se abre
   `/carritos/{carritoId}`, **Then** se ve como compra cerrada, sin contador ni cinta de peligro,
   con las entradas y sin acciones de cambio ni de abandono.
2. **Given** un carrito Pagado, **When** se abre `/carritos/{carritoId}/pago`, **Then** se ve
   directamente "¡Listo!" con las entradas, sin pasar por la espera.
3. **Given** un carrito Pagado, **When** se abre `/carritos/{carritoId}/butacas`, **Then** no se
   puede cambiar nada y hay un enlace al carrito.

---

### Edge Cases

- **Doble toque en "Pagar"**: mientras el pedido de inicio está en curso, el botón queda
  deshabilitado y anuncia que está iniciando el pago; no se envía un segundo pedido.
- **Dirección de pago inesperada**: si la API devuelve una dirección que no es una dirección
  segura absoluta (`https://…`) ni la ruta simulada, el sitio no redirige y muestra el error
  genérico. El sitio nunca abre una dirección arbitraria.
- **Ruta simulada fuera de desarrollo**: si en producción llegara una dirección simulada, el
  sitio no la sigue y muestra el error genérico.
- **Vuelta en otra pestaña o sin credencial**: si el comprador llega a la página de vuelta en
  una pestaña sin la credencial del carrito, no se puede consultar el carrito; la página explica
  que, si el pago se aprobó, las entradas llegan al email de entrega, y ofrece ir a la
  cartelera.
- **Pago aprobado justo al vencer**: el contador en Pagando llega a cero; la pantalla consulta a
  la API en lugar de marcar vencido, y muestra lo que la API decida.
- **Abandonado visto desde la página de vuelta**: se muestra en modo lectura con la opción de
  empezar de nuevo, igual que en la pantalla del carrito.
- **Estado desconocido**: un valor de estado que la API agregue en el futuro se muestra con una
  etiqueta genérica y el carrito en modo lectura; la página de vuelta deja de consultar.
- **Error de red durante la espera**: una consulta fallida no corta la espera; se reintenta en
  el siguiente ciclo. Si fallan todas hasta el tope, se ofrece "Revisar de nuevo".
- **Pagar otro monto con el monto vacío o inválido**: el campo muestra el error junto a él y no
  se registra el pago.
- **Recarga en la página de vuelta**: recargar retoma la espera desde cero con la misma
  credencial de la pestaña.
- **Pestaña en segundo plano**: al volver, el contador muestra el tiempo real y, si la página de
  vuelta seguía esperando, consulta de inmediato.

## Requirements *(mandatory)*

### Functional Requirements

**Contrato y estados**

- **FR-001**: El sitio DEBE tomar la forma de los datos del carrito, del inicio de pago y del
  pago simulado del contrato vigente del backend (feature 008), actualizado en este repositorio.
- **FR-002**: El sitio DEBE reconocer los estados de carrito Activo, Pagando, Pagado, Expirado y
  Abandonado, con etiquetas visibles definidas en un único lugar: "Activo", "Pago en curso",
  "Pagado", "Vencido" y "Abandonado". Un estado desconocido DEBE mostrarse con una etiqueta
  genérica.
- **FR-003**: Solo un carrito Activo DEBE admitir cambios de butacas, de email, abandono o
  inicio de pago. Un carrito en Pagando DEBE admitir solo "Volver a la página de pago".

**Inicio del pago**

- **FR-004**: La pantalla del carrito DEBE mostrar la sección de pago con "Pagar" solo cuando el
  carrito está Activo y tiene un email de entrega guardado. Sin email, la sección NO DEBE
  mostrarse. Mientras se edita el email, "Pagar" NO DEBE ser la acción principal de la vista.
  (Decisión del dueño, 2026-11-17.)
- **FR-005**: "Pagar" DEBE pedir a la API el inicio del pago con la credencial del carrito, sin
  enviar datos de tarjeta ni datos personales adicionales.
- **FR-006**: Mientras el pedido de inicio está en curso, "Pagar" DEBE quedar deshabilitado con
  un texto de progreso, y no DEBE enviarse otro pedido.
- **FR-007**: Con la respuesta exitosa, la pantalla DEBE reemplazar el carrito por el que
  devolvió la API (estado Pagando y vencimiento nuevo) antes de redirigir, de modo que el
  contador refleje el vencimiento nuevo si el comprador vuelve.
- **FR-008**: Si la dirección de pago es absoluta y segura (`https://`), el sitio DEBE llevar al
  comprador ahí en la misma pestaña.
- **FR-009**: Si la dirección de pago empieza con `/api/dev/pagos-simulados/` y el sitio corre
  en desarrollo, el sitio DEBE llevar al comprador a `/carritos/{carritoId}/pago-simulado` en
  lugar de abrir esa dirección.
- **FR-010**: Cualquier otra dirección de pago (o una simulada fuera de desarrollo) NO DEBE
  abrirse; DEBE mostrarse el error genérico recuperable.

**Pago simulado (solo desarrollo)**

- **FR-011**: La página `/carritos/{carritoId}/pago-simulado` DEBE existir solo cuando el sitio
  corre en desarrollo; en cualquier otro modo DEBE responder "no encontrada" real.
- **FR-012**: La página DEBE identificarse visiblemente como simulación de desarrollo, mostrar el
  total del carrito cuando se pueda leer y ofrecer "Aprobar pago", "Rechazar pago" y "Pagar
  otro monto" con un campo de monto precargado con el total.
- **FR-013**: "Aprobar pago" DEBE registrar un pago aprobado sin monto (la API usa el total);
  "Rechazar pago" DEBE registrar un pago rechazado; "Pagar otro monto" DEBE registrar un pago
  aprobado por el monto del campo. Después de un registro exitoso, la página DEBE llevar a
  `/carritos/{carritoId}/pago`.
- **FR-014**: El monto de "Pagar otro monto" DEBE validarse como un número positivo con hasta
  dos decimales antes de enviarse, con el error junto al campo.
- **FR-015**: Mientras se registra un pago simulado, los tres botones DEBEN quedar
  deshabilitados; si el registro falla, DEBE mostrarse un error recuperable y permitir
  reintentar.

**Página de vuelta**

- **FR-016**: La página `/carritos/{carritoId}/pago` DEBE leer el carrito con la credencial de
  la pestaña al cargar.
- **FR-017**: Mientras el carrito esté en Pagando, la página DEBE mostrar "Estamos confirmando tu
  pago…", consultar el carrito cada 2 segundos (sin superponer consultas) y ofrecer "Volver a la
  página de pago".
- **FR-018**: Las consultas automáticas DEBEN detenerse a los 2 minutos de espera sin cambio de
  estado; la página DEBE informar que el pago todavía no se confirmó y ofrecer "Revisar de
  nuevo", que consulta al instante y reinicia la espera, y "Volver a la página de pago".
- **FR-019**: Con el carrito Pagado, la página DEBE mostrar "¡Listo!", una tarjeta por entrada
  con el código como dato principal, película, sucursal, sala, fecha y hora de inicio, fila y
  número de asiento y precio, y el aviso de que las entradas también se enviaron al email de
  entrega.
- **FR-020**: Con el carrito Expirado, la página DEBE decir que el tiempo para pagar venció y
  que, si se cobró algo, se devuelve automáticamente, con la opción de elegir otra función de la
  película.
- **FR-021**: Con el carrito Abandonado o en un estado desconocido, la página DEBE dejar de
  consultar y mostrar el carrito en modo lectura con la opción de empezar de nuevo.
- **FR-022**: Sin credencial en la pestaña, la página NO DEBE consultar la API; DEBE explicar que
  las entradas llegan al email de entrega si el pago se aprobó y ofrecer ir a la cartelera.
- **FR-023**: Un error de red o una respuesta inesperada durante la espera NO DEBE cortarla; se
  reintenta en el siguiente ciclo hasta el tope.
- **FR-024**: El cambio a Pagado o a Expirado DEBE anunciarse una sola vez a tecnologías de
  asistencia; el mensaje de espera NO DEBE repetirse en cada consulta.

**Carrito en Pagando**

- **FR-025**: Con el carrito en Pagando, la pantalla del carrito DEBE mostrar "Pago en curso",
  el contador, el email en modo lectura, "Cambiar butacas" y "Abandonar carrito" deshabilitados
  con su motivo visible, y "Volver a la página de pago".
- **FR-026**: Con el carrito en Pagando o Pagado, la pantalla de cambio de butacas NO DEBE
  permitir confirmar una selección y DEBE enlazar de vuelta al carrito.
- **FR-027**: "Volver a la página de pago" DEBE repetir el pedido de inicio de pago (que la API
  responde con la misma dirección sin cambiar el vencimiento) y seguir las reglas de
  redirección de FR-008 a FR-010.
- **FR-028**: Cuando el contador de un carrito en Pagando llega a cero, la pantalla NO DEBE
  marcarlo vencido por su cuenta; DEBE consultar el carrito y mostrar el estado que devuelva la
  API.

**Compra cerrada**

- **FR-029**: Un carrito Pagado DEBE mostrarse siempre como compra cerrada con sus entradas, sin
  contador, sin cinta de peligro y sin acciones de cambio, aunque su vencimiento haya pasado.
- **FR-030**: Las entradas de un carrito Pagado DEBEN conservarse en la pestaña para poder volver
  a mostrarlas al recargar. La credencial ya no hace falta y se descarta.

**Errores por código**

- **FR-031**: Cada error del inicio de pago DEBE manejarse por su código:
  - `email-entrega-faltante`: pedir el email y llevar el foco al campo.
  - `carrito-no-activo`: volver a leer el carrito y mostrar su estado (Expirado o Abandonado en
    modo lectura; Pagado como compra cerrada).
  - `carrito-modificado`: volver a leer el carrito y pedir que se toque "Pagar" de nuevo.
  - `pago-no-disponible`: "No pudimos iniciar el pago, probá de nuevo", con el carrito activo.
  - 401 y `carrito-no-encontrado`: descartar la credencial y mostrar el aviso de carrito perdido.
  - Error de red o código desconocido: error genérico recuperable con reintento.
- **FR-032**: Un `carrito-en-pago` en respuesta a cambiar butacas, cambiar el email o abandonar
  DEBE mostrar "Pago en curso", volver a leer el carrito y pasar al modo bloqueado sin descartar
  la credencial.

**Privacidad y alcance**

- **FR-033**: La credencial del carrito NO DEBE aparecer en ninguna dirección (incluidas la de
  pago simulado y la de vuelta), en logs, en mensajes de error ni en analítica.
- **FR-034**: El sitio NO DEBE pedir, mostrar ni transmitir datos de tarjeta; el pago real ocurre
  en la página de Mercado Pago.
- **FR-035**: Las páginas de pago simulado y de vuelta DEBEN marcarse para no indexarse, no
  cachearse y quedar fuera del sitemap, como el resto del flujo del carrito.
- **FR-036**: Todas las pantallas nuevas o modificadas DEBEN ser operables por teclado y por
  lector de pantalla, sin scroll horizontal desde 360 px de ancho y con objetivos táctiles del
  tamaño mínimo.
- **FR-037**: El texto que hoy dice, tras guardar el email, que el pago todavía no existe DEBE
  reemplazarse por la invitación a pagar.

### Key Entities

- **Carrito**: la reserva temporal del comprador. Suma a lo existente el estado Pagando y
  Pagado, el pago (si se inició) y las entradas (si se pagó).
- **Pago**: el pago iniciado del carrito. Tiene la dirección de la página de pago, cuándo se
  inició y cuándo se pagó. No existe hasta que se toca "Pagar".
- **Entrada**: lo que recibe el comprador por cada butaca pagada. Tiene un código único, la
  película, la sucursal, la sala, la hora de inicio, la fila y número del asiento y el precio
  unitario.
- **Pago simulado**: el resultado que quien prueba registra en desarrollo para un carrito:
  aprobado o rechazado, con un monto opcional. Solo existe en desarrollo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el backend local en modo simulado, una persona completa el recorrido cartelera
  → película → sucursal → horario → butacas → carrito → email → pagar → aprobar → entradas en
  menos de 3 minutos, sin salir del sitio.
- **SC-002**: Después de aprobar un pago, la página de vuelta muestra las entradas en menos de 5
  segundos en el 95 % de los intentos contra el backend local.
- **SC-003**: El 100 % de las entradas de un carrito pagado se muestran, una por butaca, con
  código, película, sucursal, sala, fecha y hora, fila, asiento y precio iguales a los que
  devuelve la API.
- **SC-004**: En un carrito en Pagando, el 100 % de los intentos de cambiar butacas, cambiar el
  email o abandonar quedan bloqueados en la interfaz o, si llegan a la API, terminan en el
  mensaje "Pago en curso" sin perder el carrito.
- **SC-005**: Cada uno de los 7 casos de error del inicio de pago (FR-031) muestra su mensaje y
  su acción propios; ninguno deja la pantalla rota ni redirige.
- **SC-006**: Tras un rechazo, el comprador vuelve a la página de pago en un solo toque desde la
  página de vuelta.
- **SC-007**: La credencial del carrito aparece 0 veces en direcciones, historial del navegador,
  logs del servidor del sitio o mensajes de error durante el recorrido completo.
- **SC-008**: En modo producción, la página de pago simulado responde "no encontrada" en el
  100 % de los intentos.

## Assumptions

- Contrato de referencia: `specs/008-pago-mercado-pago/contracts/pagos-api.md` del backend, ya
  en master. El `openapi.json` del backend se copia a este repositorio y los tipos se regeneran
  antes de implementar (Principio I).
- Numeración: esta spec es la 005 porque `specs/` llega hasta la 004. La rama actual
  `005-volver-al-carrito` es una mejora sin spec propia; el nombre de la rama de esta feature lo
  decide el autor.
- "Desarrollo" es el sitio corriendo con el servidor de desarrollo. El modo de la pasarela lo
  decide el backend; el sitio solo reconoce la forma de la dirección que recibe.
- La redirección a Mercado Pago ocurre en la misma pestaña, así la credencial guardada en la
  pestaña sigue disponible al volver.
- La dirección de vuelta la configura el backend (`MercadoPago:UrlRetorno`). Su valor por
  defecto apunta al puerto 5173; para probar con la pasarela real hay que configurarla con
  `http://localhost:3000/carritos/{carritoId}/pago`. Con la pasarela simulada no hace falta,
  porque el sitio navega solo a la página de vuelta.
- "Pagar otro monto" usa el campo de monto precargado con el total; quien prueba lo cambia. No
  se ofrece el estado "Pendiente" del pago simulado porque la descripción pide solo tres
  botones.
- La página de pago simulado lee el carrito con la credencial de la pestaña solo para mostrar el
  total; si no hay credencial, igual funciona (el registro del pago simulado no la pide).
- El tope de espera de la página de vuelta es de 2 minutos, como sugiere la descripción; el
  intervalo de 2 segundos es el que recomienda el contrato del backend.
- El email del comprador aparece en Mailpit por el backend; el sitio no envía emails.
- El modo simulado de la API del propio sitio (`API_MOCK`) se extiende para cubrir los estados y
  respuestas nuevas, igual que en las specs anteriores, para que los tests y el desarrollo sin
  backend sigan funcionando.
- La constitución (versión 1.1.0) dice que el pago todavía no existe en la API y que ninguna
  pantalla debe simular un pago como si fuera real. La página de pago simulado se identifica
  como simulación y solo existe en desarrollo, así que no simula un pago "como si fuera real";
  igual, la restricción quedó desactualizada y el plan DEBE incluir una enmienda (PATCH o
  MINOR) que la actualice.
- Fuera de alcance: SDK o Brick de Mercado Pago en el sitio, QR de las entradas, historial de
  compras y reembolsos pedidos por el comprador.
- Los tests cubren, como mínimo: la elección de destino según la dirección de pago, la espera
  con su intervalo y su tope, las transiciones Activo → Pagando → Pagado / Expirado, el manejo de
  cada código del inicio de pago y de `carrito-en-pago`, y la conservación o descarte de la
  credencial (Principio VII).
