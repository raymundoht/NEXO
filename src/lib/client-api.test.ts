import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/client-api";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("muestra el mensaje estructurado del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "CONFLICT", message: "La caja ya fue cerrada." }
          }),
          { status: 409, headers: { "content-type": "application/json" } }
        )
      )
    );
    await expect(apiFetch("/api/test")).rejects.toThrow(
      "La caja ya fue cerrada."
    );
  });

  it("conserva texto de errores que no son JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Proxy indisponible", { status: 502 }))
    );
    await expect(apiFetch("/api/test")).rejects.toThrow("Proxy indisponible");
  });

  it("no fija content-type al enviar FormData", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { uploaded: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.set("type", "logo");
    await apiFetch("/api/upload", { method: "POST", body });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).not.toHaveProperty("content-type");
  });
});
