import type { Dinero } from "@/domain/formato";
import { pedir } from "./client";
import type { paths } from "./schema";

type SucursalesApi =
  paths["/api/funciones/peliculas/{peliculaId}/sucursales-hoy"]["get"]["responses"][200]["content"]["application/json"];
type HorariosApi =
  paths["/api/funciones/peliculas/{peliculaId}/sucursales/{sucursalId}/horarios-hoy"]["get"]["responses"][200]["content"]["application/json"];

export type Sucursal = { id: string; nombre: string };

export type Horario = {
  funcionId: string;
  /** ISO 8601 con offset, tal como lo envía la API. */
  horaInicio: string;
  salaNombre: string;
  precio: Dinero;
};

// Los horarios del día se revalidan cada 60 s (Principio IX, FR-044).
const opciones = (peliculaId: string) => ({ revalidate: 60, tags: [`horarios:${peliculaId}`] });

export async function listarSucursalesHoy(peliculaId: string): Promise<Sucursal[] | null> {
  const lista = await pedir<SucursalesApi>(
    `/api/funciones/peliculas/${encodeURIComponent(peliculaId)}/sucursales-hoy`,
    opciones(peliculaId),
  );
  return lista && lista.map(({ id, nombre }) => ({ id, nombre }));
}

export async function listarHorariosHoy(
  peliculaId: string,
  sucursalId: string,
): Promise<Horario[] | null> {
  const lista = await pedir<HorariosApi>(
    `/api/funciones/peliculas/${encodeURIComponent(peliculaId)}/sucursales/${encodeURIComponent(sucursalId)}/horarios-hoy`,
    opciones(peliculaId),
  );
  return (
    lista &&
    lista.map(({ funcionId, horaInicio, salaNombre, precioEntrada }) => ({
      funcionId,
      horaInicio,
      salaNombre,
      precio: { monto: precioEntrada.monto, moneda: precioEntrada.moneda },
    }))
  );
}
