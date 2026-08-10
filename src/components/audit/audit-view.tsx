"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";

type AuditRow = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
  metadata?: Record<string, unknown> | null;
};

export function AuditView() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ items: AuditRow[] }>(`/api/audit-logs?pageSize=100&action=${encodeURIComponent(action)}`);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Ciberseguridad" title="Bitácora de auditoría" description="Actividad sensible de acceso, usuarios, inventario, compras, caja y ventas." />
      <Notice type="error" message={error} />
      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] p-4"><div className="relative max-w-lg"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} /><input className="field !pl-10" placeholder="Filtrar por acción" value={action} onChange={(e) => setAction(e.target.value)} /></div></div>
        {loading ? <div className="skeleton h-72" /> : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Entidad</th><th>Referencia</th></tr></thead>
              <tbody>{items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td><span className="badge"><ShieldCheck size={13} /> {actionLabel(row.action)}</span></td>
                  <td><p>{row.user?.name || "Sistema / anónimo"}</p><p className="text-[11px] text-[var(--muted)]">{row.user?.email || "—"}</p></td>
                  <td>{row.entityType || "—"}</td><td className="max-w-52 truncate font-mono text-[11px] text-[var(--muted)]">{row.entityId || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin eventos" description="No hay actividad que coincida con el filtro." />}
      </section>
    </div>
  );
}

function actionLabel(action: string) {
  return action.toLowerCase().replaceAll("_", " ");
}
