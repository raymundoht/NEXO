"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Notice({
  type,
  message
}: {
  type: "error" | "success";
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
        type === "error"
          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
          : "bg-[var(--success-tint)] text-[var(--success)]"
      }`}
    >
      {type === "error" ? (
        <AlertCircle className="mt-0.5 shrink-0" size={16} />
      ) : (
        <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
      )}
      <span>{message}</span>
    </div>
  );
}
