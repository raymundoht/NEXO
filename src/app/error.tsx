"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--surface, #f8fafc)" }}>
          <div className="max-w-md w-full text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-tint, #fef2f2)" }}>
              <span className="text-2xl" style={{ color: "var(--danger, #dc2626)" }}>!</span>
            </div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text, #1e293b)" }}>Algo salió mal</h1>
            <p className="text-sm" style={{ color: "var(--muted, #64748b)" }}>
              Ocurrió un error inesperado. Intenta de nuevo.
              {error.digest ? ` Referencia: ${error.digest}.` : ""}
            </p>
            <button
              onClick={reset}
              className="btn btn-primary"
            >
              Intentar de nuevo
            </button>
          </div>
    </div>
  );
}
