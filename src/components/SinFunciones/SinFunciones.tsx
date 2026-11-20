import Link from "next/link";
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
      <svg viewBox="0 0 240 150" aria-hidden="true" focusable="false" className={estilos.casete}>
        <rect x="10" y="10" width="220" height="120" />
        <rect x="40" y="26" width="160" height="44" />
        <circle cx="85" cy="48" r="13" />
        <circle cx="155" cy="48" r="13" />
        <path d="M85 41v14M78 48h14M155 41v14M148 48h14" />
        <path d="M62 130l12-26h92l12 26" />
      </svg>
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
