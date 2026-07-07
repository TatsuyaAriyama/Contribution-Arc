import { describe, it, expect } from "vitest";

import {
  getDueReviews,
  REVIEW_INTERVALS_DAYS,
  type ReviewItemInput,
  type ReviewLogInput,
} from "../../src/utils/reviewSchedule";

// ローカル日付で日付を作るヘルパー (テスト環境の TZ に依存しない)。
function day(year: number, month: number, date: number, hour = 12): Date {
  return new Date(year, month - 1, date, hour, 0, 0);
}

function iso(year: number, month: number, date: number, hour = 12): string {
  return day(year, month, date, hour).toISOString();
}

function item(id: string, extra: Partial<ReviewItemInput> = {}): ReviewItemInput {
  return { id, archived: false, status: "active", ...extra };
}

describe("getDueReviews", () => {
  it("学習記録が 1 件もない対象は復習候補に出さない", () => {
    const items = [item("a")];
    expect(getDueReviews(items, [], day(2026, 7, 7))).toEqual([]);
  });

  it("初回学習の翌日に復習どきになる (interval 1 日)", () => {
    const items = [item("a")];
    const logs: ReviewLogInput[] = [{ learningItemId: "a", createdAt: iso(2026, 7, 6) }];
    // 学習当日はまだ復習どきではない
    expect(getDueReviews(items, logs, day(2026, 7, 6, 23))).toEqual([]);
    // 翌日になったら復習どき
    const due = getDueReviews(items, logs, day(2026, 7, 7));
    expect(due).toHaveLength(1);
    expect(due[0].item.id).toBe("a");
    expect(due[0].repetitions).toBe(1);
    expect(due[0].intervalDays).toBe(1);
    expect(due[0].overdueDays).toBe(0);
  });

  it("同じ日に複数回記録しても反復回数は 1 と数える", () => {
    const items = [item("a")];
    const logs: ReviewLogInput[] = [
      { learningItemId: "a", createdAt: iso(2026, 7, 6, 9) },
      { learningItemId: "a", createdAt: iso(2026, 7, 6, 21) },
    ];
    const due = getDueReviews(items, logs, day(2026, 7, 7));
    expect(due[0].repetitions).toBe(1);
    expect(due[0].intervalDays).toBe(1);
  });

  it("別々の日に学習するほど次の間隔が伸びる (1→3→7)", () => {
    const items = [item("a")];
    // 3 日 (別日) 学習 → 3 回目なので interval は 7 日
    const logs: ReviewLogInput[] = [
      { learningItemId: "a", createdAt: iso(2026, 7, 1) },
      { learningItemId: "a", createdAt: iso(2026, 7, 2) },
      { learningItemId: "a", createdAt: iso(2026, 7, 3) },
    ];
    // 最終学習 7/3 + 7 日 = 7/10 が予定日。7/9 はまだ早い
    expect(getDueReviews(items, logs, day(2026, 7, 9))).toEqual([]);
    const due = getDueReviews(items, logs, day(2026, 7, 10));
    expect(due).toHaveLength(1);
    expect(due[0].repetitions).toBe(3);
    expect(due[0].intervalDays).toBe(7);
  });

  it("反復回数が間隔テーブルを超えても末尾 (60 日) で頭打ちになる", () => {
    const items = [item("a")];
    const logs: ReviewLogInput[] = [];
    for (let d = 1; d <= 10; d++) {
      logs.push({ learningItemId: "a", createdAt: iso(2026, 1, d) });
    }
    const due = getDueReviews(items, logs, day(2026, 12, 31));
    expect(due[0].repetitions).toBe(10);
    expect(due[0].intervalDays).toBe(REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1]);
  });

  it("archived / done / paused の対象は復習を促さない", () => {
    const logs: ReviewLogInput[] = [
      { learningItemId: "a", createdAt: iso(2026, 7, 1) },
      { learningItemId: "b", createdAt: iso(2026, 7, 1) },
      { learningItemId: "c", createdAt: iso(2026, 7, 1) },
    ];
    const items = [
      item("a", { archived: true }),
      item("b", { status: "done" }),
      item("c", { status: "paused" }),
    ];
    expect(getDueReviews(items, logs, day(2026, 7, 7))).toEqual([]);
  });

  it("超過日数が大きい対象ほど先に並ぶ", () => {
    const items = [item("recent"), item("stale")];
    const logs: ReviewLogInput[] = [
      { learningItemId: "recent", createdAt: iso(2026, 7, 5) },
      { learningItemId: "stale", createdAt: iso(2026, 6, 1) },
    ];
    const due = getDueReviews(items, logs, day(2026, 7, 7));
    expect(due.map((d) => d.item.id)).toEqual(["stale", "recent"]);
    expect(due[0].overdueDays).toBeGreaterThan(due[1].overdueDays);
  });

  it("learningItemId のないログは無視する", () => {
    const items = [item("a")];
    const logs: ReviewLogInput[] = [{ createdAt: iso(2026, 7, 1) }];
    expect(getDueReviews(items, logs, day(2026, 7, 7))).toEqual([]);
  });
});
