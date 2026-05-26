/**
 * Tiny toast notification system.
 *
 * Lets any async handler surface a one-line confirmation or error
 * ("保存しました", "ネットワークエラー") without wiring extra state
 * through React props. Pub/sub instead of context so non-component
 * code (services, fetchers) can publish without a hook.
 *
 * Behavioural notes:
 *  - Toasts queue. A burst of 5 saves shows 5 cards, not 1 jumbled
 *    overlay; the host caps the visible queue length so the user is
 *    never flooded.
 *  - Each toast has a stable id (timestamp+random) so React's reconciler
 *    can animate exits without keys clashing during rapid-fire updates.
 *  - Default lifetime is 3.2s — long enough to read 1 line of
 *    Japanese, short enough that errors don't linger after they're
 *    irrelevant.
 *  - Errors stick longer (5s) because the user often needs to react.
 */

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss delay in ms. */
  duration: number;
};

type Listener = (toasts: Toast[]) => void;

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3200,
  info: 3200,
  error: 5000,
};

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  // Snapshot so subscribers can compare references and skip no-op renders.
  const snapshot = toasts.slice();
  listeners.forEach((listener) => listener(snapshot));
}

function makeId() {
  // crypto.randomUUID is widely available but guard for tests / old browsers.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ShowToastOptions = {
  kind?: ToastKind;
  /** Override the default per-kind duration. Pass 0 for sticky toasts. */
  duration?: number;
};

export function showToast(message: string, options: ShowToastOptions = {}): string {
  const kind: ToastKind = options.kind ?? "info";
  const duration = options.duration ?? DEFAULT_DURATION[kind];
  const id = makeId();
  const toast: Toast = { id, kind, message, duration };

  toasts = [...toasts, toast];
  emit();

  if (duration > 0) {
    const timer = setTimeout(() => dismissToast(id), duration);
    dismissTimers.set(id, timer);
  }

  return id;
}

export function dismissToast(id: string): void {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
  const before = toasts.length;
  toasts = toasts.filter((toast) => toast.id !== id);
  if (toasts.length !== before) emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  // Replay current state so a late subscriber doesn't miss recent toasts.
  listener(toasts.slice());
  return () => {
    listeners.delete(listener);
  };
}

/** Wipe everything. Useful on sign-out or route resets. */
export function clearToasts(): void {
  dismissTimers.forEach((timer) => clearTimeout(timer));
  dismissTimers.clear();
  toasts = [];
  emit();
}
