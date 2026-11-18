# Research: Aviso de carga al elegir un horario

Decisiones de la Fase 0. Las referencias a Next.js salen de la documentación instalada
(`node_modules/next/dist/docs/`, Next 16.4).

## R0. Por qué no `loading.tsx` (versión anterior de esta feature)

La versión anterior agregaba `loading.tsx` a la página de la función. Para mostrar la
estructura al instante, Next empieza a responder antes de saber si la función existe, y eso:

- devolvía `200` en lugar de `404` a una función inexistente;
- devolvía `200` en lugar de `500` ante un error del backend;
- dejaba la página de la función sin datos visibles para quien no tiene JavaScript.

El dueño eligió una versión que solo da feedback en el horario tocado y no cambia ninguna
respuesta del servidor.

## R1. Saber que un enlace está cargando: `useLinkStatus`

- **Decision**: usar el hook `useLinkStatus` de `next/link` en un componente de cliente que va
  **dentro** de cada `<Link>` de horario en `TiraHorarios`. Devuelve `{ pending }`: `true` desde
  que se activa el enlace hasta que la navegación termina y cambia el historial.
- **Rationale**: la documentación lo recomienda para este caso exacto: ruta de destino dinámica,
  sin `loading.js` y con `prefetch={false}` (los horarios ya lo tienen, porque la página de
  butacas no se cachea). Next maneja que solo el último enlace activado quede `pending`
  (FR-003). No agrega pedidos ni cambia la respuesta del servidor (FR-013).
- **Alternatives considered**:
  - `onClick` propio con estado: duplica lo que Next ya sabe y no se entera de cuándo termina la
    navegación.
  - `useTransition` + `router.push`: obliga a reemplazar `<Link>` por botones o a interceptar el
    clic, y se pierde el enlace real (Principio IX pide `<a>` para navegar).
  - `loading.tsx`: descartado (R0).

## R2. Señal en el horario sin mover nada

- **Decision**: el componente `IndicadorCarga` (dentro del `<Link>`) dibuja, en la misma celda
  de grilla que el precio, un texto "Cargando…" que se superpone al precio:
  - el precio y el indicador comparten `grid-area`; con `pending`, el precio pasa a
    `opacity: 0` y el indicador a `opacity: 1`, así que el alto no cambia (FR-002). Se usa
    `opacity` y no `visibility: hidden` porque `visibility` saca el precio del árbol de
    accesibilidad y cambiaría el nombre del enlace durante la carga;
  - el horario cambia el borde a `--oro` con `:has()` sobre el indicador activo
    (`.horario:has([data-pendiente])`), además del texto, para no depender del color (FR-001);
  - el indicador es `aria-hidden`: el anuncio lo hace el aviso inferior (R3), y así el nombre
    accesible del enlace no cambia.
- **Rationale**: la documentación de `useLinkStatus` advierte que los indicadores dentro del
  enlace suelen causar saltos y recomienda un elemento siempre presente que solo cambia de
  visibilidad. `:has()` tiene soporte en todos los navegadores actuales.

## R3. Aviso inferior

- **Decision**: cuando `pending`, `IndicadorCarga` monta `AvisoCargaHorario` con
  `createPortal` en `document.body`:
  - barra fija abajo (`position: fixed`), ancho completo con el gutter de la página, fondo
    `--surface`, borde superior `--line-strong`, sombra dura de DESIGN.md §6, sin animación;
  - texto: "Cargando las butacas de las {hora}, {sala}…" con `hora` y `sala` del horario;
  - a los `AVISO_DEMORA_MS` (5000 ms) suma "Esto puede tardar un poco más. No hace falta
    recargar la página.";
  - `pointer-events: none`, para no tapar toques a otros horarios o enlaces (FR-007);
  - `padding-bottom` con `env(safe-area-inset-bottom)` para teléfonos con barra de gestos.
- **Por qué un portal**: si la barra quedara dentro del `<a>`, su texto se sumaría al nombre
  accesible del enlace y sería parte del área clickeable. Con el portal queda fuera del `<a>` en
  el DOM. En el árbol de React los eventos sí atraviesan el portal y un clic llegaría al
  `onClick` del `Link`, pero `pointer-events: none` hace que la barra no reciba clics.
- **"Sala 3" en una línea**: la sala se escribe con espacio duro dentro del aviso para que no
  se parta a 360 px (verificado con capturas).
- **Límite**: si el horario tocado está al pie de la pantalla, la barra lo tapa mientras
  carga. Se acepta: la barra repite qué se está cargando y deja pasar los toques.
- **Anuncio** (FR-009): la barra tiene una región `role="status"` que se llena **después de
  montar** (primero el texto de carga y, a los 5 s, la línea de demora). Una región viva que se
  inserta con el texto ya puesto no se anuncia de forma confiable.
- **Temporizador**: el de 5 s vive en `AvisoCargaHorario` y se limpia al desmontar (cuando
  `pending` vuelve a `false` o se toca otro horario). Se usa JavaScript y no `animation-delay`
  porque `globals.css` aplica `animation: none !important` con `prefers-reduced-motion`.
- **Alternatives considered**: un contexto en `HorariosVigentes` que reciba el horario pendiente
  y dibuje el aviso arriba de la tira. Agrega estado compartido y, si el aviso queda dentro del
  flujo de la página, empuja el contenido o queda fuera de la pantalla si el visitante bajó.

## R4. Timeout de la lectura del mapa

- **Hecho**: `pedirConFetch` (`src/api/client.ts`) corta a los **5 s** por defecto. Con el
  backend dormido (~30 s), la función termina en el error recuperable a los 5 s.
- **Decision**: `ESPERA_LECTURA_MS = 45_000` en `src/config/experiencia.ts`, pasado como
  `timeoutMs` en `obtenerMapa` (`src/api/asientos-servidor.ts`), que ya acepta la opción
  mediante `pedirSinCache`. Ningún otro pedido cambia.
- **Rationale**: 45 s cubre el despertar con margen y sigue cortando un backend caído de verdad.
  El hosting del frontend tiene que permitir pedidos de ≥ 60 s (Next en Node no tiene límite;
  en serverless se configura la duración máxima).

## R5. Pruebas

- `useLinkStatus` solo funciona dentro del App Router real; en Vitest devolvería siempre
  `pending: false`. Por eso la lógica con tiempo y anuncios vive en `AvisoCargaHorario`, que
  recibe `hora` y `sala` por props y se prueba con timers simulados. `IndicadorCarga` es una capa
  fina que se cubre con Playwright.
- El mock (`scripts/mock-api.mjs`) suma una función "lenta" cuyo mapa responde con demora
  (`MOCK_DEMORA_MS`, 8 s por defecto), enlazada desde un horario de los fixtures, para el e2e.
