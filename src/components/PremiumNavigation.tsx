import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type AppView = "home" | "profile" | "workspace" | "knowledge";
export type FriendPreviewStatus = "online" | "away" | "offline";

export type FriendPreview = {
  uid: string;
  name: string;
  userId: string;
  avatar: string;
  status: FriendPreviewStatus;
  activity: string;
  githubUrl?: string;
};

export type LiveActivity = {
  id: string;
  userName: string;
  avatar?: string;
  text: string;
  meta: string;
  status: "online" | "recent";
};

type PremiumSidebarProps = {
  currentView: AppView;
  logo: ReactNode;
  roomOnlineCount: number;
  weeklyStudyLabel: string;
  friends: FriendPreview[];
  liveActivities: LiveActivity[];
  onViewChange: (view: AppView) => void;
  onProfileOpen: () => void;
  onFriendOpen: (friend: FriendPreview) => void;
};

export function PremiumSidebar({
  currentView,
  logo,
  roomOnlineCount,
  weeklyStudyLabel,
  friends,
  liveActivities,
  onViewChange,
  onProfileOpen,
  onFriendOpen,
}: PremiumSidebarProps) {
  const visibleFriends = friends.slice(0, 5);

  return (
    <aside className="app-sidebar" aria-label="Contribution Arc navigation">
      <button type="button" className="brand-lockup" onClick={() => onViewChange("home")}>
        {logo}
        <span>
          <strong>Contribution Arc</strong>
          <small>Learning OS</small>
        </span>
      </button>

      <nav className="side-nav" aria-label="Main navigation">
        <button
          type="button"
          className={currentView === "home" ? "active" : ""}
          onClick={() => onViewChange("home")}
        >
          <span />
          Dashboard
        </button>
        <button
          type="button"
          className={currentView === "workspace" ? "active" : ""}
          onClick={() => onViewChange("workspace")}
        >
          <span />
          Silent Workspace
        </button>
        <button
          type="button"
          className={currentView === "knowledge" ? "active" : ""}
          onClick={() => onViewChange("knowledge")}
        >
          <span />
          Knowledge Graph
        </button>
        <button type="button" className={currentView === "profile" ? "active" : ""} onClick={onProfileOpen}>
          <span />
          Profile
        </button>
      </nav>

      <section className="friend-sidebar-panel" aria-label="Friends">
        <div className="friend-sidebar-head">
          <p className="card-kicker">Friends</p>
          <span>{friends.length}/20</span>
        </div>

        <div className="friend-sidebar-list">
          {visibleFriends.length > 0 ? (
            visibleFriends.map((friend) => (
              <article className="friend-sidebar-card" key={friend.uid}>
                <button type="button" onClick={() => onFriendOpen(friend)}>
                  <span className="friend-avatar">
                    {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1).toUpperCase()}
                    <i className={`friend-status-dot ${friend.status}`} />
                  </span>
                  <span>
                    <strong>{friend.name}</strong>
                    <small>{friend.activity}</small>
                  </span>
                </button>
                {friend.githubUrl ? (
                  <a href={friend.githubUrl} target="_blank" rel="noreferrer" aria-label={`${friend.name}のGitHubを開く`}>
                    GitHub
                  </a>
                ) : null}
              </article>
            ))
          ) : (
            <p className="friend-empty">まだフレンドはいません。プロフィールから静かに申請できます。</p>
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
              <motion.article
                className="live-activity-card"
                key={activity.id}
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
              </motion.article>
            ))
          ) : (
            <p className="friend-empty">今は静かです。誰かの記録が始まるとここに流れます。</p>
          )}
        </div>
      </section>

      <div className="sidebar-presence">
        <p className="card-kicker">Live Contribution</p>
        <strong>{roomOnlineCount} builders</strong>
        <small>{weeklyStudyLabel} this week</small>
        <div aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} className={`heat-${(index + roomOnlineCount) % 5}`} />
          ))}
        </div>
      </div>
    </aside>
  );
}
