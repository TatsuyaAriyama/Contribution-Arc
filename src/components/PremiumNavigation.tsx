import type { ReactNode } from "react";

export type AppView = "home" | "profile" | "workspace";

type PremiumSidebarProps = {
  currentView: AppView;
  logo: ReactNode;
  roomOnlineCount: number;
  weeklyStudyLabel: string;
  onViewChange: (view: AppView) => void;
  onProfileOpen: () => void;
};

export function PremiumSidebar({
  currentView,
  logo,
  roomOnlineCount,
  weeklyStudyLabel,
  onViewChange,
  onProfileOpen,
}: PremiumSidebarProps) {
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
