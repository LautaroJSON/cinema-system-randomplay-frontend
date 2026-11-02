"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
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

type Props = {
  emailGuardado: string | null;
  guardar: (email: string) => Promise<ResultadoEmail>;
};

type Envio =
  | { tipo: "listo" }
  | { tipo: "guardando" }
  | { tipo: "invalido"; campo: string[]; generales: string[] }
  | { tipo: "fallo"; sinConexion: boolean };

export function EmailEntrega({ emailGuardado, guardar }: Props) {
  const [texto, setTexto] = useState(emailGuardado ?? "");
  const [editando, setEditando] = useState(emailGuardado === null);
  const [envio, setEnvio] = useState<Envio>({ tipo: "listo" });
  const [guardados, setGuardados] = useState(0);
  const enCurso = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const tituloQueSigue = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();
  const idTituloQueSigue = useId();
  const idError = useId();

  // Después de guardar, el foco va a "Qué sigue": el formulario que lo tenía desapareció.
  useEffect(() => {
    if (guardados > 0) tituloQueSigue.current?.focus();
  }, [guardados]);

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

  return (
    <section aria-labelledby={idTitulo} className={estilos.seccion}>
      <h2 id={idTitulo} className="h3">
        Email de entrega
      </h2>

      {emailGuardado !== null && !editando ? (
        <section aria-labelledby={idTituloQueSigue} className={`sombra-dura ${estilos.queSigue}`}>
          <h3 id={idTituloQueSigue} ref={tituloQueSigue} tabIndex={-1} className="label">
            Qué sigue
          </h3>
          <p>
            Guardamos tu email: <strong className={estilos.email}>{emailGuardado}</strong>.
          </p>
          <p>
            El pago todavía no está disponible, así que no se emiten ni envían entradas. Tus butacas
            siguen reservadas hasta que termine el contador.
          </p>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => {
              setTexto(emailGuardado);
              setEditando(true);
            }}
          >
            Cambiar email
          </button>
        </section>
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
    </section>
  );
}
