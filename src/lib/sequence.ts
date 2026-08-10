import type { Prisma } from "@prisma/client";

export async function nextFolio(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string
) {
  const sequence = await tx.documentSequence.upsert({
    where: { key },
    create: { key, prefix, nextValue: BigInt(2) },
    update: { nextValue: { increment: 1 } }
  });
  const value = sequence.nextValue - BigInt(1);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${value.toString().padStart(6, "0")}`;
}
