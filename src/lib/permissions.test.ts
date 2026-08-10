import { Role } from "@prisma/client";
import { can } from "@/lib/permissions";
import { describe, expect, it } from "vitest";

describe("RBAC", () => {
  it("limita al cajero al POS, ventas inmediatas y caja", () => {
    expect(can(Role.CASHIER, "pos.sell")).toBe(true);
    expect(can(Role.CASHIER, "cash.manage")).toBe(true);
    expect(can(Role.CASHIER, "purchases.write")).toBe(false);
    expect(can(Role.CASHIER, "users.manage")).toBe(false);
  });

  it("permite recepción al almacenista, pero no emitir compras", () => {
    expect(can(Role.WAREHOUSE, "purchases.receive")).toBe(true);
    expect(can(Role.WAREHOUSE, "purchases.write")).toBe(false);
  });

  it("reserva usuarios, reembolsos y auditoría al administrador", () => {
    expect(can(Role.ADMIN, "users.manage")).toBe(true);
    expect(can(Role.ADMIN, "sales.refund")).toBe(true);
    expect(can(Role.ADMIN, "sales.cancel")).toBe(true);
    expect(can(Role.ADMIN, "audit.read")).toBe(true);
    expect(can(Role.BUYER, "sales.refund")).toBe(false);
  });

  it("limita las exportaciones al ámbito de cada rol", () => {
    expect(can(Role.WAREHOUSE, "purchases.export")).toBe(false);
    expect(can(Role.WAREHOUSE, "sales.export")).toBe(false);
    expect(can(Role.BUYER, "purchases.export")).toBe(true);
    expect(can(Role.BUYER, "sales.export")).toBe(false);
  });
});
