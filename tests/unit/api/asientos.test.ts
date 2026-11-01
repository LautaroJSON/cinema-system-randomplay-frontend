import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { obtenerMapaDesdeNavegador } from "@/api/asientos";
import { ApiError } from "@/api/client";
import { obtenerMapa } from "@/api/asientos-servidor";
import {
  ID_FUNCION_8X12,
  ID_FUNCION_COMENZADA,
  ID_FUNCION_INEXISTENTE,
  mapas,
} from "../../fixtures";
import { server } from "../../msw/setup";

describe("obtenerMapa (servidor)", () => {
  it("mapea la respuesta a MapaFuncion", async () => {
    const mapa = await obtenerMapa(ID_FUNCION_8X12);
    const api = mapas[ID_FUNCION_8X12];
    expect(mapa).toMatchObject({
      funcionId: ID_FUNCION_8X12,
      horaInicio: api.horaInicio,
      peliculaId: api.peliculaId,
      peliculaTitulo: api.peliculaTitulo,
      sucursalNombre: api.sucursalNombre,
      salaNombre: api.salaNombre,
      precioEntrada: api.precioEntrada,
      cantidadDisponibles: 93,
    });
    expect(mapa?.filas).toHaveLength(8);
    expect(mapa?.filas[1]?.butacas).toHaveLength(12);
    expect(mapa?.filas[2]?.butacas[4]).toEqual({ fila: "C", numero: 5, libre: false });
  });

  it("devuelve null si la función no existe", async () => {
    await expect(obtenerMapa(ID_FUNCION_INEXISTENTE)).resolves.toBeNull();
  });

  it("lanza ApiError 410 si la función ya comenzó", async () => {
    const error = (await obtenerMapa(ID_FUNCION_COMENZADA).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(410);
  });
});

describe("obtenerMapaDesdeNavegador", () => {
  it("pide por el proxy relativo y mapea el mapa", async () => {
    let url = "";
    server.use(
      http.get("*/api/funciones/:funcionId/asientos", ({ request }) => {
        url = request.url;
        return HttpResponse.json(mapas[ID_FUNCION_8X12]);
      }),
    );
    const resultado = await obtenerMapaDesdeNavegador(ID_FUNCION_8X12);
    expect(new URL(url).origin).toBe("http://localhost:3000");
    expect(resultado.ok && resultado.datos.filas).toHaveLength(8);
  });

  it.each([
    [ID_FUNCION_INEXISTENTE, 404],
    [ID_FUNCION_COMENZADA, 410],
  ])("devuelve el status cuando la función %s no está disponible", async (id, status) => {
    const resultado = await obtenerMapaDesdeNavegador(id);
    expect(resultado).toMatchObject({ ok: false, problema: { status } });
  });

  it("clasifica un fallo de red", async () => {
    server.use(http.get("*/api/funciones/:funcionId/asientos", () => HttpResponse.error()));
    const resultado = await obtenerMapaDesdeNavegador(ID_FUNCION_8X12);
    expect(resultado).toMatchObject({ ok: false, problema: { tipo: "red" } });
  });
});
