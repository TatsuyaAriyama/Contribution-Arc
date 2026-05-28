/**
 * Team weekly digest builder.
 *
 * Renders a Slack-mrkdwn formatted summary of a team's current
 * learning state, suitable for posting via the existing Slack
 * Incoming Webhook integration. Kept as a pure function so the same
 * builder can later be invoked from a scheduled Cloud Function — the
 * MVP just calls it on a button click from the Manager Dashboard.
 *
 * Design register matches the rest of the app: no decorative emoji,
 * minimal punctuation, the numbers speak for themselves. Manager
 * sees "投資の可視化" — not a leaderboard.
 */

import type { OrganizationMemberRecord } from "./cloudData";
import type { SlackEventPayload } from "./slack";

export type WeeklyDigestInput = {
  organizationName: string;
  members: OrganizationMemberRecord[];
  /** Date the digest is being generated for. Defaults to now. */
  generatedAt?: Date;
  /** How many top contributors to list. Default 5 — keeps the Slack
   *  message readable on mobile without scrolling. */
  topN?: number;
};

/** Pad a number with leading zero for date formatting. */
function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Format a Date as YYYY-MM-DD in local time. We deliberately avoid
 *  toISOString() — that converts to UTC, which would label a digest
 *  generated at 22:00 JST as the next day in some viewers' timezones. */
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function buildWeeklyDigestText(input: WeeklyDigestInput): string {
  const { organizationName, members } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const topN = input.topN ?? 5;

  const totalMembers = members.length;
  const totalMinutes = members.reduce((sum, m) => sum + (m.effortExp || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);
  const avgHours = totalMembers > 0 ? Math.round(totalMinutes / totalMembers / 60) : 0;
  const activeCount = members.filter((m) => (m.streak || 0) > 0).length;
  const activeRate = totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0;

  const top = [...members]
    .sort((a, b) => (b.effortExp || 0) - (a.effortExp || 0))
    .slice(0, topN)
    .filter((m) => (m.effortExp || 0) > 0);

  const lines: string[] = [];
  lines.push(`*Contribution Arc — ${organizationName} 学習サマリー*`);
  lines.push(`_${formatDate(generatedAt)} 時点_`);
  lines.push("");
  lines.push(`• チーム総学習時間: *${totalHours}h*`);
  lines.push(`• 稼働中メンバー: *${activeCount}/${totalMembers}* 名 (${activeRate}%)`);
  lines.push(`• 平均/人: *${avgHours}h*`);

  if (top.length > 0) {
    lines.push("");
    lines.push("*メンバー別 学習時間 (累計上位)*");
    for (const member of top) {
      const hours = Math.round((member.effortExp || 0) / 60);
      lines.push(`• ${member.displayName} — ${hours}h`);
    }
  }

  return lines.join("\n");
}

/** Convenience wrapper that returns a Slack-ready payload object so
 *  the caller doesn't need to know about block-kit / payload shape. */
export function buildWeeklyDigestPayload(input: WeeklyDigestInput): SlackEventPayload {
  return { text: buildWeeklyDigestText(input) };
}
