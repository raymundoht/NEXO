import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAnyPermission, requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";

export async function GET() {
  try {
    await requireAnyPermission(["inventory.read", "pos.sell"]);
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });
    return jsonOk(categories);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("inventory.write");
    const input = z
      .object({ name: z.string().trim().min(2).max(120) })
      .parse(await readJson(request));
    const category = await db.category.create({
      data: { name: sanitizeText(input.name, 120) }
    });
    return jsonOk(category, 201);
  } catch (error) {
    return jsonError(error);
  }
}
