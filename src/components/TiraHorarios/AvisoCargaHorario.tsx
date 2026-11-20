"use client";

import { BarraCarga } from "@/components/BarraCarga/BarraCarga";
import { useEsperaLarga } from "@/components/BarraCarga/useEsperaLarga";
import estilos from "./AvisoCargaHorario.module.css";

/**
 * Barra fija abajo mientras se abre la función de un horario (spec 006). La monta
 * `IndicadorCarga` en un portal, fuera del enlace: así no suma texto al nombre accesible del
 * horario. No recibe toques ni foco (`pointer-events: none` en el CSS).
 */
export function AvisoCargaHorario({ hora, sala }: { hora: string; sala: string }) {
  // Espacio duro dentro de la sala: "Sala 3" no se parte en dos líneas a 360 px.
  const texto = `Cargando las butacas de las ${hora}, ${sala.replaceAll(" ", " ")}…`;
  const { anunciado, linea } = useEsperaLarga();

  return (
    <div className={estilos.aviso}>
      <div className={`contenedor ${estilos.contenido}`}>
        <p className={estilos.texto}>{texto}</p>
        {linea && <p className={estilos.demora}>{linea}</p>}
        <BarraCarga />
      </div>
      <p role="status" className="visualmente-oculto">
        {anunciado ? texto : ""}
        {linea ? ` ${linea}` : ""}
      </p>
    </div>
  );
}
