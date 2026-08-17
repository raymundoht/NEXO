"use client";

export default function ERPError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="h-16 w-16 mx-auto rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
          <span className="text-2xl text-red-500">!</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Error en el módulo</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Ocurrió un error al cargar esta sección.
          {error.digest ? ` Referencia: ${error.digest}.` : ""}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
