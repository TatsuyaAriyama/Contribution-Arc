import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useTranslation } from "../i18n/LanguageContext";

export type ArcPack = {
  productId: string;
  arcAmount: number;
  fallbackPrice: string;
  badge: string | null;
};

type ProductInfo = {
  productIdentifier: string;
  formattedPrice: string;
};

type Props = {
  catalog: ArcPack[];
  onPurchaseGranted: (arcAmount: number) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "purchasing"; productId: string }
  | { kind: "verifying"; productId: string }
  | { kind: "success"; arcAmount: number }
  | { kind: "error"; message: string };

const verifyApplePurchase = httpsCallable<
  { receiptBase64: string; productId: string },
  { ok: boolean; added: number; duplicate: boolean }
>(functions, "verifyApplePurchase");

export function ArcPurchasePanel({ catalog, onPurchaseGranted }: Props) {
  const { t } = useTranslation();
  const iap = typeof window !== "undefined" ? window.contributionArcDesktop?.iap : undefined;
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Renderer 側の onPurchaseGranted が変わっても listener を再登録しないように ref で固定
  const grantedRef = useRef(onPurchaseGranted);
  grantedRef.current = onPurchaseGranted;

  useEffect(() => {
    if (!iap) {
      setEligible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const can = await iap.canMakePayments();
      if (cancelled) return;
      setEligible(can);
      if (!can) return;

      const list = await iap.getProducts(catalog.map((p) => p.productId));
      if (cancelled) return;
      const byId: Record<string, ProductInfo> = {};
      for (const p of list) {
        byId[p.productIdentifier] = {
          productIdentifier: p.productIdentifier,
          formattedPrice: p.formattedPrice,
        };
      }
      setProducts(byId);
    })();
    return () => {
      cancelled = true;
    };
  }, [iap, catalog]);

  useEffect(() => {
    if (!iap) return;
    const off = iap.onTransaction(async (payload) => {
      if (payload.kind === "failed") {
        setStatus({
          kind: "error",
          message: payload.errorMessage ?? t("購入に失敗しました"),
        });
        return;
      }
      if (payload.kind !== "completed") return;
      if (!payload.receiptBase64 || !payload.productId) {
        setStatus({ kind: "error", message: t("レシートの読み取りに失敗しました") });
        return;
      }

      setStatus({ kind: "verifying", productId: payload.productId });
      try {
        const result = await verifyApplePurchase({
          receiptBase64: payload.receiptBase64,
          productId: payload.productId,
        });
        // StoreKit に「処理完了」を通知して同じトランザクションが再送され続けないようにする
        if (payload.transactionDate) {
          void iap.finalize(payload.transactionDate);
        }
        if (result.data.ok && result.data.added > 0) {
          grantedRef.current(result.data.added);
          setStatus({ kind: "success", arcAmount: result.data.added });
        } else if (result.data.duplicate) {
          // 既処理: 残高は既に反映済み。エラーにはしない。
          setStatus({ kind: "idle" });
        } else {
          setStatus({ kind: "error", message: t("サーバー検証で問題が発生しました") });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("通信エラーが発生しました");
        setStatus({ kind: "error", message });
      }
    });
    return off;
  }, [iap, t]);

  const handlePurchase = useCallback(
    async (productId: string) => {
      if (!iap) return;
      setStatus({ kind: "purchasing", productId });
      const result = await iap.purchase(productId);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message:
            result.reason === "cannot-make-payments"
              ? t("この端末では課金できません")
              : t("購入を開始できませんでした"),
        });
      }
      // 成功時は transactions-updated イベントで続きを処理
    },
    [iap, t],
  );

  if (eligible === null) {
    return null; // ロード中は何も出さない
  }
  if (!eligible) {
    return null; // MAS版以外、または課金不可端末は非表示
  }

  return (
    <section className="shop-section" aria-label={t("Arc を購入")}>
      <header className="shop-section-head">
        <h3>{t("Arc を購入")}</h3>
        <span>{t("シルエット解錠などに使えます")}</span>
      </header>
      {status.kind === "error" ? (
        <p className="arc-pack-status arc-pack-status-error">{status.message}</p>
      ) : status.kind === "success" ? (
        <p className="arc-pack-status arc-pack-status-success">
          {t("+{amount} Arc を付与しました", { amount: status.arcAmount.toLocaleString() })}
        </p>
      ) : null}
      <div className="shop-product-grid">
        {catalog.map((pack) => {
          const info = products[pack.productId];
          const price = info?.formattedPrice ?? pack.fallbackPrice;
          const busy =
            (status.kind === "purchasing" && status.productId === pack.productId) ||
            (status.kind === "verifying" && status.productId === pack.productId);
          return (
            <article key={pack.productId} className="shop-product-card arc-pack-card">
              <div className="arc-pack-amount">
                <span className="shop-coin-icon" aria-hidden="true">◆</span>
                <strong>{pack.arcAmount.toLocaleString()}</strong>
                <span className="arc-pack-amount-unit">Arc</span>
              </div>
              {pack.badge ? (
                <span className="arc-pack-badge">{t(pack.badge)}</span>
              ) : null}
              <div className="shop-product-footer">
                <button
                  type="button"
                  className="shop-product-buy"
                  disabled={busy}
                  onClick={() => handlePurchase(pack.productId)}
                >
                  {busy
                    ? status.kind === "verifying"
                      ? t("確認中…")
                      : t("処理中…")
                    : price}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
