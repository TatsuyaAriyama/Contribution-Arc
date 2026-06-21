// ユニットテスト: src/utils/format.ts（外部依存ゼロの純関数）。
// テスト土台が動くことの担保 + 日付/時間フォーマットの境界回帰防止。
import { describe, expect, it } from "vitest";
import {
  clampNumber,
  getDateInputValue,
  getLearnerDate,
  getWeekStart,
  getCurrentWeekKey,
  formatStudyTimeJa,
  formatStayTime,
} from "../../src/utils/format";

describe("clampNumber", () => {
  it("範囲内はそのまま、範囲外はクランプ", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-3, 0, 10)).toBe(0);
    expect(clampNumber(99, 0, 10)).toBe(10);
  });
});

describe("getDateInputValue", () => {
  it("YYYY-MM-DD でゼロ埋めする", () => {
    expect(getDateInputValue(new Date(2026, 0, 3))).toBe("2026-01-03");
    expect(getDateInputValue(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});

describe("getLearnerDate (6時カットオフ)", () => {
  it("午前2時はまだ前日扱い", () => {
    // 2026-05-24 02:00 ローカル → 6h 引いて 2026-05-23
    expect(getLearnerDate(new Date(2026, 4, 24, 2, 0))).toBe("2026-05-23");
  });
  it("午前7時は当日扱い", () => {
    expect(getLearnerDate(new Date(2026, 4, 24, 7, 0))).toBe("2026-05-24");
  });
});

describe("getWeekStart (月曜始まり)", () => {
  it("日曜は前週の月曜に戻る", () => {
    // 2026-06-21 は日曜 → 月曜 2026-06-15
    expect(getWeekStart(new Date(2026, 5, 21)).getDate()).toBe(15);
  });
  it("月曜はその日が週頭", () => {
    expect(getWeekStart(new Date(2026, 5, 15)).getDate()).toBe(15);
  });
});

describe("getCurrentWeekKey (日曜始まり)", () => {
  it("週内の異なる曜日でも同じキーになる", () => {
    const sun = getCurrentWeekKey(new Date(2026, 5, 21)); // 日曜
    const wed = getCurrentWeekKey(new Date(2026, 5, 24)); // 水曜
    expect(sun).toBe(wed);
    expect(sun).toBe("2026-5-21");
  });
});

describe("formatStudyTimeJa", () => {
  it("60分未満は分、以上は時間（小数1桁）", () => {
    expect(formatStudyTimeJa(45)).toBe("45分");
    expect(formatStudyTimeJa(90)).toBe("1.5時間");
    expect(formatStudyTimeJa(30, "en")).toBe("30 min");
    expect(formatStudyTimeJa(90, "en")).toBe("1.5 h");
  });
});

describe("formatStayTime", () => {
  it("時間と分を分解", () => {
    expect(formatStayTime(59)).toBe("59分");
    expect(formatStayTime(60)).toBe("1時間");
    expect(formatStayTime(125)).toBe("2時間5分");
    expect(formatStayTime(125, "en")).toBe("2h 5m");
  });
});
