"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Notice } from "@/components/ui/notice";

export function LoginForm({
  initialEmail = "",
  registered = false,
  registrationEnabled = true
}: {
  initialEmail?: string;
  registered?: boolean;
  registrationEnabled?: boolean;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password")
        })
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible ingresar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8 lg:hidden">
        <p className="text-2xl font-extrabold text-[var(--primary)]">NEXO</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
          ERP
        </p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
        Bienvenido de nuevo
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
        Inicia sesión
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Ingresa con tu correo institucional y contraseña.
      </p>
      {registered ? (
        <div className="mt-5">
          <Notice
            type="success"
            message="Tu correo quedó verificado. Ya puedes iniciar sesión."
          />
        </div>
      ) : null}

      <form
        action="/api/auth/login"
        className="mt-8 space-y-5"
        method="post"
        onSubmit={submit}
      >
        <div>
          <label className="label" htmlFor="email">
            Correo electrónico
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
              autoComplete="username"
              defaultValue={initialEmail}
              placeholder="nombre@empresa.com"
              required
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label !mb-0" htmlFor="password">
              Contraseña
            </label>
            <Link
              className="text-xs font-semibold text-[var(--primary)] hover:underline"
              href="/forgot-password"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={17}
            />
            <input
              className="field !px-10"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              required
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <Notice type="error" message={error} />
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Verificando…" : "Entrar al sistema"}
        </button>
      </form>
      <p className="mt-7 text-center text-xs leading-5 text-[var(--muted)]">
        Después de 5 intentos fallidos, tu cuenta se bloqueará durante 15 minutos.
      </p>
      {registrationEnabled ? (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          ¿Aún no tienes acceso?{" "}
          <Link className="font-semibold text-[var(--primary)] hover:underline" href="/register">
            Crear cuenta
          </Link>
        </p>
      ) : null}
    </div>
  );
}
