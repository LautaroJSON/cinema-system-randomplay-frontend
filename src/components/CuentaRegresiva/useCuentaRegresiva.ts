"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { restanteMs, tramo, type Tramo } from "@/domain/cuenta-regresiva";
import { leerReloj, suscribirReloj } from "./reloj";

// Cada hook devuelve un valor que cambia poco (el tramo, los segundos), para que el componente
// se vuelva a renderizar solo cuando cambia lo que muestra.

const restante = (venceEn: string, desfaseMs: number) =>
  restanteMs(venceEn, desfaseMs, leerReloj());

/** Tramo del contador; sin vencimiento conocido, `null`. */
export function useTramo(venceEn: string | null, desfaseMs: number): Tramo | null {
  return useSyncExternalStore(
    suscribirReloj,
    () => (venceEn === null ? null : tramo(restante(venceEn, desfaseMs))),
    () => null,
  );
}

/** Milisegundos restantes redondeados al segundo de arriba, como los muestra el contador. */
export function useRestanteAlSegundo(venceEn: string, desfaseMs: number): number {
  return useSyncExternalStore(
    suscribirReloj,
    () => Math.ceil(restante(venceEn, desfaseMs) / 1000) * 1000,
    // El contador solo se muestra después de leer la pestaña: en el servidor no hay tiempo.
    () => 0,
  );
}

/** Llama a `alVencer` una sola vez cuando el contador llega a cero, si `vigilar` es verdadero. */
export function useAlVencer(
  venceEn: string | null,
  desfaseMs: number,
  vigilar: boolean,
  alVencer: () => void,
) {
  const llamado = useRef(alVencer);
  useEffect(() => {
    llamado.current = alVencer;
  });

  useEffect(() => {
    if (!vigilar || venceEn === null) return;
    let avisado = false;
    return suscribirReloj(() => {
      if (avisado || restante(venceEn, desfaseMs) > 0) return;
      avisado = true;
      llamado.current();
    });
  }, [venceEn, desfaseMs, vigilar]);
}
