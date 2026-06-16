import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n/LanguageContext";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Platform = "ios-safari" | "android-chrome" | "desktop-chromium" | "other";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  if (/iPhone|iPod|iPad/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) {
    return "ios-safari";
  }
  if (/Android/.test(ua)) return "android-chrome";
  if (/Chrome|Edg|OPR/.test(ua)) return "desktop-chromium";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

/**
 * 設定モーダルから呼び出される「ホーム画面に追加」インストラクション。
 * - Android Chromium で beforeinstallprompt が捕まっていれば、その deferred
 *   event を再呼び出して OS ダイアログを開く
 * - iOS Safari は手動の「共有 → ホーム画面に追加」手順を表示
 * - その他は「ブラウザメニューから "ホーム画面に追加" / "アプリをインストール"」
 *   の汎用ガイドを表示
 * - 既に standalone (= ホーム画面から開いている) なら「すでにインストール済み」
 *   と表示して操作不要にする
 */
export function InstallInstructionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const platform = useMemo(detectPlatform, []);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stash = window as unknown as { __arcDeferredInstallPrompt?: BeforeInstallPromptEvent };
    if (stash.__arcDeferredInstallPrompt) {
      setDeferred(stash.__arcDeferredInstallPrompt);
    }
    const handler = (event: Event) => {
      event.preventDefault();
      const ev = event as BeforeInstallPromptEvent;
      setDeferred(ev);
      stash.__arcDeferredInstallPrompt = ev;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!open) return null;

  const standalone = isStandalone();

  const handleInstall = async () => {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setDone(true);
        try {
          window.localStorage.setItem("contribution-arc-pwa-install-accepted", "1");
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore — single-use event */
    } finally {
      setBusy(false);
      const stash = window as unknown as {
        __arcDeferredInstallPrompt?: BeforeInstallPromptEvent;
      };
      delete stash.__arcDeferredInstallPrompt;
      setDeferred(null);
    }
  };

  return (
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="settings-modal install-instructions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-instructions-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="install-instructions-head">
          <h2 id="install-instructions-title">{t("スマホアプリとしてダウンロード")}</h2>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label={t("閉じる")}
          >
            ×
          </button>
        </header>
        <p className="install-instructions-intro">
          {t("ブラウザに登録するだけで、Contribution Arc がスマホアプリのように起動できます。お使いの環境向けの手順を表示しています。")}
        </p>

        {standalone ? (
          <p className="install-instructions-status">
            {t("すでにホーム画面から起動しています。最新のアイコンに更新したい場合は、一度ホーム画面のアイコンを長押しで削除してから、下の手順で再追加してください。")}
          </p>
        ) : null}

        {platform === "ios-safari" ? (
          <ol className="install-instructions-list">
            <li>
              {t("画面下の")} <strong>{t("共有ボタン")}</strong>
              <span aria-hidden="true"> 􀈂 </span>{t("をタップ")}
            </li>
            <li>
              {t("メニューを下にスクロールし、")}
              <strong>{t("「ホーム画面に追加」")}</strong> {t("を選ぶ")}
            </li>
            <li>
              {t("右上の")} <strong>{t("「追加」")}</strong> {t("をタップして完了")}
            </li>
          </ol>
        ) : null}

        {platform === "android-chrome" || platform === "desktop-chromium" ? (
          <>
            <ol className="install-instructions-list">
              <li>
                {t("ブラウザ右上のメニュー")} <strong>⋮</strong> {t("を開く")}
              </li>
              <li>
                <strong>{t("「ホーム画面に追加」")}</strong> {t("または")}
                <strong>{t("「アプリをインストール」")}</strong> {t("を選ぶ")}
              </li>
              <li>{t("確認ダイアログで")} <strong>{t("「追加」")}</strong> {t("をタップ")}</li>
            </ol>
            {deferred && !done ? (
              <button
                type="button"
                className="install-instructions-cta"
                onClick={handleInstall}
                disabled={busy}
              >
                {busy ? t("追加中…") : t("今すぐ追加する")}
              </button>
            ) : null}
            {done ? (
              <p className="install-instructions-status">
                {t("追加しました。ホーム画面のアイコンから起動できます。")}
              </p>
            ) : null}
          </>
        ) : null}

        {platform === "other" ? (
          <ol className="install-instructions-list">
            <li>{t("ブラウザのメニューを開く")}</li>
            <li>
              <strong>{t("「ホーム画面に追加」")}</strong>
              {t("または")} <strong>{t("「アプリをインストール」")}</strong>
              {t("の項目を選ぶ")}
            </li>
          </ol>
        ) : null}

        <p className="install-instructions-note">
          {t("すでに古いアイコンを置いている場合は、長押しで一度削除してから再追加すると新しいアイコンに更新されます。")}
        </p>
      </section>
    </div>
  );
}
