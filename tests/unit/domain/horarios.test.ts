import { describe, expect, it, vi } from "vitest";
import type { Horario, Sucursal } from "@/api/funciones";
import { armarHorariosPorSucursal, filtrarVigentes } from "@/domain/horarios";

const centro: Sucursal = { id: "s1", nombre: "Sucursal Centro" };
const palermo: Sucursal = { id: "s2", nombre: "Sucursal Palermo" };
const flores: Sucursal = { id: "s3", nombre: "Sucursal Flores" };

const horario = (funcionId: string, horaInicio: string): Horario => ({
  funcionId,
  horaInicio,
  salaNombre: "Sala 1",
  precio: { monto: "4500.00", moneda: "ARS" },
});

describe("armarHorariosPorSucursal", () => {
  it("ordena por instante, conserva el orden de sucursales y omite las vacías", async () => {
    const estado = await armarHorariosPorSucursal("p1", {
      listarSucursalesHoy: async () => [centro, flores, palermo],
      listarHorariosHoy: async (_, sucursalId) =>
        ({
          s1: [
            horario("f2", "2026-11-01T22:00:00-03:00"),
            // 00:30Z es 21:30 en Argentina: va antes que las 22:00.
            horario("f1", "2026-11-02T00:30:00Z"),
          ],
          s2: [horario("f3", "2026-11-01T18:00:00-03:00")],
          s3: [],
        })[sucursalId] ?? null,
    });

    expect(estado).toEqual({
      tipo: "ok",
      grupos: [
        {
          sucursal: centro,
          horarios: [
            horario("f1", "2026-11-02T00:30:00Z"),
            horario("f2", "2026-11-01T22:00:00-03:00"),
          ],
        },
        { sucursal: palermo, horarios: [horario("f3", "2026-11-01T18:00:00-03:00")] },
      ],
    });
  });

  it("omite una sucursal cuyos horarios responden 404", async () => {
    const estado = await armarHorariosPorSucursal("p1", {
      listarSucursalesHoy: async () => [centro, palermo],
      listarHorariosHoy: async (_, sucursalId) =>
        sucursalId === "s1" ? [horario("f1", "2026-11-01T21:00:00-03:00")] : null,
    });
    expect(estado.tipo === "ok" && estado.grupos.map((g) => g.sucursal.id)).toEqual(["s1"]);
  });

  it.each([
    ["sin sucursales", async () => []],
    ["con sucursales en 404", async () => null],
  ])("devuelve vacío %s", async (_, listarSucursalesHoy) => {
    const estado = await armarHorariosPorSucursal("p1", {
      listarSucursalesHoy,
      listarHorariosHoy: vi.fn(),
    });
    expect(estado).toEqual({ tipo: "vacio" });
  });

  it("devuelve vacío si ninguna sucursal tiene horarios", async () => {
    const estado = await armarHorariosPorSucursal("p1", {
      listarSucursalesHoy: async () => [centro],
      listarHorariosHoy: async () => [],
    });
    expect(estado).toEqual({ tipo: "vacio" });
  });

  it("devuelve error si cualquier pedido falla", async () => {
    const estado = await armarHorariosPorSucursal("p1", {
      listarSucursalesHoy: async () => [centro, palermo],
      listarHorariosHoy: async (_, sucursalId) => {
        if (sucursalId === "s2") throw new Error("500");
        return [horario("f1", "2026-11-01T21:00:00-03:00")];
      },
    });
    expect(estado).toEqual({ tipo: "error" });
  });
});

describe("filtrarVigentes", () => {
  const grupos = [
    {
      sucursal: centro,
      horarios: [
        horario("f1", "2026-11-01T18:00:00-03:00"),
        horario("f2", "2026-11-01T21:00:00-03:00"),
      ],
    },
    { sucursal: palermo, horarios: [horario("f3", "2026-11-01T19:00:00-03:00")] },
  ];

  it("quita los horarios ya comenzados y las sucursales que quedan vacías", () => {
    const ahora = new Date("2026-11-01T19:00:00-03:00");
    expect(filtrarVigentes(grupos, ahora)).toEqual([
      { sucursal: centro, horarios: [horario("f2", "2026-11-01T21:00:00-03:00")] },
    ]);
  });

  it("al día siguiente no queda ninguno", () => {
    expect(filtrarVigentes(grupos, new Date("2026-11-02T10:00:00-03:00"))).toEqual([]);
  });
});
