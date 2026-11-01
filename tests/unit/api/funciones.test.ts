import { describe, expect, it } from "vitest";
import { listarHorariosHoy, listarSucursalesHoy } from "@/api/funciones";
import { ID_CON_FUNCIONES } from "../../fixtures";

const CENTRO = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4a01";
const INEXISTENTE = "00000000-0000-0000-0000-000000000000";

describe("funciones", () => {
  it("mapea las sucursales de hoy", async () => {
    const sucursales = await listarSucursalesHoy(ID_CON_FUNCIONES);
    expect(sucursales?.[0]).toEqual({ id: CENTRO, nombre: "Sucursal Centro" });
    expect(sucursales).toHaveLength(3);
  });

  it("mapea los horarios conservando el ISO y el monto como texto", async () => {
    const horarios = await listarHorariosHoy(ID_CON_FUNCIONES, CENTRO);
    expect(horarios?.[0]).toEqual({
      funcionId: "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b001",
      horaInicio: "2026-11-01T17:00:00-03:00",
      salaNombre: "Sala 1",
      precio: { monto: "4500.00", moneda: "ARS" },
    });
  });

  it("devuelve null ante 404", async () => {
    await expect(listarSucursalesHoy(INEXISTENTE)).resolves.toBeNull();
    await expect(listarHorariosHoy(INEXISTENTE, CENTRO)).resolves.toBeNull();
  });
});
