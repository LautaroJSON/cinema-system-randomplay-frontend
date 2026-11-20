"use client";

import { useEffect, useState } from "react";
import estilos from "./BarraAccionHorarios.module.css";

/**
 * Barra al pie del teléfono con la acción principal de la ficha: bajar a los horarios.
 * Se oculta mientras la sección de horarios está en pantalla, porque ahí el botón no sirve.
 * Sin JavaScript queda visible y el ancla funciona igual.
 */
export function BarraAccionHorarios({ destinoId }: { destinoId: string }) {
  const [destinoVisible, setDestinoVisible] = useState(false);

  useEffect(() => {
    const destino = document.getElementById(destinoId);
    if (!destino) return;
    const observador = new IntersectionObserver(([entrada]) =>
      setDestinoVisible(entrada?.isIntersecting ?? false),
    );
    observador.observe(destino);
    return () => observador.disconnect();
  }, [destinoId]);

  if (destinoVisible) return null;

  return (
    <div className={estilos.barra}>
      <span className={`label ${estilos.texto}`}>Funciones de hoy</span>
      <a href={`#${destinoId}`} className="boton-primario">
        Ver horarios
      </a>
    </div>
  );
}
