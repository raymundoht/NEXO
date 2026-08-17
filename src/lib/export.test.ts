import { describe, expect, it } from "vitest";
import { csvCell, parseBusinessDate, renderTablePdf, renderTicketPdf } from "@/lib/export";

describe("exportaciones", () => {
  it("neutraliza fórmulas CSV incluso después de espacios o tabuladores", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(csvCell(" \t@cmd")).toBe("\"' \t@cmd\"");
  });

  it("interpreta los límites de fecha en la zona operativa", () => {
    expect(parseBusinessDate("2026-08-16").toISOString()).toBe("2026-08-16T06:00:00.000Z");
    expect(parseBusinessDate("2026-08-16", true).toISOString()).toBe("2026-08-17T05:59:59.999Z");
    expect(() => parseBusinessDate("16/08/2026")).toThrow();
  });

  it("genera reportes y tickets PDF reales", async () => {
    const table = await renderTablePdf({ title: "Prueba", headers: ["A"], rows: [["1"]] });
    const ticket = await renderTicketPdf({
      businessName: "NEXO",
      folio: "V-1",
      status: "COMPLETED",
      date: "16/08/2026",
      register: "CAJA-01",
      cashier: "Prueba",
      currency: "MXN",
      items: [{ name: "Producto", sku: "P-1", quantity: "1", unitPrice: "$10.00", discount: "0", total: "$11.60" }],
      grossSubtotal: "$10.00",
      discountTotal: "$0.00",
      taxTotal: "$1.60",
      total: "$11.60",
      refundedTotal: "$0.00",
      payment: "Efectivo"
    });
    expect(table.subarray(0, 4).toString()).toBe("%PDF");
    expect(ticket.subarray(0, 4).toString()).toBe("%PDF");
  });
});
