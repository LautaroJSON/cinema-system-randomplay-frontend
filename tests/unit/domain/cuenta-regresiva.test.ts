import { describe, expect, it } from "vitest";
import {
  describirRestante,
  formatearContador,
  medirDesfase,
  restanteMs,
  tramo,
} from "@/domain/cuenta-regresiva";

const AHORA = Date.parse("2026-11-01T17:00:00-03:00");
const MIN = 60_000;

describe("medirDesfase", () => {
  it("resta la hora del dispositivo a la del servidor", () => {
    expect(medirDesfase(1000, 400)).toBe(600);
    expect(medirDesfase(400, 1000)).toBe(-600);
  });

  it("sin hora del servidor o con un desfase absurdo, no corrige", () => {
    expect(medirDesfase(null, 400)).toBe(0);
    expect(medirDesfase(AHORA + 13 * 60 * MIN, AHORA)).toBe(0);
  });
});

describe("restanteMs", () => {
  it("cuenta desde venceEn respetando el offset", () => {
    expect(restanteMs("2026-11-01T17:09:42-03:00", 0, AHORA)).toBe(582_000);
    expect(restanteMs("2026-11-01T20:09:42Z", 0, AHORA)).toBe(582_000);
  });

  it("aplica el desfase del servidor", () => {
    expect(restanteMs("2026-11-01T17:09:42-03:00", 3 * MIN, AHORA)).toBe(582_000 - 3 * MIN);
  });

  it("nunca baja de cero, y un venceEn ilegible cuenta como vencido", () => {
    expect(restanteMs("2026-11-01T16:59:00-03:00", 0, AHORA)).toBe(0);
    expect(restanteMs("mañana", 0, AHORA)).toBe(0);
  });
});

describe("tramo", () => {
  it("separa normal, final y vencido en los 2 minutos", () => {
    expect(tramo(2 * MIN + 1000)).toBe("normal");
    expect(tramo(2 * MIN)).toBe("final");
    expect(tramo(1)).toBe("final");
    expect(tramo(0)).toBe("vencido");
  });
});

describe("formatearContador", () => {
  it("muestra MM:SS redondeando los segundos hacia arriba", () => {
    expect(formatearContador(582_000)).toBe("09:42");
    expect(formatearContador(581_001)).toBe("09:42");
    expect(formatearContador(1)).toBe("00:01");
    expect(formatearContador(0)).toBe("00:00");
    expect(formatearContador(75 * MIN)).toBe("75:00");
  });
});

describe("describirRestante", () => {
  it("arma un texto completo para lectores de pantalla", () => {
    expect(describirRestante(4 * MIN + 12_000)).toBe("Quedan 4 minutos y 12 segundos");
    expect(describirRestante(MIN)).toBe("Queda 1 minuto");
    expect(describirRestante(2 * MIN)).toBe("Quedan 2 minutos");
    expect(describirRestante(MIN + 1000)).toBe("Queda 1 minuto y 1 segundo");
    expect(describirRestante(MIN + 12_000)).toBe("Queda 1 minuto y 12 segundos");
    expect(describirRestante(30_000)).toBe("Quedan 30 segundos");
    expect(describirRestante(1000)).toBe("Queda 1 segundo");
    expect(describirRestante(0)).toBe("Se terminó el tiempo");
  });
});
