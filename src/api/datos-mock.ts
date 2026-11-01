// TEMPORAL (spec 002): responde con el catálogo de prueba local en lugar de pedirle al backend.
// Se activa con API_MOCK=1. Se elimina junto con scripts/generar-mock-catalogo.mjs y
// scripts/mock-data/ cuando el backend tenga datos reales.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { components } from "./schema";

type Schemas = components["schemas"];
type HorarioMock = Omit<Schemas["HorarioFuncionResponse"], "horaInicio"> & {
  offsetMinutos: number;
};
type Catalogo = {
  peliculas: Schemas["PeliculaListItemResponse"][];
  detalles: Record<string, Schemas["PeliculaDetalleResponse"]>;
  sucursales: Record<string, Schemas["SucursalConFuncionesHoyResponse"][]>;
  horarios: Record<string, HorarioMock[]>;
};

const ARCHIVO = path.join(process.cwd(), "scripts", "mock-data", "catalogo.json");

let catalogo: Promise<Catalogo> | undefined;

function cargarCatalogo(): Promise<Catalogo> {
  catalogo ??= readFile(ARCHIVO, "utf8").then((texto) => JSON.parse(texto) as Catalogo);
  catalogo.catch(() => {
    catalogo = undefined;
  });
  return catalogo;
}

/** ISO 8601 con offset -03:00, como lo devuelve la API. */
function isoArgentina(fecha: Date): string {
  const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

function conHoraInicio(lista: HorarioMock[]): Schemas["HorarioFuncionResponse"][] {
  const ahora = Date.now();
  return lista.map(({ offsetMinutos, ...resto }) => {
    const inicio = new Date(ahora + offsetMinutos * 60_000);
    inicio.setSeconds(0, 0);
    return { ...resto, horaInicio: isoArgentina(inicio) };
  });
}

/** Misma respuesta que daría la API para `ruta`; `null` equivale a un 404. */
export async function responderConDatosMock(ruta: string): Promise<unknown> {
  const { peliculas, detalles, sucursales, horarios } = await cargarCatalogo();
  const id = (patron: RegExp) => ruta.match(patron)?.slice(1).map(decodeURIComponent);

  if (ruta === "/api/catalogo/peliculas") return peliculas;

  const [peliculaId] = id(/^\/api\/catalogo\/peliculas\/([^/]+)$/) ?? [];
  if (peliculaId) return detalles[peliculaId] ?? null;

  const [conSucursales] = id(/^\/api\/funciones\/peliculas\/([^/]+)\/sucursales-hoy$/) ?? [];
  if (conSucursales) return sucursales[conSucursales] ?? null;

  const [pelicula, sucursal] =
    id(/^\/api\/funciones\/peliculas\/([^/]+)\/sucursales\/([^/]+)\/horarios-hoy$/) ?? [];
  if (pelicula && sucursal) {
    const lista = horarios[`${pelicula}/${sucursal}`];
    return lista ? conHoraInicio(lista) : null;
  }

  return null;
}
