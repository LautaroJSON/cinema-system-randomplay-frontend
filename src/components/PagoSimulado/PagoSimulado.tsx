"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { registrarPagoSimulado, type PedidoPagoSimulado } from "@/api/pagos-simulados";
import { EtiquetaPegada } from "@/components/EtiquetaPegada/EtiquetaPegada";
import { AvisoOperacion } from "@/components/PantallaCarrito/AvisoOperacion";
import { formatearPrecio } from "@/domain/formato";
import { rutaVuelta, validarMontoSimulado } from "@/domain/pago";
import { leerSesionCruda, parsearSesion, suscribirSesion } from "@/domain/sesion-carrito";
import estilos from "./PagoSimulado.module.css";

const SIN_LEER = "sin-leer";

type Opcion = "aprobar" | "rechazar" | "otroMonto";

type Envio =
  | { tipo: "listo" }
  | { tipo: "enviando"; opcion: Opcion }
  | { tipo: "fallo"; pedido: PedidoPagoSimulado; opcion: Opcion; sinConexion: boolean };

/**
 * Pasarela simulada de desarrollo (spec 005, US2): reemplaza la página de Mercado Pago para
 * probar el flujo sin credenciales. Cada opción registra el pago en el backend, sin la credencial
 * del carrito, y vuelve a la página de vuelta como haría la pasarela real.
 */
export function PagoSimulado({ carritoId }: { carritoId: string }) {
  const router = useRouter();
  const crudo = useSyncExternalStore(suscribirSesion, leerSesionCruda, () => SIN_LEER);
  const sesion = useMemo(() => (crudo === SIN_LEER ? null : parsearSesion(crudo)), [crudo]);
  const total = sesion?.carritoId === carritoId ? sesion.carrito.total : null;

  const [monto, setMonto] = useState<string | null>(null);
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [envio, setEnvio] = useState<Envio>({ tipo: "listo" });
  const enCurso = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const idError = useId();
  // Precargado con el total de la sesión hasta que se escriba otro.
  const textoMonto = monto ?? total?.monto ?? "";

  async function enviar(pedido: PedidoPagoSimulado, opcion: Opcion) {
    if (enCurso.current) return;
    enCurso.current = true;
    setEnvio({ tipo: "enviando", opcion });
    try {
      const resultado = await registrarPagoSimulado(pedido);
      if (resultado.ok) {
        router.push(rutaVuelta(carritoId));
        return;
      }
      setEnvio({
        tipo: "fallo",
        pedido,
        opcion,
        sinConexion: resultado.problema.tipo === "red",
      });
    } finally {
      enCurso.current = false;
    }
  }

  function pagarOtroMonto() {
    const validado = validarMontoSimulado(textoMonto);
    if (!validado.ok) {
      setErrorMonto(validado.mensaje);
      campo.current?.focus();
      return;
    }
    setErrorMonto(null);
    void enviar({ carritoId, estado: "Aprobado", monto: validado.monto }, "otroMonto");
  }

  const enviando = envio.tipo === "enviando";
  const texto = (opcion: Opcion, normal: string) =>
    envio.tipo === "enviando" && envio.opcion === opcion ? "Registrando…" : normal;

  return (
    <div className={estilos.vista}>
      {/* Etiqueta real de estado (R-09): esta pantalla no es la pasarela de pago. */}
      <EtiquetaPegada tono="alerta" inclinacion={-1}>
        Simulación de desarrollo
      </EtiquetaPegada>
      <h1 className="h2">Pago simulado</h1>
      <p className={estilos.texto}>
        No se cobra nada. Elegí qué responde la pasarela y volvés a la página de tu pago, como si
        vinieras de Mercado Pago.
      </p>
      {total && (
        <p className={estilos.total}>
          <span className="label">Total del carrito</span>{" "}
          <span className="counter">{formatearPrecio(total)}</span>
        </p>
      )}

      {envio.tipo === "fallo" && (
        <AvisoOperacion
          sinConexion={envio.sinConexion}
          onReintentar={() => void enviar(envio.pedido, envio.opcion)}
        >
          <p>No pudimos registrar el pago simulado.</p>
          <p>
            {envio.sinConexion
              ? "Parece que no hay conexión con el backend. Revisala y probá de nuevo."
              : "Revisá que el backend corra con la pasarela simulada y probá de nuevo."}
          </p>
        </AvisoOperacion>
      )}

      <div className={estilos.opciones}>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando}
          onClick={() => void enviar({ carritoId, estado: "Aprobado" }, "aprobar")}
        >
          {texto("aprobar", "Aprobar pago")}
        </button>
        <button
          type="button"
          className="boton-secundario"
          disabled={enviando}
          onClick={() => void enviar({ carritoId, estado: "Rechazado" }, "rechazar")}
        >
          {texto("rechazar", "Rechazar pago")}
        </button>
      </div>

      <form
        noValidate
        className={estilos.otroMonto}
        onSubmit={(evento) => {
          evento.preventDefault();
          pagarOtroMonto();
        }}
      >
        <label htmlFor={idCampo} className={estilos.etiqueta}>
          Monto a pagar
        </label>
        <p className={estilos.ayuda}>
          Un monto distinto del total no paga el carrito: el backend lo devuelve y el carrito sigue
          esperando el pago.
        </p>
        <input
          ref={campo}
          id={idCampo}
          name="monto"
          inputMode="decimal"
          autoComplete="off"
          value={textoMonto}
          onChange={(evento) => setMonto(evento.target.value)}
          aria-invalid={errorMonto ? true : undefined}
          aria-describedby={errorMonto ? idError : undefined}
          className={estilos.campo}
        />
        {errorMonto && (
          <p id={idError} className={estilos.error}>
            {errorMonto}
          </p>
        )}
        <button type="submit" className="boton-secundario" disabled={enviando}>
          {texto("otroMonto", "Pagar otro monto")}
        </button>
      </form>
    </div>
  );
}
