"use client";

import { useRouter } from "next/navigation";
import type { MapaFuncion } from "@/api/asientos";
import { abandonarCarrito, crearCarrito } from "@/api/carritos";
import type { Asiento } from "@/domain/butacas";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import {
  almacenamientoDisponible,
  descartarSesion,
  guardarSesion,
  leerSesion,
} from "@/domain/sesion-carrito";
import { SelectorComun, type ResultadoConfirmacion } from "./SelectorComun";

function textoBoton(cantidad: number): string {
  if (cantidad === 0) return "Confirmar butacas";
  return cantidad === 1 ? "Confirmar 1 butaca" : `Confirmar ${cantidad} butacas`;
}

/** Elegir butacas de una función y retenerlas en un carrito nuevo (spec 003). */
export function SelectorButacas({ mapa }: { mapa: MapaFuncion }) {
  const router = useRouter();

  async function confirmar(seleccion: Asiento[]): Promise<ResultadoConfirmacion> {
    if (!almacenamientoDisponible()) return { tipo: "sinAlmacenamiento" };

    // Un carrito nuevo libera el anterior de esta pestaña; si falla, vence solo (FR-032).
    // Una sesión cerrada (sin token) ya no retiene nada: se descarta sin pedir.
    const anterior = leerSesion();
    if (anterior?.token) await abandonarCarrito(anterior.carritoId, anterior.token, 3000);
    if (anterior) descartarSesion();

    const resultado = await crearCarrito(mapa.funcionId, seleccion);
    if (!resultado.ok) return { tipo: "problema", problema: resultado.problema };

    const { token, tokenVenceEn, carrito } = resultado.datos;
    const desfaseMs = medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs);
    if (
      !guardarSesion({ version: 2, carritoId: carrito.id, token, tokenVenceEn, carrito, desfaseMs })
    ) {
      // Sin dónde guardar la credencial el carrito queda inaccesible: se libera enseguida.
      await abandonarCarrito(carrito.id, token, 3000);
      return { tipo: "sinAlmacenamiento" };
    }
    router.push(`/carritos/${carrito.id}`);
    return { tipo: "hecho" };
  }

  return (
    <SelectorComun
      mapa={mapa}
      textoBoton={textoBoton}
      textoEnviando="Reservando butacas…"
      textoError="No pudimos reservar las butacas. Revisá tu conexión y probá de nuevo."
      confirmar={confirmar}
    />
  );
}
