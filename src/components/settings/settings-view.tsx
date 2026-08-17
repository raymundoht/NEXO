"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, CirclePlus, Save, Store } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";

type Settings = {
  businessName: string;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  baseCurrency: string;
  allowedCurrencies: string[];
  defaultTaxRate: string;
  maxCashierDiscountRate: string;
  ticketFooter?: string | null;
};
type Register = { id: string; code: string; name: string };

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [settingsResult, registerResult] = await Promise.all([
        apiFetch<Settings>("/api/settings"),
        apiFetch<Register[]>("/api/cash-registers")
      ]);
      setSettings(settingsResult);
      setRegisters(registerResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          businessName: form.get("businessName"),
          taxId: form.get("taxId") || null,
          address: form.get("address") || null,
          phone: form.get("phone") || null,
          baseCurrency: form.get("baseCurrency"),
          allowedCurrencies: String(form.get("allowedCurrencies") || "MXN").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
          defaultTaxRate: form.get("defaultTaxRate"),
          maxCashierDiscountRate: form.get("maxCashierDiscountRate"),
          ticketFooter: form.get("ticketFooter") || null
        })
      });
      setSettings(result);
      setMessage("Configuración guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar.");
    }
  }

  async function createRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiFetch("/api/cash-registers", { method: "POST", body: JSON.stringify({ code: data.get("code"), name: data.get("name") }) });
      form.reset();
      setMessage("Caja registrada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administración" title="Configuración general" description="Datos del negocio, impuestos, monedas, descuentos y terminales de caja." />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      {!settings ? <div className="skeleton h-96 rounded-[20px]" /> : (
        <form className="card p-5 md:p-6" onSubmit={save}>
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]"><Building2 size={21} /></span><div><h2 className="font-semibold">Datos operativos</h2><p className="text-xs text-[var(--muted)]">También aparecen en los tickets generados.</p></div></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Nombre del negocio" name="businessName" defaultValue={settings.businessName} required className="xl:col-span-2" />
            <Input label="RFC / ID fiscal" name="taxId" defaultValue={settings.taxId || ""} />
            <Input label="Teléfono" name="phone" defaultValue={settings.phone || ""} />
            <Input label="Dirección" name="address" defaultValue={settings.address || ""} className="md:col-span-2" />
            <Input label="Pie de ticket" name="ticketFooter" defaultValue={settings.ticketFooter || ""} className="md:col-span-2" />
            <Input label="Moneda base" name="baseCurrency" defaultValue={settings.baseCurrency} required />
            <Input label="Monedas habilitadas (separadas por coma)" name="allowedCurrencies" defaultValue={settings.allowedCurrencies.join(", ")} required />
            <Input label="Impuesto predeterminado %" name="defaultTaxRate" defaultValue={settings.defaultTaxRate} type="number" step="0.01" required />
            <Input label="Descuento máximo de cajero %" name="maxCashierDiscountRate" defaultValue={settings.maxCashierDiscountRate} type="number" step="0.01" required />
          </div>
          <div className="mt-5 flex justify-end"><button className="btn btn-primary"><Save size={16} /> Guardar cambios</button></div>
        </form>
      )}
      <section className="card p-5 md:p-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]"><Store size={21} /></span><div><h2 className="font-semibold">Terminales de caja</h2><p className="text-xs text-[var(--muted)]">{registers.length} terminales registradas</p></div></div>
        <div className="mt-5 flex flex-wrap gap-2">{registers.map((register) => <span className="badge" key={register.id}>{register.code} · {register.name}</span>)}</div>
        <form className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto]" onSubmit={createRegister}>
          <input className="field" name="code" placeholder="Clave, ej. CAJA-02" required />
          <input className="field" name="name" placeholder="Nombre de la terminal" required />
          <button className="btn btn-secondary"><CirclePlus size={16} /> Agregar caja</button>
        </form>
      </section>
    </div>
  );
}

function Input({ label, name, className, ...props }: { label: string; name: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={className}><span className="label">{label}</span><input className="field" name={name} {...props} /></label>;
}
