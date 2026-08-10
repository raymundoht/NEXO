import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { formatDate, renderTablePdf, toCsv } from "@/lib/export";

export async function GET(request: Request) {
  try {
    await requirePermission("sales.export");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: Prisma.SaleWhereInput = {
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    };
    const sales = await db.sale.findMany({
      where,
      include: {
        cashier: { select: { name: true } },
        cashRegister: { select: { code: true } },
        items: true
      },
      orderBy: { createdAt: "desc" },
      take: 10_000
    });
    const headers = [
      "Folio",
      "Fecha",
      "Estado",
      "SKU",
      "Artículo",
      "Cantidad",
      "Precio unitario",
      "Descuento",
      "Total partida",
      "Subtotal venta",
      "Impuestos venta",
      "Total venta",
      "Moneda",
      "Pago",
      "Caja",
      "Cajero"
    ];
    const rows = sales.flatMap((sale) =>
      sale.items.map((item) => [
        sale.folio,
        formatDate(sale.createdAt),
        sale.status,
        item.skuSnapshot,
        item.nameSnapshot,
        item.quantity.toString(),
        item.unitPrice.toString(),
        item.discountAmount.toString(),
        item.lineTotal.toString(),
        sale.subtotal.toString(),
        sale.taxTotal.toString(),
        sale.total.toString(),
        sale.currency,
        sale.paymentMethod || "",
        sale.cashRegister?.code || "",
        sale.cashier.name
      ])
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "pdf") {
      const pdf = await renderTablePdf({
        title: "Historial de ventas",
        subtitle: `Generado ${formatDate(new Date())}`,
        headers,
        rows,
        layout: "landscape",
        fontSize: 6
      });
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="ventas-${stamp}.pdf"`,
          "cache-control": "no-store"
        }
      });
    }
    if (format !== "csv") throw new ApiError(400, "Formato no soportado.");
    return new Response(toCsv(headers, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="ventas-${stamp}.csv"`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
