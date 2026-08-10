import { audit } from "@/lib/audit";
import {
  getCurrentUser,
  revokeCurrentSession,
  requestMetadata
} from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { assertTrustedOrigin } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const [user, metadata] = await Promise.all([
      getCurrentUser(),
      requestMetadata()
    ]);
    await revokeCurrentSession();
    if (user) {
      await audit({
        userId: user.id,
        action: "AUTH_LOGOUT",
        entityType: "User",
        entityId: user.id,
        ip: metadata.ip
      });
    }
    return jsonOk({ loggedOut: true });
  } catch (error) {
    return jsonError(error);
  }
}
