import type { NextConfig } from "next";
import { resolverBackend } from "./src/config/backend";
import { HOSTS_DE_POSTERS } from "./src/config/imagenes";

const { url: apiUrl, origen } = resolverBackend(process.env);
// Una línea al arrancar, para saber contra qué backend corre el sitio sin abrir el .env.
console.log(`Backend: ${apiUrl} (${origen})`);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: HOSTS_DE_POSTERS.map((hostname) => ({ protocol: "https", hostname })),
  },
  // Proxy del mismo origen para el navegador cuando no hay NEXT_PUBLIC_API_URL (ver src/api/navegador.ts).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
