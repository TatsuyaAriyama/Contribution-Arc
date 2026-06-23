import { describe, it, expect } from "vitest";

import { resolveCoins } from "../../src/utils/characterProgress";

describe("resolveCoins", () => {
  it("keeps the local balance when it is newer (just-spent coins survive a reload)", () => {
    expect(
      resolveCoins({ localCoins: 29000, localStamp: 200, cloudCoins: 30000, cloudStamp: 100 }),
    ).toBe(29000);
  });

  it("adopts the cloud balance when cloud is newer (another device topped up)", () => {
    expect(
      resolveCoins({ localCoins: 29000, localStamp: 100, cloudCoins: 31000, cloudStamp: 200 }),
    ).toBe(31000);
  });

  it("prefers cloud on a stamp tie so concurrent writes converge deterministically", () => {
    expect(
      resolveCoins({ localCoins: 29000, localStamp: 100, cloudCoins: 30000, cloudStamp: 100 }),
    ).toBe(30000);
  });

  it("falls back to cloud when there is no cached local value", () => {
    expect(
      resolveCoins({ localCoins: null, localStamp: 999, cloudCoins: 500, cloudStamp: 0 }),
    ).toBe(500);
  });

  it("ignores a non-finite cached value", () => {
    expect(
      resolveCoins({ localCoins: Number.NaN, localStamp: 999, cloudCoins: 500, cloudStamp: 0 }),
    ).toBe(500);
  });

  it("does not let a stale cloud snapshot undo a purchase (no free unlock)", () => {
    // ghost を 1000 Arc で購入: ローカル 1000 -> 0、cloud はまだ購入前の 1000。
    // ローカルの方が新しいので 0 を維持し、無料解放を防ぐ。
    expect(
      resolveCoins({ localCoins: 0, localStamp: 5, cloudCoins: 1000, cloudStamp: 1 }),
    ).toBe(0);
  });
});
