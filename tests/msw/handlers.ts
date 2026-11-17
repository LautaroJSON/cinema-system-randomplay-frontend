import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from "msw";
import { multiplicar } from "../../src/domain/dinero";
import {
  AHORA_TEST,
  carritoCreado,
  carritosEstados,
  conHoraInicio,
  conVencimiento,
  detalles,
  horarios,
  ID_CARRITO,
  ID_FUNCION_COMENZADA,
  ID_HORARIOS_FALLAN,
  mapas,
  peliculas,
  problemaCarrito,
  sucursales,
  TOKEN_PRUEBA,
  URL_PAGO_SIMULADA,
} from "../fixtures";

export const API = "http://api.test";

const problema = (status: number) =>
  HttpResponse.json(
    { type: `https://httpstatuses.io/${status}`, title: "Error", status },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );

export const handlers = [
  http.get(`${API}/api/catalogo/peliculas`, () => HttpResponse.json(peliculas)),
  http.get(`${API}/api/catalogo/peliculas/:id`, ({ params }) => {
    const detalle = detalles[params.id as keyof typeof detalles];
    return detalle ? HttpResponse.json(detalle) : problema(404);
  }),
  http.get(`${API}/api/funciones/peliculas/:peliculaId/sucursales-hoy`, ({ params }) => {
    const lista = sucursales[params.peliculaId as keyof typeof sucursales];
    return lista ? HttpResponse.json(lista) : problema(404);
  }),
  http.get(
    `${API}/api/funciones/peliculas/:peliculaId/sucursales/:sucursalId/horarios-hoy`,
    ({ params }) => {
      if (params.peliculaId === ID_HORARIOS_FALLAN) return problema(500);
      const lista = horarios[`${params.peliculaId}/${params.sucursalId}` as keyof typeof horarios];
      return lista ? HttpResponse.json(conHoraInicio(lista, AHORA_TEST)) : problema(404);
    },
  ),
  // El mapa se pide desde el servidor (http://api.test) y desde el navegador por el proxy
  // relativo, que en jsdom se resuelve contra http://localhost:3000: `*` cubre los dos.
  http.get("*/api/funciones/:funcionId/asientos", ({ params }) => {
    if (params.funcionId === ID_FUNCION_COMENZADA) return problema(410);
    const mapa = mapas[params.funcionId as keyof typeof mapas];
    return mapa ? HttpResponse.json(mapa) : problema(404);
  }),
  http.post("*/api/funciones/:funcionId/carritos", () =>
    HttpResponse.json(carritoCreado, { status: 201 }),
  ),
  http.get("*/api/carritos/:carritoId", ({ request, params }) =>
    conCredencial(request, params, () => carritosEstados.activo),
  ),
  http.put("*/api/carritos/:carritoId/asientos", async ({ request, params }) => {
    const { asientos } = (await request.clone().json()) as {
      asientos: { fila: string; numero: number }[];
    };
    return conCredencial(request, params, () => ({
      ...carritosEstados.activo,
      asientos,
      total:
        multiplicar(carritosEstados.activo.precioUnitario, asientos.length) ??
        carritosEstados.activo.total,
    }));
  }),
  http.put("*/api/carritos/:carritoId/email-entrega", async ({ request, params }) => {
    const { email } = (await request.clone().json()) as { email: string };
    // Vencimiento relativo a ahora: el del fixture es fijo y la pantalla lo tomaría como vencido.
    return conCredencial(request, params, () => ({
      ...conVencimiento(carritosEstados.activo, 4 * 60_000),
      emailEntrega: email,
    }));
  }),
  http.post("*/api/carritos/:carritoId/abandono", ({ request, params }) =>
    conCredencial(request, params, () => carritosEstados.abandonado),
  ),
  http.post("*/api/carritos/:carritoId/pago", ({ request, params }) =>
    conCredencial(request, params, () => ({
      urlPago: URL_PAGO_SIMULADA,
      carrito: conVencimiento(carritosEstados.pagando, 5 * 60_000),
    })),
  ),
  // Público: si llega con `Authorization`, el token se filtró a donde no debía (Principio III).
  http.post("*/api/dev/pagos-simulados", ({ request }) =>
    request.headers.has("Authorization")
      ? new HttpResponse(null, { status: 401 })
      : HttpResponse.json({ pagoId: "sim-1", estadoCarrito: "Pagado" }),
  ),
];

/** Error de negocio `application/problem+json` con su `codigo`, para `server.use(...)`. */
export function respuestaProblema(
  status: number,
  codigo: string,
  extras: Record<string, unknown> = {},
) {
  return HttpResponse.json(problemaCarrito(status, codigo, extras), {
    status,
    headers: { "Content-Type": "application/problem+json", ...conFecha() },
  });
}

/** Header `Date` con la hora actual (la simulada, si los timers son falsos). */
export const conFecha = () => ({ Date: new Date().toUTCString() });

/** Como la API: 401 sin el token de prueba y `carrito-no-encontrado` para otro carrito. */
function conCredencial(
  request: StrictRequest<DefaultBodyType>,
  params: Record<string, string | readonly string[] | undefined>,
  responder: () => unknown,
) {
  if (request.headers.get("Authorization") !== `Bearer ${TOKEN_PRUEBA}`) {
    return new HttpResponse(null, { status: 401, headers: conFecha() });
  }
  if (params.carritoId !== ID_CARRITO) {
    return HttpResponse.json(problemaCarrito(404, "carrito-no-encontrado"), {
      status: 404,
      headers: { "Content-Type": "application/problem+json", ...conFecha() },
    });
  }
  return HttpResponse.json(responder() as Record<string, unknown>, { headers: conFecha() });
}
