import { describe, it, expect } from "vitest";

import { resolveCoins, resolveOwnedShapes } from "../../src/utils/characterProgress";

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

describe("resolveOwnedShapes", () => {
  it("keeps a just-equipped shape owned when the local choice is newer than cloud", () => {
    // robo を購入/着用直後にリロード: cloud のデバウンス書き込みが未着地で
    // cloudOwned はまだ ["default"]。preferLocal=true なのでローカル所有
    // キャッシュを信用し、robo が所有集合から漏れない (装着が default に
    // 巻き戻らない)。
    expect(
      resolveOwnedShapes({
        cloudOwned: ["default"],
        localOwned: ["default", "robo"],
        preferLocal: true,
        defaultShape: "default",
      }),
    ).toEqual(["default", "robo"]);
  });

  it("ignores the local cache when cloud is newer (tamper-resistant)", () => {
    // ローカル選択が古い (= cloud が source of truth)。localStorage を
    // 改ざんして robo を足しても、cloud が所有していなければ解放しない。
    expect(
      resolveOwnedShapes({
        cloudOwned: ["default"],
        localOwned: ["default", "robo"],
        preferLocal: false,
        defaultShape: "default",
      }),
    ).toEqual(["default"]);
  });

  it("merges cloud purchases from another device regardless of preferLocal", () => {
    expect(
      resolveOwnedShapes({
        cloudOwned: ["default", "owl"],
        localOwned: ["default"],
        preferLocal: false,
        defaultShape: "default",
      }),
    ).toEqual(["default", "owl"]);
  });

  it("always includes the default shape and dedupes", () => {
    expect(
      resolveOwnedShapes({
        cloudOwned: ["ghost", "ghost"],
        localOwned: ["ghost"],
        preferLocal: true,
        defaultShape: "default",
      }),
    ).toEqual(["default", "ghost"]);
  });
});
