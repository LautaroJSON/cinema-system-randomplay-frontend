// Mock de la API del backend para el build, los e2e y la validación manual, sin dependencias.
// Datos: el catálogo generado en scripts/mock-data/catalogo.json si existe (temporal, ver
// scripts/generar-mock-catalogo.mjs); si no, o con MOCK_DATOS=fixtures, los fixtures de los tests.
import { randomUUID } from "node:crypto";
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

// Los carritos y los mapas conocidos salen de los fixtures. Para las funciones del catálogo
// generado, que no traen mapa, se arma uno de prueba (ver `mapaDePrueba`).
const leerFixture = (nombre) =>
  leerJson(new URL(`../tests/fixtures/${nombre}.json`, import.meta.url));
const mapas = leerFixture("mapas");
const carritoBase = leerFixture("carritos");
const ID_FUNCION_COMENZADA = "9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0f0";

// El mapa toma la hora del horario que lo enlaza, para que coincida con la ficha.
function horaDeFuncion(funcionId) {
  for (const lista of Object.values(horarios)) {
    const horario = conHoraInicio(lista).find((h) => h.funcionId === funcionId);
    if (horario) return horario.horaInicio;
  }
  return undefined;
}

// Formas de sala para los mapas armados: las mismas tres de los fixtures.
const FORMAS_DE_SALA = [
  [..."ABCDEFGH"].map((fila) => [fila, 12]),
  [
    ["A", 8],
    ["B", 10],
    ["C", 12],
    ["D", 12],
    ["E", 14],
    ["F", 14],
  ],
  [..."ABCDEFGHIJ"].map((fila) => [fila, 10]),
];

/** Número estable a partir del id, para que el mismo mapa salga igual en cada pedido. */
function semilla(texto) {
  let valor = 0;
  for (const caracter of texto) valor = (valor * 31 + caracter.charCodeAt(0)) >>> 0;
  return valor;
}

/** Mapa de prueba para una función del catálogo que no está en los fixtures. */
function mapaDePrueba(funcionId) {
  for (const [clave, lista] of Object.entries(horarios)) {
    const horario = lista.find((h) => h.funcionId === funcionId);
    if (!horario) continue;
    const [peliculaId, sucursalId] = clave.split("/");
    const sucursal = (sucursales[peliculaId] ?? []).find((s) => s.id === sucursalId);
    const base = semilla(funcionId);
    const forma = FORMAS_DE_SALA[base % FORMAS_DE_SALA.length];
    // Entre un 10 % y un 30 % de butacas ocupadas, repartidas de forma estable.
    const umbral = 10 + (base % 21);
    const filas = forma.map(([fila, cantidad]) => ({
      fila,
      cantidadAsientos: cantidad,
      asientosDisponibles: Array.from({ length: cantidad }, (_, i) => i + 1).filter(
        (numero) => semilla(`${funcionId}${fila}${numero}`) % 100 >= umbral,
      ),
    }));
    return {
      funcionId,
      horaInicio: conHoraInicio([horario])[0].horaInicio,
      peliculaId,
      peliculaTitulo: detalles[peliculaId]?.titulo ?? "Película",
      sucursalId,
      sucursalNombre: sucursal?.nombre ?? "Sucursal",
      salaId: horario.salaId,
      salaNombre: horario.salaNombre,
      totalAsientos: forma.reduce((total, [, cantidad]) => total + cantidad, 0),
      cantidadDisponibles: filas.reduce((total, f) => total + f.asientosDisponibles.length, 0),
      filas,
      precioEntrada: horario.precioEntrada,
    };
  }
  return undefined;
}

const buscarMapa = (funcionId) => mapas[funcionId] ?? mapaDePrueba(funcionId);

function multiplicarMonto(monto, cantidad) {
  const [entero, decimales] = monto.split(".");
  const centavos = (Number(entero) * 100 + Number(decimales)) * cantidad;
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

function crearCarrito(funcionId, cuerpo) {
  const mapa = buscarMapa(funcionId);
  if (!mapa)
    return [404, { ...problema(404, "Función no encontrada."), codigo: "funcion-no-encontrada" }];
  const asientos = Array.isArray(cuerpo?.asientos) ? cuerpo.asientos : [];
  const { carrito } = carritoBase;
  const precio = mapa.precioEntrada;
  return [
    201,
    {
      ...carritoBase,
      carrito: {
        ...carrito,
        id: randomUUID(),
        asientos,
        funcion: {
          funcionId,
          horaInicio: horaDeFuncion(funcionId) ?? mapa.horaInicio,
          peliculaId: mapa.peliculaId,
          peliculaTitulo: mapa.peliculaTitulo,
          sucursalId: mapa.sucursalId,
          sucursalNombre: mapa.sucursalNombre,
          salaId: mapa.salaId,
          salaNombre: mapa.salaNombre,
        },
        precioUnitario: precio,
        total: { monto: multiplicarMonto(precio.monto, asientos.length), moneda: precio.moneda },
      },
    },
  ];
}

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

  m = ruta.match(/^\/api\/funciones\/([^/]+)\/asientos$/);
  if (m) {
    if (m[1] === ID_FUNCION_COMENZADA) return [410, problema(410, "La función ya comenzó.")];
    const mapa = buscarMapa(m[1]);
    if (!mapa) return [404, problema(404, "Función no encontrada.")];
    return [200, { ...mapa, horaInicio: horaDeFuncion(m[1]) ?? mapa.horaInicio }];
  }

  return [404, problema(404, "Ruta inexistente.")];
}

function resolverPost(ruta, cuerpo) {
  if (fallarTodo) return [500, problema(500, "Error simulado.")];

  let m = ruta.match(/^\/api\/funciones\/([^/]+)\/carritos$/);
  if (m) return crearCarrito(m[1], cuerpo);

  m = ruta.match(/^\/api\/carritos\/([^/]+)\/abandono$/);
  if (m) return [200, { ...carritoBase.carrito, id: m[1], estado: "Abandonado" }];

  return [404, problema(404, "Ruta inexistente.")];
}

function leerCuerpo(req) {
  return new Promise((resolve) => {
    let datos = "";
    req.on("data", (parte) => (datos += parte));
    req.on("end", () => {
      try {
        resolve(datos ? JSON.parse(datos) : undefined);
      } catch {
        resolve(undefined);
      }
    });
  });
}

createServer(async (req, res) => {
  const ruta = new URL(req.url ?? "/", "http://localhost").pathname;
  // Solo se loguean método, ruta y status: nunca cuerpos ni headers (el token viaja en ellos).
  const [status, cuerpo] =
    req.method === "GET"
      ? resolver(ruta)
      : req.method === "POST"
        ? resolverPost(ruta, await leerCuerpo(req))
        : [405, problema(405, "Método no permitido.")];
  console.log(`${req.method} ${ruta} ${status}`);
  responder(res, status, cuerpo);
}).listen(puerto, "127.0.0.1", () => {
  const origen = usarFixtures ? "fixtures de los tests" : "scripts/mock-data/catalogo.json";
  console.log(
    `Mock de la API en http://127.0.0.1:${puerto} (${peliculas.length} películas, ${origen})`,
  );
});
