import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoCargaHorario } from "@/components/TiraHorarios/AvisoCargaHorario";
import { AVISO_DEMORA_MS } from "@/config/experiencia";

const TEXTO_CARGA = "Cargando las butacas de las 20:30, Sala 2…";
const TEXTO_DEMORA = "Esto puede tardar un poco más. No hace falta recargar la página.";

describe("AvisoCargaHorario", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nombra la hora y la sala del horario tocado", () => {
    render(<AvisoCargaHorario hora="20:30" sala="Sala 2" />);
    expect(screen.getByText(TEXTO_CARGA, { selector: "p:not([role])" })).toBeVisible();
  });

  it("llena la región de estado después de montar, para que se anuncie", async () => {
    render(<AvisoCargaHorario hora="20:30" sala="Sala 2" />);
    const estado = screen.getByRole("status");
    expect(estado).toBeEmptyDOMElement();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(estado).toHaveTextContent(TEXTO_CARGA);
  });

  it("no tiene elementos enfocables", () => {
    const { baseElement } = render(<AvisoCargaHorario hora="20:30" sala="Sala 2" />);
    expect(baseElement.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });

  it("suma la línea de demora a los 5 s, no antes, y la anuncia una sola vez", async () => {
    render(<AvisoCargaHorario hora="20:30" sala="Sala 2" />);
    const estado = screen.getByRole("status");

    await act(() => vi.advanceTimersByTimeAsync(AVISO_DEMORA_MS - 1));
    expect(screen.queryByText(TEXTO_DEMORA, { selector: "p:not([role])" })).toBeNull();
    expect(estado).not.toHaveTextContent(TEXTO_DEMORA);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText(TEXTO_DEMORA, { selector: "p:not([role])" })).toBeVisible();
    expect(estado).toHaveTextContent(`${TEXTO_CARGA} ${TEXTO_DEMORA}`);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getAllByText(TEXTO_DEMORA, { selector: "p:not([role])" })).toHaveLength(1);
  });

  it("limpia sus temporizadores al desmontarse antes de la demora", async () => {
    const { unmount } = render(<AvisoCargaHorario hora="20:30" sala="Sala 2" />);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
