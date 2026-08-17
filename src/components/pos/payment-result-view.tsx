"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Printer } from "lucide-react";
import { apiFetch } from "@/lib/client-api";

export function PaymentResultView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientRequestId = searchParams.get("clientRequestId");
  const cancel = searchParams.get("cancel");

  const [status, setStatus] = useState<string>("LOADING");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!clientRequestId) {
      setStatus("ERROR");
      return;
    }

    if (cancel) {
      setStatus("CANCELLED");
      void apiFetch("/api/stripe/checkout", {
        method: "DELETE",
        body: JSON.stringify({ clientRequestId })
      }).catch((error) => {
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "No fue posible cancelar el intento de pago."
        );
      });
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setStatus("LOADING");
    setErrorMsg(null);

    const poll = async () => {
      try {
        const data = await apiFetch<{
          status: string;
          saleId: string;
          reasonCode?: string | null;
        }>(`/api/stripe/status/${clientRequestId}`);
        if (!active) return;
        if (["SUCCEEDED", "FAILED", "EXPIRED", "REVIEW_REQUIRED"].includes(data.status)) {
          setStatus(data.status);
          setSaleId(data.saleId);
          if (data.reasonCode) setErrorMsg(data.reasonCode);
          return;
        }
      } catch (error) {
        if (!active) return;
        setErrorMsg(error instanceof Error ? error.message : "No fue posible consultar el pago.");
      }
      attempts += 1;
      if (attempts >= 5) {
        setStatus("POLL_LIMIT_REACHED");
        return;
      }
      timer = setTimeout(poll, 3000);
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [clientRequestId, cancel, retryKey]);

  const renderContent = () => {
    switch (status) {
      case "LOADING":
        return (
          <div className="flex flex-col items-center gap-4 text-[var(--primary)]">
            <Loader2 className="w-16 h-16 animate-spin" />
            <h2 className="text-2xl font-semibold">Procesando pago...</h2>
            <p className="text-[var(--muted)]">Por favor no cierres esta ventana.</p>
          </div>
        );
      case "POLL_LIMIT_REACHED":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-[var(--muted)]" />
            <h2 className="text-2xl font-semibold">El pago está tomando más de lo esperado</h2>
            <p className="text-[var(--muted)]">Stripe todavía está procesando el cobro.</p>
            <button className="btn btn-primary" onClick={() => setRetryKey((value) => value + 1)}>
              Comprobar nuevamente
            </button>
          </div>
        );
      case "SUCCEEDED":
        return (
          <div className="flex flex-col items-center gap-4 text-[var(--success)]">
            <CheckCircle2 className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">¡Pago completado!</h2>
            <p className="text-[var(--muted)]">La transacción fue autorizada y materializada.</p>
            <div className="flex gap-4 mt-4">
              <button className="btn btn-secondary" onClick={() => router.push("/pos")}>
                Nueva Venta
              </button>
              {saleId && (
                <button className="btn btn-primary flex items-center gap-2" onClick={() => window.open(`/api/sales/${saleId}/ticket`, "_blank", "noopener")}>
                  <Printer className="w-4 h-4" />
                  Descargar ticket
                </button>
              )}
            </div>
          </div>
        );
      case "FAILED":
      case "EXPIRED":
      case "CANCELLED":
        return (
          <div className="flex flex-col items-center gap-4 text-[var(--danger)]">
            <XCircle className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">
              {status === "CANCELLED" ? "Pago cancelado" : "El pago falló o expiró"}
            </h2>
            <p className="text-[var(--muted)]">{errorMsg || "No se realizó ningún cobro."}</p>
            <button className="btn btn-primary mt-4" onClick={() => router.push("/pos")}>
              Volver al punto de venta
            </button>
          </div>
        );
      case "REVIEW_REQUIRED":
        return (
          <div className="flex flex-col items-center gap-4 text-[var(--warning)]">
            <AlertTriangle className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">El pago requiere revisión</h2>
            <p className="text-[var(--muted)] text-center max-w-md">
              El cobro pudo haberse realizado en Stripe, pero hubo un error interno al materializar la venta (posible conflicto de inventario).
            </p>
            <p className="text-xs text-[var(--muted)]">Razón: {errorMsg}</p>
            <button className="btn btn-secondary mt-4" onClick={() => router.push("/pos")}>
              Volver al punto de venta
            </button>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 text-[var(--danger)]">
            <XCircle className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">Error al consultar el estado</h2>
            <button className="btn btn-primary mt-4" onClick={() => router.push("/pos")}>
              Volver
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="p-8 border rounded-lg shadow-sm bg-[var(--surface)] text-[var(--text)]">
        {renderContent()}
      </div>
    </div>
  );
}
