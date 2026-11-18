"use client";

import { useEffect, useState } from "react";
import { AVISO_DEMORA_MS } from "@/config/experiencia";
import estilos from "./AvisoCargaHorario.module.css";

/**
 * Barra fija abajo mientras se abre la función de un horario (spec 006). La monta
 * `IndicadorCarga` en un portal, fuera del enlace: así no suma texto al nombre accesible del
 * horario. No recibe toques ni foco (`pointer-events: none` en el CSS).
 */
export function AvisoCargaHorario({ hora, sala }: { hora: string; sala: string }) {
  // Espacio duro dentro de la sala: "Sala 3" no se parte en dos líneas a 360 px.
  const texto = `Cargando las butacas de las ${hora}, ${sala.replaceAll(" ", "\u00a0")}…`;
  const demora = "Esto puede tardar un poco más. No hace falta recargar la página.";
  // Una región viva que aparece con el texto ya puesto no siempre se anuncia: se llena después.
  const [anunciado, setAnunciado] = useState(false);
  // Pasados 5 s, un "Cargando…" solo se lee como colgado y la persona recarga (FR-005).
  const [demorada, setDemorada] = useState(false);

  useEffect(() => {
    const anuncio = setTimeout(() => setAnunciado(true), 0);
    const aviso = setTimeout(() => setDemorada(true), AVISO_DEMORA_MS);
    return () => {
      clearTimeout(anuncio);
      clearTimeout(aviso);
    };
  }, []);

  return (
    <div className={estilos.aviso}>
      <div className={`contenedor ${estilos.contenido}`}>
        <p className={estilos.texto}>{texto}</p>
        {demorada && <p className={estilos.demora}>{demora}</p>}
      </div>
      <p role="status" className="visualmente-oculto">
        {anunciado ? texto : ""}
        {demorada ? ` ${demora}` : ""}
      </p>
    </div>
  );
}
