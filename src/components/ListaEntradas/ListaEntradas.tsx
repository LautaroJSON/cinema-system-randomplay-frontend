import type { Entrada } from "@/api/carritos";
import { formatearFecha, formatearHora, formatearPrecio } from "@/domain/formato";
import estilos from "./ListaEntradas.module.css";

/**
 * Una entrada por butaca, como un talón impreso: el código en dorado es lo que el comprador
 * muestra en la sala, así que es el dato más grande (research P12).
 */
export function ListaEntradas({ entradas }: { entradas: Entrada[] }) {
  return (
    <ul className={estilos.lista}>
      {entradas.map((entrada) => (
        <li key={entrada.codigo} className={`sombra-dura ${estilos.entrada}`}>
          <dl className={estilos.datos}>
            <div className={estilos.ancho}>
              <dt className="label">Código</dt>
              <dd className={`counter ${estilos.codigo}`}>{entrada.codigo}</dd>
            </div>
            <div className={estilos.ancho}>
              <dt className="label">Película</dt>
              <dd className={estilos.pelicula}>{entrada.pelicula}</dd>
            </div>
            <div>
              <dt className="label">Sucursal</dt>
              <dd>{entrada.sucursal}</dd>
            </div>
            <div>
              <dt className="label">Sala</dt>
              <dd>{entrada.sala}</dd>
            </div>
            <div className={estilos.ancho}>
              <dt className="label">Fecha y hora</dt>
              <dd>
                <time dateTime={entrada.horaInicio}>
                  <span className={estilos.fecha}>{formatearFecha(entrada.horaInicio)}</span>{" "}
                  <span className="counter">{formatearHora(entrada.horaInicio)}</span>
                </time>
              </dd>
            </div>
            <div>
              <dt className="label">Fila</dt>
              <dd className="counter">{entrada.asiento.fila}</dd>
            </div>
            <div>
              <dt className="label">Butaca</dt>
              <dd className="counter">{entrada.asiento.numero}</dd>
            </div>
            <div className={estilos.ancho}>
              <dt className="label">Precio</dt>
              <dd className="counter">{formatearPrecio(entrada.precioUnitario)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
