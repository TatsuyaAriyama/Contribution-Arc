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
