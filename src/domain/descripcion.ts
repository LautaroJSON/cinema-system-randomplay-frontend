import type { Clasificacion } from "./clasificacion";
import { formatearDuracion } from "./formato";

/** Recorta a `max` caracteres en el último espacio, para la meta description. */
export function recortarDescripcion(texto: string, max = 160): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > 0 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:]+$/, "")}…`;
}

type DatosDescripcion = {
  titulo: string;
  duracionMinutos: number | null;
  clasificacion: Clasificacion;
  sinopsis: string | null;
};

export function descripcionFicha({
  titulo,
  duracionMinutos,
  clasificacion,
  sinopsis,
}: DatosDescripcion) {
  if (sinopsis) return recortarDescripcion(sinopsis);
  const partes = [
    titulo,
    duracionMinutos ? formatearDuracion(duracionMinutos) : null,
    clasificacion.etiqueta,
  ];
  return `${partes.filter(Boolean).join(", ")}. Horarios de hoy en RandomPlay.`;
}
