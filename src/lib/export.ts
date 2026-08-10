import PDFDocument from "pdfkit";

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
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
