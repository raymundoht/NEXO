import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertTrustedOrigin } from "@/lib/security";

export async function PATCH(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requireUser();
    const body = await readJson(request);
    const { avatarSeed } = body as { avatarSeed: string };

    if (
      !avatarSeed ||
      typeof avatarSeed !== "string" ||
      avatarSeed.length > 50
    ) {
      throw new ApiError(
        400,
        "El seed del avatar es inválido.",
        "INVALID_AVATAR_SEED"
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { avatarSeed }
    });

    return jsonOk({ avatarSeed });
  } catch (error) {
    return jsonError(error);
  }
}
