import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { formatDate, renderTablePdf, toCsv } from "@/lib/export";

export async function GET(request: Request) {
  try {
    await requirePermission("purchases.export");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const supplierId = searchParams.get("supplierId");
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(supplierId ? { supplierId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    };
    const orders = await db.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { legalName: true } },
        buyer: { select: { name: true } },
        items: {
          include: {
            product: { select: { sku: true, name: true } }
          },
          orderBy: { product: { name: "asc" } }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10_000
    });
    const headers = [
      "Orden",
      "Fecha",
      "Proveedor",
      "SKU",
      "Artículo",
      "Cantidad ordenada",
      "Cantidad recibida",
      "Costo unitario",
      "Total partida",
      "Estado",
      "Total orden",
      "Moneda",
      "Comprador"
    ];
    const rows = orders.flatMap((order) =>
      order.items.map((item) => [
        order.folio,
        formatDate(order.createdAt),
        order.supplier.legalName,
        item.product.sku,
        item.product.name,
        item.quantityOrdered.toString(),
        item.quantityReceived.toString(),
        item.unitCost.toString(),
        item.lineTotal.toString(),
        order.status,
        order.total.toString(),
        order.currency,
        order.buyer.name
      ])
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "pdf") {
      const pdf = await renderTablePdf({
        title: "Historial de compras",
        subtitle: `Generado ${formatDate(new Date())}`,
        headers,
        rows,
        layout: "landscape",
        fontSize: 6.5
      });
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="compras-${stamp}.pdf"`,
          "cache-control": "no-store"
        }
      });
    }
    if (format !== "csv") throw new ApiError(400, "Formato no soportado.");
    return new Response(toCsv(headers, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="compras-${stamp}.csv"`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
