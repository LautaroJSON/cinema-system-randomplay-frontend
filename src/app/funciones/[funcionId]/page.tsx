import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { obtenerMapa } from "@/api/asientos-servidor";
import { ApiError } from "@/api/client";
import { CabeceraFuncion } from "@/components/CabeceraFuncion/CabeceraFuncion";
import { EstadoVacio } from "@/components/EstadoVacio/EstadoVacio";
import { SelectorButacas } from "@/components/SelectorButacas/SelectorButacas";
import estilos from "./page.module.css";

// La disponibilidad de asientos nunca se cachea (Principio IX, FR-004).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ funcionId: string }> };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Flujo privado: fuera del índice y sin canónica (Principio IX).
const robots = { index: false, follow: false };

/** Un solo pedido por request, compartido entre la metadata y la página. */
const cargarFuncion = cache(async (funcionId: string) => {
  if (!GUID.test(funcionId)) notFound();
  try {
    const mapa = await obtenerMapa(funcionId);
    if (!mapa) notFound();
    return { tipo: "vigente" as const, mapa };
  } catch (error) {
    // El mapa de una función que ya empezó responde 410 sin `codigo`: se decide por status.
    if (error instanceof ApiError && error.status === 410) return { tipo: "comenzada" as const };
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { funcionId } = await params;
  // El 404 lo decide la página; acá solo se evita pedir un id inválido.
  if (!GUID.test(funcionId)) return { robots };
  const funcion = await cargarFuncion(funcionId);
  return {
    title:
      funcion.tipo === "vigente" ? `Butacas · ${funcion.mapa.peliculaTitulo}` : "Función comenzada",
    robots,
  };
}

export default async function PaginaFuncion({ params }: Props) {
  const { funcionId } = await params;
  const funcion = await cargarFuncion(funcionId);

  if (funcion.tipo === "comenzada") {
    return (
      <div className="contenedor">
        <EstadoVacio
          nivel="h1"
          titulo="Esta función ya empezó"
          mensaje="Ya no se pueden elegir butacas para este horario. Elegí otro desde la cartelera."
          enlace={{ href: "/", texto: "Ver la cartelera" }}
        />
      </div>
    );
  }

  const { mapa } = funcion;
  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <Link href={`/peliculas/${mapa.peliculaId}`} className={`label ${estilos.volver}`}>
        Volver a {mapa.peliculaTitulo}
      </Link>
      <h1 className="h2">Elegí tus butacas</h1>
      <CabeceraFuncion {...mapa} />
      <noscript>
        <p className={estilos.sinScript}>
          Para elegir butacas necesitás tener JavaScript activado en el navegador.
        </p>
      </noscript>
      <SelectorButacas mapa={mapa} />
    </div>
  );
}
