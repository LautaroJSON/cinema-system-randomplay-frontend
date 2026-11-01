"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { formatearFecha, formatearHora, formatearPrecio } from "@/domain/formato";
import { leerSesionCruda, parsearSesion } from "@/domain/sesion-carrito";
import estilos from "./CarritoCreado.module.css";

// Destino provisorio: la pantalla del carrito (cuenta regresiva, email) es la spec 004.

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}

/** En el servidor no hay sesión: el contenido se decide en el navegador. */
const SIN_LEER = "sin-leer";

export function CarritoCreado({ carritoId }: { carritoId: string }) {
  const crudo = useSyncExternalStore(suscribir, leerSesionCruda, () => SIN_LEER);
  const sesion = useMemo(() => (crudo === SIN_LEER ? null : parsearSesion(crudo)), [crudo]);

  // Hasta leer la pestaña no se muestra nada, para no parpadear con el aviso negativo.
  if (crudo === SIN_LEER) return null;

  if (sesion?.carritoId !== carritoId) {
    return (
      <div className={estilos.vacio}>
        <h1 className="h2">No hay un carrito activo en esta pestaña</h1>
        <p>
          El carrito se guarda solo en la pestaña donde elegiste las butacas. Si la cerraste o
          abriste este enlace en otra, elegí la función de nuevo.
        </p>
        <Link href="/" className="boton-secundario">
          Volver a la cartelera
        </Link>
      </div>
    );
  }

  const { funcion, asientos, total } = sesion.carrito;
  return (
    <div className={estilos.carrito}>
      <h1 className="h2">Tu carrito quedó creado</h1>
      <div className={`sombra-dura ${estilos.talon}`}>
        <p className="h3">{funcion.peliculaTitulo}</p>
        <p className={estilos.datos}>
          {funcion.sucursalNombre} · {funcion.salaNombre} ·{" "}
          <time dateTime={funcion.horaInicio}>
            {formatearFecha(funcion.horaInicio)}, {formatearHora(funcion.horaInicio)}
          </time>
        </p>
        <h2 className="label">Butacas retenidas</h2>
        <ul className={estilos.butacas}>
          {asientos.map(({ fila, numero }) => (
            <li key={`${fila}${numero}`}>{`Fila ${fila}, butaca ${numero}`}</li>
          ))}
        </ul>
        <p className={estilos.total}>
          <span className="label">Total</span>{" "}
          <span className="counter">{formatearPrecio(total)}</span>
        </p>
      </div>
      <p className={estilos.nota}>
        Las butacas quedan retenidas unos minutos. El siguiente paso, indicar el email para recibir
        las entradas, todavía no está disponible.
      </p>
      <Link href="/" className="boton-secundario">
        Volver a la cartelera
      </Link>
    </div>
  );
}
