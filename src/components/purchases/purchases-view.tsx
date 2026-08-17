"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CirclePlus, FileDown, Minus, PackageCheck, Plus, Sparkles, X } from "lucide-react";
import { apiFetch, formatDate, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSessionUser } from "@/components/layout/user-context";

type Supplier = { id: string; code: string; legalName: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  cost: string;
  taxRate: string;
  currentStock: string;
  minStock: string;
  maxStock?: string | null;
};
type Order = {
  id: string;
  folio: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  supplierCodeSnapshot: string;
  supplierNameSnapshot: string;
  buyerNameSnapshot: string;
  supplier: Supplier;
  buyer: { name: string };
  _count: { items: number; receipts: number };
};
type OrderDetail = Order & {
  items: Array<{
    id: string;
    quantityOrdered: string;
    quantityReceived: string;
    unitCost: string;
    skuSnapshot: string;
    nameSnapshot: string;
    unitSnapshot: string;
    product: Product;
  }>;
  receipts: Array<{
    id: string;
    receiptNumber: string;
    receivedAt: string;
    supplierDocument?: string | null;
    receivedBy: { name: string };
    items: Array<{
      id: string;
      quantity: string;
      unitCost: string;
      purchaseOrderItem: {
        skuSnapshot: string;
        nameSnapshot: string;
        unitSnapshot: string;
      };
    }>;
  }>;
};
type SupplierDetail = Supplier & {
  productPrices: Array<{
    productId: string;
    referenceCost: string;
    currency: string;
    isPreferred: boolean;
    allocatedQty?: string | null;
    totalReceived?: string | null;
    availableQty?: string | null;
  }>;
};

export function PurchasesView() {
  const user = useSessionUser();
  const canCreate = user.permissions.includes("purchases.write");
  const canReceive = user.permissions.includes("purchases.receive");
  const canExport = user.permissions.includes("purchases.export");
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [lines, setLines] = useState([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [orderCurrency, setOrderCurrency] = useState("MXN");
  const [purchaseExchangeRate, setPurchaseExchangeRate] = useState("1");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [saving, setSaving] = useState(false);
  const createRequestId = useRef<string | null>(null);
  const receiveRequestId = useRef<string | null>(null);
  const [quotaMap, setQuotaMap] = useState<Map<string, { allocated: number; received: number; available: number }>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (supplierFilter) params.set("supplierId", supplierFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [orderResult, supplierResult, productResult] = await Promise.all([
        apiFetch<{ items: Order[] }>(`/api/purchase-orders?${params.toString()}`),
        apiFetch<{ items: Supplier[] }>("/api/suppliers?pageSize=100&active=true"),
        apiFetch<{ items: Product[] }>("/api/products?pageSize=500")
      ]);
      setOrders(orderResult.items);
      setSuppliers(supplierResult.items);
      setProducts(productResult.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, [from, supplierFilter, to]);

  useEffect(() => {
    load();
  }, [load]);

  function updateLine(index: number, field: "productId" | "quantity" | "unitCost", value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (field === "productId") {
          const product = products.find((item) => item.id === value);
          return { ...line, productId: value, unitCost: Number(product?.cost || 0) };
        }
        return { ...line, [field]: Number(value) };
      })
    );
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createRequestId.current ||= crypto.randomUUID();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          clientRequestId: createRequestId.current,
          supplierId: form.get("supplierId"),
          currency: form.get("currency"),
          exchangeRate: form.get("exchangeRate"),
          expectedAt: form.get("expectedAt") || null,
          notes: form.get("notes") || null,
          sendNow: true,
          items: lines
        })
      });
      setShowForm(false);
      setLines([{ productId: "", quantity: 1, unitCost: 0 }]);
      setDraftNotes("");
      setOrderCurrency("MXN");
      setPurchaseExchangeRate("1");
      setSelectedSupplierId("");
      createRequestId.current = null;
      setMessage("Orden de compra emitida.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible emitir.");
    } finally {
      setSaving(false);
    }
  }

  function createFromShortages() {
    const shortages = products.filter(
      (product) => Number(product.currentStock) <= Number(product.minStock)
    );
    if (!shortages.length) {
      setMessage("No hay productos en nivel mínimo o por debajo.");
      return;
    }
    setLines(
      shortages.map((product) => {
        const current = Number(product.currentStock);
        const target = product.maxStock
          ? Number(product.maxStock)
          : Math.max(Number(product.minStock), current + 1);
        return {
          productId: product.id,
          quantity: Math.max(0.001, target - current),
          unitCost: Number(product.cost)
        };
      })
    );
    setDraftNotes(
      `Orden preparada desde ${shortages.length} faltantes detectados en Almacén.`
    );
    setShowForm(true);
    createRequestId.current = null;
    setSelected(null);
    setMessage("Faltantes cargados. Selecciona el proveedor y confirma costos.");
  }

  async function applySupplierPrices(
    supplierId: string,
    requestedCurrency = orderCurrency
  ) {
    if (!supplierId) return;
    try {
      const supplier = await apiFetch<SupplierDetail>(
        `/api/suppliers/${supplierId}`
      );
      const prices = new Map(
        supplier.productPrices
          .filter((price) => price.currency === requestedCurrency)
          .map((price) => [price.productId, Number(price.referenceCost)])
      );
      setLines((current) =>
        current.map((line) => ({
          ...line,
          unitCost: prices.get(line.productId) ?? line.unitCost
        }))
      );
      // Build quota map
      const newQuotaMap = new Map<string, { allocated: number; received: number; available: number }>();
      for (const sp of supplier.productPrices) {
        if (sp.allocatedQty != null) {
          newQuotaMap.set(sp.productId, {
            allocated: Number(sp.allocatedQty),
            received: Number(sp.totalReceived || 0),
            available: Number(sp.availableQty || 0)
          });
        }
      }
      setQuotaMap(newQuotaMap);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible consultar precios de referencia."
      );
    }
  }

  async function openOrder(id: string) {
    try {
      setSelected(await apiFetch<OrderDetail>(`/api/purchase-orders/${id}`));
      receiveRequestId.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible consultar.");
    }
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const items = selected.items
      .map((line) => ({
        purchaseOrderItemId: line.id,
        quantity: Number(form.get(`quantity-${line.id}`) || 0),
        unitCost: Number(line.unitCost)
      }))
      .filter((line) => line.quantity > 0);
    if (!items.length) {
      setError("Captura al menos una cantidad mayor a cero.");
      return;
    }
    if (!window.confirm(`Se registrará la recepción de ${items.length} partida(s). ¿Continuar?`)) {
      return;
    }
    receiveRequestId.current ||= crypto.randomUUID();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/purchase-orders/${selected.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          clientRequestId: receiveRequestId.current,
          supplierDocument: form.get("supplierDocument") || null,
          notes: form.get("notes") || null,
          items
        })
      });
      setSelected(null);
      receiveRequestId.current = null;
      setMessage("Recepción registrada y existencias actualizadas.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible recibir.");
    } finally {
      setSaving(false);
    }
  }

  const estimatedTotal = useMemo(
    () => lines.reduce((total, line) => total + line.quantity * line.unitCost, 0),
    [lines]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Abastecimiento"
        title="Órdenes de compra"
        description="Emisión, seguimiento y validación de recepciones contra el pedido original."
        actions={
          canCreate ? (
            <>
              <button className="btn btn-secondary" onClick={createFromShortages}>
                <Sparkles size={17} /> Desde faltantes
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm((v) => {
                if (v) createRequestId.current = null;
                return !v;
              })}>
                {showForm ? <X size={17} /> : <CirclePlus size={17} />}
                {showForm ? "Cerrar" : "Nueva orden"}
              </button>
            </>
          ) : undefined
        }
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />

      {showForm ? (
        <form className="card p-5 md:p-6" onSubmit={createOrder}>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="md:col-span-2">
              <span className="label">Proveedor</span>
              <select className="field" name="supplierId" value={selectedSupplierId} onChange={(event) => {
                setSelectedSupplierId(event.target.value);
                void applySupplierPrices(event.target.value);
              }} required>
                <option value="">Seleccionar</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.legalName}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Moneda</span>
              <select className="field" name="currency" value={orderCurrency} onChange={(event) => {
                const nextCurrency = event.target.value;
                setOrderCurrency(nextCurrency);
                setPurchaseExchangeRate("1");
                if (selectedSupplierId) void applySupplierPrices(selectedSupplierId, nextCurrency);
              }}><option>MXN</option><option>USD</option></select>
            </label>
            <Input label="Tipo de cambio" name="exchangeRate" type="number" min="0.000001" step="0.000001" value={purchaseExchangeRate} onChange={(event) => setPurchaseExchangeRate(event.target.value)} required />
            <Input label="Entrega esperada" name="expectedAt" type="date" />
            <Input label="Notas" name="notes" className="md:col-span-3" value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} />
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-3">
              <p className="text-sm font-semibold">Partidas</p>
              <button
                className="btn btn-secondary !min-h-8 !px-3 !py-1 text-xs"
                onClick={() => setLines((current) => [...current, { productId: "", quantity: 1, unitCost: 0 }])}
                type="button"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div className="space-y-3 p-4">
              {lines.map((line, index) => {
                const quota = line.productId ? quotaMap.get(line.productId) : undefined;
                const exceedsQuota = quota && (quota.received + line.quantity) > quota.allocated;
                return (
                  <div key={index}>
                    <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_40px]">
                      <select className="field" required value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                        <option value="">Selecciona un producto</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                      </select>
                       <input className="field" min="0.001" step="0.001" type="number" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                       <input className="field" min="0" step="0.0001" type="number" value={line.unitCost} onChange={(e) => updateLine(index, "unitCost", e.target.value)} />
                      <button
                        aria-label="Quitar partida"
                        className="grid h-10 w-10 place-items-center rounded-xl text-[var(--danger)] hover:bg-[var(--danger-tint)]"
                        disabled={lines.length === 1}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                        type="button"
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                    {quota && (
                      <p className={`mt-1 text-[11px] ${exceedsQuota ? "text-[var(--warning)] font-semibold" : "text-[var(--muted)]"}`}>
                        Cuota: {quota.available} de {quota.allocated} disponibles
                        {exceedsQuota && " — Se excede la cuota. Se notificará al proveedor."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">Subtotal estimado: <strong className="text-[var(--text)]">{formatMoney(estimatedTotal, orderCurrency)}</strong></p>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Emitiendo..." : "Emitir orden"}</button>
          </div>
        </form>
      ) : null}

      {selected ? (
        <section className="card p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="badge">{selected.folio}</span>
              <h2 className="mt-2 text-lg font-semibold">{selected.supplierNameSnapshot}</h2>
              <p className="text-xs text-[var(--muted)]">Orden emitida {formatDate(selected.createdAt)} · Comprador: {selected.buyerNameSnapshot}</p>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]" onClick={() => setSelected(null)}><X size={18} /></button>
          </div>
          <form className="mt-5" onSubmit={receive}>
            <div className="table-wrap rounded-2xl border border-[var(--border)]">
              <table className="data-table">
                <thead><tr><th>Producto</th><th>Costo unitario</th><th>Ordenado</th><th>Recibido</th><th>Pendiente</th><th>Recibir ahora</th></tr></thead>
                <tbody>
                  {selected.items.map((line) => {
                    const pending = Number(line.quantityOrdered) - Number(line.quantityReceived);
                    return (
                      <tr key={line.id}>
                        <td><p className="font-semibold">{line.nameSnapshot}</p><p className="text-[11px] text-[var(--muted)]">{line.skuSnapshot} · {line.unitSnapshot}</p></td>
                        <td>{formatMoney(line.unitCost, selected.currency)}</td><td>{line.quantityOrdered}</td><td>{line.quantityReceived}</td><td>{pending}</td>
                         <td><input className="field !w-32" defaultValue="0" disabled={!canReceive || pending <= 0} max={pending} min="0" name={`quantity-${line.id}`} step="0.001" type="number" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canReceive && ["SENT", "PARTIALLY_RECEIVED"].includes(selected.status) ? (
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                <Input label="Documento del proveedor" name="supplierDocument" />
                <Input label="Notas de recepción" name="notes" className="flex-1" />
                <button className="btn btn-primary" disabled={saving}><PackageCheck size={17} /> {saving ? "Registrando..." : "Validar recepción"}</button>
              </div>
            ) : null}
          </form>
          {selected.receipts.length ? (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <h3 className="text-sm font-semibold">Recepciones validadas</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {selected.receipts.map((receipt) => (
                  <div className="subtle-card p-3" key={receipt.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold">
                        {receipt.receiptNumber}
                      </p>
                      <span className="badge">
                        {receipt.items.length} partidas
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {formatDate(receipt.receivedAt)} · {receipt.receivedBy.name}
                      {receipt.supplierDocument
                        ? ` · Doc. ${receipt.supplierDocument}`
                        : ""}
                    </p>
                    <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                      {receipt.items.map((item) => (
                        <p className="text-[11px]" key={item.id}>
                          <span className="font-semibold">{item.purchaseOrderItem.nameSnapshot}</span>
                          {` · ${item.quantity} ${item.purchaseOrderItem.unitSnapshot} · ${formatMoney(item.unitCost, selected.currency)}`}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_180px_180px_auto]">
          <label>
            <span className="label">Proveedor</span>
            <select className="field" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.legalName}</option>)}
            </select>
          </label>
          <label><span className="label">Desde</span><input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span className="label">Hasta</span><input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          {canExport ? (
            <div className="flex items-end gap-2">
              <a className="btn btn-secondary" href={`/api/reports/purchases?format=csv&supplierId=${supplierFilter}&from=${from}&to=${to}`}><FileDown size={15} /> CSV</a>
              <a className="btn btn-primary" href={`/api/reports/purchases?format=pdf&supplierId=${supplierFilter}&from=${from}&to=${to}`}><FileDown size={15} /> PDF</a>
            </div>
          ) : null}
        </div>
        {loading ? <div className="skeleton h-80" /> : orders.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Orden</th><th>Proveedor</th><th>Fecha</th><th>Comprador</th><th>Partidas</th><th>Total</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold">{order.folio}</td>
                     <td>{order.supplierNameSnapshot}</td>
                    <td>{formatDate(order.createdAt)}</td>
                     <td>{order.buyerNameSnapshot}</td>
                    <td>{order._count.items} · {order._count.receipts} recepciones</td>
                    <td className="font-semibold">{formatMoney(order.total, order.currency)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td><button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => openOrder(order.id)}>Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin órdenes de compra" description="Emite la primera orden para iniciar el abastecimiento." />}
      </section>
    </div>
  );
}

function Input({
  label,
  name,
  className,
  ...props
}: {
  label: string;
  name: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={className}><span className="label">{label}</span><input className="field" name={name} {...props} /></label>;
}
