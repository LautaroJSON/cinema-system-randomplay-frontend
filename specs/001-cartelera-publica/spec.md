# Feature Specification: Base del frontend y cartelera pública

**Feature Branch**: `001-cartelera-publica`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Base del frontend y páginas públicas: catálogo de películas en cartelera, detalle de película con sinopsis, duración y clasificación, y horarios del día por sucursal. Páginas indexables según el Principio IX, con la dirección visual de DESIGN.md."

## Clarifications

### Session 2026-11-01

- Q: ¿Arrancamos el proyecto con TypeScript 6.0 o con TypeScript 7.0, que es la última versión? → A: TypeScript 6.0.x; se migra a 7 cuando `typescript-eslint` lo soporte (decisión técnica, registrada en plan.md y research.md R2).
- Q: ¿Cómo evitamos que alguien vea horarios de ayer o ya empezados cuando una ficha estuvo un rato largo sin visitas? → A: caché de página completa con regeneración (home 600 s, ficha 60 s) más un componente en el navegador que oculta los horarios ya comenzados según la hora del dispositivo y, si no queda ninguno, vuelve a pedir la página.
- Q: ¿Las funciones de acceso a la API las escribimos nosotros sobre `fetch`, o usamos `openapi-fetch`? → A: propias sobre `fetch`, tipadas con los tipos generados, para todo el proyecto (decisión técnica, registrada en research.md R6).
- Q: Como el build necesita datos del backend para armar la home y el sitemap, ¿qué hacemos cuando el backend no está disponible durante el build? → A: un mock de la API sin dependencias que sirve los fixtures, usado en CI y en local; en producción el build apunta al backend real (registrado en research.md R5).
- Q: Mientras no exista la página de butacas, ¿qué hace un horario cuando alguien lo toca? → A: enlace real a la página de butacas de la función desde ahora; da "no encontrada" hasta que llegue esa funcionalidad, y esta funcionalidad no se publica en producción sin la siguiente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver qué hay en cartelera (Priority: P1)

Una persona entra al sitio desde el teléfono (directo o desde un buscador) y ve el estante de
películas activas: título, duración y clasificación de cada una, y si todavía le quedan
funciones hoy. Desde cada película puede abrir su ficha.

**Why this priority**: es la puerta de entrada al sitio y la base sobre la que se apoyan todas
las demás páginas (estructura común, identidad visual, estados de error). Sin catálogo no hay
recorrido posible.

**Independent Test**: con el backend devolviendo un conjunto conocido de películas activas, abrir
la home y verificar que aparecen todas, con su duración y clasificación, y que cada una enlaza a
su ficha. Verificar que el contenido está en la primera respuesta de la página, sin depender de
que el navegador ejecute código.

**Acceptance Scenarios**:

1. **Given** hay películas activas en el catálogo, **When** la persona abre la home, **Then** ve
   cada película con título, duración en minutos y clasificación por edad en etiqueta legible
   (por ejemplo, "+13"), y un enlace a su ficha.
2. **Given** una película activa ya no tiene funciones hoy, **When** aparece en el catálogo,
   **Then** se muestra con una indicación visible de que hoy no tiene más funciones, sin
   ocultarla.
3. **Given** el catálogo está vacío, **When** la persona abre la home, **Then** ve un estado vacío
   con el tono de la marca que explica que no hay películas en cartelera, en lugar de una página
   en blanco.
4. **Given** el backend no responde, **When** la persona abre la home, **Then** ve un mensaje de
   error claro con una acción para reintentar, sin una pantalla rota.
5. **Given** un buscador pide la home, **When** recibe la página, **Then** el HTML inicial ya
   contiene los títulos de las películas, un título y descripción propios de la página y su URL
   canónica.

---

### User Story 2 - Leer la ficha de una película (Priority: P2)

Desde el catálogo o desde un buscador, la persona abre la ficha de una película y lee la
sinopsis, la duración y la clasificación para decidir si la quiere ver.

**Why this priority**: es la página que más se va a indexar ("{película} sinopsis") y la que
convierte el interés en una elección de función. Depende de la base de la historia 1, pero
puede probarse sola con una URL directa.

**Independent Test**: abrir la URL pública de una película conocida y verificar título,
sinopsis, duración y clasificación; abrir la URL de una película inexistente y verificar que
responde como página no encontrada.

**Acceptance Scenarios**:

1. **Given** una película activa, **When** la persona abre su ficha, **Then** ve el título como
   encabezado principal, la sinopsis completa, la duración y la clasificación.
2. **Given** una URL de película que no existe o no está activa, **When** se abre, **Then** la
   página responde como "no encontrada" (no como una página válida que dice "no encontrada"),
   con un mensaje de la marca y un enlace de vuelta a la cartelera.
3. **Given** un buscador o una red social pide la ficha, **When** recibe la página, **Then**
   obtiene un título y descripción propios de esa película (derivados del título y la sinopsis),
   la URL canónica, la vista previa para compartir y datos estructurados de la película.
4. **Given** la película no tiene imagen de carátula, **When** se muestra la ficha o la tarjeta del
   catálogo, **Then** se ve una carátula tipográfica (título, código de cinta, duración y
   clasificación) en lugar de una foto genérica.

---

### User Story 3 - Ver los horarios de hoy por sucursal (Priority: P3)

En la ficha de la película, la persona ve en qué sucursales se proyecta hoy y, para cada una, los
horarios que todavía no empezaron, con la sala y el precio de la entrada. Cada horario es el punto
de partida para elegir butacas.

**Why this priority**: responde la búsqueda "horarios de {película} hoy" y conecta las páginas
públicas con el flujo de compra. Necesita la ficha (historia 2) como contenedor.

**Independent Test**: con el backend devolviendo dos sucursales con horarios conocidos para una
película, abrir su ficha y verificar que aparecen agrupados por sucursal, en orden cronológico,
con hora, sala y precio, y que cada horario es un enlace.

**Acceptance Scenarios**:

1. **Given** una película con funciones hoy en varias sucursales, **When** la persona abre su
   ficha, **Then** ve un bloque por sucursal con su nombre y, dentro, los horarios de hoy en orden
   cronológico, cada uno con hora de inicio, nombre de la sala y precio con moneda explícita.
2. **Given** una función ya comenzó, **When** se muestra la ficha, **Then** ese horario no aparece
   en la lista.
3. **Given** la película no tiene funciones hoy en ninguna sucursal, **When** la persona abre la
   ficha, **Then** ve la información de la película y un aviso de que hoy no hay funciones, sin
   bloques de sucursal vacíos.
4. **Given** un horario visible, **When** la persona lo activa con toque, clic o teclado, **Then**
   navega a la página de selección de butacas de esa función mediante un enlace real.
5. **Given** la información de la película carga pero la de horarios falla, **When** se muestra la
   ficha, **Then** la sinopsis y los datos siguen visibles y el bloque de horarios muestra un error
   recuperable con opción de reintentar.

---

### User Story 4 - Navegar el sitio de forma consistente y accesible (Priority: P2)

Cualquier página pública comparte la misma estructura: identidad de RandomPlay, navegación de
vuelta a la cartelera, y estados de error y "no encontrado" con el mismo tono. Se puede recorrer
completa con teclado o lector de pantalla y desde un teléfono de 360 px de ancho.

**Why this priority**: es la "base del frontend" que piden las demás funcionalidades; si no
existe desde el principio, cada página nueva reinventa el marco, los estados de error y los
estilos.

**Independent Test**: recorrer catálogo → ficha → horario solo con teclado y con un lector de
pantalla; abrir una URL inexistente cualquiera; revisar todas las páginas a 360 px.

**Acceptance Scenarios**:

1. **Given** cualquier página pública, **When** se navega solo con teclado, **Then** todos los
   enlaces y controles se alcanzan en un orden lógico y el foco es siempre visible.
2. **Given** una URL que no corresponde a ninguna página, **When** se abre, **Then** responde como
   no encontrada con el mensaje de la marca y un enlace a la cartelera.
3. **Given** un teléfono de 360 px de ancho, **When** se abre cualquier página pública, **Then**
   no hay scroll horizontal y los objetivos táctiles cumplen el tamaño mínimo.
4. **Given** cualquier página pública, **When** se analiza su estructura, **Then** tiene un único
   encabezado principal, una jerarquía de encabezados sin saltos y el idioma declarado en español.

---

### Edge Cases

- **Película desactivada entre la carga del catálogo y la apertura de la ficha**: la ficha
  responde como no encontrada.
- **Clasificación desconocida** (un valor que la API agregue en el futuro): se muestra el valor
  tal cual en la etiqueta, sin romper la página.
- **Sinopsis muy larga o vacía**: la larga se muestra completa con ancho de línea legible; la
  vacía omite el bloque sin dejar un hueco.
- **Títulos muy largos**: se cortan en varias líneas sin desbordar la tarjeta ni la pantalla.
- **Sucursal que aparece en la lista de hoy pero cuyos horarios ya pasaron todos** (la lista se
  consultó y luego empezaron las funciones): el bloque de esa sucursal se omite.
- **Ficha sin visitas durante mucho tiempo** (por ejemplo, desde el día anterior): la versión en
  caché puede traer horarios de ayer o ya comenzados. En el navegador se ocultan los horarios
  cuya hora de inicio ya pasó; si no queda ninguno, se muestra "Actualizando horarios…" y la
  página se vuelve a pedir una vez, ya regenerada. Si sigue sin horarios vigentes, se muestra el
  aviso de que hoy no hay funciones.
- **Horario que comienza mientras la persona mira la página**: se oculta al pasar su hora de
  inicio. Si la persona lo activa justo antes, la página de butacas informa que la función ya
  comenzó (responsabilidad del flujo de compra).
- **Identificador de película mal formado en la URL**: responde como no encontrada, no como error
  del servidor.

## Requirements *(mandatory)*

### Functional Requirements

**Base común**

- **FR-001**: Todas las páginas públicas DEBEN compartir un marco común con la identidad de
  RandomPlay y un enlace a la cartelera desde cualquier página.
- **FR-002**: El sitio DEBE aplicar la dirección visual de DESIGN.md: tema oscuro único, paleta y
  tipografía definidas, lenguaje gráfico de cinta VHS (lomo, etiqueta pegada, corte en diagonal,
  sombra dura) y movimiento limitado a hover, foco y presión.
- **FR-003**: El sitio DEBE tener una página "no encontrada" que responda como tal ante cualquier
  URL inexistente y ante películas inexistentes o inactivas.
- **FR-004**: El sitio DEBE tener un estado de error genérico recuperable (mensaje claro y acción
  para reintentar o volver) para fallos del backend o de red.
- **FR-005**: Todos los textos visibles DEBEN estar en español rioplatense con voseo; el humor
  seco se limita a estados vacíos y "no encontrado".
- **FR-006**: Las etiquetas de clasificación DEBEN traducirse en un único lugar (`ATP` → "ATP",
  `Mas13` → "+13", `Mas16` → "+16", `Mas18` → "+18") y mostrar el valor original ante uno
  desconocido. Se distinguen por texto y forma, no por color.
- **FR-007**: Las horas DEBEN mostrarse en formato de 24 horas en la zona horaria de Argentina, de
  forma consistente en todo el sitio; los precios DEBEN mostrarse con su moneda explícita y sin
  pérdida de precisión.

**Catálogo**

- **FR-010**: La home DEBE listar todas las películas activas que devuelve la API, con título,
  duración y clasificación, cada una enlazada a su ficha.
- **FR-011**: Las películas sin funciones hoy DEBEN seguir visibles, marcadas como "sin funciones
  hoy".
- **FR-012**: El catálogo DEBE presentarse como estante: una película destacada a ancho completo y
  el resto en grilla regular. La destacada es la primera película con funciones hoy en el orden
  que devuelve la API.
- **FR-013**: El catálogo vacío DEBE mostrar un estado vacío propio.

**Ficha de película**

- **FR-020**: Cada película activa DEBE tener una ficha en una URL pública estable y en español,
  identificada por el id de la película.
- **FR-021**: La ficha DEBE mostrar título, sinopsis, duración y clasificación.
- **FR-022**: Mientras la API no provea imágenes, la ficha y las tarjetas DEBEN usar la carátula
  tipográfica descrita en DESIGN.md.

**Horarios del día**

- **FR-030**: La ficha DEBE mostrar las sucursales con funciones hoy de esa película y, por cada
  una, los horarios de hoy todavía no comenzados, ordenados por hora de inicio.
- **FR-031**: Cada horario DEBE mostrar hora de inicio, sala y precio de la entrada, y DEBE ser un
  enlace a la selección de butacas de esa función.
- **FR-032**: Sin funciones hoy, la ficha DEBE indicarlo en lugar de los horarios.
- **FR-033**: Un fallo al obtener los horarios NO DEBE ocultar la información de la película.
- **FR-034**: En el navegador, los horarios cuya hora de inicio ya pasó (según la hora del
  dispositivo) DEBEN ocultarse, también los que ya venían en una versión en caché. Si no queda
  ninguno visible, la página DEBE mostrar "Actualizando horarios…" y volver a pedirse una sola
  vez; si sigue sin horarios vigentes, DEBE mostrar el aviso de FR-032. Sin JavaScript, la lista
  del HTML inicial se muestra tal cual.

**Indexabilidad (Principio IX)**

- **FR-040**: El contenido principal de cada página pública (títulos, sinopsis, duración,
  clasificación, sucursales y horarios) DEBE estar en el HTML de la primera respuesta.
- **FR-041**: Cada página pública DEBE declarar título y descripción únicos, URL canónica, vista
  previa para redes sociales e idioma español.
- **FR-042**: La ficha DEBE incluir datos estructurados de la película y, cuando haya horarios, de
  cada función del día.
- **FR-043**: El sitio DEBE publicar un mapa del sitio con la home y las fichas de películas
  activas, y un archivo de instrucciones para buscadores que excluya las rutas del flujo privado.
- **FR-044**: Las páginas públicas DEBEN servirse desde una caché que se regenera en segundo
  plano: la home, cuando su versión tiene más de 10 minutos; la ficha (que incluye los horarios),
  cuando tiene más de 60 segundos. La regeneración la dispara una visita, así que la primera
  visita tras un período sin tráfico puede recibir una versión vieja (cubierto por FR-034).
- **FR-045**: La navegación entre páginas públicas DEBE hacerse con enlaces reales.

**Accesibilidad y mobile-first**

- **FR-050**: Todas las páginas DEBEN cumplir WCAG 2.2 AA: contraste, foco visible, orden de foco
  lógico, nombres accesibles y navegación completa por teclado.
- **FR-051**: Todas las páginas DEBEN funcionar desde 360 px de ancho sin scroll horizontal, con
  objetivos táctiles de al menos 24 × 24 px.
- **FR-052**: Cada página DEBE tener un único encabezado principal y una jerarquía de
  encabezados sin saltos.
- **FR-053**: Con la preferencia de movimiento reducido activa, NO DEBE haber desplazamientos
  animados.

### Key Entities

- **Película**: título, duración en minutos, clasificación por edad, sinopsis (solo en la ficha) e
  indicador de si le quedan funciones hoy. Se identifica por un id estable.
- **Sucursal**: un cine de la cadena, con nombre. En esta funcionalidad solo aparece en el
  contexto de una película (sucursales que la proyectan hoy).
- **Horario (función del día)**: una proyección de una película en una sucursal: hora de inicio,
  sala y precio de la entrada. Es el punto de partida del flujo de compra.
- **Clasificación**: categoría de edad (`ATP`, `+13`, `+16`, `+18`) con su etiqueta visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona encuentra los horarios de hoy de una película partiendo de la home en
  2 toques/clics o menos (película → ficha con horarios).
- **SC-002**: El 100 % de las páginas públicas tienen su contenido principal, título, descripción y
  URL canónica presentes al pedir la página sin ejecutar código del lado del navegador.
- **SC-003**: El 100 % de las URLs de películas inexistentes y de rutas desconocidas responden como
  "no encontrada".
- **SC-004**: En un perfil móvil, las páginas públicas cargan su contenido principal en 2,5 s o
  menos, responden a interacciones en 200 ms o menos y no tienen saltos de diseño perceptibles
  (umbrales "buenos" de Core Web Vitals).
- **SC-005**: Ninguna página pública presenta errores de accesibilidad de nivel A o AA en una
  auditoría automática, y el recorrido catálogo → ficha → horario se completa solo con teclado y
  con lector de pantalla.
- **SC-006**: Ninguna página pública presenta scroll horizontal entre 360 px y 1440 px de ancho.
- **SC-007**: Ningún horario ya comenzado queda visible para la persona más de 60 segundos después
  de su hora de inicio, aunque la versión en caché sea vieja (con JavaScript activo y el reloj del
  dispositivo en hora).
- **SC-008**: El mapa del sitio contiene el 100 % de las películas activas y ninguna ruta del flujo
  privado.

## Assumptions

- **"Horarios del día por sucursal"** se presentan dentro de la ficha de cada película, agrupados
  por sucursal. No hay una página propia por sucursal: la API no expone un listado general de
  sucursales ni la cartelera de una sucursal, solo las sucursales que proyectan una película hoy.
- **Búsqueda por título**: la API la permite, pero queda fuera de esta funcionalidad; el catálogo
  lista todo.
- **"Hoy"** lo define la API; el frontend no calcula qué funciones son de hoy ni filtra por fecha.
- **Zona horaria**: Argentina (UTC−03:00), ya que la moneda es ARS y las fechas de ejemplo vienen
  con ese offset.
- **URLs**: la ficha vive en `/peliculas/{id}`. No se agrega slug derivado del título en esta
  funcionalidad (puede agregarse después con la redirección que exige el Principio IX).
- **Película destacada**: se elige con una regla simple (primera con funciones hoy) porque la API
  no expone una "destacada".
- **Selección de butacas**: la página de destino de cada horario pertenece a la siguiente
  funcionalidad. Aquí se define la URL a la que apunta el enlace; la página en sí está fuera de
  alcance. Hasta entonces el enlace responde "no encontrada"; por eso esta funcionalidad **no se
publica en producción** antes que la de selección de butacas. Nota para esa funcionalidad (preferencia del usuario): el mapa se genera en cada
  pedido, sin caché, y las butacas ocupadas se actualizan al recargar, sin actualización en vivo;
  la única actualización automática es la que exige el Principio IV tras un conflicto
  (`asientos-no-disponibles`).
- **Imágenes**: la API no expone pósters; se usa la carátula tipográfica hasta que existan.
- **Dependencias**: backend `cinema-system-randomplay-backend` accesible por variable de entorno,
  también durante el build de producción (la home y el mapa del sitio se generan en el build); en
  CI y en desarrollo sin backend se usa un mock de la API con datos de ejemplo;
  contrato en `docs/openapi.json` (endpoints públicos de catálogo, detalle, sucursales de hoy y
  horarios de hoy).
- **Fuera de alcance**: mapa de asientos, carrito, email de entrega, pago, búsqueda y cualquier
  pantalla del personal interno.
