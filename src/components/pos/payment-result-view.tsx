"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Printer } from "lucide-react";

export function PaymentResultView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientRequestId = searchParams.get("clientRequestId");
  const cancel = searchParams.get("cancel");

  const [status, setStatus] = useState<string>("LOADING");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!clientRequestId) return;
    try {
      const res = await fetch(`/api/stripe/status/${clientRequestId}`);
      if (res.ok) {
        const data = await res.json();
        if (['SUCCEEDED', 'FAILED', 'EXPIRED', 'REVIEW_REQUIRED'].includes(data.status)) {
          setStatus(data.status);
          setSaleId(data.saleId);
          if (data.errorMessage) setErrorMsg(data.errorMessage);
          return true; // Final state reached
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  }, [clientRequestId]);

  useEffect(() => {
    if (!clientRequestId) {
      setStatus("ERROR");
      return;
    }

    if (cancel) {
      setStatus("CANCELLED");
      return;
    }


    
    const poll = async () => {
      const isFinal = await fetchStatus();
      if (isFinal) {
        clearInterval(intervalId);
      } else {
        setPollCount(c => c + 1);
      }
    };

    poll(); // Initial check
    const intervalId = setInterval(poll, 3000);

    return () => clearInterval(intervalId);
  }, [clientRequestId, cancel, fetchStatus]);

  useEffect(() => {
    if (pollCount >= 5 && status === "LOADING") {
      setStatus("POLL_LIMIT_REACHED");
    }
  }, [pollCount, status]);

  const renderContent = () => {
    switch (status) {
      case "LOADING":
        return (
          <div className="flex flex-col items-center gap-4 text-primary">
            <Loader2 className="w-16 h-16 animate-spin" />
            <h2 className="text-2xl font-semibold">Procesando pago...</h2>
            <p className="text-muted-foreground">Por favor no cierres esta ventana.</p>
          </div>
        );
      case "POLL_LIMIT_REACHED":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 animate-spin text-muted-foreground" />
            <h2 className="text-2xl font-semibold">El pago está tomando más de lo esperado</h2>
            <p className="text-muted-foreground">Stripe todavía está procesando el cobro.</p>
            <button className="btn btn-primary" onClick={() => { setPollCount(0); setStatus("LOADING"); }}>
              Comprobar nuevamente
            </button>
          </div>
        );
      case "SUCCEEDED":
        return (
          <div className="flex flex-col items-center gap-4 text-green-600">
            <CheckCircle2 className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">¡Pago completado!</h2>
            <p className="text-muted-foreground">La transacción fue autorizada y materializada.</p>
            <div className="flex gap-4 mt-4">
              <button className="btn btn-secondary" onClick={() => router.push("/pos")}>
                Nueva Venta
              </button>
              {saleId && (
                <button className="btn btn-primary flex items-center gap-2" onClick={() => window.open(`/api/sales/${saleId}/ticket`, "_blank")}>
                  <Printer className="w-4 h-4" />
                  Imprimir Ticket
                </button>
              )}
            </div>
          </div>
        );
      case "FAILED":
      case "EXPIRED":
      case "CANCELLED":
        return (
          <div className="flex flex-col items-center gap-4 text-destructive">
            <XCircle className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">
              {status === "CANCELLED" ? "Pago cancelado" : "El pago falló o expiró"}
            </h2>
            <p className="text-muted-foreground">{errorMsg || "No se realizó ningún cobro."}</p>
            <button className="btn btn-primary mt-4" onClick={() => router.push("/pos")}>
              Volver al punto de venta
            </button>
          </div>
        );
      case "REVIEW_REQUIRED":
        return (
          <div className="flex flex-col items-center gap-4 text-amber-500">
            <AlertTriangle className="w-16 h-16" />
            <h2 className="text-2xl font-semibold">El pago requiere revisión</h2>
            <p className="text-muted-foreground text-center max-w-md">
              El cobro pudo haberse realizado en Stripe, pero hubo un error interno al materializar la venta (posible conflicto de inventario).
            </p>
            <p className="text-xs text-muted-foreground">Razón: {errorMsg}</p>
            <button className="btn btn-secondary mt-4" onClick={() => router.push("/pos")}>
              Volver al punto de venta
            </button>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 text-destructive">
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
      <div className="p-8 border rounded-lg shadow-sm bg-card text-card-foreground">
        {renderContent()}
      </div>
    </div>
  );
}
