"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CuentaRegresiva } from "@/components/CuentaRegresiva/CuentaRegresiva";
import { useAlVencer, useTramo } from "@/components/CuentaRegresiva/useCuentaRegresiva";
import { AvisoInicioPago, type AvisoPago } from "@/components/PantallaCarrito/SeccionPago";
import { useIrAPago } from "@/components/PantallaCarrito/useIrAPago";
import {
  EnlaceEmpezarDeNuevo,
  SeccionEntradas,
  TextoEntradasPorEmail,
  VistaLectura,
  VistaPerdido,
} from "@/components/PantallaCarrito/Vistas";
import { resolverProblemaCarrito, vistaPantalla } from "@/domain/carrito";
import {
  descartarSesion,
  leerSesionCruda,
  parsearSesion,
  suscribirSesion,
} from "@/domain/sesion-carrito";
import { useEsperaPago } from "./useEsperaPago";
import estilos from "./VueltaPago.module.css";

const SIN_LEER = "sin-leer";

type Fase =
  | "sinLeer"
  | "esperando"
  | "sinConfirmar"
  | "listo"
  | "vencido"
  | "cerrado"
  | "sinIniciar"
  | "sinSesion"
  | "perdido";

/** Lo que oye un lector de pantalla al cambiar de fase, una sola vez (FR-024, research P13). */
const ANUNCIO: Partial<Record<Fase, string>> = {
  esperando: "Estamos confirmando tu pago.",
  sinConfirmar: "Todavía no se confirmó tu pago.",
  listo: "Pago confirmado. Ya tenés tus entradas.",
  vencido: "Se terminó el tiempo para pagar.",
};

/**
 * Página a la que vuelve el comprador desde la pasarela (spec 005, US1 y US4). Espera la
 * confirmación mientras el carrito siga en `Pagando` y muestra las entradas o el vencimiento.
 */
export function VueltaPago({
  carritoId,
  pagoSimulado = false,
}: {
  carritoId: string;
  pagoSimulado?: boolean;
}) {
  const crudo = useSyncExternalStore(suscribirSesion, leerSesionCruda, () => SIN_LEER);
  const sesion = useMemo(() => (crudo === SIN_LEER ? null : parsearSesion(crudo)), [crudo]);
  const propia = sesion?.carritoId === carritoId ? sesion : null;
  const venceEn = propia?.carrito.venceEn ?? null;
  const desfaseMs = propia?.desfaseMs ?? 0;
  const tramo = useTramo(venceEn, desfaseMs);
  const [perdido, setPerdido] = useState<{ peliculaId: string | null } | null>(null);
  const [avisoPago, setAvisoPago] = useState<AvisoPago | null>(null);

  const vista = vistaPantalla({ leida: crudo !== SIN_LEER, sesion, carritoId, tramo, perdido });
  const pagando = vista.tipo === "pagando" ? vista.sesion : null;
  const peliculaId = propia?.carrito.funcion.peliculaId ?? null;

  function perderCredencial() {
    setPerdido({ peliculaId });
    descartarSesion();
  }

  const { agotada, reiniciar } = useEsperaPago({
    carritoId,
    token: pagando?.token ?? null,
    alPerderCredencial: perderCredencial,
  });
  const { irAPago, iniciando } = useIrAPago(pagando, pagoSimulado);

  // El contador en cero no declara nada: se consulta ya y decide la API (research P7).
  useAlVencer(venceEn, desfaseMs, pagando !== null, reiniciar);

  async function volverAPagar() {
    setAvisoPago(null);
    const resultado = await irAPago();
    if (resultado.tipo === "destinoInvalido") setAvisoPago({ tipo: "destinoInvalido" });
    if (resultado.tipo !== "problema") return;
    const transicion = resolverProblemaCarrito(resultado.problema, "pagar");
    if (transicion.tipo === "perdido") perderCredencial();
    // Ya no está en pago: la consulta trae el estado real (pagado o vencido).
    else if (transicion.tipo === "cerrar") reiniciar();
    else if (transicion.tipo === "error" && transicion.pagoNoDisponible)
      setAvisoPago({ tipo: "noDisponible" });
    else
      setAvisoPago({
        tipo: "fallo",
        sinConexion: transicion.tipo === "error" && transicion.sinConexion,
      });
  }

  let fase: Fase;
  switch (vista.tipo) {
    case "pagando":
      fase = agotada ? "sinConfirmar" : "esperando";
      break;
    case "pagado":
      fase = "listo";
      break;
    case "lectura":
      // Solo se habla de devoluciones si hubo un pago iniciado.
      fase = vista.motivo === "vencido" && vista.carrito.pago !== null ? "vencido" : "cerrado";
      break;
    case "activo":
      fase = "sinIniciar";
      break;
    default:
      fase = vista.tipo;
  }

  // Al cambiar de fase, el foco va al título nuevo (como en el carrito, research C12).
  const titulo = useRef<HTMLHeadingElement>(null);
  const faseAnterior = useRef(fase);
  useEffect(() => {
    const anterior = faseAnterior.current;
    faseAnterior.current = fase;
    if (anterior !== fase) titulo.current?.focus();
  }, [fase]);

  const botonVolver = (principal: boolean) => (
    <button
      type="button"
      className={principal ? "boton-primario" : "boton-secundario"}
      disabled={iniciando}
      onClick={() => void volverAPagar()}
    >
      {iniciando ? "Abriendo la página de pago…" : "Volver a la página de pago"}
    </button>
  );
  const aviso = avisoPago && avisoPago.tipo !== "faltaEmail" && (
    <AvisoInicioPago aviso={avisoPago} onReintentar={() => void volverAPagar()} />
  );

  return (
    <>
      <p role="status" className="visualmente-oculto">
        {ANUNCIO[fase] ?? ""}
      </p>

      {fase === "esperando" && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Estamos confirmando tu pago…
          </h1>
          <p className={estilos.texto}>Esto tarda unos segundos. No cierres esta pestaña.</p>
          {aviso}
          <div className={estilos.acciones}>
            <p className={estilos.texto}>
              Si cerraste la página de pago o te rechazaron la tarjeta, podés volver a intentarlo.
            </p>
            {botonVolver(false)}
          </div>
        </div>
      )}

      {fase === "sinConfirmar" && pagando && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Todavía no se confirmó tu pago
          </h1>
          <p className={estilos.texto}>
            Si pagaste, puede tardar un poco más. Si el pago fue rechazado, podés volver a
            intentarlo antes de que termine el tiempo.
          </p>
          <CuentaRegresiva venceEn={pagando.carrito.venceEn} desfaseMs={pagando.desfaseMs} />
          {aviso}
          <div className={estilos.botones}>
            <button type="button" className="boton-primario" onClick={reiniciar}>
              Revisar de nuevo
            </button>
            {botonVolver(false)}
          </div>
        </div>
      )}

      {vista.tipo === "pagado" && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            ¡Listo!
          </h1>
          <TextoEntradasPorEmail email={vista.carrito.emailEntrega} />
          <SeccionEntradas carrito={vista.carrito} />
          <Link href="/" className="boton-secundario">
            Ver la cartelera
          </Link>
        </div>
      )}

      {fase === "vencido" && vista.tipo === "lectura" && (
        <div className={estilos.vista}>
          <span aria-hidden="true" className="cinta-peligro" />
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Se terminó el tiempo para pagar
          </h1>
          <p className={estilos.texto}>
            El tiempo para pagar venció y tus butacas quedaron libres. Si se cobró algo, se devuelve
            automáticamente.
          </p>
          <EnlaceEmpezarDeNuevo peliculaId={vista.carrito.funcion.peliculaId} />
        </div>
      )}

      {fase === "cerrado" && vista.tipo === "lectura" && (
        <VistaLectura tituloRef={titulo} motivo={vista.motivo} carrito={vista.carrito} />
      )}

      {fase === "sinIniciar" && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Todavía no empezaste el pago
          </h1>
          <p className={estilos.texto}>Tus butacas siguen reservadas. Pagá desde el carrito.</p>
          <Link href={`/carritos/${carritoId}`} className="boton-secundario">
            Volver al carrito
          </Link>
        </div>
      )}

      {fase === "sinSesion" && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            No encontramos tu pago en esta pestaña
          </h1>
          <p className={estilos.texto}>
            El pago se sigue desde la pestaña donde elegiste las butacas. Si se aprobó, las entradas
            te llegan al email que indicaste.
          </p>
          <EnlaceEmpezarDeNuevo peliculaId={null} />
        </div>
      )}

      {vista.tipo === "perdido" && (
        <VistaPerdido tituloRef={titulo} peliculaId={vista.peliculaId} />
      )}
    </>
  );
}
