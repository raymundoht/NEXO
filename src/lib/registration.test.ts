import { afterEach, describe, expect, it } from "vitest";
import {
  allowedRegistrationDomains,
  isRegistrationEmailAllowed,
  selfRegistrationEnabled
} from "@/lib/registration";

const originalEnabled = process.env.SELF_REGISTRATION_ENABLED;
const originalDomains = process.env.REGISTRATION_ALLOWED_DOMAINS;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.SELF_REGISTRATION_ENABLED;
  else process.env.SELF_REGISTRATION_ENABLED = originalEnabled;
  if (originalDomains === undefined) delete process.env.REGISTRATION_ALLOWED_DOMAINS;
  else process.env.REGISTRATION_ALLOWED_DOMAINS = originalDomains;
});

describe("registro verificado", () => {
  it("respeta el interruptor de registro", () => {
    process.env.SELF_REGISTRATION_ENABLED = "false";
    expect(selfRegistrationEnabled()).toBe(false);
    process.env.SELF_REGISTRATION_ENABLED = "true";
    expect(selfRegistrationEnabled()).toBe(true);
  });

  it("normaliza y limita dominios configurados", () => {
    process.env.REGISTRATION_ALLOWED_DOMAINS = " @empresa.mx, ESCUELA.EDU ";
    expect(allowedRegistrationDomains()).toEqual(["empresa.mx", "escuela.edu"]);
    expect(isRegistrationEmailAllowed("persona@empresa.mx")).toBe(true);
    expect(isRegistrationEmailAllowed("persona@otro.mx")).toBe(false);
  });

  it("acepta cualquier correo cuando no hay dominios configurados", () => {
    process.env.REGISTRATION_ALLOWED_DOMAINS = "";
    expect(isRegistrationEmailAllowed("persona@example.com")).toBe(true);
  });
});
