/**
 * プラン(tier)の単一の真実 (single source of truth)。
 *
 * 料金表 UI・機能ゲーティング・プラン管理画面はすべてここを参照する。
 * 価格やフィーチャー文言を 1 箇所で直せるようにして、表示と実際の
 * ゲーティングがズレないようにするのが狙い。
 *
 * tier の扱い(重要・セキュリティ):
 *   - `planTier` は組織ドキュメントに保存するが、更新するのは
 *     サーバ側(Stripe webhook を受ける Cloud Function 等)だけ。
 *     クライアントは read-only として扱い、絶対に自分で書き換えない
 *     (= UI から自己アップグレードできないようにする)。アップグレードは
 *     必ず Stripe Checkout → 決済成功 webhook → サーバが planTier を
 *     更新、という経路を通す。
 *
 * β期間:
 *   - `BETA_ALL_FEATURES_FREE` が true の間は、tier に関係なく
 *     すべての機能ゲートを通す(料金表の「β期間中は全機能無料」と一致)。
 *     正式課金を始めるときに false にする。
 */

import { translate } from "../i18n/LanguageContext";
import type { Language } from "../i18n/translations";

export type PlanTier = "free" | "team" | "enterprise";

/** ゲーティング用の機能キー。表示文言とは分離しておく。 */
export type PlanFeature =
  | "orgTenant" // 組織テナント・招待リンク
  | "orgRooms" // 組織限定ルーム
  | "adminDashboard" // Admin ダッシュボード
  | "csvExport" // CSV エクスポート
  | "slack" // Slack 連携
  | "prioritySupport" // メール優先サポート
  | "auditLog" // 監査ログ
  | "saml" // SAML / SSO
  | "scim" // SCIM プロビジョニング
  | "dataResidency" // データレジデンシー
  | "sla"; // SLA・専任カスタマーサクセス

/** β期間中は全機能無料。正式課金開始時に false にする。 */
export const BETA_ALL_FEATURES_FREE = false;

export type PlanDef = {
  tier: PlanTier;
  name: string;
  /** 表示価格。"¥0" / "¥800" / "お問い合わせ"。 */
  priceLabel: string;
  /** 単価の補足。"/ user / 月" など。無ければ undefined。 */
  priceUnit?: string;
  tagline: string;
  /** 料金表に並べる機能文言(日本語・表示専用)。 */
  features: string[];
  /** ゲーティングで「この tier に含まれる」機能キー。 */
  includes: PlanFeature[];
  /** 「推奨」バッジを出すか。 */
  featured?: boolean;
};

/** tier の序列。上位は下位の機能をすべて含む。 */
const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  team: 1,
  enterprise: 2,
};

export function tierRank(tier: PlanTier): number {
  return TIER_RANK[tier] ?? 0;
}

/** 各機能が要求する最小 tier。 */
const FEATURE_MIN_TIER: Record<PlanFeature, PlanTier> = {
  orgTenant: "team",
  orgRooms: "team",
  adminDashboard: "team",
  csvExport: "team",
  slack: "team",
  prioritySupport: "team",
  auditLog: "enterprise",
  saml: "enterprise",
  scim: "enterprise",
  dataResidency: "enterprise",
  sla: "enterprise",
};

export const PLANS: PlanDef[] = [
  {
    tier: "free",
    name: "Free",
    priceLabel: "¥0",
    tagline: "個人 / 小規模利用",
    features: ["公開ルーム参加", "学習ログ・GitHub 連携", "Arc 通貨でカスタマイズ"],
    includes: [],
  },
  {
    tier: "team",
    name: "Team",
    priceLabel: "¥800",
    priceUnit: "/ user / 月",
    tagline: "5〜50 名のチーム",
    featured: true,
    features: [
      "組織テナント・招待リンク",
      "組織限定ルーム",
      "Admin ダッシュボード + CSV",
      "Slack 連携",
      "メール優先サポート",
    ],
    includes: ["orgTenant", "orgRooms", "adminDashboard", "csvExport", "slack", "prioritySupport"],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    priceLabel: "お問い合わせ",
    tagline: "51 名以上 / 法務要件あり",
    features: [
      "SAML / SSO 認証",
      "SCIM プロビジョニング",
      "監査ログ・データレジデンシー",
      "SLA・専任カスタマーサクセス",
    ],
    // Team の機能も含む上で Enterprise 専用機能を積む。
    includes: [
      "orgTenant",
      "orgRooms",
      "adminDashboard",
      "csvExport",
      "slack",
      "prioritySupport",
      "auditLog",
      "saml",
      "scim",
      "dataResidency",
      "sla",
    ],
  },
];

export function getPlan(tier: PlanTier): PlanDef {
  return PLANS.find((plan) => plan.tier === tier) ?? PLANS[0];
}

/** tier 単体での機能判定(β override は見ない)。 */
export function planTierIncludes(tier: PlanTier, feature: PlanFeature): boolean {
  return tierRank(tier) >= tierRank(FEATURE_MIN_TIER[feature]);
}

/**
 * 組織が指定機能を使えるか。β期間中は常に true。
 * `planTier` が無い(旧データ)場合は "free" 扱い。
 */
export function orgHasFeature(planTier: PlanTier | undefined | null, feature: PlanFeature): boolean {
  if (BETA_ALL_FEATURES_FREE) return true;
  return planTierIncludes(planTier ?? "free", feature);
}

/** 不正/旧データを安全な PlanTier に丸める。 */
export function normalizePlanTier(value: unknown): PlanTier {
  return value === "team" || value === "enterprise" ? value : "free";
}

/**
 * 表示用にプランの JP 文言をアクティブ言語へ翻訳して返す。
 * PLANS の JP 文字列は変えず (i18n の辞書キーとして使う)、レンダー時に
 * このヘルパで包む。
 */
export function getPlanLocalized(tier: PlanTier, language: Language): PlanDef {
  const plan = getPlan(tier);
  return {
    ...plan,
    priceLabel: translate(language, plan.priceLabel),
    priceUnit: plan.priceUnit ? translate(language, plan.priceUnit) : plan.priceUnit,
    tagline: translate(language, plan.tagline),
    features: plan.features.map((feature) => translate(language, feature)),
  };
}
