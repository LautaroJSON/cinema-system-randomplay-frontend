import { http, HttpResponse } from "msw";
import {
  AHORA_TEST,
  carritoCreado,
  conHoraInicio,
  detalles,
  horarios,
  ID_FUNCION_COMENZADA,
  ID_HORARIOS_FALLAN,
  mapas,
  peliculas,
  sucursales,
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
  http.post("*/api/carritos/:carritoId/abandono", () => HttpResponse.json(carritoCreado.carrito)),
];
