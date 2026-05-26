/**
 * Firebase guard layer.
 *
 * Goal: keep Firestore usage predictable so a runaway useEffect, a flaky
 * mobile connection, or a quota error can never spiral into a write
 * storm or an `onSnapshot` reconnect loop. Three primitives:
 *
 *  - {@link scheduleDocWrite}    — debounced/coalesced `setDoc` per
 *                                  document path, with payload
 *                                  deduplication and a global write
 *                                  budget (circuit breaker).
 *  - {@link guardedOnSnapshot}   — `onSnapshot` wrapped in exponential
 *                                  backoff and a per-key circuit
 *                                  breaker that hard-stops after too
 *                                  many failures (or any quota error).
 *  - {@link flushAllPendingWrites} — best-effort drain on unload.
 *
 * Stats exposed via {@link getFirebaseGuardStats} for the in-app debug
 * panel. All limits are tuneable through {@link GUARD_CONFIG}.
 *
 * Design notes:
 *  - Writes are "best effort": if the budget breaker is open we drop
 *    silently. Callers must keep local/IndexedDB state authoritative —
 *    the next snapshot or next write attempt will catch up.
 *  - Debounce uses both a trailing delay AND a max-wait so a constantly
 *    changing payload (e.g. tick-driven state) still gets a write
 *    eventually instead of starving forever.
 *  - Subscription circuit breaker is per-key (caller supplies one) so
 *    failures in /studyLogs don't pause /posts and vice versa.
 */

import {
  setDoc,
  type DocumentReference,
  type FirestoreError,
  type SetOptions,
  type Unsubscribe,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const GUARD_CONFIG = {
  /** Trailing debounce: time of quiet before flushing a coalesced write. */
  writeDebounceMs: 1500,
  /** Max wait from the FIRST write in a burst until we force-flush. */
  writeMaxWaitMs: 8000,

  /** Global write budget (across all docs, rolling 60s window). */
  writeBudgetPerMinute: 90,
  /** Cooldown when the write breaker trips. */
  writeBreakerCooldownMs: 60_000,

  /** Snapshot backoff: 2,4,8,16,32,60 → giving up after 6 tries. */
  snapshotBackoffBaseMs: 2_000,
  snapshotBackoffMaxMs: 60_000,
  snapshotMaxRetries: 6,
  /** Cooldown after the snapshot breaker opens (quota error or N fails). */
  snapshotCooldownMs: 5 * 60_000,
};

// ---------------------------------------------------------------------------
// Write coalescer
// ---------------------------------------------------------------------------

type Pending = {
  ref: DocumentReference;
  data: unknown;
  options?: SetOptions;
  firstQueuedAt: number;
  resolve: () => void;
  reject: (error: unknown) => void;
  dedupKey?: string;
};

const pendingByPath = new Map<string, Pending>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const maxWaitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSavedHash = new Map<string, string>();

// Rolling window of write timestamps for the budget breaker.
let writeWindow: number[] = [];
let writeBreakerOpenUntil = 0;
let totalWrites = 0;
let totalDeduped = 0;
let totalDropped = 0;

function hashPayload(data: unknown, options: unknown): string {
  try {
    return JSON.stringify({ d: data, o: options });
  } catch {
    // Cyclical or otherwise un-stringifiable payload — never matches, never dedups.
    return `__nohash__${Math.random()}`;
  }
}

function recordWrite() {
  const now = Date.now();
  writeWindow.push(now);
  writeWindow = writeWindow.filter((t) => now - t < 60_000);
  totalWrites += 1;
  if (writeWindow.length > GUARD_CONFIG.writeBudgetPerMinute) {
    writeBreakerOpenUntil = now + GUARD_CONFIG.writeBreakerCooldownMs;
    console.warn(
      `[firebaseGuard] write breaker OPEN — ${writeWindow.length} writes/min exceeded budget ${GUARD_CONFIG.writeBudgetPerMinute}. Cooldown until ${new Date(writeBreakerOpenUntil).toISOString()}.`,
    );
  }
}

function isWriteBreakerOpen() {
  return Date.now() < writeBreakerOpenUntil;
}

export type ScheduleDocWriteOptions = {
  /**
   * Stable string used for payload deduplication. Two consecutive
   * writes with the same `dedupKey` skip the network. When omitted, the
   * whole payload is hashed — but that defeats dedup if the payload
   * contains volatile fields like `Date.now()` or `serverTimestamp()`.
   * Pass a key built only from the meaningful fields instead.
   */
  dedupKey?: string;
};

/**
 * Schedule a `setDoc` for `ref`. Multiple calls within
 * `writeDebounceMs` to the same path are coalesced — only the LATEST
 * payload is written. Identical payloads are also deduplicated against
 * the last successful write to avoid pointless round trips.
 *
 * If the global write breaker is open, the call resolves as a silent
 * drop. Callers should keep local state authoritative; the next
 * snapshot tick (or the next non-breaker write) will heal divergence.
 */
export function scheduleDocWrite(
  ref: DocumentReference,
  data: unknown,
  options?: SetOptions,
  scheduleOptions?: ScheduleDocWriteOptions,
): Promise<void> {
  const path = ref.path;
  return new Promise<void>((resolve, reject) => {
    // Replace any prior pending write for this doc. The supersession is
    // a no-op success from the caller's perspective: they wanted the
    // value persisted, and the newer call carries the latest value.
    const prior = pendingByPath.get(path);
    if (prior) {
      prior.resolve();
    }

    const firstQueuedAt = prior?.firstQueuedAt ?? Date.now();
    pendingByPath.set(path, { ref, data, options, firstQueuedAt, resolve, reject, dedupKey: scheduleOptions?.dedupKey });

    // Reset the trailing-edge debounce timer.
    const existingDebounce = debounceTimers.get(path);
    if (existingDebounce) clearTimeout(existingDebounce);
    debounceTimers.set(
      path,
      setTimeout(() => {
        debounceTimers.delete(path);
        void flushPath(path);
      }, GUARD_CONFIG.writeDebounceMs),
    );

    // Arm the max-wait timer once per burst so a constantly-changing
    // payload still gets a write after writeMaxWaitMs at the latest.
    if (!maxWaitTimers.has(path)) {
      maxWaitTimers.set(
        path,
        setTimeout(() => {
          maxWaitTimers.delete(path);
          void flushPath(path);
        }, GUARD_CONFIG.writeMaxWaitMs),
      );
    }
  });
}

async function flushPath(path: string): Promise<void> {
  // Cancel both timers — whichever fired first wins; the other becomes a no-op.
  const debounceTimer = debounceTimers.get(path);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimers.delete(path);
  }
  const maxTimer = maxWaitTimers.get(path);
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxWaitTimers.delete(path);
  }

  const pending = pendingByPath.get(path);
  if (!pending) return;
  pendingByPath.delete(path);

  if (isWriteBreakerOpen()) {
    totalDropped += 1;
    pending.resolve();
    return;
  }

  // Prefer the caller's stable dedup key (so volatile timestamps don't
  // defeat dedup). Fall back to hashing the whole payload.
  const hash = pending.dedupKey ?? hashPayload(pending.data, pending.options);
  if (lastSavedHash.get(path) === hash) {
    totalDeduped += 1;
    pending.resolve();
    return;
  }

  try {
    recordWrite();
    if (pending.options) {
      await setDoc(pending.ref, pending.data as Record<string, unknown>, pending.options);
    } else {
      await setDoc(pending.ref, pending.data as Record<string, unknown>);
    }
    lastSavedHash.set(path, hash);
    pending.resolve();
  } catch (error) {
    // Surface to caller. Don't auto-retry — the dependent useEffect will
    // call us again on the next state change. Auto-retry here would
    // double-count against the budget on transient failures.
    pending.reject(error);
  }
}

/**
 * Drain pending writes immediately. Intended for `beforeunload` so
 * coalesced changes aren't lost when the user closes the tab.
 */
export async function flushAllPendingWrites(): Promise<void> {
  const paths = Array.from(pendingByPath.keys());
  await Promise.all(paths.map((p) => flushPath(p)));
}

// ---------------------------------------------------------------------------
// Subscription guard
// ---------------------------------------------------------------------------

type SubBreakerState = {
  fails: number;
  cooldownUntil: number;
  lastErrorCode: string;
};
const subState = new Map<string, SubBreakerState>();
let totalSubReconnects = 0;
let totalSubBreakerTrips = 0;

function isQuotaError(err: FirestoreError): boolean {
  return err.code === "resource-exhausted" || /quota/i.test(err.message || "");
}

/**
 * Wrap an `onSnapshot` subscription in exponential backoff + a
 * per-`key` circuit breaker.
 *
 * The `createSubscription` callback is invoked to build the underlying
 * snapshot listener; it receives `next` and `error` and must return
 * the Firestore `Unsubscribe`. We call it once on success, and again
 * (after backoff) on every transient failure.
 *
 * Failure handling:
 *  - `resource-exhausted` opens the breaker immediately. Retrying just
 *    burns the rest of the quota.
 *  - After `snapshotMaxRetries` consecutive failures the breaker opens.
 *  - While the breaker is open, no reconnect attempts are scheduled.
 *
 * The returned function unsubscribes the active listener AND cancels
 * any pending retry.
 */
export function guardedOnSnapshot<T>(
  key: string,
  createSubscription: (
    onNext: (snapshot: T) => void,
    onError: (error: FirestoreError) => void,
  ) => Unsubscribe,
  onNext: (snapshot: T) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  let activeUnsub: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const state = subState.get(key) ?? { fails: 0, cooldownUntil: 0, lastErrorCode: "" };
  subState.set(key, state);

  const start = () => {
    if (cancelled) return;

    const now = Date.now();
    if (now < state.cooldownUntil) {
      // Defer until cooldown expires — the breaker will release us on its own.
      retryTimer = setTimeout(start, state.cooldownUntil - now);
      return;
    }

    try {
      activeUnsub = createSubscription(
        (snap) => {
          state.fails = 0;
          state.lastErrorCode = "";
          onNext(snap);
        },
        (err) => {
          if (cancelled) return;
          state.fails += 1;
          state.lastErrorCode = err.code || "unknown";

          if (isQuotaError(err)) {
            state.cooldownUntil = Date.now() + GUARD_CONFIG.snapshotCooldownMs;
            totalSubBreakerTrips += 1;
            console.warn(
              `[firebaseGuard] snapshot "${key}" QUOTA-EXHAUSTED — breaker open until ${new Date(state.cooldownUntil).toISOString()}.`,
            );
            onError?.(err);
            return;
          }

          if (state.fails >= GUARD_CONFIG.snapshotMaxRetries) {
            state.cooldownUntil = Date.now() + GUARD_CONFIG.snapshotCooldownMs;
            totalSubBreakerTrips += 1;
            console.warn(
              `[firebaseGuard] snapshot "${key}" breaker OPEN after ${state.fails} failures (last: ${state.lastErrorCode}). Cooldown until ${new Date(state.cooldownUntil).toISOString()}.`,
            );
            onError?.(err);
            return;
          }

          if (activeUnsub) {
            activeUnsub();
            activeUnsub = null;
          }
          const delay = Math.min(
            GUARD_CONFIG.snapshotBackoffMaxMs,
            GUARD_CONFIG.snapshotBackoffBaseMs * 2 ** (state.fails - 1),
          );
          totalSubReconnects += 1;
          retryTimer = setTimeout(start, delay);
          onError?.(err);
        },
      );
    } catch (error) {
      // createSubscription itself threw — treat as a fail and back off.
      state.fails += 1;
      const delay = Math.min(
        GUARD_CONFIG.snapshotBackoffMaxMs,
        GUARD_CONFIG.snapshotBackoffBaseMs * 2 ** (state.fails - 1),
      );
      retryTimer = setTimeout(start, delay);
      onError?.(error as FirestoreError);
    }
  };

  start();

  return () => {
    cancelled = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export type FirebaseGuardStats = {
  pendingWrites: number;
  writesPerMinute: number;
  writeBreakerOpen: boolean;
  writeBreakerOpenUntil: number;
  totalWrites: number;
  totalDeduped: number;
  totalDropped: number;
  subscriptions: Array<{ key: string; fails: number; cooldownUntil: number; lastErrorCode: string }>;
  totalSubReconnects: number;
  totalSubBreakerTrips: number;
};

export function getFirebaseGuardStats(): FirebaseGuardStats {
  return {
    pendingWrites: pendingByPath.size,
    writesPerMinute: writeWindow.length,
    writeBreakerOpen: isWriteBreakerOpen(),
    writeBreakerOpenUntil,
    totalWrites,
    totalDeduped,
    totalDropped,
    subscriptions: Array.from(subState.entries()).map(([key, s]) => ({
      key,
      fails: s.fails,
      cooldownUntil: s.cooldownUntil,
      lastErrorCode: s.lastErrorCode,
    })),
    totalSubReconnects,
    totalSubBreakerTrips,
  };
}

/** Expose stats on `window` for ad-hoc inspection from devtools. */
declare global {
  interface Window {
    __firebaseGuardStats?: () => FirebaseGuardStats;
  }
}
if (typeof window !== "undefined") {
  window.__firebaseGuardStats = getFirebaseGuardStats;
  // Drain pending writes when the tab is closing so debounced changes
  // aren't dropped. `pagehide` is the reliable signal on iOS Safari.
  const drainOnUnload = () => {
    void flushAllPendingWrites();
  };
  window.addEventListener("pagehide", drainOnUnload);
  window.addEventListener("beforeunload", drainOnUnload);
}
