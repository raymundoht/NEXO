import { cookies, headers } from "next/headers";
import { Role, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  generateSecureToken,
  hashIdentifier,
  hashToken
} from "@/lib/security";
import {
  assertPermission,
  can,
  type Permission,
  permissionsFor
} from "@/lib/permissions";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export const sessionCookieName =
  process.env.SESSION_COOKIE_NAME || "nexo_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  avatarSeed: string | null;
};

export async function createSession(
  userId: string,
  metadata: { ip?: string | null; userAgent?: string | null }
) {
  const rawToken = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      expiresAt,
      ipHash: hashIdentifier(metadata.ip),
      userAgent: metadata.userAgent?.slice(0, 500)
    }
  });

  return { rawToken, expiresAt };
}

export async function setSessionCookie(rawToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(sessionCookieName)?.value;
  if (rawToken) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  await clearSessionCookie();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(sessionCookieName)?.value;
  if (!rawToken) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true }
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() }
    }).catch((error) => {
      console.error("No fue posible actualizar la actividad de la sesión.", error);
    });
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    permissions: permissionsFor(session.user.role),
    avatarSeed: session.user.avatarSeed ?? null
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "Debes iniciar sesión.", "UNAUTHORIZED");
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  assertPermission(user.role, permission);
  return user;
}

export async function requireAnyPermission(permissions: Permission[]) {
  const user = await requireUser();
  if (!permissions.some((permission) => can(user.role, permission))) {
    throw new ApiError(
      403,
      "No tienes permiso para realizar esta acción.",
      "FORBIDDEN"
    );
  }
  return user;
}

export async function requestMetadata() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return {
    ip:
      forwarded?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      null,
    userAgent: headerStore.get("user-agent")
  };
}
