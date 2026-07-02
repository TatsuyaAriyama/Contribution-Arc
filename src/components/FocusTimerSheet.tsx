import { useState } from "react";
import "../styles/focus.css";
import { useTranslation } from "../i18n/LanguageContext";
import type { FocusMode, FocusSession, FocusTarget, PomodoroState } from "../services/focusSession";
import { focusWorkMinutes } from "../services/focusSession";

/**
 * 計測シート(フォーカスセッション)。下から出るフルスクリーンに近い
 * シートで、ライブラリの学習対象から選んで計測を始め、計測中は経過
 * 時間・一時停止・終了(記録へ)・破棄を扱う。
 *
 * 世界観: 静かで上質(AGENTS.md)。緑は計測中インジケータと主 CTA のみ、
 * 過剰な装飾・グラデーションは置かない。
 */

const FOCUS_MODE_STORAGE_KEY = "ca:focus-mode";

function isFocusMode(value: unknown): value is FocusMode {
  return value === "stopwatch" || value === "pomodoro";
}

/** 前回選択したモードを localStorage から復元する。無ければ既定の stopwatch。 */
function readStoredFocusMode(): FocusMode {
  try {
    const stored = window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY);
    return isFocusMode(stored) ? stored : "stopwatch";
  } catch {
    return "stopwatch";
  }
}

type Props = {
  targets: FocusTarget[];
  session: FocusSession | null;
  elapsedMs: number;
  isPaused: boolean;
  pomodoro: PomodoroState | null;
  onStart: (target: FocusTarget, mode: FocusMode) => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onDiscard: () => void;
  onClose: () => void;
};

/** ms → "HH:MM:SS"(1 時間未満は "MM:SS")。 */
function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function FocusTimerSheet({
  targets,
  session,
  elapsedMs,
  isPaused,
  pomodoro,
  onStart,
  onPause,
  onResume,
  onEnd,
  onDiscard,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<FocusMode>(() => readStoredFocusMode());

  const handleDiscard = () => {
    if (window.confirm(t("この集中セッションを破棄しますか？記録には残りません。"))) {
      onDiscard();
    }
  };

  const handleModeChange = (next: FocusMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, next);
    } catch {
      /* best-effort。保存できなくても選択自体は使える */
    }
  };

  const isPomodoro = session?.mode === "pomodoro" && pomodoro !== null;
  const workMinutes = session ? focusWorkMinutes(session) : 0;

  return (
    <div
      className="focus-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("集中セッション")}
      onClick={onClose}
    >
      <section className="focus-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="focus-sheet-head">
          <h2 className="focus-sheet-title">{t("集中セッション")}</h2>
          <button
            type="button"
            className="focus-sheet-close"
            onClick={onClose}
            aria-label={t("閉じる")}
          >
            ×
          </button>
        </header>
        {session ? <p className="focus-sheet-hint">{t("閉じても計測はつづきます")}</p> : null}

        {session ? (
          <div className="focus-sheet-active">
            <div className="focus-sheet-target">
              <span
                className="focus-sheet-target-bar"
                style={{ ["--focus-target-color" as string]: session.target.itemColor }}
                aria-hidden="true"
              />
              <span className="focus-sheet-target-name">{session.target.itemName}</span>
            </div>

            {isPomodoro && pomodoro ? (
              <p className="focus-sheet-pomo-phase">
                <span
                  className={`focus-sheet-dot focus-sheet-dot-sm${
                    pomodoro.phase === "break" ? " is-break" : ""
                  }${isPaused ? " is-paused" : ""}`}
                  aria-hidden="true"
                />
                {pomodoro.phase === "work" ? t("集中フェーズ") : t("休息フェーズ")}
              </p>
            ) : null}

            <div className="focus-sheet-clock">
              {!isPomodoro ? (
                <span
                  className={`focus-sheet-dot${isPaused ? " is-paused" : ""}`}
                  aria-hidden="true"
                />
              ) : null}
              <span>{formatClock(isPomodoro && pomodoro ? pomodoro.remainingMs : elapsedMs)}</span>
            </div>

            {isPomodoro && pomodoro ? (
              <p className="focus-sheet-pomo-meta">
                {t("{n}周目", { n: pomodoro.round })}
                <span aria-hidden="true"> · </span>
                {workMinutes}
                {t("分")}
              </p>
            ) : null}

            {isPaused ? <p className="focus-sheet-status">{t("一時停止中")}</p> : null}

            <div className="focus-sheet-controls">
              {isPaused ? (
                <button type="button" className="focus-btn focus-btn-secondary" onClick={onResume}>
                  {t("再開")}
                </button>
              ) : (
                <button type="button" className="focus-btn focus-btn-secondary" onClick={onPause}>
                  {t("一時停止")}
                </button>
              )}
              <button type="button" className="focus-btn focus-btn-primary" onClick={onEnd}>
                {t("終了して記録")}
              </button>
            </div>

            <button type="button" className="focus-sheet-discard" onClick={handleDiscard}>
              {t("破棄する")}
            </button>
          </div>
        ) : targets.length === 0 ? (
          <div className="focus-sheet-empty">
            <p>{t("ライブラリで学習対象を追加してください")}</p>
          </div>
        ) : (
          <>
            <div className="focus-sheet-mode-toggle" role="group" aria-label={t("計測モード")}>
              <button
                type="button"
                className={`focus-sheet-mode-btn${mode === "stopwatch" ? " is-active" : ""}`}
                aria-pressed={mode === "stopwatch"}
                onClick={() => handleModeChange("stopwatch")}
              >
                {t("ストップウォッチ")}
              </button>
              <button
                type="button"
                className={`focus-sheet-mode-btn${mode === "pomodoro" ? " is-active" : ""}`}
                aria-pressed={mode === "pomodoro"}
                onClick={() => handleModeChange("pomodoro")}
              >
                {t("ポモドーロ")}
              </button>
            </div>

            <div className="focus-sheet-target-grid">
              {targets.map((target) => (
                <button
                  key={target.itemId}
                  type="button"
                  className="focus-sheet-target-card"
                  onClick={() => onStart(target, mode)}
                  aria-label={t("{name}で作業をはじめる", { name: target.itemName })}
                >
                  <span
                    className={`focus-sheet-target-photo${target.photo ? "" : " is-fallback"}`}
                  >
                    {target.photo ? <img src={target.photo} alt="" loading="lazy" /> : null}
                  </span>
                  <strong className="focus-sheet-target-card-name">{target.itemName}</strong>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
