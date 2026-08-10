export const CASH_DENOMINATIONS: Record<string, number[]> = {
  MXN: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5],
  USD: [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01]
};

export type DenominationCounts = Record<string, number>;

export function denominationsFor(currency: string) {
  return CASH_DENOMINATIONS[currency] || CASH_DENOMINATIONS.MXN;
}

export function supportsCashDenominations(currency: string) {
  return Boolean(CASH_DENOMINATIONS[currency]);
}

export function emptyDenominationCounts(currency: string) {
  return Object.fromEntries(
    denominationsFor(currency).map((denomination) => [String(denomination), 0])
  );
}

export function denominationTotal(counts: DenominationCounts) {
  return Math.round(
    Object.entries(counts).reduce(
      (total, [value, count]) => total + Number(value) * Number(count || 0),
      0
    ) * 100
  ) / 100;
}
