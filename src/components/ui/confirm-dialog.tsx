"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>("button") || [];
    focusable[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key === "Tab" && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;

  const variantClasses = {
    danger: "btn-danger",
    warning: "btn-secondary !border-[var(--warning)] !text-[var(--warning)]",
    primary: "btn-primary"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div aria-hidden="true" className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--danger-tint)]">
            <AlertTriangle size={20} className="text-[var(--danger)]" />
          </span>
          <h3 className="font-semibold" id={titleId}>{title}</h3>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]" id={descriptionId}>{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${variantClasses[variant]}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
