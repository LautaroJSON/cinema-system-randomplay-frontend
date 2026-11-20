import Link from "next/link";
import { Casete } from "@/components/Casete/Casete";
import { EtiquetaPegada } from "@/components/EtiquetaPegada/EtiquetaPegada";
import estilos from "./SinFunciones.module.css";

/**
 * Estado vacío de "Horarios de hoy": un casete con los carretes vacíos, la etiqueta que dice
 * qué pasó y la salida (la cartelera). El casete es decorativo: el texto lleva el significado.
 * `data-sin-funciones` deja que la página oculte la barra de acción, para que no haya dos
 * botones rojos en la misma vista.
 */
export function SinFunciones({ titulo }: { titulo: string }) {
  return (
    <div data-sin-funciones className={`halftone sombra-dura ${estilos.vacio}`}>
      <Casete className={estilos.casete} />
      <EtiquetaPegada tono="alerta" inclinacion={-1}>
        Sin funciones hoy
      </EtiquetaPegada>
      <p className={`h3 ${estilos.titulo}`}>{titulo}</p>
      <p className={estilos.detalle}>Elegí otra cinta de la cartelera o volvé mañana.</p>
      <Link href="/" className="boton-primario">
        Ver la cartelera de hoy
      </Link>
    </div>
  );
}
