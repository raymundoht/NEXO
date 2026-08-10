import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "node:crypto";
import argon2 from "argon2";
import { ApiError } from "@/lib/api";

export const PASSWORD_POLICY_MESSAGE =
  "Usa al menos 10 caracteres con mayúscula, minúscula, número y carácter especial.";

export function isStrongPassword(password: string) {
  return (
    password.length >= 10 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function assertStrongPassword(password: string) {
  if (!isStrongPassword(password)) {
    throw new ApiError(400, PASSWORD_POLICY_MESSAGE, "WEAK_PASSWORD");
  }
}

export async function hashPassword(password: string) {
  assertStrongPassword(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateSecureToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateNumericCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOneTimeCode(challengeId: string, code: string) {
  const key = process.env.SESSION_HASH_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_HASH_KEY es obligatoria en producción.");
  }
  return createHmac("sha256", key || "nexo-development-only")
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function safeHashMatches(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function hashIdentifier(value: string | null | undefined) {
  if (!value) return null;
  const key = process.env.SESSION_HASH_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_HASH_KEY es obligatoria en producción.");
  }
  return createHmac("sha256", key || "nexo-development-only")
    .update(value)
    .digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

export function assertTrustedOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) {
    throw new ApiError(403, "Origen de solicitud no permitido.", "CSRF_BLOCKED");
  }

  const originHost = new URL(origin).host;
  if (originHost !== host) {
    throw new ApiError(403, "Origen de solicitud no permitido.", "CSRF_BLOCKED");
  }
}

export function sanitizeText(value: string, maxLength = 300) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}
