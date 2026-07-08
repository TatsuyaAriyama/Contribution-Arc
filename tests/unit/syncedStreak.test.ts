// ユニットテスト: src/utils/syncedStreak.ts(外部依存ゼロの純関数)。
// 学習ログ × GitHub コミットの「連動ストリーク」計算の境界ケースを回帰防止する。
import { describe, expect, it } from "vitest";
import { computeSyncedStreak } from "../../src/utils/syncedStreak";

describe("computeSyncedStreak", () => {
  it("空の window は全て 0", () => {
    const result = computeSyncedStreak([], new Set(), new Set());
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, totalSyncedDays: 0 });
  });

  it("両方の Set が空なら window があっても全て 0", () => {
    const window = ["2026-06-30", "2026-07-01", "2026-07-02"];
    const result = computeSyncedStreak(window, new Set(), new Set());
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, totalSyncedDays: 0 });
  });

  it("全日連動: currentStreak = longestStreak = totalSyncedDays = window長", () => {
    const window = ["2026-06-30", "2026-07-01", "2026-07-02"];
    const github = new Set(window);
    const study = new Set(window);
    const result = computeSyncedStreak(window, github, study);
    expect(result).toEqual({ currentStreak: 3, longestStreak: 3, totalSyncedDays: 3 });
  });

  it("連動なし(github/study どちらも空でないが重ならない): 全て 0", () => {
    const window = ["2026-06-30", "2026-07-01", "2026-07-02"];
    const github = new Set(["2026-06-30", "2026-07-01"]);
    const study = new Set(["2026-07-02"]);
    const result = computeSyncedStreak(window, github, study);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, totalSyncedDays: 0 });
  });

  it("末尾(今日)が非アクティブ: currentStreak=0 だが longestStreak は過去の連続区間を反映", () => {
    const window = ["2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
    const synced = new Set(["2026-06-29", "2026-06-30", "2026-07-01"]); // 末尾の 07-02 は非連動
    const result = computeSyncedStreak(window, synced, synced);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 3, totalSyncedDays: 3 });
  });

  it("間欠的な連動: 末尾から連続する区間だけが currentStreak になる", () => {
    const window = ["2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
    // 06-28 が単独で連動、06-30〜07-02 が連続で連動
    const synced = new Set(["2026-06-28", "2026-06-30", "2026-07-01", "2026-07-02"]);
    const result = computeSyncedStreak(window, synced, synced);
    expect(result).toEqual({ currentStreak: 3, longestStreak: 3, totalSyncedDays: 4 });
  });

  it("window 先頭のみ連動: currentStreak には影響しない", () => {
    const window = ["2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
    const synced = new Set(["2026-06-28"]);
    const result = computeSyncedStreak(window, synced, synced);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 1, totalSyncedDays: 1 });
  });

  it("1日だけの window: 連動していれば全て 1", () => {
    const window = ["2026-07-02"];
    const synced = new Set(["2026-07-02"]);
    const result = computeSyncedStreak(window, synced, synced);
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, totalSyncedDays: 1 });
  });

  it("1日だけの window: 非連動なら全て 0", () => {
    const window = ["2026-07-02"];
    const result = computeSyncedStreak(window, new Set(["2026-07-02"]), new Set());
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, totalSyncedDays: 0 });
  });

  it("github は連動しているが study が無い日は非連動扱い(両方必須)", () => {
    const window = ["2026-07-01", "2026-07-02"];
    const github = new Set(["2026-07-01", "2026-07-02"]);
    const study = new Set(["2026-07-01"]);
    const result = computeSyncedStreak(window, github, study);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 1, totalSyncedDays: 1 });
  });

  it("longestStreak が window 途中にあり currentStreak より長いケース", () => {
    const window = ["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
    // 中盤に4連続、末尾は1日だけ連動
    const synced = new Set(["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-02"]);
    const result = computeSyncedStreak(window, synced, synced);
    expect(result).toEqual({ currentStreak: 1, longestStreak: 4, totalSyncedDays: 5 });
  });
});
