import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { selfRegistrationEnabled } from "@/lib/registration";

const RegisterForm = dynamic(
  () => import("@/components/auth/register-form").then((m) => ({ default: m.RegisterForm })),
  { loading: () => <div className="min-h-screen bg-[var(--color-app)] flex items-center justify-center"><div className="animate-pulse text-[var(--color-text-muted)]">Cargando...</div></div> }
);

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  if (!selfRegistrationEnabled()) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">Registro no disponible</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Solicita al administrador que cree o habilite tu acceso.
        </p>
        <Link className="btn btn-primary mt-7 w-full" href="/login">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }
  return <RegisterForm />;
}
