"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { iniciarPago } from "@/api/carritos";
import type { Problema } from "@/api/problema";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import { destinoPago } from "@/domain/pago";
import { actualizarCarrito } from "@/domain/sesion-carrito";
import { irAUrlExterna } from "./navegacion";

export type ResultadoIrAPago =
  /** Ya se está saliendo hacia la página de pago. */
  | { tipo: "navegando" }
  /** Había otro pedido en curso, o no hay credencial: no se hizo nada. */
  | { tipo: "ignorado" }
  /** La API devolvió una dirección que no se sigue (FR-010). */
  | { tipo: "destinoInvalido" }
  | { tipo: "problema"; problema: Problema };

type Credencial = { carritoId: string; token: string } | null;

/**
 * Inicia el pago (o lo retoma en `Pagando`, la API es idempotente) y lleva al comprador a la
 * página de pago. Lo comparten el carrito y la página de vuelta (FR-027).
 */
export function useIrAPago(credencial: Credencial, pagoSimulado: boolean) {
  const router = useRouter();
  const enCurso = useRef(false);
  const [iniciando, setIniciando] = useState(false);
  const carritoId = credencial?.carritoId ?? null;
  const token = credencial?.token ?? null;

  const irAPago = useCallback(async (): Promise<ResultadoIrAPago> => {
    if (carritoId === null || token === null || enCurso.current) return { tipo: "ignorado" };
    enCurso.current = true;
    setIniciando(true);
    let navegando = false;
    try {
      const resultado = await iniciarPago(carritoId, token);
      if (!resultado.ok) return { tipo: "problema", problema: resultado.problema };
      // El contador pasa enseguida al vencimiento nuevo, por si el comprador vuelve (FR-007).
      actualizarCarrito(
        resultado.datos.carrito,
        medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs),
      );
      const destino = destinoPago(resultado.datos.urlPago, carritoId, pagoSimulado);
      if (destino.tipo === "invalido") return { tipo: "destinoInvalido" };
      navegando = true;
      if (destino.tipo === "externo") irAUrlExterna(destino.url);
      else router.push(destino.ruta);
      return { tipo: "navegando" };
    } finally {
      enCurso.current = false;
      // Mientras se sale de la página, el botón sigue diciendo que se está abriendo el pago.
      if (!navegando) setIniciando(false);
    }
  }, [carritoId, token, pagoSimulado, router]);

  return { irAPago, iniciando };
}
