import {
  PaymentMethod,
  Prisma,
  Role,
  SaleStatus,
  type User
} from "@prisma/client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { calculateLine, calculateTotals, decimal, roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";

export type SaleLineInput = {
  productId: string;
  quantity: number;
  discountAmount?: number;
};

export type SalePaymentInput = {
  cashRegisterId: string;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  cardAuthorization?: string;
};

export type CreateSaleInput = {
  mode: "HOLD" | "COMPLETE";
  customerName?: string | null;
  currency: string;
  exchangeRate: number;
  notes?: string | null;
  items: SaleLineInput[];
  payment?: SalePaymentInput;
};

export async function createSale(
  actor: Pick<User, "id" | "role">,
  input: CreateSaleInput
) {
  const productIds = input.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, "No repitas productos en la venta.");
  }

  return db.$transaction(
    async (tx) => {
      const [products, settings] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, status: "ACTIVE" }
        }),
        tx.businessSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {}
        })
      ]);
      if (products.length !== productIds.length) {
        throw new ApiError(400, "Uno o más productos no están disponibles.");
      }
      if (!settings.allowedCurrencies.includes(input.currency)) {
        throw new ApiError(400, "La moneda no está habilitada.");
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      const lines = input.items.map((item) => {
        const product = productMap.get(item.productId)!;
        return {
          ...calculateLine({
            productId: product.id,
            quantity: item.quantity,
            unitPrice: product.salePrice,
            discountAmount: item.discountAmount,
            taxRate: product.taxRate
          }),
          product
        };
      });
      const totals = calculateTotals(lines);
      const gross = totals.subtotal.plus(totals.discountTotal);
      const discountRate = gross.gt(0)
        ? totals.discountTotal.mul(100).div(gross)
        : decimal(0);
      if (
        actor.role === Role.CASHIER &&
        discountRate.gt(settings.maxCashierDiscountRate)
      ) {
        throw new ApiError(
          403,
          `El descuento supera el ${settings.maxCashierDiscountRate.toString()}% autorizado.`
        );
      }

      const status =
        input.mode === "HOLD" ? SaleStatus.HELD : SaleStatus.COMPLETED;
      let cashSessionId: string | null = null;
      let cashRegisterId: string | null = null;
      let paymentMethod: PaymentMethod | null = null;
      let amountTendered: Prisma.Decimal | null = null;
      let changeAmount: Prisma.Decimal | null = null;
      let cardAuthorization: string | null = null;
      let cashMovementAmount: Prisma.Decimal | null = null;

      if (input.mode === "COMPLETE") {
        if (!input.payment) {
          throw new ApiError(400, "Faltan los datos de pago.");
        }
        const payment = input.payment;
        const session = await tx.cashSession.findFirst({
          where: {
            cashRegisterId: payment.cashRegisterId,
            status: "OPEN",
            ...(actor.role === Role.ADMIN ? {} : { cashierId: actor.id })
          }
        });
        if (!session) {
          throw new ApiError(409, "Debes abrir la caja antes de cobrar.");
        }
        cashSessionId = session.id;
        cashRegisterId = session.cashRegisterId;
        paymentMethod = payment.paymentMethod;
        if (paymentMethod === PaymentMethod.CASH) {
          amountTendered = decimal(payment.amountTendered ?? 0);
          if (amountTendered.lt(totals.total)) {
            throw new ApiError(400, "El efectivo recibido es insuficiente.");
          }
          changeAmount = roundMoney(amountTendered.minus(totals.total));
          cashMovementAmount = convertToCashSessionCurrency({
            amount: totals.total,
            saleCurrency: input.currency,
            exchangeRate: decimal(input.exchangeRate),
            sessionCurrency: session.currency,
            baseCurrency: settings.baseCurrency
          });
        } else {
          cardAuthorization = payment.cardAuthorization?.trim() || null;
          if (!cardAuthorization) {
            throw new ApiError(
              400,
              "Captura el código de autorización de la terminal."
            );
          }
        }
      }

      const folio = await nextFolio(tx, "SALE", "V");
      const sale = await tx.sale.create({
        data: {
          folio,
          cashRegisterId,
          cashSessionId,
          cashierId: actor.id,
          status,
          customerName: input.customerName?.trim().slice(0, 160) || null,
          currency: input.currency,
          exchangeRate: decimal(input.exchangeRate),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          paymentMethod,
          amountTendered,
          changeAmount,
          cardAuthorization,
          notes: input.notes?.trim().slice(0, 2000) || null,
          heldAt: input.mode === "HOLD" ? new Date() : null,
          completedAt: input.mode === "COMPLETE" ? new Date() : null,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              skuSnapshot: line.product.sku,
              nameSnapshot: line.product.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              taxRate: line.taxRate,
              lineSubtotal: line.lineSubtotal,
              lineTax: line.lineTax,
              lineTotal: line.lineTotal
            }))
          }
        },
        include: { items: true }
      });

      if (input.mode === "COMPLETE") {
        await deductStock(tx, actor.id, sale.id, folio, lines);
        if (cashMovementAmount && cashSessionId) {
          await tx.cashMovement.create({
            data: {
              cashSessionId,
              userId: actor.id,
              type: "SALE",
              amount: cashMovementAmount,
              currency: settings.baseCurrency,
              referenceType: "Sale",
              referenceId: sale.id,
              notes:
                input.currency === settings.baseCurrency
                  ? `Venta ${folio}`
                  : `Venta ${folio}: ${totals.total.toString()} ${input.currency}`
            }
          });
        }
      }
      return sale;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function completeHeldSale(
  actor: Pick<User, "id" | "role">,
  saleId: string,
  input: SalePaymentInput
) {
  return db.$transaction(
    async (tx) => {
      const [sale, settings] = await Promise.all([
        tx.sale.findUnique({
          where: { id: saleId },
          include: { items: { include: { product: true } } }
        }),
        tx.businessSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {}
        })
      ]);
      if (!sale) throw new ApiError(404, "Venta en espera no encontrada.");
      if (sale.status !== SaleStatus.HELD) {
        throw new ApiError(409, "La venta ya no está en espera.");
      }
      if (actor.role !== Role.ADMIN && sale.cashierId !== actor.id) {
        throw new ApiError(403, "No puedes cobrar la venta de otro cajero.");
      }
      const session = await tx.cashSession.findFirst({
        where: {
          cashRegisterId: input.cashRegisterId,
          status: "OPEN",
          ...(actor.role === Role.ADMIN ? {} : { cashierId: actor.id })
        }
      });
      if (!session) throw new ApiError(409, "Debes abrir la caja antes de cobrar.");

      let amountTendered: Prisma.Decimal | null = null;
      let changeAmount: Prisma.Decimal | null = null;
      let cardAuthorization: string | null = null;
      let cashMovementAmount: Prisma.Decimal | null = null;
      if (input.paymentMethod === PaymentMethod.CASH) {
        amountTendered = decimal(input.amountTendered ?? 0);
        if (amountTendered.lt(sale.total)) {
          throw new ApiError(400, "El efectivo recibido es insuficiente.");
        }
        changeAmount = roundMoney(amountTendered.minus(sale.total));
        cashMovementAmount = convertToCashSessionCurrency({
          amount: sale.total,
          saleCurrency: sale.currency,
          exchangeRate: sale.exchangeRate,
          sessionCurrency: session.currency,
          baseCurrency: settings.baseCurrency
        });
      } else {
        cardAuthorization = input.cardAuthorization?.trim() || null;
        if (!cardAuthorization) {
          throw new ApiError(
            400,
            "Captura el código de autorización de la terminal."
          );
        }
      }

      const stockLines = sale.items.map((item) => ({
        product: item.product,
        quantity: item.quantity
      }));
      await deductStock(
        tx,
        actor.id,
        sale.id,
        sale.folio,
        stockLines
      );
      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.COMPLETED,
          cashRegisterId: session.cashRegisterId,
          cashSessionId: session.id,
          paymentMethod: input.paymentMethod,
          amountTendered,
          changeAmount,
          cardAuthorization,
          completedAt: new Date()
        },
        include: { items: true }
      });
      if (cashMovementAmount) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: session.id,
            userId: actor.id,
            type: "SALE",
            amount: cashMovementAmount,
            currency: settings.baseCurrency,
            referenceType: "Sale",
            referenceId: sale.id,
            notes: `Venta en espera cobrada ${sale.folio}`
          }
        });
      }
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

async function deductStock(
  tx: Prisma.TransactionClient,
  userId: string,
  saleId: string,
  folio: string,
  lines: Array<{
    product: {
      id: string;
      name: string;
      currentStock: Prisma.Decimal;
      allowNegative: boolean;
      cost: Prisma.Decimal;
    };
    quantity: Prisma.Decimal;
  }>
) {
  const sortedLines = [...lines].sort((a, b) => a.product.id.localeCompare(b.product.id));

  for (const line of sortedLines) {
    const product = await tx.product.findUnique({
      where: { id: line.product.id }
    });
    if (!product) {
      throw new ApiError(404, `Producto no encontrado: ${line.product.name}`);
    }

    const reserved = await tx.stockReservation.aggregate({
      where: {
        productId: product.id,
        consumedAt: null,
        releasedAt: null,
        expiresAt: { gt: new Date() }
      },
      _sum: { quantity: true }
    });

    const activeReservations = reserved._sum.quantity || decimal(0);
    const availableStock = product.currentStock.minus(activeReservations);
    const stockAfter = product.currentStock.minus(line.quantity);

    if (availableStock.lt(line.quantity) && !product.allowNegative) {
      throw new ApiError(
        409,
        `Existencias insuficientes para ${product.name}. Disponibles: ${availableStock.toString()}`
      );
    }

    const updated = await tx.product.updateMany({
      where: {
        id: product.id,
        currentStock: product.currentStock
      },
      data: { currentStock: stockAfter }
    });

    if (updated.count !== 1) {
      throw new ApiError(
        409,
        `Las existencias de ${product.name} cambiaron concurrentemente. Actualiza la venta.`
      );
    }

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        userId,
        type: "SALE",
        quantity: line.quantity.negated(),
        stockBefore: product.currentStock,
        stockAfter,
        unitCost: product.cost,
        referenceType: "Sale",
        referenceId: saleId,
        reason: `Venta ${folio}`
      }
    });
  }
}

function convertToCashSessionCurrency(input: {
  amount: Prisma.Decimal;
  saleCurrency: string;
  exchangeRate: Prisma.Decimal;
  sessionCurrency: string;
  baseCurrency: string;
}) {
  if (input.sessionCurrency === input.saleCurrency) {
    return roundMoney(input.amount);
  }
  if (input.sessionCurrency === input.baseCurrency) {
    return roundMoney(input.amount.mul(input.exchangeRate));
  }
  throw new ApiError(
    400,
    "La moneda de la venta no es compatible con la sesión de caja."
  );
}

export async function fulfillSaleOnce(
  checkoutSessionId: string, 
  stripeIntentId: string, 
  chargeId: string | null,
  amountConfirmedMinor: number
) {
  let attemptId = "";
  let retryCount = 3;

  while (retryCount > 0) {
    try {
      await db.$transaction(async (tx) => {
        const attempt = await tx.paymentAttempt.findUnique({
          where: { checkoutSessionId },
          include: { 
            sale: { include: { items: { include: { product: true } } } },
            stockReservations: true
          }
        });

        if (!attempt) return;
        attemptId = attempt.id;

        if (['SUCCEEDED', 'FAILED', 'EXPIRED'].includes(attempt.status)) return;
        
        if (attempt.sale.status !== SaleStatus.HELD) {
          throw new ApiError(409, "La venta ya no está en espera.");
        }

        const expectedMinor = Math.round(Number(attempt.expectedAmount) * 100);
        if (expectedMinor !== amountConfirmedMinor) {
          throw new ApiError(409, `El monto cobrado (${amountConfirmedMinor}) no coincide con el esperado (${expectedMinor}).`);
        }

        const now = new Date();

        if (attempt.stockReservations.length !== attempt.sale.items.length) {
           throw new ApiError(409, "Las reservas de stock no coinciden con la venta.");
        }

        for (const item of attempt.sale.items) {
          const res = attempt.stockReservations.find(r => r.productId === item.productId);
          if (!res) throw new ApiError(409, `Falta reserva para el producto ${item.productId}`);
          if (res.consumedAt || res.releasedAt) throw new ApiError(409, `Reserva ya liberada o consumida para ${item.productId}`);
          if (res.expiresAt < now) throw new ApiError(409, `Reserva expirada para ${item.productId}`);
          if (Number(res.quantity) !== Number(item.quantity)) throw new ApiError(409, `Cantidad reservada incorrecta para ${item.productId}`);
        }

        await tx.stockReservation.updateMany({
          where: { paymentAttemptId: attempt.id },
          data: { consumedAt: now }
        });

        const stockLines = attempt.sale.items.map(item => ({
          product: item.product,
          quantity: item.quantity
        }));

        await deductStock(tx, attempt.cashierId, attempt.sale.id, attempt.sale.folio, stockLines);

        await tx.sale.update({
          where: { id: attempt.sale.id },
          data: {
            status: SaleStatus.COMPLETED,
            cashRegisterId: attempt.cashRegisterId,
            cashSessionId: attempt.cashSessionId,
            paymentMethod: PaymentMethod.CARD,
            amountTendered: attempt.expectedAmount,
            changeAmount: 0,
            cardAuthorization: chargeId || stripeIntentId,
            completedAt: now
          }
        });

        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'SUCCEEDED',
            paymentIntentId: stripeIntentId,
            chargeId,
            confirmedAt: now
          }
        });

        await tx.auditLog.create({
          data: {
            userId: attempt.cashierId,
            action: 'STRIPE_PAYMENT_SUCCEEDED',
            entityType: 'Sale',
            entityId: attempt.sale.id,
            metadata: { intentId: stripeIntentId, amount: amountConfirmedMinor }
          }
        });

      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      
      return; // Éxito

    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        retryCount--;
        if (retryCount > 0) {
          await new Promise(r => setTimeout(r, 150));
          continue;
        }
      }
      
      // Fallo determinista o reintentos agotados
      if (attemptId) {
        await db.$transaction(async (tx) => {
          const attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId } });
          if (attempt && !['SUCCEEDED', 'FAILED'].includes(attempt.status)) {
            const errObj = error as any;
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'REVIEW_REQUIRED',
                paymentIntentId: stripeIntentId,
                chargeId,
                reasonCode: errObj.code || 'FULFILLMENT_ERROR',
                errorMessage: errObj.message ? String(errObj.message).slice(0, 500) : 'Error desconocido al materializar'
              }
            });

            await tx.auditLog.create({
              data: {
                action: 'STRIPE_PAYMENT_REVIEW_REQUIRED',
                entityType: 'PaymentAttempt',
                entityId: attempt.id,
                metadata: { intentId: stripeIntentId, error: errObj.message }
              }
            });
          }
        });
      }
      return; // Manejado
    }
  }
}
