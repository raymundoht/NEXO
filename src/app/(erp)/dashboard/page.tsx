import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const DashboardView = dynamic(
  () => import("@/components/dashboard/dashboard-view").then((m) => ({ default: m.DashboardView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" />)}</div></div> }
);

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  await requirePagePermission("dashboard.read");
  return <DashboardView />;
}
