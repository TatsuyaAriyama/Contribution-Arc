/**
 * Bottom-sheet hint that shows on iPhone Safari when the user has NOT
 * yet added the app to the home screen. iOS exposes no install prompt
 * the way Android does, so users have to be told the "Share → Add to
 * Home Screen" path explicitly — without this banner, the PWA looks
 * like just another website on iOS even though everything else
 * (manifest, icons, theme color) is in place.
 *
 * Visibility rules (all must hold):
 *   - Running on iPhone / iPod (iPad is treated as desktop by Safari)
 *   - Inside Safari (not Chrome iOS / Firefox iOS — those can't add
 *     a webapp to the home screen)
 *   - Not already running in standalone mode
 *   - User hasn't dismissed within the last 60 days
 */
import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LanguageContext";

const DISMISS_KEY = "contribution-arc-ios-install-dismissed-at";
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

function shouldShowHint(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIphone = /iPhone|iPod/.test(ua);
  if (!isIphone) return false;
  // Chrome iOS UA contains "CriOS"; Firefox iOS contains "FxiOS".
  // Both lack the navigator.standalone API and the Add to Home Screen
  // share action, so we only nudge users on actual Safari.
  const isCriOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (isCriOS) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // Older iOS exposes the bespoke navigator.standalone flag.
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (isStandalone) return false;
  try {
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const ts = Number(dismissedAt);
      if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) {
        return false;
      }
    }
  } catch {
    /* localStorage may be blocked in private mode — still show. */
  }
  return true;
}

export function IOSInstallHint() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay so the hint doesn't fight first-paint or the auth screen
    // — wait until the user has had a moment to orient.
    const id = window.setTimeout(() => {
      if (shouldShowHint()) setVisible(true);
    }, 4000);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="ios-install-hint" role="dialog" aria-label={t("ホーム画面に追加")}>
      <div className="ios-install-hint-body">
        <strong>{t("ホーム画面に追加")}</strong>
        <p>
          {t("下の")} <span aria-hidden="true">􀈂</span>{t("共有ボタン → 「ホーム画面に追加」で、ネイティブアプリのように開けます。")}
        </p>
      </div>
      <button type="button" className="ios-install-hint-dismiss" onClick={dismiss} aria-label={t("閉じる")}>
        ×
      </button>
    </div>
  );
}
