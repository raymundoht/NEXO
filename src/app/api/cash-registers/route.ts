import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";

export async function GET() {
  try {
    const user = await requirePermission("cash.manage");
    const registers = await db.cashRegister.findMany({
      where: { active: true },
      include: {
        sessions: {
          where: { status: "OPEN" },
          select: {
            id: true,
            cashierId: true,
            currency: true,
            openedAt: true,
            cashier: { select: { name: true } }
          }
        }
      },
      orderBy: { name: "asc" }
    });
    return jsonOk(
      registers.map((register) => ({
        ...register,
        sessions: register.sessions.map((session) =>
          user.role === "ADMIN" || session.cashierId === user.id
            ? session
            : {
                currency: session.currency,
                openedAt: session.openedAt,
                occupied: true
              }
        )
      }))
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("settings.manage");
    const input = z
      .object({
        code: z.string().trim().min(1).max(40),
        name: z.string().trim().min(2).max(120)
      })
      .parse(await readJson(request));
    const register = await db.cashRegister.create({
      data: {
        code: input.code.toUpperCase(),
        name: sanitizeText(input.name, 120)
      }
    });
    return jsonOk(register, 201);
  } catch (error) {
    return jsonError(error);
  }
}
