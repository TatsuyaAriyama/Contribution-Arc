import { useMemo, useState } from "react";
import type { OrganizationMemberRecord } from "../services/cloudData";

export interface ManagerDashboardProps {
  /** All team members in the organization. */
  teamMembers: OrganizationMemberRecord[];
  /** Current logged-in user (the manager). */
  currentUser: Partial<OrganizationMemberRecord>;
  /** Callback when a member is clicked for detail view. */
  onMemberSelect?: (member: OrganizationMemberRecord) => void;
}

type TimePeriod = "daily" | "weekly" | "monthly";

export function ManagerDashboard({
  teamMembers,
  currentUser,
  onMemberSelect,
}: ManagerDashboardProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("weekly");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter members by search query (name or userId)
  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.displayName.toLowerCase().includes(query) ||
        m.userId.toLowerCase().includes(query),
    );
  }, [teamMembers, searchQuery]);

  // Calculate team-wide statistics
  const teamStats = useMemo(() => {
    const totalMembers = teamMembers.length;
    const totalMinutes = teamMembers.reduce((sum, m) => {
      // Estimate: effortExp ≈ minutes * some factor. Use effortExp / factor.
      // For now, use a simple proxy: effortExp / 10 to estimate minutes
      // (this is rough; in production, you'd track actual minutes in a field)
      return sum + (m.effortExp || 0);
    }, 0);

    const avgMinutesPerMember =
      totalMembers > 0 ? Math.round(totalMinutes / totalMembers) : 0;

    // Count members with active streak (streak > 0)
    const activeCount = teamMembers.filter((m) => (m.streak || 0) > 0).length;

    return {
      totalMembers,
      totalMinutes,
      avgMinutesPerMember,
      activeCount,
      activeRate: totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0,
    };
  }, [teamMembers]);

  return (
    <div className="manager-dashboard">
      <section className="manager-header">
        <div>
          <h2 className="manager-title">チーム学習ダッシュボード</h2>
          <p className="manager-subtitle">{currentUser.displayName} のチーム</p>
        </div>
      </section>

      {/* Team Statistics Summary */}
      <section className="manager-stats-grid">
        <article className="manager-stat-card">
          <span className="manager-stat-label">メンバー数</span>
          <strong className="manager-stat-value">{teamStats.totalMembers}</strong>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">稼働中</span>
          <strong className="manager-stat-value">
            {teamStats.activeCount} ({teamStats.activeRate}%)
          </strong>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">チーム総学習時間</span>
          <strong className="manager-stat-value">
            {Math.round(teamStats.totalMinutes / 60)}h
          </strong>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">平均/人</span>
          <strong className="manager-stat-value">
            {Math.round(teamStats.avgMinutesPerMember / 60)}h
          </strong>
        </article>
      </section>

      {/* Controls */}
      <section className="manager-controls">
        <div className="manager-period-selector" role="group" aria-label="期間">
          {(["daily", "weekly", "monthly"] as const).map((period) => (
            <button
              key={period}
              type="button"
              className={timePeriod === period ? "active" : ""}
              onClick={() => setTimePeriod(period)}
              aria-pressed={timePeriod === period}
            >
              {period === "daily" ? "日次" : period === "weekly" ? "週次" : "月次"}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="manager-search"
          placeholder="メンバーを検索（名前またはID）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="メンバー検索"
        />
      </section>

      {/* Members List */}
      <section className="manager-members-section">
        <h3 className="manager-members-title">
          メンバー一覧 ({filteredMembers.length})
        </h3>

        {filteredMembers.length === 0 ? (
          <div className="manager-empty">
            <p>該当するメンバーがありません</p>
          </div>
        ) : (
          <div className="manager-members-list">
            {filteredMembers.map((member) => (
              <article
                key={member.uid}
                className="manager-member-card"
                role="button"
                tabIndex={0}
                onClick={() => onMemberSelect?.(member)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onMemberSelect?.(member);
                  }
                }}
              >
                <div className="manager-member-avatar">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.displayName} />
                  ) : (
                    <span>{member.displayName.charAt(0)}</span>
                  )}
                </div>

                <div className="manager-member-info">
                  <strong className="manager-member-name">{member.displayName}</strong>
                  <small className="manager-member-id">@{member.userId}</small>
                </div>

                <div className="manager-member-stats">
                  <div className="manager-member-stat">
                    <span className="manager-member-stat-label">学習時間</span>
                    <strong>{Math.round((member.effortExp || 0) / 60)}h</strong>
                  </div>
                  <div className="manager-member-stat">
                    <span className="manager-member-stat-label">ストリーク</span>
                    <strong>{member.streak || 0}日</strong>
                  </div>
                  <div className="manager-member-stat">
                    <span className="manager-member-stat-label">レベル</span>
                    <strong>{member.level || 1}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
