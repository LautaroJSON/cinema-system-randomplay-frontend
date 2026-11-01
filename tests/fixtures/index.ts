import type { components } from "../../src/api/schema";
import { mapearCarrito } from "../../src/api/carritos";
import type { SesionCarrito } from "../../src/domain/sesion-carrito";
import carritosEstadosJson from "./carritos-estados.json" with { type: "json" };
import carritosJson from "./carritos.json" with { type: "json" };
import detallesJson from "./detalles.json" with { type: "json" };
import horariosJson from "./horarios.json" with { type: "json" };
import mapasJson from "./mapas.json" with { type: "json" };
import peliculasJson from "./peliculas.json" with { type: "json" };
import sucursalesJson from "./sucursales.json" with { type: "json" };

type Schemas = components["schemas"];
type HorarioFixture = Omit<Schemas["HorarioFuncionResponse"], "horaInicio"> & {
  offsetMinutos: number;
};

export const peliculas = peliculasJson satisfies Schemas["PeliculaListItemResponse"][];
export const detalles = detallesJson satisfies Record<string, Schemas["PeliculaDetalleResponse"]>;
export const sucursales = sucursalesJson satisfies Record<
  string,
  Schemas["SucursalConFuncionesHoyResponse"][]
>;
export const horarios = horariosJson satisfies Record<string, HorarioFixture[]>;
export const mapas = mapasJson satisfies Record<string, Schemas["MapaAsientosResponse"]>;
export const carritoCreado = carritosJson satisfies Schemas["CarritoCreadoResponse"];
export const carritosEstados = carritosEstadosJson satisfies Record<
  string,
  Schemas["CarritoResponse"]
>;

/** El carrito de `carritos.json` y `carritos-estados.json`. */
export const ID_CARRITO = carritoCreado.carrito.id;
export const ID_CARRITO_AJENO = "c4a7e2b1-3d5f-4c6e-9a8b-7f6e5d4c3bff";
export const TOKEN_PRUEBA = carritoCreado.token;

/** Sesión v2 de la pestaña con un carrito de `carritosEstados` ya mapeado. */
export function sesionDePrueba(
  carrito: Schemas["CarritoResponse"] = carritosEstados.activo,
  cambios: Partial<SesionCarrito> = {},
): SesionCarrito {
  return {
    version: 2,
    carritoId: carrito.id,
    token: TOKEN_PRUEBA,
    tokenVenceEn: carritoCreado.tokenVenceEn,
    carrito: mapearCarrito(carrito),
    desfaseMs: 0,
    ...cambios,
  };
}

export function guardarSesionDePrueba(...argumentos: Parameters<typeof sesionDePrueba>) {
  const sesion = sesionDePrueba(...argumentos);
  sessionStorage.setItem("randomplay:carrito", JSON.stringify(sesion));
  return sesion;
}

/** Copia del carrito que vence `ms` milisegundos después de `ahora`. */
export function conVencimiento(
  carrito: Schemas["CarritoResponse"],
  ms: number,
  ahora: Date = new Date(),
): Schemas["CarritoResponse"] {
  return { ...carrito, venceEn: isoArgentina(new Date(ahora.getTime() + ms)) };
}

export const ID_CON_FUNCIONES = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a01";
export const ID_SIN_FUNCIONES = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a02";
export const ID_CLASIF_DESCONOCIDA = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a03";
export const ID_SIN_SINOPSIS = ID_CLASIF_DESCONOCIDA;
export const ID_TITULO_LARGO = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a04";
export const ID_HORARIOS_FALLAN = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a05";

/** Funciones de `mapas.json`, una por cada forma de sala. */
export const ID_FUNCION_8X12 = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b001";
/** Sala más ancha: filas de 8, 10, 12, 12, 14 y 14 butacas. */
export const ID_FUNCION_ANCHA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b002";
export const ID_FUNCION_10X10 = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b004";
export const ID_FUNCION_COMPLETA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b005";
/** Sin mapa: la API responde 410 (la función ya comenzó). */
export const ID_FUNCION_COMENZADA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0f0";
export const ID_FUNCION_INEXISTENTE = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0ff";

/** Cuerpo `application/problem+json` de un error de negocio con `codigo` y extensiones. */
export function problemaCarrito(
  status: number,
  codigo: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return { type: `https://httpstatuses.io/${status}`, title: "Error", status, codigo, ...extras };
}

/** Hora fija de los tests unitarios. */
export const AHORA_TEST = new Date("2026-11-01T12:00:00-03:00");

/** Convierte un instante a ISO 8601 con offset -03:00, como lo devuelve la API. */
export function isoArgentina(fecha: Date): string {
  const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

/** Reemplaza `offsetMinutos` por un `horaInicio` relativo a `ahora`. */
export function conHoraInicio(
  lista: HorarioFixture[],
  ahora: Date,
): Schemas["HorarioFuncionResponse"][] {
  return lista.map(({ offsetMinutos, ...resto }) => {
    const inicio = new Date(ahora.getTime() + offsetMinutos * 60_000);
    inicio.setSeconds(0, 0);
    return { ...resto, horaInicio: isoArgentina(inicio) };
  });
}
