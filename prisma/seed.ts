import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL || "admin@nexo.local"
  ).toLowerCase();
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || "Admin#2026Seguro";
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
  await prisma.user.upsert({
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

  const [bebidas, higiene, snacks] = await Promise.all([
    prisma.category.upsert({
      where: { name: "Bebidas" },
      create: { name: "Bebidas" },
      update: { active: true }
    }),
    prisma.category.upsert({
      where: { name: "Higiene" },
      create: { name: "Higiene" },
      update: { active: true }
    }),
    prisma.category.upsert({
      where: { name: "Snacks" },
      create: { name: "Snacks" },
      update: { active: true }
    })
  ]);

  const products = [
    {
      sku: "BEB-AGUA-600",
      barcode: "7501000000010",
      name: "Agua natural 600 ml",
      categoryId: bebidas.id,
      cost: 7.25,
      salePrice: 14,
      currentStock: 84,
      minStock: 24,
      maxStock: 180
    },
    {
      sku: "BEB-ISO-500",
      barcode: "7501000000027",
      name: "Bebida isotónica 500 ml",
      categoryId: bebidas.id,
      cost: 15.5,
      salePrice: 29,
      currentStock: 16,
      minStock: 20,
      maxStock: 120
    },
    {
      sku: "SNK-BAR-045",
      barcode: "7501000000034",
      name: "Barra de proteína 45 g",
      categoryId: snacks.id,
      cost: 19,
      salePrice: 38,
      currentStock: 42,
      minStock: 15,
      maxStock: 90
    },
    {
      sku: "HIG-TOA-100",
      barcode: "7501000000041",
      name: "Toallas desinfectantes 100 pzas",
      categoryId: higiene.id,
      cost: 48,
      salePrice: 79,
      currentStock: 10,
      minStock: 12,
      maxStock: 48
    }
  ];
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: {
        ...product,
        unit: "PZA",
        taxRate: 16
      },
      update: {
        barcode: product.barcode,
        name: product.name,
        categoryId: product.categoryId,
        cost: product.cost,
        salePrice: product.salePrice,
        minStock: product.minStock,
        maxStock: product.maxStock,
        status: "ACTIVE"
      }
    });
  }

  await prisma.supplier.upsert({
    where: { code: "PROV-001" },
    create: {
      code: "PROV-001",
      legalName: "Distribuidora Demo del Norte, S.A. de C.V.",
      tradeName: "Distribuidora Norte",
      email: "compras@distribuidora.example",
      phone: "614 000 0000",
      contactName: "Contacto de compras",
      creditDays: 30,
      deliveryDays: 3,
      paymentTerms: "Crédito a 30 días"
    },
    update: { active: true }
  });
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
