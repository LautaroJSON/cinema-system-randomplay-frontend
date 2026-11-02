"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { obtenerMapaDesdeNavegador, type MapaFuncion } from "@/api/asientos";
import { reemplazarAsientos } from "@/api/carritos";
import type { Problema } from "@/api/problema";
import { CabeceraFuncion } from "@/components/CabeceraFuncion/CabeceraFuncion";
import { AvisoTiempo } from "@/components/CuentaRegresiva/AvisoTiempo";
import { CuentaRegresiva } from "@/components/CuentaRegresiva/CuentaRegresiva";
import { useAlVencer, useTramo } from "@/components/CuentaRegresiva/useCuentaRegresiva";
import { AvisoOperacion } from "@/components/PantallaCarrito/AvisoOperacion";
import { VistaLectura, VistaPerdido, VistaSinSesion } from "@/components/PantallaCarrito/Vistas";
import {
  SelectorComun,
  type ResultadoConfirmacion,
} from "@/components/SelectorButacas/SelectorComun";
import { resolverProblemaCarrito, vistaPantalla } from "@/domain/carrito";
import { mismaSeleccion, type Asiento } from "@/domain/butacas";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import {
  actualizarCarrito,
  cerrarSesion,
  descartarSesion,
  leerSesion,
  leerSesionCruda,
  parsearSesion,
  suscribirSesion,
  type SesionCarrito,
} from "@/domain/sesion-carrito";
import estilos from "./CambioButacas.module.css";

const SIN_LEER = "sin-leer";

type CargaMapa =
  | { tipo: "cargando" }
  | { tipo: "listo"; mapa: MapaFuncion }
  | { tipo: "fallo"; sinConexion: boolean }
  /** La función ya empezó o no existe (404/410 sin `codigo`). */
  | { tipo: "cerrada" };

function textoBoton(cantidad: number): string {
  if (cantidad === 0) return "Guardar butacas";
  return cantidad === 1 ? "Guardar 1 butaca" : `Guardar ${cantidad} butacas`;
}

/**
 * Cambio de butacas de un carrito activo (spec 004, US3). El mapa se pide desde el navegador
 * porque la función solo se conoce en la sesión de la pestaña (plan, Complexity Tracking).
 */
export function CambioButacas({ carritoId }: { carritoId: string }) {
  const router = useRouter();
  const crudo = useSyncExternalStore(suscribirSesion, leerSesionCruda, () => SIN_LEER);
  const sesion = useMemo(() => (crudo === SIN_LEER ? null : parsearSesion(crudo)), [crudo]);
  const propia = sesion?.carritoId === carritoId ? sesion : null;
  const venceEn = propia?.carrito.venceEn ?? null;
  const desfaseMs = propia?.desfaseMs ?? 0;
  const tramo = useTramo(venceEn, desfaseMs);
  const [perdido, setPerdido] = useState<{ peliculaId: string | null } | null>(null);
  const [carga, setCarga] = useState<CargaMapa>({ tipo: "cargando" });

  const vista = vistaPantalla({ leida: crudo !== SIN_LEER, sesion, carritoId, tramo, perdido });
  const activa = vista.tipo === "activo" ? vista.sesion : null;
  const rutaCarrito = `/carritos/${carritoId}`;

  // El cambio no extiende el vencimiento: si el contador llega a cero acá, se vuelve al carrito.
  useAlVencer(venceEn, desfaseMs, propia?.token != null, () => {
    cerrarSesion();
    router.push(rutaCarrito);
  });

  const funcionId = activa?.carrito.funcion.funcionId ?? null;
  const cargarMapa = useCallback(async (id: string) => {
    const resultado = await obtenerMapaDesdeNavegador(id);
    if (resultado.ok) setCarga({ tipo: "listo", mapa: resultado.datos });
    else if (resultado.problema.status === 404 || resultado.problema.status === 410)
      setCarga({ tipo: "cerrada" });
    else setCarga({ tipo: "fallo", sinConexion: resultado.problema.tipo === "red" });
  }, []);

  const pedido = useRef(false);
  useEffect(() => {
    if (!funcionId || pedido.current) return;
    pedido.current = true;
    void cargarMapa(funcionId);
  }, [funcionId, cargarMapa]);

  async function confirmar(seleccion: Asiento[]): Promise<ResultadoConfirmacion> {
    const actual = leerSesion();
    if (!actual?.token || actual.carritoId !== carritoId) return { tipo: "hecho" };
    const resultado = await reemplazarAsientos(actual.carritoId, actual.token, seleccion);
    if (resultado.ok) {
      actualizarCarrito(
        resultado.datos,
        medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs),
      );
      router.push(rutaCarrito);
      return { tipo: "hecho" };
    }
    return (
      resolverPropio(resultado.problema, actual) ?? {
        tipo: "problema",
        problema: resultado.problema,
      }
    );
  }

  /**
   * Credencial perdida y carrito cerrado se resuelven acá (research C10); los códigos de butacas,
   * `pedido-invalido` y el error genérico los resuelve el selector, como en la creación.
   */
  function resolverPropio(problema: Problema, actual: SesionCarrito): ResultadoConfirmacion | null {
    const transicion = resolverProblemaCarrito(problema, "cambiar");
    if (transicion.tipo === "perdido") {
      setPerdido({ peliculaId: actual.carrito.funcion.peliculaId });
      descartarSesion();
      return { tipo: "hecho" };
    }
    if (transicion.tipo === "cerrar") {
      cerrarSesion({ ...actual.carrito, estado: transicion.estadoActual ?? actual.carrito.estado });
      router.push(rutaCarrito);
      return { tipo: "hecho" };
    }
    return null;
  }

  if (vista.tipo === "sinLeer") return null;
  if (vista.tipo === "sinSesion") return <VistaSinSesion />;
  if (vista.tipo === "perdido") return <VistaPerdido peliculaId={vista.peliculaId} />;
  if (vista.tipo === "lectura")
    return <VistaLectura motivo={vista.motivo} carrito={vista.carrito} />;

  const { carrito } = vista.sesion;
  return (
    <div className={estilos.cambio}>
      <AvisoTiempo tramo={tramo} activo vencioAca={false} />
      <Link href={rutaCarrito} className={`label ${estilos.volver}`}>
        Volver al carrito
      </Link>
      <h1 className="h2">Cambiá tus butacas</h1>
      <CuentaRegresiva venceEn={carrito.venceEn} desfaseMs={vista.sesion.desfaseMs} />
      <CabeceraFuncion {...carrito.funcion} precioEntrada={carrito.precioUnitario} />

      {carga.tipo === "cargando" && (
        <p role="status" className={estilos.carga}>
          Cargando el mapa de la sala…
        </p>
      )}
      {carga.tipo === "fallo" && (
        <AvisoOperacion
          sinConexion={carga.sinConexion}
          onReintentar={() => {
            setCarga({ tipo: "cargando" });
            void cargarMapa(carrito.funcion.funcionId);
          }}
        >
          <p>No pudimos cargar el mapa de la sala.</p>
          <p>Tus butacas siguen reservadas. Probá de nuevo.</p>
        </AvisoOperacion>
      )}
      {carga.tipo === "cerrada" && (
        <AvisoOperacion>
          <p>Esta función ya no está disponible.</p>
          <p>
            <Link href="/">Ver la cartelera</Link>
          </p>
        </AvisoOperacion>
      )}
      {carga.tipo === "listo" && (
        <SelectorComun
          mapa={carga.mapa}
          propias={carrito.asientos}
          textoBoton={textoBoton}
          textoEnviando="Guardando butacas…"
          textoError="No pudimos guardar el cambio. Tus butacas siguen como estaban; probá de nuevo."
          cintaSinConexion
          salidaFuncionCerrada={{ href: "/", texto: "Ver la cartelera" }}
          ocultarConfirmacion={(seleccion) => mismaSeleccion(seleccion, carrito.asientos)}
          ayuda={(seleccion) => {
            if (seleccion.length === 0)
              return (
                <p className={estilos.ayuda}>
                  Para no quedarte con ninguna butaca, abandoná el carrito.{" "}
                  <Link href={rutaCarrito}>Ir al carrito</Link>
                </p>
              );
            // Sin cambios no hay nada que guardar: en lugar del botón queda la salida al carrito.
            if (mismaSeleccion(seleccion, carrito.asientos))
              return (
                <Link href={rutaCarrito} className="boton-primario">
                  Dejar las butacas como están
                </Link>
              );
            return null;
          }}
          confirmar={confirmar}
        />
      )}
    </div>
  );
}
