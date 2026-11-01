// La API no marca películas destacadas: el carrusel muestra las primeras que todavía tienen
// funciones hoy, hasta `maximo`. El resto queda en el estante, en el orden de la API.
export function elegirDestacadas<T extends { tieneFuncionesHoy: boolean }>(
  peliculas: T[],
  maximo = 5,
): { destacadas: T[]; resto: T[] } {
  const destacadas = peliculas.filter((p) => p.tieneFuncionesHoy).slice(0, maximo);
  return { destacadas, resto: peliculas.filter((p) => !destacadas.includes(p)) };
}
