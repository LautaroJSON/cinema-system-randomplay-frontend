import type { Carrito } from "@/api/carritos";
import { formatearFecha, formatearHora, formatearPrecio } from "@/domain/formato";
import estilos from "./ResumenCarrito.module.css";

type Props = { carrito: Carrito; estado: string };

/** El talón de la reserva: qué función, qué butacas y cuánto, tal como lo devuelve la API. */
export function ResumenCarrito({ carrito, estado }: Props) {
  const { funcion, asientos, precioUnitario, total } = carrito;
  return (
    <dl className={`sombra-dura ${estilos.talon}`}>
      <div className={estilos.ancho}>
        <dt className="label">Película</dt>
        <dd className="h3">{funcion.peliculaTitulo}</dd>
      </div>
      <div>
        <dt className="label">Sucursal</dt>
        <dd>{funcion.sucursalNombre}</dd>
      </div>
      <div>
        <dt className="label">Sala</dt>
        <dd>{funcion.salaNombre}</dd>
      </div>
      <div className={estilos.ancho}>
        <dt className="label">Fecha y hora</dt>
        <dd>
          <time dateTime={funcion.horaInicio}>
            <span className={estilos.fecha}>{formatearFecha(funcion.horaInicio)}</span>{" "}
            <span className="counter">{formatearHora(funcion.horaInicio)}</span>
          </time>
        </dd>
      </div>
      <div className={estilos.ancho}>
        <dt className="label">Butacas</dt>
        <dd>
          <ul className={estilos.butacas}>
            {asientos.map(({ fila, numero }) => (
              <li key={`${fila}${numero}`}>{`Fila ${fila}, butaca ${numero}`}</li>
            ))}
          </ul>
        </dd>
      </div>
      <div>
        <dt className="label">Entrada</dt>
        <dd className="counter">{formatearPrecio(precioUnitario)}</dd>
      </div>
      <div>
        <dt className="label">Total</dt>
        <dd className="counter">{formatearPrecio(total)}</dd>
      </div>
      <div className={estilos.ancho}>
        <dt className="label">Estado</dt>
        <dd>{estado}</dd>
      </div>
    </dl>
  );
}
