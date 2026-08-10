import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const PosView = dynamic(
  () => import("@/components/pos/pos-view").then((m) => ({ default: m.PosView })),
  { loading: () => <div className="h-screen bg-[var(--color-app)] flex items-center justify-center"><div className="animate-pulse text-[var(--color-text-muted)]">Cargando terminal...</div></div> }
);

export const metadata: Metadata = { title: "Punto de venta" };

export default async function PosPage() {
  await requirePagePermission("pos.sell");
  return <PosView />;
}
