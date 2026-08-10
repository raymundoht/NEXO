import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const SalesView = dynamic(
  () => import("@/components/sales/sales-view").then((m) => ({ default: m.SalesView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Historial de ventas" };

export default async function SalesPage() {
  await requirePagePermission("sales.read");
  return <SalesView />;
}
