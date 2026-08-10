import { describe, expect, it } from "vitest";
import {
  denominationTotal,
  emptyDenominationCounts,
  supportsCashDenominations
} from "@/lib/cash-denominations";

describe("cash denominations", () => {
  it("calculates the counted cash total", () => {
    expect(
      denominationTotal({
        "1000": 1,
        "500": 2,
        "20": 3,
        "0.5": 4
      })
    ).toBe(2062);
  });

  it("creates a complete zero count for supported currencies", () => {
    const counts = emptyDenominationCounts("MXN");
    expect(Object.keys(counts).length).toBeGreaterThan(5);
    expect(denominationTotal(counts)).toBe(0);
  });

  it("rejects currencies without a configured cash denomination set", () => {
    expect(supportsCashDenominations("MXN")).toBe(true);
    expect(supportsCashDenominations("EUR")).toBe(false);
  });
});
