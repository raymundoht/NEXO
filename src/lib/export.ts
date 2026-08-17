import PDFDocument from "pdfkit";

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function renderTablePdf(input: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  layout?: "portrait" | "landscape";
  fontSize?: number;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: input.layout || "portrait",
      margin: 42,
      info: { Title: input.title, Creator: "NEXO ERP" }
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#18213d").text(input.title);
    if (input.subtitle) {
      doc
        .moveDown(0.25)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#68708a")
        .text(input.subtitle);
    }
    doc.moveDown();

    const pageWidth = doc.page.width - 84;
    const colWidth = pageWidth / input.headers.length;
    const drawRow = (cells: string[], header = false) => {
      const fontSize = input.fontSize || 7.5;
      const rowHeight =
        Math.max(
          ...cells.map((cell) =>
            doc
              .font(header ? "Helvetica-Bold" : "Helvetica")
              .fontSize(fontSize)
              .heightOfString(cell, { width: colWidth - 8 })
          )
        ) + 10;
      if (doc.y + rowHeight > doc.page.height - 52) {
        doc.addPage();
        if (!header) drawRow(input.headers, true);
      }
      const y = doc.y;
      if (header) {
        doc.rect(42, y, pageWidth, rowHeight).fill("#6c5ce7");
      } else {
        doc.rect(42, y, pageWidth, rowHeight).fill("#f6f7fb");
      }
      cells.forEach((cell, index) => {
        doc
          .font(header ? "Helvetica-Bold" : "Helvetica")
          .fontSize(fontSize)
          .fillColor(header ? "#ffffff" : "#27314e")
          .text(cell, 46 + index * colWidth, y + 5, {
            width: colWidth - 8,
            height: rowHeight - 8
          });
      });
      doc.y = y + rowHeight + 2;
    };

    drawRow(input.headers, true);
    input.rows.forEach((row) => drawRow(row));
    doc.end();
  });
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Chihuahua"
  }).format(value);
}

export function parseBusinessDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("La fecha debe usar el formato AAAA-MM-DD.");
  }
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-06:00`
  );
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha es inválida.");
  }
  return date;
}

export function renderTicketPdf(input: {
  businessName: string;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  folio: string;
  status: string;
  date: string;
  register: string;
  cashier: string;
  currency: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
  }>;
  grossSubtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  refundedTotal: string;
  payment: string;
  amountTendered?: string | null;
  changeAmount?: string | null;
  authorization?: string | null;
  footer?: string | null;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [226.77, 841.89],
      margins: { top: 18, right: 18, bottom: 18, left: 18 },
      info: { Title: `Ticket ${input.folio}`, Creator: "NEXO ERP" }
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - 36;
    const separator = () => {
      doc.moveDown(0.35);
      doc.moveTo(18, doc.y).lineTo(18 + width, doc.y).dash(2, { space: 2 }).stroke("#94a3b8").undash();
      doc.moveDown(0.45);
    };
    const row = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 8).fillColor("#111827");
      doc.text(label, 18, y, { width: width * 0.55 });
      doc.text(value, 18 + width * 0.55, y, {
        width: width * 0.45,
        align: "right"
      });
      doc.y = Math.max(doc.y, y + (bold ? 13 : 11));
    };
    const hasAmount = (value: string) =>
      Number(value.replace(/[^0-9.-]/g, "")) > 0;

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(input.businessName, { align: "center" });
    if (input.taxId) doc.font("Helvetica").fontSize(7).text(`RFC: ${input.taxId}`, { align: "center" });
    if (input.address) doc.font("Helvetica").fontSize(7).text(input.address, { align: "center" });
    if (input.phone) doc.font("Helvetica").fontSize(7).text(input.phone, { align: "center" });
    separator();

    doc.font("Helvetica-Bold").fontSize(9).text(`TICKET ${input.folio}`, { align: "center" });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(input.status === "COMPLETED" ? "#15803d" : "#b45309").text(input.status, { align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor("#374151");
    doc.text(`Fecha: ${input.date}`);
    doc.text(`Caja: ${input.register}`);
    doc.text(`Cajero: ${input.cashier}`);
    separator();

    for (const item of input.items) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(item.name);
      doc.font("Helvetica").fontSize(7).fillColor("#4b5563").text(`${item.sku} | ${item.quantity} x ${item.unitPrice}`);
      if (hasAmount(item.discount)) {
        doc.text(`Descuento: -${item.discount}`);
      }
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(item.total, { align: "right" });
      doc.moveDown(0.25);
    }
    separator();

    row("Subtotal", input.grossSubtotal);
    if (hasAmount(input.discountTotal)) row("Descuentos", `-${input.discountTotal}`);
    row("Impuestos", input.taxTotal);
    row("TOTAL", `${input.total} ${input.currency}`, true);
    if (hasAmount(input.refundedTotal)) row("REEMBOLSADO", `-${input.refundedTotal}`, true);
    separator();
    row("Pago", input.payment);
    if (input.amountTendered) row("Recibido", input.amountTendered);
    if (input.changeAmount) row("Cambio", input.changeAmount);
    if (input.authorization) row("Autorización", input.authorization);
    separator();
    doc.font("Helvetica").fontSize(7).fillColor("#6b7280").text(input.footer || "Gracias por tu compra.", { align: "center" });
    doc.end();
  });
}
