import { describe, expect, it } from "vitest";
import { validarEmail } from "@/domain/email";

const VACIO = "Escribí tu email.";
const FORMATO = "Revisá el email: le falta la arroba o el dominio.";

describe("validarEmail", () => {
  it("recorta espacios y acepta un email con forma válida", () => {
    expect(validarEmail("  a@b.co  ")).toEqual({ ok: true, email: "a@b.co" });
    expect(validarEmail("comprador@ejemplo.com.ar")).toEqual({
      ok: true,
      email: "comprador@ejemplo.com.ar",
    });
  });

  it("pide el email si está vacío", () => {
    expect(validarEmail("")).toEqual({ ok: false, mensaje: VACIO });
    expect(validarEmail("   ")).toEqual({ ok: false, mensaje: VACIO });
  });

  it.each(["nombre@", "@ejemplo.com", "a b@c.com", "a@b", "sin-arroba.com"])(
    "rechaza %s por formato",
    (texto) => {
      expect(validarEmail(texto)).toEqual({ ok: false, mensaje: FORMATO });
    },
  );

  it("acepta hasta 254 caracteres", () => {
    const dominio = "@ejemplo.com";
    expect(validarEmail(`${"a".repeat(254 - dominio.length)}${dominio}`).ok).toBe(true);
    expect(validarEmail(`${"a".repeat(255 - dominio.length)}${dominio}`).ok).toBe(false);
  });
});
