import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const InventoryMovementsView = dynamic(
  () => import("@/components/inventory/inventory-movements-view").then((m) => ({ default: m.InventoryMovementsView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Kardex y ajustes" };

export default async function InventoryMovementsPage() {
  await requirePagePermission("inventory.read");
  return <InventoryMovementsView />;
}
