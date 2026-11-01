import type { NextConfig } from "next";
import { HOSTS_DE_POSTERS } from "./src/config/imagenes";

const apiUrl = process.env.API_URL;
if (!apiUrl) {
  throw new Error("Falta la variable de entorno API_URL (base del backend). Ver .env.example.");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: HOSTS_DE_POSTERS.map((hostname) => ({ protocol: "https", hostname })),
  },
  // Proxy del mismo origen para el navegador mientras el backend no configure CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
