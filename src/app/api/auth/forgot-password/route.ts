import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertTrustedOrigin,
  clientIp,
  hashIdentifier,
  generateNumericCode,
  hashOneTimeCode,
  normalizeEmail
} from "@/lib/security";
import { sendPasswordResetCodeEmail, verifyEmailDelivery } from "@/lib/mailer";
import { randomUUID } from "crypto";

const schema = z.object({
  email: z.string().email().max(320)
});

const genericResponse = {
  message:
    "Si el correo existe y está activo, recibirás un código de 6 dígitos con vigencia de 30 minutos."
};

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const input = schema.parse(await readJson(request));
    const email = normalizeEmail(input.email);
    const ip = clientIp(request);
    const ipHash = hashIdentifier(ip);
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    if (ipHash) {
      const recentRequests = await db.authAttempt.count({
        where: {
          ipHash,
          createdAt: { gte: windowStart }
        }
      });
      if (recentRequests >= 10) {
        throw new ApiError(
          429,
          "Demasiadas solicitudes. Espera 15 minutos.",
          "RATE_LIMITED"
        );
      }
      await db.authAttempt.create({
        data: { normalizedEmail: email, ipHash, success: false }
      });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user || user.status !== "ACTIVE") {
      return jsonOk(genericResponse);
    }

    const recentToken = await db.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - 60_000) }
      },
      select: { id: true }
    });
    if (recentToken) return jsonOk(genericResponse);

    await verifyEmailDelivery().catch(() => {
      throw new ApiError(
        503,
        "El correo no está disponible en este momento. Revisa la configuración SMTP.",
        "EMAIL_UNAVAILABLE"
      );
    });

    const code = generateNumericCode();
    const tokenId = randomUUID();
    const [, created] = await db.$transaction([
      db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      db.passwordResetToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          tokenHash: hashOneTimeCode(tokenId, code),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      })
    ]);

    try {
      await sendPasswordResetCodeEmail({
        to: user.email,
        name: user.name,
        code
      });
    } catch {
      await db.passwordResetToken.updateMany({
        where: { id: created.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      throw new ApiError(
        503,
        "No fue posible enviar el correo de recuperación. Intenta nuevamente.",
        "EMAIL_DELIVERY_FAILED"
      );
    }

    return jsonOk(genericResponse);
  } catch (error) {
    return jsonError(error);
  }
}
