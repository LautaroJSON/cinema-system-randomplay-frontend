import { describe, expect, it } from "vitest";
import { descripcionFicha, recortarDescripcion } from "@/domain/descripcion";
import { traducirClasificacion } from "@/domain/clasificacion";

describe("recortarDescripcion", () => {
  it("devuelve el texto tal cual si entra", () => {
    expect(recortarDescripcion("Una sinopsis corta.")).toBe("Una sinopsis corta.");
  });

  it("corta en la última palabra antes del máximo y agrega puntos suspensivos", () => {
    const texto = `${"palabra ".repeat(30)}final`;
    const recorte = recortarDescripcion(texto);
    expect(recorte.length).toBeLessThanOrEqual(160);
    expect(recorte.endsWith("palabra…")).toBe(true);
  });

  it("colapsa espacios y saltos de línea", () => {
    expect(recortarDescripcion("Uno\n\n  dos   tres")).toBe("Uno dos tres");
  });

  it("corta una palabra larga sin espacios", () => {
    const recorte = recortarDescripcion("a".repeat(200));
    expect(recorte).toBe(`${"a".repeat(159)}…`);
  });
});

describe("descripcionFicha", () => {
  const base = {
    titulo: "Rebobinar",
    duracionMinutos: 95,
    clasificacion: traducirClasificacion("ATP"),
  };

  it("usa la sinopsis cuando existe", () => {
    expect(descripcionFicha({ ...base, sinopsis: "Dos hermanos heredan una videocasetera." })).toBe(
      "Dos hermanos heredan una videocasetera.",
    );
  });

  it("arma un texto alternativo sin sinopsis", () => {
    expect(descripcionFicha({ ...base, sinopsis: null })).toBe(
      "Rebobinar, 95 min, ATP. Horarios de hoy en RandomPlay.",
    );
  });
});
