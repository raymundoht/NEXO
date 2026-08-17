import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  assertTrustedOrigin,
  clientIp,
  generateNumericCode,
  generateSecureToken,
  hashIdentifier,
  hashOneTimeCode,
  hashPassword,
  hashToken,
  normalizeEmail,
  sanitizeText
} from "@/lib/security";
import { sendRegistrationCodeEmail, verifyEmailDelivery } from "@/lib/mailer";
import { strongPassword } from "@/lib/validators";
import {
  isRegistrationEmailAllowed,
  REGISTRATION_CODE_TTL_MS,
  REGISTRATION_IP_LIMIT,
  REGISTRATION_RESEND_MS,
  SELF_REGISTRATION_ROLE,
  selfRegistrationEnabled
} from "@/lib/registration";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().email().max(320),
  password: strongPassword
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    if (!selfRegistrationEnabled()) {
      throw new ApiError(
        403,
        "El registro de cuentas no está disponible.",
        "REGISTRATION_DISABLED"
      );
    }

    const input = schema.parse(await readJson(request));
    const email = normalizeEmail(input.email);
    if (!isRegistrationEmailAllowed(email)) {
      throw new ApiError(
        403,
        "Usa un correo autorizado por tu organización.",
        "EMAIL_DOMAIN_NOT_ALLOWED"
      );
    }

    await verifyEmailDelivery().catch(() => {
      throw new ApiError(
        503,
        "El correo no está disponible en este momento. Revisa la configuración SMTP.",
        "EMAIL_UNAVAILABLE"
      );
    });

    const now = new Date();
    const ip = clientIp(request);
    const ipHash = hashIdentifier(ip);
    const [user, existing] = await db.$transaction([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      db.registrationVerification.findUnique({ where: { email } })
    ]);
    const requestsFromIp = ipHash
      ? await db.registrationVerification.count({
          where: {
            ipHash,
            lastSentAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) }
          }
        })
      : 0;

    if (user) {
      throw new ApiError(
        409,
        "Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.",
        "EMAIL_ALREADY_REGISTERED"
      );
    }
    if (existing && existing.expiresAt > now) {
      if (existing.resendAt <= now) {
        throw new ApiError(
          409,
          "Ya hay una verificación activa para ese correo. Usa el código enviado o la opción de reenvío.",
          "VERIFICATION_ALREADY_PENDING"
        );
      }
      const seconds = Math.ceil((existing.resendAt.getTime() - now.getTime()) / 1000);
      throw new ApiError(
        429,
        `Espera ${seconds} segundos antes de solicitar otro código.`,
        "CODE_COOLDOWN"
      );
    }
    if (ipHash && requestsFromIp >= REGISTRATION_IP_LIMIT) {
      throw new ApiError(
        429,
        "Demasiadas solicitudes de registro. Espera 15 minutos.",
        "RATE_LIMITED"
      );
    }

    if (existing) {
      await db.registrationVerification.deleteMany({
        where: { id: existing.id, expiresAt: { lte: now } }
      });
    }
    const challengeId = randomUUID();
    const continuationToken = generateSecureToken(32);
    const code = generateNumericCode();
    const codeHash = hashOneTimeCode(challengeId, code);
    const passwordHash = await hashPassword(input.password);
    const name = sanitizeText(input.name, 160);
    const expiresAt = new Date(now.getTime() + REGISTRATION_CODE_TTL_MS);
    const resendAt = new Date(now.getTime() + REGISTRATION_RESEND_MS);

    await db.registrationVerification.create({
      data: {
        id: challengeId,
        email,
        name,
        passwordHash,
        codeHash,
        continuationHash: hashToken(continuationToken),
        role: SELF_REGISTRATION_ROLE,
        attempts: 0,
        ipHash,
        expiresAt,
        resendAt,
        lastSentAt: now
      }
    });

    try {
      await sendRegistrationCodeEmail({ to: email, name, code });
    } catch {
      await db.registrationVerification.deleteMany({
        where: { id: challengeId, codeHash }
      });
      throw new ApiError(
        503,
        "No fue posible enviar el código. Intenta nuevamente.",
        "EMAIL_DELIVERY_FAILED"
      );
    }

    void audit({
      action: "AUTH_REGISTRATION_CODE_SENT",
      entityType: "RegistrationVerification",
      entityId: challengeId,
      ip,
      metadata: { emailHash: hashIdentifier(email) }
    }).catch(console.error);

    return jsonOk({
      challengeId,
      continuationToken,
      email,
      expiresInSeconds: REGISTRATION_CODE_TTL_MS / 1000,
      resendInSeconds: REGISTRATION_RESEND_MS / 1000
    });
  } catch (error) {
    return jsonError(error);
  }
}
