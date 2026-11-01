import Link from "next/link";
import estilos from "./Pie.module.css";

export function Pie() {
  return (
    <footer className={estilos.pie}>
      <div className={`contenedor ${estilos.fila}`}>
        <p>RandomPlay. Del videoclub al cine.</p>
        <Link href="/" className={estilos.enlace}>
          Ver la cartelera de hoy
        </Link>
      </div>
    </footer>
  );
}
