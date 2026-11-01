import type { Metadata } from "next";
import { CarritoCreado } from "@/components/CarritoCreado/CarritoCreado";
import estilos from "./page.module.css";

// Todo el contenido sale de la pestaña: el servidor nunca recibe datos del carrito (Principio III).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu carrito",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ carritoId: string }> };

export default async function PaginaCarrito({ params }: Props) {
  const { carritoId } = await params;
  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <noscript>
        <p>Para ver tu carrito necesitás tener JavaScript activado en el navegador.</p>
      </noscript>
      <CarritoCreado carritoId={carritoId} />
    </div>
  );
}
