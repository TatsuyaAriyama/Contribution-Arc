/**
 * Cloud Function: feedback コレクションへの新規書き込みを Slack に転送。
 *
 * 設計:
 *   - 要望は client (App.tsx) が Firestore `feedback/{auto-id}` に書く
 *   - この Function が onDocumentCreated で発火し、Slack Incoming Webhook
 *     に POST する。Webhook URL は **secret** として保管 (バンドルに混ぜない)
 *   - Slack POST が失敗しても feedback の Firestore 保存自体は成功して
 *     いるので、ユーザー体験には影響しない (warn ログを残すだけ)
 *
 * 必要な設定 (運営側で 1 度だけ):
 *   1. Slack Workspace で Incoming Webhook を作成
 *      → https://api.slack.com/messaging/webhooks
 *   2. webhook URL を secret として登録:
 *      $ firebase functions:secrets:set FEEDBACK_SLACK_WEBHOOK_URL
 *      (対話プロンプトで貼り付け)
 *   3. デプロイ:
 *      $ firebase deploy --only functions:notifyFeedbackToSlack
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

const FEEDBACK_SLACK_WEBHOOK_URL = defineSecret("FEEDBACK_SLACK_WEBHOOK_URL");

type FeedbackDoc = {
  uid?: string;
  userId?: string;
  displayName?: string;
  text?: string;
  userAgent?: string;
  createdAt?: string;
  status?: string;
};

function escapeMrkdwn(text: string): string {
  // Slack mrkdwn は &, <, > のエスケープが必要。
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const notifyFeedbackToSlack = onDocumentCreated(
  {
    document: "feedback/{feedbackId}",
    region: "us-central1",
    secrets: [FEEDBACK_SLACK_WEBHOOK_URL],
  },
  async (event) => {
    const webhookUrl = FEEDBACK_SLACK_WEBHOOK_URL.value();
    if (!webhookUrl) {
      logger.warn("FEEDBACK_SLACK_WEBHOOK_URL is not set — skipping Slack notify.");
      return;
    }

    const data = event.data?.data() as FeedbackDoc | undefined;
    if (!data) {
      logger.info("Feedback doc has no data; skipping.");
      return;
    }

    const text = (data.text || "").slice(0, 2000);
    const sender = data.displayName || data.userId || data.uid || "(unknown)";
    const handle = data.userId ? `@${data.userId}` : "";
    const ua = (data.userAgent || "").slice(0, 200);
    const created = data.createdAt || new Date().toISOString();

    const headline = `:envelope: 新しい要望が届きました — *${escapeMrkdwn(sender)}* ${escapeMrkdwn(handle)}`.trim();
    const body = `> ${escapeMrkdwn(text).replace(/\n/g, "\n> ")}`;
    const contextLine = [
      data.uid ? `uid: \`${data.uid}\`` : "",
      ua ? `UA: ${escapeMrkdwn(ua)}` : "",
      `at ${created}`,
    ]
      .filter(Boolean)
      .join("  ·  ");

    const payload = {
      text: `新しい要望: ${sender} — ${text.slice(0, 120)}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: headline } },
        { type: "section", text: { type: "mrkdwn", text: body } },
        { type: "context", elements: [{ type: "mrkdwn", text: contextLine }] },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        logger.warn("Slack webhook returned non-OK", {
          status: response.status,
          feedbackId: event.params.feedbackId,
        });
        return;
      }
      logger.info("Notified Slack of new feedback", {
        feedbackId: event.params.feedbackId,
      });
    } catch (error) {
      logger.warn("Failed to POST to Slack webhook", {
        error: error instanceof Error ? error.message : String(error),
        feedbackId: event.params.feedbackId,
      });
    }
  },
);
