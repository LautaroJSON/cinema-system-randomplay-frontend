# Contrato de rutas públicas

Lo que el sitio expone a personas y buscadores. Cada ruta se valida en e2e con JavaScript
desactivado (ver `quickstart.md`).

| Ruta | Status | Frescura | Indexable | En sitemap | `h1` |
|---|---|---|---|---|---|
| `/` | 200 | ISR 600 s | sí | sí (`priority` 1.0, `changeFrequency` daily) | "En cartelera" |
| `/peliculas/{id}` (GUID de película activa) | 200 | ISR 60 s, generada al primer pedido | sí | sí (`changeFrequency` daily) | título de la película |
| `/peliculas/{id}` inexistente, inactiva o id mal formado | 404 | — | no | no | "Esta cinta no está en el estante." |
| cualquier otra ruta desconocida | 404 | — | no | no | ídem |
| `/sitemap.xml` | 200 | 600 s | — | — | — |
| `/robots.txt` | 200 | estática | — | — | — |
| `/funciones/{funcionId}` | (siguiente funcionalidad) | sin caché | **no** (`noindex`) | no | — |

`/funciones/{funcionId}` responde 404 hasta que se implemente la selección de butacas. Esta
funcionalidad no se despliega en producción sin esa página (decisión de `/speckit-clarify`,
2026-11-01).

## Metadata por ruta

| Ruta | `title` | `description` | Canónica | Open Graph |
|---|---|---|---|---|
| `/` | "RandomPlay · En cartelera hoy" (absoluto) | Texto fijo: qué hay en cartelera y que se ven horarios de hoy por sucursal | `{SITE_URL}/` | `website`, `es_AR` |
| `/peliculas/{id}` | "{titulo}" → "{titulo} · RandomPlay" | Sinopsis recortada a ≤ 160 caracteres en palabra; sin sinopsis: "{titulo}, {duración} min, {clasificación}. Horarios de hoy en RandomPlay." | `{SITE_URL}/peliculas/{id}` | `video.movie`, `es_AR` |
| 404 | "No encontrada" | — | — | `robots: noindex` |

Todas: `<html lang="es">`, `twitter.card = summary`.

## robots.txt

```text
User-agent: *
Allow: /
Disallow: /funciones/
Disallow: /carritos/
Disallow: /api/
Sitemap: {SITE_URL}/sitemap.xml
```

## Datos estructurados (`/peliculas/{id}`)

Un `<script type="application/ld+json">` con un arreglo:

- `Movie`: `name`, `description` (si hay), `duration` (`PT{n}M`, si hay), `contentRating`
  (etiqueta), `url` (canónica).
- Por cada horario: `ScreeningEvent` con `name` ("{titulo} en {sucursal}"), `startDate`
  (ISO original con offset), `location` (`MovieTheater` con `name` = sucursal),
  `workPresented` (referencia a la `Movie`), `offers` (`Offer` con `price` = `monto`,
  `priceCurrency` = `moneda`, `url` = `{SITE_URL}/funciones/{funcionId}`),
  `eventStatus` `EventScheduled`, `eventAttendanceMode` `OfflineEventAttendanceMode`.

## Estructura semántica obligatoria

- `/`: `h1` → `h2` por película destacada / "Todas las películas"; cada tarjeta es un
  `<article>` con su título en `h3` y un único enlace a la ficha.
- `/peliculas/{id}`: `h1` (título) → `h2` "Sinopsis", `h2` "Horarios de hoy" → `h3` por
  sucursal; cada horario es un `<a>` con `<time dateTime>` y nombre accesible
  "{hora}, {sala}, {precio}".
- Enlaces entre páginas públicas con `next/link`; ningún botón con `onClick` para navegar
  (el único botón es "Reintentar" en los estados de error).

## Variables de entorno

| Variable | Ámbito | Uso |
|---|---|---|
| `API_URL` | servidor | Base del backend (pedidos del servidor y destino del proxy `/api`). |
| `SITE_URL` | servidor | Origen público para canónicas, sitemap, robots y JSON-LD. |

Ninguna lleva prefijo `NEXT_PUBLIC_`.
