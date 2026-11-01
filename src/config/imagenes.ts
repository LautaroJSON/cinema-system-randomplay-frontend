// Dominios de pósters que pasan por la optimización de imágenes de Next. Una URL de otro dominio
// se muestra igual, sin optimizar (ver Caratula). Se importa también desde next.config.ts.
// upload.wikimedia.org (pósters demo del backend) queda afuera a propósito: responde 429 a los
// pedidos del optimizador desde el servidor, y el navegador sí puede pedirlos directo.
export const HOSTS_DE_POSTERS = ["image.tmdb.org"] as const;

export function esHostOptimizable(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && (HOSTS_DE_POSTERS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}
