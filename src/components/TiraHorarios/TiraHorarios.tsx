import Link from "next/link";
import { formatearHora, formatearPrecio } from "@/domain/formato";
import type { HorariosPorSucursal } from "@/domain/horarios";
import estilos from "./TiraHorarios.module.css";

// Sin hooks: se renderiza igual en el servidor y dentro de la isla HorariosVigentes.
export function TiraHorarios({ grupos }: { grupos: HorariosPorSucursal[] }) {
  return (
    <div className={estilos.grupos}>
      {grupos.map(({ sucursal, horarios }) => (
        <section key={sucursal.id} aria-labelledby={`sucursal-${sucursal.id}`}>
          <h3 id={`sucursal-${sucursal.id}`} className={`h3 ${estilos.sucursal}`}>
            {sucursal.nombre}
          </h3>
          <ul className={estilos.tira}>
            {horarios.map((horario) => {
              const hora = formatearHora(horario.horaInicio);
              const precio = formatearPrecio(horario.precio);
              return (
                <li key={horario.funcionId}>
                  <Link
                    href={`/funciones/${horario.funcionId}`}
                    // La página de butacas no se cachea: precargarla sería un pedido por horario.
                    prefetch={false}
                    className={estilos.horario}
                  >
                    {/* Las comas ocultas arman el nombre accesible "21:30, Sala 2, $ 4.500,00"
                        con el mismo texto que se ve (WCAG 2.5.3). */}
                    <time dateTime={horario.horaInicio} className={`counter ${estilos.hora}`}>
                      {hora}
                    </time>
                    <span className="visualmente-oculto">, </span>
                    <span className="label">{horario.salaNombre}</span>
                    <span className="visualmente-oculto">, </span>
                    <span className={estilos.precio}>{precio}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
