import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiError, pedir } from "@/api/client";
import { API } from "../../msw/handlers";
import { server } from "../../msw/setup";

const opciones = { revalidate: 60, tags: ["test"] };

describe("pedir", () => {
  it("devuelve el JSON ante 200", async () => {
    server.use(http.get(`${API}/api/x`, () => HttpResponse.json({ ok: true })));
    await expect(pedir<{ ok: boolean }>("/api/x", opciones)).resolves.toEqual({ ok: true });
  });

  it("devuelve null ante 404", async () => {
    server.use(http.get(`${API}/api/x`, () => new HttpResponse(null, { status: 404 })));
    await expect(pedir("/api/x", opciones)).resolves.toBeNull();
  });

  it("lanza ApiError con el status ante 500", async () => {
    server.use(http.get(`${API}/api/x`, () => new HttpResponse(null, { status: 500 })));
    const error = await pedir("/api/x", opciones).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });

  it("expone el codigo de un problem+json", async () => {
    server.use(
      http.get(`${API}/api/x`, () =>
        HttpResponse.json(
          { status: 409, title: "Conflicto", codigo: "funcion-sin-cupo" },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const error = (await pedir("/api/x", opciones).catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(409);
    expect(error.codigo).toBe("funcion-sin-cupo");
  });

  it("lanza ApiError sin status ante un error de red", async () => {
    server.use(http.get(`${API}/api/x`, () => HttpResponse.error()));
    const error = (await pedir("/api/x", opciones).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeUndefined();
  });

  it("lanza ApiError si el servidor no responde a tiempo", async () => {
    server.use(
      http.get(`${API}/api/x`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const error = (await pedir("/api/x", { ...opciones, timeoutMs: 50 }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeUndefined();
  });
});
