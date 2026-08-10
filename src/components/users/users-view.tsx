"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CirclePlus, KeyRound, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PasswordStrength } from "@/components/auth/password-strength";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
};

export function UsersView() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ items: UserRow[] }>("/api/users?pageSize=100");
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          password: form.get("password")
        })
      });
      event.currentTarget.reset();
      setNewPassword("");
      setShowForm(false);
      setMessage("Usuario creado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear.");
    }
  }

  async function update(id: string, data: Record<string, unknown>) {
    try {
      await apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      setMessage("Usuario actualizado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible actualizar.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios y roles"
        description="Accesos internos separados por responsabilidades operativas."
        actions={<button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? <X size={17} /> : <CirclePlus size={17} />}{showForm ? "Cerrar" : "Nuevo usuario"}</button>}
      />
      <Notice type="error" message={error} />
      <Notice type="success" message={message} />
      {showForm ? (
        <form className="card p-5 md:p-6" onSubmit={create}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]"><UserRoundCheck size={20} /></span>
            <div><h2 className="font-semibold">Nuevo acceso interno</h2><p className="text-xs text-[var(--muted)]">La contraseña debe cumplir la política estricta.</p></div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Nombre completo" name="name" required />
            <Input label="Correo institucional" name="email" required type="email" />
            <label><span className="label">Rol</span><select className="field" name="role"><option value="WAREHOUSE">Almacenista</option><option value="BUYER">Comprador</option><option value="CASHIER">Cajero / Vendedor</option><option value="ADMIN">Administrador</option></select></label>
            <Input
              autoComplete="new-password"
              label="Contraseña temporal"
              maxLength={128}
              minLength={10}
              name="password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </div>
          <div className="ml-auto max-w-sm"><PasswordStrength password={newPassword} /></div>
          <div className="mt-4 flex justify-end"><button className="btn btn-primary">Crear usuario</button></div>
        </form>
      ) : null}
      <section className="card overflow-hidden">
        {loading ? <div className="skeleton h-72" /> : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Seguridad</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{items.map((user) => (
                <tr key={user.id}>
                  <td><p className="font-semibold">{user.name}</p><p className="text-[11px] text-[var(--muted)]">{user.email}</p></td>
                  <td><span className="badge"><ShieldCheck size={13} /> {roleLabel(user.role)}</span></td>
                  <td>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca"}</td>
                  <td>{user.lockedUntil && new Date(user.lockedUntil) > new Date() ? <span className="text-xs font-semibold text-[var(--danger)]">Bloqueado hasta {formatDate(user.lockedUntil)}</span> : <span className="text-xs text-[var(--success)]">Sin bloqueo</span>}</td>
                  <td><StatusBadge status={user.status} /></td>
                  <td>
                    <div className="flex gap-2">
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() ? <button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => update(user.id, { unlock: true })}><KeyRound size={13} /> Desbloquear</button> : null}
                      {user.status === "PENDING_APPROVAL" ? (
                        <>
                          <button className="btn btn-primary !min-h-8 !py-1 text-xs" onClick={() => update(user.id, { status: "ACTIVE" })}>Aprobar</button>
                          <button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => update(user.id, { status: "REJECTED" })}>Rechazar</button>
                        </>
                      ) : (
                        <button className="btn btn-secondary !min-h-8 !py-1 text-xs" onClick={() => update(user.id, { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>
                          {user.status === "ACTIVE" ? "Suspender" : "Activar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin usuarios" description="Crea accesos para cada responsable operativo." />}
      </section>
    </div>
  );
}

function Input({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label><span className="label">{label}</span><input className="field" name={name} {...props} /></label>;
}

function roleLabel(role: string) {
  return { ADMIN: "Administrador", WAREHOUSE: "Almacenista", BUYER: "Comprador", CASHIER: "Cajero" }[role] || role;
}
