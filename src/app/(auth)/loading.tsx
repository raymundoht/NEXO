export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-app)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)] animate-pulse">Cargando...</p>
      </div>
    </div>
  );
}
