"use client";

import { Children, useEffect, useState, useSyncExternalStore } from "react";
import estilos from "./CarruselDestacadas.module.css";

const INTERVALO_MS = 6_000;

// Preferencia de movimiento reducido. En el servidor se asume reducido: nada se mueve solo
// hasta que el navegador confirme que puede.
const CONSULTA = "(prefers-reduced-motion: reduce)";
function suscribirMovimiento(avisar: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}
const movimientoReducido = () =>
  typeof window.matchMedia === "function" && window.matchMedia(CONSULTA).matches;

type Props = {
  /** Título de cada película, en el mismo orden que `children`, para el anuncio y el contador. */
  titulos: string[];
  /** Una tarjeta por película, renderizadas en el servidor. */
  children: React.ReactNode;
};

/**
 * Carrusel del hero: pasa las películas destacadas de derecha a izquierda cada 6 s.
 * Excepción a DESIGN.md §8 aprobada por el dueño (2026-11-01). WCAG 2.2.2: se puede pausar, se
 * detiene con el mouse o el foco encima y, con movimiento reducido, no avanza solo.
 */
export function CarruselDestacadas({ titulos, children }: Props) {
  const tarjetas = Children.toArray(children);
  const total = tarjetas.length;
  // `indice` llega hasta `total`: esa posición es una copia de la primera película, para volver
  // al principio siguiendo de derecha a izquierda en lugar de rebobinar.
  const [indice, setIndice] = useState(0);
  const [animado, setAnimado] = useState(true);
  const [pausado, setPausado] = useState(false);
  const [encima, setEncima] = useState(false);
  const [montado, setMontado] = useState(false);
  const reducido = useSyncExternalStore(suscribirMovimiento, movimientoReducido, () => true);

  const actual = indice % total;
  const girando = total > 1 && !pausado && !encima && !reducido;

  useEffect(() => {
    const marco = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(marco);
  }, []);

  useEffect(() => {
    if (!girando) return;
    const espera = setTimeout(() => setIndice((i) => i + 1), INTERVALO_MS);
    return () => clearTimeout(espera);
  }, [girando, indice]);

  // Después de saltar sin transición desde la copia a la primera, vuelve a animar.
  useEffect(() => {
    if (animado) return;
    const marco = requestAnimationFrame(() => setAnimado(true));
    return () => cancelAnimationFrame(marco);
  }, [animado]);

  function ir(destino: number) {
    setIndice(reducido ? ((destino % total) + total) % total : destino);
  }

  function alTerminarTransicion() {
    if (indice < total) return;
    setAnimado(false);
    setIndice(0);
  }

  if (total === 0) return null;

  return (
    <div
      className={estilos.carrusel}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Películas destacadas de hoy"
      onPointerEnter={() => setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onFocus={() => setEncima(true)}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setEncima(false);
      }}
    >
      <div className={estilos.ventana}>
        <div
          className={`${estilos.pista} ${animado ? estilos.animada : ""}`}
          style={{ transform: `translateX(-${indice * 100}%)` }}
          onTransitionEnd={(evento) => {
            if (evento.target === evento.currentTarget) alTerminarTransicion();
          }}
        >
          {tarjetas.map((tarjeta, i) => (
            <div
              key={i}
              className={estilos.diapositiva}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
              inert={i !== actual || indice === total}
            >
              {tarjeta}
            </div>
          ))}
          {/* Copia de la primera, solo para el paso de la última a la primera. */}
          {montado && total > 1 && (
            <div className={estilos.diapositiva} aria-hidden="true" inert>
              {tarjetas[0]}
            </div>
          )}
        </div>
      </div>

      {total > 1 && (
        <div className={estilos.controles}>
          {/* Con movimiento reducido nada avanza solo: no hay nada que pausar. */}
          {!reducido && (
            <button
              type="button"
              className={`label ${estilos.boton}`}
              data-pausado={pausado}
              onClick={() => setPausado((p) => !p)}
            >
              {pausado ? "Play" : "Pausa"}
            </button>
          )}
          <button
            type="button"
            className={`label ${estilos.boton}`}
            onClick={() => ir(actual === 0 ? total - 1 : actual - 1)}
            aria-label="Película anterior"
          >
            <span aria-hidden="true">◀</span>
          </button>
          <p className={`counter ${estilos.contador}`} aria-hidden="true">
            {String(actual + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <button
            type="button"
            className={`label ${estilos.boton}`}
            onClick={() => ir(indice + 1)}
            aria-label="Película siguiente"
          >
            <span aria-hidden="true">▶</span>
          </button>
          {/* Mientras gira solo no se anuncia cada cambio; al pausar o navegar, sí. */}
          <p className="visualmente-oculto" aria-live={girando ? "off" : "polite"}>
            {`Película ${actual + 1} de ${total}: ${titulos[actual] ?? ""}`}
          </p>
        </div>
      )}
    </div>
  );
}
