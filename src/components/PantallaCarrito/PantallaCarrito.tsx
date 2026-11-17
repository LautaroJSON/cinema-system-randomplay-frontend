"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { abandonarCarrito, indicarEmail, obtenerCarrito } from "@/api/carritos";
import { AvisoTiempo } from "@/components/CuentaRegresiva/AvisoTiempo";
import { CuentaRegresiva } from "@/components/CuentaRegresiva/CuentaRegresiva";
import { useAlVencer, useTramo } from "@/components/CuentaRegresiva/useCuentaRegresiva";
import type { Problema } from "@/api/problema";
import {
  cierraSesion,
  estaActivo,
  estaPagando,
  etiquetaEstado,
  repartirErrores,
  resolverProblemaCarrito,
  vistaPantalla,
  type OperacionCarrito,
} from "@/domain/carrito";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import { rutaVuelta } from "@/domain/pago";
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
import { AbandonoCarrito, type ResultadoAbandono } from "./AbandonoCarrito";
import { AvisoOperacion } from "./AvisoOperacion";
import { EmailEntrega, type ControlEmail, type ResultadoEmail } from "./EmailEntrega";
import { ResumenCarrito } from "./ResumenCarrito";
import { SeccionPago, type AvisoPago } from "./SeccionPago";
import { useIrAPago } from "./useIrAPago";
import { VistaLectura, VistaPagado, VistaPerdido, VistaSinSesion } from "./Vistas";
import estilos from "./PantallaCarrito.module.css";

/** En el servidor no hay sesión: el contenido se decide en el navegador. */
const SIN_LEER = "sin-leer";

type Actualizacion =
  { tipo: "pendiente" } | { tipo: "alDia" } | { tipo: "fallo"; sinConexion: boolean };

type ConToken = SesionCarrito & { token: string };

/** Aviso en modo lectura cuando el carrito se cerró mientras se guardaba el email. */
const AVISO_EMAIL_NO_ACTIVO = "No se guardó el email: este carrito ya no está activo.";

/**
 * Pantalla del carrito. La sesión de la pestaña es la fuente de verdad: cada respuesta de la API
 * se guarda ahí y la vista se deriva de lo guardado (research C1, C2; spec 005, research P6).
 */
export function PantallaCarrito({
  carritoId,
  pagoSimulado = false,
}: {
  carritoId: string;
  /** La página de pago simulado existe en este entorno (research P3). */
  pagoSimulado?: boolean;
}) {
  const router = useRouter();
  const crudo = useSyncExternalStore(suscribirSesion, leerSesionCruda, () => SIN_LEER);
  const sesion = useMemo(() => (crudo === SIN_LEER ? null : parsearSesion(crudo)), [crudo]);
  const propia = sesion?.carritoId === carritoId ? sesion : null;
  const venceEn = propia?.carrito.venceEn ?? null;
  const desfaseMs = propia?.desfaseMs ?? 0;
  const tramo = useTramo(venceEn, desfaseMs);

  const [perdido, setPerdido] = useState<{ peliculaId: string | null } | null>(null);
  const [vencioAca, setVencioAca] = useState(false);
  const [actualizacion, setActualizacion] = useState<Actualizacion>({ tipo: "pendiente" });
  const [avisoLectura, setAvisoLectura] = useState<string | null>(null);
  const [avisoPago, setAvisoPago] = useState<AvisoPago | null>(null);
  const [rechazoEnPago, setRechazoEnPago] = useState(false);
  const [editandoEmail, setEditandoEmail] = useState(false);
  const controlEmail = useRef<ControlEmail>(null);
  const idMotivoBloqueo = useId();

  const vista = vistaPantalla({ leida: crudo !== SIN_LEER, sesion, carritoId, tramo, perdido });
  const activa = vista.tipo === "activo" ? vista.sesion : null;
  const pagando = vista.tipo === "pagando" ? vista.sesion : null;
  const conToken: ConToken | null = activa ?? pagando;
  const { irAPago, iniciando } = useIrAPago(conToken, pagoSimulado);

  // Al llegar a cero, un carrito activo se cierra y queda en modo lectura (FR-014). Uno en pago
  // no: la API decide si el pago llegó a tiempo, y eso se espera en la página de vuelta (P7).
  const retiene = propia !== null && (estaActivo(propia.carrito) || estaPagando(propia.carrito));
  useAlVencer(venceEn, desfaseMs, propia?.token != null && retiene, () => {
    if (propia && estaPagando(propia.carrito)) {
      router.push(rutaVuelta(carritoId));
      return;
    }
    cerrarSesion();
    setVencioAca(true);
  });

  const perderCredencial = useCallback((actual: SesionCarrito) => {
    // La película se guarda antes de descartar, para ofrecer sus horarios.
    setPerdido({ peliculaId: actual.carrito.funcion.peliculaId });
    descartarSesion();
  }, []);

  const actualizar = useCallback(
    async (actual: ConToken) => {
      const resultado = await obtenerCarrito(actual.carritoId, actual.token);
      if (!resultado.ok) {
        const transicion = resolverProblemaCarrito(resultado.problema, "obtener");
        if (transicion.tipo === "perdido") perderCredencial(actual);
        else if (transicion.tipo === "error") {
          setActualizacion({ tipo: "fallo", sinConexion: transicion.sinConexion });
        }
        return false;
      }
      const carrito = resultado.datos;
      actualizarCarrito(carrito, medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs));
      // Pagando conserva la credencial; Pagado la suelta y guarda las entradas (research P5).
      if (cierraSesion(carrito)) cerrarSesion(carrito);
      setActualizacion({ tipo: "alDia" });
      return true;
    },
    [perderCredencial],
  );

  /**
   * Aplica a la sesión lo que no se resuelve en pantalla: credencial perdida (se descarta),
   * carrito cerrado (queda en lectura) o pago en curso (se relee y la vista se bloquea).
   * Devuelve la transición para el resto de los casos.
   */
  const aplicarError = useCallback(
    (problema: Problema, operacion: OperacionCarrito, actual: ConToken) => {
      const transicion = resolverProblemaCarrito(problema, operacion);
      if (transicion.tipo === "perdido") {
        perderCredencial(actual);
      } else if (transicion.tipo === "cerrar") {
        if (transicion.aviso && operacion === "email") setAvisoLectura(AVISO_EMAIL_NO_ACTIVO);
        cerrarSesion({
          ...actual.carrito,
          estado: transicion.estadoActual ?? actual.carrito.estado,
        });
      } else if (transicion.tipo === "enPago") {
        setRechazoEnPago(true);
        void actualizar(actual);
      }
      return transicion;
    },
    [actualizar, perderCredencial],
  );

  async function guardarEmail(email: string): Promise<ResultadoEmail> {
    if (!activa) return { tipo: "resuelto" };
    const resultado = await indicarEmail(activa.carritoId, activa.token, email);
    if (resultado.ok) {
      actualizarCarrito(
        resultado.datos,
        medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs),
      );
      setAvisoPago(null);
      return { tipo: "guardado" };
    }
    const { problema } = resultado;
    const transicion = aplicarError(problema, "email", activa);
    if (transicion.tipo === "invalido") {
      const { campo, generales } = repartirErrores(problema.errors, "email");
      return { tipo: "invalido", campo, generales };
    }
    if (transicion.tipo === "error") return { tipo: "fallo", sinConexion: transicion.sinConexion };
    return { tipo: "resuelto" };
  }

  async function abandonar(): Promise<ResultadoAbandono> {
    if (!activa) return { tipo: "hecho" };
    const resultado = await abandonarCarrito(activa.carritoId, activa.token);
    if (resultado.ok) {
      cerrarSesion(resultado.datos);
      return { tipo: "hecho" };
    }
    const transicion = aplicarError(resultado.problema, "abandonar", activa);
    return transicion.tipo === "error"
      ? { tipo: "fallo", sinConexion: transicion.sinConexion }
      : { tipo: "hecho" };
  }

  /** "Pagar" o "Volver a la página de pago": cada `codigo` tiene su salida (FR-031). */
  async function pagar() {
    if (!conToken) return;
    setAvisoPago(null);
    const actual = conToken;
    const resultado = await irAPago();
    if (resultado.tipo === "destinoInvalido") {
      setAvisoPago({ tipo: "destinoInvalido" });
      return;
    }
    if (resultado.tipo !== "problema") return;

    const transicion = resolverProblemaCarrito(resultado.problema, "pagar");
    switch (transicion.tipo) {
      case "perdido":
        perderCredencial(actual);
        return;
      case "pedirEmail":
        setAvisoPago({ tipo: "faltaEmail" });
        controlEmail.current?.editar();
        return;
      case "cerrar": {
        // Se pide el carrito antes de cerrar: si quedó Pagado, trae las entradas (P9).
        const leido = await actualizar(actual);
        const sigue = leerSesion();
        if (!leido && sigue?.carritoId === actual.carritoId && sigue.token !== null) {
          cerrarSesion({
            ...actual.carrito,
            estado: transicion.estadoActual ?? actual.carrito.estado,
          });
        }
        return;
      }
      case "releer":
        setAvisoPago({ tipo: "reservaCambio" });
        void actualizar(actual);
        return;
      case "error":
        setAvisoPago(
          transicion.pagoNoDisponible
            ? { tipo: "noDisponible" }
            : { tipo: "fallo", sinConexion: transicion.sinConexion },
        );
        return;
      case "invalido":
      case "butacas":
      case "enPago":
        setAvisoPago({ tipo: "fallo", sinConexion: false });
        return;
      default: {
        const exhaustivo: never = transicion;
        return exhaustivo;
      }
    }
  }

  // Una sola consulta al abrir, si hay credencial para este carrito (FR-007).
  const consultado = useRef(false);
  useEffect(() => {
    if (!conToken || consultado.current) return;
    consultado.current = true;
    void actualizar(conToken);
  }, [conToken, actualizar]);

  // Al cambiar de vista, el foco va al título nuevo: el control que tenía el foco desapareció.
  const titulo = useRef<HTMLHeadingElement>(null);
  const claveVista = vista.tipo === "lectura" ? `lectura-${vista.motivo}` : vista.tipo;
  const vistaAnterior = useRef(claveVista);
  useEffect(() => {
    const anterior = vistaAnterior.current;
    vistaAnterior.current = claveVista;
    // También al decidir la primera vista en el navegador: se llega desde el mapa o desde el
    // cambio de butacas, y el botón que tenía el foco ya no existe (research C12).
    if (anterior !== claveVista) titulo.current?.focus();
  }, [claveVista]);

  const avisoActualizacion = actualizacion.tipo === "fallo" && conToken && (
    <AvisoOperacion
      sinConexion={actualizacion.sinConexion}
      onReintentar={() => {
        setActualizacion({ tipo: "pendiente" });
        void actualizar(conToken);
      }}
    >
      <p>No pudimos actualizar tu carrito.</p>
      <p>Te mostramos los últimos datos que tenemos. Probá de nuevo.</p>
    </AvisoOperacion>
  );

  return (
    <>
      <AvisoTiempo tramo={tramo} activo={conToken !== null} vencioAca={vencioAca} />
      {vista.tipo === "sinSesion" && <VistaSinSesion tituloRef={titulo} />}
      {vista.tipo === "perdido" && (
        <VistaPerdido tituloRef={titulo} peliculaId={vista.peliculaId} />
      )}
      {vista.tipo === "lectura" && (
        <VistaLectura
          tituloRef={titulo}
          motivo={vista.motivo}
          carrito={vista.carrito}
          aviso={avisoLectura}
        />
      )}
      {vista.tipo === "pagado" && <VistaPagado tituloRef={titulo} carrito={vista.carrito} />}
      {activa && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Tu carrito
          </h1>
          <CuentaRegresiva venceEn={activa.carrito.venceEn} desfaseMs={activa.desfaseMs} />
          {avisoActualizacion}
          <ResumenCarrito carrito={activa.carrito} estado={etiquetaEstado(activa.carrito.estado)} />
          <Link href={`/carritos/${carritoId}/butacas`} className="boton-secundario">
            Cambiar butacas
          </Link>
          <EmailEntrega
            emailGuardado={activa.carrito.emailEntrega}
            guardar={guardarEmail}
            controlRef={controlEmail}
            alCambiarEdicion={setEditandoEmail}
          />
          {/* Sin email guardado no hay pago: la sección aparece al guardarlo (FR-004). */}
          {activa.carrito.emailEntrega !== null && (
            <SeccionPago
              modo="pagar"
              total={activa.carrito.total}
              principal={!editandoEmail}
              iniciando={iniciando}
              aviso={avisoPago}
              onPagar={() => void pagar()}
            />
          )}
          <AbandonoCarrito abandonar={abandonar} />
        </div>
      )}
      {pagando && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Tu carrito
          </h1>
          <CuentaRegresiva venceEn={pagando.carrito.venceEn} desfaseMs={pagando.desfaseMs} />
          {/* Se anuncia una vez si se llegó acá por un rechazo de la API (FR-032). */}
          <div
            id={idMotivoBloqueo}
            role={rechazoEnPago ? "alert" : undefined}
            className={estilos.enPago}
          >
            <p>
              <strong>Pago en curso.</strong> Mientras pagás no se pueden cambiar las butacas ni el
              email, ni abandonar el carrito.
            </p>
          </div>
          {avisoActualizacion}
          <ResumenCarrito
            carrito={pagando.carrito}
            estado={etiquetaEstado(pagando.carrito.estado)}
          />
          {/* aria-disabled y no disabled: sigue enfocable y se lee el motivo. */}
          <button
            type="button"
            className="boton-secundario"
            aria-disabled="true"
            aria-describedby={idMotivoBloqueo}
          >
            Cambiar butacas
          </button>
          <EmailEntrega
            emailGuardado={pagando.carrito.emailEntrega}
            guardar={guardarEmail}
            soloLectura
          />
          <SeccionPago
            modo="volver"
            total={pagando.carrito.total}
            principal
            iniciando={iniciando}
            aviso={avisoPago}
            onPagar={() => void pagar()}
          />
          <AbandonoCarrito abandonar={abandonar} bloqueadoPor={idMotivoBloqueo} />
        </div>
      )}
    </>
  );
}
