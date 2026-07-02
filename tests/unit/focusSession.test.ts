// ユニットテスト: src/services/focusSession.ts（外部依存ゼロの計測エンジン）。
// 開始/一時停止/再開の時間計算、localStorage 永続化(round-trip)、
// 壊れた値・24h 超セッションの破棄を回帰防止する。
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFocusSession,
  elapsedMinutes,
  focusWorkMinutes,
  getElapsedMs,
  getPomodoroState,
  loadFocusSession,
  pauseSession,
  resumeSession,
  saveFocusSession,
  startSession,
  type FocusTarget,
} from "../../src/services/focusSession";

// vitest.config.ts は environment: "node" なので localStorage が無い。
// Safari private 相当ではなく "そもそも存在しない" ケースを模した最小モック。
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage();
});

const target: FocusTarget = {
  itemId: "item-1",
  itemName: "TypeScript 入門",
  itemColor: "#1f6f4a",
  category: "book",
};

describe("startSession", () => {
  it("開始直後は経過 0、pausedAt は null", () => {
    const now = 1_000_000;
    const session = startSession(target, now);
    expect(session.startedAt).toBe(now);
    expect(session.pausedAt).toBeNull();
    expect(session.pausedTotalMs).toBe(0);
    expect(getElapsedMs(session, now)).toBe(0);
  });
});

describe("start → pause → resume → elapsed の時間計算", () => {
  it("一時停止中は経過が凍結され、再開後は停止時間を差し引いて再開する", () => {
    const started = 1_000_000;
    let session = startSession(target, started);

    // 30 秒経過してから一時停止
    session = pauseSession(session, started + 30_000);
    expect(getElapsedMs(session, started + 999_999)).toBe(30_000); // 停止中は now を無視して凍結

    // 5 分後に再開(この間はカウントしない)
    session = resumeSession(session, started + 30_000 + 5 * 60_000);
    expect(session.pausedTotalMs).toBe(5 * 60_000);

    // 再開から 10 秒後
    const elapsed = getElapsedMs(session, started + 30_000 + 5 * 60_000 + 10_000);
    expect(elapsed).toBe(40_000); // 30s + 10s (一時停止の 5 分は含まない)
  });

  it("pauseSession は既に一時停止中なら何もしない(冪等)", () => {
    const started = 0;
    let session = startSession(target, started);
    session = pauseSession(session, 10_000);
    const again = pauseSession(session, 99_999);
    expect(again).toBe(session);
  });

  it("resumeSession は一時停止していなければ何もしない(冪等)", () => {
    const session = startSession(target, 0);
    const again = resumeSession(session, 5_000);
    expect(again).toBe(session);
  });
});

describe("getElapsedMs の負値クランプ", () => {
  it("now が startedAt より前でも 0 未満にはならない", () => {
    const session = startSession(target, 10_000);
    expect(getElapsedMs(session, 0)).toBe(0);
  });
});

describe("elapsedMinutes", () => {
  it("切り捨てで分を返す", () => {
    const session = startSession(target, 0);
    expect(elapsedMinutes(session, 59_000)).toBe(0);
    expect(elapsedMinutes(session, 60_000)).toBe(1);
    expect(elapsedMinutes(session, 119_000)).toBe(1);
    expect(elapsedMinutes(session, 120_000)).toBe(2);
  });
});

describe("localStorage round-trip", () => {
  it("save したセッションを load でそのまま復元できる", () => {
    const session = startSession(target, 1_700_000_000_000);
    saveFocusSession(session);
    const restored = loadFocusSession(1_700_000_000_000 + 60_000);
    expect(restored).toEqual(session);
  });

  it("clearFocusSession 後は load が null を返す", () => {
    const session = startSession(target, Date.now());
    saveFocusSession(session);
    clearFocusSession();
    expect(loadFocusSession()).toBeNull();
  });
});

describe("loadFocusSession の破棄条件", () => {
  it("壊れた JSON は null を返しキーを削除する", () => {
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    storage.setItem("ca:focus-session", "{not-json");
    expect(loadFocusSession()).toBeNull();
    expect(storage.getItem("ca:focus-session")).toBeNull();
  });

  it("型が一致しない値は null を返す", () => {
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    storage.setItem("ca:focus-session", JSON.stringify({ foo: "bar" }));
    expect(loadFocusSession()).toBeNull();
  });

  it("開始から 24 時間を超えたセッションは復元しない", () => {
    const started = 1_700_000_000_000;
    const session = startSession(target, started);
    saveFocusSession(session);

    const justUnder = started + 24 * 60 * 60 * 1000 - 1;
    expect(loadFocusSession(justUnder)).toEqual(session);

    // 24h ちょうどを超えたタイミングでは破棄される点を別セッションで確認
    saveFocusSession(session);
    const over = started + 24 * 60 * 60 * 1000 + 1;
    expect(loadFocusSession(over)).toBeNull();
  });

  it("mode が無い旧保存 JSON は stopwatch として復元する(後方互換)", () => {
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    const legacy = {
      target,
      startedAt: 1_700_000_000_000,
      pausedAt: null,
      pausedTotalMs: 0,
      // mode フィールドなし
    };
    storage.setItem("ca:focus-session", JSON.stringify(legacy));
    const restored = loadFocusSession(1_700_000_000_000 + 1_000);
    expect(restored).not.toBeNull();
    expect(restored?.mode).toBe("stopwatch");
  });

  it("mode が不正値なら破棄する(null を返す)", () => {
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    const invalid = {
      target,
      mode: "daily", // FocusMode ではない不正値
      startedAt: 1_700_000_000_000,
      pausedAt: null,
      pausedTotalMs: 0,
    };
    storage.setItem("ca:focus-session", JSON.stringify(invalid));
    expect(loadFocusSession(1_700_000_000_000 + 1_000)).toBeNull();
    expect(storage.getItem("ca:focus-session")).toBeNull();
  });
});

describe("getPomodoroState", () => {
  it("mode が stopwatch なら null", () => {
    const session = startSession(target, 0, "stopwatch");
    expect(getPomodoroState(session, 10_000)).toBeNull();
  });

  it("開始直後は work フェーズ・round 1・残り25分", () => {
    const started = 0;
    const session = startSession(target, started, "pomodoro");
    const state = getPomodoroState(session, started);
    expect(state).toEqual({
      phase: "work",
      remainingMs: 25 * 60_000,
      round: 1,
      completedRounds: 0,
    });
  });

  it("26分経過で break フェーズ・残り4分(work 25分の周回は完了扱い)", () => {
    const started = 0;
    const session = startSession(target, started, "pomodoro");
    const state = getPomodoroState(session, started + 26 * 60_000);
    expect(state).toEqual({
      phase: "break",
      remainingMs: 4 * 60_000,
      round: 1,
      completedRounds: 1,
    });
  });

  it("31分経過で2周目の work に入り、completedRounds は1", () => {
    const started = 0;
    const session = startSession(target, started, "pomodoro");
    const state = getPomodoroState(session, started + 31 * 60_000);
    expect(state).toEqual({
      phase: "work",
      remainingMs: 24 * 60_000,
      round: 2,
      completedRounds: 1,
    });
  });

  it("一時停止を挟んでも、実効経過(pause 除外)でフェーズが決まる", () => {
    const started = 0;
    let session = startSession(target, started, "pomodoro");
    // 20分経過してから1時間一時停止(この間はフェーズ判定に影響しない)
    session = pauseSession(session, started + 20 * 60_000);
    const frozen = getPomodoroState(session, started + 999 * 60_000);
    expect(frozen).toEqual({
      phase: "work",
      remainingMs: 5 * 60_000,
      round: 1,
      completedRounds: 0,
    });

    // 再開してさらに8分(実効経過 = 20分 + 8分 = 28分 → break に入っている)
    session = resumeSession(session, started + 999 * 60_000);
    const afterResume = getPomodoroState(session, started + 999 * 60_000 + 8 * 60_000);
    expect(afterResume).toEqual({
      phase: "break",
      remainingMs: 2 * 60_000,
      round: 1,
      completedRounds: 1,
    });
  });
});

describe("focusWorkMinutes", () => {
  it("stopwatch は elapsedMinutes と同じ(従来通り)", () => {
    const session = startSession(target, 0, "stopwatch");
    expect(focusWorkMinutes(session, 119_000)).toBe(elapsedMinutes(session, 119_000));
    expect(focusWorkMinutes(session, 119_000)).toBe(1);
  });

  it("pomodoro で 26分経過 → break 中なので work 分は 25 のまま増えない", () => {
    const session = startSession(target, 0, "pomodoro");
    expect(focusWorkMinutes(session, 26 * 60_000)).toBe(25);
  });

  it("pomodoro で 31分経過(2周目 work 1分) → 25 + 1 = 26", () => {
    const session = startSession(target, 0, "pomodoro");
    expect(focusWorkMinutes(session, 31 * 60_000)).toBe(26);
  });

  it("pomodoro の break 中は学習分に加算されない", () => {
    const session = startSession(target, 0, "pomodoro");
    // 29分経過(break の1分前ではなくbreak内: 25-30分がbreak)
    expect(focusWorkMinutes(session, 29 * 60_000)).toBe(25);
  });
});
