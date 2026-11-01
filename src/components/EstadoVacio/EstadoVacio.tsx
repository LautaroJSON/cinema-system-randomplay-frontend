import Link from "next/link";
import estilos from "./EstadoVacio.module.css";

type Props = {
  titulo: string;
  nivel: "h1" | "h2" | "h3";
  mensaje: string;
  enlace?: { href: string; texto: string };
  children?: React.ReactNode;
};

export function EstadoVacio({ titulo, nivel: Nivel, mensaje, enlace, children }: Props) {
  return (
    <section className={`halftone sombra-dura ${estilos.vacio}`}>
      <Nivel className={Nivel === "h1" ? "display" : "h2"}>{titulo}</Nivel>
      <p className={estilos.mensaje}>{mensaje}</p>
      {(enlace || children) && (
        <div className={estilos.acciones}>
          {children}
          {enlace && (
            <Link href={enlace.href} className="boton-secundario">
              {enlace.texto}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
