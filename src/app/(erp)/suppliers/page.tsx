import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const SuppliersView = dynamic(
  () => import("@/components/purchases/suppliers-view").then((m) => ({ default: m.SuppliersView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Proveedores" };

export default async function SuppliersPage() {
  await requirePagePermission("suppliers.manage");
  return <SuppliersView />;
}
