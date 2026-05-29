/**
 * Stripe 課金のクライアント側エントリポイント。
 *
 * 設計（重要・セキュリティ）:
 *   - シークレットキー(`sk_...`)・price ID の検証・サブスク状態の更新は
 *     すべてサーバ(Cloud Functions / functions/src/stripeBilling.ts)側で行う。
 *     クライアントは「Checkout/Portal の URL を作って」とサーバに頼み、
 *     返ってきた URL に遷移するだけ。決済情報には一切触れない。
 *   - 認証は Firebase callable functions が ID トークンを自動付与するので、
 *     URL に機密情報を載せる必要がない(POST body 相当で安全)。
 *   - planTier の更新は Stripe webhook → サーバ が行う。クライアントは
 *     organizations ドキュメントの planTier を read-only として扱う。
 *
 * 運用に必要なサーバ側設定(キーはここではなくサーバに置く):
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   # price ID は functions/src/stripeBilling.ts の params で設定
 *
 * サーバ関数が未デプロイの間は `not-found` で失敗するので、UI 側は
 * `isBillingConfigured()` を見て課金ボタンを出すかどうか切り替える。
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { PlanTier } from "./plans";

/**
 * 課金フローが利用可能か(= サーバ関数がデプロイされ、price が設定済みか)。
 * β期間中や Stripe 未設定の間は false にして「お問い合わせ」CTA に倒す。
 *
 * クライアントからはサーバの設定状況を確実には知れないので、ビルド時の
 * 環境変数 `VITE_BILLING_ENABLED` を明示フラグとして使う。未設定 = 無効。
 */
export function isBillingConfigured(): boolean {
  return import.meta.env.VITE_BILLING_ENABLED === "true";
}

export type CheckoutResult = { url: string };
export type PortalResult = { url: string };

type CreateCheckoutInput = {
  orgId: string;
  /** "team" | "enterprise"。free は課金不要なので渡さない。 */
  tier: Exclude<PlanTier, "free">;
  /** 課金対象シート数(メンバー数)。1 以上。 */
  seats: number;
};

/**
 * Stripe Checkout セッションを作り、その URL を返す。
 * 呼び出し側は返り値の url に `window.location.assign` で遷移する。
 * （遷移はユーザーの明示操作=ボタン押下の延長で行うこと。）
 */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult> {
  const fn = httpsCallable<CreateCheckoutInput, CheckoutResult>(functions, "createCheckoutSession");
  const res = await fn(input);
  const url = res.data?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Checkout URL を取得できませんでした。");
  }
  return { url };
}

type CreatePortalInput = { orgId: string };

/**
 * Stripe Billing Portal(請求情報・プラン変更・解約)の URL を返す。
 * すでに契約済みの組織オーナー向け。
 */
export async function createPortalSession(input: CreatePortalInput): Promise<PortalResult> {
  const fn = httpsCallable<CreatePortalInput, PortalResult>(functions, "createPortalSession");
  const res = await fn(input);
  const url = res.data?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Portal URL を取得できませんでした。");
  }
  return { url };
}
