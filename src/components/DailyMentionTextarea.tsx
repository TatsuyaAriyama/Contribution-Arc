import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getActiveMentionQuery } from "../services/dailyMentions";

/**
 * Textarea wrapper that surfaces a small `@mention` autocomplete menu
 * when the user types `@` followed by a partial userId.
 *
 * Design intent — kept deliberately minimal to match the rest of the
 * editor surface:
 *   - The popup floats just below the textarea (not at the caret).
 *     Pixel-perfect caret tracking inside a textarea requires a
 *     mirror-div hack that adds DOM weight for marginal UX gain; the
 *     popup below the field is plenty discoverable.
 *   - Filtering happens locally against a small candidate list (org
 *     members or friends). No remote search.
 *   - Keyboard nav: ↑ / ↓ to move, Enter / Tab to select, Esc to
 *     close. Selection inserts `@<userId> ` (trailing space) so the
 *     user can continue typing without manually adding a separator.
 */

export type MentionCandidate = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
};

type DailyMentionTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  ariaLabel?: string;
  /** Pool of mention candidates. Typically org members; falls back to
   *  the user's friends list when org membership is empty. */
  candidates: MentionCandidate[];
  /** Optional id passed through for label association. */
  id?: string;
};

export type DailyMentionTextareaHandle = {
  focus: () => void;
};

const MAX_VISIBLE_CANDIDATES = 6;

export const DailyMentionTextarea = forwardRef<
  DailyMentionTextareaHandle,
  DailyMentionTextareaProps
>(function DailyMentionTextarea(
  { value, onChange, placeholder, rows = 7, disabled = false, ariaLabel, candidates, id },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [menuQuery, setMenuQuery] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  /* Recompute the active mention query whenever the textarea content
     or caret moves. Called from onChange / onKeyUp / onClick so the
     popup tracks the caret without us having to listen to selection
     change events globally. */
  const refreshMenuFromCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const next = getActiveMentionQuery(el.value, caret);
    setMenuQuery(next);
    setActiveIndex(0);
  }, []);

  /* Close the popup whenever the user clicks outside the textarea. */
  useEffect(() => {
    if (!menuQuery) return;
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && textareaRef.current?.contains(target)) return;
      setMenuQuery(null);
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [menuQuery]);

  const filteredCandidates = (() => {
    if (!menuQuery) return [];
    const q = menuQuery.query.toLowerCase();
    const matches = candidates.filter((c) => {
      if (!c.userId) return false;
      if (!q) return true;
      return (
        c.userId.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q)
      );
    });
    return matches.slice(0, MAX_VISIBLE_CANDIDATES);
  })();

  const insertMention = (candidate: MentionCandidate) => {
    const el = textareaRef.current;
    if (!el || !menuQuery) return;
    const before = value.slice(0, menuQuery.start);
    const after = value.slice(el.selectionStart ?? menuQuery.start);
    const token = `@${candidate.userId} `;
    const next = `${before}${token}${after}`;
    onChange(next);
    setMenuQuery(null);
    setActiveIndex(0);
    // Restore caret after the inserted token on the next paint so the
    // user can keep typing without re-clicking the textarea.
    const nextCaret = before.length + token.length;
    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCaret, nextCaret);
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuQuery || filteredCandidates.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % filteredCandidates.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + filteredCandidates.length) % filteredCandidates.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      // Only intercept Enter when the menu is open AND the active row
      // is a real candidate — otherwise let Enter insert a newline.
      const target = filteredCandidates[activeIndex];
      if (target) {
        event.preventDefault();
        insertMention(target);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMenuQuery(null);
    }
  };

  return (
    <div className="mention-textarea-wrap">
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          // Defer so the textarea state catches up to the new value before we
          // probe the caret position (avoids reading stale selectionStart).
          window.requestAnimationFrame(refreshMenuFromCaret);
        }}
        onKeyUp={refreshMenuFromCaret}
        onClick={refreshMenuFromCaret}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Slight defer so a mousedown on a candidate row still
          // resolves to insertMention before the menu collapses.
          window.setTimeout(() => setMenuQuery(null), 120);
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
      />

      {menuQuery && filteredCandidates.length > 0 ? (
        <div className="mention-popup" role="listbox" aria-label="メンション候補">
          {filteredCandidates.map((candidate, index) => (
            <button
              key={candidate.userId}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`mention-popup-row${index === activeIndex ? " is-active" : ""}`}
              onMouseDown={(event) => {
                // Prevent the textarea blur from racing the click.
                event.preventDefault();
                insertMention(candidate);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="mention-popup-avatar" aria-hidden="true">
                {candidate.avatarUrl ? (
                  <img src={candidate.avatarUrl} alt="" />
                ) : (
                  (candidate.displayName || candidate.userId || "?")
                    .charAt(0)
                    .toUpperCase()
                )}
              </span>
              <span className="mention-popup-text">
                <strong>{candidate.displayName || candidate.userId}</strong>
                <small>@{candidate.userId}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
