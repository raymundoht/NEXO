import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const InventoryCountsView = dynamic(
  () => import("@/components/inventory/inventory-counts-view").then((m) => ({ default: m.InventoryCountsView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Conteos físicos" };

export default async function InventoryCountsPage() {
  await requirePagePermission("inventory.audit");
  return <InventoryCountsView />;
}
