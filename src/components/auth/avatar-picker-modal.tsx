"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Notice } from "@/components/ui/notice";

const TOTAL_SEEDS = 100;
const PAGE_SIZE = 24;

function allSeeds(): string[] {
  return Array.from({ length: TOTAL_SEEDS }, (_, i) =>
    `avatar-${String(i + 1).padStart(3, "0")}`
  );
}

export function AvatarPickerModal({
  open,
  currentSeed,
  onSave,
  onClose
}: {
  open: boolean;
  currentSeed: string | null;
  onSave: (seed: string) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(currentSeed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const seeds = allSeeds();
  const totalPages = Math.ceil(seeds.length / PAGE_SIZE);
  const pageSeeds = seeds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(currentSeed);
      setError("");
      setSaving(false);
    }
  }, [open, currentSeed]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch<{ avatarSeed: string }>("/api/auth/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarSeed: selected })
      });
      onSave(selected);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible guardar el avatar."
      );
    } finally {
      setSaving(false);
    }
  }, [selected, onSave, onClose]);

  const handleNextPage = () => {
    setPage((p) => (p + 1) % totalPages);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 200ms ease" }}
      />

      {/* Centered container */}
      <div
        className="fixed inset-0 z-[61] flex items-center justify-center p-4"
        style={{ animation: "slideUp 250ms ease" }}
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 md:p-7 outline-none"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Elige tu avatar"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold tracking-[-0.02em]">
                Elige tu avatar
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Selecciona un Memoji y guarda tu elección
              </p>
            </div>
            <button
              aria-label="Cerrar"
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-2)] transition"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Preview of selected */}
          {selected && (
            <div className="flex items-center justify-center mb-5">
              <div className="relative">
                <img
                  src={`https://tapback.co/api/avatar/${encodeURIComponent(selected)}.webp`}
                  alt="Avatar seleccionado"
                  width={80}
                  height={80}
                  className="rounded-full ring-3 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-surface)]"
                  draggable={false}
                />
                <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-md">
                  <Check size={14} strokeWidth={3} />
                </span>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {pageSeeds.map((seed) => (
              <AvatarOption
                key={seed}
                seed={seed}
                isSelected={selected === seed}
                onSelect={setSelected}
              />
            ))}
          </div>

          {/* Ver otros button */}
          <div className="flex justify-center mt-5">
            <button
              className="btn btn-secondary text-xs gap-1.5"
              onClick={handleNextPage}
              type="button"
            >
              <RefreshCw size={14} />
              Ver otros
            </button>
          </div>

          <Notice type="error" message={error} />

          {/* Save button */}
          <div className="flex gap-3 mt-5 pt-4 border-t border-[var(--border)]">
            <button
              className="btn btn-secondary flex-1"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary flex-1"
              disabled={saving || !selected}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Guardando…" : "Guardar avatar"}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function AvatarOption({
  seed,
  isSelected,
  onSelect
}: {
  seed: string;
  isSelected: boolean;
  onSelect: (seed: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <button
      type="button"
      aria-label={`Seleccionar avatar ${seed}`}
      aria-pressed={isSelected}
      className={`group relative aspect-square rounded-full overflow-hidden transition-all duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${isSelected
          ? "ring-3 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-surface)] scale-105"
          : "hover:scale-105 hover:shadow-md"
        }`}
      onClick={() => onSelect(seed)}
    >
      {/* Skeleton */}
      {status === "loading" && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-[var(--color-border)]" />
      )}

      {/* Image */}
      <img
        src={`https://tapback.co/api/avatar/${encodeURIComponent(seed)}.webp`}
        alt={seed}
        className={`w-full h-full object-cover rounded-full transition-opacity duration-200 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        loading="lazy"
        draggable={false}
      />

      {/* Error state */}
      {status === "error" && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--muted)] text-[9px] font-bold">
          ?
        </span>
      )}

      {/* Selected check */}
      {isSelected && status === "loaded" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow">
            <Check size={14} strokeWidth={3} />
          </span>
        </span>
      )}
    </button>
  );
}
