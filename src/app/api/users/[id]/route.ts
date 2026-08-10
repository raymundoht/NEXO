/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role, UserStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, hashPassword } from "@/lib/security";
import { strongPassword } from "@/lib/validators";
import { audit } from "@/lib/audit";

const schema = z.object({
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  password: strongPassword.optional(),
  unlock: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const actor = await requirePermission("users.manage");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    if (actor.id === id && input.status === UserStatus.SUSPENDED) {
      throw new ApiError(400, "No puedes suspender tu propia cuenta.");
    }
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined;

    let previousState: Record<string, any> = {};
    let newState: Record<string, any> = {};

    const user = await db.$transaction(
      async (tx) => {
        const targetUser = await tx.user.findUnique({ where: { id } });
        if (!targetUser) throw new ApiError(404, "Usuario no encontrado.");

        const isRemovingAdmin =
          targetUser.role === "ADMIN" &&
          ((input.role && input.role !== "ADMIN") ||
            (input.status && input.status !== "ACTIVE"));

        if (isRemovingAdmin) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(888999000);`;
          const activeAdmins = await tx.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM "users"
            WHERE role = 'ADMIN' AND status = 'ACTIVE'
          `;
          if (Number(activeAdmins[0].count) <= 1) {
            throw new ApiError(
              409,
              "No se puede dejar al sistema sin administrador activo."
            );
          }
        }

        previousState = {
          role: targetUser.role,
          status: targetUser.status
        };

        const updated = await tx.user.update({
          where: { id },
          data: {
            role: input.role,
            status: input.status,
            passwordHash,
            ...(input.unlock
              ? {
                  failedLoginAttempts: 0,
                  firstFailedAt: null,
                  lockedUntil: null
                }
              : {})
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            lockedUntil: true
          }
        });

        newState = {
          role: updated.role,
          status: updated.status
        };

        const shouldRevokeSessions =
          input.password ||
          input.status === UserStatus.SUSPENDED ||
          input.status === UserStatus.DISABLED ||
          input.status === UserStatus.REJECTED ||
          input.status === UserStatus.PENDING_APPROVAL;

        if (shouldRevokeSessions) {
          await tx.session.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() }
          });
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const metadata = await requestMetadata();
    
    let actionName = "USER_UPDATED";
    if (previousState.status === UserStatus.PENDING_APPROVAL && newState.status === UserStatus.ACTIVE) {
      actionName = "USER_APPROVED";
      // TODO: Enviar email de aprobación si está configurado
    } else if (previousState.status === UserStatus.PENDING_APPROVAL && newState.status === UserStatus.REJECTED) {
      actionName = "USER_REJECTED";
    }

    await audit({
      userId: actor.id,
      action: actionName,
      entityType: "User",
      entityId: id,
      ip: metadata.ip,
      metadata: { 
        fields: Object.keys(input),
        previousRole: previousState.role,
        previousStatus: previousState.status,
        newRole: newState.role,
        newStatus: newState.status
      }
    });
    return jsonOk(user);
  } catch (error) {
    return jsonError(error);
  }
}
