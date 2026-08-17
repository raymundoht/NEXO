import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk, readJson, ApiError } from "@/lib/api";
import {
  assertTrustedOrigin,
  clientIp,
  hashIdentifier,
  normalizeEmail,
  verifyPassword
} from "@/lib/security";
import { audit } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$bhtcp9nvAhjr0Yz4SoW6+w$+HaeL1LeGi+7n18pUa0U4rbhaqFZ28+pRW8sgtOMaVc";

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128)
});

export async function POST(request: Request) {
  const nativeForm = (
    request.headers.get("content-type") || ""
  ).includes("application/x-www-form-urlencoded");
  try {
    assertTrustedOrigin(request);
    const input = schema.parse(
      nativeForm
        ? Object.fromEntries(await request.formData())
        : await readJson(request)
    );
    const email = normalizeEmail(input.email);
    const ip = clientIp(request);
    const ipHash = hashIdentifier(ip);
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    if (ipHash) {
      const recentFailures = await db.authAttempt.count({
        where: {
          ipHash,
          success: false,
          createdAt: { gte: windowStart }
        }
      });
      if (recentFailures >= 25) {
        throw new ApiError(
          429,
          "Demasiados intentos. Espera 15 minutos.",
          "RATE_LIMITED"
        );
      }
    }

    const user = await db.user.findUnique({ where: { email } });

    if (user?.lockedUntil && user.lockedUntil > now) {
      await db.authAttempt.create({
        data: { normalizedEmail: email, ipHash, success: false }
      });
      throw new ApiError(
        423,
        "La cuenta está bloqueada temporalmente. Intenta más tarde.",
        "ACCOUNT_LOCKED"
      );
    }

    const passwordMatches = await verifyPassword(
      user?.passwordHash || DUMMY_HASH,
      input.password
    );

    if (user && passwordMatches) {
      if (user.status === UserStatus.PENDING_APPROVAL) {
        throw new ApiError(403, "Cuenta pendiente de aprobación.", "PENDING_APPROVAL");
      }
      if (user.status === UserStatus.REJECTED) {
        throw new ApiError(403, "La solicitud de cuenta ha sido denegada.", "ACCOUNT_REJECTED");
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new ApiError(403, "La cuenta está suspendida.", "ACCOUNT_SUSPENDED");
      }
      if (user.status === UserStatus.DISABLED) {
        throw new ApiError(403, "La cuenta está inactiva.", "ACCOUNT_DISABLED");
      }
    }

    const allowed =
      Boolean(user) &&
      user?.status === UserStatus.ACTIVE &&
      passwordMatches;

    if (!allowed) {
      await db.$transaction(async (tx) => {
        if (ipHash) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`;
          const failures = await tx.authAttempt.count({
            where: {
              ipHash,
              success: false,
              createdAt: { gte: windowStart }
            }
          });
          if (failures >= 25) {
            throw new ApiError(
              429,
              "Demasiados intentos. Espera 15 minutos.",
              "RATE_LIMITED"
            );
          }
        }
        await tx.authAttempt.create({
          data: { normalizedEmail: email, ipHash, success: false }
        });

        if (user) {
          await tx.$executeRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
          const currentUser = await tx.user.findUnique({ where: { id: user.id } });
          if (!currentUser) return;
          const stillInWindow =
            currentUser.firstFailedAt && currentUser.firstFailedAt >= windowStart;
          const failedAttempts = stillInWindow
            ? currentUser.failedLoginAttempts + 1
            : 1;

          await tx.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: failedAttempts,
              firstFailedAt: stillInWindow ? currentUser.firstFailedAt : now,
              lockedUntil:
                failedAttempts >= 5
                  ? new Date(now.getTime() + 15 * 60 * 1000)
                  : null
            }
          });
        }
      });

      await audit({
        userId: user?.id,
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: user?.id,
        ip
      });
      throw new ApiError(
        401,
        "Correo o contraseña incorrectos.",
        "INVALID_CREDENTIALS"
      );
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const currentUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
        throw new ApiError(401, "Correo o contraseña incorrectos.", "INVALID_CREDENTIALS");
      }
      if (currentUser.lockedUntil && currentUser.lockedUntil > now) {
        throw new ApiError(423, "La cuenta está bloqueada temporalmente. Intenta más tarde.");
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          firstFailedAt: null,
          lockedUntil: null,
          lastLoginAt: now
        }
      });
      await tx.authAttempt.create({
        data: { normalizedEmail: email, ipHash, success: true }
      });
    });
    const { rawToken, expiresAt } = await createSession(user.id, {
      ip,
      userAgent: request.headers.get("user-agent")
    });

    await setSessionCookie(rawToken, expiresAt);
    await audit({
      userId: user.id,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
      ip
    });

    if (nativeForm) {
      return NextResponse.redirect(new URL("/dashboard", request.url), 303);
    }
    return jsonOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (nativeForm) {
      return NextResponse.redirect(new URL("/login?error=access", request.url), 303);
    }
    return jsonError(error);
  }
}
