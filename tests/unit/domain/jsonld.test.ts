import { describe, expect, it } from "vitest";
import { traducirClasificacion } from "@/domain/clasificacion";
import { construirJsonLd, serializarJsonLd } from "@/domain/jsonld";

const SITE = "https://randomplay.test";
const pelicula = {
  id: "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a01",
  titulo: "La noche del videoclub",
  duracionMinutos: 118,
  clasificacion: traducirClasificacion("Mas13"),
  sinopsis: "Faltan diez minutos para cerrar.",
};

describe("construirJsonLd: Movie", () => {
  it("describe la película", () => {
    expect(construirJsonLd(pelicula, [], SITE)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "Movie",
        "@id": `${SITE}/peliculas/${pelicula.id}#pelicula`,
        name: "La noche del videoclub",
        description: "Faltan diez minutos para cerrar.",
        duration: "PT118M",
        contentRating: "+13",
        url: `${SITE}/peliculas/${pelicula.id}`,
      },
    ]);
  });

  it("omite descripción y duración cuando faltan", () => {
    const [movie] = construirJsonLd(
      { ...pelicula, sinopsis: null, duracionMinutos: null },
      [],
      SITE,
    );
    expect(movie).not.toHaveProperty("description");
    expect(movie).not.toHaveProperty("duration");
  });
});

describe("serializarJsonLd", () => {
  it("escapa < para que una sinopsis no cierre el script", () => {
    const texto = serializarJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(texto).not.toContain("<");
    expect(JSON.parse(texto)).toEqual({ description: "</script><script>alert(1)</script>" });
  });
});

describe("construirJsonLd: ScreeningEvent", () => {
  it("agrega una función por horario", () => {
    const grupos = [
      {
        sucursal: { id: "s1", nombre: "Sucursal Centro" },
        horarios: [
          {
            funcionId: "f1",
            horaInicio: "2026-11-01T21:30:00-03:00",
            salaNombre: "Sala 2",
            precio: { monto: "4500.00", moneda: "ARS" },
          },
        ],
      },
    ];
    const [movie, funcion, ...resto] = construirJsonLd(pelicula, grupos, SITE);
    expect(resto).toHaveLength(0);
    expect(funcion).toEqual({
      "@context": "https://schema.org",
      "@type": "ScreeningEvent",
      name: "La noche del videoclub en Sucursal Centro",
      startDate: "2026-11-01T21:30:00-03:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "MovieTheater", name: "Sucursal Centro" },
      workPresented: { "@id": movie?.["@id"] },
      offers: {
        "@type": "Offer",
        price: "4500.00",
        priceCurrency: "ARS",
        url: `${SITE}/funciones/f1`,
      },
    });
  });
});
