import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const TEST_PASSWORD = "Test#2026Seguro";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD antes de ejecutar el seed."
    );
  }
  if (
    adminPassword.length < 10 ||
    !/[a-z]/.test(adminPassword) ||
    !/[A-Z]/.test(adminPassword) ||
    !/\d/.test(adminPassword) ||
    !/[^A-Za-z0-9]/.test(adminPassword)
  ) {
    throw new Error("SEED_ADMIN_PASSWORD no cumple la política de seguridad.");
  }
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  const testHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  await prisma.businessSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      businessName: "NEXO ERP",
      baseCurrency: "MXN",
      allowedCurrencies: ["MXN", "USD"],
      defaultTaxRate: 16,
      maxCashierDiscountRate: 10,
      ticketFooter: "Gracias por tu compra."
    },
    update: {}
  });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Administrador",
      email: adminEmail,
      role: Role.ADMIN,
      passwordHash
    },
    update: { role: Role.ADMIN, status: "ACTIVE" }
  });
  await prisma.cashRegister.upsert({
    where: { code: "CAJA-01" },
    create: { code: "CAJA-01", name: "Caja principal" },
    update: { active: true }
  });

  if (process.env.SEED_DEMO_DATA !== "true") return;

  const testUsers = [
    { email: "almacen@nexo.local", name: "Almacenista Test", role: Role.WAREHOUSE },
    { email: "compras@nexo.local", name: "Comprador Test", role: Role.BUYER },
    { email: "cajero@nexo.local", name: "Cajero Test", role: Role.CASHIER }
  ];
  for (const u of testUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, role: u.role, passwordHash: testHash },
      update: { role: u.role, status: "ACTIVE" }
    });
  }

  const [bebidas, higiene, snacks, electronica] = await Promise.all([
    prisma.category.upsert({ where: { name: "Bebidas" }, create: { name: "Bebidas" }, update: { active: true } }),
    prisma.category.upsert({ where: { name: "Higiene" }, create: { name: "Higiene" }, update: { active: true } }),
    prisma.category.upsert({ where: { name: "Snacks" }, create: { name: "Snacks" }, update: { active: true } }),
    prisma.category.upsert({ where: { name: "Electrónica" }, create: { name: "Electrónica" }, update: { active: true } })
  ]);

  const products = [
    { sku: "BEB-AGUA-600", barcode: "7501000000010", name: "Agua natural 600 ml", categoryId: bebidas.id, cost: 7.25, salePrice: 14, currentStock: 84, minStock: 24, maxStock: 180 },
    { sku: "BEB-ISO-500", barcode: "7501000000027", name: "Bebida isotónica 500 ml", categoryId: bebidas.id, cost: 15.5, salePrice: 29, currentStock: 16, minStock: 20, maxStock: 120 },
    { sku: "SNK-BAR-045", barcode: "7501000000034", name: "Barra de proteína 45 g", categoryId: snacks.id, cost: 19, salePrice: 38, currentStock: 42, minStock: 15, maxStock: 90 },
    { sku: "HIG-TOA-100", barcode: "7501000000041", name: "Toallas desinfectantes 100 pzas", categoryId: higiene.id, cost: 48, salePrice: 79, currentStock: 10, minStock: 12, maxStock: 48 },
    { sku: "ELEC-AUD-01", barcode: "7501000000058", name: "Audífonos Bluetooth", categoryId: electronica.id, cost: 120, salePrice: 299, currentStock: 35, minStock: 10, maxStock: 60 },
    { sku: "ELEC-CAR-01", barcode: "7501000000065", name: "Cable USB-C 1m", categoryId: electronica.id, cost: 18, salePrice: 45, currentStock: 150, minStock: 30, maxStock: 300 },
    { sku: "BEB-COC-355", barcode: "7501000000072", name: "Coca-Cola 355 ml", categoryId: bebidas.id, cost: 8, salePrice: 16, currentStock: 200, minStock: 50, maxStock: 400 },
    { sku: "SNK-CHI-050", barcode: "7501000000089", name: "Papas fritas 50 g", categoryId: snacks.id, cost: 9, salePrice: 18, currentStock: 80, minStock: 20, maxStock: 150 }
  ];
  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { sku: product.sku },
      select: { id: true }
    });
    const { currentStock, ...productData } = product;
    const saved = await prisma.product.upsert({
      where: { sku: product.sku },
      create: { ...productData, currentStock: 0, unit: "PZA", taxRate: 16 },
      update: { barcode: product.barcode, name: product.name, categoryId: product.categoryId, cost: product.cost, salePrice: product.salePrice, minStock: product.minStock, maxStock: product.maxStock, status: "ACTIVE" }
    });
    if (!existing && currentStock > 0) {
      await prisma.$transaction([
        prisma.product.update({
          where: { id: saved.id },
          data: { currentStock }
        }),
        prisma.stockMovement.create({
          data: {
            productId: saved.id,
            userId: admin.id,
            type: "MANUAL_ADJUSTMENT",
            quantity: currentStock,
            stockBefore: 0,
            stockAfter: currentStock,
            unitCost: product.cost,
            referenceType: "SeedOpeningBalance",
            referenceId: saved.id,
            idempotencyKey: `seed-opening:${product.sku}`,
            reason: "Saldo inicial de datos de demostración"
          }
        })
      ]);
    }
  }

  const [prov1] = await Promise.all([
    prisma.supplier.upsert({
      where: { code: "PROV-001" },
      create: { code: "PROV-001", legalName: "Distribuidora Demo del Norte, S.A. de C.V.", tradeName: "Distribuidora Norte", email: "compras@distribuidora.example", phone: "614 000 0000", contactName: "Contacto de compras", creditDays: 30, deliveryDays: 3, paymentTerms: "Crédito a 30 días" },
      update: { active: true }
    }),
    prisma.supplier.upsert({
      where: { code: "PROV-002" },
      create: { code: "PROV-002", legalName: "TechSupply México, S.A. de C.V.", tradeName: "TechSupply", email: "ventas@techsupply.example", phone: "55 1234 5678", contactName: "Ventas Mayoristas", creditDays: 15, deliveryDays: 5, paymentTerms: "Crédito a 15 días" },
      update: { active: true }
    })
  ]);

  const [aguaproduct, cocola] = await Promise.all([
    prisma.product.findUnique({ where: { sku: "BEB-AGUA-600" } }),
    prisma.product.findUnique({ where: { sku: "BEB-COC-355" } })
  ]);
  if (aguaproduct && cocola) {
    await prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: prov1.id, productId: aguaproduct.id } },
      create: { supplierId: prov1.id, productId: aguaproduct.id, supplierSku: "DISTR-AGUA-600", referenceCost: 7.25, currency: "MXN", leadDays: 2, isPreferred: true },
      update: { referenceCost: 7.25, isPreferred: true }
    });
    await prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: prov1.id, productId: cocola.id } },
      create: { supplierId: prov1.id, productId: cocola.id, supplierSku: "DISTR-COC-355", referenceCost: 8, currency: "MXN", leadDays: 2, isPreferred: true },
      update: { referenceCost: 8, isPreferred: true }
    });
  }

  console.log("Seed completado.");
  console.log("Usuarios de prueba (contraseña: Test#2026Seguro):");
  console.log("  - almacen@nexo.local (Almacenista)");
  console.log("  - compras@nexo.local (Comprador)");
  console.log("  - cajero@nexo.local (Cajero)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
