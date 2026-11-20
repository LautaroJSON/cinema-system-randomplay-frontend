import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FichaPelicula } from "@/components/FichaPelicula/FichaPelicula";
import { traducirClasificacion } from "@/domain/clasificacion";

const datos = {
  titulo: "La noche del videoclub",
  imagenUrl: null,
  codigoCinta: "RP-9A01",
  duracionMinutos: 118,
  clasificacion: traducirClasificacion("Mas13"),
  sinopsis: "Una noche en el videoclub.",
  conAccion: true,
  destinoId: "titulo-horarios",
};

describe("FichaPelicula", () => {
  it("muestra título, ficha técnica y sinopsis como texto", () => {
    render(<FichaPelicula {...datos} />);
    expect(screen.getByRole("heading", { level: 1, name: datos.titulo })).toBeInTheDocument();
    expect(screen.getByText("Duración")).toBeInTheDocument();
    expect(screen.getByText("118 min")).toBeInTheDocument();
    expect(screen.getByText("Solo mayores de 13 años")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sinopsis" })).toBeInTheDocument();
    expect(screen.getByText(datos.sinopsis)).toBeInTheDocument();
  });

  it("sin póster dibuja el casete y no pide ninguna imagen", () => {
    render(<FichaPelicula {...datos} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("con póster lo pide primero, con texto alternativo", () => {
    render(<FichaPelicula {...datos} imagenUrl="https://upload.wikimedia.org/poster.jpg" />);
    const poster = screen.getByRole("img", { name: `Póster de ${datos.titulo}` });
    expect(poster).toHaveAttribute("fetchpriority", "high");
    expect(poster).not.toHaveAttribute("loading", "lazy");
  });

  it("el botón baja a los horarios, y no existe si no hay funciones", () => {
    const { rerender } = render(<FichaPelicula {...datos} />);
    expect(screen.getByRole("link", { name: "Ver horarios de hoy" })).toHaveAttribute(
      "href",
      "#titulo-horarios",
    );
    rerender(<FichaPelicula {...datos} conAccion={false} />);
    expect(screen.queryByRole("link", { name: "Ver horarios de hoy" })).not.toBeInTheDocument();
  });

  it("omite la sinopsis y la duración cuando no vienen", () => {
    render(<FichaPelicula {...datos} sinopsis={null} duracionMinutos={null} />);
    expect(screen.queryByRole("heading", { level: 2, name: "Sinopsis" })).not.toBeInTheDocument();
    expect(screen.queryByText("Duración")).not.toBeInTheDocument();
  });
});
