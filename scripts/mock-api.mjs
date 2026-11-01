// Mock de la API del backend para el build, los e2e y la validación manual, sin dependencias.
// Datos: el catálogo generado en scripts/mock-data/catalogo.json si existe (temporal, ver
// scripts/generar-mock-catalogo.mjs); si no, o con MOCK_DATOS=fixtures, los fixtures de los tests.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";

const leerJson = (url) => JSON.parse(readFileSync(url, "utf8"));
const catalogoGenerado = new URL("./mock-data/catalogo.json", import.meta.url);
const usarFixtures = process.env.MOCK_DATOS === "fixtures" || !existsSync(catalogoGenerado);

function cargarDatos() {
  if (usarFixtures) {
    const leer = (nombre) => leerJson(new URL(`../tests/fixtures/${nombre}.json`, import.meta.url));
    return {
      peliculas: leer("peliculas"),
      detalles: leer("detalles"),
      sucursales: leer("sucursales"),
      horarios: leer("horarios"),
    };
  }
  return leerJson(catalogoGenerado);
}

const { peliculas, detalles, sucursales, horarios } = cargarDatos();

const ID_HORARIOS_FALLAN = "3f2b6c1e-8a4d-4e2f-9b1a-0c5d7e8f9a05";
const puerto = Number(process.env.MOCK_PORT ?? 4010);
const fallarTodo = process.env.MOCK_FALLAR === "todo";

function isoArgentina(fecha) {
  const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

function conHoraInicio(lista) {
  const ahora = Date.now();
  return lista.map(({ offsetMinutos, ...resto }) => {
    const inicio = new Date(ahora + offsetMinutos * 60_000);
    inicio.setSeconds(0, 0);
    return { ...resto, horaInicio: isoArgentina(inicio) };
  });
}

function responder(res, status, cuerpo) {
  const problema = status >= 400;
  res.writeHead(status, {
    "Content-Type": problema ? "application/problem+json" : "application/json",
  });
  res.end(JSON.stringify(cuerpo));
}

const problema = (status, title) => ({
  type: `https://httpstatuses.io/${status}`,
  title,
  status,
});

function resolver(ruta) {
  if (fallarTodo) return [500, problema(500, "Error simulado.")];

  if (ruta === "/api/catalogo/peliculas") return [200, peliculas];

  let m = ruta.match(/^\/api\/catalogo\/peliculas\/([^/]+)$/);
  if (m) {
    const detalle = detalles[m[1]];
    return detalle ? [200, detalle] : [404, problema(404, "Película no encontrada.")];
  }

  m = ruta.match(/^\/api\/funciones\/peliculas\/([^/]+)\/sucursales-hoy$/);
  if (m) {
    const lista = sucursales[m[1]];
    return lista ? [200, lista] : [404, problema(404, "Película no encontrada.")];
  }

  m = ruta.match(/^\/api\/funciones\/peliculas\/([^/]+)\/sucursales\/([^/]+)\/horarios-hoy$/);
  if (m) {
    if (m[1] === ID_HORARIOS_FALLAN) return [500, problema(500, "Error simulado.")];
    const lista = horarios[`${m[1]}/${m[2]}`];
    return lista ? [200, conHoraInicio(lista)] : [404, problema(404, "Sin horarios.")];
  }

  return [404, problema(404, "Ruta inexistente.")];
}

createServer((req, res) => {
  const ruta = new URL(req.url ?? "/", "http://localhost").pathname;
  const [status, cuerpo] =
    req.method === "GET" ? resolver(ruta) : [405, problema(405, "Método no permitido.")];
  console.log(`${req.method} ${ruta} ${status}`);
  responder(res, status, cuerpo);
}).listen(puerto, "127.0.0.1", () => {
  const origen = usarFixtures ? "fixtures de los tests" : "scripts/mock-data/catalogo.json";
  console.log(
    `Mock de la API en http://127.0.0.1:${puerto} (${peliculas.length} películas, ${origen})`,
  );
});
