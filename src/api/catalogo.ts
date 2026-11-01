import { cache } from "react";
import { traducirClasificacion, type Clasificacion } from "@/domain/clasificacion";
import { normalizarEntero } from "@/domain/formato";
import { pedir } from "./client";
import type { paths } from "./schema";

type ListaApi =
  paths["/api/catalogo/peliculas"]["get"]["responses"][200]["content"]["application/json"];
type ItemApi = ListaApi[number];

export type PeliculaResumen = {
  id: string;
  titulo: string;
  duracionMinutos: number | null;
  clasificacion: Clasificacion;
  tieneFuncionesHoy: boolean;
  /** URL del póster; `null` si no tiene o si no es http/https. */
  imagenUrl: string | null;
  /** Código decorativo de la carátula. No identifica nada. */
  codigoCinta: string;
};

function urlDeImagen(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const { protocol } = new URL(valor);
    return protocol === "http:" || protocol === "https:" ? valor : null;
  } catch {
    return null;
  }
}

export function mapearResumen(item: ItemApi): PeliculaResumen {
  return {
    id: item.id,
    titulo: item.titulo,
    duracionMinutos: normalizarEntero(item.duracionMinutos),
    clasificacion: traducirClasificacion(item.clasificacion),
    tieneFuncionesHoy: !item.sinFuncionesDisponibles,
    imagenUrl: urlDeImagen(item.imagenUrl),
    codigoCinta: `RP-${item.id.slice(-4).toUpperCase()}`,
  };
}

export async function listarPeliculas(): Promise<PeliculaResumen[]> {
  const lista = await pedir<ListaApi>("/api/catalogo/peliculas", {
    revalidate: 600,
    tags: ["catalogo"],
  });
  return (lista ?? []).map(mapearResumen);
}

type DetalleApi =
  paths["/api/catalogo/peliculas/{id}"]["get"]["responses"][200]["content"]["application/json"];

export type PeliculaDetalle = PeliculaResumen & { sinopsis: string | null };

export function mapearDetalle(detalle: DetalleApi): PeliculaDetalle {
  const sinopsis = detalle.sinopsis.trim();
  return { ...mapearResumen(detalle), sinopsis: sinopsis || null };
}

// `cache` comparte el pedido entre generateMetadata y la página dentro del mismo render.
export const obtenerPelicula = cache(async (id: string): Promise<PeliculaDetalle | null> => {
  const detalle = await pedir<DetalleApi>(`/api/catalogo/peliculas/${encodeURIComponent(id)}`, {
    revalidate: 600,
    tags: [`pelicula:${id}`],
  });
  return detalle && mapearDetalle(detalle);
});
