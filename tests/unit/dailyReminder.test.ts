import { describe, it, expect } from "vitest";

import { getDueDailyReminder } from "../../src/utils/dailyReminder";

const TODAY = "2026-06-23";
const base = {
  todayKey: TODAY,
  reportSubmittedToday: false,
  morningSentDate: "",
  eveningSentDate: "",
};

function at(hour: number): Date {
  return new Date(2026, 5, 23, hour, 0, 0);
}

describe("getDueDailyReminder", () => {
  it("returns morning inside the morning window when not yet sent", () => {
    expect(getDueDailyReminder({ ...base, now: at(8) })).toBe("morning");
  });

  it("returns evening inside the evening window when not yet sent", () => {
    expect(getDueDailyReminder({ ...base, now: at(20) })).toBe("evening");
  });

  it("returns null outside both windows", () => {
    expect(getDueDailyReminder({ ...base, now: at(14) })).toBeNull();
    expect(getDueDailyReminder({ ...base, now: at(2) })).toBeNull();
  });

  it("never reminds once today's report is submitted", () => {
    expect(
      getDueDailyReminder({ ...base, now: at(8), reportSubmittedToday: true }),
    ).toBeNull();
    expect(
      getDueDailyReminder({ ...base, now: at(20), reportSubmittedToday: true }),
    ).toBeNull();
  });

  it("does not repeat the morning reminder once sent today", () => {
    expect(
      getDueDailyReminder({ ...base, now: at(9), morningSentDate: TODAY }),
    ).toBeNull();
  });

  it("still fires the evening reminder even if the morning one was sent", () => {
    expect(
      getDueDailyReminder({ ...base, now: at(20), morningSentDate: TODAY }),
    ).toBe("evening");
  });

  it("treats a stale sent-date (yesterday) as not-sent-today", () => {
    expect(
      getDueDailyReminder({ ...base, now: at(8), morningSentDate: "2026-06-22" }),
    ).toBe("morning");
  });

  it("respects custom windows", () => {
    expect(
      getDueDailyReminder({ ...base, now: at(6), morningWindow: [5, 7] }),
    ).toBe("morning");
    expect(
      getDueDailyReminder({ ...base, now: at(8), morningWindow: [5, 7] }),
    ).toBeNull();
  });

  it("excludes the end hour of the window (half-open interval)", () => {
    expect(getDueDailyReminder({ ...base, now: at(11) })).toBeNull();
    expect(getDueDailyReminder({ ...base, now: at(23) })).toBeNull();
  });
});
