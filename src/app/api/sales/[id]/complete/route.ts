import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { completeHeldSale } from "@/services/sales";
import { audit } from "@/lib/audit";
import { cardAuthorization } from "@/lib/validators";

const schema = z.object({
  cashRegisterId: z.string().uuid(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  amountTendered: z.coerce.number().min(0).optional(),
  cardAuthorization: cardAuthorization.optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("pos.sell");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const sale = await completeHeldSale(user, id, input);
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "HELD_SALE_COMPLETED",
      entityType: "Sale",
      entityId: sale.id,
      ip: metadata.ip,
      metadata: { folio: sale.folio }
    });
    return jsonOk(sale);
  } catch (error) {
    return jsonError(error);
  }
}
