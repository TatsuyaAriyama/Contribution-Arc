import { useEffect, useMemo, useState } from "react";
import type {
  OrganizationMemberRecord,
  OrgStudyLogRecord,
  StudyLogRecord,
} from "../services/cloudData";

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
  /** Callback when a member is clicked. Optional — the dashboard now
   *  opens its own detail panel; kept for parent-side hooks. */
  onMemberSelect?: (member: OrganizationMemberRecord) => void;
  /** Fetch every org member's study logs since an ISO timestamp, for
   *  team-wide aggregation. Org-scoped + windowed in the data layer.
   *  Absent → the team-insight section is hidden. */
  onFetchOrgLogs?: (sinceIso: string) => Promise<OrgStudyLogRecord[]>;
  /** Fetch one member's recent study logs for the drill-down panel.
   *  Absent → the panel shows only the snapshot stats. */
  onFetchMemberLogs?: (memberUid: string) => Promise<StudyLogRecord[]>;
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

/* ── Time-series aggregation (used by team insights + member panel) ──
   All pure functions over the minimal log shape the data layer returns.
   The personal app has its own getContributionArc; we keep a compact,
   dependency-free version here so the dashboard component stays
   self-contained and Firestore-free. */
type LogLike = { subject: string; minutes: number; createdAt: string; color?: string };

const WEEK_MS = 7 * DAY_MS;

/** Local-time YYYY-MM-DD key (never UTC — a 23:00 JST log must land on
 *  its own calendar day, matching teamDigest's reasoning). */
function localDayKey(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
}

/** Minutes summed into `weeks` rolling 7-day buckets, oldest→newest.
 *  Bucket index 0 (returned last) is the current week. */
function weeklyTrend(logs: LogLike[], weeks: number, now: number): number[] {
  const buckets = new Array<number>(weeks).fill(0);
  for (const log of logs) {
    const t = Date.parse(log.createdAt);
    if (Number.isNaN(t)) continue;
    const idx = Math.floor((now - t) / WEEK_MS);
    if (idx >= 0 && idx < weeks) buckets[weeks - 1 - idx] += log.minutes;
  }
  return buckets;
}

type HeatCell = { key: string; minutes: number };

/** Daily minute totals for the last `days` days, oldest→today. */
function dailyHeatmap(logs: LogLike[], days: number, now: number): HeatCell[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const t = Date.parse(log.createdAt);
    if (Number.isNaN(t)) continue;
    const key = localDayKey(new Date(t));
    map.set(key, (map.get(key) || 0) + log.minutes);
  }
  const cells: HeatCell[] = [];
  const today = new Date(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDayKey(d);
    cells.push({ key, minutes: map.get(key) || 0 });
  }
  return cells;
}

/** Map daily minutes to a 0–4 intensity tier for the heatmap palette. */
function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

type SubjectRow = { subject: string; color: string; minutes: number; pct: number };

/** Minutes grouped by subject, sorted desc, top `topN` kept. Carries the
 *  log's own color so the breakdown matches the learner's palette without
 *  the dashboard needing access to their learningItems. */
function subjectBreakdown(
  logs: LogLike[],
  topN: number,
): { rows: SubjectRow[]; otherCount: number; otherMinutes: number } {
  const map = new Map<string, { subject: string; color: string; minutes: number }>();
  for (const log of logs) {
    const subject = log.subject || "その他";
    const cur = map.get(subject) || { subject, color: log.color || "", minutes: 0 };
    cur.minutes += log.minutes;
    if (!cur.color && log.color) cur.color = log.color;
    map.set(subject, cur);
  }
  const all = Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  const total = all.reduce((s, x) => s + x.minutes, 0) || 1;
  const top = all.slice(0, topN);
  const rest = all.slice(topN);
  return {
    rows: top.map((x) => ({ ...x, pct: x.minutes / total })),
    otherCount: rest.length,
    otherMinutes: rest.reduce((s, x) => s + x.minutes, 0),
  };
}

/** Compact "Nh Mm" / "Mm" label from minutes. */
function formatMinutesJa(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0 && rem > 0) return `${h}h ${rem}m`;
  if (h > 0) return `${h}h`;
  return `${rem}m`;
}

/** Short month/day label for a log timestamp. */
function shortDateJa(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type SortKey = "effort" | "recent" | "level" | "output";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "effort", label: "学習時間が多い順" },
  { key: "recent", label: "最近アクティブな順" },
  { key: "level", label: "レベルが高い順" },
  { key: "output", label: "アウトプットが多い順" },
];

/* How far back the team-insight window reaches. 12 weeks ≈ a quarter —
   long enough to show a trend, short enough to keep the windowed read
   bounded. Logs predating the org-stamping rollout won't appear (they
   carry no organizationId), so the trend fills in over time. */
const TEAM_WINDOW_WEEKS = 12;
const TEAM_WINDOW_DAYS = TEAM_WINDOW_WEEKS * 7;

export function ManagerDashboard({
  teamMembers,
  currentUser,
  organizationName,
  hasSlackWebhook,
  onSendSlackDigest,
  onMemberSelect,
  onFetchOrgLogs,
  onFetchMemberLogs,
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

  /* Team-wide insights, fetched once via a single windowed org-scoped
     query. State machine drives the section's loading / error / empty UI. */
  const [orgLogs, setOrgLogs] = useState<OrgStudyLogRecord[] | null>(null);
  const [orgLogsState, setOrgLogsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberRecord | null>(null);

  useEffect(() => {
    if (!onFetchOrgLogs) return;
    let cancelled = false;
    setOrgLogsState("loading");
    const sinceIso = new Date(now - TEAM_WINDOW_DAYS * DAY_MS).toISOString();
    onFetchOrgLogs(sinceIso)
      .then((logs) => {
        if (cancelled) return;
        setOrgLogs(logs);
        setOrgLogsState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setOrgLogsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [onFetchOrgLogs, now]);

  const openMember = (member: OrganizationMemberRecord) => {
    setSelectedMember(member);
    onMemberSelect?.(member);
  };

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

  /* Team-wide insights derived from the windowed org logs: weekly
     learning trend, the skills the team is actually investing in, and
     a window summary (total hours + distinct contributors). This is the
     "what is my team learning, and is momentum building?" view a paying
     manager wants — not derivable from the per-member snapshot alone. */
  const teamInsights = useMemo(() => {
    if (!orgLogs) return null;
    const trend = weeklyTrend(orgLogs, TEAM_WINDOW_WEEKS, now);
    const maxWeek = Math.max(1, ...trend);
    const windowMinutes = trend.reduce((s, v) => s + v, 0);
    const thisWeek = trend[trend.length - 1] || 0;
    const lastWeek = trend[trend.length - 2] || 0;
    const contributors = new Set(orgLogs.map((l) => l.userId)).size;
    const { rows, otherCount, otherMinutes } = subjectBreakdown(orgLogs, 6);
    return {
      trend: trend.map((minutes, i) => ({
        minutes,
        ratio: minutes / maxWeek,
        // Weeks-ago label: rightmost bar = 今週.
        weeksAgo: TEAM_WINDOW_WEEKS - 1 - i,
      })),
      windowHours: Math.round(windowMinutes / 60),
      thisWeekHours: Math.round(thisWeek / 60),
      lastWeekHours: Math.round(lastWeek / 60),
      deltaPct:
        lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0,
      contributors,
      subjects: rows,
      otherCount,
      otherMinutes,
      isEmpty: windowMinutes === 0,
    };
  }, [orgLogs, now]);

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

      {/* Team-wide insights — weekly trend + skill mix over the window.
          Only rendered when the parent wired the org-log fetcher. */}
      {onFetchOrgLogs && teamMembers.length > 0 ? (
        <section className="manager-insights">
          <header className="manager-insights-head">
            <div>
              <h3 className="manager-chart-title">チームの学習トレンド</h3>
              <p className="manager-chart-sublabel">直近 {TEAM_WINDOW_WEEKS} 週間</p>
            </div>
            {teamInsights && !teamInsights.isEmpty ? (
              <div className="manager-insights-summary">
                <span className="manager-insights-total">
                  {teamInsights.windowHours}
                  <span className="manager-stat-unit">h</span>
                </span>
                <span className="manager-insights-meta">
                  {teamInsights.contributors} 名が記録
                </span>
              </div>
            ) : null}
          </header>

          {orgLogsState === "loading" ? (
            <p className="manager-insights-state">読み込み中…</p>
          ) : orgLogsState === "error" ? (
            <p className="manager-insights-state">トレンドを読み込めませんでした。</p>
          ) : teamInsights && teamInsights.isEmpty ? (
            <p className="manager-insights-state">
              この期間の学習記録はまだありません。メンバーが学習を記録すると、ここに週ごとの推移が表示されます。
            </p>
          ) : teamInsights ? (
            <div className="manager-insights-body">
              <div className="manager-trend">
                <div className="manager-trend-bars" role="img" aria-label="週ごとのチーム学習時間の推移">
                  {teamInsights.trend.map((w, i) => (
                    <span
                      key={i}
                      className={`manager-trend-bar${w.weeksAgo === 0 ? " is-current" : ""}`}
                      style={{ height: `${Math.max(w.ratio * 100, 3)}%` }}
                      title={`${w.weeksAgo === 0 ? "今週" : `${w.weeksAgo}週前`} ・ ${formatMinutesJa(w.minutes)}`}
                    />
                  ))}
                </div>
                <div className="manager-trend-foot">
                  <span>{TEAM_WINDOW_WEEKS}週前</span>
                  <span className="manager-trend-now">
                    今週 {teamInsights.thisWeekHours}h
                    {teamInsights.deltaPct !== 0 ? (
                      <span
                        className={`manager-trend-delta${teamInsights.deltaPct >= 0 ? " is-up" : " is-down"}`}
                      >
                        {teamInsights.deltaPct >= 0 ? "▲" : "▼"}
                        {Math.abs(teamInsights.deltaPct)}%
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>

              <div className="manager-skills">
                <h4 className="manager-skills-title">学習トピック</h4>
                {teamInsights.subjects.length === 0 ? (
                  <p className="manager-insights-state">トピックの記録がありません。</p>
                ) : (
                  <ul className="manager-skills-list">
                    {teamInsights.subjects.map((s) => (
                      <li key={s.subject} className="manager-skill-row">
                        <span className="manager-skill-name" title={s.subject}>
                          <span
                            className="manager-skill-dot"
                            style={{ background: s.color || "var(--green, #1f6f4a)" }}
                            aria-hidden="true"
                          />
                          {s.subject}
                        </span>
                        <span className="manager-bar-track" aria-hidden="true">
                          <span
                            className="manager-bar-fill"
                            style={{
                              width: `${Math.max(s.pct * 100, 2)}%`,
                              background: s.color || undefined,
                            }}
                          />
                        </span>
                        <span className="manager-skill-value">{formatMinutesJa(s.minutes)}</span>
                      </li>
                    ))}
                    {teamInsights.otherCount > 0 ? (
                      <li className="manager-skill-row is-other">
                        <span className="manager-skill-name">他 {teamInsights.otherCount} トピック</span>
                        <span className="manager-bar-track" aria-hidden="true" />
                        <span className="manager-skill-value">
                          {formatMinutesJa(teamInsights.otherMinutes)}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

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
                    onClick={() => openMember(f.member)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openMember(f.member);
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
                  onClick={() => openMember(member)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openMember(member);
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

      {selectedMember ? (
        <MemberDetailPanel
          member={selectedMember}
          isYou={!!currentUser.uid && currentUser.uid === selectedMember.uid}
          onClose={() => setSelectedMember(null)}
          onFetchMemberLogs={onFetchMemberLogs}
        />
      ) : null}
    </div>
  );
}

/* ── Per-member drill-down ─────────────────────────────────────────
   Opened when the manager clicks a member. Fetches that member's recent
   logs (org-scoped) and renders a 13-week contribution heatmap, an
   8-week trend, the subjects they're investing in, and recent sessions —
   turning the flat roster row into something a manager can act on in a
   1:1. Falls back to the snapshot stats when no fetcher is wired or the
   member has no stamped logs yet. */
const MEMBER_HEATMAP_DAYS = 91; // 13 weeks
const MEMBER_TREND_WEEKS = 8;

function MemberDetailPanel({
  member,
  isYou,
  onClose,
  onFetchMemberLogs,
}: {
  member: OrganizationMemberRecord;
  isYou: boolean;
  onClose: () => void;
  onFetchMemberLogs?: (memberUid: string) => Promise<StudyLogRecord[]>;
}) {
  const [logs, setLogs] = useState<StudyLogRecord[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const now = useMemo(() => Date.now(), []);

  // Close on Escape — expected behavior for an overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!onFetchMemberLogs) return;
    let cancelled = false;
    setState("loading");
    onFetchMemberLogs(member.uid)
      .then((fetched) => {
        if (cancelled) return;
        setLogs(fetched);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [member.uid, onFetchMemberLogs]);

  const derived = useMemo(() => {
    if (!logs) return null;
    const heatmap = dailyHeatmap(logs, MEMBER_HEATMAP_DAYS, now);
    const trend = weeklyTrend(logs, MEMBER_TREND_WEEKS, now);
    const maxWeek = Math.max(1, ...trend);
    const { rows, otherCount } = subjectBreakdown(logs, 5);
    const windowMinutes = heatmap.reduce((s, c) => s + c.minutes, 0);
    const activeDays = heatmap.filter((c) => c.minutes > 0).length;
    const recent = [...logs]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 8);
    return {
      heatmap,
      trend: trend.map((minutes) => ({ minutes, ratio: minutes / maxWeek })),
      subjects: rows,
      otherCount,
      windowHours: Math.round(windowMinutes / 60),
      activeDays,
      thisWeekHours: Math.round((trend[trend.length - 1] || 0) / 60),
      recent,
      hasData: windowMinutes > 0,
    };
  }, [logs, now]);

  const snapshotHours = Math.round((member.effortExp || 0) / 60);

  return (
    <div
      className="manager-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${member.displayName} の学習詳細`}
      onClick={onClose}
    >
      <div className="manager-detail-panel" onClick={(e) => e.stopPropagation()}>
        <header className="manager-detail-head">
          <div className="manager-detail-identity">
            <div className="manager-detail-avatar">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.displayName} />
              ) : (
                <span>{member.displayName.charAt(0)}</span>
              )}
            </div>
            <div>
              <strong className="manager-detail-name">
                {member.displayName}
                {isYou ? <span className="manager-you-badge">あなた</span> : null}
              </strong>
              <small className="manager-detail-id">@{member.userId}</small>
            </div>
          </div>
          <button
            type="button"
            className="manager-detail-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div className="manager-detail-kpis">
          <div className="manager-detail-kpi">
            <span className="manager-detail-kpi-label">累計学習</span>
            <strong>{snapshotHours}h</strong>
          </div>
          <div className="manager-detail-kpi">
            <span className="manager-detail-kpi-label">レベル</span>
            <strong>{member.level || 1}</strong>
          </div>
          <div className="manager-detail-kpi">
            <span className="manager-detail-kpi-label">アウトプット</span>
            <strong>{(member.outputExp || 0).toLocaleString()}</strong>
          </div>
          <div className="manager-detail-kpi">
            <span className="manager-detail-kpi-label">最終同期</span>
            <strong>{relativeLabel(daysSince(member.lastSyncedAt, now))}</strong>
          </div>
        </div>

        {!onFetchMemberLogs ? (
          <p className="manager-insights-state">詳細データは利用できません。</p>
        ) : state === "loading" ? (
          <p className="manager-insights-state">読み込み中…</p>
        ) : state === "error" ? (
          <p className="manager-insights-state">学習記録を読み込めませんでした。</p>
        ) : derived && !derived.hasData ? (
          <p className="manager-insights-state">
            直近 13 週間の学習記録はまだありません。記録が増えると、ここに学習の推移が表示されます。
          </p>
        ) : derived ? (
          <div className="manager-detail-body">
            <section className="manager-detail-section">
              <header className="manager-detail-section-head">
                <h4>学習の記録</h4>
                <span className="manager-chart-sublabel">
                  直近 13 週間 ・ {derived.activeDays} 日活動 ・ {derived.windowHours}h
                </span>
              </header>
              <div className="manager-heatmap" role="img" aria-label="13週間の学習ヒートマップ">
                {derived.heatmap.map((cell) => (
                  <span
                    key={cell.key}
                    className={`manager-heat-cell is-l${heatLevel(cell.minutes)}`}
                    title={`${cell.key} ・ ${formatMinutesJa(cell.minutes)}`}
                  />
                ))}
              </div>
              <div className="manager-heat-legend">
                <span>少</span>
                <span className="manager-heat-cell is-l0" aria-hidden="true" />
                <span className="manager-heat-cell is-l1" aria-hidden="true" />
                <span className="manager-heat-cell is-l2" aria-hidden="true" />
                <span className="manager-heat-cell is-l3" aria-hidden="true" />
                <span className="manager-heat-cell is-l4" aria-hidden="true" />
                <span>多</span>
              </div>
            </section>

            <section className="manager-detail-section">
              <header className="manager-detail-section-head">
                <h4>週ごとの推移</h4>
                <span className="manager-chart-sublabel">直近 {MEMBER_TREND_WEEKS} 週間</span>
              </header>
              <div className="manager-trend-bars is-compact" role="img" aria-label="週ごとの学習時間">
                {derived.trend.map((w, i) => (
                  <span
                    key={i}
                    className={`manager-trend-bar${i === derived.trend.length - 1 ? " is-current" : ""}`}
                    style={{ height: `${Math.max(w.ratio * 100, 3)}%` }}
                    title={`${derived.trend.length - 1 - i === 0 ? "今週" : `${derived.trend.length - 1 - i}週前`} ・ ${formatMinutesJa(w.minutes)}`}
                  />
                ))}
              </div>
            </section>

            {derived.subjects.length > 0 ? (
              <section className="manager-detail-section">
                <header className="manager-detail-section-head">
                  <h4>学習トピック</h4>
                  {derived.otherCount > 0 ? (
                    <span className="manager-chart-sublabel">他 {derived.otherCount}</span>
                  ) : null}
                </header>
                <ul className="manager-skills-list">
                  {derived.subjects.map((s) => (
                    <li key={s.subject} className="manager-skill-row">
                      <span className="manager-skill-name" title={s.subject}>
                        <span
                          className="manager-skill-dot"
                          style={{ background: s.color || "var(--green, #1f6f4a)" }}
                          aria-hidden="true"
                        />
                        {s.subject}
                      </span>
                      <span className="manager-bar-track" aria-hidden="true">
                        <span
                          className="manager-bar-fill"
                          style={{ width: `${Math.max(s.pct * 100, 2)}%`, background: s.color || undefined }}
                        />
                      </span>
                      <span className="manager-skill-value">{formatMinutesJa(s.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {derived.recent.length > 0 ? (
              <section className="manager-detail-section">
                <header className="manager-detail-section-head">
                  <h4>最近の記録</h4>
                </header>
                <ul className="manager-detail-logs">
                  {derived.recent.map((log) => (
                    <li key={log.id} className="manager-detail-log">
                      <span className="manager-detail-log-date">{shortDateJa(log.createdAt)}</span>
                      <span className="manager-detail-log-subject" title={log.subject}>
                        <span
                          className="manager-skill-dot"
                          style={{ background: log.color || "var(--green, #1f6f4a)" }}
                          aria-hidden="true"
                        />
                        {log.subject}
                      </span>
                      <span className="manager-detail-log-minutes">{formatMinutesJa(log.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
