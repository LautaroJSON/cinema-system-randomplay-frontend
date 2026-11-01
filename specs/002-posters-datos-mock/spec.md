# Feature Specification: Pósters de películas y datos de prueba locales

**Feature Branch**: `002-posters-datos-mock`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Una spec nueva. Simplemente hacer que el sitio web muestre las imágenes o muestre los datos que tenemos mockeados. Idealmente, que el cliente de la API, en vez de retornar una respuesta real del backend, por el momento retorne nuestros datos mockeados."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el póster de cada película (Priority: P1)

Quien recorre la cartelera reconoce las películas por su póster, en el estante y en la ficha. Cuando
una película no tiene póster, sigue viendo la carátula tipográfica actual.

**Why this priority**: el backend ya expone `imagenUrl` (contrato actualizado el 2026-11-01). El
póster es lo primero que se mira para elegir una película.

**Independent Test**: con datos que incluyen películas con y sin `imagenUrl`, abrir la cartelera y
una ficha: las que tienen póster lo muestran con texto alternativo; las que no, la carátula
tipográfica.

**Acceptance Scenarios**:

1. **Given** una película con `imagenUrl`, **When** aparece en la cartelera, **Then** su tarjeta
   muestra el póster con el texto alternativo "Póster de {título}", y el título sigue visible
   como texto debajo de la imagen.
2. **Given** una película con `imagenUrl: null`, **When** aparece en la cartelera o en su ficha,
   **Then** se ve la carátula tipográfica de la funcionalidad 001.
3. **Given** la película destacada o la ficha, **When** se carga la página, **Then** su póster es
   la imagen principal y se pide con prioridad alta, sin carga diferida.
4. **Given** cualquier página con pósters, **When** termina de cargar, **Then** no hay saltos de
   diseño: el espacio del póster está reservado desde el principio.
5. **Given** una `imagenUrl` que no es `http` o `https`, **When** llega de la API, **Then** se
   trata como si no hubiera imagen.

---

### User Story 2 - Probar el sitio con datos de prueba sin backend (Priority: P1)

Durante el desarrollo, el sitio puede mostrar el catálogo de prueba local (26 películas: 4 demo del
backend y 22 de Studio Ghibli) sin levantar el backend ni el mock de la API.

**Why this priority**: permite revisar el diseño con datos variados y pósters reales mientras el
backend no tiene datos cargados.

**Independent Test**: con el modo de datos de prueba activo y sin ningún servidor de API corriendo,
la cartelera muestra las 26 películas y cada ficha sus horarios.

**Acceptance Scenarios**:

1. **Given** el modo de datos de prueba activo, **When** se abre la cartelera, **Then** se ven las
   26 películas del catálogo local aunque no haya ningún backend accesible.
2. **Given** el modo de datos de prueba activo, **When** se abre una ficha, **Then** se ven sus
   sucursales y horarios de hoy, calculados a partir de la hora actual.
3. **Given** el modo de datos de prueba apagado, **When** se usa el sitio, **Then** los datos
   vienen del backend como hasta ahora (los tests y la CI usan este modo).

### Edge Cases

- **Póster que no carga** (URL rota o servidor caído): el espacio reservado se mantiene con el
  fondo de la carátula, sin romper la tarjeta.
- **Póster de un dominio no habilitado**: se muestra igual, sin pasar por la optimización de
  imágenes del sitio.
- **Póster con proporción distinta de 2:3**: se recorta para llenar el espacio, sin deformarse.
- **Datos de prueba ausentes** (se borró el catálogo local): con el modo activo, el sitio muestra
  el error recuperable de siempre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Las tarjetas de la cartelera, la destacada y la ficha DEBEN mostrar el póster cuando
  la película tiene `imagenUrl`, con texto alternativo "Póster de {título}".
- **FR-002**: Sin `imagenUrl` válida, DEBE mostrarse la carátula tipográfica actual.
- **FR-003**: Los pósters DEBEN tener proporción 2:3 reservada desde el primer render y recortarse
  sin deformarse.
- **FR-004**: El póster de la destacada y el de la ficha DEBEN pedirse con prioridad alta y sin
  carga diferida; el resto, con carga diferida.
- **FR-005**: Solo se aceptan URLs `http` y `https`; cualquier otro valor se trata como `null`.
- **FR-006**: El título de la película DEBE seguir siendo texto (encabezado y enlace), nunca solo
  imagen.
- **FR-007**: Mientras el modo de datos de prueba esté activo, el cliente de la API DEBE responder
  con el catálogo local en lugar de pedirle al backend, con las mismas formas del contrato, el
  mismo manejo de 404 y los horarios relativos a la hora actual.
- **FR-008**: El modo de datos de prueba DEBE activarse solo de forma explícita por variable de
  entorno del servidor y DEBE estar apagado en tests y CI.
- **FR-009**: El modo de datos de prueba y el catálogo local DEBEN poder eliminarse sin tocar
  páginas ni componentes.

### Key Entities

- **Película**: suma `imagenUrl` (URL del póster o `null`) a lo definido en la funcionalidad 001.
- **Catálogo de prueba**: archivo local con películas, detalles, sucursales y horarios con la forma
  del contrato; los horarios se guardan como minutos desde "ahora".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las películas con `imagenUrl` válida muestran su póster en la cartelera y
  en su ficha; el 100 % de las demás muestran la carátula tipográfica.
- **SC-002**: Ninguna página con pósters tiene saltos de diseño visibles al cargar (CLS ≤ 0,1).
- **SC-003**: Con el modo de datos de prueba activo, la cartelera y las fichas funcionan sin ningún
  servidor de API corriendo.
- **SC-004**: Las páginas con pósters siguen sin violaciones WCAG 2.2 AA en la auditoría
  automática y sin scroll horizontal de 360 a 1440 px.

## Assumptions

- **Temporal**: el modo de datos de prueba y el catálogo local se eliminan cuando el backend tenga
  datos reales; el mock de la API para tests (`scripts/mock-api.mjs` con fixtures) se mantiene.
- **Dominios de imágenes**: hoy los pósters vienen de `upload.wikimedia.org` (demo del backend) y
  `image.tmdb.org` (Studio Ghibli). Solo `image.tmdb.org` pasa por la optimización de imágenes:
  Wikimedia responde 429 a los pedidos del optimizador desde el servidor, así que sus pósters (y
  los de cualquier otro dominio) se muestran sin optimizar, pedidos por el navegador.
- **Sinopsis en inglés** en las películas de Studio Ghibli: así vienen de la fuente.
- **Atribución**: los pósters son de prueba y no se publican en producción.
- **Fuera de alcance**: cambios en el backend, galería de imágenes, banners.
