import { describe, expect, it } from "vitest";
import {
  assertTrustedOrigin,
  generateNumericCode,
  hashOneTimeCode,
  isStrongPassword,
  normalizeEmail,
  safeHashMatches
} from "@/lib/security";

describe("política de contraseñas", () => {
  it("acepta una contraseña con todos los grupos requeridos", () => {
    expect(isStrongPassword("Segura#2026")).toBe(true);
  });

  it.each([
    "Corta#1",
    "sinmayuscula#2026",
    "SINMINUSCULA#2026",
    "SinNumero#",
    "SinSimbolo2026"
  ])("rechaza %s", (password) => {
    expect(isStrongPassword(password)).toBe(false);
  });

  it("normaliza correos antes de consultarlos", () => {
    expect(normalizeEmail("  Persona@Empresa.COM ")).toBe(
      "persona@empresa.com"
    );
  });

  it("genera códigos numéricos de seis dígitos", () => {
    expect(generateNumericCode()).toMatch(/^\d{6}$/);
  });

  it("compara el código sin guardar su valor en texto plano", () => {
    const hash = hashOneTimeCode("b6f08a58-258f-492b-9898-43ba335a7290", "042193");
    expect(safeHashMatches(hash, hash)).toBe(true);
    expect(
      safeHashMatches(
        hashOneTimeCode("b6f08a58-258f-492b-9898-43ba335a7290", "042194"),
        hash
      )
    ).toBe(false);
  });
});

describe("protección de origen", () => {
  it("acepta mutaciones del mismo host", () => {
    const request = new Request("https://erp.example.com/api/products", {
      method: "POST",
      headers: {
        origin: "https://erp.example.com",
        host: "erp.example.com"
      }
    });
    expect(() => assertTrustedOrigin(request)).not.toThrow();
  });

  it("bloquea un origen cruzado", () => {
    const request = new Request("https://erp.example.com/api/products", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "erp.example.com"
      }
    });
    expect(() => assertTrustedOrigin(request)).toThrow();
  });

  it("bloquea esquemas distintos y orígenes malformados", () => {
    const insecure = new Request("https://erp.example.com/api/products", {
      method: "POST",
      headers: { origin: "http://erp.example.com", host: "erp.example.com" }
    });
    const malformed = new Request("https://erp.example.com/api/products", {
      method: "POST",
      headers: { origin: "no-es-url", host: "erp.example.com" }
    });
    expect(() => assertTrustedOrigin(insecure)).toThrow();
    expect(() => assertTrustedOrigin(malformed)).toThrow();
  });
});
