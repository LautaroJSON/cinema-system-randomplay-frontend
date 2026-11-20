import Image from "next/image";
import { Casete } from "@/components/Casete/Casete";
import { codigoImpreso } from "@/components/Caratula/Caratula";
import { EtiquetaPegada } from "@/components/EtiquetaPegada/EtiquetaPegada";
import { esHostOptimizable } from "@/config/imagenes";
import type { Clasificacion } from "@/domain/clasificacion";
import { formatearDuracion } from "@/domain/formato";
import estilos from "./FichaPelicula.module.css";

type Props = {
  titulo: string;
  imagenUrl: string | null;
  codigoCinta: string;
  duracionMinutos: number | null;
  clasificacion: Clasificacion;
  sinopsis: string | null;
  /** Muestra el botón que baja a los horarios (solo en escritorio; en teléfono lo da la barra). */
  conAccion: boolean;
  /** Id de la sección de horarios a la que baja el botón. */
  destinoId: string;
};

/**
 * Caja de cinta: el póster (o el casete vacío mientras no lo hay) a un lado, y del otro el
 * título, la ficha técnica como etiqueta impresa, la sinopsis y la acción principal.
 * Solo muestra datos que la API entrega (DESIGN.md §9, R-38).
 */
export function FichaPelicula({
  titulo,
  imagenUrl,
  codigoCinta,
  duracionMinutos,
  clasificacion,
  sinopsis,
  conAccion,
  destinoId,
}: Props) {
  return (
    <article className={`halftone sombra-dura ${estilos.ficha}`}>
      <div className={estilos.media}>
        {imagenUrl ? (
          <div className={estilos.poster}>
            <Image
              src={imagenUrl}
              alt={`Póster de ${titulo}`}
              fill
              sizes="(min-width: 768px) 300px, 60vw"
              className={estilos.imagen}
              loading="eager"
              fetchPriority="high"
              unoptimized={!esHostOptimizable(imagenUrl)}
            />
          </div>
        ) : (
          <Casete className={estilos.casete} />
        )}
        <p className={`label ${estilos.codigo}`} aria-hidden="true">
          {codigoImpreso({ codigoCinta, duracionMinutos, clasificacion })}
        </p>
      </div>

      <div className={estilos.lado}>
        <h1 className={`display ${estilos.titulo}`}>{titulo}</h1>

        <dl className={estilos.datos}>
          {duracionMinutos && (
            <div>
              <dt className="label">Duración</dt>
              <dd className="counter">{formatearDuracion(duracionMinutos)}</dd>
            </div>
          )}
          <div>
            <dt className="label">Clasificación</dt>
            <dd>
              <EtiquetaPegada titulo={clasificacion.descripcion} inclinacion={-1}>
                {clasificacion.etiqueta}
              </EtiquetaPegada>
            </dd>
          </div>
        </dl>

        {sinopsis && (
          <section aria-labelledby="titulo-sinopsis" className={estilos.sinopsis}>
            <h2 id="titulo-sinopsis" className="h3">
              Sinopsis
            </h2>
            <p>{sinopsis}</p>
          </section>
        )}

        {conAccion && (
          <div className={estilos.accion} data-accion-horarios>
            <a href={`#${destinoId}`} className="boton-primario">
              Ver horarios de hoy
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
