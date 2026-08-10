import { describe, expect, it } from "vitest";
import { cardAuthorization } from "@/lib/validators";

describe("card authorization", () => {
  it("accepts a terminal authorization code", () => {
    expect(cardAuthorization.parse("AUTH-839201")).toBe("AUTH-839201");
  });

  it("rejects a possible card number", () => {
    expect(() => cardAuthorization.parse("4111111111111111")).toThrow();
  });

  it("rejects free text that could contain sensitive notes", () => {
    expect(() => cardAuthorization.parse("autorizado por teléfono")).toThrow();
  });
});
