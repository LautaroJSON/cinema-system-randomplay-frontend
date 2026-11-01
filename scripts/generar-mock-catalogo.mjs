// TEMPORAL: genera un catálogo de prueba más completo para el mock de la API. Se elimina junto
// con scripts/mock-data/ cuando el backend tenga datos reales.
//
// Uso: node scripts/generar-mock-catalogo.mjs
//
// Fuentes:
// - Las 4 películas demo que siembra el backend en Development (DevDataSeeder.cs, commit 14be06b
//   de cinema-system-randomplay-backend), con sus pósters de Wikipedia y sus funciones de hoy.
// - La Studio Ghibli API (pública, sin clave). No trae clasificación por edad, sucursales ni
//   horarios: esos datos se generan acá de forma determinística para que el mock sea estable.
// Sucursales y salas son las que siembra el backend, con los mismos ids.
import { mkdir, writeFile } from "node:fs/promises";

const ORIGEN_GHIBLI = "https://ghibliapi.vercel.app/films";
const DESTINO = new URL("./mock-data/catalogo.json", import.meta.url);

const SUCURSALES = [
  {
    id: "11111111-0000-0000-0000-000000000001",
    nombre: "Sucursal Centro",
    salas: [
      { id: "22222222-0000-0000-0000-000000000001", nombre: "Sala 1" },
      { id: "22222222-0000-0000-0000-000000000002", nombre: "Sala 2" },
    ],
  },
  {
    id: "11111111-0000-0000-0000-000000000002",
    nombre: "Sucursal Norte",
    salas: [{ id: "22222222-0000-0000-0000-000000000003", nombre: "Sala 1" }],
  },
  {
    id: "11111111-0000-0000-0000-000000000003",
    nombre: "Sucursal Sur",
    salas: [{ id: "22222222-0000-0000-0000-000000000004", nombre: "Sala 1" }],
  },
];
const [CENTRO, NORTE] = SUCURSALES;

// Copiadas de DevDataSeeder.cs sin el sufijo "(demo)": en el mock todo es de prueba.
// Cada función es [sucursal, índice de sala, minutos desde ahora, precio].
const DEMOS_BACKEND = [
  {
    id: "88888888-0000-0000-0000-000000000001",
    titulo: "Interstellar",
    duracionMinutos: 169,
    clasificacion: "ATP",
    sinopsis:
      "En un futuro en el que la Tierra se vuelve inhabitable, un grupo de astronautas viaja a través de un agujero de gusano en busca de un nuevo hogar para la humanidad.",
    imagenUrl: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg",
    funciones: [
      [CENTRO, 0, 120, "5500.00"],
      [CENTRO, 1, 240, "7250.50"],
      [NORTE, 0, 60, "6000.00"],
    ],
  },
  {
    id: "88888888-0000-0000-0000-000000000002",
    titulo: "Dune",
    duracionMinutos: 155,
    clasificacion: "Mas13",
    sinopsis:
      "Paul Atreides, heredero de una familia noble, llega con los suyos a Arrakis, el planeta desértico del que depende la sustancia más valiosa del universo.",
    imagenUrl: "https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg",
    funciones: [
      [CENTRO, 0, 300, "6500.00"],
      [NORTE, 0, 240, "6000.00"],
    ],
  },
  {
    id: "88888888-0000-0000-0000-000000000003",
    titulo: "Relatos salvajes",
    duracionMinutos: 122,
    clasificacion: "Mas16",
    sinopsis:
      "Seis historias independientes de personas comunes que, empujadas al límite, pierden el control y se dejan llevar por el placer de la venganza.",
    imagenUrl: "https://upload.wikimedia.org/wikipedia/en/5/5e/Relatos_salvajes.jpg",
    funciones: [[CENTRO, 1, 60, "5000.00"]],
  },
  {
    // Sin funciones a propósito, como en el backend: muestra la marca "Sin funciones hoy".
    id: "88888888-0000-0000-0000-000000000004",
    titulo: "El secreto de sus ojos",
    duracionMinutos: 129,
    clasificacion: "Mas16",
    sinopsis:
      "Un empleado judicial retirado decide escribir una novela sobre un crimen que investigó veinticinco años atrás y que todavía no puede olvidar.",
    imagenUrl:
      "https://upload.wikimedia.org/wikipedia/en/9/91/Cartel-nuevo-de-el-secreto-de-sus-ojos.jpg",
    funciones: [],
  },
];

const CLASIFICACIONES = ["ATP", "Mas13", "ATP", "Mas16", "Mas13", "ATP", "Mas18"];
const PRECIOS = ["4500.00", "4800.00", "5200.50"];

// GUID determinístico a partir de un texto, para que las funciones no cambien entre corridas.
function guid(semilla) {
  const hex = [];
  // Cuatro pasadas FNV-1a sobre la semilla completa, con una sal distinta en cada una.
  for (let pasada = 0; pasada < 4; pasada++) {
    let h = (0x811c9dc5 ^ pasada) >>> 0;
    for (const caracter of `${pasada}:${semilla}`) {
      h ^= caracter.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex.push(h.toString(16).padStart(8, "0"));
  }
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

const peliculas = [];
const detalles = {};
const sucursales = {};
const horarios = {};

function agregarPelicula({ sinopsis, ...base }) {
  peliculas.push(base);
  detalles[base.id] = { ...base, sinopsis };
}

const funcion = (peliculaId, sucursal, sala, n, offsetMinutos, monto) => ({
  funcionId: guid(`${peliculaId}/${sucursal.id}/${n}`),
  offsetMinutos,
  salaId: sala.id,
  salaNombre: sala.nombre,
  precioEntrada: { monto, moneda: "ARS" },
});

// Primero las demo del backend: son las que tienen sinopsis en español.
for (const { funciones, ...demo } of DEMOS_BACKEND) {
  agregarPelicula({ ...demo, sinFuncionesDisponibles: funciones.length === 0 });
  const enCartel = SUCURSALES.filter((s) => funciones.some(([sucursal]) => sucursal === s));
  sucursales[demo.id] = enCartel.map(({ id, nombre }) => ({ id, nombre }));
  for (const sucursal of enCartel) {
    horarios[`${demo.id}/${sucursal.id}`] = funciones
      .filter(([s]) => s === sucursal)
      .map(([, sala, offset, monto], n) =>
        funcion(demo.id, sucursal, sucursal.salas[sala], n, offset, monto),
      );
  }
}

const respuesta = await fetch(ORIGEN_GHIBLI, { signal: AbortSignal.timeout(15_000) });
if (!respuesta.ok) throw new Error(`La Studio Ghibli API respondió ${respuesta.status}.`);
const films = await respuesta.json();

films.forEach((film, i) => {
  // Una de cada seis películas queda sin funciones hoy, para ver ese estado en la cartelera.
  const sinFunciones = i % 6 === 5;
  agregarPelicula({
    id: film.id,
    titulo: film.title,
    duracionMinutos: film.running_time,
    clasificacion: CLASIFICACIONES[i % CLASIFICACIONES.length],
    imagenUrl: film.image ?? null,
    sinFuncionesDisponibles: sinFunciones,
    sinopsis: film.description,
  });

  if (sinFunciones) {
    sucursales[film.id] = [];
    return;
  }

  // Entre una y tres sucursales por película, con dos a cuatro funciones en cada una.
  const enCartel = SUCURSALES.filter((_, s) => (i + s) % 3 !== 2 || s === 0);
  sucursales[film.id] = enCartel.map(({ id, nombre }) => ({ id, nombre }));
  for (const [s, sucursal] of enCartel.entries()) {
    const cantidad = 2 + ((i + s) % 3);
    horarios[`${film.id}/${sucursal.id}`] = Array.from({ length: cantidad }, (_, f) =>
      funcion(
        film.id,
        sucursal,
        sucursal.salas[(i + f) % sucursal.salas.length],
        f,
        45 + f * 150 + ((i * 17 + s * 29) % 90),
        PRECIOS[(i + s + f) % PRECIOS.length],
      ),
    );
  }
});

await mkdir(new URL("./mock-data/", import.meta.url), { recursive: true });
const origen = ["DevDataSeeder.cs (backend, commit 14be06b)", ORIGEN_GHIBLI];
await writeFile(
  DESTINO,
  `${JSON.stringify({ origen, generado: new Date().toISOString(), peliculas, detalles, sucursales, horarios }, null, 2)}\n`,
);
console.log(
  `${peliculas.length} películas guardadas en scripts/mock-data/catalogo.json ` +
    `(${DEMOS_BACKEND.length} del backend, ${films.length} de Studio Ghibli)`,
);
