import type { MetadataRoute } from "next";
import { entorno } from "@/config/entorno";

// El flujo privado (butacas, carrito) y el proxy de la API quedan fuera del índice.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/funciones/", "/carritos/", "/api/"] },
    sitemap: `${entorno.siteUrl}/sitemap.xml`,
  };
}
