import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertTrustedOrigin,
  hashToken,
  normalizeEmail
} from "@/lib/security";
import { sendPasswordResetCodeEmail, verifyEmailDelivery } from "@/lib/mailer";
import crypto from "crypto";

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
    await verifyEmailDelivery().catch(() => {
      throw new ApiError(
        503,
        "El correo no está disponible en este momento. Revisa la configuración SMTP.",
        "EMAIL_UNAVAILABLE"
      );
    });
    const user = await db.user.findUnique({ where: { email } });

    if (!user || user.status !== "ACTIVE") {
      return jsonOk(genericResponse);
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const [, created] = await db.$transaction([
      db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(code),
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
