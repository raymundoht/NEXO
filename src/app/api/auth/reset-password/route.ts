import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertTrustedOrigin,
  hashPassword,
  hashToken
} from "@/lib/security";
import { strongPassword } from "@/lib/validators";
import { audit } from "@/lib/audit";

import { normalizeEmail } from "@/lib/security";

const schema = z.object({
  email: z.string().email().max(320),
  code: z.string().length(6).regex(/^\d+$/),
  password: strongPassword
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const input = schema.parse(await readJson(request));
    const email = normalizeEmail(input.email);
    const user = await db.user.findUnique({ where: { email } });

    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(400, "El código es inválido o expiró.", "INVALID_RESET_CODE");
    }

    const tokenHash = hashToken(input.code);
    const token = await db.passwordResetToken.findFirst({
      where: { tokenHash, userId: user.id }
    });

    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "El código es inválido o expiró.",
        "INVALID_RESET_CODE"
      );
    }

    const passwordHash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: { usedAt: new Date() }
      });
      if (consumed.count !== 1) {
        throw new ApiError(
          400,
          "El código es inválido o expiró.",
          "INVALID_RESET_CODE"
        );
      }

      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          firstFailedAt: null,
          lockedUntil: null
        }
      });
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });

    await audit({
      userId: token.userId,
      action: "AUTH_PASSWORD_RESET",
      entityType: "User",
      entityId: token.userId
    });
    return jsonOk({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (error) {
    return jsonError(error);
  }
}
