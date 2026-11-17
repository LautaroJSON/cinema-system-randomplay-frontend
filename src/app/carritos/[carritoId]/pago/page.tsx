import type { Metadata } from "next";
import { VueltaPago } from "@/components/VueltaPago/VueltaPago";
import { entorno } from "@/config/entorno";
import estilos from "./page.module.css";

// Vuelta desde la pasarela. Como el carrito: todo sale de la pestaña y el servidor nunca recibe
// datos del carrito ni la credencial (Principio III).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pago",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ carritoId: string }> };

export default async function PaginaVueltaPago({ params }: Props) {
  const { carritoId } = await params;
  return (
    <div className={`contenedor ${estilos.pagina}`}>
      <noscript>
        <p>Para ver el estado de tu pago necesitás tener JavaScript activado en el navegador.</p>
      </noscript>
      <VueltaPago carritoId={carritoId} pagoSimulado={entorno.pagoSimulado} />
    </div>
  );
}
