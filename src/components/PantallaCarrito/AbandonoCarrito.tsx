"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AvisoOperacion } from "./AvisoOperacion";
import estilos from "./AbandonoCarrito.module.css";

/** Lo que necesita mostrar el abandono; la pantalla resuelve el resto de los casos. */
export type ResultadoAbandono = { tipo: "hecho" } | { tipo: "fallo"; sinConexion: boolean };

type Paso =
  | { tipo: "inactivo" }
  | { tipo: "confirmando" }
  | { tipo: "abandonando" }
  | { tipo: "fallo"; sinConexion: boolean };

/**
 * La única salida explícita del flujo (FR-030, FR-033). La confirmación aparece en el lugar, sin
 * diálogo modal: no hay trampa de foco y la página sigue en una sola columna (research C11).
 */
export function AbandonoCarrito({ abandonar }: { abandonar: () => Promise<ResultadoAbandono> }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "inactivo" });
  const enCurso = useRef(false);
  const botonAbandonar = useRef<HTMLButtonElement>(null);
  const botonSeguir = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  // Al abrir, el foco va a la opción que no destruye nada; al cerrar, vuelve al botón.
  const abierta = paso.tipo === "confirmando" || paso.tipo === "abandonando";
  const estabaAbierta = useRef(false);
  useEffect(() => {
    if (abierta && !estabaAbierta.current) botonSeguir.current?.focus();
    if (!abierta && estabaAbierta.current && paso.tipo === "inactivo") {
      botonAbandonar.current?.focus();
    }
    estabaAbierta.current = abierta;
  }, [abierta, paso.tipo]);

  async function confirmar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setPaso({ tipo: "abandonando" });
    try {
      const resultado = await abandonar();
      // Con "hecho" la pantalla pasa a modo lectura y este componente se desmonta.
      if (resultado.tipo === "fallo") setPaso(resultado);
    } finally {
      enCurso.current = false;
    }
  }

  /** Escape cierra la confirmación desde cualquiera de sus dos botones, que son los que tienen el foco. */
  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === "Escape" && paso.tipo === "confirmando") {
      evento.preventDefault();
      setPaso({ tipo: "inactivo" });
    }
  }

  return (
    <section aria-labelledby={idTitulo} className={estilos.seccion}>
      <h2 id={idTitulo} className="h3">
        ¿No vas a seguir?
      </h2>
      {abierta ? (
        <div
          role="group"
          aria-label="Confirmar abandono"
          aria-describedby={idTexto}
          className={estilos.confirmacion}
        >
          <p id={idTexto}>
            Si abandonás, liberamos tus butacas ahora y no las vas a poder recuperar.
          </p>
          <div className={estilos.botones}>
            <button
              ref={botonSeguir}
              type="button"
              className="boton-secundario"
              disabled={paso.tipo === "abandonando"}
              onKeyDown={alTeclear}
              onClick={() => setPaso({ tipo: "inactivo" })}
            >
              Seguir con mi carrito
            </button>
            <button
              type="button"
              className={`boton-secundario ${estilos.destructivo}`}
              disabled={paso.tipo === "abandonando"}
              onKeyDown={alTeclear}
              onClick={() => void confirmar()}
            >
              {paso.tipo === "abandonando" ? "Abandonando…" : "Sí, abandonar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {paso.tipo === "fallo" && (
            <AvisoOperacion sinConexion={paso.sinConexion} onReintentar={() => void confirmar()}>
              <p>No pudimos abandonar el carrito.</p>
              <p>
                Tus butacas siguen reservadas hasta que termine el contador.{" "}
                {paso.sinConexion ? "Revisá tu conexión y probá de nuevo." : "Probá de nuevo."}
              </p>
            </AvisoOperacion>
          )}
          <button
            ref={botonAbandonar}
            type="button"
            className="boton-secundario"
            onClick={() => setPaso({ tipo: "confirmando" })}
          >
            Abandonar carrito
          </button>
        </>
      )}
    </section>
  );
}
