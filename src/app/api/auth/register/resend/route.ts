import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertTrustedOrigin,
  generateNumericCode,
  hashOneTimeCode,
  hashToken,
  safeHashMatches
} from "@/lib/security";
import { sendRegistrationCodeEmail, verifyEmailDelivery } from "@/lib/mailer";
import {
  REGISTRATION_CODE_TTL_MS,
  REGISTRATION_RESEND_MS,
  selfRegistrationEnabled
} from "@/lib/registration";

const schema = z.object({
  challengeId: z.string().uuid(),
  continuationToken: z.string().min(40).max(100)
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    if (!selfRegistrationEnabled()) {
      throw new ApiError(403, "El registro no está disponible.", "REGISTRATION_DISABLED");
    }
    const input = schema.parse(await readJson(request));
    await verifyEmailDelivery().catch(() => {
      throw new ApiError(
        503,
        "El correo no está disponible en este momento.",
        "EMAIL_UNAVAILABLE"
      );
    });

    const pending = await db.registrationVerification.findUnique({
      where: { id: input.challengeId }
    });
    if (!pending) {
      throw new ApiError(404, "El registro ya no está disponible.", "NOT_FOUND");
    }
    if (!safeHashMatches(hashToken(input.continuationToken), pending.continuationHash)) {
      throw new ApiError(404, "El registro ya no está disponible.", "NOT_FOUND");
    }
    const now = new Date();
    if (pending.resendAt > now) {
      const seconds = Math.ceil((pending.resendAt.getTime() - now.getTime()) / 1000);
      throw new ApiError(
        429,
        `Espera ${seconds} segundos antes de reenviar.`,
        "CODE_COOLDOWN"
      );
    }

    const code = generateNumericCode();
    const codeHash = hashOneTimeCode(pending.id, code);
    const expiresAt = new Date(now.getTime() + REGISTRATION_CODE_TTL_MS);
    const resendAt = new Date(now.getTime() + REGISTRATION_RESEND_MS);
    const claimed = await db.registrationVerification.updateMany({
      where: {
        id: pending.id,
        codeHash: pending.codeHash,
        resendAt: { lte: now }
      },
      data: {
        codeHash,
        attempts: 0,
        expiresAt,
        resendAt,
        lastSentAt: now
      }
    });
    if (claimed.count !== 1) {
      throw new ApiError(
        429,
        "El código ya fue reenviado. Espera antes de intentar otra vez."
      );
    }

    try {
      await sendRegistrationCodeEmail({
        to: pending.email,
        name: pending.name,
        code
      });
    } catch {
      await db.registrationVerification.updateMany({
        where: { id: pending.id, codeHash },
        data: {
          codeHash: pending.codeHash,
          attempts: pending.attempts,
          expiresAt: pending.expiresAt,
          resendAt: pending.resendAt,
          lastSentAt: pending.lastSentAt
        }
      });
      throw new ApiError(
        503,
        "No fue posible reenviar el código.",
        "EMAIL_DELIVERY_FAILED"
      );
    }

    return jsonOk({
      expiresInSeconds: REGISTRATION_CODE_TTL_MS / 1000,
      resendInSeconds: REGISTRATION_RESEND_MS / 1000
    });
  } catch (error) {
    return jsonError(error);
  }
}
