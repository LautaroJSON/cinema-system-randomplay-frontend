import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPelicula } from "@/api/catalogo";
import { listarHorariosHoy, listarSucursalesHoy } from "@/api/funciones";
import { BarraAccionHorarios } from "@/components/BarraAccionHorarios/BarraAccionHorarios";
import { BotonReintentar } from "@/components/BotonReintentar/BotonReintentar";
import { FichaPelicula } from "@/components/FichaPelicula/FichaPelicula";
import { HorariosVigentes } from "@/components/HorariosVigentes/HorariosVigentes";
import { SinFunciones } from "@/components/SinFunciones/SinFunciones";
import { entorno } from "@/config/entorno";
import { openGraphBase } from "@/config/metadata";
import { descripcionFicha } from "@/domain/descripcion";
import { armarHorariosPorSucursal } from "@/domain/horarios";
import { construirJsonLd, serializarJsonLd } from "@/domain/jsonld";
import estilos from "./page.module.css";

// La ficha incluye los horarios del día: se revalida al ritmo del dato más volátil (FR-044).
export const revalidate = 60;

// Ninguna ficha se genera en el build: cada una se genera al primer pedido y queda en caché.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargarPelicula(id: string) {
  if (!GUID.test(id)) notFound();
  const pelicula = await obtenerPelicula(id);
  if (!pelicula) notFound();
  return pelicula;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // El 404 lo decide la página; acá solo se evita pedir un id inválido.
  const pelicula = GUID.test(id) ? await obtenerPelicula(id) : null;
  if (!pelicula) return {};
  const description = descripcionFicha(pelicula);
  const url = `/peliculas/${id}`;
  return {
    title: pelicula.titulo,
    description,
    alternates: { canonical: url },
    openGraph: { ...openGraphBase, type: "video.movie", title: pelicula.titulo, description, url },
  };
}

export default async function PaginaPelicula({ params }: Props) {
  const { id } = await params;
  // Los horarios se piden en paralelo con el detalle; un fallo en ellos no oculta la ficha.
  const [pelicula, horarios] = await Promise.all([
    cargarPelicula(id),
    GUID.test(id) ? armarHorariosPorSucursal(id, { listarSucursalesHoy, listarHorariosHoy }) : null,
  ]);
  const grupos = horarios?.tipo === "ok" ? horarios.grupos : [];
  const jsonLd = construirJsonLd(pelicula, grupos, entorno.siteUrl);

  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <Link href="/" className={`label ${estilos.volver}`}>
        Volver a la cartelera
      </Link>

      <FichaPelicula
        {...pelicula}
        conAccion={horarios?.tipo === "ok"}
        destinoId="titulo-horarios"
      />

      <section aria-labelledby="titulo-horarios" className={estilos.horarios}>
        <h2 id="titulo-horarios" className="h2 corte-diagonal">
          Horarios de hoy
        </h2>
        {horarios?.tipo === "ok" && <HorariosVigentes grupos={horarios.grupos} />}
        {horarios?.tipo === "vacio" && (
          <SinFunciones titulo="Hoy no hay funciones de esta película." />
        )}
        {horarios?.tipo === "error" && (
          <div className={estilos.error}>
            <p>No pudimos cargar los horarios. Probá de nuevo en unos segundos.</p>
            <BotonReintentar />
          </div>
        )}
      </section>

      {horarios?.tipo === "ok" && (
        <div data-accion-horarios className={estilos.barraAccion}>
          <BarraAccionHorarios destinoId="titulo-horarios" />
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLd) }}
      />
    </div>
  );
}
