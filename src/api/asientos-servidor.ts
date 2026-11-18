import { ESPERA_LECTURA_MS, PAUSA_REINTENTO_MS } from "@/config/experiencia";
import { mapearMapa, rutaMapa, type MapaApi, type MapaFuncion } from "./asientos";
import { pedirSinCache } from "./client";

/**
 * Desde el servidor y sin caché (Principio IX). `null` si la función no existe; 410 lanza.
 * Espera hasta `ESPERA_LECTURA_MS` y reintenta los errores de arranque: con el backend dormido,
 * el visitante veía la página de error en lugar del aviso de carga del horario (spec 006).
 */
export async function obtenerMapa(funcionId: string): Promise<MapaFuncion | null> {
  const api = await pedirSinCache<MapaApi>(rutaMapa(funcionId), {
    timeoutMs: ESPERA_LECTURA_MS,
    reintentar: { pausaMs: PAUSA_REINTENTO_MS },
  });
  return api && mapearMapa(api);
}
