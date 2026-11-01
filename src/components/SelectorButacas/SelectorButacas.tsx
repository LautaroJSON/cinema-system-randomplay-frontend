"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { obtenerMapaDesdeNavegador, type MapaFuncion } from "@/api/asientos";
import { abandonarCarrito, crearCarrito } from "@/api/carritos";
import type { Problema } from "@/api/problema";
import { MapaButacas } from "@/components/MapaButacas/MapaButacas";
import { MAX_BUTACAS_POR_COMPRA } from "@/config/experiencia";
import {
  buscarButaca,
  estadoInicial,
  etiquetaButaca,
  listarAsientos,
  reducirSeleccion,
  type Asiento,
} from "@/domain/butacas";
import { multiplicar } from "@/domain/dinero";
import { formatearPrecio } from "@/domain/formato";
import {
  almacenamientoDisponible,
  descartarSesion,
  guardarSesion,
  leerSesion,
} from "@/domain/sesion-carrito";
import estilos from "./SelectorButacas.module.css";

type EstadoConfirmacion =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "sinAlmacenamiento" }
  | { tipo: "conflicto"; mensaje: string; refrescando: boolean; refrescoFallo: boolean }
  | { tipo: "funcionCerrada" }
  | { tipo: "sinCupo" }
  | { tipo: "esperando"; restante: number }
  | { tipo: "invalido"; seleccion: string[]; generales: string[] }
  | { tipo: "errorGenerico" };

/** Avisos que desaparecen en cuanto el comprador cambia la selección. */
const AVISOS_PASAJEROS = new Set<EstadoConfirmacion["tipo"]>([
  "sinAlmacenamiento",
  "sinCupo",
  "invalido",
  "errorGenerico",
]);

const ID_MENSAJES = "mensajes-seleccion";

function textoBoton(cantidad: number): string {
  if (cantidad === 0) return "Confirmar butacas";
  return cantidad === 1 ? "Confirmar 1 butaca" : `Confirmar ${cantidad} butacas`;
}

function avisoPerdidas(perdidas: Asiento[]): string {
  if (perdidas.length === 0) {
    return "Alguien tomó una de tus butacas antes que vos. Actualizamos el mapa; elegí otra.";
  }
  const otra = perdidas.length === 1 ? "otra" : "otras";
  return `Alguien tomó ${listarAsientos(perdidas)} antes que vos. Actualizamos el mapa; elegí ${otra}.`;
}

export function SelectorButacas({ mapa }: { mapa: MapaFuncion }) {
  const router = useRouter();
  const [estado, despachar] = useReducer(reducirSeleccion, mapa.filas, estadoInicial);
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
  const completa = mapa.cantidadDisponibles === 0 && seleccion.length === 0;
  const total = multiplicar(mapa.precioEntrada, seleccion.length);
  const horarios = `/peliculas/${mapa.peliculaId}#titulo-horarios`;

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
    const nuevas = resultado.datos.filas;
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
        setConfirmacion({ tipo: "errorGenerico" });
        return;
      default: {
        const exhaustivo: never = tipo;
        return exhaustivo;
      }
    }
  }

  async function confirmar() {
    const enviadas = estadoActual.current.seleccion;
    if (enCurso.current || enviadas.length === 0) return;
    enCurso.current = true;
    setListoParaReintentar(false);
    setConfirmacion({ tipo: "enviando" });
    try {
      if (!almacenamientoDisponible()) {
        setConfirmacion({ tipo: "sinAlmacenamiento" });
        return;
      }
      // Un carrito nuevo libera el anterior de esta pestaña; si falla, vence solo (FR-032).
      const anterior = leerSesion();
      if (anterior) {
        await abandonarCarrito(anterior.carritoId, anterior.token);
        descartarSesion();
      }

      const resultado = await crearCarrito(mapa.funcionId, enviadas);
      if (!resultado.ok) {
        await resolverProblema(resultado.problema, enviadas);
        return;
      }
      const { token, tokenVenceEn, carrito } = resultado.datos;
      if (!guardarSesion({ version: 1, carritoId: carrito.id, token, tokenVenceEn, carrito })) {
        // Sin dónde guardar la credencial el carrito queda inaccesible: se libera enseguida.
        await abandonarCarrito(carrito.id, token);
        setConfirmacion({ tipo: "sinAlmacenamiento" });
        return;
      }
      router.push(`/carritos/${carrito.id}`);
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
              horarios={horarios}
              onReintentar={confirmar}
              onActualizarMapa={() =>
                confirmacion.tipo === "conflicto" && refrescarMapa(() => confirmacion.mensaje, [])
              }
            />

            <div className={estilos.acciones}>
              <button
                type="button"
                className="boton-primario"
                disabled={botonDeshabilitado}
                aria-describedby={esperando ? "espera-reintento" : undefined}
                onClick={confirmar}
              >
                {confirmacion.tipo === "enviando"
                  ? "Reservando butacas…"
                  : textoBoton(seleccion.length)}
              </button>
              {confirmacion.tipo === "esperando" && (
                <p id="espera-reintento" className={estilos.espera}>
                  Podés volver a intentar en{" "}
                  <span className="counter">{confirmacion.restante}</span> s
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

type PropsAviso = {
  confirmacion: EstadoConfirmacion;
  horarios: string;
  onReintentar: () => void;
  onActualizarMapa: () => void;
};

/** Un aviso por resultado de la confirmación: qué pasó y qué se puede hacer (DESIGN.md §10). */
function Aviso({ confirmacion, horarios, onReintentar, onActualizarMapa }: PropsAviso) {
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
          <Link href={horarios} className="boton-secundario">
            Ver otros horarios
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
          <p>No pudimos reservar las butacas. Revisá tu conexión y probá de nuevo.</p>
          <button type="button" className="boton-secundario" onClick={onReintentar}>
            Reintentar
          </button>
        </div>
      );
  }
}
