import Link from "next/link";
import estilos from "./Encabezado.module.css";

export function Encabezado() {
  return (
    <header className={estilos.encabezado}>
      <div className={`contenedor ${estilos.fila}`}>
        <div className={estilos.identidad}>
          <Link href="/" className={estilos.marca}>
            RandomPlay
          </Link>
          {/* El eslogan va en la tipografía de las etiquetas, como impreso en el lomo. */}
          <p className={`label ${estilos.eslogan}`}>Del videoclub al cine</p>
        </div>
      </div>
    </header>
  );
}
