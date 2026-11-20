"use client";

import { useEffect, useRef } from "react";
import { BarraCarga } from "@/components/BarraCarga/BarraCarga";
import { useEsperaLarga } from "@/components/BarraCarga/useEsperaLarga";
import estilos from "./PantallaCargaPelicula.module.css";

// Ocupa el lugar de la línea de demora hasta los 5 s. No se anuncia: es un guiño, no un estado.
export const FRASE_INICIAL =
  "Dicen que la paciencia es una virtud. Hoy tenés la oportunidad de practicarla.";

type Props = {
  titulo: string;
  /** Deja de esperar la ficha y vuelve a la cartelera. */
  onVolver: () => void;
};

/**
 * Pantalla de carga mientras se abre la ficha de una película. Es un `<dialog>` modal: tapa la
 * cartelera, deja el resto de la página inerte para el teclado y los lectores de pantalla, y
 * Escape equivale a "Volver a la cartelera".
 *
 * El foco va al título y no al botón: quien abrió la película con Enter y lo mantiene apretado
 * no debe volver sin querer.
 */
export function PantallaCargaPelicula({ titulo, onVolver }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const encabezado = useRef<HTMLHeadingElement>(null);
  const { anunciado, linea } = useEsperaLarga();

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (!elemento.open) elemento.showModal?.();
    encabezado.current?.focus();
    return () => {
      if (elemento.open) elemento.close?.();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-carga-pelicula"
      className={estilos.pantalla}
      onCancel={(evento) => {
        // Escape: se cierra igual que con el botón, sin que el navegador cierre el diálogo solo.
        evento.preventDefault();
        onVolver();
      }}
    >
      <div className={`contenedor ${estilos.contenido}`}>
        <p className={`label ${estilos.paso}`}>Abriendo la película</p>
        <h2
          id="titulo-carga-pelicula"
          ref={encabezado}
          tabIndex={-1}
          className={`display ${estilos.titulo}`}
        >
          {titulo}
        </h2>
        <div className={estilos.estado}>
          <p className={estilos.texto}>Cargando la ficha y los horarios de hoy…</p>
          {/* Siempre con texto, para que la barra y el botón no salten cuando cambia la etapa. */}
          <p className={estilos.demora}>{linea || FRASE_INICIAL}</p>
          <BarraCarga />
        </div>
        <button type="button" className="boton-secundario" onClick={onVolver}>
          Volver a la cartelera
        </button>
      </div>
      <p role="status" className="visualmente-oculto">
        {anunciado ? `Cargando ${titulo}.` : ""}
        {linea ? ` ${linea}` : ""}
      </p>
    </dialog>
  );
}
