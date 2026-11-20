"use client";

import { useLinkStatus } from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PantallaCargaPelicula } from "./PantallaCargaPelicula";

/**
 * Va dentro del `<Link>` de una película: mientras la ficha no llega (`useLinkStatus`), muestra
 * la pantalla de carga en un portal a `<body>`, fuera del `<a>`.
 *
 * "Volver a la cartelera" carga la cartelera con el navegador, sin el router de Next. Next no
 * tiene una forma pública de cancelar una navegación en curso, y otra navegación a "/" estando
 * en "/" no siempre descarta la anterior: la ficha terminaba reemplazando la cartelera al llegar.
 * La carga completa sí corta el pedido del navegador. La cartelera sale de la caché, así que
 * llega rápido. El pedido que el servidor ya le hizo al backend sigue y deja la ficha en caché.
 */
export function IndicadorCargaPelicula({ titulo }: { titulo: string }) {
  const { pending } = useLinkStatus();
  const [volviendo, setVolviendo] = useState(false);

  if (!pending || volviendo) return null;
  return createPortal(
    <PantallaCargaPelicula
      titulo={titulo}
      onVolver={() => {
        setVolviendo(true);
        // A propósito sin el router: ver el comentario del componente.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }}
    />,
    document.body,
  );
}
