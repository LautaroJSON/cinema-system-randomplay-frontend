import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import { Encabezado } from "@/components/Encabezado/Encabezado";
import { Pie } from "@/components/Pie/Pie";
import { entorno } from "@/config/entorno";
import { openGraphBase } from "@/config/metadata";
import "./globals.css";
import estilos from "./layout.module.css";

// Archivo con eje de ancho: condensada para carteles y normal para leer (DESIGN.md §5).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

// Martian Mono para horarios, precios y códigos: el display de la videocasetera.
const martianMono = Martian_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(entorno.siteUrl),
  title: { template: "%s · RandomPlay", default: "RandomPlay" },
  description: "Películas en cartelera en RandomPlay y sus horarios de hoy en cada sucursal.",
  openGraph: { ...openGraphBase, type: "website" },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: "#0f0d0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${martianMono.variable}`}>
      <body>
        <a href="#contenido" className={`${estilos.saltar} label`}>
          Saltar al contenido
        </a>
        <Encabezado />
        <main id="contenido" tabIndex={-1} className={estilos.principal}>
          {children}
        </main>
        <Pie />
      </body>
    </html>
  );
}
