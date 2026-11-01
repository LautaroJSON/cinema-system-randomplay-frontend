import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CarruselDestacadas } from "@/components/CarruselDestacadas/CarruselDestacadas";

const titulos = ["Interstellar", "Dune", "Relatos salvajes"];

function stubMovimientoReducido(reducido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reducido, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

function renderizar() {
  render(
    <CarruselDestacadas titulos={titulos}>
      {titulos.map((t) => (
        <a key={t} href={`/peliculas/${t}`}>
          {t}
        </a>
      ))}
    </CarruselDestacadas>,
  );
}

// Solo la diapositiva actual es interactiva: las demás están `inert`.
const visible = () =>
  screen
    .getAllByRole("group")
    .filter((d) => !d.hasAttribute("inert"))
    .map((d) => d.textContent);

describe("CarruselDestacadas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMovimientoReducido(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("avanza sola cada 6 segundos", () => {
    renderizar();
    expect(visible()).toEqual(["Interstellar"]);
    act(() => vi.advanceTimersByTime(6_000));
    expect(visible()).toEqual(["Dune"]);
  });

  it("se detiene con el botón Pausa y sigue con Play", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    act(() => vi.advanceTimersByTime(20_000));
    expect(visible()).toEqual(["Interstellar"]);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(6_000));
    expect(visible()).toEqual(["Dune"]);
  });

  it("se detiene mientras el mouse está encima", () => {
    renderizar();
    fireEvent.pointerEnter(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(20_000));
    expect(visible()).toEqual(["Interstellar"]);
  });

  it("anterior y siguiente navegan a mano", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Película anterior" }));
    expect(visible()).toEqual(["Relatos salvajes"]);
    // De la última a la primera pasa por la copia de la primera y termina al cerrar la transición.
    fireEvent.click(screen.getByRole("button", { name: "Película siguiente" }));
    fireEvent.transitionEnd(screen.getAllByRole("group")[0]!.parentElement!);
    expect(visible()).toEqual(["Interstellar"]);
  });

  it("con movimiento reducido no avanza sola ni ofrece pausa", () => {
    stubMovimientoReducido(true);
    renderizar();
    act(() => vi.advanceTimersByTime(20_000));
    expect(visible()).toEqual(["Interstellar"]);
    expect(screen.queryByRole("button", { name: "Pausa" })).not.toBeInTheDocument();
  });
});
