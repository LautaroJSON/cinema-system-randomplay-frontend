// Acceso directo a la API real desde Playwright (Node, sin proxy ni CORS): descubre funciones y
// butacas libres en cada corrida y verifica el estado del lado del servidor.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = process.env.API_REAL_URL ?? "http://localhost:8080";

/** Datos sembrados por el backend (docs/api.md, DevDataSeeder). */
export const SEMBRADO = {
  interstellar: "88888888-0000-0000-0000-000000000001",
  dune: "88888888-0000-0000-0000-000000000002",
  secretoDeSusOjos: "88888888-0000-0000-0000-000000000004",
  sucursalCentro: "11111111-0000-0000-0000-000000000001",
};

export type Asiento = { fila: string; numero: number };
type Dinero = { monto: string; moneda: string };
export type Horario = {
  funcionId: string;
  horaInicio: string;
  salaNombre: string;
  precioEntrada: Dinero;
};
type FilaMapa = { fila: string; cantidadAsientos: number; asientosDisponibles: number[] };
export type CarritoApi = {
  id: string;
  estado: string;
  venceEn: string;
  asientos: Asiento[];
  total: Dinero;
  emailEntrega: string | null;
};

/** Margen para que la función no empiece en medio de la corrida (la de expiración dura 5 min). */
const MARGEN_MS = 15 * 60_000;

export async function obtener<T>(request: APIRequestContext, ruta: string): Promise<T> {
  const respuesta = await request.get(`${API_URL}${ruta}`);
  expect(respuesta.status(), `GET ${ruta}`).toBe(200);
  return (await respuesta.json()) as T;
}

/** Primera función de hoy de Interstellar en Sucursal Centro que todavía no está por empezar. */
export async function funcionDePrueba(request: APIRequestContext): Promise<Horario> {
  const horarios = await obtener<Horario[]>(
    request,
    `/api/funciones/peliculas/${SEMBRADO.interstellar}/sucursales/${SEMBRADO.sucursalCentro}/horarios-hoy`,
  );
  const funcion = horarios.find((h) => Date.parse(h.horaInicio) - Date.now() > MARGEN_MS);
  if (!funcion) {
    throw new Error(
      "No quedan funciones de hoy con margen en Sucursal Centro. Reiniciar la API no alcanza si " +
        "las funciones ya existen: docker compose down -v && docker compose up -d --build.",
    );
  }
  return funcion;
}

export async function libresDelMapa(request: APIRequestContext, funcionId: string) {
  const mapa = await obtener<{ filas: FilaMapa[] }>(
    request,
    `/api/funciones/${funcionId}/asientos`,
  );
  return mapa.filas.flatMap((f) =>
    f.asientosDisponibles.map((numero) => ({ fila: f.fila, numero })),
  );
}

/** Tupla de `N` butacas, para desestructurar sin `undefined` (noUncheckedIndexedAccess). */
type Butacas<N extends number, R extends Asiento[] = []> = R["length"] extends N
  ? R
  : Butacas<N, [...R, Asiento]>;

/** `cantidad` butacas libres de una fila (cada prueba usa la suya para no pisarse). */
export async function elegirLibres<N extends number>(
  request: APIRequestContext,
  funcionId: string,
  fila: string,
  cantidad: N,
): Promise<Butacas<N>> {
  const libres = (await libresDelMapa(request, funcionId)).filter((a) => a.fila === fila);
  if (libres.length < cantidad) {
    throw new Error(`La fila ${fila} no tiene ${cantidad} butacas libres; reiniciá la base.`);
  }
  return libres.slice(0, cantidad) as Butacas<N>;
}

export async function estaLibre(request: APIRequestContext, funcionId: string, asiento: Asiento) {
  const libres = await libresDelMapa(request, funcionId);
  return libres.some((a) => a.fila === asiento.fila && a.numero === asiento.numero);
}

/** Lo que guardó el frontend en sessionStorage tras crear el carrito (sesion-carrito.ts). */
export async function leerSesion(page: Page) {
  const crudo = await page.evaluate(() => sessionStorage.getItem("randomplay:carrito"));
  expect(crudo, "sesión del carrito en sessionStorage").not.toBeNull();
  return JSON.parse(crudo!) as { carritoId: string; token: string | null };
}

export async function carritoEnApi(request: APIRequestContext, id: string, token: string) {
  const respuesta = await request.get(`${API_URL}/api/carritos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()) as CarritoApi;
}

/** Limpieza: libera las butacas aunque la prueba falle a mitad de camino. */
export async function abandonarEnApi(request: APIRequestContext, id: string, token: string) {
  await request.post(`${API_URL}/api/carritos/${id}/abandono`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const nombreButaca = (
  { fila, numero }: Asiento,
  estado: "libre" | "ocupada" | "seleccionada",
) => `Fila ${fila}, butaca ${numero}, ${estado}`;

/** "5500.00" × n en centavos enteros: el dinero llega como texto y no se opera con floats. */
export function multiplicarMonto(monto: string, veces: number): string {
  const [entero = "0", decimales = "0"] = monto.split(".");
  const centavos = (Number(entero) * 100 + Number(decimales.padEnd(2, "0"))) * veces;
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

/** "11000.00" → "11.000,00", como lo muestra la interfaz en es-AR. */
export function montoVisible(monto: string): string {
  const [entero = "0", decimales = "00"] = monto.split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimales}`;
}
