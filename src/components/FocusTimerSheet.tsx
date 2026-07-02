import "../styles/focus.css";
import { useTranslation } from "../i18n/LanguageContext";
import type { FocusSession, FocusTarget } from "../services/focusSession";

/**
 * 計測シート(フォーカスセッション)。下から出るフルスクリーンに近い
 * シートで、ライブラリの学習対象から選んで計測を始め、計測中は経過
 * 時間・一時停止・終了(記録へ)・破棄を扱う。
 *
 * 世界観: 静かで上質(AGENTS.md)。緑は計測中インジケータと主 CTA のみ、
 * 過剰な装飾・グラデーションは置かない。
 */

type Props = {
  targets: FocusTarget[];
  session: FocusSession | null;
  elapsedMs: number;
  isPaused: boolean;
  onStart: (target: FocusTarget) => void;
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
  onStart,
  onPause,
  onResume,
  onEnd,
  onDiscard,
  onClose,
}: Props) {
  const { t } = useTranslation();

  const handleDiscard = () => {
    if (window.confirm(t("この集中セッションを破棄しますか？記録には残りません。"))) {
      onDiscard();
    }
  };

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

            <div className="focus-sheet-clock">
              <span
                className={`focus-sheet-dot${isPaused ? " is-paused" : ""}`}
                aria-hidden="true"
              />
              <span>{formatClock(elapsedMs)}</span>
            </div>
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
          <ul className="focus-sheet-list">
            {targets.map((target) => (
              <li key={target.itemId}>
                <button
                  type="button"
                  className="focus-sheet-target-row"
                  onClick={() => onStart(target)}
                >
                  <span
                    className="focus-sheet-target-bar"
                    style={{ ["--focus-target-color" as string]: target.itemColor }}
                    aria-hidden="true"
                  />
                  <span className="focus-sheet-target-name">{target.itemName}</span>
                  <span className="focus-sheet-target-cta">{t("集中をはじめる")} ›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
