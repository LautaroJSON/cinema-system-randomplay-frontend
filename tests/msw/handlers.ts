import { http, HttpResponse } from "msw";
import {
  AHORA_TEST,
  conHoraInicio,
  detalles,
  horarios,
  ID_HORARIOS_FALLAN,
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
];
