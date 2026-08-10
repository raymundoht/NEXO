import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import {
  assertTrustedOrigin,
  hashPassword,
  normalizeEmail,
  sanitizeText
} from "@/lib/security";
import { strongPassword } from "@/lib/validators";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().email().max(320),
  role: z.nativeEnum(Role),
  password: strongPassword
});

export async function GET(request: Request) {
  try {
    await requirePermission("users.manage");
    const { page, pageSize, skip, take } = getPagination(request.url);
    const [items, total] = await db.$transaction([
      db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          lockedUntil: true,
          lastLoginAt: true,
          createdAt: true
        },
        orderBy: { name: "asc" },
        skip,
        take
      }),
      db.user.count()
    ]);
    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const actor = await requirePermission("users.manage");
    const input = schema.parse(await readJson(request));
    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: {
        name: sanitizeText(input.name, 160),
        email: normalizeEmail(input.email),
        role: input.role,
        status: UserStatus.ACTIVE,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });
    const metadata = await requestMetadata();
    await audit({
      userId: actor.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      ip: metadata.ip,
      metadata: { role: user.role }
    });
    return jsonOk(user, 201);
  } catch (error) {
    return jsonError(error);
  }
}
