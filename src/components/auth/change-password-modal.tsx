"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Mail, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { useSessionUser } from "@/components/layout/user-context";
import { Notice } from "@/components/ui/notice";

export function ChangePasswordModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const user = useSessionUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: form.get("currentPassword"),
            newPassword
          })
        }
      );
      setMessage(result.message);
      event.currentTarget.reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible cambiar la contraseña."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 200ms ease" }}
      />
      <div
        className="fixed inset-0 z-[61] flex items-center justify-center p-4"
        style={{ animation: "slideUp 250ms ease" }}
      >
        <div
          className="card w-full max-w-md p-6 md:p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
                <KeyRound size={21} />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em]">
                  Cambiar contraseña
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Actualiza tu acceso de forma segura
                </p>
              </div>
            </div>
            <button
              aria-label="Cerrar"
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {/* Email (read-only, from session) */}
            <div>
              <label className="label" htmlFor="cp-email">
                Correo de la cuenta
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10"
                  id="cp-email"
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  style={{ opacity: 0.65, cursor: "not-allowed" }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Se usa automáticamente el correo de tu sesión activa.
              </p>
            </div>

            {/* Current password */}
            <div>
              <label className="label" htmlFor="cp-current">
                Contraseña actual
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10 !pr-11"
                  id="cp-current"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  aria-label={showCurrent ? "Ocultar" : "Mostrar"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                  onClick={() => setShowCurrent((v) => !v)}
                  type="button"
                >
                  {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="label" htmlFor="cp-new">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10 !pr-11"
                  id="cp-new"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  required
                />
                <button
                  aria-label={showNew ? "Ocultar" : "Mostrar"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                  onClick={() => setShowNew((v) => !v)}
                  type="button"
                >
                  {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div>
              <label className="label" htmlFor="cp-confirm">
                Confirmar nueva contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10 !pr-11"
                  id="cp-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                />
                <button
                  aria-label={showConfirm ? "Ocultar" : "Mostrar"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                  onClick={() => setShowConfirm((v) => !v)}
                  type="button"
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <Notice type="error" message={error} />
            <Notice type="success" message={message} />

            <div className="flex gap-3 pt-1">
              <button
                className="btn btn-secondary flex-1"
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={loading}
                type="submit"
              >
                {loading ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </div>
          </form>
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
