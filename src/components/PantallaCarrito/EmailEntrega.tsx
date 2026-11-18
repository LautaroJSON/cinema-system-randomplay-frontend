"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react";
import { validarEmail } from "@/domain/email";
import { AvisoOperacion } from "./AvisoOperacion";
import estilos from "./EmailEntrega.module.css";

/** Lo que necesita mostrar el formulario; la pantalla resuelve el resto de los casos. */
export type ResultadoEmail =
  | { tipo: "guardado" }
  | { tipo: "invalido"; campo: string[]; generales: string[] }
  | { tipo: "fallo"; sinConexion: boolean }
  /** La pantalla cambió de vista (credencial perdida, carrito cerrado): no hay nada que mostrar. */
  | { tipo: "resuelto" };

/** Para que la pantalla lleve al comprador al campo cuando falta el email (research P10). */
export type ControlEmail = { editar: () => void };

type Props = {
  emailGuardado: string | null;
  guardar: (email: string) => Promise<ResultadoEmail>;
  controlRef?: Ref<ControlEmail>;
  /** Con el pago en curso el email queda fijo (FR-025). */
  soloLectura?: boolean;
  /** Avisa si el formulario está abierto, para que "Pagar" no compita con "Guardar email". */
  alCambiarEdicion?: (editando: boolean) => void;
  /** Después de guardar, la pantalla lleva el foco al paso siguiente: el pago. */
  alGuardar?: () => void;
};

type Envio =
  | { tipo: "listo" }
  | { tipo: "guardando" }
  | { tipo: "invalido"; campo: string[]; generales: string[] }
  | { tipo: "fallo"; sinConexion: boolean };

export function EmailEntrega({
  emailGuardado,
  guardar,
  controlRef,
  soloLectura = false,
  alCambiarEdicion,
  alGuardar,
}: Props) {
  const [texto, setTexto] = useState(emailGuardado ?? "");
  const [editando, setEditando] = useState(emailGuardado === null);
  const [envio, setEnvio] = useState<Envio>({ tipo: "listo" });
  const [guardados, setGuardados] = useState(0);
  const enCurso = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  const idError = useId();
  const [pedidosFoco, setPedidosFoco] = useState(0);

  useImperativeHandle(controlRef, () => ({
    editar() {
      if (emailGuardado !== null && !editando) {
        setTexto(emailGuardado);
        setEditando(true);
      }
      setPedidosFoco((n) => n + 1);
    },
  }));

  const formularioAbierto = !soloLectura && (emailGuardado === null || editando);
  useEffect(() => {
    alCambiarEdicion?.(formularioAbierto);
  }, [formularioAbierto, alCambiarEdicion]);

  // El campo puede no existir todavía al pedir el foco: se enfoca después de mostrarlo.
  useEffect(() => {
    if (pedidosFoco > 0) campo.current?.focus();
  }, [pedidosFoco]);

  // El formulario que tenía el foco desaparece: la pantalla lo lleva al pago.
  useEffect(() => {
    if (guardados > 0) alGuardar?.();
  }, [guardados, alGuardar]);

  async function enviar() {
    if (enCurso.current) return;
    const validado = validarEmail(texto);
    if (!validado.ok) {
      setEnvio({ tipo: "invalido", campo: [validado.mensaje], generales: [] });
      campo.current?.focus();
      return;
    }
    enCurso.current = true;
    setEnvio({ tipo: "guardando" });
    try {
      const resultado = await guardar(validado.email);
      if (resultado.tipo === "guardado") {
        setTexto(validado.email);
        setEditando(false);
        setEnvio({ tipo: "listo" });
        setGuardados((n) => n + 1);
      } else if (resultado.tipo === "resuelto") {
        setEnvio({ tipo: "listo" });
      } else {
        setEnvio(resultado);
        if (resultado.tipo === "invalido" && resultado.campo.length > 0) campo.current?.focus();
      }
    } finally {
      enCurso.current = false;
    }
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar();
  }

  const mensajesCampo = envio.tipo === "invalido" ? envio.campo : [];
  const guardando = envio.tipo === "guardando";

  if (soloLectura) {
    return (
      <section aria-labelledby={idTitulo} className={estilos.seccion}>
        <h2 id={idTitulo} className="h3">
          Email de entrega
        </h2>
        <p>
          Te mandamos las entradas a <strong className={estilos.email}>{emailGuardado}</strong>.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={idTitulo} className={estilos.seccion}>
      <h2 id={idTitulo} className="h3">
        Email de entrega
      </h2>

      {emailGuardado !== null && !editando ? (
        // Una línea, sin recuadro ni botón: el email ya está resuelto y la acción que sigue es
        // Pagar. Cambiarlo es la excepción, así que va como texto subrayado al final.
        <p className={estilos.guardado}>
          Te mandamos las entradas a <strong className={estilos.email}>{emailGuardado}</strong>{" "}
          cuando pagues.{" "}
          <button
            type="button"
            className={estilos.cambiar}
            onClick={() => {
              setTexto(emailGuardado);
              setEditando(true);
            }}
          >
            Me equivoqué, cambiar email
          </button>
        </p>
      ) : (
        <form noValidate onSubmit={alEnviar} className={estilos.formulario}>
          <label htmlFor={`${idTitulo}-campo`} className={estilos.etiqueta}>
            Email para recibir las entradas
          </label>
          <input
            ref={campo}
            id={`${idTitulo}-campo`}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            aria-invalid={mensajesCampo.length > 0 ? true : undefined}
            aria-describedby={mensajesCampo.length > 0 ? idError : undefined}
            className={estilos.campo}
          />
          {mensajesCampo.length > 0 && (
            <p id={idError} className={estilos.error}>
              {mensajesCampo.join(" ")}
            </p>
          )}
          {envio.tipo === "invalido" && envio.generales.length > 0 && (
            <AvisoOperacion>
              {envio.generales.map((mensaje) => (
                <p key={mensaje}>{mensaje}</p>
              ))}
            </AvisoOperacion>
          )}
          {envio.tipo === "fallo" && (
            <AvisoOperacion sinConexion={envio.sinConexion} onReintentar={() => void enviar()}>
              <p>No pudimos guardar el email.</p>
              <p>
                {envio.sinConexion
                  ? "Parece que no hay conexión. Revisala y probá de nuevo."
                  : "Probá de nuevo en un momento."}
              </p>
            </AvisoOperacion>
          )}
          <button type="submit" className="boton-primario" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar email"}
          </button>
        </form>
      )}
      {/* Siempre montada, para que el aviso de guardado se anuncie. */}
      <p role="status" className="visualmente-oculto">
        {guardados > 0 && !editando ? "Guardamos tu email." : ""}
      </p>
    </section>
  );
}
