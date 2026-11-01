import { mapearMapa, rutaMapa, type MapaApi, type MapaFuncion } from "./asientos";
import { pedirSinCache } from "./client";

/** Desde el servidor y sin caché (Principio IX). `null` si la función no existe; 410 lanza. */
export async function obtenerMapa(funcionId: string): Promise<MapaFuncion | null> {
  const api = await pedirSinCache<MapaApi>(rutaMapa(funcionId));
  return api && mapearMapa(api);
}
