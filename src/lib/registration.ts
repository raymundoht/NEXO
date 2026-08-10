import { Role } from "@prisma/client";

export const REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
export const REGISTRATION_RESEND_MS = 60 * 1000;
export const REGISTRATION_MAX_ATTEMPTS = 5;
export const REGISTRATION_IP_LIMIT = 10;

export const SELF_REGISTRATION_ROLE = Role.CASHIER;

export function selfRegistrationEnabled() {
  const configured = process.env.SELF_REGISTRATION_ENABLED;
  if (configured !== undefined) return configured === "true";
  return process.env.NODE_ENV !== "production";
}

export function allowedRegistrationDomains() {
  return (process.env.REGISTRATION_ALLOWED_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isRegistrationEmailAllowed(email: string) {
  const domains = allowedRegistrationDomains();
  if (!domains.length) return true;
  const domain = email.split("@").at(-1)?.toLowerCase();
  return Boolean(domain && domains.includes(domain));
}
