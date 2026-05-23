import { AnimatePresence, motion } from "framer-motion";
import type { WorkspaceRecruitmentRecord } from "../../services/workspaceRecruitments";

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

function formatRelativeFuture(diffMs: number) {
  if (diffMs <= 0) return "まもなく";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `あと${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest > 0) return `あと${hours}時間${rest}分`;
  return `あと${hours}時間`;
}

function formatStartTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  if (isToday) return `今日 ${hh}:${mm}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}

function formatPostedAgo(createdAtIso: string, now: number) {
  const diff = now - new Date(createdAtIso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function formatRemaining(msLeft: number) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `残り ${hours}時間${rest}分` : `残り ${hours}時間`;
  }
  if (minutes >= 5) {
    return `残り ${minutes}分`;
  }
  // Show seconds in the final 5 minutes so the card feels alive.
  return `残り ${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const ROLL_SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.6 };

export function WorkspaceRecruitmentFeedCard({
  recruitment,
  author,
  now,
  currentUserId,
  onJoin,
  onCancel,
  onAuthorOpen,
}: WorkspaceRecruitmentFeedCardProps) {
  const startAtMs = new Date(recruitment.startAt).getTime();
  const expiresAtMs = new Date(recruitment.expiresAt).getTime();
  const isUpcoming = now < startAtMs;
  const isActive = !isUpcoming && now < expiresAtMs;
  const isOwner = currentUserId === recruitment.userId;
  const hasJoined = recruitment.joinedUserIds.includes(currentUserId);
  const joinedCount = recruitment.joinedUserIds.length;

  const displayName = author?.displayName || "Builder";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();
  const accentColor = author?.characterColor || "#1f6f4a";

  const stateLabel = isUpcoming ? "🗓 予定" : isActive ? "募集中" : "終了";
  const stateClassName = isUpcoming ? "state-upcoming" : isActive ? "state-active" : "state-ended";

  const timeInfo = isUpcoming
    ? `${formatStartTime(recruitment.startAt)} 開始 · ${formatRelativeFuture(startAtMs - now)}`
    : isActive
    ? formatRemaining(expiresAtMs - now)
    : "終了しました";

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
            <small>{formatPostedAgo(recruitment.createdAt, now)}</small>
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
          <dt>作業</dt>
          <dd>{recruitment.task || "未設定"}</dd>
        </div>
        <div>
          <dt>時間</dt>
          <dd>{timeInfo}</dd>
        </div>
        <div>
          <dt>参加</dt>
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
            <span aria-hidden="true">人</span>
          </dd>
        </div>
      </dl>

      <footer className="recruitment-card-actions">
        {isOwner ? (
          <button type="button" className="recruitment-cancel" onClick={() => onCancel(recruitment)}>
            取り消す
          </button>
        ) : isActive ? (
          <button
            type="button"
            className="recruitment-join"
            onClick={() => onJoin(recruitment)}
            disabled={hasJoined}
          >
            {hasJoined ? "参加中" : "参加する"}
          </button>
        ) : isUpcoming ? (
          <button
            type="button"
            className="recruitment-join is-upcoming"
            onClick={() => onJoin(recruitment)}
            disabled={hasJoined}
          >
            {hasJoined ? "参加予定" : "参加予定にする"}
          </button>
        ) : (
          <span className="recruitment-ended-note">この募集は終了しました</span>
        )}
      </footer>
    </article>
  );
}
