"use client";

import { BotonReintentar } from "@/components/BotonReintentar/BotonReintentar";
import { EstadoVacio } from "@/components/EstadoVacio/EstadoVacio";

// No se muestra ni se reporta `error.message`: es texto técnico y puede cambiar.
export default function ErrorDePagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="contenedor">
      <EstadoVacio
        nivel="h1"
        titulo="No pudimos cargar esta página"
        mensaje="Puede ser un problema de conexión o del servidor. Probá de nuevo en unos segundos."
        enlace={{ href: "/", texto: "Volver a la cartelera" }}
      >
        <BotonReintentar onReintentar={reset} />
      </EstadoVacio>
    </div>
  );
}
