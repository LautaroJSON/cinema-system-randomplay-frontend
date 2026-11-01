import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HorariosVigentes } from "@/components/HorariosVigentes/HorariosVigentes";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const grupos = [
  {
    sucursal: { id: "s1", nombre: "Sucursal Centro" },
    horarios: [
      {
        funcionId: "f1",
        horaInicio: "2026-11-01T18:00:00-03:00",
        salaNombre: "Sala 1",
        precio: { monto: "4500.00", moneda: "ARS" },
      },
      {
        funcionId: "f2",
        horaInicio: "2026-11-01T21:00:00-03:00",
        salaNombre: "Sala 2",
        precio: { monto: "4500.00", moneda: "ARS" },
      },
    ],
  },
];

const enlaces = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

describe("HorariosVigentes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("muestra todos los horarios futuros", () => {
    vi.setSystemTime(new Date("2026-11-01T12:00:00-03:00"));
    render(<HorariosVigentes grupos={grupos} />);
    expect(enlaces()).toEqual(["/funciones/f1", "/funciones/f2"]);
  });

  it("oculta un horario cuando empieza", () => {
    vi.setSystemTime(new Date("2026-11-01T17:59:50-03:00"));
    render(<HorariosVigentes grupos={grupos} />);
    expect(enlaces()).toHaveLength(2);

    act(() => vi.advanceTimersByTime(30_000));
    expect(enlaces()).toEqual(["/funciones/f2"]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("si vencen todos, avisa, refresca una sola vez y termina en sin funciones", () => {
    vi.setSystemTime(new Date("2026-11-02T10:00:00-03:00"));
    const { rerender } = render(<HorariosVigentes grupos={grupos} />);

    expect(enlaces()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Actualizando horarios…");

    act(() => vi.advanceTimersByTime(2_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    // El refresh trajo la misma versión vieja: no se vuelve a intentar.
    rerender(<HorariosVigentes grupos={[...grupos]} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Hoy no hay más funciones de esta película.",
    );
  });
});
