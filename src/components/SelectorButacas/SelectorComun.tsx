"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { obtenerMapaDesdeNavegador, type MapaFuncion } from "@/api/asientos";
import type { Problema } from "@/api/problema";
import { MapaButacas } from "@/components/MapaButacas/MapaButacas";
import { MAX_BUTACAS_POR_COMPRA } from "@/config/experiencia";
import {
  buscarButaca,
  estadoInicial,
  etiquetaButaca,
  listarAsientos,
  marcarPropias,
  reducirSeleccion,
  type Asiento,
} from "@/domain/butacas";
import { multiplicar } from "@/domain/dinero";
import { formatearPrecio } from "@/domain/formato";
import estilos from "./SelectorButacas.module.css";

// Mapa, selección y manejo de los `codigo` de butacas, compartidos por la creación del carrito
// (spec 003) y el cambio de butacas (spec 004). Cada uno aporta cómo se confirma.

/** Lo que devuelve una estrategia de confirmación. */
export type ResultadoConfirmacion =
  /** La estrategia ya terminó (navegó o cambió de vista): no hay nada que mostrar acá. */
  | { tipo: "hecho" }
  | { tipo: "sinAlmacenamiento" }
  /** Un error que resuelve esta parte común, por `codigo`. */
  | { tipo: "problema"; problema: Problema };

type EstadoConfirmacion =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "sinAlmacenamiento" }
  | { tipo: "conflicto"; mensaje: string; refrescando: boolean; refrescoFallo: boolean }
  | { tipo: "funcionCerrada" }
  | { tipo: "sinCupo" }
  | { tipo: "esperando"; restante: number }
  | { tipo: "invalido"; seleccion: string[]; generales: string[] }
  | { tipo: "errorGenerico"; sinConexion: boolean };

/** Avisos que desaparecen en cuanto el comprador cambia la selección. */
const AVISOS_PASAJEROS = new Set<EstadoConfirmacion["tipo"]>([
  "sinAlmacenamiento",
  "sinCupo",
  "invalido",
  "errorGenerico",
]);

const ID_MENSAJES = "mensajes-seleccion";

function avisoPerdidas(perdidas: Asiento[]): string {
  if (perdidas.length === 0) {
    return "Alguien tomó una de tus butacas antes que vos. Actualizamos el mapa; elegí otra.";
  }
  const otra = perdidas.length === 1 ? "otra" : "otras";
  return `Alguien tomó ${listarAsientos(perdidas)} antes que vos. Actualizamos el mapa; elegí ${otra}.`;
}

export type PropsSelectorComun = {
  mapa: MapaFuncion;
  /** Butacas que ya retiene el carrito: se muestran libres y arrancan seleccionadas. */
  propias?: Asiento[];
  textoBoton: (cantidad: number) => string;
  textoEnviando: string;
  /** Texto del error genérico (código desconocido o red). */
  textoError: string;
  /** Un fallo de red lleva la cinta de peligro (solo con un carrito en juego, DESIGN.md §6.5). */
  cintaSinConexion?: boolean;
  /** Adónde ir cuando la función ya no se puede comprar. */
  salidaFuncionCerrada?: { href: string; texto: string };
  /** Saca el botón de confirmar (por ejemplo, sin cambios); `ayuda` ofrece la salida. */
  ocultarConfirmacion?: (seleccion: Asiento[]) => boolean;
  /** Contenido debajo del botón según la selección. */
  ayuda?: (seleccion: Asiento[]) => ReactNode;
  confirmar: (seleccion: Asiento[]) => Promise<ResultadoConfirmacion>;
};

export function SelectorComun({
  mapa,
  propias = [],
  textoBoton,
  textoEnviando,
  textoError,
  cintaSinConexion = false,
  salidaFuncionCerrada,
  ocultarConfirmacion,
  ayuda,
  confirmar,
}: PropsSelectorComun) {
  const [estado, despachar] = useReducer(reducirSeleccion, undefined, () =>
    estadoInicial(marcarPropias(mapa.filas, propias), propias),
  );
  const [confirmacion, setConfirmacion] = useState<EstadoConfirmacion>({ tipo: "inactivo" });
  const [listoParaReintentar, setListoParaReintentar] = useState(false);
  const enCurso = useRef(false);
  // El último estado, para leerlo dentro de las funciones asíncronas.
  const estadoActual = useRef(estado);
  useEffect(() => {
    estadoActual.current = estado;
  }, [estado]);

  const { seleccion } = estado;
  const cerrada = confirmacion.tipo === "funcionCerrada";
  const quedanLibres = estado.filas.some((fila) => fila.butacas.some((b) => b.libre));
  const completa = !quedanLibres && seleccion.length === 0;
  const total = multiplicar(mapa.precioEntrada, seleccion.length);
  const horarios = `/peliculas/${mapa.peliculaId}#titulo-horarios`;
  const salida = salidaFuncionCerrada ?? { href: horarios, texto: "Ver otros horarios" };

  // Retry-After: se cuenta como duración desde que llegó la respuesta, de a un segundo.
  const esperando = confirmacion.tipo === "esperando";
  useEffect(() => {
    if (confirmacion.tipo !== "esperando") return;
    const { restante } = confirmacion;
    const temporizador = setTimeout(() => {
      if (restante > 1) {
        setConfirmacion({ tipo: "esperando", restante: restante - 1 });
      } else {
        setConfirmacion({ tipo: "inactivo" });
        setListoParaReintentar(true);
      }
    }, 1000);
    return () => clearTimeout(temporizador);
  }, [confirmacion]);

  function alternar(asiento: Asiento) {
    if (cerrada) return;
    despachar({ tipo: "alternar", asiento });
    setListoParaReintentar(false);
    if (AVISOS_PASAJEROS.has(confirmacion.tipo)) setConfirmacion({ tipo: "inactivo" });
    if (confirmacion.tipo === "conflicto" && !confirmacion.refrescando) {
      setConfirmacion({ tipo: "inactivo" });
    }
  }

  /** Vuelve a pedir el mapa tras un conflicto (Principio IV) y avisa qué se perdió. */
  async function refrescarMapa(armarMensaje: (quitadas: Asiento[]) => string, base: Asiento[]) {
    setConfirmacion({
      tipo: "conflicto",
      mensaje: armarMensaje(base),
      refrescando: true,
      refrescoFallo: false,
    });
    const resultado = await obtenerMapaDesdeNavegador(mapa.funcionId);
    if (!resultado.ok) {
      if (resultado.problema.status === 404 || resultado.problema.status === 410) {
        setConfirmacion({ tipo: "funcionCerrada" });
        return;
      }
      setConfirmacion({
        tipo: "conflicto",
        mensaje: armarMensaje(base),
        refrescando: false,
        refrescoFallo: true,
      });
      return;
    }
    // Las butacas del carrito siguen siendo suyas: el cambio no se aplicó.
    const nuevas = marcarPropias(resultado.datos.filas, propias);
    const extra = estadoActual.current.seleccion.filter(
      (a) =>
        !buscarButaca(nuevas, a)?.libre &&
        !base.some((b) => b.fila === a.fila && b.numero === a.numero),
    );
    despachar({ tipo: "reemplazarMapa", filas: nuevas });
    setConfirmacion({
      tipo: "conflicto",
      mensaje: armarMensaje([...base, ...extra]),
      refrescando: false,
      refrescoFallo: false,
    });
  }

  async function resolverProblema(problema: Problema, enviadas: Asiento[]) {
    const { tipo } = problema;
    switch (tipo) {
      case "asientos-no-disponibles": {
        despachar({ tipo: "marcarOcupadas", asientos: problema.asientos });
        const perdidas = enviadas.filter((a) =>
          problema.asientos.some((p) => p.fila === a.fila && p.numero === a.numero),
        );
        await refrescarMapa(avisoPerdidas, perdidas);
        return;
      }
      case "asientos-inexistentes":
        await refrescarMapa(
          () =>
            "Algunas butacas ya no existen en esta sala. Actualizamos el mapa; revisá tu selección.",
          [],
        );
        return;
      case "funcion-no-encontrada":
      case "funcion-no-disponible":
        setConfirmacion({ tipo: "funcionCerrada" });
        return;
      case "funcion-sin-cupo":
        setConfirmacion({ tipo: "sinCupo" });
        return;
      case "demasiados-pedidos":
        setConfirmacion({ tipo: "esperando", restante: problema.retryAfterSegundos ?? 60 });
        return;
      case "pedido-invalido": {
        const deSeleccion: string[] = [];
        const generales: string[] = [];
        for (const [campo, mensajes] of Object.entries(problema.errors)) {
          (campo.toLowerCase() === "asientos" ? deSeleccion : generales).push(...mensajes);
        }
        if (deSeleccion.length === 0 && generales.length === 0) {
          generales.push("Revisá las butacas elegidas y probá de nuevo.");
        }
        setConfirmacion({ tipo: "invalido", seleccion: deSeleccion, generales });
        return;
      }
      case "desafio-rechazado":
      case "carrito-no-encontrado":
      case "carrito-no-activo":
      case "desconocido":
      case "red":
        setConfirmacion({ tipo: "errorGenerico", sinConexion: tipo === "red" });
        return;
      default: {
        const exhaustivo: never = tipo;
        return exhaustivo;
      }
    }
  }

  async function alConfirmar() {
    const enviadas = estadoActual.current.seleccion;
    if (enCurso.current || enviadas.length === 0) return;
    enCurso.current = true;
    setListoParaReintentar(false);
    setConfirmacion({ tipo: "enviando" });
    try {
      const resultado = await confirmar(enviadas);
      if (resultado.tipo === "problema") await resolverProblema(resultado.problema, enviadas);
      else if (resultado.tipo === "sinAlmacenamiento")
        setConfirmacion({ tipo: "sinAlmacenamiento" });
    } finally {
      enCurso.current = false;
    }
  }

  const resumen =
    seleccion.length === 0
      ? "Todavía no elegiste butacas."
      : `${seleccion.length} ${seleccion.length === 1 ? "butaca elegida" : "butacas elegidas"}: ${seleccion.map(etiquetaButaca).join(", ")}.`;
  const nota = estado.limiteAlcanzado
    ? `Llegaste al máximo de ${MAX_BUTACAS_POR_COMPRA} butacas por compra.`
    : listoParaReintentar
      ? "Ya podés volver a intentar."
      : "";
  const botonDeshabilitado =
    seleccion.length === 0 || confirmacion.tipo === "enviando" || esperando || cerrada;
  const sinConfirmacion = ocultarConfirmacion?.(seleccion) ?? false;

  return (
    <div className={estilos.selector}>
      <section aria-labelledby="titulo-sala" className={estilos.sala}>
        <h2 id="titulo-sala" className="visualmente-oculto">
          Sala
        </h2>
        <MapaButacas
          filas={estado.filas}
          seleccion={seleccion}
          salaNombre={mapa.salaNombre}
          bloqueado={cerrada}
          onAlternar={alternar}
        />
      </section>

      <section aria-labelledby="titulo-seleccion" className={`sombra-dura ${estilos.panel}`}>
        <h2 id="titulo-seleccion" className="h3">
          Tu selección
        </h2>

        {completa ? (
          <div className={estilos.completa}>
            <p>No quedan butacas libres para esta función.</p>
            <Link href={horarios} className="boton-secundario">
              Ver otros horarios
            </Link>
          </div>
        ) : (
          <>
            <div
              role="status"
              className={estilos.resumen}
              aria-describedby={confirmacion.tipo === "invalido" ? ID_MENSAJES : undefined}
            >
              <p>{resumen}</p>
              {seleccion.length > 0 && (
                <p className={estilos.total}>
                  <span className="label">Total</span>{" "}
                  <span className="counter">
                    {total ? formatearPrecio(total) : "Total no disponible"}
                  </span>
                </p>
              )}
              {nota && <p className={estilos.nota}>{nota}</p>}
            </div>

            <Aviso
              confirmacion={confirmacion}
              salida={salida}
              textoError={textoError}
              cintaSinConexion={cintaSinConexion}
              onReintentar={alConfirmar}
              onActualizarMapa={() =>
                confirmacion.tipo === "conflicto" && refrescarMapa(() => confirmacion.mensaje, [])
              }
            />

            <div className={estilos.acciones}>
              {!sinConfirmacion && (
                <button
                  type="button"
                  className="boton-primario"
                  disabled={botonDeshabilitado}
                  aria-describedby={esperando ? "espera-reintento" : undefined}
                  onClick={alConfirmar}
                >
                  {confirmacion.tipo === "enviando" ? textoEnviando : textoBoton(seleccion.length)}
                </button>
              )}
              {confirmacion.tipo === "esperando" && (
                <p id="espera-reintento" className={estilos.espera}>
                  Podés volver a intentar en{" "}
                  <span className="counter">{confirmacion.restante}</span> s
                </p>
              )}
              {ayuda?.(seleccion)}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

type PropsAviso = {
  confirmacion: EstadoConfirmacion;
  salida: { href: string; texto: string };
  textoError: string;
  cintaSinConexion: boolean;
  onReintentar: () => void;
  onActualizarMapa: () => void;
};

/** Un aviso por resultado de la confirmación: qué pasó y qué se puede hacer (DESIGN.md §10). */
function Aviso({
  confirmacion,
  salida,
  textoError,
  cintaSinConexion,
  onReintentar,
  onActualizarMapa,
}: PropsAviso) {
  switch (confirmacion.tipo) {
    case "inactivo":
    case "enviando":
      return null;
    case "sinAlmacenamiento":
      return (
        <div role="alert" className={estilos.aviso}>
          <p>
            Tu navegador no deja guardar el carrito en esta pestaña. Probá en una ventana normal,
            sin modo privado.
          </p>
        </div>
      );
    case "conflicto":
      return (
        <div role="alert" className={estilos.aviso}>
          <p>{confirmacion.mensaje}</p>
          {confirmacion.refrescando && <p className={estilos.detalle}>Actualizando el mapa…</p>}
          {confirmacion.refrescoFallo && (
            <>
              <p className={estilos.detalle}>No pudimos actualizar el mapa.</p>
              <button type="button" className="boton-secundario" onClick={onActualizarMapa}>
                Actualizar mapa
              </button>
            </>
          )}
        </div>
      );
    case "funcionCerrada":
      return (
        <div role="alert" className={estilos.aviso}>
          <p>Esta función ya no está disponible. Elegí otro horario.</p>
          <Link href={salida.href} className="boton-secundario">
            {salida.texto}
          </Link>
        </div>
      );
    case "sinCupo":
      return (
        <div role="alert" className={estilos.aviso}>
          <p>
            Hay muchas butacas reservadas en esta función ahora. Probá de nuevo en unos minutos.
          </p>
        </div>
      );
    case "esperando":
      return (
        <div role="alert" className={estilos.aviso}>
          <p>
            Hubo muchos intentos seguidos desde tu conexión. Esperá un momento para volver a probar.
          </p>
        </div>
      );
    case "invalido":
      return (
        <div role="alert" className={estilos.aviso}>
          {confirmacion.seleccion.length > 0 && (
            <ul id={ID_MENSAJES} className={estilos.mensajes}>
              {confirmacion.seleccion.map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          )}
          {confirmacion.generales.map((mensaje) => (
            <p key={mensaje}>{mensaje}</p>
          ))}
        </div>
      );
    case "errorGenerico":
      return (
        <div role="alert" className={estilos.aviso}>
          {cintaSinConexion && confirmacion.sinConexion && (
            <span aria-hidden="true" className={`cinta-peligro ${estilos.cinta}`} />
          )}
          <p>{textoError}</p>
          <button type="button" className="boton-secundario" onClick={onReintentar}>
            Reintentar
          </button>
        </div>
      );
  }
}
