// Pasarela de pago simulada del backend: solo existe en Development y Testing.
//
// Única excepción a los tipos generados (Principio I; plan, Complexity Tracking): el backend
// excluye este endpoint de openapi.json (`ApiExplorerSettings(IgnoreApi = true)` en
// `PagosSimuladosController`) para no documentarlo como parte de la API real. Lo usa solo la
// página /carritos/{id}/pago-simulado. Es público: la credencial del carrito no viaja (Principio III).
import { pedirDesdeNavegador, type Resultado } from "./navegador";

export type PedidoPagoSimulado = {
  carritoId: string;
  estado: "Aprobado" | "Rechazado";
  /** Sin monto, el backend usa el total del carrito. Va como número: el backend espera `decimal`. */
  monto?: number;
};

export type PagoSimuladoRegistrado = { pagoId: string; estadoCarrito: string };

export function registrarPagoSimulado(
  pedido: PedidoPagoSimulado,
): Promise<Resultado<PagoSimuladoRegistrado>> {
  return pedirDesdeNavegador<PagoSimuladoRegistrado>("/api/dev/pagos-simulados", {
    metodo: "POST",
    cuerpo: pedido,
  });
}
