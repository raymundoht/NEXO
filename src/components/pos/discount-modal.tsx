"use client";

import { useState } from "react";
import { Percent, X } from "lucide-react";
import { formatMoney } from "@/lib/client-api";

export function DiscountModal({
  open,
  cartSubtotal,
  maxRate,
  onApply,
  onCancel
}: {
  open: boolean;
  cartSubtotal: number;
  maxRate: string;
  onApply: (amount: number) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");

  if (!open) return null;

  const maxAmount = cartSubtotal;
  const maxPercent = Number(maxRate);
  const numericValue = Number(value) || 0;

  let discountAmount = 0;
  if (mode === "percent") {
    const clampedPercent = Math.min(numericValue, maxPercent);
    discountAmount = (cartSubtotal * clampedPercent) / 100;
  } else {
    discountAmount = Math.min(numericValue, maxAmount);
  }

  const exceedsLimit =
    (mode === "percent" && numericValue > maxPercent) ||
    (mode === "amount" && numericValue > maxAmount);

  function handleApply() {
    if (discountAmount > 0) {
      onApply(discountAmount);
      setValue("");
      onCancel();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--success-tint)]">
              <Percent size={18} className="text-[var(--success)]" />
            </span>
            <h3 className="font-semibold">Aplicar descuento</h3>
          </div>
          <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={`btn text-xs ${mode === "percent" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setMode("percent"); setValue(""); }}
          >
            Porcentaje
          </button>
          <button
            className={`btn text-xs ${mode === "amount" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setMode("amount"); setValue(""); }}
          >
            Cantidad fija
          </button>
        </div>

        <div className="mt-4">
          <label className="label">
            {mode === "percent" ? `Porcentaje (máx. ${maxRate}%)` : `Cantidad (máx. ${formatMoney(maxAmount)})`}
          </label>
          <div className="relative">
            <input
              autoFocus
              className="field !h-11 text-lg"
              max={mode === "percent" ? maxPercent : maxAmount}
              min="0"
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "percent" ? "0" : "$0.00"}
              step="0.01"
              type="number"
              value={value}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
              {mode === "percent" ? "%" : formatMoney(0).replace("0.00", "")}
            </span>
          </div>
          {exceedsLimit && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {mode === "percent"
                ? `No puede exceder el ${maxRate}%`
                : `No puede exceder ${formatMoney(maxAmount)}`}
            </p>
          )}
        </div>

        {discountAmount > 0 && (
          <div className="mt-3 rounded-xl bg-[var(--success-tint)] p-3 text-center">
            <p className="text-xs text-[var(--muted)]">Descuento</p>
            <p className="text-lg font-bold text-[var(--success)]">-{formatMoney(discountAmount)}</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={discountAmount <= 0}
            onClick={handleApply}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
