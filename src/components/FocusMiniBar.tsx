import "../styles/focus.css";
import { useTranslation } from "../i18n/LanguageContext";
import type { FocusSession } from "../services/focusSession";

/**
 * 計測中に画面下部・ボトムナビの上へ浮くグローバルミニバー。
 * タップで FocusTimerSheet を再表示する(計測自体はシートの開閉に
 * 依存しない)。session が null の間は何も描画しない。
 */

type Props = {
  session: FocusSession | null;
  elapsedMs: number;
  isPaused: boolean;
  onClick: () => void;
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

export function FocusMiniBar({ session, elapsedMs, isPaused, onClick }: Props) {
  const { t } = useTranslation();

  if (!session) return null;

  return (
    <button
      type="button"
      className={`focus-mini-bar${isPaused ? " is-paused" : ""}`}
      onClick={onClick}
      aria-label={t("計測中の集中セッションを開く")}
    >
      <span className={`focus-mini-dot${isPaused ? " is-paused" : ""}`} aria-hidden="true" />
      <span className="focus-mini-clock">{formatClock(elapsedMs)}</span>
      <span className="focus-mini-name">{session.target.itemName}</span>
      {isPaused ? <span className="focus-mini-status">{t("一時停止中")}</span> : null}
    </button>
  );
}
