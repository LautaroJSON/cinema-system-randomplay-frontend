import type { Metadata } from "next";
import { CambioButacas } from "@/components/CambioButacas/CambioButacas";
import estilos from "./page.module.css";

// Como el carrito: todo sale de la pestaña y el servidor nunca recibe datos (Principio III).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cambiar butacas",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ carritoId: string }> };

export default async function PaginaCambioButacas({ params }: Props) {
  const { carritoId } = await params;
  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <noscript>
        <p>Para cambiar tus butacas necesitás tener JavaScript activado en el navegador.</p>
      </noscript>
      <CambioButacas carritoId={carritoId} />
    </div>
  );
}
