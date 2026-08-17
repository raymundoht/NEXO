"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Ban, FileDown, RotateCcw, Ticket, X } from "lucide-react";
import { apiFetch, formatDate, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSessionUser } from "@/components/layout/user-context";

type Sale = {
  id: string;
  folio: string;
  status: string;
  total: string;
  currency: string;
  paymentMethod?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  cashSessionId?: string | null;
  createdAt: string;
  cashier: { name: string };
  cashRegister?: { code: string; name: string } | null;
  _count: { items: number; refunds: number };
};
type SaleDetail = Sale & {
  items: Array<{
    id: string;
    nameSnapshot: string;
    skuSnapshot: string;
    quantity: string;
    unitPrice: string;
    discountAmount: string;
    lineTax: string;
    lineTotal: string;
    quantityRefunded: number;
    quantityAvailableToRefund: number;
  }>;
  refunds: Array<{ id: string; folio: string; amount: string; reason: string; createdAt: string }>;
};
type OpenCashSession = {
  id: string;
  currency: string;
  cashRegister: { code: string; name: string };
  cashier: { name: string };
};

export function SalesView() {
  const user = useSessionUser();
  const canRefund = user.permissions.includes("sales.refund");
  const canCancel = user.permissions.includes("sales.cancel");
  const canExport = user.permissions.includes("sales.export");
  const [items, setItems] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cashSessions, setCashSessions] = useState<OpenCashSession[]>([]);
  const [refunding, setRefunding] = useState(false);
  const refundRequestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiFetch<{ items: Sale[] }>(`/api/sales?${params}`);
      setItems(result.items);
      if (canRefund || canCancel) {
        const sessionResult = await apiFetch<{ items: OpenCashSession[] }>(
          "/api/cash-sessions?open=true&pageSize=100"
        );
        setCashSessions(sessionResult.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, [canCancel, canRefund, from, status, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    try {
      setSelected(await apiFetch<SaleDetail>(`/api/sales/${id}`));
      refundRequestId.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible consultar.");
    }
  }

  async function refund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "CANCEL" ? "CANCEL" : "REFUND";
    const refundItems = selected.items
      .map((line) => ({
        saleItemId: line.id,
        quantity: Number(form.get(`quantity-${line.id}`) || 0)
      }))
      .filter((line) => line.quantity > 0);
    refundRequestId.current ||= crypto.randomUUID();
    setRefunding(true);
    setError("");
    try {
      const endpoint =
        selected.paymentMethod === "CARD"
          ? "/api/stripe/refund"
          : `/api/sales/${selected.id}/refund`;
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          clientRequestId: refundRequestId.current,
          saleId: selected.id,
          mode,
          reason: form.get("reason"),
          cashSessionId: form.get("cashSessionId") || undefined,
          authorizationCode: form.get("authorizationCode") || undefined,
          items: mode === "CANCEL" ? [] : refundItems
        })
      });
      setMessage(
        mode === "CANCEL"
          ? "Venta cancelada bajo supervisión y movimientos revertidos."
          : "Reembolso autorizado y existencias restauradas."
      );
      setSelected(null);
      refundRequestId.current = null;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible reembolsar.");
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trazabilidad comercial"
        title="Historial de ventas"
        description="Consulta transacciones, reimprime comprobantes y supervisa reembolsos."
        actions={
          canExport ? (
            <>
              <a className="btn btn-secondary" href={`/api/reports/sales?format=csv&from=${from}&to=${to}`}><FileDown size={16} /> CSV</a>
              <a className="btn btn-primary" href={`/api/reports/sales?format=pdf&from=${from}&to=${to}`}><FileDown size={16} /> PDF</a>
            </>
          ) : undefined
        }
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_170px_170px]">
          <label>
            <span className="label">Estado</span>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option><option value="COMPLETED">Completadas</option><option value="HELD">En espera</option><option value="PARTIALLY_REFUNDED">Reembolso parcial</option><option value="REFUNDED">Reembolsadas</option><option value="CANCELLED">Canceladas</option>
            </select>
          </label>
          <label><span className="label">Desde</span><input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">Hasta</span><input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {loading ? <div className="skeleton h-80" /> : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Folio</th><th>Fecha</th><th>Caja / Cajero</th><th>Pago</th><th>Total</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {items.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-semibold">{sale.folio}</td>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td><p>{sale.cashRegister?.code || "—"}</p><p className="text-[11px] text-[var(--muted)]">{sale.cashier.name}</p></td>
                    <td>{sale.paymentMethod || "—"}</td>
                    <td className="font-semibold">{formatMoney(sale.total, sale.currency)}</td>
                    <td><StatusBadge status={sale.status} /></td>
                    <td><button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => open(sale.id)}>Detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin ventas registradas" description={status ? "No hay ventas con ese filtro." : "Tus ventas de los últimos 7 días aparecerán aquí. Realiza tu primera venta en el POS."} />}
      </section>

      {selected ? (
        <section className="card p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <StatusBadge status={selected.status} />
              <h2 className="mt-2 text-xl font-bold">{selected.folio}</h2>
              <p className="text-xs text-[var(--muted)]">{formatDate(selected.createdAt)} · {selected.cashier.name}</p>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]" onClick={() => setSelected(null)}><X size={18} /></button>
          </div>
          <div className="table-wrap mt-5 rounded-2xl border border-[var(--border)]">
            <table className="data-table">
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Impuesto</th><th>Importe</th>{canRefund ? <th>Disponible</th> : null}</tr></thead>
              <tbody>
                {selected.items.map((line) => (
                  <tr key={line.id}>
                    <td><p className="font-semibold">{line.nameSnapshot}</p><p className="text-[11px] text-[var(--muted)]">{line.skuSnapshot}</p></td>
                    <td>{line.quantity}</td><td>{formatMoney(line.unitPrice, selected.currency)}</td><td>{formatMoney(line.discountAmount, selected.currency)}</td><td>{formatMoney(line.lineTax, selected.currency)}</td><td>{formatMoney(line.lineTotal, selected.currency)}</td>
                    {canRefund ? <td><p className="mb-1 text-[10px] text-[var(--muted)]">{line.quantityAvailableToRefund} disponibles</p><input className="field !w-28" form="refund-form" max={line.quantityAvailableToRefund} min="0" name={`quantity-${line.id}`} step="0.001" type="number" defaultValue="0" disabled={line.quantityAvailableToRefund <= 0} /></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
             <a className="btn btn-secondary" href={`/api/sales/${selected.id}/ticket`} target="_blank" rel="noopener"><Ticket size={16} /> Descargar ticket PDF</a>
            <div className="space-y-1 text-right text-xs text-[var(--muted)]">
              <p>Subtotal: {formatMoney(selected.subtotal, selected.currency)}</p>
              <p>Descuentos: {formatMoney(selected.discountTotal, selected.currency)}</p>
              <p>Impuestos: {formatMoney(selected.taxTotal, selected.currency)}</p>
              <p className="text-2xl font-bold text-[var(--text)]">{formatMoney(selected.total, selected.currency)}</p>
              <p>Pago: {selected.paymentMethod || "En espera"} · Caja: {selected.cashRegister?.code || "N/D"} · Cajero: {selected.cashier.name}</p>
            </div>
          </div>
          {selected.refunds.length ? (
            <div className="mt-5 rounded-2xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold">
                Reembolsos y reversiones
              </h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {selected.refunds.map((item) => (
                  <div className="subtle-card p-3" key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold">{item.folio}</p>
                      <p className="text-xs font-bold text-[var(--danger)]">
                        -{formatMoney(item.amount, selected.currency)}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {formatDate(item.createdAt)} · {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {canRefund && ["COMPLETED", "PARTIALLY_REFUNDED"].includes(selected.status) ? (
            <div className="mt-5 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-tint)] p-4">
              <form id="refund-form" onSubmit={refund}>
                <div className="mb-3 flex items-center gap-2 font-semibold text-[var(--danger)]"><RotateCcw size={17} /> Reembolso supervisado</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label><span className="label">Motivo (mínimo 10 caracteres)</span><input className="field" name="reason" minLength={10} required /></label>
                  {selected.paymentMethod === "CASH" ? (
                    <label><span className="label">Caja abierta para devolver efectivo</span><select className="field" name="cashSessionId" required><option value="">Seleccionar</option>{cashSessions.map((session) => <option key={session.id} value={session.id}>{session.cashRegister.code} · {session.cashier.name} · {session.currency}</option>)}</select></label>
                  ) : <p className="self-end text-xs text-[var(--muted)]">La devolución se enviará al pago original mediante Stripe.</p>}
                  <div className="flex items-end gap-2">
                    <button className="btn btn-danger flex-1" disabled={refunding} name="mode" value="REFUND"><RotateCcw size={16} /> Reembolsar selección</button>
                    {canCancel ? <button className="btn btn-secondary flex-1" disabled={refunding} name="mode" value="CANCEL"><Ban size={16} /> Cancelar completa</button> : null}
                  </div>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
