import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const PaymentResultView = dynamic(
  () => import("@/components/pos/payment-result-view").then((m) => ({ default: m.PaymentResultView })),
  { loading: () => <div className="min-h-screen bg-[var(--color-app)] flex items-center justify-center"><div className="animate-pulse text-[var(--color-text-muted)]">Verificando pago...</div></div> }
);

export const metadata: Metadata = { title: "Resultado del Pago" };

export default async function PaymentResultPage() {
  await requirePagePermission("sales.create");
  return <PaymentResultView />;
}
