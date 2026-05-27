import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { arcAmountFor } from "./arcPacks";

// App Store Connect → App Information → "App-Specific Shared Secret"
// で発行した値を Firebase Secret に保存して使う。
//   firebase functions:secrets:set APPLE_SHARED_SECRET
const APPLE_SHARED_SECRET = defineSecret("APPLE_SHARED_SECRET");

const PROD_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

type AppleReceiptResponse = {
  status: number;
  receipt?: {
    in_app?: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id?: string;
      purchase_date_ms?: string;
    }>;
  };
};

async function verifyWithApple(
  receiptBase64: string,
  sharedSecret: string,
): Promise<AppleReceiptResponse> {
  const body = JSON.stringify({
    "receipt-data": receiptBase64,
    password: sharedSecret,
    "exclude-old-transactions": true,
  });

  // 本番 URL で投げ、status 21007 (sandbox レシート) ならサンドボックスに
  // フォールバック。Apple 公式の推奨フロー。
  const prodRes = await fetch(PROD_URL, { method: "POST", body });
  const prodJson = (await prodRes.json()) as AppleReceiptResponse;
  if (prodJson.status !== 21007) {
    return prodJson;
  }
  const sandboxRes = await fetch(SANDBOX_URL, { method: "POST", body });
  return (await sandboxRes.json()) as AppleReceiptResponse;
}

export const verifyApplePurchase = onCall(
  { secrets: [APPLE_SHARED_SECRET], region: "us-central1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const receiptBase64 = req.data?.receiptBase64;
    const productId = req.data?.productId;
    if (typeof receiptBase64 !== "string" || receiptBase64.length === 0) {
      throw new HttpsError("invalid-argument", "receiptBase64 is required.");
    }
    if (typeof productId !== "string" || productId.length === 0) {
      throw new HttpsError("invalid-argument", "productId is required.");
    }

    const arcAmount = arcAmountFor(productId);
    if (arcAmount === null) {
      throw new HttpsError("invalid-argument", `Unknown productId: ${productId}`);
    }

    // 1. Apple 検証
    const apple = await verifyWithApple(receiptBase64, APPLE_SHARED_SECRET.value());
    if (apple.status !== 0) {
      throw new HttpsError(
        "failed-precondition",
        `Apple receipt status ${apple.status}`,
      );
    }

    // 2. レシート内に該当 productId の取引があるか確認
    const matching = (apple.receipt?.in_app ?? []).find(
      (tx) => tx.product_id === productId,
    );
    if (!matching) {
      throw new HttpsError(
        "failed-precondition",
        "Receipt does not contain requested product.",
      );
    }
    const transactionId = matching.transaction_id;
    if (!transactionId) {
      throw new HttpsError("failed-precondition", "Missing transaction_id.");
    }

    const db = admin.firestore();
    const txRef = db.collection("processedTransactions").doc(transactionId);
    const userRef = db.doc(`users/${uid}`);

    // 3. transaction_id をキーに二重加算ブロック + アトミック加算
    const result = await db.runTransaction(async (t) => {
      const txSnap = await t.get(txRef);
      if (txSnap.exists) {
        return { added: 0, duplicate: true };
      }
      t.set(txRef, {
        uid,
        productId,
        arcAmount,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      t.set(
        userRef,
        { coins: admin.firestore.FieldValue.increment(arcAmount) },
        { merge: true },
      );
      return { added: arcAmount, duplicate: false };
    });

    return { ok: true, ...result };
  },
);
