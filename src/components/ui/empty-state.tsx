import { PackageOpen } from "lucide-react";

export function EmptyState({
  title = "No hay información",
  description = "Los registros aparecerán aquí cuando estén disponibles."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-2xl bg-[var(--primary-tint)] p-3 text-[var(--primary)]">
        <PackageOpen size={24} />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}
