import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const AuditView = dynamic(
  () => import("@/components/audit/audit-view").then((m) => ({ default: m.AuditView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage() {
  await requirePagePermission("audit.read");
  return <AuditView />;
}
