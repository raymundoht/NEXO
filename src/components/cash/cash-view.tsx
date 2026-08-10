"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { LockKeyhole, WalletCards } from "lucide-react";
import { apiFetch, formatDate, formatMoney } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSessionUser } from "@/components/layout/user-context";
import {
  denominationTotal,
  denominationsFor,
  emptyDenominationCounts,
  supportsCashDenominations,
  type DenominationCounts
} from "@/lib/cash-denominations";

type Register = {
  id: string;
  code: string;
  name: string;
  sessions: Array<{ id: string; cashierId: string; openedAt: string; currency: string }>;
};
type CashSession = {
  id: string;
  status: string;
  currency: string;
  openingAmount: string;
  expectedClosingAmount?: string | null;
  countedClosingAmount?: string | null;
  difference?: string | null;
  openedAt: string;
  closedAt?: string | null;
  cashRegister: { id: string; code: string; name: string };
  cashier: { id: string; name: string };
};

export function CashView() {
  const user = useSessionUser();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingCurrency, setOpeningCurrency] = useState("MXN");
  const [allowedCurrencies, setAllowedCurrencies] = useState(["MXN"]);
  const [openingDenominations, setOpeningDenominations] =
    useState<DenominationCounts>(() => emptyDenominationCounts("MXN"));
  const [closingDenominations, setClosingDenominations] =
    useState<DenominationCounts>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [registerResult, sessionResult, configResult] = await Promise.all([
        apiFetch<Register[]>("/api/cash-registers"),
        apiFetch<{ items: CashSession[] }>("/api/cash-sessions?pageSize=100"),
        apiFetch<{ baseCurrency: string; allowedCurrencies: string[] }>(
          "/api/pos/config"
        )
      ]);
      setRegisters(registerResult);
      setSessions(sessionResult.items);
      const cashCurrencies = configResult.allowedCurrencies.filter(
        supportsCashDenominations
      );
      const defaultCashCurrency = supportsCashDenominations(
        configResult.baseCurrency
      )
        ? configResult.baseCurrency
        : cashCurrencies[0] || "MXN";
      setAllowedCurrencies(cashCurrencies.length ? cashCurrencies : ["MXN"]);
      setOpeningCurrency(defaultCashCurrency);
      setOpeningDenominations(
        emptyDenominationCounts(defaultCashCurrency)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.status === "OPEN" && session.cashier.id === user.id),
    [sessions, user.id]
  );

  useEffect(() => {
    if (currentSession) {
      setClosingDenominations(
        emptyDenominationCounts(currentSession.currency)
      );
    }
  }, [currentSession]);

  async function openSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/cash-sessions", {
        method: "POST",
        body: JSON.stringify({
          cashRegisterId: form.get("cashRegisterId"),
          currency: openingCurrency,
          openingAmount: denominationTotal(openingDenominations),
          denominations: openingDenominations
        })
      });
      setOpeningDenominations(emptyDenominationCounts(openingCurrency));
      setMessage("Caja abierta correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible abrir.");
    }
  }

  async function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSession) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/cash-sessions/${currentSession.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          countedAmount: denominationTotal(closingDenominations),
          denominations: closingDenominations,
          notes: form.get("notes") || null
        })
      });
      setClosingDenominations(
        emptyDenominationCounts(currentSession.currency)
      );
      setMessage("Caja cerrada y arqueo registrado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cerrar.");
    }
  }

  async function movement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSession) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/cash-sessions/${currentSession.id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          amount: form.get("amount"),
          notes: form.get("notes")
        })
      });
      event.currentTarget.reset();
      setMessage("Movimiento de efectivo registrado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible registrar.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control diario" title="Caja y arqueos" description="Aperturas, movimientos, flujo neto de efectivo y cierre diario por terminal." />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />

      {currentSession ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <section className="card p-5">
            <span className="badge !bg-[var(--success-tint)] !text-[var(--success)]"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Sesión abierta</span>
            <h2 className="mt-4 text-xl font-bold">{currentSession.cashRegister.name}</h2>
            <p className="text-sm text-[var(--muted)]">{currentSession.cashRegister.code} · {currentSession.currency}</p>
            <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4">
              <p className="text-xs text-[var(--muted)]">Fondo inicial</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(currentSession.openingAmount, currentSession.currency)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Abierta {formatDate(currentSession.openedAt)}</p>
            </div>
          </section>
          <form className="card p-5" onSubmit={movement}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]"><WalletCards size={20} /></span>
              <div><h2 className="font-semibold">Movimiento manual</h2><p className="text-xs text-[var(--muted)]">Entradas y retiros auditados</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <select className="field" name="type"><option value="CASH_IN">Entrada de efectivo</option><option value="CASH_OUT">Retiro de efectivo</option></select>
              <input className="field" min="0.01" name="amount" placeholder="Importe" required step="0.01" type="number" />
              <input className="field" minLength={5} name="notes" placeholder="Motivo del movimiento" required />
              <button className="btn btn-secondary w-full">Registrar movimiento</button>
            </div>
          </form>
          <form className="card border-[var(--danger)]/20 p-5" onSubmit={closeSession}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--danger-tint)] text-[var(--danger)]"><LockKeyhole size={20} /></span>
              <div><h2 className="font-semibold">Cerrar y arquear</h2><p className="text-xs text-[var(--muted)]">Cuenta el efectivo físico</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <DenominationCounter
                counts={closingDenominations}
                currency={currentSession.currency}
                onChange={setClosingDenominations}
              />
              <div className="rounded-xl bg-[var(--surface-2)] p-3 text-sm">
                Efectivo contado:{" "}
                <strong>
                  {formatMoney(
                    denominationTotal(closingDenominations),
                    currentSession.currency
                  )}
                </strong>
              </div>
              <input className="field" name="notes" placeholder="Notas del cierre (opcional)" />
              <button className="btn btn-danger w-full">Cerrar caja</button>
            </div>
          </form>
        </div>
      ) : (
        <form className="card max-w-2xl p-5 md:p-6" onSubmit={openSession}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]"><WalletCards size={21} /></span>
            <div><h2 className="font-semibold">Abrir sesión de caja</h2><p className="text-xs text-[var(--muted)]">Selecciona la terminal y registra el fondo inicial.</p></div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="label">Caja</span><select className="field" name="cashRegisterId" required><option value="">Seleccionar</option>{registers.filter((register) => !register.sessions.length).map((register) => <option key={register.id} value={register.id}>{register.code} · {register.name}</option>)}</select></label>
            <label><span className="label">Moneda</span><select className="field" value={openingCurrency} onChange={(event) => { setOpeningCurrency(event.target.value); setOpeningDenominations(emptyDenominationCounts(event.target.value)); }}>{allowedCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
            <div className="md:col-span-2">
              <DenominationCounter
                counts={openingDenominations}
                currency={openingCurrency}
                onChange={setOpeningDenominations}
              />
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3 text-sm md:col-span-2">
              Fondo inicial:{" "}
              <strong>
                {formatMoney(
                  denominationTotal(openingDenominations),
                  openingCurrency
                )}
              </strong>
            </div>
          </div>
          <div className="mt-5 flex justify-end"><button className="btn btn-primary">Abrir caja</button></div>
        </form>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] p-5"><h2 className="font-semibold">Historial de sesiones</h2><p className="text-xs text-[var(--muted)]">Aperturas, cierres y diferencias de arqueo</p></div>
        {loading ? <div className="skeleton h-64" /> : sessions.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Caja</th><th>Cajero</th><th>Apertura</th><th>Fondo</th><th>Conteo final</th><th>Diferencia</th><th>Estado</th></tr></thead>
              <tbody>{sessions.map((session) => (
                <tr key={session.id}>
                  <td className="font-semibold">{session.cashRegister.code}</td><td>{session.cashier.name}</td><td>{formatDate(session.openedAt)}</td>
                  <td>{formatMoney(session.openingAmount, session.currency)}</td><td>{session.countedClosingAmount ? formatMoney(session.countedClosingAmount, session.currency) : "—"}</td>
                  <td className={Number(session.difference || 0) !== 0 ? "font-semibold text-[var(--danger)]" : ""}>{session.difference ? formatMoney(session.difference, session.currency) : "—"}</td>
                  <td><StatusBadge status={session.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin sesiones" description="Las aperturas de caja aparecerán aquí." />}
      </section>
    </div>
  );
}

function DenominationCounter({
  currency,
  counts,
  onChange
}: {
  currency: string;
  counts: DenominationCounts;
  onChange: (value: DenominationCounts) => void;
}) {
  return (
    <div>
      <p className="label">Conteo por denominaciones</p>
      <div className="grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-[var(--border)] p-3 sm:grid-cols-2">
        {denominationsFor(currency).map((denomination) => {
          const key = String(denomination);
          const count = counts[key] || 0;
          return (
            <label
              className="grid grid-cols-[72px_1fr_86px] items-center gap-2 text-xs"
              key={key}
            >
              <span className="font-semibold">
                {formatMoney(denomination, currency)}
              </span>
              <input
                aria-label={`Cantidad de ${denomination} ${currency}`}
                className="field !h-9"
                min="0"
                onChange={(event) =>
                  onChange({
                    ...counts,
                    [key]: Math.max(0, Number(event.target.value) || 0)
                  })
                }
                step="1"
                type="number"
                value={count}
              />
              <span className="text-right text-[var(--muted)]">
                {formatMoney(denomination * count, currency)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
