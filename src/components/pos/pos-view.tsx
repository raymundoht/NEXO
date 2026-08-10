"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Barcode,
  CirclePause,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Percent
} from "lucide-react";
import { apiFetch, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiscountModal } from "@/components/pos/discount-modal";
import { useSessionUser } from "@/components/layout/user-context";

type Product = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  salePrice: string;
  taxRate: string;
  currentStock: string;
  unit: string;
};
type CartLine = Product & { quantity: number; discountAmount: number };
type Register = {
  id: string;
  code: string;
  name: string;
  sessions: Array<{
    id: string;
    cashierId: string;
    currency: string;
    openedAt: string;
  }>;
};
type HeldSale = {
  id: string;
  folio: string;
  total: string;
  currency: string;
  items: Array<{ nameSnapshot: string; quantity: string }>;
};
type PosConfig = {
  baseCurrency: string;
  allowedCurrencies: string[];
  maxCashierDiscountRate: string;
};

export function PosView() {
  const user = useSessionUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [heldSales, setHeldSales] = useState<Array<{ id: string; folio: string; total: string; currency: string }>>([]);
  const [heldSale, setHeldSale] = useState<HeldSale | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [cardAuthorization, setCardAuthorization] = useState("");
  const [currency, setCurrency] = useState("MXN");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [config, setConfig] = useState<PosConfig>({
    baseCurrency: "MXN",
    allowedCurrencies: ["MXN"],
    maxCashierDiscountRate: "0"
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastSale, setLastSale] = useState<{ id: string; folio: string; total: string; currency: string; changeAmount?: string | null } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [productResult, registerResult, heldResult, configResult] = await Promise.all([
        apiFetch<{ items: Product[] }>(`/api/products?pageSize=100&q=${encodeURIComponent(search)}`),
        apiFetch<Register[]>("/api/cash-registers"),
        apiFetch<{ items: Array<{ id: string; folio: string; total: string; currency: string }> }>("/api/sales?status=HELD&pageSize=50"),
        apiFetch<PosConfig>("/api/pos/config")
      ]);
      setProducts(productResult.items);
      setRegisters(registerResult);
      setHeldSales(heldResult.items);
      setConfig(configResult);
      setCurrency((current) =>
        configResult.allowedCurrencies.includes(current)
          ? current
          : configResult.baseCurrency
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar el POS.");
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  const openRegister = useMemo(
    () =>
      registers.find((register) =>
        register.sessions.some((session) => session.cashierId === user.id)
      ),
    [registers, user.id]
  );

  const totals = useMemo(() => {
    const discount = cart.reduce(
      (total, line) => total + line.discountAmount,
      0
    );
    const subtotal = cart.reduce(
      (total, line) => total + Number(line.salePrice) * line.quantity - line.discountAmount,
      0
    );
    const tax = cart.reduce((total, line) => {
      const base = Number(line.salePrice) * line.quantity - line.discountAmount;
      return total + base * (Number(line.taxRate) / 100);
    }, 0);
    return { discount, subtotal, tax, total: subtotal + tax };
  }, [cart]);

  const cartSubtotal = useMemo(
    () => cart.reduce((total, line) => total + Number(line.salePrice) * line.quantity, 0),
    [cart]
  );

  function addProduct(product: Product) {
    setLastSale(null);
    setHeldSale(null);
    setCart((current) => {
      const line = current.find((item) => item.id === product.id);
      if (line) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1, discountAmount: 0 }];
    });
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id ? { ...line, quantity: line.quantity + amount } : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  async function addScannedProduct() {
    const code = search.trim();
    if (!code) return;
    try {
      const result = await apiFetch<{ items: Product[] }>(
        `/api/products?pageSize=20&q=${encodeURIComponent(code)}`
      );
      const exact = result.items.find(
        (product) =>
          product.barcode === code ||
          product.sku.toLocaleLowerCase() === code.toLocaleLowerCase()
      );
      if (!exact) {
        setError("No existe un producto con ese código de barras o SKU.");
        return;
      }
      if (Number(exact.currentStock) <= 0) {
        setError(`${exact.name} no tiene existencias disponibles.`);
        return;
      }
      addProduct(exact);
      setSearch("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible leer el código.");
    }
  }

  async function submit(mode: "HOLD" | "COMPLETE") {
    if (!cart.length || !openRegister) return;

    if (mode === "COMPLETE" && paymentMethod === "CASH") {
      const received = Number(amountTendered);
      if (!received || received < totals.total) {
        setError("El efectivo recibido es menor que el total de la venta.");
        return;
      }
    }

    setProcessing(true);
    setError("");
    try {
      if (mode === "COMPLETE" && paymentMethod === "CARD") {
        const sale = await apiFetch<{ id: string; folio: string; total: string; currency: string; changeAmount?: string | null }>("/api/sales", {
          method: "POST",
          body: JSON.stringify({
            mode: "HOLD",
            currency,
            exchangeRate,
            items: cart.map((line) => ({
              productId: line.id,
              quantity: line.quantity,
              discountAmount: line.discountAmount
            }))
          })
        });
        const clientRequestId = crypto.randomUUID();
        const session = await apiFetch<{ url: string }>("/api/stripe/checkout", {
           method: "POST",
           body: JSON.stringify({
              clientRequestId,
              saleId: sale.id,
              cashRegisterId: openRegister.id,
              cashSessionId: openRegister.sessions.find(s => s.cashierId === user.id)?.id
           })
        });
        window.location.href = session.url;
        return;
      }

      const sale = await apiFetch<{ id: string; folio: string; total: string; currency: string; changeAmount?: string | null }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          mode,
          currency,
          exchangeRate,
          items: cart.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
            discountAmount: line.discountAmount
          })),
          ...(mode === "COMPLETE"
            ? {
                payment: {
                  cashRegisterId: openRegister.id,
                  paymentMethod,
                  amountTendered: paymentMethod === "CASH" ? Number(amountTendered) : undefined,
                  cardAuthorization: paymentMethod === "CARD" ? cardAuthorization : undefined
                }
              }
            : {})
        })
      });
      setCart([]);
      setAmountTendered("");
      setCardAuthorization("");
      setMessage(mode === "HOLD" ? `Venta ${sale.folio} guardada en espera.` : "");
      if (mode === "COMPLETE") setLastSale(sale);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible procesar.");
    } finally {
      setProcessing(false);
    }
  }

  async function selectHeldSale(id: string) {
    try {
      setHeldSale(await apiFetch<HeldSale>(`/api/sales/${id}`));
      setCart([]);
      setLastSale(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible abrir.");
    }
  }

  async function completeHeld() {
    if (!heldSale || !openRegister) return;
    setProcessing(true);
    try {
      if (paymentMethod === "CARD") {
        const clientRequestId = crypto.randomUUID();
        const session = await apiFetch<{ url: string }>("/api/stripe/checkout", {
           method: "POST",
           body: JSON.stringify({
              clientRequestId,
              saleId: heldSale.id,
              cashRegisterId: openRegister.id,
              cashSessionId: openRegister.sessions.find(s => s.cashierId === user.id)?.id
           })
        });
        window.location.href = session.url;
        return;
      }

      const sale = await apiFetch<{ id: string; folio: string; total: string; currency: string; changeAmount?: string | null }>(`/api/sales/${heldSale.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          cashRegisterId: openRegister.id,
          paymentMethod,
          amountTendered: paymentMethod === "CASH" ? Number(amountTendered) : undefined
        })
      });
      setHeldSale(null);
      setLastSale(sale);
      setAmountTendered("");
      setCardAuthorization("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cobrar.");
    } finally {
      setProcessing(false);
    }
  }

  function applyGlobalDiscount(amount: number) {
    setCart((current) => {
      if (current.length === 0) return current;
      const perLine = amount / current.length;
      return current.map((line) => {
        const maxDiscount = Number(line.salePrice) * line.quantity;
        return { ...line, discountAmount: Math.min(maxDiscount, perLine) };
      });
    });
  }

  const checkoutTotal = heldSale ? Number(heldSale.total) : totals.total;
  const displayCurrency = heldSale ? heldSale.currency : currency;
  const change =
    paymentMethod === "CASH" && amountTendered
      ? Math.max(0, Number(amountTendered) - checkoutTotal)
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ventas"
        title="Punto de venta"
        description="Busca productos, gestiona el carrito y cobra de forma rápida."
        actions={
          openRegister ? (
            <span className="badge !bg-[var(--success-tint)] !text-[var(--success)]">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              {openRegister.code} abierta
            </span>
          ) : (
            <Link className="btn btn-primary" href="/cash">Abrir caja</Link>
          )
        }
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      {!openRegister && (
        <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-tint)] p-4 text-sm text-[var(--warning)]">
          Debes abrir una sesión de caja antes de cobrar ventas.
        </div>
      )}
      {lastSale && (
        <div className="card flex flex-col gap-4 border-[var(--success)]/30 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--success)]">Venta completada</p>
            <h2 className="mt-1 text-xl font-bold">{lastSale.folio} · {formatMoney(lastSale.total, lastSale.currency)}</h2>
            {lastSale.changeAmount && <p className="text-sm text-[var(--muted)]">Cambio: {formatMoney(lastSale.changeAmount, lastSale.currency)}</p>}
          </div>
          <a className="btn btn-primary" href={`/api/sales/${lastSale.id}/ticket`} target="_blank">
            <Barcode size={16} /> Abrir ticket
          </a>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
              <input
                autoFocus
                className="field !h-14 !pl-10 text-base"
                placeholder="Escanea el código de barras o escribe el nombre del producto"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addScannedProduct();
                  }
                }}
              />
              <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={20} />
            </div>
          </div>
          <div className="grid max-h-[650px] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <button
                className="group flex min-h-40 flex-col items-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-lg disabled:opacity-50"
                disabled={!openRegister || Number(product.currentStock) <= 0}
                key={product.id}
                onClick={() => addProduct(product)}
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--primary-tint)] font-bold text-[var(--primary)] transition group-hover:bg-[var(--primary)] group-hover:text-white">
                  {product.name[0]}
                </span>
                <p className="mt-3 line-clamp-2 text-sm font-semibold leading-tight">{product.name}</p>
                <div className="mt-auto flex w-full items-end justify-between pt-3">
                  <span className="text-lg font-bold text-[var(--primary)]">{formatMoney(product.salePrice)}</span>
                  <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                    {product.currentStock} disp.
                  </span>
                </div>
              </button>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-10">
                <EmptyState
                  title="Sin resultados"
                  description={search ? "No se encontraron productos con ese término." : "Escanea un código o busca un producto."}
                />
              </div>
            )}
          </div>
        </section>

        <section className="card flex min-h-[620px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart size={19} className="text-[var(--primary)]" />
              <h2 className="font-semibold">{heldSale ? `En espera ${heldSale.folio}` : "Venta actual"}</h2>
            </div>
            <div className="flex items-center gap-2">
              {!heldSale && (
                <>
                  <select
                    aria-label="Moneda de venta"
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                    onChange={(event) => setCurrency(event.target.value)}
                    value={currency}
                  >
                    {config.allowedCurrencies.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  {currency !== config.baseCurrency && (
                    <input
                      aria-label="Tipo de cambio"
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                      min="0.000001"
                      onChange={(event) => setExchangeRate(event.target.value)}
                      step="0.000001"
                      type="number"
                      value={exchangeRate}
                    />
                  )}
                </>
              )}
              {cart.length > 0 && !heldSale && (
                <button
                  className="text-xs font-semibold text-[var(--danger)] hover:underline"
                  onClick={() => setShowClearConfirm(true)}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <div className="max-h-72 flex-1 space-y-2 overflow-y-auto p-4">
            {heldSale ? heldSale.items.map((line, index) => (
              <div className="subtle-card flex items-center justify-between p-3" key={index}>
                <p className="text-xs font-semibold">{line.nameSnapshot}</p>
                <span className="text-xs text-[var(--muted)]">x {line.quantity}</span>
              </div>
            )) : cart.length > 0 ? cart.map((line) => (
              <div className="subtle-card p-3" key={line.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{line.name}</p>
                    <p className="text-[10px] text-[var(--muted)]">{formatMoney(line.salePrice)} c/u</p>
                  </div>
                  <button
                    className="shrink-0 text-[var(--danger)] hover:opacity-70"
                    onClick={() => setCart((items) => items.filter((item) => item.id !== line.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-lg font-bold hover:bg-[var(--surface-hover)]"
                      onClick={() => changeQuantity(line.id, -1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-base font-bold">{line.quantity}</span>
                    <button
                      className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-lg font-bold hover:bg-[var(--surface-hover)]"
                      onClick={() => changeQuantity(line.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="text-base font-bold">
                    {formatMoney(
                      Number(line.salePrice) * line.quantity - line.discountAmount
                    )}
                  </span>
                </div>
                {line.discountAmount > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--success)]">
                    <Percent size={10} />
                    Descuento: -{formatMoney(line.discountAmount)}
                  </div>
                )}
              </div>
            )) : (
              <EmptyState title="Carrito vacío" description="Selecciona productos para comenzar la venta." />
            )}
          </div>

          {(cart.length > 0 || heldSale) && (
            <div className="border-t border-[var(--border)] p-4">
              {!heldSale && (
                <div className="mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[var(--muted)]"><span>Subtotal</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-[var(--success)]">
                      <span>Descuentos</span>
                      <span>-{formatMoney(totals.discount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[var(--muted)]"><span>Impuestos</span><span>{formatMoney(totals.tax, currency)}</span></div>
                </div>
              )}
              <div className="mb-4 flex items-end justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-3xl font-bold tracking-[-0.04em]">{formatMoney(checkoutTotal, displayCurrency)}</span>
              </div>

              {!heldSale && cart.length > 0 && (
                <div className="mb-3">
                  <button
                    className="btn btn-secondary w-full text-xs"
                    onClick={() => setShowDiscountModal(true)}
                  >
                    <Percent size={14} /> Descuento
                  </button>
                </div>
              )}

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  className={`btn h-12 text-sm font-semibold ${paymentMethod === "CASH" ? "!bg-[var(--success)] !text-white hover:!bg-[var(--success)]/90" : "btn-secondary"}`}
                  onClick={() => setPaymentMethod("CASH")}
                >
                  <Banknote size={18} /> Efectivo
                </button>
                <button
                  className={`btn h-12 text-sm font-semibold ${paymentMethod === "CARD" ? "!bg-[var(--info)] !text-white hover:!bg-[var(--info)]/90" : "btn-secondary"}`}
                  onClick={() => setPaymentMethod("CARD")}
                  disabled={displayCurrency !== "MXN"}
                  title={displayCurrency !== "MXN" ? "Tarjeta solo disponible en MXN" : ""}
                >
                  <CreditCard size={18} /> Tarjeta
                </button>
              </div>

              {paymentMethod === "CASH" && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <label>
                    <span className="label">Recibido</span>
                    <input
                      className="field !h-11 text-base"
                      min="0"
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={amountTendered}
                    />
                  </label>
                  <label>
                    <span className="label">Cambio</span>
                    <div className={`field !h-11 flex items-center text-base font-bold ${change > 0 ? "!bg-[var(--success-tint)] !text-[var(--success)]" : ""}`}>
                      {formatMoney(change, displayCurrency)}
                    </div>
                  </label>
                </div>
              )}

              {paymentMethod === "CARD" && !heldSale && (
                <p className="mb-3 text-xs text-[var(--muted)] text-center">El cliente será redirigido a Stripe para completar su pago de forma segura.</p>
              )}

              {heldSale ? (
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-secondary" onClick={() => setHeldSale(null)}>Cancelar</button>
                  <button className="btn !bg-[var(--success)] !text-white hover:!bg-[var(--success)]/90 h-12 text-base font-semibold" disabled={processing} onClick={completeHeld}>
                    {processing ? "Procesando..." : "Cobrar venta"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-secondary h-12" disabled={processing} onClick={() => submit("HOLD")}>
                    <CirclePause size={16} /> Espera
                  </button>
                  <button
                    className="btn !bg-[var(--success)] !text-white hover:!bg-[var(--success)]/90 h-12 text-base font-semibold"
                    disabled={processing || cart.length === 0}
                    onClick={() => submit("COMPLETE")}
                  >
                    {processing ? "Procesando..." : `Cobrar ${formatMoney(checkoutTotal, displayCurrency)}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {heldSales.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Ventas en espera</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {heldSales.map((sale) => (
              <button className="btn btn-secondary !min-h-9 text-xs" key={sale.id} onClick={() => selectHeldSale(sale.id)}>
                {sale.folio} · {formatMoney(sale.total, sale.currency)}
              </button>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={showClearConfirm}
        title="Limpiar carrito"
        message="Se eliminarán todos los productos del carrito. ¿Continuar?"
        confirmLabel="Limpiar"
        variant="danger"
        onConfirm={() => { setCart([]); setShowClearConfirm(false); }}
        onCancel={() => setShowClearConfirm(false)}
      />

      <DiscountModal
        open={showDiscountModal}
        cartSubtotal={cartSubtotal}
        maxRate={config.maxCashierDiscountRate}
        onApply={applyGlobalDiscount}
        onCancel={() => setShowDiscountModal(false)}
      />
    </div>
  );
}
