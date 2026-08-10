import { z } from "zod";
import { Prisma, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  assertTrustedOrigin,
  clientIp,
  hashIdentifier,
  hashOneTimeCode,
  safeHashMatches
} from "@/lib/security";
import {
  REGISTRATION_MAX_ATTEMPTS,
  selfRegistrationEnabled
} from "@/lib/registration";

const schema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/)
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
    const pending = await db.registrationVerification.findUnique({
      where: { id: input.challengeId }
    });
    const now = new Date();

    if (!pending || pending.expiresAt <= now) {
      if (pending) {
        await db.registrationVerification.deleteMany({ where: { id: pending.id } });
      }
      throw new ApiError(
        400,
        "El código venció. Solicita uno nuevo.",
        "VERIFICATION_EXPIRED"
      );
    }
    if (pending.attempts >= REGISTRATION_MAX_ATTEMPTS) {
      throw new ApiError(
        429,
        "Se agotaron los intentos. Solicita un código nuevo.",
        "VERIFICATION_LOCKED"
      );
    }

    const submittedHash = hashOneTimeCode(pending.id, input.code);
    if (!safeHashMatches(submittedHash, pending.codeHash)) {
      await db.registrationVerification.updateMany({
        where: {
          id: pending.id,
          attempts: { lt: REGISTRATION_MAX_ATTEMPTS }
        },
        data: { attempts: { increment: 1 } }
      });
      throw new ApiError(
        400,
        "El código es incorrecto.",
        "INVALID_VERIFICATION_CODE"
      );
    }

    const user = await db.$transaction(
      async (tx) => {
        const consumed = await tx.registrationVerification.deleteMany({
          where: {
            id: pending.id,
            codeHash: pending.codeHash,
            expiresAt: { gt: now },
            attempts: { lt: REGISTRATION_MAX_ATTEMPTS }
          }
        });
        if (consumed.count !== 1) {
          throw new ApiError(
            409,
            "El código ya fue utilizado. Inicia sesión.",
            "VERIFICATION_ALREADY_USED"
          );
        }
        return tx.user.create({
          data: {
            email: pending.email,
            name: pending.name,
            passwordHash: pending.passwordHash,
            role: pending.role,
            status: UserStatus.PENDING_APPROVAL
          },
          select: { id: true, email: true, name: true, role: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const ip = clientIp(request);
    await audit({
      userId: user.id,
      action: "AUTH_REGISTRATION_COMPLETED",
      entityType: "User",
      entityId: user.id,
      ip,
      metadata: { role: user.role, emailHash: hashIdentifier(user.email) }
    });

    return jsonOk({
      message: "Correo verificado. Tu cuenta está pendiente de aprobación administrativa.",
      email: user.email
    });
  } catch (error) {
    return jsonError(error);
  }
}
