"use client";

import { describirRestante, formatearContador, tramo } from "@/domain/cuenta-regresiva";
import { useRestanteAlSegundo } from "./useCuentaRegresiva";
import estilos from "./CuentaRegresiva.module.css";

type Props = { venceEn: string; desfaseMs: number };

/**
 * Contador de videocasetera (DESIGN.md §7). Un `timer` no se anuncia solo: el lector de pantalla
 * lee el texto completo cuando llega hasta acá, y los avisos puntuales van en `AvisoTiempo`.
 */
export function CuentaRegresiva({ venceEn, desfaseMs }: Props) {
  const restante = useRestanteAlSegundo(venceEn, desfaseMs);
  const tramoActual = tramo(restante);

  return (
    <div className={estilos.contador}>
      <p className={`label ${estilos.rotulo}`}>Tus butacas están reservadas por</p>
      <div role="timer" data-tramo={tramoActual} className={estilos.display}>
        <span aria-hidden="true" className="counter">
          {formatearContador(restante)}
        </span>
        <span className="visualmente-oculto">{describirRestante(restante)}</span>
      </div>
    </div>
  );
}
