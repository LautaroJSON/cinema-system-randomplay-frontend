// Única traducción de `clasificacion` a etiquetas visibles (Principio V).

export type Clasificacion = {
  codigo: string;
  etiqueta: string;
  descripcion: string;
  conocida: boolean;
};

const CONOCIDAS: Record<string, { etiqueta: string; descripcion: string }> = {
  ATP: { etiqueta: "ATP", descripcion: "Apta para todo público" },
  Mas13: { etiqueta: "+13", descripcion: "Solo mayores de 13 años" },
  Mas16: { etiqueta: "+16", descripcion: "Solo mayores de 16 años" },
  Mas18: { etiqueta: "+18", descripcion: "Solo mayores de 18 años" },
};

export function traducirClasificacion(codigo: string): Clasificacion {
  const conocida = CONOCIDAS[codigo];
  if (conocida) return { codigo, ...conocida, conocida: true };
  return { codigo, etiqueta: codigo, descripcion: `Clasificación: ${codigo}`, conocida: false };
}
