import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  formatDate,
  parseBusinessDate,
  renderTablePdf,
  toCsv
} from "@/lib/export";

const MAX_ORDERS = 1_000;
const MAX_ROWS = 25_000;

export async function GET(request: Request) {
  try {
    await requirePermission("purchases.export");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    if (!['csv', 'pdf'].includes(format)) {
      throw new ApiError(400, "Formato no soportado.");
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const supplierId = searchParams.get("supplierId");
    if (supplierId && !z.string().uuid().safeParse(supplierId).success) {
      throw new ApiError(400, "El proveedor seleccionado es inválido.");
    }

    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    try {
      fromDate = from ? parseBusinessDate(from) : undefined;
      toDate = to ? parseBusinessDate(to, true) : undefined;
    } catch {
      throw new ApiError(400, "El rango de fechas es inválido.");
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new ApiError(400, "La fecha inicial no puede ser posterior a la final.");
    }

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(supplierId ? { supplierId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {})
            }
          }
        : {})
    };
    const totalOrders = await db.purchaseOrder.count({ where });
    if (totalOrders > MAX_ORDERS) {
      throw new ApiError(
        413,
        `El reporte contiene ${totalOrders} órdenes. Reduce el rango a ${MAX_ORDERS} o menos.`,
        "REPORT_TOO_LARGE"
      );
    }

    const orders = await db.purchaseOrder.findMany({
      where,
      include: {
        items: { orderBy: { nameSnapshot: "asc" } },
        receipts: {
          select: { receiptNumber: true, receivedAt: true, supplierDocument: true },
          orderBy: { receivedAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const headers = [
      "Orden",
      "Fecha de orden",
      "Proveedor",
      "SKU histórico",
      "Artículo histórico",
      "Unidad",
      "Cantidad ordenada",
      "Cantidad recibida",
      "Costo unitario",
      "Total partida",
      "Estado",
      "Total orden",
      "Moneda",
      "Comprador",
      "Recepciones",
      "Documentos proveedor"
    ];
    const rows = orders.flatMap((order) => {
      const receipts = order.receipts
        .map((receipt) => `${receipt.receiptNumber} (${formatDate(receipt.receivedAt)})`)
        .join(" | ");
      const documents = order.receipts
        .map((receipt) => receipt.supplierDocument)
        .filter(Boolean)
        .join(" | ");
      return order.items.map((item) => [
        order.folio,
        formatDate(order.createdAt),
        order.supplierNameSnapshot,
        item.skuSnapshot,
        item.nameSnapshot,
        item.unitSnapshot,
        item.quantityOrdered.toString(),
        item.quantityReceived.toString(),
        item.unitCost.toString(),
        item.lineTotal.toString(),
        order.status,
        order.total.toString(),
        order.currency,
        order.buyerNameSnapshot,
        receipts,
        documents
      ]);
    });
    if (rows.length > MAX_ROWS) {
      throw new ApiError(
        413,
        `El reporte contiene ${rows.length} partidas. Reduce el rango de fechas.`,
        "REPORT_TOO_LARGE"
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "pdf") {
      const pdf = await renderTablePdf({
        title: "Historial de compras",
        subtitle: `Generado ${formatDate(new Date())}`,
        headers,
        rows,
        layout: "landscape",
        fontSize: 5.5
      });
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="compras-${stamp}.pdf"`,
          "cache-control": "no-store"
        }
      });
    }
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
