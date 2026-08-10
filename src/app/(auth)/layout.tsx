import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--surface)] lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden bg-[var(--sidebar)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-24 h-96 w-96 rounded-full bg-[var(--primary)] opacity-30 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-[var(--color-success)] opacity-15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img
            src="/logo-white.png"
            alt="NEXO ERP Logo"
            className="h-10 w-auto object-contain"
          />
          <div>
            <p className="text-xl font-bold">NEXO</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
              Enterprise Resource Planning
            </p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <span className="badge mb-5 !bg-white/10 !text-white">
            Operación conectada
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-[-0.04em] xl:text-5xl">
            Inventario, compras y ventas en un solo lugar.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/60">
            Controla cada movimiento con trazabilidad, seguridad por roles y
            datos en tiempo real.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Feature icon={<ShieldCheck size={18} />} text="Acceso seguro por rol" />
            <Feature icon={<CheckCircle2 size={18} />} text="Operaciones auditables" />
          </div>
        </div>
        <p className="relative text-xs text-white/35">
          Sistema Integral de Cadena de Suministros v1.0
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  text
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75 backdrop-blur">
      <span className="text-[var(--color-accent)]">{icon}</span>
      {text}
    </div>
  );
}
