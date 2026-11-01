import type { MetadataRoute } from "next";
import { listarPeliculas } from "@/api/catalogo";
import { entorno } from "@/config/entorno";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const peliculas = await listarPeliculas();
  return [
    { url: `${entorno.siteUrl}/`, changeFrequency: "daily", priority: 1 },
    ...peliculas.map(({ id }) => ({
      url: `${entorno.siteUrl}/peliculas/${id}`,
      changeFrequency: "daily" as const,
    })),
  ];
}
