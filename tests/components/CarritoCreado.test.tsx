import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CarritoCreado } from "@/components/CarritoCreado/CarritoCreado";
import { formatearPrecio } from "@/domain/formato";
import { guardarSesion } from "@/domain/sesion-carrito";
import { carritoCreado } from "../fixtures";

const { carrito } = carritoCreado;

function guardar() {
  guardarSesion({
    version: 1,
    carritoId: carrito.id,
    token: carritoCreado.token,
    tokenVenceEn: carritoCreado.tokenVenceEn,
    carrito: {
      id: carrito.id,
      estado: carrito.estado,
      venceEn: carrito.venceEn,
      asientos: carrito.asientos,
      funcion: carrito.funcion,
      total: carrito.total,
    },
  });
}

describe("CarritoCreado", () => {
  beforeEach(() => sessionStorage.clear());

  it("muestra el carrito guardado en la pestaña", async () => {
    guardar();
    const { container } = render(<CarritoCreado carritoId={carrito.id} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Tu carrito quedó creado" }),
    ).toBeInTheDocument();
    expect(screen.getByText(carrito.funcion.peliculaTitulo)).toBeInTheDocument();
    expect(screen.getByText(/Sala 1/)).toBeInTheDocument();
    expect(screen.getByText("Fila F, butaca 8")).toBeInTheDocument();
    expect(screen.getByText("Fila F, butaca 9")).toBeInTheDocument();
    expect(
      screen.getByText(formatearPrecio(carrito.total).replace(/\s/g, " ")),
    ).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(carritoCreado.token);
  });

  it.each([
    ["sin sesión", () => {}],
    ["con la sesión de otro carrito", guardar],
  ])("%s avisa que no hay carrito activo", async (_caso, preparar) => {
    preparar();
    render(<CarritoCreado carritoId="otro-id" />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No hay un carrito activo en esta pestaña",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a la cartelera" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
