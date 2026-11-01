import Link from "next/link";
import type { PeliculaResumen } from "@/api/catalogo";
import { Caratula } from "@/components/Caratula/Caratula";
import { EtiquetaPegada } from "@/components/EtiquetaPegada/EtiquetaPegada";
import { formatearDuracion } from "@/domain/formato";
import estilos from "./TarjetaPelicula.module.css";

type Props = {
  pelicula: PeliculaResumen;
  destacada?: boolean;
  /** Pedir el póster primero: solo la primera película visible del carrusel. */
  prioridad?: boolean;
};

export function TarjetaPelicula({ pelicula, destacada = false, prioridad }: Props) {
  const { id, titulo, duracionMinutos, clasificacion, tieneFuncionesHoy } = pelicula;
  // Inclinación fija por película, para que cada etiqueta parezca pegada a mano sin cambiar entre renders.
  const inclinacion = ((id.charCodeAt(id.length - 1) % 5) - 2) * 0.6;

  return (
    <article className={`${estilos.tarjeta} ${destacada ? estilos.destacada : ""}`}>
      {/* Lomo de la cinta: repite título, duración y clasificación como en un VHS del estante. */}
      <div className={`label ${estilos.lomo}`} aria-hidden="true">
        <span className={estilos.lomoTitulo}>{titulo}</span>
        <span>{clasificacion.etiqueta}</span>
      </div>

      <div className={estilos.cuerpo}>
        <Caratula
          {...pelicula}
          variante={destacada ? "destacada" : "estante"}
          prioridad={prioridad}
        >
          <h3 className={destacada ? "display" : `h3 ${estilos.titulo}`}>
            <Link href={`/peliculas/${id}`} className={estilos.enlace}>
              {titulo}
            </Link>
          </h3>
        </Caratula>

        <div className={estilos.datos}>
          {duracionMinutos && <span>{formatearDuracion(duracionMinutos)}</span>}
          <EtiquetaPegada titulo={clasificacion.descripcion} inclinacion={inclinacion}>
            {clasificacion.etiqueta}
          </EtiquetaPegada>
          {!tieneFuncionesHoy && (
            <EtiquetaPegada tono="alerta" inclinacion={-inclinacion}>
              Sin funciones hoy
            </EtiquetaPegada>
          )}
          {destacada && (
            <span className={`label ${estilos.accion}`} aria-hidden="true">
              Ver horarios de hoy
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
