import { describe, expect, it } from "vitest";
import { ESPERA_PAGO_MAXIMA_MS } from "@/config/experiencia";
import { destinoPago, rutaVuelta, siguientePaso, validarMontoSimulado } from "@/domain/pago";
import { ID_CARRITO, URL_PAGO_REAL, URL_PAGO_SIMULADA } from "../../fixtures";

describe("destinoPago", () => {
  it("sigue una dirección https de la pasarela real", () => {
    expect(destinoPago(URL_PAGO_REAL, ID_CARRITO, false)).toEqual({
      tipo: "externo",
      url: URL_PAGO_REAL,
    });
  });

  it("cambia la ruta simulada por la página propia, solo si está habilitada", () => {
    expect(destinoPago(URL_PAGO_SIMULADA, ID_CARRITO, true)).toEqual({
      tipo: "simulado",
      ruta: `/carritos/${ID_CARRITO}/pago-simulado`,
    });
    expect(destinoPago(URL_PAGO_SIMULADA, ID_CARRITO, false)).toEqual({ tipo: "invalido" });
  });

  it("escapa el id del carrito en la ruta simulada", () => {
    expect(destinoPago(URL_PAGO_SIMULADA, "a/b?c", true)).toEqual({
      tipo: "simulado",
      ruta: "/carritos/a%2Fb%3Fc/pago-simulado",
    });
  });

  it.each([
    "http://sandbox.mercadopago.com.ar/checkout",
    "javascript:alert(1)",
    "//evil.example/checkout",
    "/otra/ruta",
    "/api/dev/pagos-simulados",
    "data:text/html,hola",
    "",
  ])("no sigue %j", (url) => {
    expect(destinoPago(url, ID_CARRITO, true)).toEqual({ tipo: "invalido" });
  });
});

describe("rutaVuelta", () => {
  it("es la página de vuelta del carrito", () => {
    expect(rutaVuelta(ID_CARRITO)).toBe(`/carritos/${ID_CARRITO}/pago`);
  });
});

describe("siguientePaso", () => {
  it("consulta mientras el carrito siga en pago y no se llegó al tope", () => {
    expect(siguientePaso("Pagando", 0)).toBe("consultar");
    expect(siguientePaso("Pagando", ESPERA_PAGO_MAXIMA_MS - 1)).toBe("consultar");
  });

  it("se detiene en el tope", () => {
    expect(siguientePaso("Pagando", ESPERA_PAGO_MAXIMA_MS)).toBe("detener");
    expect(siguientePaso("Pagando", ESPERA_PAGO_MAXIMA_MS + 5000)).toBe("detener");
  });

  it.each(["Pagado", "Expirado", "Abandonado", "Activo", "Otro"])("termina con %s", (estado) => {
    expect(siguientePaso(estado, 0)).toBe("terminar");
  });
});

describe("validarMontoSimulado", () => {
  it.each([
    ["4500.00", 4500],
    ["1", 1],
    ["0.5", 0.5],
    [" 100.50 ", 100.5],
  ])("acepta %j", (texto, monto) => {
    expect(validarMontoSimulado(texto)).toEqual({ ok: true, monto });
  });

  it.each(["", "0", "0.00", "-1", "1,5", "1.234", "abc", "1e3", "1234567890"])(
    "rechaza %j",
    (texto) => {
      expect(validarMontoSimulado(texto)).toEqual({
        ok: false,
        mensaje: "Escribí un monto mayor que cero, con hasta dos decimales.",
      });
    },
  );
});
