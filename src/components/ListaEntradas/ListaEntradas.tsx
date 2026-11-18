import type { Entrada } from "@/api/carritos";
import { formatearFecha, formatearHora, formatearPrecio } from "@/domain/formato";
import estilos from "./ListaEntradas.module.css";

/**
 * Una entrada por butaca, impresa como un ticket de cine: el cuerpo con la función y un talón
 * troquelado con lo que se muestra en la sala. El código en dorado es el dato más grande
 * (research P12).
 */
export function ListaEntradas({ entradas }: { entradas: Entrada[] }) {
  return (
    <ul className={estilos.lista}>
      {entradas.map((entrada, indice) => (
        <li key={entrada.codigo} className={estilos.entrada}>
          <div className={estilos.cuerpo}>
            <p className={`label ${estilos.marca}`}>
              RandomPlay · Entrada {indice + 1} de {entradas.length}
            </p>
            <dl className={estilos.datos}>
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
              <div>
                <dt className="label">Fecha y hora</dt>
                <dd>
                  <time dateTime={entrada.horaInicio}>
                    <span className={estilos.fecha}>{formatearFecha(entrada.horaInicio)}</span>{" "}
                    <span className="counter">{formatearHora(entrada.horaInicio)}</span>
                  </time>
                </dd>
              </div>
              <div>
                <dt className="label">Precio</dt>
                <dd className={`counter ${estilos.precio}`}>
                  {formatearPrecio(entrada.precioUnitario)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Talón: lo que se muestra en la puerta de la sala. */}
          <div className={estilos.talon}>
            <dl className={estilos.datos}>
              <div className={estilos.ancho}>
                <dt className="label">Código</dt>
                <dd className={`counter ${estilos.codigo}`}>{entrada.codigo}</dd>
              </div>
              <div>
                <dt className="label">Fila</dt>
                <dd className="counter">{entrada.asiento.fila}</dd>
              </div>
              <div>
                <dt className="label">Butaca</dt>
                <dd className="counter">{entrada.asiento.numero}</dd>
              </div>
            </dl>
            <p className={estilos.nota}>Mostrá el código en la entrada de la sala.</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
