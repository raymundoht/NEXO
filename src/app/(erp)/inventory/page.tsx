import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const InventoryView = dynamic(
  () => import("@/components/inventory/inventory-view").then((m) => ({ default: m.InventoryView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Inventario" };

export default async function InventoryPage() {
  await requirePagePermission("inventory.read");
  return <InventoryView />;
}
