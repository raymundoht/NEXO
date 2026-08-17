import { z } from "zod";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/security";

export const uuid = z.string().uuid();
export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);
const hasAtMostThreeDecimals = (value: number) =>
  Number.isFinite(value) &&
  Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7;

export const positiveQuantity = z.coerce
  .number()
  .positive()
  .max(1_000_000)
  .refine(hasAtMostThreeDecimals, "La cantidad admite hasta tres decimales.");
export const nonNegativeQuantity = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .refine(hasAtMostThreeDecimals, "La cantidad admite hasta tres decimales.");
export const nonNegativeMoney = z.coerce.number().min(0).max(1_000_000_000);
export const cardAuthorization = z
  .string()
  .trim()
  .min(4)
  .max(40)
  .regex(
    /^[A-Za-z0-9-]+$/,
    "La autorización sólo puede contener letras, números y guiones."
  )
  .refine(
    (value) => !/^\d{13,19}$/.test(value),
    "Captura el código de autorización, no el número de tarjeta."
  );

export const strongPassword = z
  .string()
  .max(128)
  .refine(isStrongPassword, PASSWORD_POLICY_MESSAGE);

export const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "El rango de fechas es inválido."
  );
