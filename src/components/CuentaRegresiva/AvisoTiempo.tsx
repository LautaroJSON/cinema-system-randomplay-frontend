import type { Tramo } from "@/domain/cuenta-regresiva";

type Props = {
  tramo: Tramo | null;
  /** El carrito está activo en pantalla: solo así tiene sentido avisar que se acaba el tiempo. */
  activo: boolean;
  /** El contador llegó a cero mientras se miraba esta pantalla. */
  vencioAca: boolean;
};

const AVISO_FINAL = "Quedan 2 minutos o menos. Después, tus butacas se liberan.";
const AVISO_VENCIDO = "Se terminó el tiempo. Liberamos tus butacas.";

/**
 * Región de cortesía con dos avisos puntuales, nunca uno por segundo (FR-017). Está montada
 * desde el principio para que el lector de pantalla anuncie el texto cuando aparece.
 */
export function AvisoTiempo({ tramo, activo, vencioAca }: Props) {
  const texto = vencioAca ? AVISO_VENCIDO : activo && tramo === "final" ? AVISO_FINAL : "";
  return (
    <p role="status" aria-label="Avisos sobre el tiempo" className="visualmente-oculto">
      {texto}
    </p>
  );
}
