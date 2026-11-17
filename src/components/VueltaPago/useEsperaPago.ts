"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerCarrito } from "@/api/carritos";
import { INTERVALO_CONSULTA_PAGO_MS } from "@/config/experiencia";
import { cierraSesion, credencialPerdida } from "@/domain/carrito";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import { siguientePaso } from "@/domain/pago";
import { actualizarCarrito, cerrarSesion } from "@/domain/sesion-carrito";

type Opciones = {
  carritoId: string;
  /** Sin credencial (o con el carrito fuera de `Pagando`) no se consulta nada. */
  token: string | null;
  alPerderCredencial: () => void;
};

/**
 * Espera la confirmación del pago (research P8): consulta el carrito al montar y, mientras siga
 * en `Pagando`, otra vez 2 s después de cada respuesta, nunca dos a la vez. Cada respuesta se
 * guarda en la sesión, y la pantalla se deriva de ahí. Se detiene en el tope de espera o cuando
 * el carrito deja de estar en pago (la credencial se suelta y `token` pasa a `null`).
 */
export function useEsperaPago({ carritoId, token, alPerderCredencial }: Opciones) {
  const [agotada, setAgotada] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const perder = useRef(alPerderCredencial);
  useEffect(() => {
    perder.current = alPerderCredencial;
  });

  useEffect(() => {
    if (token === null) return;
    const credencial = token;
    let cancelada = false;
    let siguiente: ReturnType<typeof setTimeout> | undefined;
    /** Le tocaba consultar con la pestaña oculta: se consulta al volver. */
    let postergada = false;
    const inicio = Date.now();

    async function consultar() {
      if (cancelada) return;
      if (document.hidden) {
        postergada = true;
        return;
      }
      const resultado = await obtenerCarrito(carritoId, credencial);
      if (cancelada) return;
      // Un error de red o inesperado no corta la espera: cuenta como un ciclo más (FR-023).
      let estado = "Pagando";
      if (resultado.ok) {
        const carrito = resultado.datos;
        actualizarCarrito(carrito, medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs));
        if (cierraSesion(carrito)) cerrarSesion(carrito);
        estado = carrito.estado;
      } else if (credencialPerdida(resultado.problema)) {
        perder.current();
        return;
      }
      const paso = siguientePaso(estado, Date.now() - inicio);
      if (paso === "consultar")
        siguiente = setTimeout(() => void consultar(), INTERVALO_CONSULTA_PAGO_MS);
      else if (paso === "detener") setAgotada(true);
    }

    function alCambiarVisibilidad() {
      if (document.hidden || !postergada || cancelada) return;
      postergada = false;
      void consultar();
    }

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    void consultar();
    return () => {
      cancelada = true;
      clearTimeout(siguiente);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [carritoId, token, vuelta]);

  /** "Revisar de nuevo": consulta ya y empieza otra espera con su tope. */
  const reiniciar = useCallback(() => {
    setAgotada(false);
    setVuelta((n) => n + 1);
  }, []);

  return { agotada, reiniciar };
}
