import estilos from "./EtiquetaPegada.module.css";

type Props = {
  children: React.ReactNode;
  /** Grados de inclinación del papel pegado, entre -1.5 y 1.5. */
  inclinacion?: number;
  /** Descripción completa para lectores de pantalla (por ejemplo, "Solo mayores de 13 años"). */
  titulo?: string;
  tono?: "papel" | "alerta";
};

export function EtiquetaPegada({ children, inclinacion = 0, titulo, tono = "papel" }: Props) {
  const grados = Math.max(-1.5, Math.min(1.5, inclinacion));
  return (
    <span
      className={`label ${estilos.etiqueta} ${tono === "alerta" ? estilos.alerta : ""}`}
      style={{ rotate: `${grados}deg` }}
      title={titulo}
    >
      {titulo ? (
        <>
          <span aria-hidden="true">{children}</span>
          <span className="visualmente-oculto">{titulo}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}
