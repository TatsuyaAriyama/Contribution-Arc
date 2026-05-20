import type { ReactNode } from "react";

export type AppView = "home" | "profile" | "workspace";
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

type PremiumSidebarProps = {
  currentView: AppView;
  logo: ReactNode;
  roomOnlineCount: number;
  weeklyStudyLabel: string;
  friends: FriendPreview[];
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
