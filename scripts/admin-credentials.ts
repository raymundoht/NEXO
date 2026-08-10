import { emitKeypressEvents } from "node:readline";
import argon2 from "argon2";
import {
  PrismaClient,
  Role,
  UserStatus,
  type User
} from "@prisma/client";

const prisma = new PrismaClient();
const passwordPolicyMessage =
  "Usa al menos 10 caracteres con mayúscula, minúscula, número y carácter especial.";

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isStrongPassword(value: string) {
  return (
    value.length >= 10 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function readHidden(label: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Este comando requiere una terminal interactiva para mantener oculta la contraseña."
    );
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(label);

  return new Promise<string>((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        reject(new Error("Operación cancelada."));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }

      if (!key.ctrl && text) {
        value += text;
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

async function resolveAdministrator(targetEmail: string) {
  const currentEmailValue = argumentValue("--current-email");
  const currentEmail = currentEmailValue
    ? normalizeEmail(currentEmailValue)
    : undefined;

  const userAtTarget = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (userAtTarget && userAtTarget.role !== Role.ADMIN) {
    throw new Error(
      "El correo indicado ya pertenece a un usuario que no es administrador."
    );
  }

  if (userAtTarget) return userAtTarget;

  if (currentEmail) {
    const selected = await prisma.user.findUnique({
      where: { email: currentEmail }
    });
    if (!selected || selected.role !== Role.ADMIN) {
      throw new Error(
        "No existe un administrador con el correo indicado en --current-email."
      );
    }
    return selected;
  }

  const administrators = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: "asc" },
    take: 2
  });

  if (administrators.length !== 1) {
    throw new Error(
      "No se pudo elegir un único administrador. Usa --current-email correo-actual."
    );
  }

  return administrators[0];
}

async function rotateCredentials(administrator: User, email: string) {
  const password = await readHidden("Nueva contraseña exclusiva del ERP: ");
  if (!isStrongPassword(password)) {
    throw new Error(passwordPolicyMessage);
  }

  const confirmation = await readHidden("Confirma la nueva contraseña: ");
  if (password !== confirmation) {
    throw new Error("Las contraseñas no coinciden.");
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: administrator.id },
      data: {
        email,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        firstFailedAt: null,
        lockedUntil: null
      }
    });
    await tx.session.updateMany({
      where: { userId: administrator.id, revokedAt: null },
      data: { revokedAt: now }
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: administrator.id, usedAt: null },
      data: { usedAt: now }
    });
    await tx.auditLog.create({
      data: {
        userId: administrator.id,
        action: "ADMIN_CREDENTIALS_ROTATED",
        entityType: "User",
        entityId: administrator.id,
        metadata: { emailChanged: administrator.email !== email }
      }
    });
  });
}

async function main() {
  const targetEmail = normalizeEmail(
    argumentValue("--email") || process.env.SEED_ADMIN_EMAIL || ""
  );

  if (!isValidEmail(targetEmail)) {
    throw new Error(
      "Configura SEED_ADMIN_EMAIL en .env o usa --email correo@dominio.com."
    );
  }

  const administrator = await resolveAdministrator(targetEmail);
  await rotateCredentials(administrator, targetEmail);
  console.log(`Acceso actualizado. Ya puedes iniciar sesión con ${targetEmail}.`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? `No se pudo actualizar: ${error.message}` : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
