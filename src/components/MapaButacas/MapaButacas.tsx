"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Asiento, Fila } from "@/domain/butacas";
import estilos from "./MapaButacas.module.css";

type Props = {
  filas: Fila[];
  seleccion: Asiento[];
  salaNombre: string;
  /** La función dejó de estar disponible: el mapa se muestra pero no se puede usar. */
  bloqueado?: boolean;
  onAlternar: (asiento: Asiento) => void;
};

type Posicion = { fila: number; indice: number };

/** Primera butaca libre de la fila del medio (o la primera de esa fila si no hay libres). */
function focoInicial(filas: Fila[]): Posicion {
  const medio = Math.floor(filas.length / 2);
  const indice = filas[medio]?.butacas.findIndex((b) => b.libre) ?? -1;
  return { fila: medio, indice: Math.max(indice, 0) };
}

/** Ajusta una posición a las filas actuales (el mapa puede cambiar tras un refresco). */
function acotar(filas: Fila[], { fila, indice }: Posicion): Posicion {
  const f = Math.min(Math.max(fila, 0), filas.length - 1);
  const largo = filas[f]?.butacas.length ?? 1;
  return { fila: f, indice: Math.min(Math.max(indice, 0), largo - 1) };
}

/** En el teléfono la barra de desplazamiento no se ve: se avisa con texto si la sala no entra. */
function useDesborde(ref: React.RefObject<HTMLDivElement | null>) {
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    const medir = () => setDesborda(nodo.scrollWidth > nodo.clientWidth + 1);
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    medir();
    return () => observador.disconnect();
  }, [ref]);
  return desborda;
}

export function MapaButacas({
  filas,
  seleccion,
  salaNombre,
  bloqueado = false,
  onAlternar,
}: Props) {
  const [foco, setFoco] = useState<Posicion>(() => focoInicial(filas));
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const area = useRef<HTMLDivElement>(null);
  const desborda = useDesborde(area);
  const actual = acotar(filas, foco);
  const maxAsientos = Math.max(1, ...filas.map((f) => f.butacas.length));
  const elegidas = new Set(seleccion.map((a) => `${a.fila}${a.numero}`));

  function mover(destino: Posicion) {
    const posicion = acotar(filas, destino);
    setFoco(posicion);
    const butaca = filas[posicion.fila]?.butacas[posicion.indice];
    const boton = butaca && botones.current.get(`${butaca.fila}${butaca.numero}`);
    boton?.focus();
    boton?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>) {
    const { fila, indice } = actual;
    const destinos: Record<string, Posicion> = {
      ArrowLeft: { fila, indice: indice - 1 },
      ArrowRight: { fila, indice: indice + 1 },
      // Entre filas de distinto largo se va al número más cercano.
      ArrowUp: { fila: fila - 1, indice },
      ArrowDown: { fila: fila + 1, indice },
      Home: { fila, indice: 0 },
      End: { fila, indice: Number.MAX_SAFE_INTEGER },
    };
    const destino = destinos[evento.key];
    if (!destino) return;
    evento.preventDefault();
    mover(destino);
  }

  return (
    <div
      className={estilos.mapa}
      style={{ "--max-asientos": maxAsientos } as CSSProperties}
      data-bloqueado={bloqueado || undefined}
    >
      <div className={estilos.area} ref={area}>
        <div className={estilos.lienzo}>
          <div className={`label ${estilos.pantalla}`} aria-hidden="true">
            Pantalla
          </div>
          <div role="grid" aria-label={`Butacas de ${salaNombre}`} className={estilos.grilla}>
            {filas.map((fila, f) => (
              <div role="row" key={fila.letra} className={estilos.fila}>
                <span
                  role="rowheader"
                  aria-label={`Fila ${fila.letra}`}
                  className={`label ${estilos.letra}`}
                >
                  {fila.letra}
                </span>
                {fila.butacas.map((butaca, i) => {
                  const clave = `${butaca.fila}${butaca.numero}`;
                  const estado = !butaca.libre
                    ? "ocupada"
                    : elegidas.has(clave)
                      ? "seleccionada"
                      : "libre";
                  const enFoco = actual.fila === f && actual.indice === i;
                  return (
                    <div role="gridcell" key={clave} className={estilos.celda}>
                      <button
                        type="button"
                        ref={(nodo) => {
                          if (nodo) botones.current.set(clave, nodo);
                          else botones.current.delete(clave);
                        }}
                        className={estilos.butaca}
                        data-estado={estado}
                        tabIndex={enFoco ? 0 : -1}
                        aria-label={`Fila ${butaca.fila}, butaca ${butaca.numero}, ${estado}`}
                        aria-disabled={estado === "ocupada" || bloqueado || undefined}
                        onKeyDown={alTeclear}
                        onFocus={() => setFoco({ fila: f, indice: i })}
                        onClick={() => {
                          if (estado === "ocupada" || bloqueado) return;
                          onAlternar({ fila: butaca.fila, numero: butaca.numero });
                        }}
                      >
                        <span aria-hidden="true">{butaca.numero}</span>
                      </button>
                    </div>
                  );
                })}
                <span
                  className={`label ${estilos.letra} ${estilos.letraDerecha}`}
                  aria-hidden="true"
                >
                  {fila.letra}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {desborda && (
        <p className={estilos.pista}>Deslizá el mapa hacia los costados para ver toda la sala.</p>
      )}
      <ul className={`label ${estilos.leyenda}`} aria-hidden="true">
        <li>
          <span className={estilos.muestra} data-estado="libre" /> Libre
        </li>
        <li>
          <span className={estilos.muestra} data-estado="seleccionada" /> Elegida
        </li>
        <li>
          <span className={estilos.muestra} data-estado="ocupada" /> Ocupada
        </li>
      </ul>
    </div>
  );
}
