import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRASE_INICIAL, PantallaCargaPelicula } from "@/components/TarjetaPelicula/PantallaCargaPelicula";
import { AVISO_CASI_MS, AVISO_DEMORA_MS } from "@/config/experiencia";

const TITULO = "La noche del videoclub";

function abrir() {
  const onVolver = vi.fn();
  const resultado = render(<PantallaCargaPelicula titulo={TITULO} onVolver={onVolver} />);
  // jsdom no implementa showModal: se abre a mano para poder consultarla por rol.
  const dialogo = resultado.container.ownerDocument.querySelector("dialog");
  dialogo?.setAttribute("open", "");
  return { onVolver, dialogo };
}

describe("PantallaCargaPelicula", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("nombra la película que se está abriendo y lleva el foco al título", () => {
    abrir();
    expect(screen.getByRole("dialog", { name: TITULO })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: TITULO })).toHaveFocus();
    expect(screen.getByText("Cargando la ficha y los horarios de hoy…")).toBeInTheDocument();
  });

  it("anuncia la carga después de montar", async () => {
    abrir();
    const estado = screen.getByRole("status");
    expect(estado).toBeEmptyDOMElement();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(estado).toHaveTextContent(`Cargando ${TITULO}.`);
  });

  it("explica la demora a los 5 s y avisa que falta poco a los 20 s", async () => {
    abrir();
    // La línea tiene texto desde el principio, para que nada salte a los 5 s.
    expect(screen.getByText(FRASE_INICIAL)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(AVISO_DEMORA_MS));
    expect(screen.queryByText(FRASE_INICIAL)).not.toBeInTheDocument();
    expect(screen.getByText(/^Esto puede tardar un poco más/)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(AVISO_CASI_MS - AVISO_DEMORA_MS));
    expect(screen.getByText(/^Ya casi terminamos/)).toBeInTheDocument();
  });

  it("vuelve a la cartelera con el botón y con Escape", () => {
    const { onVolver, dialogo } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la cartelera" }));
    expect(onVolver).toHaveBeenCalledTimes(1);

    const escape = new Event("cancel", { cancelable: true });
    dialogo?.dispatchEvent(escape);
    expect(onVolver).toHaveBeenCalledTimes(2);
    // El diálogo no se cierra solo: lo cierra la pantalla al desmontarse.
    expect(escape.defaultPrevented).toBe(true);
  });

  it("limpia sus temporizadores al desmontarse", async () => {
    const { unmount } = render(<PantallaCargaPelicula titulo={TITULO} onVolver={() => {}} />);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
