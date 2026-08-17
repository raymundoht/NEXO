import { describe, expect, it } from "vitest";
import { getPagination } from "@/lib/api";

describe("getPagination", () => {
  it("aplica valores por defecto y límite máximo", () => {
    expect(getPagination("http://localhost/api/items")).toEqual({
      page: 1,
      pageSize: 25,
      skip: 0,
      take: 25
    });
    expect(
      getPagination("http://localhost/api/items?page=2&pageSize=999", 100)
    ).toEqual({ page: 2, pageSize: 100, skip: 100, take: 100 });
  });

  it("rechaza NaN, fracciones y valores no positivos", () => {
    expect(() => getPagination("http://localhost/api/items?page=abc")).toThrow();
    expect(() => getPagination("http://localhost/api/items?page=1.5")).toThrow();
    expect(() => getPagination("http://localhost/api/items?pageSize=0")).toThrow();
  });
});
