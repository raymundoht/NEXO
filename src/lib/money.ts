import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

export type CalculatedLine = {
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

export function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundCost(value: Prisma.Decimal) {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateLine(input: {
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal.Value;
  discountAmount?: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
}): CalculatedLine {
  const quantity = input.quantity;
  const unitPrice = decimal(input.unitPrice);
  const discountAmount = decimal(input.discountAmount || 0);
  const taxRate = decimal(input.taxRate);

  if (quantity.lte(0) || unitPrice.lt(0) || discountAmount.lt(0)) {
    throw new ApiError(400, "Cantidad, precio o descuento inválido.");
  }

  const gross = roundMoney(unitPrice.mul(quantity));
  if (discountAmount.gt(gross)) {
    throw new ApiError(400, "El descuento no puede superar el importe.");
  }
  const lineSubtotal = roundMoney(gross.minus(discountAmount));
  const lineTax = roundMoney(lineSubtotal.mul(taxRate).div(100));

  return {
    productId: input.productId,
    quantity,
    unitPrice,
    discountAmount,
    taxRate,
    lineSubtotal,
    lineTax,
    lineTotal: roundMoney(lineSubtotal.plus(lineTax))
  };
}

export function calculateTotals(lines: CalculatedLine[]) {
  return lines.reduce(
    (total, line) => ({
      subtotal: roundMoney(total.subtotal.plus(line.lineSubtotal)),
      discountTotal: roundMoney(total.discountTotal.plus(line.discountAmount)),
      taxTotal: roundMoney(total.taxTotal.plus(line.lineTax)),
      total: roundMoney(total.total.plus(line.lineTotal))
    }),
    {
      subtotal: decimal(0),
      discountTotal: decimal(0),
      taxTotal: decimal(0),
      total: decimal(0)
    }
  );
}
