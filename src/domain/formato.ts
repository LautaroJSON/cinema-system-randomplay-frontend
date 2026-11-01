// Formatos únicos de hora, dinero y duración para toda la aplicación (Principio V).

export type Dinero = { monto: string; moneda: string };

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const formatosPrecio = new Map<string, Intl.NumberFormat>();

/** "21:30" en la zona horaria de Argentina, respetando el offset del ISO recibido. */
export function formatearHora(iso: string): string {
  return formatoHora.format(new Date(iso));
}

/** Formatea `monto` sin pasarlo por `number`, para no perder precisión. */
export function formatearPrecio({ monto, moneda }: Dinero): string {
  if (!/^-?\d+(\.\d+)?$/.test(monto)) return `${monto} ${moneda}`;
  let formato = formatosPrecio.get(moneda);
  if (!formato) {
    formato = new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda });
    formatosPrecio.set(moneda, formato);
  }
  return formato.format(monto as Intl.StringNumericLiteral);
}

export function formatearDuracion(minutos: number): string {
  return `${minutos} min`;
}

export function duracionIso(minutos: number): string {
  return `PT${minutos}M`;
}

/** La API tipa los enteros como `integer | string`; acá se normalizan a entero positivo. */
export function normalizarEntero(valor: number | string): number | null {
  const numero = typeof valor === "number" ? valor : /^\d+$/.test(valor) ? Number(valor) : NaN;
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}
