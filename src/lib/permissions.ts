import { Role } from "@prisma/client";
import { ApiError } from "@/lib/api";

export type Permission =
  | "dashboard.read"
  | "inventory.read"
  | "inventory.write"
  | "inventory.audit"
  | "purchases.read"
  | "purchases.write"
  | "purchases.receive"
  | "suppliers.manage"
  | "pos.sell"
  | "sales.read"
  | "sales.create"
  | "sales.manage"
  | "sales.refund"
  | "sales.cancel"
  | "payments.manage"
  | "cash.manage"
  | "users.manage"
  | "settings.manage"
  | "settings.appearance"
  | "audit.read"
  | "purchases.export"
  | "sales.export";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "dashboard.read",
    "inventory.read",
    "inventory.write",
    "inventory.audit",
    "purchases.read",
    "purchases.write",
    "purchases.receive",
    "suppliers.manage",
    "pos.sell",
    "sales.read",
    "sales.create",
    "sales.manage",
    "sales.refund",
    "sales.cancel",
    "payments.manage",
    "cash.manage",
    "users.manage",
    "settings.manage",
    "settings.appearance",
    "audit.read",
    "purchases.export",
    "sales.export"
  ]),
  WAREHOUSE: new Set<Permission>([
    "dashboard.read",
    "inventory.read",
    "inventory.write",
    "inventory.audit",
    "purchases.read",
    "purchases.receive"
  ]),
  BUYER: new Set<Permission>([
    "dashboard.read",
    "inventory.read",
    "purchases.read",
    "purchases.write",
    "suppliers.manage",
    "purchases.export"
  ]),
  CASHIER: new Set<Permission>([
    "dashboard.read",
    "pos.sell",
    "sales.read",
    "cash.manage"
  ])
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function assertPermission(role: Role, permission: Permission) {
  if (!can(role, permission)) {
    throw new ApiError(
      403,
      "No tienes permiso para realizar esta acción.",
      "FORBIDDEN"
    );
  }
}

export function permissionsFor(role: Role) {
  return [...ROLE_PERMISSIONS[role]];
}
