import type { Metadata } from "next";
import { listarPeliculas } from "@/api/catalogo";
import { EstadoVacio } from "@/components/EstadoVacio/EstadoVacio";
import { openGraphBase } from "@/config/metadata";
import { CarruselDestacadas } from "@/components/CarruselDestacadas/CarruselDestacadas";
import { TarjetaPelicula } from "@/components/TarjetaPelicula/TarjetaPelicula";
import { elegirDestacadas } from "@/domain/destacada";
import estilos from "./page.module.css";

// Catálogo estático con revalidación cada 10 minutos (Principio IX, FR-044).
export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: "RandomPlay · En cartelera hoy" },
  description: "Películas en cartelera en RandomPlay y sus horarios de hoy en cada sucursal.",
  alternates: { canonical: "/" },
  openGraph: {
    ...openGraphBase,
    type: "website",
    url: "/",
    title: "RandomPlay · En cartelera hoy",
    description: "Películas en cartelera en RandomPlay y sus horarios de hoy en cada sucursal.",
  },
};

export default async function Cartelera() {
  const peliculas = await listarPeliculas();
  const { destacadas, resto } = elegirDestacadas(peliculas);

  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <h1 className="display">En cartelera</h1>

      {peliculas.length === 0 ? (
        <EstadoVacio
          nivel="h2"
          titulo="El estante está vacío"
          mensaje="Hoy no hay películas en cartelera. Volvé más tarde: la cartelera se actualiza durante el día."
        />
      ) : (
        <>
          {destacadas.length > 0 && (
            <section aria-labelledby="titulo-destacadas">
              <h2 id="titulo-destacadas" className="visualmente-oculto">
                Destacadas de hoy
              </h2>
              <CarruselDestacadas titulos={destacadas.map((p) => p.titulo)}>
                {destacadas.map((pelicula, i) => (
                  <TarjetaPelicula
                    key={pelicula.id}
                    pelicula={pelicula}
                    destacada
                    prioridad={i === 0}
                  />
                ))}
              </CarruselDestacadas>
            </section>
          )}

          {resto.length > 0 && (
            <section aria-labelledby="titulo-estante" className={estilos.seccion}>
              <h2 id="titulo-estante" className="h2 corte-diagonal">
                Todas las películas
              </h2>
              <ul className={`halftone ${estilos.estante}`}>
                {resto.map((pelicula) => (
                  <li key={pelicula.id}>
                    <TarjetaPelicula pelicula={pelicula} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
