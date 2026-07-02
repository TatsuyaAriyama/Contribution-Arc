/**
 * フォーカスセッション計測エンジン(Phase 1)。
 *
 * 外部依存ゼロの純関数群 + localStorage 永続化のみを持つ。React には
 * 触れない(hook 側は src/hooks/useFocusSession.ts)。「勉強を始める時に
 * アプリを開かせる」ためのコア動線 — 計測はタブキル・リロードでも失われ
 * ないよう、開始時刻を素直に永続化して経過は都度計算し直す。
 */

export type FocusTarget = {
  itemId: string;
  itemName: string;
  itemColor: string;
  category: "book" | "stack";
};

/** stopwatch = 従来の単純経過計測。pomodoro = 25分work/5分break の導出フェーズ。 */
export type FocusMode = "stopwatch" | "pomodoro";

export type FocusSession = {
  target: FocusTarget;
  mode: FocusMode;
  /** epoch ms */
  startedAt: number;
  /** 一時停止中なら epoch ms、計測中/未一時停止なら null */
  pausedAt: number | null;
  /** 一時停止の累計 ms */
  pausedTotalMs: number;
};

/** ポモドーロの work フェーズ長(ms)。 */
export const POMODORO_WORK_MS = 25 * 60_000;
/** ポモドーロの break フェーズ長(ms)。 */
export const POMODORO_BREAK_MS = 5 * 60_000;

const POMODORO_CYCLE_MS = POMODORO_WORK_MS + POMODORO_BREAK_MS;

export type PomodoroState = {
  phase: "work" | "break";
  /** 現在フェーズの残り ms */
  remainingMs: number;
  /** 現在何周目か (1 始まり) */
  round: number;
  /** 完了した work 周回数 */
  completedRounds: number;
};

const STORAGE_KEY = "ca:focus-session";

/** これを超えて古い開始時刻のセッションは信頼できないため復元しない。 */
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

// ===== 純ロジック =====

export function startSession(
  target: FocusTarget,
  now: number = Date.now(),
  mode: FocusMode = "stopwatch",
): FocusSession {
  return {
    target,
    mode,
    startedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
  };
}

export function pauseSession(session: FocusSession, now: number = Date.now()): FocusSession {
  if (session.pausedAt !== null) return session; // 既に一時停止中
  return { ...session, pausedAt: now };
}

export function resumeSession(session: FocusSession, now: number = Date.now()): FocusSession {
  if (session.pausedAt === null) return session; // 一時停止していない
  const pausedDuration = Math.max(0, now - session.pausedAt);
  return {
    ...session,
    pausedAt: null,
    pausedTotalMs: session.pausedTotalMs + pausedDuration,
  };
}

/** 経過 ms。一時停止中は pausedAt 時点で凍結する。負値は 0 に丸める。 */
export function getElapsedMs(session: FocusSession, now: number = Date.now()): number {
  const end = session.pausedAt ?? now;
  const raw = end - session.startedAt - session.pausedTotalMs;
  return Math.max(0, raw);
}

/** 経過分数(切り捨て)。最低 1 分への繰り上げは記録側(hook の end())の都合。 */
export function elapsedMinutes(session: FocusSession, now: number = Date.now()): number {
  return Math.floor(getElapsedMs(session, now) / 60000);
}

/**
 * ポモドーロのフェーズは保存しない「導出型」設計。実効経過時間
 * (getElapsedMs、pause 除外済み)を 30 分サイクル(work 25 分 + break
 * 5 分)にマップするだけの純関数なので、永続化・復元・一時停止のどの
 * タイミングで呼んでも壊れない。mode !== "pomodoro" のセッションには
 * 意味を持たないため null を返す。
 */
export function getPomodoroState(session: FocusSession, now: number = Date.now()): PomodoroState | null {
  if (session.mode !== "pomodoro") return null;

  const elapsed = getElapsedMs(session, now);
  const cyclesElapsed = Math.floor(elapsed / POMODORO_CYCLE_MS);
  const inCycle = elapsed % POMODORO_CYCLE_MS;
  const isWork = inCycle < POMODORO_WORK_MS;

  return {
    phase: isWork ? "work" : "break",
    remainingMs: isWork ? POMODORO_WORK_MS - inCycle : POMODORO_CYCLE_MS - inCycle,
    round: cyclesElapsed + 1,
    completedRounds: isWork ? cyclesElapsed : cyclesElapsed + 1,
  };
}

/**
 * 記録すべき「学習分数」。stopwatch は従来どおり全経過の floor。
 * pomodoro は work フェーズ分のみを積算する(break は学習時間に含めない):
 * 完了した work 周回(25分×completedRounds) + 現在 work フェーズ中なら
 * そのフェーズの経過分(floor)を足す。
 */
export function focusWorkMinutes(session: FocusSession, now: number = Date.now()): number {
  if (session.mode !== "pomodoro") {
    return elapsedMinutes(session, now);
  }

  const state = getPomodoroState(session, now);
  if (!state) return elapsedMinutes(session, now); // 到達しない防御(mode 不整合時のフォールバック)

  const workMinutesPerRound = POMODORO_WORK_MS / 60000;
  const completedMinutes = state.completedRounds * workMinutesPerRound;
  if (state.phase !== "work") return completedMinutes;

  const currentPhaseElapsedMs = POMODORO_WORK_MS - state.remainingMs;
  return completedMinutes + Math.floor(currentPhaseElapsedMs / 60000);
}

// ===== 永続化 =====

/** Safari private ブラウジング等で localStorage が例外を投げても握りつぶす。 */
function getStorage(): Storage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function isFocusCategory(value: unknown): value is FocusTarget["category"] {
  return value === "book" || value === "stack";
}

function isFocusTarget(value: unknown): value is FocusTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.itemId === "string" &&
    typeof candidate.itemName === "string" &&
    typeof candidate.itemColor === "string" &&
    isFocusCategory(candidate.category)
  );
}

function isFocusMode(value: unknown): value is FocusMode {
  return value === "stopwatch" || value === "pomodoro";
}

/**
 * mode は後方互換のため任意扱い(旧保存 JSON に無いケースを許す)。
 * ただし値が存在するのに不正なら偽を返し、呼び出し側で破棄させる。
 */
function isFocusSessionShape(value: unknown): value is Omit<FocusSession, "mode"> & { mode?: unknown } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    isFocusTarget(candidate.target) &&
    typeof candidate.startedAt === "number" &&
    Number.isFinite(candidate.startedAt) &&
    (candidate.pausedAt === null ||
      (typeof candidate.pausedAt === "number" && Number.isFinite(candidate.pausedAt))) &&
    typeof candidate.pausedTotalMs === "number" &&
    Number.isFinite(candidate.pausedTotalMs) &&
    (candidate.mode === undefined || isFocusMode(candidate.mode))
  );
}

export function saveFocusSession(session: FocusSession): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* 永続化できなくても計測自体は継続させる(best-effort) */
  }
}

/**
 * 復元して返す。次のケースは信頼できないため null を返し、キーを削除する:
 *  - 保存されていない
 *  - JSON が壊れている / 型が一致しない
 *  - 開始から 24 時間を超えている(タブを開きっぱなしで数日放置 等)
 */
export function loadFocusSession(now: number = Date.now()): FocusSession | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFocusSessionShape(parsed)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    const session: FocusSession = {
      ...parsed,
      mode: (parsed.mode as FocusMode | undefined) ?? "stopwatch",
    };
    if (now - session.startedAt > MAX_SESSION_AGE_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    // JSON.parse 失敗 or storage アクセス例外。壊れた値を掃除しておく。
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function clearFocusSession(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
