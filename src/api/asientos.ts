// Mapa de asientos: mapeo compartido y pedido desde el navegador. El del servidor está en
// asientos-servidor.ts, para no arrastrar client.ts (process.env) al bundle del navegador.
import { construirMapa, type Fila } from "@/domain/butacas";
import { normalizarEntero, type Dinero } from "@/domain/formato";
import { mapearResultado, pedirDesdeNavegador, type Resultado } from "./navegador";
import type { paths } from "./schema";

export type MapaApi =
  paths["/api/funciones/{funcionId}/asientos"]["get"]["responses"][200]["content"]["application/json"];

export type MapaFuncion = {
  funcionId: string;
  /** ISO 8601 con offset, tal como lo envía la API. */
  horaInicio: string;
  peliculaId: string;
  peliculaTitulo: string;
  sucursalNombre: string;
  salaNombre: string;
  precioEntrada: Dinero;
  filas: Fila[];
  cantidadDisponibles: number;
};

export const rutaMapa = (funcionId: string) =>
  `/api/funciones/${encodeURIComponent(funcionId)}/asientos`;

export function mapearMapa(api: MapaApi): MapaFuncion {
  const filas = construirMapa(api.filas);
  const contadas = filas.reduce((n, f) => n + f.butacas.filter((b) => b.libre).length, 0);
  return {
    funcionId: api.funcionId,
    horaInicio: api.horaInicio,
    peliculaId: api.peliculaId,
    peliculaTitulo: api.peliculaTitulo,
    sucursalNombre: api.sucursalNombre,
    salaNombre: api.salaNombre,
    precioEntrada: { monto: api.precioEntrada.monto, moneda: api.precioEntrada.moneda },
    filas,
    // `normalizarEntero` descarta el 0, que acá es un valor válido (función completa).
    cantidadDisponibles:
      api.cantidadDisponibles === 0 || api.cantidadDisponibles === "0"
        ? 0
        : (normalizarEntero(api.cantidadDisponibles) ?? contadas),
  };
}

/** Desde el navegador, por el proxy y sin caché: refresco tras un conflicto (FR-024). */
export async function obtenerMapaDesdeNavegador(
  funcionId: string,
): Promise<Resultado<MapaFuncion>> {
  return mapearResultado(await pedirDesdeNavegador<MapaApi>(rutaMapa(funcionId)), mapearMapa);
}
