/**
 * Bottom-sheet "アプリとして追加" prompt that fires on Chromium-based
 * browsers (Chrome / Edge desktop & Android) where the browser dispatches
 * a `beforeinstallprompt` event. We capture that event, show our own
 * banner from the bottom, and only call `prompt()` once the user taps
 * the install button — this way the install UI lives inside our design
 * language instead of the bare browser chip, and the user sees a clear
 * "open as an app" affordance the first time they visit.
 *
 * iOS Safari handles install via Share → Add to Home Screen and never
 * fires beforeinstallprompt; that flow is owned by `IOSInstallHint`.
 *
 * Visibility rules (all must hold):
 *   - The browser dispatched beforeinstallprompt (so the install is
 *     actually available — no point teasing it otherwise).
 *   - The app is NOT already running in standalone mode.
 *   - The user hasn't dismissed within the last 30 days.
 *   - The user hasn't already accepted the install in this profile.
 *
 * We delay showing the banner ~3s after the event so first paint
 * doesn't get crowded by an install ask.
 */
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "contribution-arc-pwa-install-dismissed-at";
const ACCEPTED_KEY = "contribution-arc-pwa-install-accepted";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

function recentlyDismissed(): boolean {
  try {
    const at = window.localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    const ts = Number(at);
    return Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function alreadyAccepted(): boolean {
  try {
    return window.localStorage.getItem(ACCEPTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || alreadyAccepted() || recentlyDismissed()) return;

    const handleEvent = (event: Event) => {
      // Block the default mini-infobar — we render our own banner so the
      // affordance matches the rest of the UI.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      window.setTimeout(() => {
        // Re-check standalone right before showing: the user may have
        // installed via the address-bar chip while we were waiting.
        if (isStandalone()) return;
        setVisible(true);
      }, SHOW_DELAY_MS);
    };

    const handleInstalled = () => {
      try {
        window.localStorage.setItem(ACCEPTED_KEY, "1");
      } catch {
        /* ignore */
      }
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", handleEvent);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleEvent);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        try {
          window.localStorage.setItem(ACCEPTED_KEY, "1");
        } catch {
          /* ignore */
        }
      } else {
        // Treat an explicit dismiss the same as our own close button —
        // honour the cooldown so we don't badger the user.
        try {
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* prompt() can throw if called twice — fail silently. */
    } finally {
      setBusy(false);
      setVisible(false);
      setDeferred(null);
    }
  };

  return (
    <div className="pwa-install-prompt" role="dialog" aria-label="アプリとして追加">
      <div className="pwa-install-prompt-body">
        <strong>アプリとして追加しますか？</strong>
        <p>ホーム画面 / Dock に追加すると、ブラウザを開かずに 1 タップで起動できます。</p>
      </div>
      <div className="pwa-install-prompt-actions">
        <button
          type="button"
          className="pwa-install-prompt-dismiss"
          onClick={dismiss}
          aria-label="閉じる"
        >
          後で
        </button>
        <button
          type="button"
          className="pwa-install-prompt-cta"
          onClick={install}
          disabled={busy}
        >
          追加する
        </button>
      </div>
    </div>
  );
}
