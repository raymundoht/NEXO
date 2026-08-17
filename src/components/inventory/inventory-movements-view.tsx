"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, PackagePlus, PackageMinus, Search, SlidersHorizontal } from "lucide-react";
import { apiFetch, formatDate, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { useSessionUser } from "@/components/layout/user-context";

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: string;
};

type Movement = {
  id: string;
  type: string;
  quantity: string;
  stockBefore: string;
  stockAfter: string;
  unitCost?: string | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string };
  user: { id: string; name: string };
};

const movementLabels: Record<string, string> = {
  PURCHASE_RECEIPT: "Recepción de compra",
  SALE: "Venta",
  REFUND: "Reembolso",
  INVENTORY_ADJUSTMENT: "Conteo físico",
  MANUAL_ADJUSTMENT: "Ajuste manual"
};

export function InventoryMovementsView() {
  const user = useSessionUser();
  const canAdjust = user.permissions.includes("inventory.write");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (productId) params.set("productId", productId);
      if (type) params.set("type", type);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [productResult, movementResult] = await Promise.all([
        apiFetch<{ items: Product[] }>("/api/products?pageSize=500"),
        apiFetch<{ items: Movement[] }>(
          `/api/inventory/movements?${params.toString()}`
        )
      ]);
      setProducts(productResult.items);
      setMovements(movementResult.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, [from, productId, to, type]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = data.get("adjustmentType") as string;
    const rawQty = Number(data.get("quantity"));
    const quantity = type === "EXIT" ? -rawQty : rawQty;
    try {
      await apiFetch("/api/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          productId: data.get("productId"),
          quantity,
          reason: data.get("reason")
        })
      });
      form.reset();
      setMessage("Ajuste registrado en el kardex y en la bitácora.");
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible ajustar.");
    }
  }

  const visible = movements.filter((movement) => {
    const q = search.trim().toLocaleLowerCase();
    if (!q) return true;
    return [
      movement.product.name,
      movement.product.sku,
      movement.reason || "",
      movement.user.name
    ].some((value) => value.toLocaleLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trazabilidad de almacén"
        title="Kardex y ajustes"
        description="Consulta cada entrada y salida con existencias antes y después, referencia, responsable y costo."
      />
      <Notice message={error} type="error" />
      <Notice message={message} type="success" />

      {canAdjust ? (
        <div className="card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
              <ArrowLeftRight size={19} />
            </span>
            <div>
              <h2 className="font-semibold">Ajuste de inventario</h2>
              <p className="text-xs text-[var(--muted)]">
                Registra entradas o salidas de producto con un motivo auditado.
              </p>
            </div>
          </div>
          <form className="mt-5" onSubmit={adjust}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="label">Producto</span>
                <select className="field" name="productId" required>
                  <option value="">Seleccionar producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name} ({product.currentStock} {product.unit})
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2">
                <span className="label">Tipo de ajuste</span>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[var(--border)] p-4 transition has-[:checked]:border-[var(--success)] has-[:checked]:bg-[var(--success-tint)]">
                    <input className="sr-only" name="adjustmentType" required type="radio" value="ENTRY" />
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]">
                      <PackagePlus size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--success)]">Entrada</p>
                      <p className="text-[10px] text-[var(--muted)]">Recepción, devolución, reposición</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[var(--border)] p-4 transition has-[:checked]:border-[var(--danger)] has-[:checked]:bg-[var(--danger-tint)]">
                    <input className="sr-only" name="adjustmentType" type="radio" value="EXIT" />
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--danger-tint)] text-[var(--danger)]">
                      <PackageMinus size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--danger)]">Salida</p>
                      <p className="text-[10px] text-[var(--muted)]">Daño, merma, vencimiento</p>
                    </div>
                  </label>
                </div>
              </div>

              <label>
                <span className="label">Cantidad</span>
                <input
                  className="field"
                  min="1"
                  name="quantity"
                  placeholder="1"
                  required
                  step="1"
                  type="number"
                />
                <span className="mt-0.5 block text-[10px] leading-tight text-[var(--muted)]">Solo cantidades enteras (1, 2, 3...).</span>
              </label>

              <label>
                <span className="label">Motivo (mínimo 10 caracteres)</span>
                <input className="field" minLength={10} name="reason" placeholder="Ej: Recepción de compra PO-001" required />
                <span className="mt-0.5 block text-[10px] leading-tight text-[var(--muted)]">Describe el motivo para trazabilidad.</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-primary">Registrar ajuste</button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[1.2fr_1fr_190px_170px_170px]">
          <label className="relative self-end">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={17}
            />
            <input
              className="field !pl-10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar en resultados"
              value={search}
            />
          </label>
          <label>
            <span className="label">Producto</span>
            <select
              className="field"
              onChange={(event) => setProductId(event.target.value)}
              value={productId}
            >
              <option value="">Todos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Movimiento</span>
            <select
              className="field"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <option value="">Todos</option>
              {Object.entries(movementLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Desde</span>
            <input
              className="field"
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label>
            <span className="label">Hasta</span>
            <input
              className="field"
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </label>
        </div>
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
          <SlidersHorizontal size={14} /> {visible.length} movimientos visibles
        </div>
        {loading ? (
          <div className="skeleton h-80" />
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th>Variación</th>
                  <th>Antes / Después</th>
                  <th>Costo</th>
                  <th>Responsable / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <p className="font-semibold">{movement.product.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {movement.product.sku}
                      </p>
                    </td>
                    <td>{movementLabels[movement.type] || movement.type}</td>
                    <td
                      className={
                        Number(movement.quantity) < 0
                          ? "font-semibold text-[var(--danger)]"
                          : "font-semibold text-[var(--success)]"
                      }
                    >
                      {Number(movement.quantity) > 0 ? "+" : ""}
                      {movement.quantity}
                    </td>
                    <td>
                      {movement.stockBefore} → {movement.stockAfter}
                    </td>
                    <td>
                      {movement.unitCost
                        ? formatMoney(movement.unitCost)
                        : "N/D"}
                    </td>
                    <td>
                      <p>{movement.user.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {movement.reason || "Sin motivo"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="Los movimientos de compras, ventas, reembolsos, conteos y ajustes aparecerán aquí."
            title="Sin movimientos"
          />
        )}
      </section>
    </div>
  );
}
