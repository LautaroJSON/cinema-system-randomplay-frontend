# Research: Carrito con retención corta

Decisiones técnicas de la spec 004. Cada una cita los requisitos que resuelve. Siguen vigentes los
R1–R16 de la spec 001 y los B1–B16 de la 003. Acá la numeración empieza de nuevo con prefijo `C`.

## C1. Pantalla del carrito: página de servidor mínima con una isla de cliente

- **Decision**: `src/app/carritos/[carritoId]/page.tsx` se mantiene como está: un Server
  Component con `force-dynamic` y `robots: noindex, nofollow` que no recibe datos del carrito.
  La isla `CarritoCreado` de la 003 se reemplaza por `PantallaCarrito` (`"use client"`), que:
  1. lee la sesión de la pestaña con `useSyncExternalStore`, igual que hoy;
  2. si la sesión no corresponde al `carritoId` de la URL, muestra "No hay un carrito activo en
     esta pestaña" sin llamar a la API (FR-002);
  3. si corresponde y tiene token, muestra enseguida el último carrito guardado y pide
     `GET /api/carritos/{id}` para actualizarlo (FR-007);
  4. si corresponde pero ya no tiene token (abandonado o vencido antes), muestra el modo lectura
     con los últimos datos (edge case de recarga).
- **Rationale**: Principio III y VIII. El servidor nunca ve el token porque no lo tiene: vive en
  `sessionStorage`. El último carrito guardado es una respuesta real de la API, no datos
  inventados, así que mostrarlo mientras llega el `GET` cumple FR-007 y evita un parpadeo de
  carga en cada visita.
- **Alternatives considered**: mostrar solo un estado de carga hasta el `GET` (más lento y sin
  ganancia, porque los datos guardados son de la misma API); pasar el token al servidor por una
  cookie para renderizar en el servidor (lo prohíbe el Principio III).

## C2. Sesión de la pestaña: versión 2 con token opcional

- **Decision**: `src/domain/sesion-carrito.ts` pasa a la versión 2 de la clave
  `randomplay:carrito`:
  `{ version: 2, carritoId, token: string | null, tokenVenceEn: string | null, carrito,
  desfaseMs }`.
  - `carrito` es el `CarritoResponse` mapeado completo (`Carrito`, data-model.md), con
    `precioUnitario`, `emailEntrega` y `abandonadoEn`.
  - `desfaseMs` es la diferencia entre el reloj del servidor y el del dispositivo (C4).
  - `token: null` marca un carrito cerrado: se conserva para el modo lectura después de recargar
    y no permite ninguna operación.
  - `parsearSesion` acepta solo la versión 2. La versión 1 de la 003 no llegó a `main`, así que
    no hay sesiones viejas que migrar; una versión 1 se lee como "sin sesión".
  - Se agregan `actualizarCarrito(carrito, desfaseMs)` (reemplaza el carrito guardado sin tocar
    el token) y `cerrarSesion(carrito)` (borra token y vencimiento, conserva el carrito).
    `descartarSesion()` sigue borrando todo.
- **Rationale**: FR-005 pide descartar la credencial al abandonar o vencer, y el edge case de
  recarga pide seguir mostrando el modo lectura. Separar "credencial" de "último carrito" en la
  misma clave cumple las dos cosas sin una segunda clave que haya que mantener sincronizada.
- **Impacto en la 003**: la confirmación del mapa abandona el carrito anterior solo si la sesión
  tiene token. Una sesión cerrada se descarta sin llamar a la API.
- **Alternatives considered**: una segunda clave `randomplay:carrito-cerrado` (dos fuentes que
  pueden divergir); descartar todo al cerrar (el modo lectura se pierde al recargar).

## C3. Transporte: PUT, hora del servidor y 401

- **Decision**: `src/api/navegador.ts` cambia en tres puntos:
  - `metodo` acepta `"PUT"`.
  - Un resultado `ok` incluye `horaServidorMs: number | null`, leída del header `Date` de la
    respuesta, y `recibidoEnMs` (el `Date.now()` del dispositivo al recibirla). Los resultados
    con error también las incluyen cuando hubo respuesta.
  - Nada más cambia: el token sigue viajando solo como header y ningún error copia headers ni
    cuerpos del pedido.

  `src/api/problema.ts` agrega `estadoActual?: string` (solo en `carrito-no-activo`). El `401`
  llega sin `codigo` y queda como `tipo: "desconocido"` con `status: 401`. La decisión
  "credencial perdida" se toma en un solo lugar del dominio (C7) por `codigo` o por `status`,
  como permite el Principio II para respuestas sin `codigo`.

  `src/api/carritos.ts` suma `obtenerCarrito`, `reemplazarAsientos` e `indicarEmail`, todas con
  `(carritoId, token, …)`, y `abandonarCarrito` pasa a devolver el carrito mapeado. Las cuatro
  arman la ruta con `encodeURIComponent(carritoId)` del id guardado junto al token, nunca del id
  de la URL, para que el token no pueda viajar a otro carrito (FR-003).
- **Rationale**: Principio I (un solo módulo cliente) y FR-016. El header `Date` es la única
  hora del servidor disponible sin cambiar el contrato. Al ser una respuesta del mismo origen,
  el navegador lo deja leer.
- **Nota sobre el proxy**: el `rewrite` de Next reenvía los headers del backend. Si en algún
  entorno el header `Date` lo pusiera el servidor de Next y no el backend, el desfase se mide
  contra el reloj de Next, que también es un servidor sincronizado. El quickstart incluye la
  comprobación.

## C4. Cuenta regresiva

- **Decision**: lógica pura en `src/domain/cuenta-regresiva.ts`:
  - `medirDesfase(horaServidorMs, recibidoEnMs)` devuelve
    `horaServidorMs - recibidoEnMs`, o `0` si no hay hora del servidor. Un desfase de más de
    12 horas se descarta (`0`): es un header roto, no un reloj corrido.
  - `restanteMs(venceEn, desfaseMs, ahoraMs)` devuelve
    `Date.parse(venceEn) - (ahoraMs + desfaseMs)`, con piso en 0. Un `venceEn` ilegible da 0
    (se trata como vencido y no se inventa un tiempo).
  - `tramo(restanteMs)` devuelve `"normal"` (> 2 min), `"final"` (≤ 2 min y > 0) o `"vencido"`.
    Los 2 minutos salen de `config/experiencia.ts` (`AVISO_VENCIMIENTO_MS`, FR-013).
  - `formatearContador(restanteMs)` devuelve `"MM:SS"` redondeando los segundos **hacia
    arriba**, para que `00:00` aparezca solo al vencer. Con 60 minutos o más (no debería pasar
    con la retención actual) sigue mostrando minutos totales, por ejemplo `75:00`.
  - `describirRestante(restanteMs)` devuelve el texto completo para lectores de pantalla:
    "Quedan 4 minutos y 12 segundos", "Queda 1 minuto", "Quedan 30 segundos".

  El hook `useCuentaRegresiva(venceEn, desfaseMs)` en el componente:
  - Recalcula el restante desde `Date.now()` en cada tic, nunca restando de a un segundo. Así un
    timer demorado (pestaña en segundo plano, dispositivo suspendido) se corrige solo en el tic
    siguiente (FR-015).
  - Programa cada tic con `setTimeout` al próximo cambio de segundo del restante, en lugar de un
    `setInterval` fijo, para que el contador no salte de a dos.
  - Recalcula también en `visibilitychange` y `focus`.
  - Expone `{ restanteMs, tramo }`. El paso a `"vencido"` se dispara una sola vez.
- **Rationale**: Principio IV ("calcularse desde `venceEn`") y FR-012 a FR-018. Con el desfase
  medido en cada respuesta, el error queda acotado por la resolución del header `Date` (1 s) más
  la mitad del tiempo de ida y vuelta, dentro de SC-002.
- **Alternatives considered**: restar un segundo por tic (deriva en segundo plano); usar
  `performance.now()` como base monotónica (sirve dentro de una carga, pero el carrito sobrevive
  recargas y hace falta una referencia absoluta); pedir el carrito periódicamente para corregir
  (más tráfico y la API no devuelve la hora en el cuerpo).

## C5. Avisos a lectores de pantalla

- **Decision**:
  - El contador es un elemento `role="timer"` (que por defecto no se anuncia) con dos hijos: el
    texto visible `09:42` con `aria-hidden="true"` y un texto visualmente oculto con
    `describirRestante`. Quien recorre la página lo puede leer en cualquier momento, y nadie lo
    oye segundo a segundo (FR-017).
  - Una región `role="status"` (cortesía) separada recibe solo dos textos, una vez cada uno:
    - al entrar al tramo final: "Quedan 2 minutos. Después, tus butacas se liberan." (o el
      restante real si la pantalla se abre ya dentro del tramo);
    - al vencer: "Se terminó el tiempo. Liberamos tus butacas."
  - Un `useRef` guarda qué avisos ya se dieron en esta carga para no repetirlos al re-renderizar.
- **Rationale**: Principio VI ("avisos puntuales al acercarse el vencimiento") y SC-003. El
  vencimiento cambia la pantalla, pero no responde a una acción del comprador, por eso va en
  cortesía y no en `alert`.

## C6. Color del contador y cinta de peligro

- **Decision**:
  - Tramo normal: `--oro`. Tramo final: `--telon-ink`. Cambio de color sin transición, sin
    parpadeo y sin animación, también sin `prefers-reduced-motion` (FR-013). El tramo también
    cambia el texto oculto ("Quedan menos de 2 minutos"), para que la señal no dependa solo del
    color.
  - Contrastes medidos con `contrast-check.py` sobre las superficies donde va el contador:
    `--oro` sobre `--surface` 9.77:1; `--telon-ink` sobre `--surface` 5.89:1, sobre `--surface-2`
    5.26:1 y sobre `--ink` 6.40:1. Todos cumplen AA para texto normal.
  - Cinta de peligro: una clase global `.cinta-peligro` (franja de 8 px con rayas diagonales
    `--telon` / `--ink` de corte duro, decorativa y `aria-hidden`) arriba del aviso. Se muestra
    solo en dos casos (FR-041): carrito vencido y operación fallida por red. No reemplaza al
    texto del aviso, que dice qué pasó. Las rayas se dibujan con `repeating-linear-gradient`
    con paradas duras: es un patrón de dos tintas, no un degradé de color a color (DESIGN.md
    §4, R-01).
- **Rationale**: DESIGN.md §6.5 y §7. La cinta pierde valor si aparece en otros errores.

## C7. Estados de la pantalla

- **Decision**: lógica pura en `src/domain/carrito.ts`:
  - `etiquetaEstado(estado)`: `Activo` → "Activo", `Abandonado` → "Abandonado", `Expirado` →
    "Vencido", otro valor → "Estado desconocido" (FR-010, Principio V).
  - `esModificable(carrito, tramo)`: `true` solo si `estado === "Activo"` y el tramo no es
    `"vencido"` (FR-011, FR-014).
  - `credencialPerdida(problema)`: `true` si `tipo === "carrito-no-encontrado"` o
    `status === 401` (FR-034).
  - `resolverProblemaCarrito(problema, operacion)` devuelve la transición de la pantalla para
    cada resultado, con la tabla de C10.

  La isla `PantallaCarrito` guarda su estado en un reducer (`reducirPantalla`, también en
  `domain/carrito.ts`), con las transiciones de data-model.md.
- **Rationale**: Principio VII (las transiciones se testean sin DOM) y VIII (los componentes no
  deciden reglas).

## C8. Cambio de butacas en `/carritos/[carritoId]/butacas`

- **Decision**:
  - La página es un Server Component mínimo (`force-dynamic`, `noindex`) con la isla
    `CambioButacas`. El servidor no conoce la función: el `funcionId` está en la sesión de la
    pestaña, junto al token.
  - `CambioButacas` lee la sesión. Sin sesión válida para ese id, o con el carrito cerrado,
    muestra el mismo aviso que el carrito. Con sesión, pide el mapa con
    `obtenerMapaDesdeNavegador(funcionId)` (que ya existe) y, mientras tanto, muestra un estado
    de carga.
  - Con el mapa, aplica `marcarPropias(filas, carrito.asientos)` (nueva en
    `domain/butacas.ts`): las butacas del carrito pasan a `libre = true`, porque la API las
    informa como ocupadas aunque las retiene este mismo carrito (FR-020). La selección inicial
    son esas butacas.
  - Muestra la cabecera de la función con los datos del carrito, el contador (C4) y un enlace
    "Volver al carrito" sin cambios (FR-021).
  - Confirmar llama a `reemplazarAsientos(carritoId, token, seleccion)` con la selección
    completa (FR-022). Con un 200, guarda el carrito devuelto con `actualizarCarrito` y navega
    a `/carritos/{id}`.
  - El botón dice "Guardar N butacas". Está deshabilitado con selección vacía, mientras hay un
    pedido en curso y cuando la selección es igual a la del carrito, sin importar el orden
    (`mismaSeleccion`, FR-023 y FR-024). Con selección vacía se ve "Para no quedarte con
    ninguna butaca, abandoná el carrito." con un enlace al carrito.
  - Si el contador llega a cero, la isla cierra la sesión (C2) y navega a `/carritos/{id}`,
    que muestra el vencido.
- **Reutilización del selector**: `SelectorButacas` se divide en dos partes:
  - Una parte común: mapa, reducer de selección, refresco tras conflicto, avisos de
    conflicto, `pedido-invalido` y `funcion-sin-cupo`, y error genérico.
  - Una estrategia de confirmación inyectada. La de crear (003) abandona el anterior y crea;
    la de cambiar (004) reemplaza. Cada estrategia devuelve un `Problema` o el éxito, y la parte
    común resuelve los códigos de butacas. Los de credencial y estado del carrito los resuelve
    la estrategia de cambio (C10).
  - Tras un refresco por conflicto, el mapa nuevo vuelve a pasar por `marcarPropias` con las
    butacas que el carrito todavía retiene.
- **Rationale**: FR-019 a FR-024 y la asunción de la spec (la página de la función crea un
  carrito nuevo). El mapa no se pide en el servidor porque la función solo se conoce en el
  navegador (ver Complexity Tracking del plan).
- **Alternatives considered**: `/funciones/{id}?cambiar=…` (mezcla la creación y el cambio en la
  misma página y la 003 abandonaría el carrito al confirmar); poner el `funcionId` en la URL del
  cambio para pedir el mapa en el servidor (la spec fija que la dirección lleva solo el id del
  carrito, y el beneficio es un estado de carga menos en una página que no se indexa).

## C9. Email de entrega

- **Decision**:
  - `src/domain/email.ts` con `validarEmail(texto)`, que devuelve `{ ok: true, email }` o
    `{ ok: false, mensaje }`. Recorta espacios, exige 1 a 254 caracteres y
    `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Mensajes: "Escribí tu email." / "Revisá el email: le falta la
    arroba o el dominio." Es una ayuda de experiencia y la API decide (FR-026).
  - Un `<form noValidate>` con `<label>` visible "Email para recibir las entradas",
    `<input type="email" autoComplete="email" inputMode="email">`, `aria-invalid` y
    `aria-describedby` hacia el mensaje de error. Con un error de formato, el foco vuelve al
    campo. `noValidate` evita las burbujas nativas, que no se pueden traducir ni anunciar igual
    en todos los navegadores.
  - Los mensajes de `errors.email` (o `Email`, sin distinguir mayúsculas) de `pedido-invalido`
    van en el mismo lugar. El resto va como aviso general (FR-027).
  - Con un 200, el carrito devuelto reemplaza al guardado y la pantalla muestra el bloque "Qué
    sigue" (FR-028): "Guardamos tu email: {email}. El pago todavía no está disponible, así que
    no se emiten ni envían entradas. Tus butacas siguen reservadas hasta que termine el
    contador." El formulario pasa a un modo compacto con el email y un botón "Cambiar email"
    (FR-029).
  - Botón: "Guardar email". Es el único botón rojo de la vista mientras no hay email guardado.
    Con el email guardado no queda ningún botón rojo, porque no hay una acción principal
    siguiente.
- **Rationale**: FR-025 a FR-029, DESIGN.md §7 (un solo botón rojo) y la constitución (no
  simular pago).

## C10. Manejo por `codigo` en las operaciones del carrito

| Resultado | `GET` carrito | `PUT` asientos (cambio) | `PUT` email | `POST` abandono |
|---|---|---|---|---|
| 200 | `actualizarCarrito`; si `estado` no es `Activo`, `cerrarSesion` y modo lectura | `actualizarCarrito` y volver al carrito | `actualizarCarrito` y bloque "Qué sigue" | `cerrarSesion` y modo lectura "Abandonado" |
| `401` / `carrito-no-encontrado` | `descartarSesion`, vista `perdido` | ídem | ídem | ídem |
| `carrito-no-activo` | — | `cerrarSesion` con `estadoActual`, volver al carrito en modo lectura con aviso | `cerrarSesion`, modo lectura con aviso | `cerrarSesion`, modo lectura sin aviso de error (FR-035) |
| `asientos-no-disponibles` | — | Como la 003 (B11), con `marcarPropias` tras el refresco | — | — |
| `asientos-inexistentes` | — | Como la 003 | — | — |
| `pedido-invalido` | — | Mensajes junto a la selección | Mensajes junto al campo | — |
| `funcion-sin-cupo` | — | Aviso "probá en unos minutos", selección intacta | — | — |
| `funcion-no-disponible` / `funcion-no-encontrada` | — | Bloquea el cambio; enlace "Ver la cartelera" | — | — |
| `demasiados-pedidos`, `desafio-rechazado`, otro `codigo`, sin `codigo` | Error genérico; se sigue mostrando el último carrito guardado | Error genérico con "Reintentar" | Error genérico con "Reintentar", texto conservado | Error genérico; el carrito sigue activo (FR-032) |
| Red o timeout | Ídem, más cinta de peligro "Sin conexión" | Ídem, más cinta | Ídem, más cinta | Ídem, más cinta |

- La vista `perdido` dice "No pudimos recuperar tu carrito." y ofrece "Elegir otra función"
  (`/peliculas/{peliculaId}#titulo-horarios`, tomado del carrito guardado antes de descartarlo)
  o "Ver la cartelera" si no hay película conocida.
- La cinta "Sin conexión" desaparece con la siguiente respuesta de la API, sea cual sea
  (FR-041).
- Un `GET` que devuelve un carrito con `estado` desconocido se trata como no modificable
  (FR-010).
- La respuesta de una operación que llega cuando el contador ya está en cero se guarda, pero la
  pantalla queda vencida (edge case).
- Los textos finales se escriben en la implementación siguiendo DESIGN.md §10. Los de esta
  tabla fijan qué dicen, no la redacción definitiva.

## C11. Abandono

- **Decision**: "Abandonar carrito" es un botón secundario. Al tocarlo, se muestra en el lugar
  una confirmación con el texto "Si abandonás, liberamos tus butacas ahora y no las vas a poder
  recuperar." y dos botones, "Sí, abandonar" y "Seguir con mi carrito". El foco pasa a "Seguir
  con mi carrito", la opción que no destruye nada. Escape o "Seguir con mi carrito" cierran la
  confirmación y devuelven el foco a "Abandonar carrito". Durante el pedido, los dos botones se
  deshabilitan (no hay doble envío).
- **Rationale**: FR-030. Una confirmación en el lugar evita la trampa de foco y los problemas de
  `<dialog>` modal con lectores de pantalla en teléfonos, y mantiene una sola columna (dial 1).
- **Cierre de pestaña**: no se registra ningún `pagehide`, `beforeunload` ni `sendBeacon`
  (clarificación de la spec, FR-033). `sendBeacon` además no permite el header `Authorization`.

## C12. Foco al cambiar de vista

- **Decision**: cuando la pantalla pasa a modo lectura, a `perdido` o a vencido, el foco va al
  `h1` de la vista nueva (`tabIndex={-1}`), salvo que el comprador esté escribiendo en el campo
  de email: en ese caso el aviso se anuncia por la región de cortesía y el foco va al `h1`
  recién cuando el campo desaparece (FR-045). Al volver del cambio de butacas, el foco va al
  `h1` del carrito.
- **Rationale**: WCAG 2.4.3 y 3.2.2. Un control que desaparece con el foco encima deja al
  lector de pantalla sin contexto.

## C13. Tests

- **Decision**:
  - **Vitest + MSW** con handlers nuevos `*/api/carritos/:id` (GET),
    `*/api/carritos/:id/asientos` (PUT), `*/api/carritos/:id/email-entrega` (PUT) y `abandono`
    (ahora con cuerpo). Los handlers responden `401` sin `Authorization` y
    `carrito-no-encontrado` con un token ajeno, y devuelven el header `Date`. Los fixtures
    nuevos van en `tests/fixtures/carritos.json` (activo, abandonado, expirado, con email),
    tipados con `satisfies` contra el schema.
  - **Reloj**: `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })` con
    `vi.setSystemTime` para el contador. El desfase se prueba con un header `Date` distinto del
    reloj simulado.
  - **Playwright** contra `scripts/mock-api.mjs`, ampliado con carritos en memoria (GET, PUT
    asientos, PUT email, abandono, `401` sin token) y `page.clock` para adelantar el contador
    hasta el tramo final y el vencimiento sin esperar.
  - **Desarrollo manual** contra el backend real (quickstart.md).
- **Rationale**: Principio VII y el pedido explícito de la spec (cuenta regresiva, credencial,
  transiciones, selección completa y cada `codigo`).

## C14. Antislop y dial

- **Decision**: el modo de antislop de esta sesión es *during* (elegido el 2026-11-01). La
  implementación lo vuelve a resolver según `CLAUDE.md` si es otra sesión. Dial 1/1/1:
  - una columna;
  - como máximo un botón rojo por vista ("Guardar email" o "Guardar N butacas");
  - sin etiquetas pegadas ni trama halftone;
  - la cinta de peligro solo en los dos casos de C6;
  - movimiento solo en hover, foco y presión.

  La excepción de 24–32 px de la 003 vale igual en el mapa del cambio de butacas. El resto de los
  controles mide 44 px o más.
- **Rationale**: DESIGN.md §11 y R-31.
