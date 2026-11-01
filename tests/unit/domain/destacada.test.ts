import { describe, expect, it } from "vitest";
import { elegirDestacadas } from "@/domain/destacada";

const p = (id: string, tieneFuncionesHoy: boolean) => ({ id, tieneFuncionesHoy });

describe("elegirDestacadas", () => {
  it("toma las primeras con funciones hoy y deja el resto en orden", () => {
    const lista = [p("a", false), p("b", true), p("c", true), p("d", false)];
    expect(elegirDestacadas(lista)).toEqual({
      destacadas: [p("b", true), p("c", true)],
      resto: [p("a", false), p("d", false)],
    });
  });

  it("respeta el máximo", () => {
    const lista = ["a", "b", "c", "d"].map((id) => p(id, true));
    const { destacadas, resto } = elegirDestacadas(lista, 2);
    expect(destacadas.map((x) => x.id)).toEqual(["a", "b"]);
    expect(resto.map((x) => x.id)).toEqual(["c", "d"]);
  });

  it("no destaca ninguna si ninguna tiene funciones hoy", () => {
    const lista = [p("a", false), p("b", false)];
    expect(elegirDestacadas(lista)).toEqual({ destacadas: [], resto: lista });
  });

  it("acepta una lista vacía", () => {
    expect(elegirDestacadas([])).toEqual({ destacadas: [], resto: [] });
  });
});
