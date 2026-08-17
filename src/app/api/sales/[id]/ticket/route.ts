import { Prisma, Role, SaleStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { formatDate, renderTicketPdf } from "@/lib/export";
import { } from "@/lib/money";

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
          refunds: { select: { amount: true } },
          paymentAttempts: {
            where: { status: "SUCCEEDED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { cardBrand: true, cardLast4: true }
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
    if (sale.status === SaleStatus.HELD) {
      throw new ApiError(409, "La venta sigue en espera y todavía no tiene un ticket válido.");
    }

    const money = (value: { toString(): string } | string | number) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: sale.currency
      }).format(Number(value.toString()));
    const refundedTotal = sale.refunds.reduce(
      (total, refund) => total.plus(refund.amount),
      new Prisma.Decimal(0)
    );
    const attempt = sale.paymentAttempts[0];
    const payment =
      sale.paymentMethod === "CASH"
        ? "Efectivo"
        : attempt?.cardLast4
          ? `${attempt.cardBrand || "Tarjeta"} ****${attempt.cardLast4}`
          : "Tarjeta";

    const pdf = await renderTicketPdf({
      businessName: settings.businessName,
      taxId: settings.taxId,
      address: settings.address,
      phone: settings.phone,
      folio: sale.folio,
      status: sale.status,
      date: formatDate(sale.completedAt || sale.createdAt),
      register: sale.cashRegister?.code || "N/D",
      cashier: sale.cashier.name,
      currency: sale.currency,
      items: sale.items.map((item) => ({
        name: item.nameSnapshot,
        sku: item.skuSnapshot,
        quantity: String(item.quantity),
        unitPrice: money(item.unitPrice),
        discount: money(item.discountAmount),
        total: money(item.lineTotal)
      })),
      grossSubtotal: money(sale.subtotal.plus(sale.discountTotal)),
      discountTotal: money(sale.discountTotal),
      taxTotal: money(sale.taxTotal),
      total: money(sale.total),
      refundedTotal: money(refundedTotal),
      payment,
      amountTendered:
        sale.paymentMethod === "CASH" && sale.amountTendered
          ? money(sale.amountTendered)
          : null,
      changeAmount:
        sale.paymentMethod === "CASH" && sale.changeAmount
          ? money(sale.changeAmount)
          : null,
      authorization:
        sale.paymentMethod === "CARD" ? sale.cardAuthorization : null,
      footer: settings.ticketFooter
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="ticket-${sale.folio}.pdf"`,
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
