import type { Metadata } from "next";
import dynamic from "next/dynamic";
// Registration disabled for closed system

const LoginForm = dynamic(
  () => import("@/components/auth/login-form").then((m) => ({ default: m.LoginForm })),
  { loading: () => <div className="min-h-screen bg-[var(--color-app)] flex items-center justify-center"><div className="animate-pulse text-[var(--color-text-muted)]">Cargando...</div></div> }
);

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; registered?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      initialEmail={params.email?.slice(0, 320) || ""}
      registered={params.registered === "1"}
      registrationEnabled={false}
    />
  );
}
