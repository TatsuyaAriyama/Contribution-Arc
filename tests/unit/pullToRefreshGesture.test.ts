// ユニットテスト: Pull-to-Refresh のジェスチャ判定（純粋ロジック）。
// 「フィードを上にスクロールしている途中（最上端ではない）なのに更新が
// 走る」という長年の誤発火を回帰として固定する。
import { describe, expect, it } from "vitest";
import {
  canArmAtTop,
  computePull,
  findScrollableAncestor,
  type ScrollableNode,
} from "../../src/components/pullToRefreshGesture";

// テスト用の最小 DOM ノード。実 DOM の scrollTop / overflow / 親子関係だけ持つ。
type FakeEl = ScrollableNode & {
  name: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  overflowY: "visible" | "auto" | "scroll" | "hidden";
  parentElement: FakeEl | null;
};

function el(partial: Partial<FakeEl> & { name: string }): FakeEl {
  return {
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 100,
    overflowY: "visible",
    parentElement: null,
    ...partial,
  };
}

// 実コンポーネントと同じ判定（overflow-y auto/scroll かつ中身があふれている）。
const isScrollable = (e: FakeEl) =>
  (e.overflowY === "auto" || e.overflowY === "scroll") && e.scrollHeight > e.clientHeight + 1;

describe("findScrollableAncestor", () => {
  it("指の下から辿って overflow-y:auto かつあふれている祖先を返す", () => {
    const body = el({ name: "body" });
    // .feed-view-content 相当: 縦スクロール可能なコンテナ
    const feed = el({
      name: "feed-view-content",
      overflowY: "auto",
      scrollHeight: 2000,
      clientHeight: 600,
      scrollTop: 200,
      parentElement: body,
    });
    const ptr = el({ name: "pull-to-refresh", parentElement: feed });
    const post = el({ name: "post", parentElement: ptr });

    const found = findScrollableAncestor<FakeEl>(post, isScrollable, (e) => e === body);
    expect(found?.name).toBe("feed-view-content");
  });

  it("スクロール可能な祖先が無ければ null", () => {
    const body = el({ name: "body" });
    const wrap = el({ name: "wrap", parentElement: body });
    const child = el({ name: "child", parentElement: wrap });
    expect(findScrollableAncestor<FakeEl>(child, isScrollable, (e) => e === body)).toBeNull();
  });
});

describe("canArmAtTop（誤発火の核心）", () => {
  it("フィード途中 (scrollTop>0) では絶対に起動しない", () => {
    // これがバグの本体: 旧実装は window.scrollY=0 を読んでしまい true に
    // なっていた。実コンテナの scrollTop を読めば false になる。
    expect(canArmAtTop(200)).toBe(false);
    expect(canArmAtTop(1)).toBe(false);
  });

  it("最上端 (scrollTop<=0) では起動を許可", () => {
    expect(canArmAtTop(0)).toBe(true);
    expect(canArmAtTop(-3)).toBe(true); // iOS rubber-band の負値も最上端扱い
  });

  it("スクロールするものが無い (null) なら最上端扱いで許可", () => {
    expect(canArmAtTop(null)).toBe(true);
  });
});

describe("ジェスチャ全体（解決→起動可否）の結線", () => {
  function buildTree(feedScrollTop: number) {
    const body = el({ name: "body" });
    const feed = el({
      name: "feed-view-content",
      overflowY: "auto",
      scrollHeight: 2000,
      clientHeight: 600,
      scrollTop: feedScrollTop,
      parentElement: body,
    });
    const ptr = el({ name: "pull-to-refresh", parentElement: feed });
    const post = el({ name: "post", parentElement: ptr });
    return { body, post };
  }

  it("フィード途中で指を下げても起動しない", () => {
    const { body, post } = buildTree(200);
    const scroller = findScrollableAncestor<FakeEl>(post, isScrollable, (e) => e === body);
    expect(canArmAtTop(scroller ? scroller.scrollTop : null)).toBe(false);
  });

  it("最上端なら起動する", () => {
    const { body, post } = buildTree(0);
    const scroller = findScrollableAncestor<FakeEl>(post, isScrollable, (e) => e === body);
    expect(canArmAtTop(scroller ? scroller.scrollTop : null)).toBe(true);
  });
});

describe("computePull", () => {
  it("ARM_DISTANCE 以下の僅かな引きは 0（インジケータを出さない）", () => {
    expect(computePull(0, 18, 0.28, 200)).toBe(0);
    expect(computePull(18, 18, 0.28, 200)).toBe(0);
    expect(computePull(-50, 18, 0.28, 200)).toBe(0); // 上方向は無視
  });

  it("ARM_DISTANCE を超えた分だけ resistance で減衰", () => {
    expect(computePull(118, 18, 0.28, 200)).toBeCloseTo(28, 5); // (118-18)*0.28
  });

  it("MAX_PULL でクランプ", () => {
    expect(computePull(100000, 18, 0.28, 200)).toBe(200);
  });
});
