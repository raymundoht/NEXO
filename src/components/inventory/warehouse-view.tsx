"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Search, SlidersHorizontal, Package, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type Product = {
  id: string;
  sku: string;
  name: string;
  currentStock: string;
  storeStock: string;
  warehouseStock: string;
};

export function WarehouseView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Transfer modal state
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [transferDirection, setTransferDirection] = useState<"TO_STORE" | "TO_WAREHOUSE">("TO_STORE");
  const [transferQty, setTransferQty] = useState("");
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ items: Product[] }>(
        `/api/products?pageSize=500&q=${encodeURIComponent(search)}`
      );
      setProducts(result.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferProduct || !transferQty) return;
    
    setTransferring(true);
    try {
      await apiFetch("/api/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          productId: transferProduct.id,
          quantity: Number(transferQty),
          direction: transferDirection
        })
      });
      setTransferProduct(null);
      setTransferQty("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error en la transferencia");
    } finally {
      setTransferring(false);
    }
  }

  function openTransferModal(product: Product, direction: "TO_STORE" | "TO_WAREHOUSE") {
    setTransferProduct(product);
    setTransferDirection(direction);
    setTransferQty("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="relative w-full max-w-xs md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              className="field w-full pl-9"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU o nombre..."
              value={search}
            />
          </div>
        }
        description="Transfiere productos entre el almacén principal y el piso de ventas (Tienda)."
        title="Gestión de Almacenes"
      />

      {error ? (
        <div className="rounded-2xl border border-[var(--danger-tint)] bg-[var(--danger-tint)] p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {transferProduct && (
        <form className="card p-5 md:p-6" onSubmit={handleTransfer}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
                <ArrowLeftRight size={18} />
              </span>
              <div>
                <h2 className="font-semibold">Transferir {transferProduct.name}</h2>
                <p className="text-xs text-[var(--muted)]">
                  Mueve cantidades entre almacén y tienda. Stock actual total: {transferProduct.currentStock}
                </p>
              </div>
            </div>
            <button
              aria-label="Cerrar edición"
              className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--surface-2)]"
              onClick={() => setTransferProduct(null)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface-2)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Almacén Principal</span>
                <span className="text-lg font-bold text-[var(--primary)]">{transferProduct.warehouseStock}</span>
              </div>
              <button 
                type="button"
                onClick={() => setTransferDirection("TO_STORE")}
                disabled={Number(transferProduct.warehouseStock) <= 0}
                className={`w-full py-2 px-3 text-sm rounded-lg font-medium transition-colors border ${transferDirection === "TO_STORE" ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm' : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'}`}
              >
                Mover a Tienda →
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface-2)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Piso de Ventas (Tienda)</span>
                <span className="text-lg font-bold">{transferProduct.storeStock}</span>
              </div>
              <button 
                type="button"
                onClick={() => setTransferDirection("TO_WAREHOUSE")}
                disabled={Number(transferProduct.storeStock) <= 0}
                className={`w-full py-2 px-3 text-sm rounded-lg font-medium transition-colors border ${transferDirection === "TO_WAREHOUSE" ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm' : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'}`}
              >
                ← Regresar a Almacén
              </button>
            </div>
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-4 items-end">
            <label className="block">
              <span className="label">
                Cantidad a {transferDirection === "TO_STORE" ? "enviar a tienda" : "regresar a almacén"}
              </span>
              <input
                className="field w-full text-lg font-semibold"
                type="number"
                min="0.001"
                step="0.001"
                max={transferDirection === "TO_STORE" ? transferProduct.warehouseStock : transferProduct.storeStock}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                required
                autoFocus
                placeholder="0.00"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                className="btn btn-secondary"
                onClick={() => setTransferProduct(null)}
                type="button"
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={transferring}>
                {transferring ? "Procesando..." : "Confirmar transferencia"}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && !products.length ? (
        <p className="text-sm text-[var(--muted)]">Cargando ubicaciones...</p>
      ) : products.length === 0 ? (
        <EmptyState
          description="No hay productos registrados en el sistema."
          title="Sin productos"
        />
      ) : (
        <div className="table-wrap rounded-2xl border border-[var(--border)]">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-right">En Almacén</th>
                <th className="text-right">En Tienda</th>
                <th className="text-right">Stock Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-[11px] text-[var(--muted)]">{product.sku}</p>
                  </td>
                  <td className="text-right">
                    <span className="font-medium text-[var(--primary)]">{product.warehouseStock}</span>
                  </td>
                  <td className="text-right">
                    <span className="font-medium">{product.storeStock}</span>
                  </td>
                  <td className="text-right font-bold text-[var(--text)]">
                    {product.currentStock}
                  </td>
                  <td className="text-right">
                    <button 
                      className="btn btn-secondary !px-3 !py-1.5 text-xs font-medium"
                      onClick={() => openTransferModal(product, "TO_STORE")}
                    >
                      Transferir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
