import { describe, expect, it } from "vitest";
import { traducirClasificacion } from "@/domain/clasificacion";

describe("traducirClasificacion", () => {
  it.each([
    ["ATP", "ATP", "Apta para todo público"],
    ["Mas13", "+13", "Solo mayores de 13 años"],
    ["Mas16", "+16", "Solo mayores de 16 años"],
    ["Mas18", "+18", "Solo mayores de 18 años"],
  ])("traduce %s", (codigo, etiqueta, descripcion) => {
    expect(traducirClasificacion(codigo)).toEqual({
      codigo,
      etiqueta,
      descripcion,
      conocida: true,
    });
  });

  it("muestra el valor original ante una clasificación desconocida", () => {
    expect(traducirClasificacion("Mas21")).toEqual({
      codigo: "Mas21",
      etiqueta: "Mas21",
      descripcion: "Clasificación: Mas21",
      conocida: false,
    });
  });
});
