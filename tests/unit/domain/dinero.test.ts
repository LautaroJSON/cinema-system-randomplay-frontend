import { describe, expect, it } from "vitest";
import { aCentavos, desdeCentavos, multiplicar } from "@/domain/dinero";

describe("aCentavos", () => {
  it("convierte el texto de la API a centavos enteros", () => {
    expect(aCentavos("4500.00")).toBe(450000);
    expect(aCentavos("7250.50")).toBe(725050);
    expect(aCentavos("0.05")).toBe(5);
  });

  it.each(["4500", "4500.5", "-1.00", "1e3", "", " 1.00", "1.000"])(
    "rechaza el monto mal formado %j",
    (monto) => {
      expect(aCentavos(monto)).toBeNull();
    },
  );
});

describe("desdeCentavos", () => {
  it("vuelve al formato de la API", () => {
    expect(desdeCentavos(1450100, "ARS")).toEqual({ monto: "14501.00", moneda: "ARS" });
    expect(desdeCentavos(5, "ARS")).toEqual({ monto: "0.05", moneda: "ARS" });
    expect(desdeCentavos(0, "ARS")).toEqual({ monto: "0.00", moneda: "ARS" });
  });
});

describe("multiplicar", () => {
  it("multiplica sin punto flotante", () => {
    expect(multiplicar({ monto: "7250.50", moneda: "ARS" }, 2)).toEqual({
      monto: "14501.00",
      moneda: "ARS",
    });
  });

  it("coincide al centavo para 1 a 10 entradas (SC-004)", () => {
    for (const monto of ["0.10", "0.20", "4999.99", "7250.50"]) {
      for (let cantidad = 1; cantidad <= 10; cantidad++) {
        const total = multiplicar({ monto, moneda: "ARS" }, cantidad);
        expect(aCentavos(total?.monto ?? "")).toBe((aCentavos(monto) ?? NaN) * cantidad);
      }
    }
  });

  it("devuelve null si el precio no se puede leer", () => {
    expect(multiplicar({ monto: "4500", moneda: "ARS" }, 2)).toBeNull();
  });
});
