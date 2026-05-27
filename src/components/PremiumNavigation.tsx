import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { FriendGithubMini } from "./FriendGithubMini";

export type AppView = "home" | "profile" | "workspace" | "logs" | "daily" | "learning" | "shop";
export type FriendPreviewStatus = "online" | "away" | "offline";

export type FriendPreview = {
  uid: string;
  name: string;
  userId: string;
  avatar: string;
  status: FriendPreviewStatus;
  activity: string;
  githubUrl?: string;
  githubUsername?: string;
};

export type LiveActivity = {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  text: string;
  meta: string;
  status: "online" | "recent";
};

type PremiumSidebarProps = {
  currentView: AppView;
  logo: ReactNode;
  /** Compact player status card rendered at the top of the sidebar. */
  playerStatus: ReactNode;
  friends: FriendPreview[];
  liveActivities: LiveActivity[];
  onViewChange: (view: AppView) => void;
  onFriendOpen: (friend: FriendPreview) => void;
  onActivityOpen: (activity: LiveActivity) => void;
  /** Whether the mobile drawer is currently open. Desktop ignores this. */
  isMobileOpen?: boolean;
  /** Called after the user taps a nav target — the parent should close the drawer. */
  onMobileClose?: () => void;
};

export function PremiumSidebar({
  currentView,
  logo,
  playerStatus,
  friends,
  liveActivities,
  onViewChange,
  onFriendOpen,
  onActivityOpen,
  isMobileOpen = false,
  onMobileClose,
}: PremiumSidebarProps) {
  const visibleFriends = friends.slice(0, 5);

  // Wraps view-changing nav callbacks so the mobile drawer always closes
  // after navigation. Desktop ignores it (onMobileClose is a no-op there).
  const handleNavigate = (run: () => void) => {
    run();
    onMobileClose?.();
  };

  return (
    <aside
      className={`app-sidebar${isMobileOpen ? " is-mobile-open" : ""}`}
      aria-label="Contribution Arc navigation"
    >
      {playerStatus}

      <nav className="side-nav" aria-label="Main navigation">
        <button
          type="button"
          className={currentView === "home" ? "active" : ""}
          onClick={() => handleNavigate(() => onViewChange("home"))}
        >
          <span />
          ホーム
        </button>
        <button
          type="button"
          className={currentView === "logs" ? "active" : ""}
          onClick={() => handleNavigate(() => onViewChange("logs"))}
        >
          <span />
          みんなの記録
        </button>
        <button
          type="button"
          className={currentView === "daily" ? "active" : ""}
          onClick={() => handleNavigate(() => onViewChange("daily"))}
        >
          <span />
          日報
        </button>
        <button
          type="button"
          className={currentView === "learning" ? "active" : ""}
          onClick={() => handleNavigate(() => onViewChange("learning"))}
        >
          <span />
          記録する
        </button>
        <button
          type="button"
          className={currentView === "workspace" ? "active" : ""}
          onClick={() => handleNavigate(() => onViewChange("workspace"))}
        >
          <span />
          作業部屋
        </button>
      </nav>

      <section className="friend-sidebar-panel" aria-label="Friends">
        <div className="friend-sidebar-head">
          <p className="card-kicker">Friends</p>
          {friends.length > 0 ? <span>{friends.length}/20</span> : null}
        </div>

        <div className="friend-sidebar-list">
          {visibleFriends.length > 0 ? (
            visibleFriends.map((friend) => (
              <article className="friend-sidebar-card" key={friend.uid}>
                <button
                  type="button"
                  onClick={() => handleNavigate(() => onFriendOpen(friend))}
                >
                  <span className="friend-avatar">
                    {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1).toUpperCase()}
                    <i className={`friend-status-dot ${friend.status}`} />
                  </span>
                  <span>
                    <strong>{friend.name}</strong>
                    <small>{friend.activity}</small>
                  </span>
                </button>
                {friend.githubUsername ? (
                  <FriendGithubMini username={friend.githubUsername} />
                ) : null}
                {friend.githubUrl ? (
                  <a href={friend.githubUrl} target="_blank" rel="noreferrer" aria-label={`${friend.name}のGitHubを開く`}>
                    GitHub
                  </a>
                ) : null}
              </article>
            ))
          ) : (
            <div className="friend-empty-state">
              <p className="friend-empty-text">
                フレンドを招待して、
                <br />
                一緒に学びを積み上げよう
              </p>
              <button
                type="button"
                className="friend-empty-cta"
                onClick={() => handleNavigate(() => onViewChange("profile"))}
              >
                フレンドを招待する
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="live-activity-panel" aria-label="Live Activity">
        <div className="live-activity-head">
          <p className="card-kicker">Live Activity</p>
          <span aria-hidden="true" />
        </div>

        <div className="live-activity-list">
          {liveActivities.length > 0 ? (
            liveActivities.slice(0, 5).map((activity, index) => (
              <motion.button
                type="button"
                className="live-activity-card"
                key={activity.id}
                onClick={() => handleNavigate(() => onActivityOpen(activity))}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: index * 0.045 }}
              >
                <span className="live-activity-avatar">
                  {activity.avatar ? <img src={activity.avatar} alt="" /> : activity.userName.slice(0, 1).toUpperCase()}
                  <i className={`live-activity-dot ${activity.status}`} />
                </span>
                <span>
                  <strong>{activity.text}</strong>
                  <small>{activity.meta}</small>
                </span>
              </motion.button>
            ))
          ) : (
            <p className="friend-empty">今は静かです。誰かの記録が始まるとここに流れます。</p>
          )}
        </div>
      </section>

      <button
        type="button"
        className="brand-lockup-compact"
        onClick={() => handleNavigate(() => onViewChange("home"))}
        aria-label="ホームへ"
      >
        <span className="brand-lockup-compact-mark">{logo}</span>
        <span>Contribution Arc</span>
      </button>
    </aside>
  );
}

