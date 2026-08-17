"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main
          className="flex min-h-screen items-center justify-center p-6"
          style={{ backgroundColor: "#f8fafc", color: "#1e293b" }}
        >
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-2xl text-red-600">
              !
            </div>
            <h1 className="text-xl font-bold">No fue posible cargar NEXO ERP</h1>
            <p className="text-sm text-slate-600">
              Ocurrió un error inesperado. Intenta de nuevo.
              {error.digest ? ` Referencia: ${error.digest}.` : ""}
            </p>
            <button className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" onClick={reset}>
              Intentar de nuevo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
