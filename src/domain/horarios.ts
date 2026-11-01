import type { Horario, Sucursal } from "@/api/funciones";

export type HorariosPorSucursal = { sucursal: Sucursal; horarios: Horario[] };

export type EstadoHorarios =
  { tipo: "ok"; grupos: HorariosPorSucursal[] } | { tipo: "vacio" } | { tipo: "error" };

type Dependencias = {
  listarSucursalesHoy: (peliculaId: string) => Promise<Sucursal[] | null>;
  listarHorariosHoy: (peliculaId: string, sucursalId: string) => Promise<Horario[] | null>;
};

const instante = (horario: Horario) => new Date(horario.horaInicio).getTime();

/**
 * Agrupa los horarios de hoy por sucursal. "Hoy" y "todavía no comenzados" los decide la API;
 * acá solo se ordena y se descartan sucursales vacías. Si un pedido falla, no se muestra una
 * lista parcial que parezca completa.
 */
export async function armarHorariosPorSucursal(
  peliculaId: string,
  { listarSucursalesHoy, listarHorariosHoy }: Dependencias,
): Promise<EstadoHorarios> {
  try {
    const sucursales = (await listarSucursalesHoy(peliculaId)) ?? [];
    const listas = await Promise.all(sucursales.map((s) => listarHorariosHoy(peliculaId, s.id)));
    const grupos = sucursales
      .map((sucursal, i) => ({
        sucursal,
        horarios: [...(listas[i] ?? [])].sort((a, b) => instante(a) - instante(b)),
      }))
      .filter((grupo) => grupo.horarios.length > 0);
    return grupos.length > 0 ? { tipo: "ok", grupos } : { tipo: "vacio" };
  } catch {
    return { tipo: "error" };
  }
}

/** Quita los horarios que ya comenzaron, por ejemplo en una versión vieja servida desde caché. */
export function filtrarVigentes(grupos: HorariosPorSucursal[], ahora: Date): HorariosPorSucursal[] {
  return grupos
    .map(({ sucursal, horarios }) => ({
      sucursal,
      horarios: horarios.filter((h) => instante(h) > ahora.getTime()),
    }))
    .filter((grupo) => grupo.horarios.length > 0);
}
