"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, LockKeyhole, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Notice } from "@/components/ui/notice";
import { PasswordStrength } from "@/components/auth/password-strength";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  async function submitStep1(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const emailInput = form.get("email") as string;
    
    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: emailInput })
        }
      );
      setEmail(emailInput);
      setMessage(result.message);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible continuar.");
    } finally {
      setLoading(false);
    }
  }

  async function submitStep2(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") || "");
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    
    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({ email, code, password })
        }
      );
      setMessage(result.message);
      setStep(1); // Not fully needed but we reset state
      // Instead of leaving the form, we can just show success. 
      // But we will clear the email to show a clean state or just keep the message visible.
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible continuar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link
        className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]"
        href="/login"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      
      {!email && message ? (
        // State 3: Success completely
        <>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            ¡Contraseña actualizada!
          </h1>
          <div className="mt-8">
            <Notice type="success" message={message} />
            <Link className="btn btn-primary w-full mt-4" href="/login">
              Iniciar sesión
            </Link>
          </div>
        </>
      ) : step === 1 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            Recuperación segura
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            Restablece tu acceso
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Te enviaremos un código de seguridad de 6 dígitos.
          </p>
          <form className="mt-8 space-y-5" onSubmit={submitStep1}>
            <div>
              <label className="label" htmlFor="email">
                Correo institucional
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <Notice type="error" message={error} />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            Paso 2 de 2
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            Crea una contraseña nueva
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Ingresa el código que enviamos a <strong>{email}</strong>.
          </p>
          
          <form className="mt-8 space-y-4" onSubmit={submitStep2}>
            <div>
              <label className="label" htmlFor="code">
                Código de seguridad (6 dígitos)
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={17}
                />
                <input
                  className="field !pl-10 text-center tracking-widest font-mono text-lg"
                  id="code"
                  name="code"
                  type="text"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="000000"
                  required
                />
              </div>
            </div>

            {["password", "confirmation"].map((name, index) => (
              <div key={name}>
                <label className="label" htmlFor={name}>
                  {index === 0 ? "Nueva contraseña" : "Confirmar contraseña"}
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    size={17}
                  />
                  <input
                    className="field !pl-10"
                    id={name}
                    name={name}
                    type="password"
                    minLength={10}
                    maxLength={128}
                    onChange={
                      index === 0
                        ? (event) => setPasswordValue(event.target.value)
                        : undefined
                    }
                    required
                  />
                </div>
                {index === 0 ? <PasswordStrength password={passwordValue} /> : null}
              </div>
            ))}
            
            <Notice type="error" message={error} />
            <Notice type="success" message={message} />
            
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Actualizando…" : "Guardar contraseña"}
            </button>
            <button
              type="button"
              className="btn w-full mt-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => {
                setStep(1);
                setMessage("");
                setError("");
              }}
            >
              Cambiar correo
            </button>
          </form>
        </>
      )}
    </div>
  );
}
