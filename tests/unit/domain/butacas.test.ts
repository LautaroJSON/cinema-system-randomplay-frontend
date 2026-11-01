import { describe, expect, it } from "vitest";
import {
  buscarButaca,
  construirMapa,
  estadoInicial,
  etiquetaButaca,
  listarAsientos,
  marcarPropias,
  maximoEfectivo,
  mismaSeleccion,
  reducirSeleccion,
  type Asiento,
  type EstadoSelector,
} from "@/domain/butacas";

const filasApi = [
  { fila: "A", cantidadAsientos: 4, asientosDisponibles: [1, 2, 4] },
  { fila: "B", cantidadAsientos: "3", asientosDisponibles: ["1", 2, 3] },
];

const alternar = (estado: EstadoSelector, fila: string, numero: number) =>
  reducirSeleccion(estado, { tipo: "alternar", asiento: { fila, numero } });

describe("construirMapa", () => {
  it("arma una butaca por número, libre según los disponibles", () => {
    expect(construirMapa(filasApi)).toEqual([
      {
        letra: "A",
        butacas: [
          { fila: "A", numero: 1, libre: true },
          { fila: "A", numero: 2, libre: true },
          { fila: "A", numero: 3, libre: false },
          { fila: "A", numero: 4, libre: true },
        ],
      },
      {
        letra: "B",
        butacas: [
          { fila: "B", numero: 1, libre: true },
          { fila: "B", numero: 2, libre: true },
          { fila: "B", numero: 3, libre: true },
        ],
      },
    ]);
  });

  it("descarta filas inválidas e ignora disponibles fuera de rango", () => {
    const filas = construirMapa([
      { fila: "a", cantidadAsientos: 2, asientosDisponibles: [1] },
      { fila: "C", cantidadAsientos: 0, asientosDisponibles: [] },
      { fila: "D", cantidadAsientos: "x", asientosDisponibles: [] },
      { fila: "E", cantidadAsientos: 2, asientosDisponibles: [2, 9, -1] },
    ]);
    expect(filas).toEqual([
      {
        letra: "E",
        butacas: [
          { fila: "E", numero: 1, libre: false },
          { fila: "E", numero: 2, libre: true },
        ],
      },
    ]);
  });
});

describe("reducirSeleccion: alternar", () => {
  const inicial = estadoInicial(construirMapa(filasApi));

  it("agrega y quita butacas libres en el orden elegido", () => {
    let estado = alternar(inicial, "B", 2);
    estado = alternar(estado, "A", 1);
    expect(estado.seleccion).toEqual([
      { fila: "B", numero: 2 },
      { fila: "A", numero: 1 },
    ]);
    estado = alternar(estado, "B", 2);
    expect(estado.seleccion).toEqual([{ fila: "A", numero: 1 }]);
  });

  it("ignora una butaca ocupada o inexistente", () => {
    expect(alternar(inicial, "A", 3)).toBe(inicial);
    expect(alternar(inicial, "Z", 1)).toBe(inicial);
  });

  it("no pasa del máximo de 10 y avisa", () => {
    const grande = estadoInicial(
      construirMapa([
        {
          fila: "A",
          cantidadAsientos: 12,
          asientosDisponibles: [...Array(12).keys()].map((n) => n + 1),
        },
      ]),
    );
    let estado = grande;
    for (let n = 1; n <= 10; n++) estado = alternar(estado, "A", n);
    expect(estado.seleccion).toHaveLength(10);
    expect(estado.limiteAlcanzado).toBe(false);

    estado = alternar(estado, "A", 11);
    expect(estado.seleccion).toHaveLength(10);
    expect(estado.limiteAlcanzado).toBe(true);

    estado = alternar(estado, "A", 1);
    expect(estado.seleccion).toHaveLength(9);
    expect(estado.limiteAlcanzado).toBe(false);
  });

  it("el máximo efectivo es el menor entre 10 y las libres", () => {
    const chica = estadoInicial(
      construirMapa([{ fila: "A", cantidadAsientos: 5, asientosDisponibles: [1, 2, 3] }]),
    );
    expect(maximoEfectivo(chica)).toBe(3);
    expect(maximoEfectivo(inicial)).toBe(6);
  });

  it("limpiar vacía la selección", () => {
    const estado = reducirSeleccion(alternar(inicial, "A", 1), { tipo: "limpiar" });
    expect(estado.seleccion).toEqual([]);
  });
});

describe("textos de butacas", () => {
  it("etiqueta una butaca como fila y número", () => {
    expect(etiquetaButaca({ fila: "F", numero: 7 })).toBe("F7");
  });

  it("enumera butacas en castellano", () => {
    expect(listarAsientos([{ fila: "F", numero: 7 }])).toBe("la F7");
    expect(
      listarAsientos([
        { fila: "F", numero: 7 },
        { fila: "F", numero: 8 },
      ]),
    ).toBe("la F7 y la F8");
    expect(
      listarAsientos([
        { fila: "F", numero: 7 },
        { fila: "F", numero: 8 },
        { fila: "F", numero: 9 },
      ]),
    ).toBe("la F7, la F8 y la F9");
  });
});

describe("reducirSeleccion: cambios del mapa", () => {
  const conSeleccion = () => {
    let estado = estadoInicial(construirMapa(filasApi));
    for (const [fila, numero] of [
      ["A", 1],
      ["A", 2],
      ["B", 3],
    ] as const) {
      estado = reducirSeleccion(estado, { tipo: "alternar", asiento: { fila, numero } });
    }
    return estado;
  };

  it("marcarOcupadas pasa butacas a ocupadas y las saca de la selección", () => {
    const estado = reducirSeleccion(conSeleccion(), {
      tipo: "marcarOcupadas",
      asientos: [
        { fila: "A", numero: 2 },
        { fila: "Z", numero: 9 },
      ],
    });
    expect(estado.filas[0]?.butacas[1]).toEqual({ fila: "A", numero: 2, libre: false });
    expect(estado.seleccion).toEqual([
      { fila: "A", numero: 1 },
      { fila: "B", numero: 3 },
    ]);
    expect(estado.quitadas).toEqual([{ fila: "A", numero: 2 }]);
  });

  it("reemplazarMapa conserva las que siguen libres y saca las ocupadas o inexistentes", () => {
    const nuevas = construirMapa([
      { fila: "A", cantidadAsientos: 4, asientosDisponibles: [1, 4] },
      { fila: "B", cantidadAsientos: 2, asientosDisponibles: [1, 2] },
    ]);
    const estado = reducirSeleccion(conSeleccion(), { tipo: "reemplazarMapa", filas: nuevas });
    expect(estado.filas).toBe(nuevas);
    expect(estado.seleccion).toEqual([{ fila: "A", numero: 1 }]);
    expect(estado.quitadas).toEqual([
      { fila: "A", numero: 2 },
      { fila: "B", numero: 3 },
    ]);
  });
});

describe("cambio de butacas de un carrito", () => {
  // A3 está ocupada en el mapa: es la que retiene este mismo carrito.
  const propias = [
    { fila: "A", numero: 3 },
    { fila: "B", numero: 1 },
  ];

  it("marcarPropias pasa a libres las butacas del carrito e ignora las inexistentes", () => {
    const filas = marcarPropias(construirMapa(filasApi), [...propias, { fila: "Z", numero: 1 }]);
    expect(buscarButaca(filas, { fila: "A", numero: 3 })?.libre).toBe(true);
    expect(buscarButaca(filas, { fila: "B", numero: 1 })?.libre).toBe(true);
    expect(filas).toHaveLength(2);
  });

  it("estadoInicial arranca con la selección del carrito, solo si está libre", () => {
    const filas = marcarPropias(construirMapa(filasApi), propias);
    expect(estadoInicial(filas, propias).seleccion).toEqual(propias);
    expect(estadoInicial(construirMapa(filasApi), propias).seleccion).toEqual([
      { fila: "B", numero: 1 },
    ]);
  });

  it("mismaSeleccion compara sin importar el orden", () => {
    const [a3, b1] = propias as [Asiento, Asiento];
    expect(mismaSeleccion([a3, b1], [b1, a3])).toBe(true);
    expect(mismaSeleccion([a3], [a3, b1])).toBe(false);
    expect(mismaSeleccion([a3, b1], [a3, { fila: "B", numero: 2 }])).toBe(false);
  });
});
