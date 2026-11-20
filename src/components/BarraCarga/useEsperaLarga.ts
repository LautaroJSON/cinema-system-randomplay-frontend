"use client";

import { useEffect, useState } from "react";
import { AVISO_CASI_MS, AVISO_DEMORA_MS } from "@/config/experiencia";

// La segunda línea avanza con la espera: el backend dormido tarda unos 30 s (spec 006).
const LINEA_POR_ETAPA = {
  inicial: "",
  demorada: "Esto puede tardar un poco más. No hace falta recargar la página.",
  casi: "Ya casi terminamos. No hace falta recargar la página.",
} as const;

type Etapa = keyof typeof LINEA_POR_ETAPA;

/**
 * Estado de una espera que puede ser larga, para los avisos de carga.
 *
 * - `anunciado` pasa a `true` después de montar: una región viva que aparece con el texto ya
 *   puesto no siempre se anuncia, así que el texto se escribe un instante después.
 * - `linea` está vacía al principio, explica la demora a los 5 s (un "Cargando…" solo se lee
 *   como colgado y la persona recarga) y da sensación de avance a los 20 s.
 */
export function useEsperaLarga() {
  const [anunciado, setAnunciado] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("inicial");

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

  return { anunciado, linea: LINEA_POR_ETAPA[etapa] };
}
