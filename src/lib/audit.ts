import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashIdentifier } from "@/lib/security";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function audit(input: AuditInput) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipHash: hashIdentifier(input.ip),
      metadata: input.metadata
    }
  });
}
