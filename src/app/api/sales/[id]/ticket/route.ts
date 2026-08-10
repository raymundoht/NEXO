import PDFDocument from "pdfkit";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("sales.read");
    const { id } = await context.params;
    const cashierCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [sale, settings] = await Promise.all([
      db.sale.findFirst({
        where: {
          id,
          ...(user.role === Role.ADMIN
            ? {}
            : { cashierId: user.id, createdAt: { gte: cashierCutoff } })
        },
        include: {
          cashier: { select: { name: true } },
          cashRegister: { select: { code: true } },
          items: true,
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      db.businessSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {}
      })
    ]);
    if (!sale) throw new ApiError(404, "Venta no encontrada.");
    
    let isSandbox = false;
    if (sale.paymentMethod === 'CARD') {
      if (sale.status === 'HELD') {
        throw new ApiError(403, "La venta no está completada.");
      }
      const attempt = sale.paymentAttempts?.[0];
      if (!attempt || attempt.status !== 'SUCCEEDED') {
        throw new ApiError(403, "El pago con tarjeta no se completó correctamente o requiere revisión.");
      }
      isSandbox = attempt.environment === 'TEST';
    }

    const pdf = await renderTicket(sale, settings, isSandbox);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="ticket-${sale.folio}.pdf"`,
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}

function renderTicket(
  sale: Awaited<ReturnType<typeof db.sale.findFirst>> & {
    cashier: { name: string };
    cashRegister: { code: string } | null;
    items: Array<{
      nameSnapshot: string;
      skuSnapshot: string;
      quantity: { toString(): string };
      unitPrice: { toString(): string };
      lineTotal: { toString(): string };
    }>;
  },
  settings: Awaited<ReturnType<typeof db.businessSettings.upsert>>,
  isSandbox: boolean
) {
  const accentColor = settings.accentColor || "#2563eb";
  const currencySymbol = sale.currency === "USD" ? "$" : sale.currency === "EUR" ? "\u20AC" : "$";
  const pageHeight = 200 + sale.items.length * 40 + 200;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [226.77, pageHeight],
      margin: 16,
      info: { Title: `Ticket ${sale.folio}`, Creator: "NEXO ERP" }
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header with accent color
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(accentColor)
      .text(settings.businessName, { align: "center" });
    doc.fillColor("#000000");
    if (settings.taxId) {
      doc.font("Helvetica").fontSize(8).text(settings.taxId, { align: "center" });
    }
    if (settings.address) {
      doc.text(settings.address, { align: "center" });
    }
    doc.moveDown(0.7);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(accentColor)
      .text(`TICKET ${sale.folio}`);
    doc.fillColor("#000000");
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Fecha: ${formatDate(sale.createdAt)}`)
      .text(`Caja: ${sale.cashRegister?.code || "N/D"}`)
      .text(`Cajero: ${sale.cashier.name}`);
    doc.moveDown(0.5);
    doc.moveTo(16, doc.y).lineTo(210, doc.y).dash(2, { space: 2 }).stroke(accentColor);
    doc.undash().moveDown(0.5);

    sale.items.forEach((item) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(item.nameSnapshot, { width: 194 });
      doc
        .font("Helvetica")
        .text(
          `${item.quantity.toString()} x ${currencySymbol}${Number(item.unitPrice.toString()).toFixed(2)}     ${currencySymbol}${Number(item.lineTotal.toString()).toFixed(2)}`,
          { align: "right" }
        );
      doc.moveDown(0.25);
    });
    doc.moveTo(16, doc.y).lineTo(210, doc.y).dash(2, { space: 2 }).stroke(accentColor);
    doc.undash().moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(`Subtotal: ${currencySymbol}${Number(sale.subtotal.toString()).toFixed(2)}`, {
        align: "right"
      })
      .text(`Impuestos: ${currencySymbol}${Number(sale.taxTotal.toString()).toFixed(2)}`, {
        align: "right"
      });
    if (sale.discountTotal.gt(0)) {
      doc.text(
        `Descuentos: -${currencySymbol}${Number(sale.discountTotal.toString()).toFixed(2)}`,
        { align: "right" }
      );
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(accentColor)
      .text(
        `TOTAL: ${currencySymbol}${Number(sale.total.toString()).toFixed(2)} ${sale.currency}`,
        { align: "right" }
      );
    doc.fillColor("#000000");
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Pago: ${sale.paymentMethod === 'CASH' ? 'Efectivo' : sale.paymentMethod === 'CARD' ? 'Tarjeta' : "EN ESPERA"}`, { align: "right" });
    if (sale.paymentMethod === "CASH") {
      doc
        .text(
          `Recibido: ${currencySymbol}${Number(sale.amountTendered?.toString() || 0).toFixed(2)}`,
          { align: "right" }
        )
        .text(
          `Cambio: ${currencySymbol}${Number(sale.changeAmount?.toString() || 0).toFixed(2)}`,
          { align: "right" }
        );
    } else if (sale.paymentMethod === "CARD" && sale.cardAuthorization) {
      doc.text(`Auth: ${sale.cardAuthorization}`, { align: "right" });
    }
    
    if (isSandbox) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(8).text("PAGO DE PRUEBA — SIN VALIDEZ FISCAL", { align: "center" });
    }

    doc.moveDown();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .text(settings.ticketFooter || "Gracias por tu compra.", {
        align: "center"
      });
    doc.end();
  });
}
