import { describe, expect, it } from "vitest";
import { listarPeliculas, mapearResumen } from "@/api/catalogo";
import { ID_CLASIF_DESCONOCIDA, ID_CON_FUNCIONES, ID_SIN_FUNCIONES } from "../../fixtures";

describe("listarPeliculas", () => {
  it("mapea la lista de la API a PeliculaResumen", async () => {
    const peliculas = await listarPeliculas();
    expect(peliculas).toHaveLength(5);

    const conFunciones = peliculas.find((p) => p.id === ID_CON_FUNCIONES);
    expect(conFunciones).toEqual({
      id: ID_CON_FUNCIONES,
      titulo: "La noche del videoclub",
      duracionMinutos: 118,
      clasificacion: {
        codigo: "Mas13",
        etiqueta: "+13",
        descripcion: "Solo mayores de 13 años",
        conocida: true,
      },
      tieneFuncionesHoy: true,
      imagenUrl: null,
      codigoCinta: "RP-9A01",
    });

    expect(peliculas.find((p) => p.id === ID_SIN_FUNCIONES)?.tieneFuncionesHoy).toBe(false);
    expect(peliculas.find((p) => p.id === ID_CLASIF_DESCONOCIDA)?.clasificacion.conocida).toBe(
      false,
    );
  });
});

describe("mapearResumen: imagenUrl", () => {
  const item = {
    id: ID_CON_FUNCIONES,
    titulo: "Interstellar",
    duracionMinutos: 169,
    clasificacion: "ATP",
    sinFuncionesDisponibles: false,
  };

  it("conserva una URL http o https", () => {
    const url = "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg";
    expect(mapearResumen({ ...item, imagenUrl: url }).imagenUrl).toBe(url);
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "no es una url", ""])(
    "descarta %s",
    (imagenUrl) => {
      expect(mapearResumen({ ...item, imagenUrl }).imagenUrl).toBeNull();
    },
  );
});
