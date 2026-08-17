"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  WalletCards
} from "lucide-react";
import { apiFetch, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";

type DashboardData = {
  currency: string;
  visibility: {
    sales: boolean;
    inventory: boolean;
    purchases: boolean;
    cash: boolean;
  };
  metrics: {
    todaySales: string;
    todayTransactions: number;
    lowStock: number;
    highStock: number;
    openPurchases: number;
    openCashSessions: number;
  };
  stockAlerts: Array<{
    id: string;
    sku: string;
    name: string;
    currentStock: string;
    minStock: string;
  }>;
  salesTrend: Array<{ date: string; total: string }>;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: string;
    total: string;
  }>;
};

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const maxTrend = useMemo(
    () =>
      Math.max(1, ...(data?.salesTrend.map((item) => Number(item.total)) || [1])),
    [data]
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Vista general"
        title="Tu operación, de un vistazo"
        description="Ventas, alertas y actividad operativa concentradas en una sola vista."
      />
      <Notice type="error" message={error} />
      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton h-36 rounded-[20px]" key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.visibility.sales ? <MetricCard
              color="var(--color-accent)"
              icon={<CircleDollarSign size={21} />}
              label="Ventas de hoy"
               value={formatMoney(data.metrics.todaySales, data.currency)}
              caption={`${data.metrics.todayTransactions} transacciones`}
            /> : null}
            {data.visibility.purchases ? <MetricCard
              color="var(--color-success)"
              icon={<ShoppingBag size={21} />}
              label="Órdenes pendientes"
              value={String(data.metrics.openPurchases)}
              caption="Por recibir"
            /> : null}
            {data.visibility.inventory ? <MetricCard
              color="var(--color-warning)"
              icon={<Boxes size={21} />}
              label="Stock bajo"
              value={String(data.metrics.lowStock)}
              caption="Productos por reabastecer"
            /> : null}
            {data.visibility.cash ? <MetricCard
              color="var(--color-info)"
              icon={<WalletCards size={21} />}
              label="Cajas abiertas"
              value={String(data.metrics.openCashSessions)}
              caption="Sesiones activas"
            /> : null}
          </div>

          {data.visibility.sales ? <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <section className="card p-5 md:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">Ventas de los últimos 7 días</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Importe diario procesado
                  </p>
                </div>
                <span className="badge">
                  <ArrowUpRight size={13} /> Semana
                </span>
              </div>
              <div className="mt-7 grid h-60 grid-cols-7 items-end gap-2 md:gap-4">
                {data.salesTrend.map((item) => {
                  const height = Math.max(
                    7,
                    (Number(item.total) / maxTrend) * 100
                  );
                  return (
                    <div
                      className="group flex h-full flex-col items-center justify-end"
                      key={item.date}
                       title={`${item.date}: ${formatMoney(item.total, data.currency)}`}
                    >
                      <span className="mb-2 hidden text-[10px] font-semibold text-[var(--muted)] group-hover:block md:block">
                        {Number(item.total) > 0
                           ? formatMoney(Math.round(Number(item.total)), data.currency)
                          : "—"}
                      </span>
                      <div
                        className="w-full max-w-12 rounded-t-xl bg-gradient-to-t from-[var(--primary)] to-[var(--color-accent)] transition hover:opacity-80"
                        style={{ height: `${height}%` }}
                      />
                      <span className="mt-2 text-[10px] capitalize text-[var(--muted)]">
                        {new Intl.DateTimeFormat("es-MX", {
                          weekday: "short"
                        }).format(new Date(`${item.date}T12:00:00`))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Productos destacados</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Mayor rotación semanal
                  </p>
                </div>
                <ReceiptText size={19} className="text-[var(--primary)]" />
              </div>
              <div className="mt-5 space-y-3">
                {data.topProducts.length ? (
                  data.topProducts.map((product, index) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3"
                      key={product.productId}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-tint)] text-xs font-bold text-[var(--primary)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {product.quantity} unidades
                        </p>
                      </div>
                      <p className="text-xs font-semibold">
                         {formatMoney(product.total, data.currency)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Aún no hay ventas"
                    description="El ranking se generará con las primeras transacciones."
                  />
                )}
              </div>
            </section>
          </div> : null}

          {data.visibility.inventory ? <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5 md:px-6">
              <div>
                <h2 className="font-semibold">Alertas de inventario</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Productos en o por debajo del mínimo
                </p>
              </div>
              <span className="badge !bg-[var(--warning-tint)] !text-[var(--warning)]">
                <ArrowDownToLine size={13} /> {data.metrics.lowStock} alertas
              </span>
            </div>
            {data.stockAlerts.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>SKU</th>
                      <th>Existencia</th>
                      <th>Mínimo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockAlerts.map((product) => (
                      <tr key={product.id}>
                        <td className="font-semibold">{product.name}</td>
                        <td className="text-[var(--muted)]">{product.sku}</td>
                        <td>{product.currentStock}</td>
                        <td>{product.minStock}</td>
                        <td>
                          <span className="badge !bg-[var(--danger-tint)] !text-[var(--danger)]">
                            Reabastecer
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Inventario saludable"
                description="No hay productos por debajo de su nivel mínimo."
              />
            )}
          </section> : null}
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 13%, transparent)`
          }}
        >
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Hoy
        </span>
      </div>
      <p className="mt-5 text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">{caption}</p>
    </div>
  );
}
