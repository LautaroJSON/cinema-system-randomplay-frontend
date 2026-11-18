"use client";

import { useEffect, useState } from "react";
import { AVISO_CASI_MS, AVISO_DEMORA_MS } from "@/config/experiencia";
import estilos from "./AvisoCargaHorario.module.css";

// La segunda línea avanza con la espera: el backend dormido tarda unos 30 s (spec 006).
const LINEA_POR_ETAPA = {
  inicial: "",
  demorada: "Esto puede tardar un poco más. No hace falta recargar la página.",
  casi: "Ya casi terminamos. No hace falta recargar la página.",
} as const;

type Etapa = keyof typeof LINEA_POR_ETAPA;

/**
 * Barra fija abajo mientras se abre la función de un horario (spec 006). La monta
 * `IndicadorCarga` en un portal, fuera del enlace: así no suma texto al nombre accesible del
 * horario. No recibe toques ni foco (`pointer-events: none` en el CSS).
 */
export function AvisoCargaHorario({ hora, sala }: { hora: string; sala: string }) {
  // Espacio duro dentro de la sala: "Sala 3" no se parte en dos líneas a 360 px.
  const texto = `Cargando las butacas de las ${hora}, ${sala.replaceAll(" ", " ")}…`;
  // Una región viva que aparece con el texto ya puesto no siempre se anuncia: se llena después.
  const [anunciado, setAnunciado] = useState(false);
  // Pasados 5 s, un "Cargando…" solo se lee como colgado y la persona recarga (FR-005).
  const [etapa, setEtapa] = useState<Etapa>("inicial");
  const linea = LINEA_POR_ETAPA[etapa];

  useEffect(() => {
    const anuncio = setTimeout(() => setAnunciado(true), 0);
    const demora = setTimeout(() => setEtapa("demorada"), AVISO_DEMORA_MS);
    const casi = setTimeout(() => setEtapa("casi"), AVISO_CASI_MS);
    return () => {
      clearTimeout(anuncio);
      clearTimeout(demora);
      clearTimeout(casi);
    };
  }, []);

  return (
    <div className={estilos.aviso}>
      <div className={`contenedor ${estilos.contenido}`}>
        <p className={estilos.texto}>{texto}</p>
        {linea && <p className={estilos.demora}>{linea}</p>}
        <div className={estilos.barra} aria-hidden="true">
          <span className={estilos.tramo} />
        </div>
      </div>
      <p role="status" className="visualmente-oculto">
        {anunciado ? texto : ""}
        {linea ? ` ${linea}` : ""}
      </p>
    </div>
  );
}
