// Datos estructurados schema.org de la ficha (Principio IX).
import type { Clasificacion } from "./clasificacion";
import { duracionIso } from "./formato";

type PeliculaJsonLd = {
  id: string;
  titulo: string;
  duracionMinutos: number | null;
  clasificacion: Clasificacion;
  sinopsis: string | null;
};

/** Forma mínima de los horarios agrupados por sucursal que necesita el JSON-LD. */
type GrupoJsonLd = {
  sucursal: { nombre: string };
  horarios: { funcionId: string; horaInicio: string; precio: { monto: string; moneda: string } }[];
};

type Nodo = Record<string, unknown>;

export function construirJsonLd(
  pelicula: PeliculaJsonLd,
  grupos: GrupoJsonLd[],
  siteUrl: string,
): Nodo[] {
  const url = `${siteUrl}/peliculas/${pelicula.id}`;
  const movie: Nodo = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": `${url}#pelicula`,
    name: pelicula.titulo,
    ...(pelicula.sinopsis && { description: pelicula.sinopsis }),
    ...(pelicula.duracionMinutos && { duration: duracionIso(pelicula.duracionMinutos) }),
    contentRating: pelicula.clasificacion.etiqueta,
    url,
  };
  const funciones = grupos.flatMap(({ sucursal, horarios }) =>
    horarios.map((horario) => ({
      "@context": "https://schema.org",
      "@type": "ScreeningEvent",
      name: `${pelicula.titulo} en ${sucursal.nombre}`,
      startDate: horario.horaInicio,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "MovieTheater", name: sucursal.nombre },
      workPresented: { "@id": movie["@id"] },
      offers: {
        "@type": "Offer",
        price: horario.precio.monto,
        priceCurrency: horario.precio.moneda,
        url: `${siteUrl}/funciones/${horario.funcionId}`,
      },
    })),
  );
  return [movie, ...funciones];
}

/** JSON para un <script>: escapa `<` para que ningún texto pueda cerrar la etiqueta. */
export function serializarJsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
