import Image from "next/image";
import { esHostOptimizable } from "@/config/imagenes";
import type { Clasificacion } from "@/domain/clasificacion";
import { formatearDuracion } from "@/domain/formato";
import estilos from "./Caratula.module.css";

type Variante = "estante" | "destacada" | "ficha";

type Props = {
  titulo: string;
  imagenUrl: string | null;
  codigoCinta: string;
  duracionMinutos: number | null;
  clasificacion: Clasificacion;
  variante?: Variante;
  /** Pedir el póster primero (LCP). Por defecto, la destacada y la ficha. */
  prioridad?: boolean;
  /** El encabezado con el título: siempre texto, aunque haya póster (spec 002, FR-006). */
  children: React.ReactNode;
};

type DatosCodigo = Pick<Props, "codigoCinta" | "duracionMinutos" | "clasificacion">;

/** Código de cinta impreso: "RP-9A01 · 118 MIN · +13". Decorativo; el dato real está en el texto. */
export function codigoImpreso({ codigoCinta, duracionMinutos, clasificacion }: DatosCodigo) {
  return [
    codigoCinta,
    duracionMinutos ? formatearDuracion(duracionMinutos).toUpperCase() : null,
    clasificacion.etiqueta,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Ancho real del póster en cada variante, para que el navegador pida el tamaño justo.
const TAMANIOS: Record<Variante, string> = {
  estante: "(min-width: 1024px) 260px, (min-width: 600px) 30vw, 45vw",
  destacada: "(min-width: 600px) 280px, 38vw",
  ficha: "(min-width: 600px) 280px, 38vw",
};

/**
 * Carátula de la cinta: el póster cuando la película lo tiene; si no, la carátula tipográfica
 * sobre trama halftone (DESIGN.md §9).
 */
export function Caratula({
  variante = "estante",
  prioridad,
  titulo,
  imagenUrl,
  children,
  ...datos
}: Props) {
  // La destacada y la ficha muestran el póster principal de la página: se pide primero (LCP).
  const principal = prioridad ?? variante !== "estante";
  const tipo = imagenUrl ? estilos.conPoster : `halftone ${estilos.tipografica}`;

  return (
    <div className={`${estilos.caratula} ${estilos[variante]} ${tipo}`}>
      {imagenUrl && (
        <div className={`halftone ${estilos.poster}`}>
          <Image
            src={imagenUrl}
            alt={`Póster de ${titulo}`}
            fill
            sizes={TAMANIOS[variante]}
            className={estilos.imagen}
            loading={principal ? "eager" : "lazy"}
            fetchPriority={principal ? "high" : "auto"}
            unoptimized={!esHostOptimizable(imagenUrl)}
          />
        </div>
      )}
      <div className={estilos.texto}>
        <p className={`label ${estilos.codigo}`} aria-hidden="true">
          {codigoImpreso(datos)}
        </p>
        {children}
      </div>
    </div>
  );
}
