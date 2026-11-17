import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PagoSimulado } from "@/components/PagoSimulado/PagoSimulado";
import { entorno } from "@/config/entorno";
import estilos from "./page.module.css";

// Pasarela simulada: solo en desarrollo y pruebas. En cualquier otro entorno es un 404 real
// (constitución 1.2.0, research P3).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pago simulado",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ carritoId: string }> };

export default async function PaginaPagoSimulado({ params }: Props) {
  if (!entorno.pagoSimulado) notFound();
  const { carritoId } = await params;
  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <noscript>
        <p>Para simular el pago necesitás tener JavaScript activado en el navegador.</p>
      </noscript>
      <PagoSimulado carritoId={carritoId} />
    </div>
  );
}
