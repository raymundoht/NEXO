import { getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error);
  }
}
