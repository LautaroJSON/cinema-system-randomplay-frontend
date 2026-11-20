import estilos from "./BarraCarga.module.css";

/** Barra de carga sin fin y decorativa: el texto que la acompaña dice qué se carga. */
export function BarraCarga() {
  return (
    <div className={estilos.barra} aria-hidden="true">
      <span className={estilos.tramo} />
    </div>
  );
}
