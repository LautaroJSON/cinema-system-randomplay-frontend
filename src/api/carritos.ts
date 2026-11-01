import type { Dinero } from "@/domain/formato";
import { mapearResultado, pedirDesdeNavegador, type Resultado } from "./navegador";
import type { Asiento } from "./problema";
import type { components, paths } from "./schema";

type CarritoApi = components["schemas"]["CarritoResponse"];
type CarritoCreadoApi = components["schemas"]["CarritoCreadoResponse"];
type CrearCarritoApi = NonNullable<
  paths["/api/funciones/{funcionId}/carritos"]["post"]["requestBody"]
>["content"]["application/json"];
type ReemplazarAsientosApi = components["schemas"]["ReemplazarAsientosRequest"];
type EmailEntregaApi = components["schemas"]["EmailEntregaRequest"];

export type Carrito = {
  id: string;
  /** `Activo`, `Abandonado` o `Expirado`; se traduce en `domain/carrito.ts`. */
  estado: string;
  venceEn: string;
  abandonadoEn: string | null;
  asientos: Asiento[];
  funcion: {
    funcionId: string;
    horaInicio: string;
    peliculaId: string;
    peliculaTitulo: string;
    sucursalNombre: string;
    salaNombre: string;
  };
  precioUnitario: Dinero;
  total: Dinero;
  emailEntrega: string | null;
};

export type CarritoCreado = {
  /** Credencial privada (Principio III): solo para sessionStorage. */
  token: string;
  tokenVenceEn: string;
  carrito: Carrito;
};

export function mapearCarrito(carrito: CarritoApi): Carrito {
  const { funcion } = carrito;
  return {
    id: carrito.id,
    estado: carrito.estado,
    venceEn: carrito.venceEn,
    abandonadoEn: carrito.abandonadoEn ?? null,
    asientos: carrito.asientos.map(({ fila, numero }) => ({ fila, numero: Number(numero) })),
    funcion: {
      funcionId: funcion.funcionId,
      horaInicio: funcion.horaInicio,
      peliculaId: funcion.peliculaId,
      peliculaTitulo: funcion.peliculaTitulo,
      sucursalNombre: funcion.sucursalNombre,
      salaNombre: funcion.salaNombre,
    },
    precioUnitario: { monto: carrito.precioUnitario.monto, moneda: carrito.precioUnitario.moneda },
    total: { monto: carrito.total.monto, moneda: carrito.total.moneda },
    emailEntrega: carrito.emailEntrega ?? null,
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
  return mapearResultado(resultado, ({ token, tokenVenceEn, carrito }) => ({
    token,
    tokenVenceEn,
    carrito: mapearCarrito(carrito),
  }));
}

// Las operaciones con token arman la ruta con el id guardado junto al token, para que la
// credencial no pueda viajar a otro carrito (Principio III).
const rutaCarrito = (carritoId: string) => `/api/carritos/${encodeURIComponent(carritoId)}`;

export async function obtenerCarrito(
  carritoId: string,
  token: string,
): Promise<Resultado<Carrito>> {
  return mapearResultado(
    await pedirDesdeNavegador<CarritoApi>(rutaCarrito(carritoId), { token }),
    mapearCarrito,
  );
}

/** Envía siempre la selección completa: las butacas que no van se liberan (Principio IV). */
export async function reemplazarAsientos(
  carritoId: string,
  token: string,
  asientos: Asiento[],
): Promise<Resultado<Carrito>> {
  const cuerpo: ReemplazarAsientosApi = { asientos };
  return mapearResultado(
    await pedirDesdeNavegador<CarritoApi>(`${rutaCarrito(carritoId)}/asientos`, {
      metodo: "PUT",
      cuerpo,
      token,
    }),
    mapearCarrito,
  );
}

export async function indicarEmail(
  carritoId: string,
  token: string,
  email: string,
): Promise<Resultado<Carrito>> {
  const cuerpo: EmailEntregaApi = { email };
  return mapearResultado(
    await pedirDesdeNavegador<CarritoApi>(`${rutaCarrito(carritoId)}/email-entrega`, {
      metodo: "PUT",
      cuerpo,
      token,
    }),
    mapearCarrito,
  );
}

/** Libera los asientos. El abandono previo de la 003 usa un timeout corto (FR-032). */
export async function abandonarCarrito(
  carritoId: string,
  token: string,
  timeoutMs?: number,
): Promise<Resultado<Carrito>> {
  return mapearResultado(
    await pedirDesdeNavegador<CarritoApi>(`${rutaCarrito(carritoId)}/abandono`, {
      metodo: "POST",
      token,
      timeoutMs,
    }),
    mapearCarrito,
  );
}
