import { useMemo, useState } from "react";
import type { OrganizationMemberRecord } from "../services/cloudData";

export interface ManagerDashboardProps {
  /** All team members in the organization. */
  teamMembers: OrganizationMemberRecord[];
  /** Current logged-in user (the manager). Used to badge their own row. */
  currentUser: Partial<OrganizationMemberRecord>;
  /** Organization name — shown as the dashboard subtitle and used to
   *  label the CSV export file. */
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
    "チーム",
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
    csvCell(m.teamName || ""),
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

/* ── Engagement model ─────────────────────────────────────────────
   The single snapshot we get per member (listOrganizationMembers)
   carries `lastSyncedAt`, which is the most decision-useful signal a
   manager has: who is still showing up and who has gone quiet. We bucket
   it into three forgiving tiers tuned for a side-study cadence (weekly
   logging is healthy), so the dashboard surfaces "who to check in with"
   rather than ranking people. This is 投資の可視化, not a leaderboard. */
type ActivityStatus = "active" | "slowing" | "dormant";

const ACTIVITY_META: Record<ActivityStatus, { label: string }> = {
  active: { label: "アクティブ" },
  slowing: { label: "停滞ぎみ" },
  dormant: { label: "休眠" },
};

const DAY_MS = 86_400_000;

/** Whole days elapsed since an ISO timestamp, or null if missing/invalid. */
function daysSince(iso: string, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

/** active ≤7d · slowing 8–14d · dormant >14d or never synced. */
function activityStatusFor(days: number | null): ActivityStatus {
  if (days === null || days > 14) return "dormant";
  if (days <= 7) return "active";
  return "slowing";
}

/** Compact relative label for a member's last sync. */
function relativeLabel(days: number | null): string {
  if (days === null) return "未同期";
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}

const roleLabel = (role: OrganizationMemberRecord["organizationRole"]): string =>
  role === "owner" ? "オーナー" : role === "admin" ? "管理者" : "メンバー";

type SortKey = "effort" | "recent" | "level" | "output";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "effort", label: "学習時間が多い順" },
  { key: "recent", label: "最近アクティブな順" },
  { key: "level", label: "レベルが高い順" },
  { key: "output", label: "アウトプットが多い順" },
];

export function ManagerDashboard({
  teamMembers,
  currentUser,
  organizationName,
  hasSlackWebhook,
  onSendSlackDigest,
  onMemberSelect,
}: ManagerDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  /* Team filter. Empty string means "all teams"; the sentinel
     "__unassigned__" surfaces members with no teamName set. Built from
     the observed teamName values so the dropdown reflects whatever the
     org owner has typed without needing a separate teams collection. */
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("effort");
  const [digestState, setDigestState] = useState<DigestSendState>("idle");
  const [digestMessage, setDigestMessage] = useState<string>("");

  // Frozen at mount — a dashboard session doesn't need live re-ticking,
  // and a stable `now` keeps the useMemos from recomputing every render.
  const now = useMemo(() => Date.now(), []);

  // Per-member derived fields (days since sync + activity tier),
  // computed once so the list, charts, and follow-up section agree.
  const enriched = useMemo(
    () =>
      teamMembers.map((m) => {
        const days = daysSince(m.lastSyncedAt, now);
        return {
          member: m,
          days,
          status: activityStatusFor(days),
          hours: Math.round((m.effortExp || 0) / 60),
        };
      }),
    [teamMembers, now],
  );

  /* Unique sorted set of team names found across members, excluding
     blanks. Used to populate the team filter dropdown. Sorted by
     locale so Japanese / English labels both land in expected order. */
  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    teamMembers.forEach((m) => {
      const name = (m.teamName || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [teamMembers]);

  const handleExportCsv = () => {
    if (teamMembers.length === 0) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // Sanitize the org name into a filename-safe slug. Keeps Japanese
    // letters readable (most OSes accept them now) but strips slashes /
    // quotes / control chars that break downloads.
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
        setTimeout(() => setDigestState("idle"), 3200);
      }
    } catch (err) {
      setDigestState("error");
      setDigestMessage(err instanceof Error ? err.message : "送信に失敗しました");
    }
  };

  // Team-wide statistics. "稼働率" = synced within the active window,
  // a far more honest engagement signal than streak>0 (which read 0%
  // even for a member with hours logged).
  const teamStats = useMemo(() => {
    const totalMembers = enriched.length;
    const totalMinutes = teamMembers.reduce((sum, m) => sum + (m.effortExp || 0), 0);
    const totalOutput = teamMembers.reduce((sum, m) => sum + (m.outputExp || 0), 0);
    const avgMinutes = totalMembers > 0 ? Math.round(totalMinutes / totalMembers) : 0;
    const activeCount = enriched.filter((e) => e.status === "active").length;
    return {
      totalMembers,
      totalHours: Math.round(totalMinutes / 60),
      avgHours: Math.round(avgMinutes / 60),
      totalOutput,
      activeCount,
      activeRate: totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0,
    };
  }, [enriched, teamMembers]);

  // Engagement segmentation for the team-health bar.
  const engagement = useMemo(() => {
    const counts: Record<ActivityStatus, number> = { active: 0, slowing: 0, dormant: 0 };
    enriched.forEach((e) => {
      counts[e.status] += 1;
    });
    const total = Math.max(1, enriched.length);
    return (["active", "slowing", "dormant"] as const).map((status) => ({
      status,
      count: counts[status],
      pct: Math.round((counts[status] / total) * 100),
    }));
  }, [enriched]);

  /* Follow-up list — supportive, not punitive. Surfaces members who
     have gone quiet (dormant) or have never logged time, so the manager
     can reach out before someone quietly drops off. Sorted by silence
     length (most-stale first); capped so the card stays scannable. */
  const followUps = useMemo(() => {
    return enriched
      .filter((e) => e.status === "dormant" || (e.member.effortExp || 0) === 0)
      .map((e) => ({
        uid: e.member.uid,
        member: e.member,
        days: e.days,
        reason:
          (e.member.effortExp || 0) === 0
            ? "まだ学習記録がありません"
            : `${relativeLabel(e.days)}から記録がありません`,
      }))
      .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
      .slice(0, 6);
  }, [enriched]);

  // Filter members by search query (name or userId) and team selection,
  // then sort by the chosen key.
  const visibleMembers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = enriched.filter((e) => {
      const m = e.member;
      const matchesQuery =
        m.displayName.toLowerCase().includes(query) ||
        m.userId.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (!teamFilter) return true;
      const name = (m.teamName || "").trim();
      if (teamFilter === "__unassigned__") return name === "";
      return name === teamFilter;
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "recent":
          // Smaller "days since sync" first; never-synced sinks to bottom.
          return (a.days ?? Infinity) - (b.days ?? Infinity);
        case "level":
          return (b.member.level || 0) - (a.member.level || 0);
        case "output":
          return (b.member.outputExp || 0) - (a.member.outputExp || 0);
        case "effort":
        default:
          return (b.member.effortExp || 0) - (a.member.effortExp || 0);
      }
    });
    return sorted;
  }, [enriched, searchQuery, teamFilter, sortKey]);

  /* Per-member effort bars — top 10 by hours, each bar a fraction of
     the team's top performer. Remainder shown as a count so a large
     team doesn't blow out the card. */
  const effortDistribution = useMemo(() => {
    const sorted = [...enriched].sort(
      (a, b) => (b.member.effortExp || 0) - (a.member.effortExp || 0),
    );
    const top = sorted.slice(0, 10);
    const max = top[0]?.member.effortExp || 0;
    return {
      top: top.map((e) => ({
        uid: e.member.uid,
        displayName: e.member.displayName,
        hours: e.hours,
        ratio: max > 0 ? Math.max((e.member.effortExp || 0) / max, 0.02) : 0,
      })),
      remainderCount: Math.max(0, sorted.length - top.length),
    };
  }, [enriched]);

  /* Level distribution — bucket members into wide ranges so the manager
     sees at a glance whether the team is mostly fresh or experienced. */
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

  /* Per-team rollup — only meaningful once the org has assigned members
     to more than one team. Gives multi-team orgs an apples-to-apples
     read on each squad's engagement and learning investment. */
  const teamBreakdown = useMemo(() => {
    if (teamOptions.length < 2) return [];
    const rows = teamOptions.map((name) => {
      const group = enriched.filter((e) => (e.member.teamName || "").trim() === name);
      const minutes = group.reduce((s, e) => s + (e.member.effortExp || 0), 0);
      const active = group.filter((e) => e.status === "active").length;
      return {
        name,
        members: group.length,
        hours: Math.round(minutes / 60),
        activeRate: group.length > 0 ? Math.round((active / group.length) * 100) : 0,
      };
    });
    const unassigned = enriched.filter((e) => !(e.member.teamName || "").trim());
    if (unassigned.length > 0) {
      const minutes = unassigned.reduce((s, e) => s + (e.member.effortExp || 0), 0);
      const active = unassigned.filter((e) => e.status === "active").length;
      rows.push({
        name: "未割り当て",
        members: unassigned.length,
        hours: Math.round(minutes / 60),
        activeRate: unassigned.length > 0 ? Math.round((active / unassigned.length) * 100) : 0,
      });
    }
    return rows;
  }, [teamOptions, enriched]);

  const maxTeamHours = useMemo(
    () => Math.max(1, ...teamBreakdown.map((t) => t.hours)),
    [teamBreakdown],
  );

  const soloOrg = teamStats.totalMembers <= 1;

  return (
    <div className="manager-dashboard">
      <section className="manager-header">
        <div className="manager-header-titles">
          <h2 className="manager-title">チーム学習ダッシュボード</h2>
          <p className="manager-subtitle">
            {organizationName || "あなたのチーム"} ・ {teamStats.totalMembers} 名
          </p>
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

      {/* Solo-org nudge: a one-person org has nothing to compare yet, so
          guide the owner to invite teammates rather than showing empty
          charts that read as "broken". */}
      {soloOrg ? (
        <section className="manager-invite-nudge">
          <strong>メンバーを招待すると、ここにチームの学習が集まります</strong>
          <p>
            設定の「招待リンク」からメンバーを追加すると、稼働状況・学習時間・
            フォローしたいメンバーが自動でまとまります。
          </p>
        </section>
      ) : null}

      {/* KPI row */}
      <section className="manager-stats-grid">
        <article className="manager-stat-card">
          <span className="manager-stat-label">メンバー数</span>
          <strong className="manager-stat-value">{teamStats.totalMembers}</strong>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">稼働率（7日以内）</span>
          <strong className="manager-stat-value">
            {teamStats.activeRate}
            <span className="manager-stat-unit">%</span>
          </strong>
          <span className="manager-stat-sub">{teamStats.activeCount} 名がアクティブ</span>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">総学習時間</span>
          <strong className="manager-stat-value">
            {teamStats.totalHours}
            <span className="manager-stat-unit">h</span>
          </strong>
          <span className="manager-stat-sub">平均 {teamStats.avgHours}h / 人</span>
        </article>
        <article className="manager-stat-card">
          <span className="manager-stat-label">総アウトプット</span>
          <strong className="manager-stat-value">
            {teamStats.totalOutput.toLocaleString()}
          </strong>
          <span className="manager-stat-sub">コミット・投稿 EXP</span>
        </article>
      </section>

      {/* Team-health engagement bar + follow-up list */}
      {teamMembers.length > 0 ? (
        <section className="manager-charts">
          <article className="manager-chart-card">
            <header className="manager-chart-head">
              <h3 className="manager-chart-title">チームの状態</h3>
              <p className="manager-chart-sublabel">最終同期から</p>
            </header>
            <div
              className="manager-engagement-bar"
              role="img"
              aria-label={engagement
                .map((s) => `${ACTIVITY_META[s.status].label} ${s.count}名`)
                .join("、")}
            >
              {engagement.map((seg) =>
                seg.count > 0 ? (
                  <span
                    key={seg.status}
                    className={`manager-engagement-seg is-${seg.status}`}
                    style={{ flexGrow: seg.count }}
                  />
                ) : null,
              )}
            </div>
            <ul className="manager-engagement-legend">
              {engagement.map((seg) => (
                <li key={seg.status}>
                  <span className={`manager-status-dot is-${seg.status}`} aria-hidden="true" />
                  {ACTIVITY_META[seg.status].label}
                  <strong>{seg.count}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="manager-chart-card">
            <header className="manager-chart-head">
              <h3 className="manager-chart-title">フォローしたいメンバー</h3>
              <p className="manager-chart-sublabel">{followUps.length} 名</p>
            </header>
            {followUps.length === 0 ? (
              <p className="manager-followup-empty">
                全員が直近で記録しています。良いペースです。
              </p>
            ) : (
              <ul className="manager-followup-list">
                {followUps.map((f) => (
                  <li
                    key={f.uid}
                    className="manager-followup-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onMemberSelect?.(f.member)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onMemberSelect?.(f.member);
                    }}
                  >
                    <span className="manager-followup-name">{f.member.displayName}</span>
                    <span className="manager-followup-reason">{f.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : null}

      {/* Distribution charts */}
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
              <p className="manager-chart-foot">他 {effortDistribution.remainderCount} 名</p>
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

      {/* Per-team rollup (multi-team orgs only) */}
      {teamBreakdown.length > 0 ? (
        <section className="manager-chart-card manager-team-rollup">
          <header className="manager-chart-head">
            <h3 className="manager-chart-title">チーム別</h3>
            <p className="manager-chart-sublabel">学習時間 / 稼働率</p>
          </header>
          <ul className="manager-team-list">
            {teamBreakdown.map((row) => (
              <li key={row.name} className="manager-team-row">
                <span className="manager-team-name" title={row.name}>
                  {row.name}
                </span>
                <span className="manager-team-meta">{row.members} 名</span>
                <span className="manager-bar-track" aria-hidden="true">
                  <span
                    className="manager-bar-fill"
                    style={{ width: `${(row.hours / maxTeamHours) * 100}%` }}
                  />
                </span>
                <span className="manager-team-hours">{row.hours}h</span>
                <span className="manager-team-rate">稼働 {row.activeRate}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Controls */}
      <section className="manager-controls">
        <input
          type="text"
          className="manager-search"
          placeholder="メンバーを検索（名前またはID）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="メンバー検索"
        />
        <select
          className="manager-team-filter"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="並び替え"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        {teamOptions.length > 0 ? (
          <select
            className="manager-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            aria-label="チームで絞り込む"
          >
            <option value="">すべてのチーム</option>
            {teamOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__unassigned__">未割り当て</option>
          </select>
        ) : null}
      </section>

      {/* Members list */}
      <section className="manager-members-section">
        <h3 className="manager-members-title">メンバー一覧 ({visibleMembers.length})</h3>

        {visibleMembers.length === 0 ? (
          <div className="manager-empty">
            <p>該当するメンバーがありません</p>
          </div>
        ) : (
          <div className="manager-members-list">
            {visibleMembers.map((row) => {
              const member = row.member;
              const isYou = !!currentUser.uid && currentUser.uid === member.uid;
              return (
                <article
                  key={member.uid}
                  className="manager-member-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onMemberSelect?.(member)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onMemberSelect?.(member);
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
                    <strong className="manager-member-name">
                      {member.displayName}
                      {isYou ? <span className="manager-you-badge">あなた</span> : null}
                      {member.organizationRole !== "member" ? (
                        <span className="manager-role-badge">
                          {roleLabel(member.organizationRole)}
                        </span>
                      ) : null}
                    </strong>
                    <small className="manager-member-id">@{member.userId}</small>
                    <span className="manager-member-meta-row">
                      <span className={`manager-status-dot is-${row.status}`} aria-hidden="true" />
                      <span className="manager-member-last">{relativeLabel(row.days)}</span>
                      {member.teamName ? (
                        <span className="manager-member-team">{member.teamName}</span>
                      ) : null}
                    </span>
                  </div>

                  <div className="manager-member-stats">
                    <div className="manager-member-stat">
                      <span className="manager-member-stat-label">学習時間</span>
                      <strong>{row.hours}h</strong>
                    </div>
                    <div className="manager-member-stat">
                      <span className="manager-member-stat-label">アウトプット</span>
                      <strong>{(member.outputExp || 0).toLocaleString()}</strong>
                    </div>
                    <div className="manager-member-stat">
                      <span className="manager-member-stat-label">レベル</span>
                      <strong>{member.level || 1}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
