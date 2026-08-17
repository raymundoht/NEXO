import { describe, expect, it } from "vitest";
import {
  detectBrandingImage,
  resolveStoredBrandingPath
} from "@/lib/branding";

describe("branding uploads", () => {
  it("detecta la firma real y no confía en el nombre del archivo", () => {
    expect(
      detectBrandingImage(Buffer.from("89504e470d0a1a0a0000", "hex"))
    ).toEqual({ extension: "png", mime: "image/png" });
    expect(() => detectBrandingImage(Buffer.from("<script>alert(1)</script>"))).toThrow();
  });

  it("sólo resuelve archivos directos del directorio de branding", () => {
    expect(resolveStoredBrandingPath("/uploads/branding/logo-safe.png")).toMatch(
      /uploads\/branding\/logo-safe\.png$/
    );
    expect(resolveStoredBrandingPath("../.env")).toBeNull();
    expect(resolveStoredBrandingPath("/uploads/branding/../../.env")).toBeNull();
    expect(resolveStoredBrandingPath("/otro/logo.png")).toBeNull();
  });
});
