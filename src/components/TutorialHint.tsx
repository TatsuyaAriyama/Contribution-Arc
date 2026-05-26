import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  isTutorialSeen,
  markTutorialSeen,
  type TutorialFeature,
} from "../services/tutorial";

type Props = {
  /** Firebase uid — scopes the seen-flag so different accounts get their own tutorials. */
  uid: string;
  feature: TutorialFeature;
  title: string;
  body: string;
  /** 2–4 short bullets describing concrete actions the user can take here. */
  bullets?: string[];
};

/**
 * Small dismissible "first time on this screen" card. Renders at the
 * top of a view's content, fades in when the surface mounts, and
 * disappears for good once the user taps "わかった" (or the close X).
 *
 * Purposely NOT a modal — modals block the UI and feel like
 * interruption. A card lets the user read at their pace, look around,
 * and either dismiss when ready or scroll past. Same pattern Notion /
 * Linear / GitHub use for in-app hints.
 */
export function TutorialHint({ uid, feature, title, body, bullets }: Props) {
  // Initial value is read once on mount. Subsequent dismissals are
  // local state — `isTutorialSeen` running on every render would
  // thrash localStorage and cause re-mounts to flicker.
  const [seen, setSeen] = useState(() => isTutorialSeen(uid, feature));

  const handleDismiss = () => {
    markTutorialSeen(uid, feature);
    setSeen(true);
  };

  return (
    <AnimatePresence initial={false}>
      {!seen ? (
        <motion.section
          key={feature}
          className="tutorial-hint"
          role="dialog"
          aria-labelledby={`tutorial-${feature}-title`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="tutorial-hint-head">
            <span className="tutorial-hint-badge">はじめてのヒント</span>
            <button
              type="button"
              className="tutorial-hint-close"
              onClick={handleDismiss}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          <p className="tutorial-hint-title" id={`tutorial-${feature}-title`}>
            {title}
          </p>
          <p className="tutorial-hint-body">{body}</p>
          {bullets && bullets.length > 0 ? (
            <ul className="tutorial-hint-bullets">
              {bullets.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="tutorial-hint-ok"
            onClick={handleDismiss}
          >
            わかった
          </button>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
