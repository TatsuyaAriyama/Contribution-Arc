import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WorkspaceRecruitmentRecord } from "../../services/workspaceRecruitments";
import { useTranslation } from "../../i18n/LanguageContext";

export type RecruitmentAuthor = {
  userId: string;
  displayName: string;
  avatar?: string;
  characterColor?: string;
};

type WorkspaceRecruitmentFeedCardProps = {
  recruitment: WorkspaceRecruitmentRecord;
  author: RecruitmentAuthor | null;
  now: number;
  currentUserId: string;
  onJoin: (recruitment: WorkspaceRecruitmentRecord) => void;
  onCancel: (recruitment: WorkspaceRecruitmentRecord) => void;
  onAuthorOpen?: (author: RecruitmentAuthor) => void;
};

type TranslateFn = (jaText: string, vars?: Record<string, string | number>) => string;

function formatRelativeFuture(diffMs: number, t: TranslateFn) {
  if (diffMs <= 0) return t("まもなく");
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return t("あと{minutes}分", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest > 0) return t("あと{hours}時間{rest}分", { hours, rest });
  return t("あと{hours}時間", { hours });
}

function formatStartTime(iso: string, t: TranslateFn) {
  const date = new Date(iso);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  if (isToday) return t("今日 {hh}:{mm}", { hh, mm });
  return `${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}

function formatPostedAgo(createdAtIso: string, now: number, t: TranslateFn) {
  const diff = now - new Date(createdAtIso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("たった今");
  if (minutes < 60) return t("{minutes}分前", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{hours}時間前", { hours });
  const days = Math.floor(hours / 24);
  return t("{days}日前", { days });
}

function formatRemaining(msLeft: number, t: TranslateFn) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0
      ? t("残り {hours}時間{rest}分", { hours, rest })
      : t("残り {hours}時間", { hours });
  }
  if (minutes >= 5) {
    return t("残り {minutes}分", { minutes });
  }
  // Show seconds in the final 5 minutes so the card feels alive.
  const ss = seconds.toString().padStart(2, "0");
  return t("残り {minutes}:{seconds}", { minutes, seconds: ss });
}

const ROLL_SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.6 };

export function WorkspaceRecruitmentFeedCard({
  recruitment,
  author,
  now: coarseNow,
  currentUserId,
  onJoin,
  onCancel,
  onAuthorOpen,
}: WorkspaceRecruitmentFeedCardProps) {
  const { t } = useTranslation();
  const startAtMs = new Date(recruitment.startAt).getTime();
  const expiresAtMs = new Date(recruitment.expiresAt).getTime();

  // 秒単位のカウントダウンはこのカード内部のローカル tick で賄う。
  // 以前は App 側の feedNowTick を 1 秒間隔にしていたが、それだと
  // 2 万行の App コンポーネント全体が毎秒再レンダーされて UI 全体が
  // モサつく。tick の影響範囲をこのカード 1 枚に閉じ込めることで、
  // App 側は 30 秒間隔の粗い now だけ流せばよくなる。
  // ローカル tick は「残り 5 分未満 (秒表示が出る区間)」のみ 1 秒、
  // それ以外は 30 秒で十分。
  const [localNow, setLocalNow] = useState(coarseNow);
  useEffect(() => {
    setLocalNow(coarseNow);
    const msLeft = expiresAtMs - Date.now();
    const isLive = Date.now() >= startAtMs && msLeft > 0;
    const needsSecondTick = isLive && msLeft < 5 * 60 * 1000;
    const intervalMs = needsSecondTick ? 1000 : 30000;
    const id = window.setInterval(() => setLocalNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [coarseNow, startAtMs, expiresAtMs]);
  const now = localNow;

  const isUpcoming = now < startAtMs;
  const isActive = !isUpcoming && now < expiresAtMs;
  const isOwner = currentUserId === recruitment.userId;
  const hasJoined = recruitment.joinedUserIds.includes(currentUserId);
  const joinedCount = recruitment.joinedUserIds.length;

  const displayName = author?.displayName || "Builder";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();
  const accentColor = author?.characterColor || "#1a1817";

  const stateLabel = isUpcoming ? t("🗓 予定") : isActive ? t("募集中") : t("終了");
  const stateClassName = isUpcoming ? "state-upcoming" : isActive ? "state-active" : "state-ended";

  const timeInfo = isUpcoming
    ? t("{start} 開始 · {relative}", {
        start: formatStartTime(recruitment.startAt, t),
        relative: formatRelativeFuture(startAtMs - now, t),
      })
    : isActive
    ? formatRemaining(expiresAtMs - now, t)
    : t("終了しました");

  return (
    <article className={`feed-card recruitment-card ${stateClassName}`}>
      <header className="recruitment-card-head">
        <button
          type="button"
          className="recruitment-card-author"
          onClick={() => (author ? onAuthorOpen?.(author) : undefined)}
          disabled={!author}
        >
          <span className="recruitment-avatar" style={{ background: accentColor }}>
            {author?.avatar ? <img src={author.avatar} alt="" /> : avatarLetter}
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>{formatPostedAgo(recruitment.createdAt, now, t)}</small>
          </span>
        </button>
        <span className={`recruitment-state-badge ${stateClassName}`}>
          {isActive ? <span className="recruitment-state-dot" aria-hidden="true" /> : null}
          {stateLabel}
        </span>
      </header>

      {recruitment.message ? <p className="recruitment-message">{recruitment.message}</p> : null}

      <dl className="recruitment-meta">
        <div>
          <dt>{t("作業")}</dt>
          <dd>{recruitment.task || t("未設定")}</dd>
        </div>
        <div>
          <dt>{t("時間")}</dt>
          <dd>{timeInfo}</dd>
        </div>
        <div>
          <dt>{t("参加")}</dt>
          <dd className="recruitment-join-count">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={joinedCount}
                initial={{ y: 14, opacity: 0, filter: "blur(2px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -14, opacity: 0, filter: "blur(2px)" }}
                transition={ROLL_SPRING}
              >
                {joinedCount}
              </motion.span>
            </AnimatePresence>
            <span aria-hidden="true">{t("人")}</span>
          </dd>
        </div>
      </dl>

      <footer className="recruitment-card-actions">
        {isOwner ? (
          <button type="button" className="recruitment-cancel" onClick={() => onCancel(recruitment)}>
            {t("取り消す")}
          </button>
        ) : isActive ? (
          <button
            type="button"
            className="recruitment-join"
            onClick={() => onJoin(recruitment)}
            disabled={hasJoined}
          >
            {hasJoined ? t("参加中") : t("参加する")}
          </button>
        ) : isUpcoming ? (
          <button
            type="button"
            className="recruitment-join is-upcoming"
            onClick={() => onJoin(recruitment)}
            disabled={hasJoined}
          >
            {hasJoined ? t("参加予定") : t("参加予定にする")}
          </button>
        ) : (
          <span className="recruitment-ended-note">{t("この募集は終了しました")}</span>
        )}
      </footer>
    </article>
  );
}
