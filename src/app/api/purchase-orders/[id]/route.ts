import { PurchaseOrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("purchases.read");
    const { id } = await context.params;
    const order = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        buyer: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
        receipts: {
          include: {
            receivedBy: { select: { id: true, name: true } },
            items: true
          },
          orderBy: { receivedAt: "desc" }
        }
      }
    });
    if (!order) throw new ApiError(404, "Orden de compra no encontrada.");
    return jsonOk(order);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("purchases.write");
    const { id } = await context.params;
    const input = z
      .object({
        action: z.enum(["SEND", "CANCEL"])
      })
      .parse(await readJson(request));
    const order = await db.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new ApiError(404, "Orden de compra no encontrada.");

    const status =
      input.action === "SEND"
        ? PurchaseOrderStatus.SENT
        : PurchaseOrderStatus.CANCELLED;
    if (
      input.action === "SEND" &&
      order.status !== PurchaseOrderStatus.DRAFT
    ) {
      throw new ApiError(409, "Sólo una orden en borrador puede enviarse.");
    }
    if (
      input.action === "CANCEL" &&
      !([
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.SENT
      ] as PurchaseOrderStatus[]).includes(
        order.status
      )
    ) {
      throw new ApiError(409, "La orden ya tiene recepciones y no puede cancelarse.");
    }
    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status, sentAt: input.action === "SEND" ? new Date() : undefined }
    });
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
