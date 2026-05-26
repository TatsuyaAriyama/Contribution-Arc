/**
 * Per-feature first-visit tutorial state.
 *
 * Each top-level surface (home, logs, learning, workspace, daily,
 * profile) has its own one-shot hint card. The "seen" flag is keyed by
 * both Firebase uid and feature name so:
 *
 *   - signing into a fresh account on the same device replays the
 *     tutorials for that account
 *   - dismissing a tutorial on one device doesn't dismiss it for the
 *     same account on a different device (per-device tutorials are
 *     usually what people expect — you re-learn the UI on each phone /
 *     laptop)
 *
 * Failures (storage disabled, quota full) are swallowed: the tutorial
 * simply shows again, which is better than crashing the UI.
 */

const TUTORIAL_FEATURES = [
  "home",
  "logs",
  "learning",
  "workspace",
  "daily",
  "profile",
] as const;

export type TutorialFeature = (typeof TUTORIAL_FEATURES)[number];

function storageKey(uid: string, feature: TutorialFeature) {
  return `contribution-arc-tutorial-${uid}-${feature}-seen`;
}

export function isTutorialSeen(uid: string, feature: TutorialFeature): boolean {
  if (!uid) return true; // pre-auth: never show the cards
  try {
    return window.localStorage.getItem(storageKey(uid, feature)) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(uid: string, feature: TutorialFeature): void {
  if (!uid) return;
  try {
    window.localStorage.setItem(storageKey(uid, feature), "1");
  } catch {
    /* storage disabled — the card will show again next visit, no harm done */
  }
}

/** Wipes every tutorial flag for the given uid. Used by "ヘルプ → チュートリアルをもう一度見る". */
export function resetAllTutorials(uid: string): void {
  if (!uid) return;
  TUTORIAL_FEATURES.forEach((feature) => {
    try {
      window.localStorage.removeItem(storageKey(uid, feature));
    } catch {
      /* swallow */
    }
  });
}

export { TUTORIAL_FEATURES };
