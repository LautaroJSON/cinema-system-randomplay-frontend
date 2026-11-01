// Aritmética de dinero en centavos enteros, sin pasar `monto` por punto flotante (Principio V).
import type { Dinero } from "./formato";

/** "7250.50" → 725050. `null` si el texto no tiene exactamente 2 decimales. */
export function aCentavos(monto: string): number | null {
  const partes = /^(\d+)\.(\d{2})$/.exec(monto);
  if (!partes) return null;
  const [, entero = "", decimales = ""] = partes;
  const centavos = Number.parseInt(entero, 10) * 100 + Number.parseInt(decimales, 10);
  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function desdeCentavos(centavos: number, moneda: string): Dinero {
  const entero = Math.trunc(centavos / 100);
  const resto = String(centavos % 100).padStart(2, "0");
  return { monto: `${entero}.${resto}`, moneda };
}

export function multiplicar(precio: Dinero, cantidad: number): Dinero | null {
  const centavos = aCentavos(precio.monto);
  if (centavos === null) return null;
  return desdeCentavos(centavos * cantidad, precio.moneda);
}
