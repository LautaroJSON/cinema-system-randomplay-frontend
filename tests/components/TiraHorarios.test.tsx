import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TiraHorarios } from "@/components/TiraHorarios/TiraHorarios";
import { formatearPrecio } from "@/domain/formato";

const grupos = [
  {
    sucursal: { id: "s1", nombre: "Sucursal Centro" },
    horarios: [
      {
        funcionId: "f1",
        horaInicio: "2026-11-01T21:30:00-03:00",
        salaNombre: "Sala 2",
        precio: { monto: "4500.00", moneda: "ARS" },
      },
    ],
  },
  { sucursal: { id: "s2", nombre: "Sucursal Palermo" }, horarios: [] },
];

describe("TiraHorarios", () => {
  it("muestra un encabezado por sucursal", () => {
    render(<TiraHorarios grupos={grupos} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Sucursal Centro",
      "Sucursal Palermo",
    ]);
  });

  it("cada horario es un enlace a la función con hora, sala y precio en su nombre", () => {
    render(<TiraHorarios grupos={grupos} />);
    const precio = formatearPrecio({ monto: "4500.00", moneda: "ARS" }).replace("$", "\\$");
    // jsdom recorta el espacio de cada separador; los navegadores lo conservan.
    const enlace = screen.getByRole("link", {
      name: new RegExp(`^21:30,\\s?Sala 2,\\s?${precio}$`),
    });
    expect(enlace).toHaveAttribute("href", "/funciones/f1");
    expect(within(enlace).getByText("21:30").closest("time")).toHaveAttribute(
      "dateTime",
      "2026-11-01T21:30:00-03:00",
    );
  });
});
