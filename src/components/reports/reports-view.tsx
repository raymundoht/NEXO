"use client";

import { useEffect, useState } from "react";
import { FileDown, ReceiptText, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useSessionUser } from "@/components/layout/user-context";
import { apiFetch } from "@/lib/client-api";

export function ReportsView() {
  const user = useSessionUser();
  const canExportPurchases = user.permissions.includes("purchases.export");
  const canExportSales = user.permissions.includes("sales.export");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; code: string; legalName: string }>
  >([]);

  useEffect(() => {
    if (!canExportPurchases) return;
    apiFetch<{
      items: Array<{ id: string; code: string; legalName: string }>;
    }>("/api/suppliers?pageSize=100")
      .then((result) => setSuppliers(result.items))
      .catch(() => setSuppliers([]));
  }, [canExportPurchases]);

  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(supplierId ? { supplierId } : {})
  }).toString();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Información transaccional" title="Reportes y exportaciones" description="Genera historiales estándar en CSV o PDF con filtros por rango de fechas." />
      <section className="card grid gap-4 p-5 md:grid-cols-3 md:p-6">
        <label><span className="label">Desde</span><input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">Hasta</span><input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {canExportPurchases ? (
          <label>
            <span className="label">Proveedor (compras)</span>
            <select className="field" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} · {supplier.legalName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {canExportSales ? (
          <ReportCard
            description="Folio, fecha, artículos, descuentos, impuestos, método de pago, caja y cajero."
            icon={<ShoppingBag size={23} />}
            title="Historial de ventas"
            csv={`/api/reports/sales?format=csv&${query}`}
            pdf={`/api/reports/sales?format=pdf&${query}`}
          />
        ) : null}
        {canExportPurchases ? (
          <ReportCard
            description="Orden, proveedor, artículos, cantidades, costos unitarios, comprador y recepción."
            icon={<ReceiptText size={23} />}
            title="Historial de compras"
            csv={`/api/reports/purchases?format=csv&${query}`}
            pdf={`/api/reports/purchases?format=pdf&${query}`}
          />
        ) : null}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--muted)]">
        Los archivos se generan directamente desde la información vigente. Las exportaciones CSV incluyen protección contra fórmulas y los PDF no contienen credenciales ni datos sensibles de tarjetas.
      </div>
    </div>
  );
}

function ReportCard({ icon, title, description, csv, pdf }: { icon: React.ReactNode; title: string; description: string; csv: string; pdf: string }) {
  return (
    <section className="card p-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">{icon}</span>
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-5 flex gap-2">
        <a className="btn btn-secondary flex-1" href={csv}><FileDown size={16} /> CSV</a>
        <a className="btn btn-primary flex-1" href={pdf}><FileDown size={16} /> PDF</a>
      </div>
    </section>
  );
}
