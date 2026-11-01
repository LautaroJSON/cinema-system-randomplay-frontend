import type { MapaFuncion } from "@/api/asientos";
import { formatearFecha, formatearHora, formatearPrecio } from "@/domain/formato";
import estilos from "./CabeceraFuncion.module.css";

type Props = Pick<
  MapaFuncion,
  "peliculaTitulo" | "sucursalNombre" | "salaNombre" | "horaInicio" | "precioEntrada"
>;

/** Qué se está por comprar: el talón de la entrada, en el orden en que se lee. */
export function CabeceraFuncion({
  peliculaTitulo,
  sucursalNombre,
  salaNombre,
  horaInicio,
  precioEntrada,
}: Props) {
  return (
    <dl className={`sombra-dura ${estilos.talon}`}>
      <div className={estilos.pelicula}>
        <dt className="label">Película</dt>
        <dd className="h3">{peliculaTitulo}</dd>
      </div>
      <div>
        <dt className="label">Sucursal</dt>
        <dd>{sucursalNombre}</dd>
      </div>
      <div>
        <dt className="label">Sala</dt>
        <dd>{salaNombre}</dd>
      </div>
      <div>
        <dt className="label">Fecha y hora</dt>
        <dd>
          <time dateTime={horaInicio}>
            <span className={estilos.fecha}>{formatearFecha(horaInicio)}</span>{" "}
            <span className="counter">{formatearHora(horaInicio)}</span>
          </time>
        </dd>
      </div>
      <div>
        <dt className="label">Entrada</dt>
        <dd className="counter">{formatearPrecio(precioEntrada)}</dd>
      </div>
    </dl>
  );
}
