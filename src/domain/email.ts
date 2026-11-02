// Validación de experiencia del email de entrega: evita un pedido que la API va a rechazar,
// pero la respuesta de la API siempre prevalece (Principio IV).

const LARGO_MAXIMO = 254;
const FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailValidado = { ok: true; email: string } | { ok: false; mensaje: string };

export function validarEmail(texto: string): EmailValidado {
  const email = texto.trim();
  if (email === "") return { ok: false, mensaje: "Escribí tu email." };
  if (email.length > LARGO_MAXIMO) return { ok: false, mensaje: "Revisá el email: es muy largo." };
  if (!FORMATO.test(email)) {
    return { ok: false, mensaje: "Revisá el email: le falta la arroba o el dominio." };
  }
  return { ok: true, email };
}
