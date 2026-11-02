"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { abandonarCarrito, indicarEmail, obtenerCarrito } from "@/api/carritos";
import { AvisoTiempo } from "@/components/CuentaRegresiva/AvisoTiempo";
import { CuentaRegresiva } from "@/components/CuentaRegresiva/CuentaRegresiva";
import { useAlVencer, useTramo } from "@/components/CuentaRegresiva/useCuentaRegresiva";
import type { Problema } from "@/api/problema";
import {
  estaActivo,
  etiquetaEstado,
  repartirErrores,
  resolverProblemaCarrito,
  vistaPantalla,
  type OperacionCarrito,
} from "@/domain/carrito";
import { medirDesfase } from "@/domain/cuenta-regresiva";
import {
  actualizarCarrito,
  cerrarSesion,
  descartarSesion,
  leerSesionCruda,
  parsearSesion,
  suscribirSesion,
  type SesionCarrito,
} from "@/domain/sesion-carrito";
import { AbandonoCarrito, type ResultadoAbandono } from "./AbandonoCarrito";
import { AvisoOperacion } from "./AvisoOperacion";
import { EmailEntrega, type ResultadoEmail } from "./EmailEntrega";
import { ResumenCarrito } from "./ResumenCarrito";
import { VistaLectura, VistaPerdido, VistaSinSesion } from "./Vistas";
import estilos from "./PantallaCarrito.module.css";

/** En el servidor no hay sesión: el contenido se decide en el navegador. */
const SIN_LEER = "sin-leer";

type Actualizacion =
  { tipo: "pendiente" } | { tipo: "alDia" } | { tipo: "fallo"; sinConexion: boolean };

/** Aviso en modo lectura cuando el carrito se cerró mientras se guardaba el email. */
const AVISO_EMAIL_NO_ACTIVO = "No se guardó el email: este carrito ya no está activo.";

/**
 * Pantalla del carrito. La sesión de la pestaña es la fuente de verdad: cada respuesta de la API
 * se guarda ahí y la vista se deriva de lo guardado (research C1, C2).
 */
export function PantallaCarrito({ carritoId }: { carritoId: string }) {
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

  const vista = vistaPantalla({ leida: crudo !== SIN_LEER, sesion, carritoId, tramo, perdido });
  const activa = vista.tipo === "activo" ? vista.sesion : null;

  // Al llegar a cero, la credencial se borra y el carrito queda en modo lectura (FR-014). Se
  // vigila la credencial y no la vista: un carrito que se abre ya vencido nunca está activo.
  useAlVencer(venceEn, desfaseMs, propia?.token != null, () => {
    cerrarSesion();
    setVencioAca(true);
  });

  /**
   * Aplica a la sesión lo que no se resuelve en pantalla: credencial perdida (se descarta) o
   * carrito cerrado (queda en lectura). Devuelve la transición para el resto de los casos.
   */
  const aplicarError = useCallback(
    (problema: Problema, operacion: OperacionCarrito, actual: SesionCarrito) => {
      const transicion = resolverProblemaCarrito(problema, operacion);
      if (transicion.tipo === "perdido") {
        // La película se guarda antes de descartar, para ofrecer sus horarios.
        setPerdido({ peliculaId: actual.carrito.funcion.peliculaId });
        descartarSesion();
      } else if (transicion.tipo === "cerrar") {
        if (transicion.aviso && operacion === "email") setAvisoLectura(AVISO_EMAIL_NO_ACTIVO);
        cerrarSesion({
          ...actual.carrito,
          estado: transicion.estadoActual ?? actual.carrito.estado,
        });
      }
      return transicion;
    },
    [],
  );

  const actualizar = useCallback(
    async (actual: SesionCarrito & { token: string }) => {
      const resultado = await obtenerCarrito(actual.carritoId, actual.token);
      if (!resultado.ok) {
        const transicion = aplicarError(resultado.problema, "obtener", actual);
        if (transicion.tipo === "error") {
          setActualizacion({ tipo: "fallo", sinConexion: transicion.sinConexion });
        }
        return;
      }
      const carrito = resultado.datos;
      actualizarCarrito(carrito, medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs));
      if (!estaActivo(carrito)) cerrarSesion(carrito);
      setActualizacion({ tipo: "alDia" });
    },
    [aplicarError],
  );

  async function guardarEmail(email: string): Promise<ResultadoEmail> {
    if (!activa) return { tipo: "resuelto" };
    const resultado = await indicarEmail(activa.carritoId, activa.token, email);
    if (resultado.ok) {
      actualizarCarrito(
        resultado.datos,
        medirDesfase(resultado.horaServidorMs, resultado.recibidoEnMs),
      );
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

  // Una sola consulta al abrir, si hay credencial para este carrito (FR-007).
  const consultado = useRef(false);
  useEffect(() => {
    if (!activa || consultado.current) return;
    consultado.current = true;
    void actualizar(activa);
  }, [activa, actualizar]);

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

  return (
    <>
      <AvisoTiempo tramo={tramo} activo={activa !== null} vencioAca={vencioAca} />
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
      {activa && (
        <div className={estilos.vista}>
          <h1 ref={titulo} tabIndex={-1} className="h2">
            Tu carrito
          </h1>
          <CuentaRegresiva venceEn={activa.carrito.venceEn} desfaseMs={activa.desfaseMs} />
          {actualizacion.tipo === "fallo" && (
            <AvisoOperacion
              sinConexion={actualizacion.sinConexion}
              onReintentar={() => {
                setActualizacion({ tipo: "pendiente" });
                void actualizar(activa);
              }}
            >
              <p>No pudimos actualizar tu carrito.</p>
              <p>Te mostramos los últimos datos que tenemos. Probá de nuevo.</p>
            </AvisoOperacion>
          )}
          <ResumenCarrito carrito={activa.carrito} estado={etiquetaEstado(activa.carrito.estado)} />
          <Link href={`/carritos/${carritoId}/butacas`} className="boton-secundario">
            Cambiar butacas
          </Link>
          <EmailEntrega emailGuardado={activa.carrito.emailEntrega} guardar={guardarEmail} />
          <AbandonoCarrito abandonar={abandonar} />
        </div>
      )}
    </>
  );
}
