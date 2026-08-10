import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertTrustedOrigin,
  hashPassword,
  hashToken,
  verifyPassword
} from "@/lib/security";
import { strongPassword } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { requireUser, sessionCookieName } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requireUser();
    const input = schema.parse(await readJson(request));

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    });
    if (!dbUser) {
      throw new ApiError(404, "Usuario no encontrado.", "NOT_FOUND");
    }

    const matches = await verifyPassword(dbUser.passwordHash, input.currentPassword);
    if (!matches) {
      throw new ApiError(
        401,
        "La contraseña actual es incorrecta.",
        "INVALID_CURRENT_PASSWORD"
      );
    }

    const newHash = await hashPassword(input.newPassword);

    // Get current session token hash to preserve it
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(sessionCookieName)?.value;
    const currentTokenHash = rawToken ? hashToken(rawToken) : null;

    await db.$transaction(async (tx) => {
      // Update the password
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          failedLoginAttempts: 0,
          firstFailedAt: null,
          lockedUntil: null
        }
      });

      // Revoke all other sessions (keep current)
      await tx.session.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          ...(currentTokenHash
            ? { tokenHash: { not: currentTokenHash } }
            : {})
        },
        data: { revokedAt: new Date() }
      });
    });

    await audit({
      userId: user.id,
      action: "AUTH_PASSWORD_CHANGE",
      entityType: "User",
      entityId: user.id
    });

    return jsonOk({
      message: "Contraseña actualizada correctamente. Las demás sesiones fueron cerradas."
    });
  } catch (error) {
    return jsonError(error);
  }
}
