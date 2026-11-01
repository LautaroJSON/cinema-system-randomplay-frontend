<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Rationale: MINOR — se agrega un principio nuevo (IX) y se amplía materialmente el VIII y las
           puertas de calidad. No se elimina ni redefine de forma incompatible ningún principio.

Modified principles:
  - VIII. "Calidad de Código y Bordes Servidor/Cliente": las consultas públicas pasan de PUEDEN a
    DEBEN resolverse en el servidor.

Added sections:
  - IX. Páginas Públicas Indexables (SEO): datos en el servidor, revalidación por ruta, Metadata
    API, URLs canónicas, HTML semántico, JSON-LD, sitemap/robots, noindex en el flujo privado,
    404 reales, next/image y Core Web Vitals.
  - Flujo de Desarrollo: nueva puerta de CI 5 (metadata y contenido en el HTML inicial) y revisión
    explícita del Principio IX.

Removed sections: ninguna

Templates / archivos dependientes revisados:
  ✅ .specify/templates/plan-template.md, spec-template.md, tasks-template.md — leen la
     constitución en runtime; no requieren cambios.

Follow-up TODOs: ninguno. Nota: la API no expone slug ni póster; el Principio IX ya prevé ambos.

Historia: (plantilla) → 1.0.0 (2026-10-29): ratificación inicial con los Principios I–VIII.
-->

# Sistema de Reserva de Entradas de Cine (Frontend) — Constitución

Frontend web del comprador en Next.js (App Router) con React y TypeScript, que consume la API
del backend `cinema-system-randomplay-backend`. Esta constitución define los principios no
negociables del proyecto. Las palabras **DEBE**, **NO DEBE**, **DEBERÍA** y **PUEDE** se
interpretan según su sentido normativo habitual (RFC 2119).

## Core Principles

### I. Contrato OpenAPI como Fuente de Verdad

El contrato de la API (`docs/openapi.json`, generado por el backend) define la forma de cada
endpoint. El frontend no la reinventa.

- Los tipos TypeScript de requests y responses **DEBEN** generarse desde `openapi.json` con
  `openapi-typescript` (u otra herramienta equivalente que genere desde el contrato). **NO DEBEN**
  escribirse a mano ni editarse los archivos generados.
- Cuando cambia el contrato, los tipos **DEBEN** regenerarse y los errores de compilación
  resultantes **DEBEN** resolverse antes de mergear.
- Todo acceso a la API **DEBE** pasar por un único módulo cliente (`src/api/`) que conoce la URL
  base, los headers de autenticación y el parseo de errores. Los componentes **NO DEBEN** llamar a
  `fetch` contra la API directamente.
- `docs/api.md` es la guía de uso (flujo, autenticación, reglas); ante una contradicción con
  `openapi.json`, manda `openapi.json` y la discrepancia se reporta al backend.

**Rationale**: un contrato generado convierte cada cambio del backend en un error de compilación
visible, en lugar de un bug silencioso en runtime; un cliente único evita que la autenticación y
el manejo de errores se dupliquen con variantes en cada pantalla.

### II. Errores Decididos por `codigo`

Los errores de negocio llegan como `application/problem+json` (RFC 9457) con la extensión
`codigo`.

- La lógica del frontend **DEBE** decidir por `codigo` (o por `status` en las consultas que no lo
  traen) y **NO DEBE** decidir por `title` ni por `detail`, que son texto para humanos.
- Cada `codigo` documentado en `docs/api.md` **DEBE** tener un manejo explícito en la interfaz,
  según la columna "Qué hacer en el frontend" (por ejemplo: `asientos-no-disponibles` marca los
  asientos como ocupados y refresca el mapa; `carrito-no-encontrado` descarta el token).
- Un `codigo` desconocido o un error de red **DEBE** caer en un estado de error genérico
  recuperable (mensaje claro y acción para reintentar o volver), nunca en una pantalla rota.
- `pedido-invalido` **DEBE** mostrar los mensajes de `errors` junto al campo correspondiente.
- `demasiados-pedidos` **DEBE** respetar el header `Retry-After` antes de permitir un reintento.

**Rationale**: los textos cambian y se traducen; los códigos son el contrato estable. Mapear cada
código a una acción concreta hace que los casos de concurrencia (asientos tomados por otro
comprador, carrito vencido) sean parte del diseño y no excepciones olvidadas.

### III. Token del Carrito como Credencial Privada

El token que devuelve `POST /api/funciones/{funcionId}/carritos` es la única credencial del
comprador anónimo y se entrega una sola vez.

- El token **DEBE** guardarse en `sessionStorage` junto con el `id` del carrito (o en un mecanismo
  de alcance igual o más restringido) y **NO DEBE** guardarse en `localStorage`, en cookies sin
  `HttpOnly` de larga duración, en la URL, en query strings ni en el estado serializado al
  servidor.
- El token **NO DEBE** aparecer en logs, mensajes de error, herramientas de analítica ni
  reportes de errores.
- El token **DEBE** enviarse solo como `Authorization: Bearer {token}` y solo a los endpoints de
  ese carrito.
- Ante `401` o `404 carrito-no-encontrado` el token guardado **DEBE** descartarse y el comprador
  **DEBE** poder empezar un carrito nuevo.
- Al salir del flujo de forma explícita, el frontend **DEBE** llamar a `POST .../abandono` para
  liberar los asientos; **DEBERÍA** intentarlo también al cerrar la pestaña cuando el navegador lo
  permita.
- El comprador **NO DEBE** necesitar cuenta ni login. El esquema `Personal` (OIDC) no se usa en el
  frontend del comprador.

**Rationale**: quien tiene el token controla el carrito. Limitar su alcance a la sesión de la
pestaña y mantenerlo fuera de URLs y logs evita que se filtre al compartir un enlace o un
reporte de errores.

### IV. La API Decide, el Frontend Refleja

Las reglas de negocio (retención, máximos, cupos, límites de creación) viven en el backend.

- El frontend **PUEDE** anticipar reglas para dar buena experiencia (por ejemplo, impedir elegir
  más de 10 asientos), pero **NO DEBE** tratar esa anticipación como autoridad: la respuesta de la
  API siempre prevalece.
- Los valores configurables del backend (minutos de retención, máximo por carrito, cupo por
  función) **NO DEBEN** quedar hardcodeados como lógica de negocio; si se usan para la UI, se
  definen en un solo lugar y se documentan como valores de experiencia, no de validación.
- La cuenta regresiva del carrito **DEBE** calcularse desde `venceEn` devuelto por la API y, al
  llegar a cero, el carrito **DEBE** tratarse como expirado.
- `PUT .../asientos` **DEBE** enviar siempre la selección completa; el frontend **NO DEBE**
  enviar diferencias.
- Solo un carrito `Activo` **PUEDE** modificarse desde la interfaz; uno `Abandonado` o `Expirado`
  se muestra en modo lectura con la opción de empezar de nuevo.
- La disponibilidad de asientos **DEBE** refrescarse desde la API tras cualquier conflicto; el
  frontend **NO DEBE** asumir que un asiento sigue libre porque lo estaba al cargar el mapa.

**Rationale**: duplicar reglas en el cliente crea dos fuentes de verdad que divergen al cambiar la
configuración; reflejar el estado del servidor mantiene la interfaz correcta frente a otros
compradores concurrentes.

### V. Formatos Exactos: Dinero, Fechas y Asientos

- El dinero (`{ monto, moneda }`) **DEBE** tratarse con `monto` como texto decimal. **NO DEBE**
  convertirse a `number` para hacer aritmética de punto flotante; para mostrarlo se formatea con
  `Intl.NumberFormat` (u otra vía que no pierda precisión) y cualquier suma **DEBE** hacerse en
  unidades enteras (centavos) o con una librería decimal.
- Las fechas (ISO 8601 con offset) **DEBEN** parsearse respetando el offset y mostrarse con un
  formato y zona horaria explícitos y consistentes en toda la aplicación.
- Los asientos se identifican por `{ fila, numero }` (fila A–Z, número desde 1); el mapa se
  construye a partir de `cantidadAsientos` y `asientosDisponibles` de cada fila.
- Los enums de texto (`estado`, `clasificacion`) **DEBEN** traducirse a etiquetas visibles en un
  único lugar, con manejo explícito de valores desconocidos.

**Rationale**: los errores de redondeo en precios y las horas mostradas en la zona equivocada son
bugs silenciosos y caros de detectar; fijar el formato en el borde los elimina.

### VI. Accesibilidad WCAG 2.2 AA y Mobile-First

- Toda pantalla **DEBE** cumplir WCAG 2.2 nivel AA: contraste suficiente, foco visible, orden de
  foco lógico, etiquetas accesibles y navegación completa por teclado.
- El mapa de asientos **DEBE** ser operable por teclado y por lector de pantalla: cada asiento
  expone su fila, número y estado (libre, ocupado, seleccionado) sin depender solo del color.
- La cuenta regresiva y los cambios de estado relevantes (asientos perdidos, carrito expirado)
  **DEBEN** anunciarse a tecnologías de asistencia sin interrumpir en exceso (por ejemplo, con
  regiones `aria-live` de cortesía y avisos puntuales al acercarse el vencimiento).
- El diseño **DEBE** pensarse primero para pantallas de teléfono (desde 360 px de ancho) sin
  scroll horizontal de la página, y luego ampliarse a pantallas grandes. Los objetivos táctiles
  **DEBEN** cumplir el tamaño mínimo de WCAG 2.2 (2.5.8).

**Rationale**: la mayoría de las compras de entradas se hacen desde el teléfono, y un mapa de
asientos inaccesible deja afuera a compradores que dependen de teclado o lector de pantalla.

### VII. Testing por Criterio — Donde Aporta Valor

Los tests se escriben cuando reducen un riesgo real, no por obligación general.

- Una tarea **DEBERÍA** llevar tests cuando incluye al menos uno de estos casos:
  - el manejo de un `codigo` de error o de una transición de estado del carrito;
  - la cuenta regresiva y el tratamiento del vencimiento;
  - la lógica de selección de asientos (máximos, selección completa, conflictos);
  - formateo o cálculo de dinero y fechas;
  - el almacenamiento y descarte del token del carrito;
  - cualquier comportamiento donde un bug sería caro, difícil de detectar o silencioso.
- Una tarea **NO NECESITA** tests cuando es trivial: componentes puramente presentacionales sin
  lógica, estilos, tipos generados, configuración o documentación.
- Los tests unitarios y de componentes **DEBEN** usar Vitest y Testing Library, consultando por
  roles y nombres accesibles (lo que además verifica el Principio VI). Las respuestas de la API
  **DEBEN** simularse a nivel de red (por ejemplo, con MSW) usando los tipos generados, no con
  mocks de módulos internos.
- Los tests end-to-end (Playwright) **PUEDEN** agregarse para el flujo del comprador cuando el
  riesgo lo justifique.
- En `/speckit-plan`, el plan **DEBE** indicar qué se testea y qué no, con una línea de
  justificación por cada decisión. En `/speckit-tasks`, las tareas de test se incluyen cuando
  cumplen los criterios anteriores y se omiten cuando no aportan valor.

**Rationale**: testear todo por obligación encarece cada cambio sin reducir riesgo en el código
trivial; concentrar el esfuerzo en el manejo de errores, el carrito y los formatos cubre los
puntos donde un bug le cuesta la compra al usuario.

### VIII. Calidad de Código y Bordes Servidor/Cliente

- TypeScript **DEBE** usarse en modo `strict`; **NO DEBE** usarse `any` explícito ni `@ts-ignore`
  sin un comentario que justifique la excepción.
- ESLint (con las reglas de Next.js y de accesibilidad `jsx-a11y`) y el formateador del proyecto
  **DEBEN** pasar sin errores.
- Los Server Components son el valor por defecto. Un componente **DEBE** marcarse `"use client"`
  solo si necesita estado, efectos, eventos del navegador o acceso a `sessionStorage`; todo lo que
  toca el token del carrito vive en componentes de cliente.
- Las consultas públicas (catálogo, detalle, horarios) **DEBEN** resolverse en el servidor
  (Principio IX); las operaciones del carrito con token **DEBEN** ejecutarse desde el cliente o desde un borde del
  servidor que no persista ni registre el token.
- Los componentes **NO DEBEN** contener lógica de negocio ni de transporte: llaman al módulo
  cliente de la API o a hooks del dominio del frontend y renderizan su resultado.
- Las variables de entorno con prefijo `NEXT_PUBLIC_` **NO DEBEN** contener secretos.

**Rationale**: estas restricciones son baratas desde el principio y caras de introducir después;
separar con claridad servidor y cliente evita filtrar el token al servidor y mantiene el
JavaScript enviado al navegador al mínimo.

### IX. Páginas Públicas Indexables (SEO)

Las páginas públicas (catálogo, detalle de película, sucursales y horarios del día) son la puerta
de entrada desde los buscadores y se diseñan para ser indexadas.

- Las páginas públicas **DEBEN** obtener sus datos en el servidor (Server Components) para que el
  HTML inicial ya contenga el contenido principal: título, sinopsis, duración, clasificación,
  sucursales y horarios. **NO DEBEN** cargar ese contenido con `useEffect` ni con fetch del lado
  del cliente después de montar.
- La interactividad se agrega como islas de componentes de cliente dentro de páginas de servidor
  (Principio VIII), sin convertir una página pública entera en `"use client"`.
- La frescura de los datos **DEBE** declararse por ruta: renderizado estático con revalidación
  (ISR / `revalidate`) para el catálogo y el detalle, y una revalidación corta o un renderizado por
  request para los horarios del día. La disponibilidad de asientos **NO DEBE** cachearse.
- Cada página pública **DEBE** declarar su metadata con la Metadata API de Next.js
  (`metadata` / `generateMetadata`): `title` y `description` únicos, URL canónica, Open Graph y
  `lang="es"` en el documento.
- Las URLs públicas **DEBEN** ser legibles, estables y en español (por ejemplo,
  `/peliculas/{id}`). Si se agrega un slug derivado del título, la ruta **DEBE** resolver por `id`
  y redirigir con `308` a la URL canónica cuando el slug no coincida.
- El HTML **DEBE** ser semántico: un único `h1` por página, jerarquía de encabezados sin saltos,
  enlaces reales (`<a>` vía `next/link`) para la navegación entre páginas públicas, y no botones
  con `onClick`.
- El detalle de película **DEBERÍA** incluir datos estructurados JSON-LD de schema.org (`Movie`
  y, cuando haya horarios, `ScreeningEvent`) construidos desde la respuesta de la API.
- El proyecto **DEBE** generar `sitemap.xml` (`app/sitemap.ts`) con las películas activas y
  `robots.txt` (`app/robots.ts`).
- Las páginas del flujo privado (mapa de asientos, carrito, email de entrega) y cualquier página
  que dependa del token **DEBEN** marcarse `noindex` y quedar fuera del sitemap.
- Las páginas inexistentes **DEBEN** responder con un `404` real (`notFound()`), no con una página
  `200` que diga "no encontrado".
- Las imágenes **DEBEN** usar `next/image` con `alt` descriptivo y dimensiones declaradas. Hoy la
  API no expone pósters; cuando los exponga, se aplican estas reglas.
- Las páginas públicas **DEBERÍAN** cumplir los umbrales "buenos" de Core Web Vitals (LCP ≤ 2,5 s,
  INP ≤ 200 ms, CLS ≤ 0,1) medidos en un perfil móvil.

**Rationale**: quien busca "horarios de {película} hoy" debe encontrar la página sin pasar por la
home. El contenido presente en el HTML inicial, las URLs estables y la metadata por página son lo
que los buscadores indexan; las páginas del carrito no aportan nada al índice y exponerlas solo
genera resultados rotos.

## Restricciones de Plataforma y Tecnología

- Stack fijo: Next.js con App Router, React y TypeScript sobre Node.js LTS. Cambiar de framework
  o de versión mayor de Next.js requiere una enmienda a esta constitución.
- El backend es `cinema-system-randomplay-backend` (.NET). El frontend **NO DEBE** implementar
  lógica de negocio que corresponda al backend ni acceder a su base de datos.
- Mientras el backend no configure CORS, el acceso a la API desde el navegador **DEBE** hacerse
  a través de un proxy del mismo origen (por ejemplo, `rewrites` de Next.js). La URL del backend
  se configura por variable de entorno, nunca hardcodeada.
- Solo existe el flujo del comprador (catálogo → función → asientos → carrito → email). El pago
  todavía no existe en la API; ninguna pantalla **DEBE** simular un pago como si fuera real.
- Las dependencias nuevas **DEBEN** justificarse en el PR; se prefiere la plataforma (Web APIs,
  `Intl`, capacidades de Next.js) antes que una librería.

## Flujo de Desarrollo y Puertas de Calidad

- Toda contribución llega mediante Pull Request. El PR **DEBE** describir qué principios toca y
  cómo los respeta.
- Puertas de CI obligatorias antes de merge:
  1. Los tipos generados están al día con `openapi.json` y `tsc` compila en modo `strict` sin
     errores.
  2. ESLint (incluido `jsx-a11y`) pasa sin errores.
  3. Pasan todos los tests existentes.
  4. `next build` termina sin errores.
  5. Las páginas públicas nuevas o modificadas declaran metadata y su contenido principal está
     en el HTML inicial (Principio IX).
- La revisión de código **DEBE** verificar explícitamente el manejo por `codigo` (Principio II),
  el tratamiento del token (Principio III), la accesibilidad de los componentes nuevos
  (Principio VI) y la indexabilidad de las páginas públicas (Principio IX).
- Cualquier atajo o simplificación consciente **DEBE** documentarse en el PR o el commit con su
  razón (ver Gobernanza).

## Governance

- Esta constitución tiene precedencia sobre cualquier otra práctica o convención del proyecto.
- **Enmiendas**: cualquier cambio a un principio o sección se propone en un PR que modifica este
  archivo, explica la motivación y actualiza la versión y las fechas. Requiere aprobación de un
  mantenedor del proyecto.
- **Política de versionado** (SemVer del documento):
  - MAJOR: eliminación o redefinición incompatible de un principio o de la gobernanza.
  - MINOR: adición de un principio o sección, o ampliación material de una guía existente.
  - PATCH: aclaraciones, correcciones de redacción y refinamientos no semánticos.
- **Cumplimiento**: toda revisión de PR verifica el cumplimiento de estos principios. Una
  desviación deliberada de un principio **DEBE** documentarse explícitamente en el PR o el
  mensaje de commit, indicando el principio afectado y la razón; **NO DEBE** introducirse en
  silencio. Las desviaciones no documentadas son motivo de rechazo del PR.
- Cuando el contrato del backend cambia de forma incompatible, se revisa esta constitución junto
  con la regeneración de tipos (Principio I).
- Para guía de desarrollo en runtime, los comandos de Spec Kit (`/speckit-plan`,
  `/speckit-tasks`, `/speckit-implement`) leen esta constitución como fuente de verdad.

**Version**: 1.1.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
