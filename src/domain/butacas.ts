// Mapa de la sala y selección de butacas: lógica pura, sin React (Principios IV, V y VII).
import type { Asiento } from "@/api/problema";
import { MAX_BUTACAS_POR_COMPRA } from "@/config/experiencia";
import { normalizarEntero } from "./formato";

export type { Asiento };

export type Butaca = { fila: string; numero: number; libre: boolean };

export type Fila = { letra: string; butacas: Butaca[] };

export type EstadoSelector = {
  filas: Fila[];
  /** En el orden en que se eligieron, sin repetidos y solo libres. */
  seleccion: Asiento[];
  /** El último `alternar` no entró porque ya se había llegado al máximo. */
  limiteAlcanzado: boolean;
  /** Butacas que salieron de la selección en el último cambio del mapa. */
  quitadas: Asiento[];
};

export type AccionSelector =
  | { tipo: "alternar"; asiento: Asiento }
  | { tipo: "limpiar" }
  | { tipo: "marcarOcupadas"; asientos: Asiento[] }
  | { tipo: "reemplazarMapa"; filas: Fila[] };

type FilaApi = {
  fila: string;
  cantidadAsientos: number | string;
  asientosDisponibles: (number | string)[];
};

/** Arma las butacas de 1 a `cantidadAsientos`; descarta filas con letra o cantidad inválidas. */
export function construirMapa(filasApi: FilaApi[]): Fila[] {
  return filasApi.flatMap(({ fila, cantidadAsientos, asientosDisponibles }) => {
    const cantidad = normalizarEntero(cantidadAsientos);
    if (!/^[A-Z]$/.test(fila) || cantidad === null) return [];
    const libres = new Set(asientosDisponibles.map(normalizarEntero));
    const butacas = Array.from({ length: cantidad }, (_, i) => ({
      fila,
      numero: i + 1,
      libre: libres.has(i + 1),
    }));
    return [{ letra: fila, butacas }];
  });
}

export const etiquetaButaca = ({ fila, numero }: Asiento) => `${fila}${numero}`;

const mismaButaca = (a: Asiento, b: Asiento) => a.fila === b.fila && a.numero === b.numero;

/** "la F7", "la F7 y la F8", "la F7, la F8 y la F9". */
export function listarAsientos(asientos: Asiento[]): string {
  const partes = asientos.map((a) => `la ${etiquetaButaca(a)}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

export function buscarButaca(filas: Fila[], { fila, numero }: Asiento): Butaca | undefined {
  return filas.find((f) => f.letra === fila)?.butacas[numero - 1];
}

export function estaSeleccionada(estado: EstadoSelector, asiento: Asiento): boolean {
  return estado.seleccion.some((s) => mismaButaca(s, asiento));
}

const contarLibres = (filas: Fila[]) =>
  filas.reduce((total, fila) => total + fila.butacas.filter((b) => b.libre).length, 0);

export function maximoEfectivo(estado: EstadoSelector): number {
  return Math.min(MAX_BUTACAS_POR_COMPRA, contarLibres(estado.filas));
}

/** La selección inicial (las butacas de un carrito al cambiarlas) se limita a las libres. */
export function estadoInicial(filas: Fila[], seleccionInicial: Asiento[] = []): EstadoSelector {
  const { conservadas } = conservarLibres(seleccionInicial, filas);
  return { filas, seleccion: conservadas, limiteAlcanzado: false, quitadas: [] };
}

/**
 * Las butacas que retiene el propio carrito la API las informa ocupadas: para cambiarlas, se
 * muestran libres (y seleccionadas). Las que no existen en el mapa se ignoran.
 */
export function marcarPropias(filas: Fila[], propias: Asiento[]): Fila[] {
  if (propias.length === 0) return filas;
  return filas.map((fila) => ({
    ...fila,
    butacas: fila.butacas.map((b) =>
      propias.some((p) => mismaButaca(p, b)) ? { ...b, libre: true } : b,
    ),
  }));
}

/** Mismas butacas, sin importar el orden. */
export function mismaSeleccion(a: Asiento[], b: Asiento[]): boolean {
  return a.length === b.length && a.every((x) => b.some((y) => mismaButaca(x, y)));
}

/** Saca de la selección lo que ya no existe o ya no está libre en `filas`. */
function conservarLibres(seleccion: Asiento[], filas: Fila[]) {
  const conservadas: Asiento[] = [];
  const quitadas: Asiento[] = [];
  for (const asiento of seleccion) {
    (buscarButaca(filas, asiento)?.libre ? conservadas : quitadas).push(asiento);
  }
  return { conservadas, quitadas };
}

export function reducirSeleccion(estado: EstadoSelector, accion: AccionSelector): EstadoSelector {
  switch (accion.tipo) {
    case "alternar": {
      const { asiento } = accion;
      if (!buscarButaca(estado.filas, asiento)?.libre) return estado;
      if (estaSeleccionada(estado, asiento)) {
        return {
          ...estado,
          seleccion: estado.seleccion.filter((s) => !mismaButaca(s, asiento)),
          limiteAlcanzado: false,
        };
      }
      if (estado.seleccion.length >= maximoEfectivo(estado)) {
        return { ...estado, limiteAlcanzado: true };
      }
      return {
        ...estado,
        seleccion: [...estado.seleccion, { fila: asiento.fila, numero: asiento.numero }],
        limiteAlcanzado: false,
      };
    }
    case "limpiar":
      return { ...estado, seleccion: [], limiteAlcanzado: false, quitadas: [] };
    case "marcarOcupadas": {
      const filas = estado.filas.map((fila) => ({
        ...fila,
        butacas: fila.butacas.map((b) =>
          accion.asientos.some((a) => mismaButaca(a, b)) ? { ...b, libre: false } : b,
        ),
      }));
      const { conservadas, quitadas } = conservarLibres(estado.seleccion, filas);
      return { filas, seleccion: conservadas, limiteAlcanzado: false, quitadas };
    }
    case "reemplazarMapa": {
      const { conservadas, quitadas } = conservarLibres(estado.seleccion, accion.filas);
      return { filas: accion.filas, seleccion: conservadas, limiteAlcanzado: false, quitadas };
    }
  }
}
