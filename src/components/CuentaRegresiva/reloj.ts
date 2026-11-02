// Reloj compartido para `useSyncExternalStore`: la hora se lee acá y no durante el render.
// Cada tic vuelve a leer `Date.now()`, así un timer demorado (pestaña en segundo plano,
// dispositivo suspendido) se corrige solo en el tic siguiente (FR-015).

/** Cada cuánto se mira la hora: el error del contador queda por debajo de este valor. */
const INTERVALO_MS = 250;

let ahora = 0;
let temporizador: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

function tic() {
  ahora = Date.now();
  for (const oyente of oyentes) oyente();
}

function programar() {
  temporizador = setTimeout(() => {
    tic();
    programar();
  }, INTERVALO_MS);
}

function alVolver() {
  if (document.visibilityState !== "hidden") tic();
}

export function suscribirReloj(oyente: () => void): () => void {
  oyentes.add(oyente);
  if (oyentes.size === 1) {
    ahora = Date.now();
    programar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
  }
  // Una primera lectura enseguida, para no esperar al primer tic.
  const primera = setTimeout(() => {
    if (oyentes.has(oyente)) oyente();
  }, 0);
  return () => {
    clearTimeout(primera);
    oyentes.delete(oyente);
    if (oyentes.size > 0) return;
    clearTimeout(temporizador);
    document.removeEventListener("visibilitychange", alVolver);
    window.removeEventListener("focus", alVolver);
    ahora = 0;
  };
}

/** La última hora leída. Antes de la primera suscripción, la de ahora. */
export function leerReloj(): number {
  if (ahora === 0) ahora = Date.now();
  return ahora;
}
