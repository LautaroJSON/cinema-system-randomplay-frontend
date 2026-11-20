import { describe, expect, it } from "vitest";
import { BACKENDS, resolverBackend } from "@/config/backend";

describe("resolverBackend", () => {
  it("elige la URL según BACKEND", () => {
    expect(resolverBackend({ BACKEND: "local" }).url).toBe(BACKENDS.local);
    expect(resolverBackend({ BACKEND: "hosteado" }).url).toBe(BACKENDS.hosteado);
    expect(resolverBackend({ BACKEND: "mock" }).url).toBe(BACKENDS.mock);
  });

  it("deja que API_URL_LOCAL cambie solo la URL de local", () => {
    const propia = { BACKEND: "local", API_URL_LOCAL: "http://localhost:5165/" };
    expect(resolverBackend(propia).url).toBe("http://localhost:5165");
    expect(resolverBackend({ ...propia, BACKEND: "hosteado" }).url).toBe(BACKENDS.hosteado);
  });

  // Los despliegues y los e2e fijan API_URL y no tienen que depender de lo que diga .env.local.
  it("prioriza API_URL sobre BACKEND", () => {
    const resultado = resolverBackend({ API_URL: "http://otro:9000", BACKEND: "hosteado" });
    expect(resultado).toEqual({ url: "http://otro:9000", origen: "API_URL" });
  });

  it("falla si no hay backend elegido, si el nombre no existe o si la URL no es absoluta", () => {
    expect(() => resolverBackend({})).toThrow(/BACKEND=local, hosteado o mock/);
    expect(() => resolverBackend({ BACKEND: "render" })).toThrow(/Opciones: local, hosteado, mock/);
    expect(() => resolverBackend({ BACKEND: "toString" })).toThrow(/no existe/);
    expect(() => resolverBackend({ API_URL: "/api" })).toThrow(/no es una URL absoluta/);
  });
});
