import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pedirDesdeNavegador } from "@/api/navegador";
import { problemaCarrito } from "../../fixtures";
import { server } from "../../msw/setup";

const URL_RELATIVA = "http://localhost:3000/api/x";

// MSW no conserva `cache` en el Request que intercepta: se mira lo que recibe `fetch`.
const opcionesDeFetch = () => vi.mocked(globalThis.fetch).mock.calls[0]?.[1];

describe("pedirDesdeNavegador", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("pide a la URL relativa, sin caché y sin Authorization si no hay token", async () => {
    let pedido: Request | undefined;
    server.use(
      http.get(URL_RELATIVA, ({ request }) => {
        pedido = request;
        return HttpResponse.json({ ok: true });
      }),
    );
    vi.spyOn(globalThis, "fetch");
    const resultado = await pedirDesdeNavegador<{ ok: boolean }>("/api/x");
    expect(resultado).toMatchObject({ ok: true, datos: { ok: true } });
    expect(opcionesDeFetch()?.cache).toBe("no-store");
    expect(pedido?.headers.get("Authorization")).toBeNull();
  });

  it("envía el cuerpo JSON y el token como Bearer", async () => {
    let pedido: Request | undefined;
    let cuerpo: unknown;
    server.use(
      http.post(URL_RELATIVA, async ({ request }) => {
        pedido = request;
        cuerpo = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const resultado = await pedirDesdeNavegador("/api/x", {
      metodo: "POST",
      cuerpo: { a: 1 },
      token: "secreto",
    });
    expect(resultado).toMatchObject({ ok: true, datos: undefined });
    expect(pedido?.headers.get("Authorization")).toBe("Bearer secreto");
    expect(pedido?.headers.get("Content-Type")).toBe("application/json");
    expect(cuerpo).toEqual({ a: 1 });
  });

  it("envía PUT con el cuerpo JSON", async () => {
    let metodo: string | undefined;
    let cuerpo: unknown;
    server.use(
      http.put(URL_RELATIVA, async ({ request }) => {
        metodo = request.method;
        cuerpo = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    await pedirDesdeNavegador("/api/x", { metodo: "PUT", cuerpo: { email: "a@b.co" } });
    expect(metodo).toBe("PUT");
    expect(cuerpo).toEqual({ email: "a@b.co" });
  });

  it("lee la hora del servidor del header Date y la hora local de recepción", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T15:00:00Z"));
    const fecha = "Sun, 01 Nov 2026 15:03:00 GMT";
    server.use(http.get(URL_RELATIVA, () => HttpResponse.json({}, { headers: { Date: fecha } })));
    const resultado = await pedirDesdeNavegador("/api/x");
    expect(resultado.horaServidorMs).toBe(Date.parse(fecha));
    expect(resultado.recibidoEnMs).toBe(Date.parse("2026-11-01T15:00:00Z"));
  });

  it("sin header Date, o con uno ilegible, la hora del servidor es null", async () => {
    server.use(http.get(URL_RELATIVA, () => HttpResponse.json({})));
    expect((await pedirDesdeNavegador("/api/x")).horaServidorMs).toBeNull();
    server.use(
      http.get(URL_RELATIVA, () => HttpResponse.json({}, { headers: { Date: "ayer a la tarde" } })),
    );
    expect((await pedirDesdeNavegador("/api/x")).horaServidorMs).toBeNull();
  });

  it("un error con respuesta también trae la hora del servidor; uno de red no", async () => {
    const fecha = "Sun, 01 Nov 2026 15:03:00 GMT";
    server.use(
      http.get(
        URL_RELATIVA,
        () => new HttpResponse(null, { status: 401, headers: { Date: fecha } }),
      ),
    );
    const conRespuesta = await pedirDesdeNavegador("/api/x", { token: "secreto" });
    expect(conRespuesta).toMatchObject({ ok: false, horaServidorMs: Date.parse(fecha) });
    server.use(http.get(URL_RELATIVA, () => HttpResponse.error()));
    expect((await pedirDesdeNavegador("/api/x")).horaServidorMs).toBeNull();
  });

  it("devuelve el problema de un error de negocio", async () => {
    server.use(
      http.post(URL_RELATIVA, () =>
        HttpResponse.json(problemaCarrito(409, "funcion-sin-cupo"), {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        }),
      ),
    );
    const resultado = await pedirDesdeNavegador("/api/x", { metodo: "POST", token: "secreto" });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.problema.tipo).toBe("funcion-sin-cupo");
    expect(resultado.problema.status).toBe(409);
    expect(JSON.stringify(resultado)).not.toContain("secreto");
  });

  it("clasifica un fallo de red como red, sin status", async () => {
    server.use(http.get(URL_RELATIVA, () => HttpResponse.error()));
    const resultado = await pedirDesdeNavegador("/api/x");
    expect(resultado).toMatchObject({ ok: false, problema: { tipo: "red" } });
    if (!resultado.ok) expect(resultado.problema.status).toBeUndefined();
  });

  it("clasifica un timeout como red", async () => {
    server.use(
      http.get(URL_RELATIVA, async () => {
        await delay(200);
        return HttpResponse.json({ ok: true });
      }),
    );
    const resultado = await pedirDesdeNavegador("/api/x", { timeoutMs: 20 });
    expect(resultado).toMatchObject({ ok: false, problema: { tipo: "red" } });
  });
});
