"use client";

import { useId } from "react";
import type { Dinero } from "@/domain/formato";
import { formatearPrecio } from "@/domain/formato";
import { AvisoOperacion } from "./AvisoOperacion";
import estilos from "./SeccionPago.module.css";

/** Lo que se le explica al comprador cuando el pago no arrancó (FR-031). */
export type AvisoPago =
  | { tipo: "faltaEmail" }
  | { tipo: "reservaCambio" }
  | { tipo: "noDisponible" }
  | { tipo: "destinoInvalido" }
  | { tipo: "fallo"; sinConexion: boolean };

type Props = {
  /** `pagar` con el carrito activo; `volver` con el pago en curso (FR-027). */
  modo: "pagar" | "volver";
  total: Dinero;
  /** Es la acción principal de la vista; si no, va con contorno (un solo botón rojo). */
  principal: boolean;
  iniciando: boolean;
  aviso: AvisoPago | null;
  onPagar: () => void;
};

/**
 * Sección "Pago". El pago ocurre en la página de Mercado Pago: el sitio nunca pide datos de
 * tarjeta (FR-034). Mientras se edita el email, "Pagar" no es la acción principal: el rojo queda para
 * "Guardar email" (DESIGN.md §4, un solo botón rojo por vista).
 */
export function SeccionPago({ modo, total, principal, iniciando, aviso, onPagar }: Props) {
  const idTitulo = useId();
  const idAvisoEmail = useId();
  const texto =
    modo === "pagar"
      ? iniciando
        ? "Iniciando el pago…"
        : `Pagar ${formatearPrecio(total)}`
      : iniciando
        ? "Abriendo la página de pago…"
        : "Volver a la página de pago";

  return (
    <section aria-labelledby={idTitulo} className={estilos.seccion}>
      <h2 id={idTitulo} className="h3">
        Pago
      </h2>
      <p className={estilos.texto}>
        {modo === "pagar"
          ? "Pagás en la página de Mercado Pago. Acá no se cargan datos de tarjeta."
          : "Si cerraste la página de pago o te rechazaron la tarjeta, podés volver a intentarlo mientras corre el contador."}
      </p>

      {aviso?.tipo === "faltaEmail" && (
        <p id={idAvisoEmail} role="status" className={estilos.faltaEmail}>
          Primero guardá el email para recibir las entradas.
        </p>
      )}
      {aviso && aviso.tipo !== "faltaEmail" && (
        <AvisoInicioPago aviso={aviso} onReintentar={onPagar} />
      )}

      <button
        type="button"
        className={principal ? "boton-primario" : "boton-secundario"}
        disabled={iniciando}
        aria-describedby={aviso?.tipo === "faltaEmail" ? idAvisoEmail : undefined}
        onClick={onPagar}
      >
        {texto}
      </button>
    </section>
  );
}

/** Por qué no arrancó el pago y qué hacer; lo usan el carrito y la página de vuelta. */
export function AvisoInicioPago({
  aviso,
  onReintentar,
}: {
  aviso: Exclude<AvisoPago, { tipo: "faltaEmail" }>;
  onReintentar: () => void;
}) {
  switch (aviso.tipo) {
    case "reservaCambio":
      return (
        <AvisoOperacion>
          <p>Tu reserva cambió mientras iniciábamos el pago.</p>
          <p>Revisala y tocá Pagar de nuevo.</p>
        </AvisoOperacion>
      );
    case "noDisponible":
      return (
        <AvisoOperacion onReintentar={onReintentar}>
          <p>No pudimos iniciar el pago, probá de nuevo.</p>
          <p>Tus butacas siguen reservadas.</p>
        </AvisoOperacion>
      );
    case "destinoInvalido":
      return (
        <AvisoOperacion onReintentar={onReintentar}>
          <p>No pudimos abrir la página de pago. Probá de nuevo.</p>
        </AvisoOperacion>
      );
    case "fallo":
      return (
        <AvisoOperacion sinConexion={aviso.sinConexion} onReintentar={onReintentar}>
          <p>No pudimos iniciar el pago.</p>
          <p>
            {aviso.sinConexion
              ? "Parece que no hay conexión. Revisala y probá de nuevo."
              : "Probá de nuevo en un momento."}
          </p>
        </AvisoOperacion>
      );
    default: {
      const exhaustivo: never = aviso;
      return exhaustivo;
    }
  }
}
