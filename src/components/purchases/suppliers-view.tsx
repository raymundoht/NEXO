"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, CirclePlus, Search, X } from "lucide-react";
import { apiFetch, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";

type Supplier = {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
  creditDays: number;
  deliveryDays: number;
  creditLimit?: string | null;
  paymentTerms?: string | null;
  active: boolean;
};
type Product = { id: string; sku: string; name: string; unit: string };
type SupplierPrice = {
  id: string;
  supplierSku?: string | null;
  referenceCost: string;
  currency: string;
  leadDays: number;
  isPreferred: boolean;
  product: Product;
};
type SupplierDetail = Supplier & { productPrices: SupplierPrice[] };

export function SuppliersView() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<SupplierDetail | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, productResult] = await Promise.all([
        apiFetch<{ items: Supplier[] }>(
          `/api/suppliers?pageSize=100&q=${encodeURIComponent(search)}`
        ),
        apiFetch<{ items: Product[] }>("/api/products?pageSize=500")
      ]);
      setItems(result.items);
      setProducts(productResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          code: form.get("code"),
          legalName: form.get("legalName"),
          tradeName: form.get("tradeName") || null,
          taxId: form.get("taxId") || null,
          email: form.get("email") || null,
          phone: form.get("phone") || null,
          contactName: form.get("contactName") || null,
          address: form.get("address") || null,
          creditDays: form.get("creditDays"),
          deliveryDays: form.get("deliveryDays"),
          creditLimit: form.get("creditLimit") || null,
          paymentTerms: form.get("paymentTerms") || null,
          active: true
        })
      });
      event.currentTarget.reset();
      setShowForm(false);
      setMessage("Proveedor registrado.");
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar.");
    }
  }

  async function openSupplier(id: string) {
    try {
      setSelected(await apiFetch<SupplierDetail>(`/api/suppliers/${id}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible consultar.");
    }
  }

  async function updateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/suppliers/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: form.get("code"),
          legalName: form.get("legalName"),
          tradeName: form.get("tradeName") || null,
          taxId: form.get("taxId") || null,
          email: form.get("email") || null,
          phone: form.get("phone") || null,
          contactName: form.get("contactName") || null,
          address: form.get("address") || null,
          creditDays: form.get("creditDays"),
          deliveryDays: form.get("deliveryDays"),
          creditLimit: form.get("creditLimit") || null,
          paymentTerms: form.get("paymentTerms") || null,
          active: form.get("active") === "on"
        })
      });
      setMessage("Proveedor actualizado.");
      await openSupplier(selected.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible actualizar.");
    }
  }

  async function saveReferencePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/suppliers/${selected.id}/products`, {
        method: "POST",
        body: JSON.stringify({
          productId: form.get("productId"),
          supplierSku: form.get("supplierSku") || null,
          referenceCost: form.get("referenceCost"),
          currency: form.get("currency"),
          leadDays: form.get("leadDays"),
          isPreferred: form.get("isPreferred") === "on"
        })
      });
      event.currentTarget.reset();
      setMessage("Precio de referencia guardado.");
      await openSupplier(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar el precio.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compras"
        title="Proveedores"
        description="Condiciones de crédito, tiempos de entrega y referencias de abastecimiento."
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={17} /> : <CirclePlus size={17} />}
            {showForm ? "Cerrar" : "Nuevo proveedor"}
          </button>
        }
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      {showForm ? (
        <form className="card p-5 md:p-6" onSubmit={submit}>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
              <Building2 size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Datos del proveedor</h2>
              <p className="text-xs text-[var(--muted)]">
                Completa los campos operativos y fiscales disponibles.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Clave" name="code" required />
            <Input label="Razón social" name="legalName" required className="xl:col-span-2" />
            <Input label="RFC / ID fiscal" name="taxId" />
            <Input label="Nombre comercial" name="tradeName" />
            <Input label="Contacto" name="contactName" />
            <Input label="Correo" name="email" type="email" />
            <Input label="Teléfono" name="phone" />
            <Input label="Dirección" name="address" className="xl:col-span-2" />
            <Input label="Días de crédito" name="creditDays" type="number" defaultValue="0" required />
            <Input label="Días de entrega" name="deliveryDays" type="number" defaultValue="0" required />
            <Input label="Límite de crédito" name="creditLimit" type="number" step="0.01" />
            <Input label="Condiciones de pago" name="paymentTerms" />
          </div>
          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary">Guardar proveedor</button>
          </div>
        </form>
      ) : null}

      {selected ? (
        <section className="card p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Catálogo detallado
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {selected.tradeName || selected.legalName}
              </h2>
            </div>
            <button
              aria-label="Cerrar detalle"
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </div>
          <form className="mt-5" onSubmit={updateSupplier}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input defaultValue={selected.code} label="Clave" name="code" required />
              <Input defaultValue={selected.legalName} label="Razón social" name="legalName" required className="xl:col-span-2" />
              <Input defaultValue={selected.taxId || ""} label="RFC / ID fiscal" name="taxId" />
              <Input defaultValue={selected.tradeName || ""} label="Nombre comercial" name="tradeName" />
              <Input defaultValue={selected.contactName || ""} label="Contacto" name="contactName" />
              <Input defaultValue={selected.email || ""} label="Correo" name="email" type="email" />
              <Input defaultValue={selected.phone || ""} label="Teléfono" name="phone" />
              <Input defaultValue={selected.address || ""} label="Dirección" name="address" className="xl:col-span-2" />
              <Input defaultValue={selected.creditDays} label="Días de crédito" name="creditDays" type="number" required />
              <Input defaultValue={selected.deliveryDays} label="Días de entrega" name="deliveryDays" type="number" required />
              <Input defaultValue={selected.creditLimit || ""} label="Límite de crédito" name="creditLimit" type="number" step="0.01" />
              <Input defaultValue={selected.paymentTerms || ""} label="Condiciones de pago" name="paymentTerms" className="xl:col-span-2" />
              <label className="flex items-end gap-2 pb-3 text-sm">
                <input defaultChecked={selected.active} name="active" type="checkbox" />
                Proveedor activo
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-secondary">Guardar datos</button>
            </div>
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <h3 className="font-semibold">Precios de referencia por producto</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Se actualizan también al validar una recepción de compra.
            </p>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_160px_150px_110px_110px_auto]"
              onSubmit={saveReferencePrice}
            >
              <label>
                <span className="label">Producto</span>
                <select className="field" name="productId" required>
                  <option value="">Seleccionar</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="SKU proveedor" name="supplierSku" />
              <Input label="Costo referencia" name="referenceCost" min="0" required step="0.01" type="number" />
              <label>
                <span className="label">Moneda</span>
                <select className="field" defaultValue="MXN" name="currency">
                  <option>MXN</option><option>USD</option>
                </select>
              </label>
              <Input defaultValue="0" label="Entrega (días)" name="leadDays" min="0" required type="number" />
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input name="isPreferred" type="checkbox" /> Preferido
                </label>
                <button className="btn btn-primary !min-h-9">Guardar</button>
              </div>
            </form>
            {selected.productPrices.length ? (
              <div className="table-wrap mt-4 rounded-2xl border border-[var(--border)]">
                <table className="data-table">
                  <thead>
                    <tr><th>Producto</th><th>SKU proveedor</th><th>Precio</th><th>Entrega</th><th>Preferencia</th></tr>
                  </thead>
                  <tbody>
                    {selected.productPrices.map((price) => (
                      <tr key={price.id}>
                        <td><p className="font-semibold">{price.product.name}</p><p className="text-[11px] text-[var(--muted)]">{price.product.sku}</p></td>
                        <td>{price.supplierSku || "N/D"}</td>
                        <td className="font-semibold">{formatMoney(price.referenceCost, price.currency)}</td>
                        <td>{price.leadDays} días</td>
                        <td>{price.isPreferred ? <span className="badge !bg-[var(--success-tint)] !text-[var(--success)]">Preferido</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--surface-2)] p-4 text-xs text-[var(--muted)]">
                Aún no hay precios de referencia para este proveedor.
              </p>
            )}
          </div>
        </section>
      ) : null}
      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] p-4 md:px-5">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <input
              className="field !pl-10"
              placeholder="Buscar proveedor, clave o RFC"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-72" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Crédito</th>
                  <th>Entrega</th>
                  <th>Límite</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <p className="font-semibold">{supplier.tradeName || supplier.legalName}</p>
                      <p className="text-[11px] text-[var(--muted)]">{supplier.code} · {supplier.taxId || "Sin RFC"}</p>
                    </td>
                    <td>
                      <p>{supplier.contactName || "—"}</p>
                      <p className="text-[11px] text-[var(--muted)]">{supplier.email || supplier.phone || "Sin datos"}</p>
                    </td>
                    <td>{supplier.creditDays} días</td>
                    <td>{supplier.deliveryDays} días</td>
                    <td>{supplier.creditLimit ? formatMoney(supplier.creditLimit) : "N/D"}</td>
                    <td><StatusBadge status={supplier.active ? "ACTIVE" : "INACTIVE"} /></td>
                    <td><button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => openSupplier(supplier.id)}>Administrar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin proveedores" description="Registra el primer proveedor para emitir órdenes de compra." />
        )}
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
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <input className="field" name={name} {...props} />
    </label>
  );
}
