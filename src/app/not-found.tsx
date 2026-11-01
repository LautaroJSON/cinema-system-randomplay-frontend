import type { Metadata } from "next";
import { EstadoVacio } from "@/components/EstadoVacio/EstadoVacio";

// Next agrega `noindex` por su cuenta en las respuestas 404.
export const metadata: Metadata = { title: "No encontrada" };

export default function NoEncontrada() {
  return (
    <div className="contenedor">
      <EstadoVacio
        nivel="h1"
        titulo="Esta cinta no está en el estante."
        mensaje="Puede que la hayan sacado de cartel o que el enlace esté mal."
        enlace={{ href: "/", texto: "Ver la cartelera" }}
      />
    </div>
  );
}
