import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as Stripe.LatestApiVersion,
  typescript: true
});

export function moneyToMinorUnits(amount: Prisma.Decimal, currency: string): number {
  if (currency.toLowerCase() !== "mxn") {
    throw new ApiError(400, "Sólo se admite MXN para procesar pagos con Stripe.");
  }
  
  if (amount.decimalPlaces() > 2) {
    throw new ApiError(400, "El importe contiene más de dos decimales.");
  }
  
  if (amount.isNegative()) {
    throw new ApiError(400, "El importe no puede ser negativo.");
  }

  // Multiplicación exacta con Decimal
  const minorUnits = amount.mul(100);
  
  if (!minorUnits.isInteger()) {
    throw new ApiError(400, "Error de precisión al calcular unidades menores.");
  }

  const result = minorUnits.toNumber();
  
  if (result > Number.MAX_SAFE_INTEGER) {
    throw new ApiError(400, "El importe supera el máximo permitido.");
  }

  return result;
}
