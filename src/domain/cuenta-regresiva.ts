// Cuenta regresiva del carrito desde `venceEn` (Principio IV): lógica pura, el reloj se recibe.
import { AVISO_VENCIMIENTO_MS } from "@/config/experiencia";

export type Tramo = "normal" | "final" | "vencido";

/** Más que esto no es un reloj corrido sino un header roto: no se corrige. */
const DESFASE_MAXIMO_MS = 12 * 60 * 60 * 1000;

/** Hora del servidor menos hora del dispositivo, o 0 si no hay con qué medirla. */
export function medirDesfase(horaServidorMs: number | null, recibidoEnMs: number): number {
  if (horaServidorMs === null) return 0;
  const desfase = horaServidorMs - recibidoEnMs;
  return Math.abs(desfase) > DESFASE_MAXIMO_MS ? 0 : desfase;
}

/** Milisegundos hasta `venceEn` en la hora del servidor. Un `venceEn` ilegible da 0. */
export function restanteMs(venceEn: string, desfaseMs: number, ahoraMs: number): number {
  const vence = Date.parse(venceEn);
  if (Number.isNaN(vence)) return 0;
  return Math.max(0, vence - (ahoraMs + desfaseMs));
}

export function tramo(restante: number): Tramo {
  if (restante <= 0) return "vencido";
  return restante <= AVISO_VENCIMIENTO_MS ? "final" : "normal";
}

/** Segundos redondeados hacia arriba: `00:00` aparece solo al vencer. */
const segundosRestantes = (restante: number) => Math.ceil(Math.max(0, restante) / 1000);

/** "09:42". Con una hora o más sigue en minutos totales ("75:00"). */
export function formatearContador(restante: number): string {
  const total = segundosRestantes(restante);
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`;

/** "Quedan 4 minutos y 12 segundos", para lectores de pantalla. */
export function describirRestante(restante: number): string {
  const total = segundosRestantes(restante);
  if (total === 0) return "Se terminó el tiempo";
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  const cantidades: [number, string, string][] = [
    [minutos, "minuto", "minutos"],
    [segundos, "segundo", "segundos"],
  ];
  const partes = cantidades.filter(([n]) => n > 0);
  // El verbo concuerda con la primera cantidad: "Queda 1 minuto y 12 segundos".
  const verbo = partes[0]?.[0] === 1 ? "Queda" : "Quedan";
  return `${verbo} ${partes.map(([n, uno, varios]) => plural(n, uno, varios)).join(" y ")}`;
}
