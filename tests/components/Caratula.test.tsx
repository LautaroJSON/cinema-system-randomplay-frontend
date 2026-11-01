import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Caratula } from "@/components/Caratula/Caratula";
import { traducirClasificacion } from "@/domain/clasificacion";

const datos = {
  titulo: "Interstellar",
  codigoCinta: "RP-0001",
  duracionMinutos: 169,
  clasificacion: traducirClasificacion("ATP"),
};

describe("Caratula", () => {
  it("muestra el póster con texto alternativo y el título como texto", () => {
    render(
      <Caratula {...datos} imagenUrl="https://upload.wikimedia.org/poster.jpg" variante="ficha">
        <h1>Interstellar</h1>
      </Caratula>,
    );
    const poster = screen.getByRole("img", { name: "Póster de Interstellar" });
    expect(poster).toHaveAttribute("fetchpriority", "high");
    expect(poster).not.toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("heading", { level: 1, name: "Interstellar" })).toBeInTheDocument();
  });

  it("en el estante, el póster se carga en diferido", () => {
    render(
      <Caratula {...datos} imagenUrl="https://image.tmdb.org/poster.jpg">
        <h3>Interstellar</h3>
      </Caratula>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });

  it("sin póster queda la carátula tipográfica", () => {
    render(
      <Caratula {...datos} imagenUrl={null}>
        <h3>Interstellar</h3>
      </Caratula>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interstellar" })).toBeInTheDocument();
  });
});
