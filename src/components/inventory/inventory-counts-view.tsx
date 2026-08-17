"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ClipboardCheck, CirclePlus, X } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CountSummary = {
  id: string;
  folio: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdBy: { name: string };
  completedBy?: { name: string } | null;
  _count: { items: number };
};
type CountDetail = CountSummary & {
  items: Array<{
    id: string;
    systemQuantity: string;
    countedQuantity?: string | null;
    difference?: string | null;
    notes?: string | null;
    product: { id: string; sku: string; name: string; unit: string };
  }>;
};

export function InventoryCountsView() {
  const [counts, setCounts] = useState<CountSummary[]>([]);
  const [selected, setSelected] = useState<CountDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ items: CountSummary[] }>("/api/inventory-counts?pageSize=100");
      setCounts(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    try {
      const count = await apiFetch<CountDetail>("/api/inventory-counts", {
        method: "POST",
        body: JSON.stringify({ notes: "Conteo físico general" })
      });
      setSelected(count);
      setMessage(`Conteo ${count.folio} iniciado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar.");
    }
  }

  async function open(id: string) {
    try {
      setSelected(await apiFetch<CountDetail>(`/api/inventory-counts/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible abrir.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/inventory-counts/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          items: selected.items.map((line) => ({
            id: line.id,
            countedQuantity: form.get(`count-${line.id}`),
            notes: form.get(`notes-${line.id}`) || null
          }))
        })
      });
      setMessage("Cantidades guardadas.");
      await open(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar.");
    }
  }

  async function complete() {
    if (!selected) return;
    const formElement = document.querySelector<HTMLFormElement>("#inventory-count-form");
    if (!formElement) return;
    const form = new FormData(formElement);
    try {
      await apiFetch(`/api/inventory-counts/${selected.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          items: selected.items.map((line) => ({
            id: line.id,
            countedQuantity: form.get(`count-${line.id}`),
            notes: form.get(`notes-${line.id}`) || null
          }))
        })
      });
      setMessage("Conteo cerrado y ajustes auditados.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cerrar.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Auditoría de stock"
        title="Conteos físicos"
        description="Compara existencias del sistema con cantidades físicas y aplica diferencias de manera controlada."
        actions={<button className="btn btn-primary" onClick={create}><CirclePlus size={17} /> Iniciar conteo general</button>}
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      {selected ? (
        <form className="card overflow-hidden" id="inventory-count-form" onSubmit={save}>
          <div className="flex items-start justify-between border-b border-[var(--border)] p-5">
            <div><StatusBadge status={selected.status} /><h2 className="mt-2 text-lg font-bold">{selected.folio}</h2><p className="text-xs text-[var(--muted)]">{selected.items.length} productos</p></div>
            <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]" onClick={() => setSelected(null)} type="button"><X size={18} /></button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Producto</th><th>Sistema</th><th>Conteo físico</th><th>Notas</th></tr></thead>
              <tbody>{selected.items.map((line) => (
                <tr key={line.id}>
                  <td><p className="font-semibold">{line.product.name}</p><p className="text-[11px] text-[var(--muted)]">{line.product.sku}</p></td>
                  <td>{line.systemQuantity} {line.product.unit}</td>
                  <td><input className="field !w-36" defaultValue={line.countedQuantity ?? ""} disabled={selected.status !== "IN_PROGRESS"} min="0" name={`count-${line.id}`} required step="0.001" type="number" /></td>
                  <td><input className="field min-w-64" defaultValue={line.notes ?? ""} disabled={selected.status !== "IN_PROGRESS"} name={`notes-${line.id}`} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {selected.status === "IN_PROGRESS" ? (
            <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:justify-end">
              <button className="btn btn-secondary">Guardar avance</button>
              <button className="btn btn-primary" onClick={() => setShowCompleteConfirm(true)} type="button"><ClipboardCheck size={17} /> Cerrar conteo</button>
            </div>
          ) : null}
        </form>
      ) : null}
      <section className="card overflow-hidden">
        {loading ? <div className="skeleton h-64" /> : counts.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Folio</th><th>Fecha</th><th>Productos</th><th>Responsable</th><th>Estado</th><th></th></tr></thead>
              <tbody>{counts.map((count) => (
                <tr key={count.id}>
                  <td className="font-semibold">{count.folio}</td><td>{formatDate(count.createdAt)}</td><td>{count._count.items}</td><td>{count.createdBy.name}</td><td><StatusBadge status={count.status} /></td>
                  <td><button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => open(count.id)}>Abrir</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin conteos físicos" description="Inicia un conteo general para auditar las existencias." />}
      </section>
      <ConfirmDialog
        open={showCompleteConfirm}
        title="Cerrar conteo"
        message="¿Cerrar el conteo y aplicar todas las diferencias al inventario?"
        confirmLabel="Cerrar y aplicar"
        variant="danger"
        onConfirm={() => { setShowCompleteConfirm(false); complete(); }}
        onCancel={() => setShowCompleteConfirm(false)}
      />
    </div>
  );
}
