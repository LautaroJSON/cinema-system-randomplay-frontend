import type { components } from "../../src/api/schema";
import detallesJson from "./detalles.json" with { type: "json" };
import horariosJson from "./horarios.json" with { type: "json" };
import peliculasJson from "./peliculas.json" with { type: "json" };
import sucursalesJson from "./sucursales.json" with { type: "json" };

type Schemas = components["schemas"];
type HorarioFixture = Omit<Schemas["HorarioFuncionResponse"], "horaInicio"> & {
  offsetMinutos: number;
};

export const peliculas = peliculasJson satisfies Schemas["PeliculaListItemResponse"][];
export const detalles = detallesJson satisfies Record<string, Schemas["PeliculaDetalleResponse"]>;
export const sucursales = sucursalesJson satisfies Record<
  string,
  Schemas["SucursalConFuncionesHoyResponse"][]
>;
export const horarios = horariosJson satisfies Record<string, HorarioFixture[]>;

export const ID_CON_FUNCIONES = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a01";
export const ID_SIN_FUNCIONES = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a02";
export const ID_CLASIF_DESCONOCIDA = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a03";
export const ID_SIN_SINOPSIS = ID_CLASIF_DESCONOCIDA;
export const ID_TITULO_LARGO = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a04";
export const ID_HORARIOS_FALLAN = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a05";

/** Hora fija de los tests unitarios. */
export const AHORA_TEST = new Date("2026-11-01T12:00:00-03:00");

/** Convierte un instante a ISO 8601 con offset -03:00, como lo devuelve la API. */
export function isoArgentina(fecha: Date): string {
  const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

/** Reemplaza `offsetMinutos` por un `horaInicio` relativo a `ahora`. */
export function conHoraInicio(
  lista: HorarioFixture[],
  ahora: Date,
): Schemas["HorarioFuncionResponse"][] {
  return lista.map(({ offsetMinutos, ...resto }) => {
    const inicio = new Date(ahora.getTime() + offsetMinutos * 60_000);
    inicio.setSeconds(0, 0);
    return { ...resto, horaInicio: isoArgentina(inicio) };
  });
}
