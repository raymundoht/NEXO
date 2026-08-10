import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ForgotPasswordForm = dynamic(
  () => import("@/components/auth/forgot-password-form").then((m) => ({ default: m.ForgotPasswordForm })),
  { loading: () => <div className="min-h-screen bg-[var(--color-app)] flex items-center justify-center"><div className="animate-pulse text-[var(--color-text-muted)]">Cargando...</div></div> }
);

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
