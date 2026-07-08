import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearFocusSession,
  focusWorkMinutes,
  getElapsedMs,
  getPomodoroState,
  loadFocusSession,
  pauseSession,
  resumeSession,
  saveFocusSession,
  startSession,
  type FocusMode,
  type FocusSession,
  type FocusTarget,
  type PomodoroState,
} from "../services/focusSession";

export type UseFocusSessionResult = {
  session: FocusSession | null;
  /** 計測中は 1 秒毎に更新。一時停止中は tick を止め凍結する。 */
  elapsedMs: number;
  isPaused: boolean;
  /** mode !== "pomodoro" のセッションでは null。1 秒 tick と同期して更新。 */
  pomodoro: PomodoroState | null;
  start: (target: FocusTarget, mode?: FocusMode) => void;
  pause: () => void;
  resume: () => void;
  /** 記録すべき学習分数(focusWorkMinutes)を返してセッションを clear する。0 分なら 1 分に繰り上げる。 */
  end: () => number | null;
  discard: () => void;
};

/**
 * フォーカスセッションの状態管理 + 1 秒 tick + localStorage 永続化。
 *
 * マウント時に loadFocusSession() で復元するので、リロードやタブキル
 * 後も計測が続いている体験になる。visibilitychange で復帰した瞬間に
 * 即時再計算するので、バックグラウンドで setInterval が止まるモバイル
 * でも経過時間の表示が飛ばない。
 */
export function useFocusSession(): UseFocusSessionResult {
  const [session, setSession] = useState<FocusSession | null>(() => loadFocusSession());
  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    const restored = loadFocusSession();
    return restored ? getElapsedMs(restored) : 0;
  });
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(() => {
    const restored = loadFocusSession();
    return restored ? getPomodoroState(restored) : null;
  });

  // 最新の session を effect / callback から同期的に読むための ref。
  // (setState の非同期性に依存せず、end()/discard() が呼ばれた瞬間の
  // 値を確実に使うため。render 中に ref を書き換えないよう effect で同期する。)
  const sessionRef = useRef<FocusSession | null>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // 計測中(pausedAt === null)の間だけ 1 秒毎に経過時間を更新する。
  useEffect(() => {
    if (!session || session.pausedAt !== null) return;

    const tick = () => {
      const current = sessionRef.current;
      if (!current) return;
      const now = Date.now();
      setElapsedMs(getElapsedMs(current, now));
      setPomodoro(getPomodoroState(current, now));
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [session]);

  // バックグラウンドから復帰した瞬間に再計算(モバイルは背面で setInterval
  // が止まるため、表示が古いまま固まるのを防ぐ)。
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const current = sessionRef.current;
      if (!current) return;
      const now = Date.now();
      setElapsedMs(getElapsedMs(current, now));
      setPomodoro(getPomodoroState(current, now));
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const start = useCallback((target: FocusTarget, mode: FocusMode = "stopwatch") => {
    const next = startSession(target, Date.now(), mode);
    saveFocusSession(next);
    setSession(next);
    setElapsedMs(0);
    setPomodoro(getPomodoroState(next));
  }, []);

  const pause = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.pausedAt !== null) return;
    const next = pauseSession(current);
    saveFocusSession(next);
    setSession(next);
    setElapsedMs(getElapsedMs(next));
    setPomodoro(getPomodoroState(next));
  }, []);

  const resume = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.pausedAt === null) return;
    const next = resumeSession(current);
    saveFocusSession(next);
    setSession(next);
    setElapsedMs(getElapsedMs(next));
    setPomodoro(getPomodoroState(next));
  }, []);

  const end = useCallback((): number | null => {
    const current = sessionRef.current;
    if (!current) return null;
    const minutes = focusWorkMinutes(current);
    clearFocusSession();
    setSession(null);
    setElapsedMs(0);
    setPomodoro(null);
    return minutes > 0 ? minutes : 1;
  }, []);

  const discard = useCallback(() => {
    if (!sessionRef.current) return;
    clearFocusSession();
    setSession(null);
    setElapsedMs(0);
    setPomodoro(null);
  }, []);

  return {
    session,
    elapsedMs,
    isPaused: session !== null && session.pausedAt !== null,
    pomodoro,
    start,
    pause,
    resume,
    end,
    discard,
  };
}
