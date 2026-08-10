const LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  SUSPENDED: "Suspendido",
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIALLY_RECEIVED: "Recepción parcial",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
  HELD: "En espera",
  COMPLETED: "Completada",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  REFUNDED: "Reembolsada",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  IN_PROGRESS: "En proceso",
  PENDING_APPROVAL: "Pendiente de aprobación",
  REJECTED: "Rechazado",
  DISABLED: "Desactivado"
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED" ||
    status === "RECEIVED" ||
    status === "ACTIVE" ||
    status === "OPEN"
      ? "var(--color-success)"
      : status === "CANCELLED" ||
          status === "REFUNDED" ||
          status === "SUSPENDED" ||
          status === "REJECTED" ||
          status === "DISABLED"
        ? "var(--color-danger)"
        : status === "DRAFT" || status === "HELD" || status === "PENDING_APPROVAL"
          ? "var(--color-warning)"
          : "var(--color-accent)";
  return (
    <span
      className="badge text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="leading-none">{LABELS[status] || status}</span>
    </span>
  );
}
