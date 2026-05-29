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
 *   - The user hasn't permanently dismissed it via the「後で」button.
 *   - The user hasn't already accepted the install in this profile.
 *
 * The banner keeps showing on every visit until the user explicitly
 * taps「後で」(or installs the app). Dismissing the OS-level install
 * dialog does NOT silence it — only the「後で」button does.
 *
 * We delay showing the banner ~3s after the event so first paint
 * doesn't get crowded by an install ask.
 */
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "contribution-arc-pwa-install-dismissed";
const ACCEPTED_KEY = "contribution-arc-pwa-install-accepted";
const SHOW_DELAY_MS = 3000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

function dismissedForever(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
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
    if (isStandalone() || alreadyAccepted() || dismissedForever()) return;

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
    // 「後で」is the only thing that silences the banner permanently.
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
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
        // Installed — hide and drop the captured event.
        setVisible(false);
        setDeferred(null);
      } else {
        // The user dismissed the OS install dialog without installing.
        // Per spec we can't re-prompt with the same event, but we do NOT
        // silence our banner — it should reappear on the next visit so
        // the only permanent opt-out remains the「後で」button.
        setVisible(false);
        setDeferred(null);
      }
    } catch {
      /* prompt() can throw if called twice — fail silently. */
      setVisible(false);
      setDeferred(null);
    } finally {
      setBusy(false);
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
