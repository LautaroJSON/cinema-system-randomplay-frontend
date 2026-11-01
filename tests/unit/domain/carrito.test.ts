import { describe, expect, it } from "vitest";
import { mapearCarrito } from "@/api/carritos";
import type { Problema } from "@/api/problema";
import {
  credencialPerdida,
  esModificable,
  etiquetaEstado,
  etiquetaLectura,
  repartirErrores,
  resolverProblemaCarrito,
  vistaPantalla,
} from "@/domain/carrito";
import type { Tramo } from "@/domain/cuenta-regresiva";
import {
  carritosEstados,
  ID_CARRITO,
  ID_CARRITO_AJENO,
  sesionDePrueba,
  TOKEN_PRUEBA,
} from "../../fixtures";

const problema = (cambios: Partial<Problema>): Problema => ({
  tipo: "desconocido",
  asientos: [],
  errors: {},
  ...cambios,
});

describe("etiquetaEstado", () => {
  it("traduce los estados conocidos y marca el desconocido", () => {
    expect(etiquetaEstado("Activo")).toBe("Activo");
    expect(etiquetaEstado("Abandonado")).toBe("Abandonado");
    expect(etiquetaEstado("Expirado")).toBe("Vencido");
    expect(etiquetaEstado("Pagado")).toBe("Estado desconocido");
  });
});

describe("esModificable", () => {
  const activo = mapearCarrito(carritosEstados.activo);

  it("solo un carrito Activo con tiempo restante", () => {
    expect(esModificable(activo, "normal")).toBe(true);
    expect(esModificable(activo, "final")).toBe(true);
    expect(esModificable(activo, "vencido")).toBe(false);
    expect(esModificable(mapearCarrito(carritosEstados.abandonado), "normal")).toBe(false);
    expect(esModificable(mapearCarrito(carritosEstados.expirado), "normal")).toBe(false);
    expect(esModificable({ ...activo, estado: "Pagado" }, "normal")).toBe(false);
  });
});

describe("credencialPerdida", () => {
  it("por carrito-no-encontrado o por un 401", () => {
    expect(credencialPerdida(problema({ tipo: "carrito-no-encontrado", status: 404 }))).toBe(true);
    expect(credencialPerdida(problema({ status: 401 }))).toBe(true);
    expect(credencialPerdida(problema({ tipo: "carrito-no-activo", status: 409 }))).toBe(false);
    expect(credencialPerdida(problema({ tipo: "red" }))).toBe(false);
  });
});

describe("vistaPantalla", () => {
  const base = { leida: true, carritoId: ID_CARRITO, tramo: "normal" as const, perdido: null };

  it("antes de leer la pestaña no decide nada", () => {
    expect(vistaPantalla({ ...base, leida: false, sesion: sesionDePrueba() }).tipo).toBe("sinLeer");
  });

  it("sin sesión, o con la de otro carrito, no hay carrito activo", () => {
    expect(vistaPantalla({ ...base, sesion: null }).tipo).toBe("sinSesion");
    expect(
      vistaPantalla({ ...base, carritoId: ID_CARRITO_AJENO, sesion: sesionDePrueba() }).tipo,
    ).toBe("sinSesion");
  });

  it("con token, estado Activo y tiempo restante, el carrito está activo", () => {
    const vista = vistaPantalla({ ...base, sesion: sesionDePrueba() });
    expect(vista).toMatchObject({ tipo: "activo", sesion: { token: TOKEN_PRUEBA } });
  });

  it("pasa a lectura con el motivo que corresponde", () => {
    const lectura = (sesion: ReturnType<typeof sesionDePrueba>, tramo: Tramo = "normal") =>
      vistaPantalla({ ...base, sesion, tramo });
    expect(lectura(sesionDePrueba(carritosEstados.abandonado))).toMatchObject({
      tipo: "lectura",
      motivo: "abandonado",
    });
    expect(lectura(sesionDePrueba(carritosEstados.expirado))).toMatchObject({ motivo: "vencido" });
    expect(lectura(sesionDePrueba(), "vencido")).toMatchObject({
      tipo: "lectura",
      motivo: "vencido",
    });
    expect(lectura(sesionDePrueba(undefined, { token: null }))).toMatchObject({
      tipo: "lectura",
      motivo: "noActivo",
    });
    expect(lectura(sesionDePrueba({ ...carritosEstados.activo, estado: "Pagado" }))).toMatchObject({
      tipo: "lectura",
      motivo: "noActivo",
    });
  });

  it("una sesión cerrada nunca vuelve a activo", () => {
    const cerrada = sesionDePrueba(undefined, { token: null });
    expect(vistaPantalla({ ...base, sesion: cerrada }).tipo).toBe("lectura");
  });

  it("una credencial perdida manda sobre todo lo demás", () => {
    const vista = vistaPantalla({ ...base, sesion: null, perdido: { peliculaId: "p1" } });
    expect(vista).toEqual({ tipo: "perdido", peliculaId: "p1" });
  });
});

describe("etiquetaLectura", () => {
  it("muestra Vencido para un carrito que venció por el contador aunque la API diga Activo", () => {
    const activo = mapearCarrito(carritosEstados.activo);
    expect(etiquetaLectura("vencido", activo)).toBe("Vencido");
    expect(etiquetaLectura("abandonado", activo)).toBe("Abandonado");
    expect(etiquetaLectura("noActivo", activo)).toBe("No activo");
    expect(etiquetaLectura("noActivo", { ...activo, estado: "Pagado" })).toBe("Estado desconocido");
  });
});

describe("repartirErrores", () => {
  it("separa los mensajes del campo, sin distinguir mayúsculas, de los generales", () => {
    expect(repartirErrores({ Email: ["a"], otro: ["b"] }, "email")).toEqual({
      campo: ["a"],
      generales: ["b"],
    });
  });

  it("sin mensajes, deja uno general para que el aviso diga algo", () => {
    expect(repartirErrores({}, "email")).toEqual({
      campo: [],
      generales: ["Revisá los datos y probá de nuevo."],
    });
  });
});

describe("resolverProblemaCarrito", () => {
  const OPERACIONES = ["obtener", "cambiar", "email", "abandonar"] as const;

  it.each(OPERACIONES)("en %s, un 401 o carrito-no-encontrado pierden la credencial", (op) => {
    expect(resolverProblemaCarrito(problema({ status: 401 }), op)).toEqual({ tipo: "perdido" });
    expect(
      resolverProblemaCarrito(problema({ tipo: "carrito-no-encontrado", status: 404 }), op),
    ).toEqual({ tipo: "perdido" });
  });

  it("carrito-no-activo cierra la sesión; en el abandono, sin aviso de error", () => {
    const noActivo = problema({ tipo: "carrito-no-activo", status: 409, estadoActual: "Expirado" });
    expect(resolverProblemaCarrito(noActivo, "email")).toEqual({
      tipo: "cerrar",
      estadoActual: "Expirado",
      aviso: true,
    });
    expect(resolverProblemaCarrito(noActivo, "cambiar")).toMatchObject({
      tipo: "cerrar",
      aviso: true,
    });
    expect(resolverProblemaCarrito(noActivo, "abandonar")).toMatchObject({
      tipo: "cerrar",
      aviso: false,
    });
  });

  it("pedido-invalido lo muestran el formulario o el selector", () => {
    const invalido = problema({ tipo: "pedido-invalido", status: 400 });
    expect(resolverProblemaCarrito(invalido, "email")).toEqual({ tipo: "invalido" });
    expect(resolverProblemaCarrito(invalido, "cambiar")).toEqual({ tipo: "invalido" });
    expect(resolverProblemaCarrito(invalido, "abandonar")).toEqual({
      tipo: "error",
      sinConexion: false,
    });
  });

  it.each([
    "asientos-no-disponibles",
    "asientos-inexistentes",
    "funcion-sin-cupo",
    "funcion-no-disponible",
    "funcion-no-encontrada",
  ] as const)(
    "%s lo resuelve el selector en el cambio, y en otra operación es un error",
    (tipo) => {
      expect(resolverProblemaCarrito(problema({ tipo }), "cambiar")).toEqual({ tipo: "butacas" });
      expect(resolverProblemaCarrito(problema({ tipo }), "email")).toEqual({
        tipo: "error",
        sinConexion: false,
      });
    },
  );

  it("la red lleva la cinta; un código desconocido o fuera de alcance, no", () => {
    expect(resolverProblemaCarrito(problema({ tipo: "red" }), "obtener")).toEqual({
      tipo: "error",
      sinConexion: true,
    });
    for (const tipo of ["desconocido", "demasiados-pedidos", "desafio-rechazado"] as const) {
      expect(resolverProblemaCarrito(problema({ tipo, status: 500 }), "email")).toEqual({
        tipo: "error",
        sinConexion: false,
      });
    }
  });
});
