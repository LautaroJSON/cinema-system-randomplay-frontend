"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TiraHorarios } from "@/components/TiraHorarios/TiraHorarios";
import { filtrarVigentes, type HorariosPorSucursal } from "@/domain/horarios";
import estilos from "./HorariosVigentes.module.css";

const TRAMO_MS = 30_000;
const ESPERA_REFRESCO_MS = 2_000;
const PLAZO_REFRESCO_MS = 8_000;

// Reloj en tramos de 30 s: la vista se recalcula una vez por tramo, no en cada render.
function suscribirReloj(avisar: () => void) {
  const intervalo = setInterval(avisar, TRAMO_MS);
  return () => clearInterval(intervalo);
}
const tramoActual = () => Math.floor(Date.now() / TRAMO_MS) * TRAMO_MS;
// En el servidor y en la hidratación no hay reloj: se muestra la lista completa del HTML.
const sinReloj = () => null;

/**
 * Oculta los horarios que ya comenzaron cuando la página llega desde una caché vieja (FR-034).
 * Si no queda ninguno, vuelve a pedir la página una sola vez: la visita ya disparó la
 * regeneración en el servidor y la versión nueva suele estar lista en un par de segundos.
 */
export function HorariosVigentes({ grupos }: { grupos: HorariosPorSucursal[] }) {
  const router = useRouter();
  const ahora = useSyncExternalStore(suscribirReloj, tramoActual, sinReloj);
  // Los grupos que había cuando se pidió el refresco; null mientras no se pidió.
  const [gruposAlRefrescar, setGruposAlRefrescar] = useState<HorariosPorSucursal[] | null>(null);
  const [plazoVencido, setPlazoVencido] = useState(false);

  const visibles = ahora === null ? grupos : filtrarVigentes(grupos, new Date(ahora));
  const vencieronTodos = visibles.length === 0;
  const refrescoPedido = gruposAlRefrescar !== null;
  const llegaronDatosNuevos = refrescoPedido && grupos !== gruposAlRefrescar;
  const sinFunciones = vencieronTodos && (llegaronDatosNuevos || plazoVencido);

  useEffect(() => {
    if (!vencieronTodos || refrescoPedido) return;
    const espera = setTimeout(() => {
      setGruposAlRefrescar(grupos);
      router.refresh();
    }, ESPERA_REFRESCO_MS);
    return () => clearTimeout(espera);
  }, [vencieronTodos, refrescoPedido, grupos, router]);

  // Si el refresco no trae datos nuevos, no se queda "actualizando" para siempre.
  useEffect(() => {
    if (!refrescoPedido) return;
    const plazo = setTimeout(() => setPlazoVencido(true), PLAZO_REFRESCO_MS);
    return () => clearTimeout(plazo);
  }, [refrescoPedido]);

  const aviso = sinFunciones
    ? "Hoy no hay más funciones de esta película."
    : vencieronTodos
      ? "Actualizando horarios…"
      : "";

  return (
    <>
      {!vencieronTodos && <TiraHorarios grupos={visibles} />}
      <p role="status" className={aviso ? estilos.aviso : "visualmente-oculto"}>
        {aviso}
      </p>
    </>
  );
}
