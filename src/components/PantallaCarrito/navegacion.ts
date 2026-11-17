/**
 * Lleva al comprador a la pasarela real en la misma pestaña: la credencial del carrito vive en el
 * `sessionStorage` de esta pestaña y tiene que seguir ahí cuando vuelva (research P4).
 */
export function irAUrlExterna(url: string): void {
  window.location.assign(url);
}
