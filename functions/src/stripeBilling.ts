/**
 * Stripe B2B サブスクリプション(シート課金)のサーバ実装。
 *
 * セキュリティの肝:
 *   - シークレットキーは `defineSecret` 経由でランタイムにだけ注入し、
 *     コード・クライアントバンドルには絶対に焼き込まない。設定は:
 *       firebase functions:secrets:set STRIPE_SECRET_KEY
 *       firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   - price ID / アプリ URL は機密でないのでパラメータで持つ:
 *       firebase functions:config は使わず v2 params(.env or deploy 時入力)
 *       STRIPE_TEAM_PRICE_ID / STRIPE_ENTERPRISE_PRICE_ID / APP_BASE_URL
 *   - 組織の planTier はこのファイル(= Stripe を信頼できる webhook)だけが
 *     更新する。クライアントは Firestore ルールで planTier を書けない。
 *
 * 関数:
 *   - createCheckoutSession (callable): オーナーがシート数を指定して
 *     サブスク Checkout を開始。URL を返す。
 *   - createPortalSession  (callable): 契約済みオーナーが請求ポータルへ。
 *   - stripeWebhook        (HTTP):     決済結果を受けて planTier を更新。
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// price ID は機密でない(公開されても害がない)ので params で持つ。
// Stripe ダッシュボードの「商品」で JPY / 月額 / per-seat の price を作り、
// その price_xxx を設定する。Enterprise を自己決済にしない場合は空のまま。
const STRIPE_TEAM_PRICE_ID = defineString("STRIPE_TEAM_PRICE_ID", { default: "" });
const STRIPE_ENTERPRISE_PRICE_ID = defineString("STRIPE_ENTERPRISE_PRICE_ID", { default: "" });
const APP_BASE_URL = defineString("APP_BASE_URL", {
  default: "https://tatsuyaariyama.github.io/Contribution-Arc/",
});

const REGION = "us-central1";

type Tier = "team" | "enterprise";

function priceIdForTier(tier: Tier): string {
  const id = tier === "team" ? STRIPE_TEAM_PRICE_ID.value() : STRIPE_ENTERPRISE_PRICE_ID.value();
  return id;
}

/** その tier の price がサーバに設定されているか。 */
function tierFromPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  if (priceId === STRIPE_TEAM_PRICE_ID.value()) return "team";
  if (priceId === STRIPE_ENTERPRISE_PRICE_ID.value()) return "enterprise";
  return null;
}

function getStripe(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

/** 組織を読み、呼び出し元がオーナーであることを保証する。 */
async function loadOwnedOrg(orgId: unknown, uid: string) {
  if (typeof orgId !== "string" || orgId.length === 0) {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  const ref = admin.firestore().doc(`organizations/${orgId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Organization not found.");
  }
  const data = snap.data() as { ownerUid?: string; stripeCustomerId?: string; name?: string };
  if (data.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "Only the org owner can manage billing.");
  }
  return { ref, data };
}

/** 既存の Stripe 顧客を取得、無ければ作って org に保存。 */
async function ensureCustomer(
  stripe: Stripe,
  ref: admin.firestore.DocumentReference,
  data: { stripeCustomerId?: string; name?: string },
  uid: string,
): Promise<string> {
  if (data.stripeCustomerId) return data.stripeCustomerId;
  const customer = await stripe.customers.create({
    name: data.name,
    metadata: { orgId: ref.id, ownerUid: uid },
  });
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: REGION },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

    const tier = req.data?.tier;
    if (tier !== "team" && tier !== "enterprise") {
      throw new HttpsError("invalid-argument", "tier must be 'team' or 'enterprise'.");
    }
    const seatsRaw = req.data?.seats;
    const seats = Math.max(1, Math.floor(typeof seatsRaw === "number" ? seatsRaw : 1));

    const price = priceIdForTier(tier);
    if (!price) {
      throw new HttpsError("failed-precondition", `Price for tier '${tier}' is not configured.`);
    }

    const { ref, data } = await loadOwnedOrg(req.data?.orgId, uid);
    const stripe = getStripe();
    const customerId = await ensureCustomer(stripe, ref, data, uid);

    const base = APP_BASE_URL.value().replace(/\/?$/, "/");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: seats }],
      // インボイス制度対応で Stripe Tax / 請求書発行を使うならここで有効化。
      automatic_tax: { enabled: false },
      success_url: `${base}?billing=success`,
      cancel_url: `${base}?billing=cancel`,
      // webhook で org / tier を引き当てるためのメタデータ。サブスク側にも
      // 載せておくと、後続の subscription.updated/deleted でも辿れる。
      metadata: { orgId: ref.id, tier },
      subscription_data: { metadata: { orgId: ref.id, tier } },
    });

    if (!session.url) {
      throw new HttpsError("internal", "Stripe did not return a Checkout URL.");
    }
    return { url: session.url };
  },
);

export const createPortalSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: REGION },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

    const { data } = await loadOwnedOrg(req.data?.orgId, uid);
    if (!data.stripeCustomerId) {
      throw new HttpsError("failed-precondition", "No Stripe customer for this org yet.");
    }

    const stripe = getStripe();
    const base = APP_BASE_URL.value().replace(/\/?$/, "/");
    const portal = await stripe.billingPortal.sessions.create({
      customer: data.stripeCustomerId,
      return_url: `${base}?billing=portal-return`,
    });
    return { url: portal.url };
  },
);

/** customer ID から組織ドキュメントを引く(サブスク系イベント用)。 */
async function findOrgByCustomer(customerId: string): Promise<admin.firestore.DocumentReference | null> {
  const q = await admin
    .firestore()
    .collection("organizations")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].ref;
}

/** サブスクの状態 → planTier を組織に反映。 */
async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const orgIdMeta = sub.metadata?.orgId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let ref: admin.firestore.DocumentReference | null = null;
  if (orgIdMeta) {
    ref = admin.firestore().doc(`organizations/${orgIdMeta}`);
  } else if (customerId) {
    ref = await findOrgByCustomer(customerId);
  }
  if (!ref) return;

  // active / trialing 以外(canceled, unpaid, past_due で失効等)は free に戻す。
  const active = sub.status === "active" || sub.status === "trialing";
  const tierFromMeta = sub.metadata?.tier === "team" || sub.metadata?.tier === "enterprise"
    ? (sub.metadata.tier as Tier)
    : tierFromPriceId(sub.items.data[0]?.price?.id);

  const planTier = active && tierFromMeta ? tierFromMeta : "free";
  await ref.set(
    {
      planTier,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
    },
    { merge: true },
  );
}

export const stripeWebhook = onRequest(
  // Stripe からの通知は未認証の外部 POST。署名(STRIPE_WEBHOOK_SECRET)で
  // 本物か検証するので、Cloud Run 側は誰でも到達できる public にする。
  // これが無いと IAM レベルで 403 になり Stripe の通知が届かない。
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: REGION, invoker: "public" },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing stripe-signature header.");
      return;
    }
    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      // 署名検証には生のリクエストボディが必要。firebase functions v2 の
      // onRequest は req.rawBody を提供する。
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription) {
            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
            const sub = await stripe.subscriptions.retrieve(subId);
            // session 側 metadata を引き継いでおく(取りこぼし防止)。
            if (!sub.metadata?.orgId && session.metadata?.orgId) {
              sub.metadata = { ...sub.metadata, ...session.metadata };
            }
            await applySubscription(sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          await applySubscription(event.data.object as Stripe.Subscription);
          break;
        }
        default:
          break;
      }
      res.status(200).send("ok");
    } catch (err) {
      // 200 を返さないと Stripe がリトライする。処理失敗はログに残しつつ
      // 5xx を返してリトライさせる。
      console.error("stripeWebhook handler error:", err);
      res.status(500).send("handler error");
    }
  },
);
