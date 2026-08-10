"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CirclePlus,
  PackagePlus,
  Pencil,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { apiFetch, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSessionUser } from "@/components/layout/user-context";

type Product = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  unit: string;
  description?: string | null;
  cost: string;
  salePrice: string;
  taxRate: string;
  currentStock: string;
  minStock: string;
  maxStock?: string | null;
  allowNegative: boolean;
  status: string;
  stockAlert?: "LOW" | "HIGH" | null;
  category?: { id: string; name: string } | null;
};

type Category = { id: string; name: string };

export function InventoryView() {
  const user = useSessionUser();
  const canWrite = user.permissions.includes("inventory.write");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, categoryResult] = await Promise.all([
        apiFetch<{ items: Product[] }>(
          `/api/products?pageSize=100&q=${encodeURIComponent(search)}`
        ),
        apiFetch<Category[]>("/api/categories")
      ]);
      setProducts(result.items);
      setCategories(categoryResult);
      setError("");
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

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          sku: form.get("sku"),
          barcode: form.get("barcode") || null,
          name: form.get("name"),
          categoryId: form.get("categoryId") || null,
          unit: form.get("unit"),
          cost: form.get("cost"),
          salePrice: form.get("salePrice"),
          taxRate: form.get("taxRate"),
          minStock: form.get("minStock"),
          maxStock: form.get("maxStock") || null,
          allowNegative: false
        })
      });
      event.currentTarget.reset();
      setSuccess("Producto creado correctamente.");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/products/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sku: form.get("sku"),
          barcode: form.get("barcode") || null,
          name: form.get("name"),
          description: form.get("description") || null,
          categoryId: form.get("categoryId") || null,
          unit: form.get("unit"),
          cost: form.get("cost"),
          salePrice: form.get("salePrice"),
          taxRate: form.get("taxRate"),
          minStock: form.get("minStock"),
          maxStock: form.get("maxStock") || null,
          status: form.get("status"),
          allowNegative: form.get("allowNegative") === "on"
        })
      });
      setEditing(null);
      setSuccess("Producto actualizado y cambio auditado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible actualizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Almacén"
        title="Inventario"
        description="Control de existencias, costos, niveles mínimos y trazabilidad por producto."
        actions={canWrite ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? <X size={17} /> : <CirclePlus size={17} />}
            {showForm ? "Cerrar" : "Nuevo producto"}
          </button>
        ) : undefined}
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={success} />

      {showForm && canWrite ? (
        <form className="card p-5 md:p-6" onSubmit={createProduct}>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
              <PackagePlus size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Alta de producto</h2>
              <p className="text-xs text-[var(--muted)]">
                El stock inicial se registra mediante recepción o ajuste auditado.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="SKU" name="sku" required />
            <Field label="Código de barras" name="barcode" />
            <Field label="Nombre" name="name" required className="xl:col-span-2" />
            <label>
              <span className="label">Categoría</span>
              <select className="field" name="categoryId">
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Unidad</span>
              <select className="field" defaultValue="PZA" name="unit">
                <option>PZA</option>
                <option>KG</option>
                <option>LT</option>
                <option>CJA</option>
                <option>SER</option>
              </select>
            </label>
            <Field label="Costo" name="cost" type="number" step="0.01" required />
            <Field label="Precio de venta" name="salePrice" type="number" step="0.01" required />
            <Field label="Impuesto %" name="taxRate" type="number" step="0.01" defaultValue="16" required />
            <Field label="Stock mínimo" name="minStock" type="number" step="0.001" defaultValue="0" required />
            <Field label="Stock máximo" name="maxStock" type="number" step="0.001" />
          </div>
          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar producto"}
            </button>
          </div>
        </form>
      ) : null}

      {editing && canWrite ? (
        <form className="card p-5 md:p-6" onSubmit={updateProduct}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
                <Pencil size={18} />
              </span>
              <div>
                <h2 className="font-semibold">Editar producto</h2>
                <p className="text-xs text-[var(--muted)]">
                  La existencia sólo cambia mediante recepciones, ventas, conteos o ajustes.
                </p>
              </div>
            </div>
            <button
              aria-label="Cerrar edición"
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]"
              onClick={() => setEditing(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field defaultValue={editing.sku} label="SKU" name="sku" required />
            <Field defaultValue={editing.barcode || ""} label="Código de barras" name="barcode" />
            <Field defaultValue={editing.name} label="Nombre" name="name" required className="xl:col-span-2" />
            <Field defaultValue={editing.description || ""} label="Descripción" name="description" className="xl:col-span-2" />
            <label>
              <span className="label">Categoría</span>
              <select className="field" defaultValue={editing.category?.id || ""} name="categoryId">
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Unidad</span>
              <select className="field" defaultValue={editing.unit} name="unit">
                <option>PZA</option><option>KG</option><option>LT</option><option>CJA</option><option>SER</option>
              </select>
            </label>
            <Field defaultValue={editing.cost} label="Costo" name="cost" type="number" step="0.01" required />
            <Field defaultValue={editing.salePrice} label="Precio de venta" name="salePrice" type="number" step="0.01" required />
            <Field defaultValue={editing.taxRate} label="Impuesto %" name="taxRate" type="number" step="0.01" required />
            <Field defaultValue={editing.minStock} label="Stock mínimo" name="minStock" type="number" step="0.001" required />
            <Field defaultValue={editing.maxStock || ""} label="Stock máximo" name="maxStock" type="number" step="0.001" />
            <label>
              <span className="label">Estado</span>
              <select className="field" defaultValue={editing.status} name="status">
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-3 text-sm">
              <input defaultChecked={editing.allowNegative} name="allowNegative" type="checkbox" />
              Permitir existencia negativa
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="relative w-full max-w-lg">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={17}
            />
            <input
              className="field !pl-10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras"
              value={search}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <SlidersHorizontal size={15} />
            {products.length} productos visibles
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-80" />
        ) : products.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Existencia</th>
                  <th>Mín. / Máx.</th>
                  <th>Costo</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  {canWrite ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-tint)] font-bold text-[var(--primary)]">
                          {product.name[0]}
                        </span>
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-[11px] text-[var(--muted)]">
                            {product.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>{product.category?.name || "Sin categoría"}</td>
                    <td>
                      <span
                        className={
                          product.stockAlert === "LOW"
                            ? "font-bold text-[var(--danger)]"
                            : "font-semibold"
                        }
                      >
                        {product.currentStock} {product.unit}
                      </span>
                    </td>
                    <td className="text-[var(--muted)]">
                      {product.minStock} / {product.maxStock || "—"}
                    </td>
                    <td>{formatMoney(product.cost)}</td>
                    <td className="font-semibold">{formatMoney(product.salePrice)}</td>
                    <td>
                      {product.stockAlert === "LOW" ? (
                        <span className="badge !bg-[var(--danger-tint)] !text-[var(--danger)]">
                          <AlertTriangle size={13} /> Stock bajo
                        </span>
                      ) : product.stockAlert === "HIGH" ? (
                        <span className="badge !bg-[var(--warning-tint)] !text-[var(--warning)]">
                          <AlertTriangle size={13} /> Sobre máximo
                        </span>
                      ) : (
                        <StatusBadge status={product.status} />
                      )}
                    </td>
                    {canWrite ? <td>
                      <button
                        className="btn btn-secondary !min-h-8 !px-3 !py-1 text-xs"
                        onClick={() => {
                          setEditing(product);
                          setShowForm(false);
                        }}
                      >
                        <Pencil size={13} /> Editar
                      </button>
                    </td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No encontramos productos"
            description="Cambia la búsqueda o registra tu primer producto."
          />
        )}
      </section>
    </div>
  );
}

function Field({
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
