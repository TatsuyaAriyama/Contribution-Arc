import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  dismissToast,
  subscribeToasts,
  type Toast,
} from "../services/toast";
import { useTranslation } from "../i18n/LanguageContext";

/**
 * Renders the active toast queue, anchored to the bottom of the
 * viewport. Subscribes once on mount and stays in sync via the toast
 * service's pub/sub — no props, no parent wiring beyond mounting this
 * component once near the app root.
 *
 * Visual rules:
 *  - At most 4 toasts are visible; older ones are dropped from the
 *    render but still in the service queue so timers continue to tick.
 *  - Spring-in / fade-out via AnimatePresence so a dismissed toast
 *    doesn't yank the layout.
 *  - On mobile the host sits above the bottom navigation (which has
 *    z-index 70) and above the .settings-modal-backdrop (z-index 100)
 *    so a toast emitted from inside a modal (e.g. quick-log "+30 分")
 *    is still readable. The host uses z-index 200 from the stylesheet.
 *  - Tap anywhere on a toast to dismiss early; cursor:pointer + the
 *    role=status combo gives screen readers polite live-region
 *    behaviour without making each toast a separate landmark.
 *
 * Why portal to <body>:
 *  - The app root is wrapped in `motion.main`, which generates a CSS
 *    `transform` on every frame. A `transform` on an ancestor turns
 *    that ancestor into the containing block for any descendant
 *    `position: fixed`, so the toast host's `bottom` / `z-index` are
 *    measured against `motion.main` instead of the viewport. That made
 *    toasts emitted from inside the learning-detail modal end up
 *    *below* the visible viewport on mobile (reported with screenshot
 *    of "+XXmin" never showing up). Portalling to `document.body`
 *    sidesteps the transform-containing-block trap entirely.
 */
const MAX_VISIBLE = 4;

export function ToastHost() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  if (toasts.length === 0) return null;
  if (typeof document === "undefined") return null;

  // Newest at the bottom of the stack so the eye lands on the most
  // recent message; older toasts age upward and out.
  const visible = toasts.slice(-MAX_VISIBLE);

  return createPortal(
    <div
      className="toast-host"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {visible.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.kind}`}
            onClick={() => dismissToast(toast.id)}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-label={t("通知: {message} (タップで閉じる)", { message: toast.message })}
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "•"}
            </span>
            <span className="toast-message">{toast.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
