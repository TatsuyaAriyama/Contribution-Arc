/**
 * Helpers for @mention support in the daily report.
 *
 * Mentions are stored inline in the plan / reflection text as
 * `@<userId>` tokens — the same `userId` shape validated by Firestore
 * rules (`^[a-z0-9_]+(\.[a-z0-9_]+)*$`). Storing the userId rather
 * than the display name means renames don't break old mentions.
 *
 * On save, the editor extracts all mentioned userIds into a separate
 * `mentions: string[]` field on the DailyReport. That denormalized
 * list is what a future "you were mentioned" inbox / Slack ping would
 * query against, so the parsing logic lives here in one place.
 */

import type { ReactNode } from "react";

/** Same character class as the Firestore validUserId rule. We do NOT
 *  allow uppercase here — userIds are always lower-case at write time
 *  per the rule, so an uppercase `@Foo` simply won't match. */
const MENTION_PATTERN = /@([a-z0-9_]+(?:\.[a-z0-9_]+)*)/g;

/** Return every userId mentioned in `text`, deduplicated and in
 *  first-seen order. The leading `@` is stripped. */
export function extractMentionedUserIds(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const userId = match[1];
    if (userId && !seen.has(userId)) {
      seen.add(userId);
      out.push(userId);
    }
  }
  return out;
}

/** Union of mentions found across an arbitrary set of fields. Used
 *  when computing the persisted `mentions` array from both `plan`
 *  and `reflection` at save time. */
export function extractMentionsFromFields(...fields: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of fields) {
    for (const id of extractMentionedUserIds(field)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

export type MentionRenderable =
  | { kind: "text"; value: string }
  | { kind: "mention"; userId: string; displayName: string };

/** Tokenise `text` into a flat array of text / mention chunks. Pass a
 *  `lookup` from userId → display name so the renderer can show
 *  「@田中」 rather than the raw `@tanaka` token. Falls back to the
 *  userId if no display name is known. */
export function tokenizeMentions(
  text: string,
  lookup: (userId: string) => string | undefined = () => undefined,
): MentionRenderable[] {
  if (!text) return [];
  const out: MentionRenderable[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      out.push({ kind: "text", value: text.slice(cursor, start) });
    }
    const userId = match[1];
    const displayName = lookup(userId) || userId;
    out.push({ kind: "mention", userId, displayName });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    out.push({ kind: "text", value: text.slice(cursor) });
  }
  return out;
}

/** Convenience: render `text` to React nodes using the same tokenisation
 *  as `tokenizeMentions`. Mention chunks are wrapped in a span with
 *  `className="mention-token"` so the consumer can style them once. */
export function renderTextWithMentions(
  text: string,
  options: {
    lookup?: (userId: string) => string | undefined;
    onClickMention?: (userId: string) => void;
    /** React key prefix so two adjacent renders don't collide. */
    keyPrefix?: string;
  } = {},
): ReactNode[] {
  const { lookup, onClickMention, keyPrefix = "m" } = options;
  return tokenizeMentions(text, lookup).map((token, index) => {
    if (token.kind === "text") {
      return token.value;
    }
    const label = `@${token.displayName}`;
    if (onClickMention) {
      return (
        <button
          key={`${keyPrefix}-${index}`}
          type="button"
          className="mention-token mention-token-button"
          onClick={(event) => {
            event.stopPropagation();
            onClickMention(token.userId);
          }}
        >
          {label}
        </button>
      );
    }
    return (
      <span key={`${keyPrefix}-${index}`} className="mention-token">
        {label}
      </span>
    );
  });
}

/** Look at `text` ending at `caret` and decide whether the user is
 *  currently typing a mention query. Returns the active `@` start
 *  index + the partial query string after it, or null when the caret
 *  is not inside a mention token. */
export function getActiveMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret <= 0 || caret > text.length) return null;
  // Scan backward from caret looking for an `@` that starts a valid
  // mention candidate. Stop at whitespace / newline / another `@`.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // The `@` must be at start-of-string or preceded by whitespace,
      // otherwise it's an email or some other inline literal.
      if (i === 0 || /\s/.test(text[i - 1])) {
        const query = text.slice(i + 1, caret);
        // Reject if query contains anything that wouldn't be a valid
        // userId char — we want the popup to close on space etc.
        if (/^[a-z0-9_.]*$/i.test(query)) {
          return { start: i, query: query.toLowerCase() };
        }
      }
      return null;
    }
    if (/[\s\n]/.test(ch)) return null;
    i -= 1;
  }
  return null;
}
