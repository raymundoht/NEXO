import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const PurchasesView = dynamic(
  () => import("@/components/purchases/purchases-view").then((m) => ({ default: m.PurchasesView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Compras" };

export default async function PurchasesPage() {
  await requirePagePermission("purchases.read");
  return <PurchasesView />;
}
