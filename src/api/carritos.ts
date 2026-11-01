import type { Dinero } from "@/domain/formato";
import { pedirDesdeNavegador, type Resultado } from "./navegador";
import type { Asiento } from "./problema";
import type { paths } from "./schema";

type CarritoCreadoApi =
  paths["/api/funciones/{funcionId}/carritos"]["post"]["responses"][201]["content"]["application/json"];
type CrearCarritoApi = NonNullable<
  paths["/api/funciones/{funcionId}/carritos"]["post"]["requestBody"]
>["content"]["application/json"];

export type CarritoCreado = {
  /** Credencial privada (Principio III): solo para sessionStorage. */
  token: string;
  tokenVenceEn: string;
  carrito: {
    id: string;
    estado: string;
    venceEn: string;
    asientos: Asiento[];
    funcion: {
      funcionId: string;
      horaInicio: string;
      peliculaId: string;
      peliculaTitulo: string;
      sucursalNombre: string;
      salaNombre: string;
    };
    total: Dinero;
  };
};

function mapearCarrito({ token, tokenVenceEn, carrito }: CarritoCreadoApi): CarritoCreado {
  const { funcion } = carrito;
  return {
    token,
    tokenVenceEn,
    carrito: {
      id: carrito.id,
      estado: carrito.estado,
      venceEn: carrito.venceEn,
      asientos: carrito.asientos.map(({ fila, numero }) => ({ fila, numero: Number(numero) })),
      funcion: {
        funcionId: funcion.funcionId,
        horaInicio: funcion.horaInicio,
        peliculaId: funcion.peliculaId,
        peliculaTitulo: funcion.peliculaTitulo,
        sucursalNombre: funcion.sucursalNombre,
        salaNombre: funcion.salaNombre,
      },
      total: { monto: carrito.total.monto, moneda: carrito.total.moneda },
    },
  };
}

/** Retiene la selección completa. El anti-bots (`desafio`) queda fuera de alcance. */
export async function crearCarrito(
  funcionId: string,
  asientos: Asiento[],
): Promise<Resultado<CarritoCreado>> {
  const cuerpo: CrearCarritoApi = { asientos, desafio: null };
  const resultado = await pedirDesdeNavegador<CarritoCreadoApi>(
    `/api/funciones/${encodeURIComponent(funcionId)}/carritos`,
    { metodo: "POST", cuerpo },
  );
  return resultado.ok ? { ok: true, datos: mapearCarrito(resultado.datos) } : resultado;
}

/** Libera los asientos de un carrito. Se usa sin esperar su resultado (FR-032). */
export function abandonarCarrito(carritoId: string, token: string): Promise<Resultado<unknown>> {
  return pedirDesdeNavegador(`/api/carritos/${encodeURIComponent(carritoId)}/abandono`, {
    metodo: "POST",
    token,
    timeoutMs: 3000,
  });
}
