"use client";

import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { AvisoCargaHorario } from "./AvisoCargaHorario";
import estilos from "./TiraHorarios.module.css";

/**
 * Va dentro del `<Link>` de un horario: `useLinkStatus` dice si ese enlace está esperando la
 * página de la función (spec 006). Next lo marca solo en el último enlace tocado.
 *
 * - "Cargando…" ocupa la misma celda que el precio y siempre está en el DOM, para que el
 *   horario no cambie de tamaño. Es `aria-hidden`: el nombre del enlace no cambia (WCAG 2.5.3).
 * - El aviso va en un portal a `<body>` para quedar fuera del `<a>` en el DOM. En el árbol de
 *   React un clic igual llegaría al `Link`, pero el aviso no recibe clics
 *   (`pointer-events: none`).
 */
export function IndicadorCarga({ hora, sala }: { hora: string; sala: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden="true"
        data-pendiente={pending || undefined}
        className={`label ${estilos.cargando}`}
      >
        Cargando…
      </span>
      {pending && createPortal(<AvisoCargaHorario hora={hora} sala={sala} />, document.body)}
    </>
  );
}
