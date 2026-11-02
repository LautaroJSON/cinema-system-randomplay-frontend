import type { ReactNode } from "react";
import estilos from "./AvisoOperacion.module.css";

type Props = {
  /** Qué pasó y qué hacer (DESIGN.md §10). */
  children: ReactNode;
  /** Falló por falta de conexión: lleva la cinta de peligro (DESIGN.md §6.5). */
  sinConexion?: boolean;
  onReintentar?: () => void;
};

/** Error de una operación del carrito, con la acción para reintentar cuando tiene sentido. */
export function AvisoOperacion({ children, sinConexion = false, onReintentar }: Props) {
  return (
    <div role="alert" className={estilos.aviso}>
      {sinConexion && <span aria-hidden="true" className={`cinta-peligro ${estilos.cinta}`} />}
      <div className={estilos.texto}>{children}</div>
      {onReintentar && (
        <button type="button" className="boton-secundario" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
