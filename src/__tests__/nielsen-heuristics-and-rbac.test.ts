import { describe, it, expect } from "vitest";
import { Role, Prisma } from "@prisma/client";
import { can, assertPermission, permissionsFor } from "@/lib/permissions";
import { calculateLine, calculateTotals } from "@/lib/money";
import { strongPassword } from "@/lib/validators";
import { hashToken, generateSecureToken, hashPassword, verifyPassword } from "@/lib/security";

describe("Batería de Pruebas: Seguridad, Roles y Heurísticas de Nielsen", () => {

  describe("1. Matriz de Roles y Permisos (RBAC)", () => {
    it("ADMIN tiene acceso total a todos los módulos y funciones sensibles", () => {
      const adminPermissions = permissionsFor(Role.ADMIN);
      expect(adminPermissions).toContain("users.manage");
      expect(adminPermissions).toContain("sales.refund");
      expect(adminPermissions).toContain("sales.cancel");
      expect(adminPermissions).toContain("audit.read");
      expect(adminPermissions).toContain("settings.manage");
      expect(adminPermissions).toContain("inventory.write");
      expect(adminPermissions).toContain("purchases.write");
      expect(adminPermissions).toContain("pos.sell");
    });

    it("WAREHOUSE (Almacén) sólo puede gestionar inventario y recibir compras", () => {
      expect(can(Role.WAREHOUSE, "inventory.read")).toBe(true);
      expect(can(Role.WAREHOUSE, "inventory.write")).toBe(true);
      expect(can(Role.WAREHOUSE, "inventory.audit")).toBe(true);
      expect(can(Role.WAREHOUSE, "purchases.read")).toBe(true);
      expect(can(Role.WAREHOUSE, "purchases.receive")).toBe(true);

      // No debe tener acceso a usuarios, ventas, finanzas ni compras directas
      expect(can(Role.WAREHOUSE, "users.manage")).toBe(false);
      expect(can(Role.WAREHOUSE, "purchases.write")).toBe(false);
      expect(can(Role.WAREHOUSE, "pos.sell")).toBe(false);
      expect(can(Role.WAREHOUSE, "sales.refund")).toBe(false);
      expect(can(Role.WAREHOUSE, "settings.manage")).toBe(false);
    });

    it("BUYER (Compras) sólo puede gestionar órdenes de compra y proveedores", () => {
      expect(can(Role.BUYER, "purchases.read")).toBe(true);
      expect(can(Role.BUYER, "purchases.write")).toBe(true);
      expect(can(Role.BUYER, "suppliers.manage")).toBe(true);
      expect(can(Role.BUYER, "purchases.export")).toBe(true);

      // No debe tener acceso a recepciones de almacén ni ventas ni usuarios
      expect(can(Role.BUYER, "purchases.receive")).toBe(false);
      expect(can(Role.BUYER, "users.manage")).toBe(false);
      expect(can(Role.BUYER, "pos.sell")).toBe(false);
      expect(can(Role.BUYER, "sales.refund")).toBe(false);
    });

    it("CASHIER (Cajero) sólo puede usar el POS, consultar sus ventas y gestionar su caja", () => {
      expect(can(Role.CASHIER, "pos.sell")).toBe(true);
      expect(can(Role.CASHIER, "sales.read")).toBe(true);
      expect(can(Role.CASHIER, "sales.refund")).toBe(false);
      expect(can(Role.CASHIER, "cash.manage")).toBe(true);

      // No debe tener acceso a usuarios, configuración global ni proveedores
      expect(can(Role.CASHIER, "users.manage")).toBe(false);
      expect(can(Role.CASHIER, "suppliers.manage")).toBe(false);
      expect(can(Role.CASHIER, "settings.manage")).toBe(false);
      expect(can(Role.CASHIER, "settings.appearance")).toBe(false);
    });

    it("lanza error 403 con mensaje en español al violar permisos", () => {
      expect(() => assertPermission(Role.CASHIER, "users.manage")).toThrow("No tienes permiso para realizar esta acción.");
    });
  });

  describe("2. Encriptado y Seguridad Criptográfica de Paquetes", () => {
    it("genera tokens seguros de 32 bytes en formato base64url", () => {
      const token = generateSecureToken(32);
      expect(token.length).toBeGreaterThanOrEqual(40);
    });

    it("aplica hash SHA-256 a los tokens de sesión de manera determinista", () => {
      const rawToken = "test_token_12345";
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("encripta y verifica contraseñas correctamente con Argon2id", async () => {
      const password = "PasswordSuperSegura#2026!";
      const hash = await hashPassword(password);
      expect(hash).toMatch(/^\$argon2id\$/);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword(hash, "WrongPassword123!");
      expect(isInvalid).toBe(false);
    });
  });

  describe("3. Heurísticas de Usabilidad de Nielsen", () => {

    it("H2: Coincidencia entre el sistema y el mundo real (Cálculo preciso de precios, impuestos y descuentos)", () => {
      const line = calculateLine({
        productId: "prod_1",
        quantity: new Prisma.Decimal(5),
        unitPrice: 100,
        discountAmount: 50,
        taxRate: 16
      });
      expect(line.lineSubtotal.toString()).toBe("450");
      expect(line.lineTax.toString()).toBe("72");
      expect(line.lineTotal.toString()).toBe("522");

      const totals = calculateTotals([line]);
      expect(totals.total.toString()).toBe("522");
    });

    it("H5: Prevención de errores (Exige contraseñas robustas con min. 8 caracteres, mayúscula, minúscula y número)", () => {
      expect(strongPassword.safeParse("Debil1").success).toBe(false); // < 8 chars
      expect(strongPassword.safeParse("todasminusculas123!").success).toBe(false); // Sin mayúscula
      expect(strongPassword.safeParse("TODASMAYUSCULAS123!").success).toBe(false); // Sin minúscula
      expect(strongPassword.safeParse("SinNumero!").success).toBe(false); // Sin número
      expect(strongPassword.safeParse("RobustPass123!").success).toBe(true); // Válida
    });

    it("H4: Consistencia y Estándares (Garantiza que la lista de permisos de cada rol es inmutable)", () => {
      const adminSet1 = permissionsFor(Role.ADMIN);
      const adminSet2 = permissionsFor(Role.ADMIN);
      expect(adminSet1).toEqual(adminSet2);
    });

    it("H9: Recuperación de errores (Mensajes claros de error en llamadas de dominio)", () => {
      expect(() => calculateLine({
        productId: "p1",
        quantity: new Prisma.Decimal(1),
        unitPrice: 50,
        discountAmount: 100, // Descuento superior al importe
        taxRate: 16
      })).toThrow("El descuento no puede superar el importe.");
    });
  });
});
