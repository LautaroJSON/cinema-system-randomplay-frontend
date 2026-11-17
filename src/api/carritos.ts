import type { Dinero } from "@/domain/formato";
import { mapearResultado, pedirDesdeNavegador, type Resultado } from "./navegador";
import type { Asiento } from "./problema";
import type { components, paths } from "./schema";

type CarritoApi = components["schemas"]["CarritoResponse"];
type CarritoCreadoApi = components["schemas"]["CarritoCreadoResponse"];
type PagoIniciadoApi = components["schemas"]["PagoIniciadoResponse"];
type EntradaApi = components["schemas"]["EntradaResponse"];
type CrearCarritoApi = NonNullable<
  paths["/api/funciones/{funcionId}/carritos"]["post"]["requestBody"]
>["content"]["application/json"];
type ReemplazarAsientosApi = components["schemas"]["ReemplazarAsientosRequest"];
type EmailEntregaApi = components["schemas"]["EmailEntregaRequest"];

/** Pago iniciado en Mercado Pago. `urlPago` se valida con `destinoPago` antes de seguirla. */
export type Pago = {
  urlPago: string;
  iniciadoEn: string;
  pagadoEn: string | null;
};

/** Entrada emitida al pagar; los datos de la función quedan copiados como estaban al pagar. */
export type Entrada = {
  codigo: string;
  pelicula: string;
  sucursal: string;
  sala: string;
  horaInicio: string;
  asiento: Asiento;
  precioUnitario: Dinero;
};

export type Carrito = {
  id: string;
  /** `Activo`, `Pagando`, `Pagado`, `Expirado` o `Abandonado`; se traduce en `domain/carrito.ts`. */
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
  /** `null` mientras no se inició el pago. */
  pago: Pago | null;
  /** Vacío salvo en `Pagado`. */
  entradas: Entrada[];
};

export type CarritoCreado = {
  /** Credencial privada (Principio III): solo para sessionStorage. */
  token: string;
  tokenVenceEn: string;
  carrito: Carrito;
};

function mapearEntrada({ asiento, precioUnitario, ...entrada }: EntradaApi): Entrada {
  return {
    codigo: entrada.codigo,
    pelicula: entrada.pelicula,
    sucursal: entrada.sucursal,
    sala: entrada.sala,
    horaInicio: entrada.horaInicio,
    asiento: { fila: asiento.fila, numero: Number(asiento.numero) },
    precioUnitario: { monto: precioUnitario.monto, moneda: precioUnitario.moneda },
  };
}

export function mapearCarrito(carrito: CarritoApi): Carrito {
  const { pago } = carrito;
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
    pago: pago
      ? { urlPago: pago.urlPago, iniciadoEn: pago.iniciadoEn, pagadoEn: pago.pagadoEn ?? null }
      : null,
    entradas: carrito.entradas.map(mapearEntrada),
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

export type PagoIniciado = { urlPago: string; carrito: Carrito };

/**
 * Inicia el pago (el carrito pasa a `Pagando` y gana un minuto) o, si ya estaba en `Pagando`,
 * devuelve la misma `urlPago` sin tocar el vencimiento: sirve para volver a la página de pago.
 */
export async function iniciarPago(
  carritoId: string,
  token: string,
): Promise<Resultado<PagoIniciado>> {
  return mapearResultado(
    await pedirDesdeNavegador<PagoIniciadoApi>(`${rutaCarrito(carritoId)}/pago`, {
      metodo: "POST",
      token,
    }),
    ({ urlPago, carrito }) => ({ urlPago, carrito: mapearCarrito(carrito) }),
  );
}
