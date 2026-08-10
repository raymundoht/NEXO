"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Notice } from "@/components/ui/notice";
import { PasswordStrength } from "@/components/auth/password-strength";

type Challenge = {
  challengeId: string;
  email: string;
  expiresInSeconds: number;
  resendInSeconds: number;
};

export function RegisterForm() {
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [secondsToResend, setSecondsToResend] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (secondsToResend <= 0) return;
    const timer = window.setInterval(
      () => setSecondsToResend((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [secondsToResend]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const confirmation = String(form.get("confirmation") || "");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    try {
      const result = await apiFetch<Challenge>("/api/auth/register/request", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password
        })
      });
      setChallenge(result);
      setSecondsToResend(result.resendInSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar el código.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ message: string; email: string }>(
        "/api/auth/register/verify",
        {
          method: "POST",
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            code: String(form.get("code") || "").replace(/\s/g, "")
          })
        }
      );
      setRegisteredEmail(result.email);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible verificar el código.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!challenge || secondsToResend > 0) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{
        expiresInSeconds: number;
        resendInSeconds: number;
      }>("/api/auth/register/resend", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.challengeId })
      });
      setSecondsToResend(result.resendInSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible reenviar.");
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--success-tint)] text-[var(--success)]">
          <CheckCircle2 size={28} />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em]">Cuenta verificada</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Tu acceso quedó guardado. Entra con <strong>{registeredEmail}</strong> y la contraseña que creaste.
        </p>
        <Link
          className="btn btn-primary mt-7 w-full"
          href={`/login?registered=1&email=${encodeURIComponent(registeredEmail)}`}
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (challenge) {
    return (
      <div>
        <button
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"
          onClick={() => {
            setChallenge(null);
            setError("");
          }}
          type="button"
        >
          <ArrowLeft size={16} /> Cambiar datos
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          Verificación de correo
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Revisa tu bandeja</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Enviamos un código de seis dígitos a <strong>{challenge.email}</strong>. Vence en 10 minutos.
        </p>
        <form className="mt-8 space-y-5" onSubmit={verifyCode}>
          <label>
            <span className="label">Código de verificación</span>
            <input
              autoComplete="one-time-code"
              autoFocus
              className="field text-center text-2xl font-bold tracking-[0.35em]"
              inputMode="numeric"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              placeholder="000000"
              required
            />
          </label>
          <Notice type="error" message={error} />
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Verificando…" : "Verificar y crear cuenta"}
          </button>
          <button
            className="btn btn-secondary w-full"
            disabled={loading || secondsToResend > 0}
            onClick={resend}
            type="button"
          >
            {secondsToResend > 0
              ? `Reenviar en ${secondsToResend} s`
              : "Reenviar código"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <Link
        className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]"
        href="/login"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
        Nuevo acceso
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Crea tu cuenta</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Verificaremos tu correo antes de guardar el usuario definitivo.
      </p>
      <form className="mt-8 space-y-4" onSubmit={requestCode}>
        <Field icon={<UserRound size={17} />} label="Nombre completo" name="name" autoComplete="name" />
        <Field icon={<Mail size={17} />} label="Correo electrónico" name="email" type="email" autoComplete="email" />
        <label>
          <span className="label">Contraseña</span>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <input
              className="field !pl-10"
              name="password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              minLength={10}
              onChange={(event) => setPassword(event.target.value)}
              required
              value={password}
            />
          </div>
          <PasswordStrength password={password} />
        </label>
        <Field
          icon={<LockKeyhole size={17} />}
          label="Confirmar contraseña"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={10}
        />
        <Notice type="error" message={error} />
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Enviando código…" : "Continuar y verificar correo"}
        </button>
      </form>
      <p className="mt-5 text-center text-[11px] leading-5 text-[var(--muted)]">
        Las cuentas registradas reciben el rol Cajero/Vendedor. Un administrador puede cambiarlo después.
      </p>
    </div>
  );
}

function Field({
  icon,
  label,
  name,
  ...props
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span className="label">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">{icon}</span>
        <input className="field !pl-10" name={name} required {...props} />
      </div>
    </label>
  );
}
