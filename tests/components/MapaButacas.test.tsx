import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapearMapa } from "@/api/asientos";
import { MapaButacas } from "@/components/MapaButacas/MapaButacas";
import type { Asiento } from "@/domain/butacas";
import { ID_FUNCION_8X12, ID_FUNCION_ANCHA, mapas } from "../fixtures";

const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

const butaca = (nombre: string | RegExp) => screen.getByRole("button", { name: nombre });

function dibujar(funcionId: string, props: { seleccion?: Asiento[]; bloqueado?: boolean } = {}) {
  const onAlternar = vi.fn();
  const { filas, salaNombre } = mapearMapa(mapas[funcionId as keyof typeof mapas]);
  render(
    <>
      <button type="button">Antes</button>
      <MapaButacas
        filas={filas}
        seleccion={props.seleccion ?? []}
        salaNombre={salaNombre}
        bloqueado={props.bloqueado}
        onAlternar={onAlternar}
      />
      <button type="button">Después</button>
    </>,
  );
  return { onAlternar, usuario: userEvent.setup() };
}

describe("MapaButacas", () => {
  beforeEach(() => scrollIntoView.mockClear());

  it("expone la grilla, las filas y cada butaca con fila, número y estado", () => {
    dibujar(ID_FUNCION_8X12, { seleccion: [{ fila: "A", numero: 2 }] });
    const grilla = screen.getByRole("grid", { name: "Butacas de Sala 1" });
    expect(within(grilla).getAllByRole("row")).toHaveLength(8);
    expect(within(grilla).getByRole("rowheader", { name: "Fila C" })).toBeInTheDocument();
    expect(butaca("Fila A, butaca 1, libre")).toBeInTheDocument();
    expect(butaca("Fila A, butaca 2, seleccionada")).toBeInTheDocument();
    expect(butaca("Fila C, butaca 5, ocupada")).toHaveAttribute("aria-disabled", "true");
  });

  it("es una sola parada de Tab y empieza en la primera libre de la fila del medio", async () => {
    const { usuario } = dibujar(ID_FUNCION_8X12);
    const enfocables = screen.getByRole("grid").querySelectorAll('button[tabindex="0"]');
    expect(enfocables).toHaveLength(1);

    await usuario.click(screen.getByRole("button", { name: "Antes" }));
    await usuario.tab();
    expect(butaca("Fila E, butaca 1, libre")).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("se mueve con flechas dentro de la fila sin pasar de fila", async () => {
    const { usuario } = dibujar(ID_FUNCION_8X12);
    await usuario.click(screen.getByRole("button", { name: "Antes" }));
    await usuario.tab();
    await usuario.keyboard("{ArrowLeft}");
    expect(butaca("Fila E, butaca 1, libre")).toHaveFocus();
    await usuario.keyboard("{ArrowRight}{ArrowRight}");
    expect(butaca("Fila E, butaca 3, libre")).toHaveFocus();
    await usuario.keyboard("{End}");
    expect(butaca("Fila E, butaca 12, libre")).toHaveFocus();
    await usuario.keyboard("{ArrowRight}");
    expect(butaca("Fila E, butaca 12, libre")).toHaveFocus();
    await usuario.keyboard("{Home}");
    expect(butaca("Fila E, butaca 1, libre")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("entre filas de distinto largo va al número más cercano", async () => {
    const { usuario } = dibujar(ID_FUNCION_ANCHA);
    await usuario.click(butaca("Fila B, butaca 10, libre"));
    await usuario.keyboard("{ArrowDown}");
    expect(butaca("Fila C, butaca 10, libre")).toHaveFocus();

    await usuario.click(butaca("Fila E, butaca 14, libre"));
    await usuario.keyboard("{ArrowUp}");
    expect(butaca("Fila D, butaca 12, libre")).toHaveFocus();
    await usuario.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(butaca("Fila A, butaca 8, libre")).toHaveFocus();
  });

  it("Enter y Espacio alternan la butaca enfocada, pero no una ocupada", async () => {
    const { usuario, onAlternar } = dibujar(ID_FUNCION_8X12);
    await usuario.click(screen.getByRole("button", { name: "Antes" }));
    await usuario.tab();
    await usuario.keyboard("{Enter}");
    expect(onAlternar).toHaveBeenLastCalledWith({ fila: "E", numero: 1 });
    await usuario.keyboard("{ArrowRight} ");
    expect(onAlternar).toHaveBeenLastCalledWith({ fila: "E", numero: 2 });

    onAlternar.mockClear();
    await usuario.keyboard(
      "{ArrowUp}{ArrowUp}{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}",
    );
    expect(butaca("Fila C, butaca 5, ocupada")).toHaveFocus();
    await usuario.keyboard("{Enter} ");
    expect(onAlternar).not.toHaveBeenCalled();
  });

  it("bloqueado no alterna nada", async () => {
    const { usuario, onAlternar } = dibujar(ID_FUNCION_8X12, { bloqueado: true });
    await usuario.click(butaca("Fila A, butaca 1, libre"));
    await usuario.keyboard("{Enter}");
    expect(onAlternar).not.toHaveBeenCalled();
  });
});
