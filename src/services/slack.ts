/**
 * Slack Incoming Webhook delivery.
 *
 * The B2B Slack integration is deliberately client-only: the
 * organization owner pastes an Incoming Webhook URL into the admin
 * dashboard, the URL is stored on the `organizations/{orgId}` doc,
 * and every event hook POSTs to it directly from the originating
 * user's browser. Slack's webhook endpoint
 * (https://hooks.slack.com/services/…) accepts CORS POSTs from
 * arbitrary origins with `Content-Type: application/json`, so no
 * Cloud Function or backend proxy is required for this phase.
 *
 * Failures are intentionally swallowed (logged at info level): a
 * dropped Slack notification should never break the underlying user
 * action (room join, recruitment publish, etc.) — the in-app event
 * is the source of truth, Slack is an outbound mirror.
 */

import { translate } from "../i18n/LanguageContext";
import type { Language } from "../i18n/translations";

const WEBHOOK_HOST_ALLOWLIST = ["hooks.slack.com"];

export type SlackEventPayload = {
  text: string;
  /* Optional block-kit blocks for richer rendering. The minimal MVP
     only uses `text`, but the field is part of the type so future
     callers can pass through structured messages. */
  blocks?: unknown[];
};

/* Format-validate a Slack webhook URL before we attempt a POST. This
   blocks accidental SSRF-style misuse (someone pasting a random
   internal URL into the org settings field) and prevents the org
   from being weaponised as an outbound proxy. */
export function isValidSlackWebhookUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!WEBHOOK_HOST_ALLOWLIST.includes(parsed.host)) return false;
    if (!parsed.pathname.startsWith("/services/")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function postToSlackWebhook(
  webhookUrl: string,
  payload: SlackEventPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return { ok: false, error: "INVALID_WEBHOOK_URL" };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      // Slack returns 200 + "ok" on success; non-2xx means the
      // webhook was deleted, the channel is gone, the workspace
      // disabled it, etc. Surface for the admin's "test send" path.
      return { ok: false, error: `HTTP_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "FETCH_FAILED",
    };
  }
}

/* =================================================================
   Block Kit message builders — Phase 9.

   Slack accepts a structured `blocks` array alongside the fallback
   `text` field. Blocks render with proper hierarchy (heading row,
   body, context strip) and are clickable in mobile/desktop Slack
   without truncation, which raw text is not. Every helper here
   returns the SlackEventPayload shape so callers can pass directly
   to postToSlackWebhook().

   The fallback `text` is always populated — Slack still uses it for
   notification previews, screen readers, and any client that
   doesn't support Block Kit (older Slack clients, some 3rd party
   integrations).
   ================================================================= */

type ActorMeta = {
  name: string;
  /* Optional human-readable line shown in the context strip below
     the main message. Examples: "Lv 12 · ストリーク 5日". */
  meta?: string;
  /* Optional emoji prefix for the heading line (':wave:', ':bookmark:'). */
  emoji?: string;
};

function contextElements(meta?: string) {
  if (!meta) return undefined;
  return [
    {
      type: "mrkdwn",
      text: meta,
    },
  ];
}

export function buildRoomJoinBlocks(
  actor: ActorMeta,
  roomName: string,
  task: string,
  language: Language = "ja",
): SlackEventPayload {
  const fallback = `${actor.emoji || ":wave:"} ${translate(language, "*{name}* が *{room}* に入室（{task}）", { name: actor.name, room: roomName, task })}`;
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: fallback },
      },
      ...(actor.meta
        ? [
            {
              type: "context",
              elements: contextElements(actor.meta),
            },
          ]
        : []),
    ],
  };
}

export function buildRoomLeaveBlocks(
  actor: ActorMeta,
  roomName: string,
  stayLabel: string,
  language: Language = "ja",
): SlackEventPayload {
  const fallback = `${actor.emoji || ":door:"} ${translate(language, "*{name}* が *{room}* を退室（滞在 {stay}）", { name: actor.name, room: roomName, stay: stayLabel })}`;
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: fallback },
      },
      ...(actor.meta
        ? [
            {
              type: "context",
              elements: contextElements(actor.meta),
            },
          ]
        : []),
    ],
  };
}

export function buildBreakStartedBlocks(
  actor: ActorMeta,
  roomName: string,
  language: Language = "ja",
): SlackEventPayload {
  const fallback = `${actor.emoji || ":coffee:"} ${translate(language, "*{name}* が *{room}* で休憩中", { name: actor.name, room: roomName })}`;
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: fallback },
      },
    ],
  };
}

export function buildRecruitmentBlocks(
  actor: ActorMeta,
  roomName: string,
  task: string,
  duration: number,
  startAtLabel: string,
  message: string,
  language: Language = "ja",
): SlackEventPayload {
  const fallback = `${actor.emoji || ":loudspeaker:"} ${translate(language, "*{name}* が *{room}* で募集中（{task}・{duration}分・開始 {start}）", { name: actor.name, room: roomName, task, duration, start: startAtLabel })}`;
  const sections: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: { type: "mrkdwn", text: fallback },
    },
  ];
  if (message) {
    sections.push({
      type: "section",
      text: { type: "mrkdwn", text: `> ${message}` },
    });
  }
  if (actor.meta) {
    sections.push({
      type: "context",
      elements: contextElements(actor.meta),
    });
  }
  return { text: fallback, blocks: sections };
}

export function buildPostBlocks(
  actor: ActorMeta,
  postText: string,
  language: Language = "ja",
): SlackEventPayload {
  // Truncate the post body so a 280-char wall doesn't take over the
  // Slack channel — anyone interested can click through to the app.
  const truncated = postText.length > 140 ? `${postText.slice(0, 140)}…` : postText;
  const fallback = `${actor.emoji || ":memo:"} ${translate(language, "*{name}* が記録を投稿しました", { name: actor.name })}`;
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: fallback },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `> ${truncated.replace(/\n/g, "\n> ")}` },
      },
      ...(actor.meta
        ? [
            {
              type: "context",
              elements: contextElements(actor.meta),
            },
          ]
        : []),
    ],
  };
}

export function buildDailyDigestBlocks(
  orgName: string,
  metrics: {
    memberCount: number;
    totalEffort: number;
    totalOutput: number;
    totalContributions: number;
  },
  topMembers: Array<{ name: string; effort: number; streak: number }>,
  language: Language = "ja",
): SlackEventPayload {
  const headline = `:bar_chart: ${translate(language, "*{org}* の日次サマリー", { org: orgName })}`;
  const summaryLine = translate(
    language,
    "メンバー *{members}* 人 · Effort *{effort}* · Output *{output}* · Contributions *{contributions}*",
    {
      members: metrics.memberCount,
      effort: metrics.totalEffort.toLocaleString(),
      output: metrics.totalOutput.toLocaleString(),
      contributions: metrics.totalContributions.toLocaleString(),
    },
  );
  const rankingLines = topMembers
    .slice(0, 5)
    .map((m, idx) =>
      translate(language, "{rank}. *{name}* — Effort {effort} / {streak}日連続", {
        rank: idx + 1,
        name: m.name,
        effort: m.effort.toLocaleString(),
        streak: m.streak,
      }),
    )
    .join("\n");
  const emptyLine = `_${translate(language, "今日はまだ活動がありません。")}_`;
  const fallback = `${headline}\n${summaryLine}`;
  return {
    text: fallback,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: headline },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summaryLine },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: rankingLines || emptyLine,
        },
      },
    ],
  };
}
