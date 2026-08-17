import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  formatDate,
  parseBusinessDate,
  renderTablePdf,
  toCsv
} from "@/lib/export";
import { roundMoney } from "@/lib/money";

const MAX_SALES = 2_000;
const MAX_ROWS = 25_000;

export async function GET(request: Request) {
  try {
    await requirePermission("sales.export");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    if (!['csv', 'pdf'].includes(format)) {
      throw new ApiError(400, "Formato no soportado.");
    }
    const from = searchParams.get("from");
    const to = searchParams.get("to");
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

    const where: Prisma.SaleWhereInput = {
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {})
            }
          }
        : {})
    };
    const totalSales = await db.sale.count({ where });
    if (totalSales > MAX_SALES) {
      throw new ApiError(
        413,
        `El reporte contiene ${totalSales} ventas. Reduce el rango a ${MAX_SALES} o menos.`,
        "REPORT_TOO_LARGE"
      );
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        cashier: { select: { name: true } },
        cashRegister: { select: { code: true } },
        items: true,
        refunds: { select: { amount: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const headers = [
      "Folio",
      "Fecha",
      "Estado",
      "SKU",
      "Artículo",
      "Cantidad",
      "Precio unitario",
      "Descuento partida",
      "Total partida",
      "Subtotal venta",
      "Impuestos venta",
      "Total bruto",
      "Reembolsado",
      "Total neto",
      "Moneda",
      "Pago",
      "Caja",
      "Cajero"
    ];
    const rows = sales.flatMap((sale) => {
      const refunded = roundMoney(
        sale.refunds.reduce(
          (total, refund) => total.plus(refund.amount),
          new Prisma.Decimal(0)
        )
      );
      const net = roundMoney(sale.total.minus(refunded));
      return sale.items.map((item) => [
        sale.folio,
        formatDate(sale.completedAt || sale.createdAt),
        sale.status,
        item.skuSnapshot,
        item.nameSnapshot,
        String(item.quantity),
        item.unitPrice.toString(),
        item.discountAmount.toString(),
        item.lineTotal.toString(),
        sale.subtotal.toString(),
        sale.taxTotal.toString(),
        sale.total.toString(),
        refunded.toString(),
        net.toString(),
        sale.currency,
        sale.paymentMethod || "",
        sale.cashRegister?.code || "",
        sale.cashier.name
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
        title: "Historial de ventas",
        subtitle: `Generado ${formatDate(new Date())}`,
        headers,
        rows,
        layout: "landscape",
        fontSize: 5
      });
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="ventas-${stamp}.pdf"`,
          "cache-control": "no-store"
        }
      });
    }
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
