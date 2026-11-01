import { describe, expect, it } from "vitest";
import {
  duracionIso,
  formatearDuracion,
  formatearHora,
  formatearPrecio,
  normalizarEntero,
} from "@/domain/formato";

describe("formatearHora", () => {
  it("muestra la hora en 24 h", () => {
    expect(formatearHora("2026-11-01T21:30:00-03:00")).toBe("21:30");
  });

  it("convierte a la zona horaria de Argentina", () => {
    expect(formatearHora("2026-11-02T00:30:00Z")).toBe("21:30");
  });
});

describe("formatearPrecio", () => {
  it("formatea en pesos con el formato es-AR", () => {
    const texto = formatearPrecio({ monto: "4500.00", moneda: "ARS" });
    expect(texto).toMatch(/^\$\s4\.500,00$/);
  });

  it("no pierde precisión con montos grandes", () => {
    const texto = formatearPrecio({ monto: "12345678901234.10", moneda: "ARS" });
    expect(texto).toContain("12.345.678.901.234,10");
  });

  it("muestra el monto tal cual si no es un decimal válido", () => {
    expect(formatearPrecio({ monto: "abc", moneda: "ARS" })).toBe("abc ARS");
  });
});

describe("duración", () => {
  it("formatea en minutos", () => {
    expect(formatearDuracion(118)).toBe("118 min");
  });

  it("genera la duración ISO 8601", () => {
    expect(duracionIso(118)).toBe("PT118M");
  });
});

describe("normalizarEntero", () => {
  it("acepta números y textos numéricos positivos", () => {
    expect(normalizarEntero("118")).toBe(118);
    expect(normalizarEntero(95)).toBe(95);
  });

  it.each(["-3", "abc", 0, "1.5", -2])("rechaza %s", (valor) => {
    expect(normalizarEntero(valor)).toBeNull();
  });
});
