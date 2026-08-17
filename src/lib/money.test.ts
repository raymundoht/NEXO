import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateLine, calculateTotals } from "@/lib/money";

describe("cálculos de venta", () => {
  it("calcula descuento, impuesto y total con redondeo monetario", () => {
    const line = calculateLine({
      productId: "p1",
      quantity: new Prisma.Decimal(2),
      unitPrice: 100,
      discountAmount: 20,
      taxRate: 16
    });
    expect(line.lineSubtotal.toString()).toBe("180");
    expect(line.lineTax.toString()).toBe("28.8");
    expect(line.lineTotal.toString()).toBe("208.8");
  });

  it("suma varias partidas sin confiar en totales del cliente", () => {
    const totals = calculateTotals([
      calculateLine({
        productId: "p1",
        quantity: new Prisma.Decimal(1),
        unitPrice: 100,
        taxRate: 16
      }),
      calculateLine({
        productId: "p2",
        quantity: new Prisma.Decimal(3),
        unitPrice: 10,
        taxRate: 0
      })
    ]);
    expect(totals.subtotal.toString()).toBe("130");
    expect(totals.taxTotal.toString()).toBe("16");
    expect(totals.total.toString()).toBe("146");
  });

  it("rechaza descuentos mayores al importe de la partida", () => {
    expect(() =>
      calculateLine({
        productId: "p1",
        quantity: new Prisma.Decimal(1),
        unitPrice: 50,
        discountAmount: 60,
        taxRate: 16
      })
    ).toThrow();
  });
});
