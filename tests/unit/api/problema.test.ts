import { afterEach, describe, expect, it, vi } from "vitest";
import { leerProblema } from "@/api/problema";

const problem = (cuerpo: unknown, status = 409, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });

const CODIGOS = [
  "pedido-invalido",
  "desafio-rechazado",
  "funcion-no-encontrada",
  "carrito-no-encontrado",
  "asientos-no-disponibles",
  "funcion-sin-cupo",
  "carrito-no-activo",
  "funcion-no-disponible",
  "asientos-inexistentes",
  "demasiados-pedidos",
];

describe("leerProblema", () => {
  afterEach(() => vi.useRealTimers());

  it.each(CODIGOS)("reconoce el codigo %s", async (codigo) => {
    const problema = await leerProblema(problem({ codigo }));
    expect(problema.tipo).toBe(codigo);
    expect(problema.status).toBe(409);
  });

  it("marca como desconocido un codigo nuevo o ausente", async () => {
    expect((await leerProblema(problem({ codigo: "algo-nuevo" }))).tipo).toBe("desconocido");
    expect((await leerProblema(problem({ title: "Sin codigo" }, 404))).tipo).toBe("desconocido");
  });

  it("no parsea un cuerpo que no es problem+json", async () => {
    const respuesta = new Response(JSON.stringify({ codigo: "funcion-sin-cupo" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
    const problema = await leerProblema(respuesta);
    expect(problema.tipo).toBe("desconocido");
    expect(problema.status).toBe(409);
  });

  it("conserva solo los asientos bien formados", async () => {
    const problema = await leerProblema(
      problem({
        codigo: "asientos-no-disponibles",
        asientos: [
          { fila: "C", numero: 7 },
          { fila: "D", numero: "8" },
          { fila: "c", numero: 1 },
          { fila: "AA", numero: 1 },
          { fila: "E", numero: 0 },
          { fila: "F", numero: "x" },
          "G9",
        ],
      }),
    );
    expect(problema.asientos).toEqual([
      { fila: "C", numero: 7 },
      { fila: "D", numero: 8 },
    ]);
  });

  it("filtra los errors que no son listas de texto", async () => {
    const problema = await leerProblema(
      problem(
        {
          codigo: "pedido-invalido",
          errors: { asientos: ["Máximo 10", 3], email: "no es lista", otro: [] },
        },
        400,
      ),
    );
    expect(problema.errors).toEqual({ asientos: ["Máximo 10"] });
  });

  it("nunca expone title ni detail", async () => {
    const problema = await leerProblema(
      problem({ codigo: "funcion-sin-cupo", title: "Texto", detail: "Más texto" }),
    );
    expect(JSON.stringify(problema)).not.toContain("Texto");
  });

  describe("Retry-After en demasiados-pedidos", () => {
    const conRetry = (valor?: string) =>
      leerProblema(
        problem({ codigo: "demasiados-pedidos" }, 429, valor ? { "Retry-After": valor } : {}),
      );

    it("lee segundos", async () => {
      expect((await conRetry("30")).retryAfterSegundos).toBe(30);
    });

    it("convierte una fecha HTTP en segundos desde ahora", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T15:00:00Z"));
      const fecha = new Date("2026-11-01T15:00:45Z").toUTCString();
      expect((await conRetry(fecha)).retryAfterSegundos).toBe(45);
    });

    it("usa 60 si falta o no se puede leer", async () => {
      expect((await conRetry()).retryAfterSegundos).toBe(60);
      expect((await conRetry("0")).retryAfterSegundos).toBe(60);
      expect((await conRetry("abc")).retryAfterSegundos).toBe(60);
    });

    it("limita valores absurdos a 600", async () => {
      expect((await conRetry("99999")).retryAfterSegundos).toBe(600);
    });

    it("no lo lee en otros codigos", async () => {
      const problema = await leerProblema(
        problem({ codigo: "funcion-sin-cupo" }, 409, { "Retry-After": "30" }),
      );
      expect(problema.retryAfterSegundos).toBeUndefined();
    });
  });
});
