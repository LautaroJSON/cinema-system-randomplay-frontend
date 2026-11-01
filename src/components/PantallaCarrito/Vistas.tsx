import Link from "next/link";
import type { Ref } from "react";
import type { Carrito } from "@/api/carritos";
import { etiquetaLectura, type MotivoLectura } from "@/domain/carrito";
import { AvisoOperacion } from "./AvisoOperacion";
import { ResumenCarrito } from "./ResumenCarrito";
import estilos from "./PantallaCarrito.module.css";

// Vistas sin acciones sobre el carrito, compartidas por el carrito y el cambio de butacas.

type ConTitulo = { tituloRef?: Ref<HTMLHeadingElement> };

/** Horarios de hoy de la película, o la cartelera si no se la conoce. */
export function EnlaceEmpezarDeNuevo({ peliculaId }: { peliculaId: string | null }) {
  return peliculaId ? (
    <Link href={`/peliculas/${peliculaId}#titulo-horarios`} className="boton-secundario">
      Elegir otra función
    </Link>
  ) : (
    <Link href="/" className="boton-secundario">
      Ver la cartelera
    </Link>
  );
}

export function VistaSinSesion({ tituloRef }: ConTitulo) {
  return (
    <div className={estilos.vista}>
      <h1 ref={tituloRef} tabIndex={-1} className="h2">
        No hay un carrito activo en esta pestaña
      </h1>
      <p className={estilos.texto}>
        El carrito se guarda solo en la pestaña donde elegiste las butacas. Si la cerraste o abriste
        este enlace en otra, elegí la función de nuevo.
      </p>
      <EnlaceEmpezarDeNuevo peliculaId={null} />
    </div>
  );
}

export function VistaPerdido({ tituloRef, peliculaId }: ConTitulo & { peliculaId: string | null }) {
  return (
    <div className={estilos.vista}>
      <h1 ref={tituloRef} tabIndex={-1} className="h2">
        No pudimos recuperar tu carrito
      </h1>
      <p className={estilos.texto}>
        La reserva ya no está disponible desde esta pestaña. Para ir a la función, elegí las butacas
        de nuevo.
      </p>
      <EnlaceEmpezarDeNuevo peliculaId={peliculaId} />
    </div>
  );
}

const LECTURA: Record<MotivoLectura, { titulo: string; texto: string }> = {
  abandonado: {
    titulo: "Abandonaste el carrito",
    texto: "Liberamos tus butacas. Si querés ir a la función, elegilas de nuevo.",
  },
  vencido: {
    titulo: "Se terminó el tiempo",
    texto:
      "Pasaron los minutos de reserva y tus butacas quedaron libres. Si querés ir a la función, elegilas de nuevo.",
  },
  noActivo: {
    titulo: "Este carrito ya no está activo",
    texto: "Ya no se puede modificar. Si querés ir a la función, elegí las butacas de nuevo.",
  },
};

export function VistaLectura({
  tituloRef,
  motivo,
  carrito,
  aviso = null,
}: ConTitulo & { motivo: MotivoLectura; carrito: Carrito; aviso?: string | null }) {
  const { titulo, texto } = LECTURA[motivo];
  return (
    <div className={estilos.vista}>
      {motivo === "vencido" && <span aria-hidden="true" className="cinta-peligro" />}
      <h1 ref={tituloRef} tabIndex={-1} className="h2">
        {titulo}
      </h1>
      {aviso && (
        <AvisoOperacion>
          <p>{aviso}</p>
        </AvisoOperacion>
      )}
      <p className={estilos.texto}>{texto}</p>
      <ResumenCarrito carrito={carrito} estado={etiquetaLectura(motivo, carrito)} />
      <EnlaceEmpezarDeNuevo peliculaId={carrito.funcion.peliculaId} />
    </div>
  );
}
