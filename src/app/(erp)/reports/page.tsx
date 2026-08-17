import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requireAnyPagePermission } from "@/lib/page-auth";

const ReportsView = dynamic(
  () => import("@/components/reports/reports-view").then((m) => ({ default: m.ReportsView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage() {
  await requireAnyPagePermission(["purchases.export", "sales.export"]);
  return <ReportsView />;
}
