import { useMemo, useState } from "react";
import type { OrganizationMemberRecord } from "../services/cloudData";

export interface ManagerDashboardProps {
  /** All team members in the organization. */
  teamMembers: OrganizationMemberRecord[];
  /** Current logged-in user (the manager). */
  currentUser: Partial<OrganizationMemberRecord>;
  /** Organization name — used to label the CSV export file. */
  organizationName?: string;
  /** Whether the org has a Slack webhook configured. Controls the
   *  visibility / enabled state of the "Send to Slack" digest button. */
  hasSlackWebhook?: boolean;
  /** Send the weekly digest to the org's configured Slack channel.
   *  Resolves with an error string on failure, undefined on success. */
  onSendSlackDigest?: () => Promise<string | undefined>;
  /** Callback when a member is clicked for detail view. */
  onMemberSelect?: (member: OrganizationMemberRecord) => void;
}

type DigestSendState = "idle" | "sending" | "sent" | "error";

/** Escape a single CSV cell. Wraps in double-quotes when the cell
 *  contains a comma, quote, or newline; doubles internal quotes per
 *  RFC 4180. We always quote string columns to keep things predictable
 *  for Excel / Sheets / Numbers when names contain commas. */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build the CSV body for a given member list. Headers are Japanese
 *  so the file lands readable in Excel without manual relabeling for
 *  L&D reports — the target user is the HR/manager, not engineers. */
function buildMembersCsv(members: OrganizationMemberRecord[]): string {
  const header = [
    "表示名",
    "ユーザーID",
    "ロール",
    "レベル",
    "学習時間（時間）",
    "アウトプットEXP",
    "ストリーク（日）",
    "コミット数",
    "最終同期日時",
  ];

  const rows = members.map((m) => [
    csvCell(m.displayName),
    csvCell(m.userId),
    csvCell(m.organizationRole),
    csvCell(m.level || 0),
    csvCell(Math.round((m.effortExp || 0) / 60)),
    csvCell(m.outputExp || 0),
    csvCell(m.streak || 0),
    csvCell(m.contributionCount || 0),
    csvCell(m.lastSyncedAt || ""),
  ].join(","));

  return [header.join(","), ...rows].join("\r\n");
}

/** Trigger a browser download of the given CSV text. Prepends a UTF-8
 *  BOM so Excel on Windows opens Japanese characters correctly without
 *  the user having to re-import with the right encoding. */
function downloadCsv(filename: string, csv: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type TimePeriod = "daily" | "weekly" | "monthly";

export function ManagerDashboard({
  teamMembers,
  currentUser,
  organizationName,
  hasSlackWebhook,
  onSendSlackDigest,
  onMemberSelect,
}: ManagerDashboardProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("weekly");
  const [searchQuery, setSearchQuery] = useState("");
  const [digestState, setDigestState] = useState<DigestSendState>("idle");
  const [digestMessage, setDigestMessage] = useState<string>("");

  // Sanitize the org name into a filename-safe slug. Keeps Japanese
  // letters readable (most OSes accept them in filenames now) but
  // strips slashes / quotes / control chars that break downloads.
  const handleExportCsv = () => {
    if (teamMembers.length === 0) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const slug = (organizationName || "team")
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "team";
    const filename = `contribution-arc-${slug}-${today}.csv`;
    const csv = buildMembersCsv(teamMembers);
    downloadCsv(filename, csv);
  };

  /* Send the weekly digest to the org's Slack channel. The actual
     payload + POST happens in the parent (App.tsx) so this component
     stays free of Firestore + Slack service deps; we just orchestrate
     the UI state machine. */
  const handleSendDigest = async () => {
    if (!onSendSlackDigest || digestState === "sending") return;
    setDigestState("sending");
    setDigestMessage("");
    try {
      const error = await onSendSlackDigest();
      if (error) {
        setDigestState("error");
        setDigestMessage(error);
      } else {
        setDigestState("sent");
        setDigestMessage("送信しました");
        // Drop back to idle after a few seconds so the button can be
        // pressed again without a page refresh.
        setTimeout(() => setDigestState("idle"), 3200);
      }
    } catch (err) {
      setDigestState("error");
      setDigestMessage(err instanceof Error ? err.message : "送信に失敗しました");
    }
  };

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

  /* Effort distribution chart data — sort members by total learning
     hours descending and compute each bar's width as a fraction of
     the team's top performer. Capped at 10 rows so a large team
     doesn't blow out the dashboard; remainder is shown as a count. */
  const effortDistribution = useMemo(() => {
    const sorted = [...teamMembers]
      .sort((a, b) => (b.effortExp || 0) - (a.effortExp || 0));
    const top = sorted.slice(0, 10);
    const max = top[0]?.effortExp || 0;
    const remainderCount = Math.max(0, sorted.length - top.length);
    return {
      top: top.map((m) => ({
        uid: m.uid,
        displayName: m.displayName,
        hours: Math.round((m.effortExp || 0) / 60),
        // Floor at a tiny visible value when the member has zero so
        // their bar is still discoverable; null when truly empty so
        // we can skip rendering.
        ratio: max > 0 ? Math.max((m.effortExp || 0) / max, 0.02) : 0,
      })),
      remainderCount,
    };
  }, [teamMembers]);

  /* Level distribution — bucket members into wide level ranges so the
     manager sees at a glance whether the team is mostly fresh or
     experienced. Buckets chosen to keep things meaningful at small
     team sizes (a 5-person team should still show variation). */
  const levelDistribution = useMemo(() => {
    const buckets = [
      { label: "Lv 1–5", min: 1, max: 5, count: 0 },
      { label: "Lv 6–10", min: 6, max: 10, count: 0 },
      { label: "Lv 11–20", min: 11, max: 20, count: 0 },
      { label: "Lv 21+", min: 21, max: Infinity, count: 0 },
    ];
    teamMembers.forEach((m) => {
      const lv = Math.max(1, m.level || 1);
      const bucket = buckets.find((b) => lv >= b.min && lv <= b.max);
      if (bucket) bucket.count += 1;
    });
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, ratio: b.count / max }));
  }, [teamMembers]);

  return (
    <div className="manager-dashboard">
      <section className="manager-header">
        <div>
          <h2 className="manager-title">チーム学習ダッシュボード</h2>
          <p className="manager-subtitle">{currentUser.displayName} のチーム</p>
        </div>
        <div className="manager-header-actions">
          {hasSlackWebhook && onSendSlackDigest ? (
            <div className="manager-digest-wrap">
              <button
                type="button"
                className="manager-export-button"
                onClick={handleSendDigest}
                disabled={teamMembers.length === 0 || digestState === "sending"}
                aria-label="チーム学習サマリーをSlackに送信"
              >
                {digestState === "sending"
                  ? "送信中…"
                  : digestState === "sent"
                    ? "Slackに送信済み"
                    : "Slackにサマリー送信"}
              </button>
              {digestState === "error" && digestMessage ? (
                <span className="manager-digest-error" role="alert">
                  {digestMessage}
                </span>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="manager-export-button"
            onClick={handleExportCsv}
            disabled={teamMembers.length === 0}
            aria-label="メンバー一覧をCSVでダウンロード"
          >
            CSVをダウンロード
          </button>
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

      {/* Distribution charts — only render when there's enough data to
          make a visual comparison meaningful. */}
      {teamMembers.length > 0 ? (
        <section className="manager-charts">
          <article className="manager-chart-card">
            <header className="manager-chart-head">
              <h3 className="manager-chart-title">メンバー別 学習時間</h3>
              <p className="manager-chart-sublabel">累計（時間）</p>
            </header>
            <ul className="manager-bar-list">
              {effortDistribution.top.map((row) => (
                <li key={row.uid} className="manager-bar-row">
                  <span className="manager-bar-label" title={row.displayName}>
                    {row.displayName}
                  </span>
                  <span className="manager-bar-track" aria-hidden="true">
                    <span
                      className="manager-bar-fill"
                      style={{ width: `${row.ratio * 100}%` }}
                    />
                  </span>
                  <span className="manager-bar-value">{row.hours}h</span>
                </li>
              ))}
            </ul>
            {effortDistribution.remainderCount > 0 ? (
              <p className="manager-chart-foot">
                他 {effortDistribution.remainderCount} 名
              </p>
            ) : null}
          </article>

          <article className="manager-chart-card">
            <header className="manager-chart-head">
              <h3 className="manager-chart-title">レベル分布</h3>
              <p className="manager-chart-sublabel">人数</p>
            </header>
            <ul className="manager-bar-list">
              {levelDistribution.map((bucket) => (
                <li key={bucket.label} className="manager-bar-row">
                  <span className="manager-bar-label">{bucket.label}</span>
                  <span className="manager-bar-track" aria-hidden="true">
                    <span
                      className="manager-bar-fill is-subtle"
                      style={{ width: `${bucket.ratio * 100}%` }}
                    />
                  </span>
                  <span className="manager-bar-value">{bucket.count}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

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
