/**
 * Plan = checklist data model + helpers for the daily report.
 *
 * Phase 10b moves the plan section from a free-text textarea to a
 * vertical list of `PlanItem` rows. Each row is a small task with a
 * done flag and an optional 1-line comment. The end-of-day report is
 * the completed checklist itself — there's no separate "reflection
 * the items" step. Engineers already work from TODOs, so the editor
 * should mirror that flow.
 *
 * Backward compatibility:
 *   - `DailyReport.plan: string` stays as the canonical preview /
 *     search field. When the user edits with `planItems`, the save
 *     handler derives an updated `plan` text from the items so older
 *     clients, Team Daily previews, and `dailyHistorySearch` keep
 *     working without any view-side changes.
 *   - Reports created before this commit have `planItems === undefined`
 *     and a plain `plan` string. `planItemsFromLegacyText` lifts that
 *     into items when the user re-opens the report; the migration is
 *     in-memory until the next save.
 *
 * Carryover:
 *   - When the writer opens today's report and it has no `planItems`
 *     yet, `getCarriedOverItems` returns the unfinished items from the
 *     most recent prior report. Each carried item gets a fresh id so
 *     toggling today's copy doesn't mutate yesterday's record, and a
 *     `carriedFrom` date so the editor can label it 「←前日から」.
 */

export type PlanItem = {
  id: string;
  text: string;
  done: boolean;
  /** Per-item end-of-day note. Optional — most items don't need one. */
  comment?: string;
  /** YYYY-MM-DD of the report this item was originally seeded from
   *  when it carried over from an earlier day. Empty for fresh items. */
  carriedFrom?: string;
};

/** Type-safe random id — uses `crypto.randomUUID` when available and a
 *  cheap timestamp fallback otherwise. The id only needs to be unique
 *  within a single planItems array; it's not stored across clients. */
function newPlanItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makePlanItem(partial: Partial<PlanItem> = {}): PlanItem {
  return {
    id: typeof partial.id === "string" && partial.id ? partial.id : newPlanItemId(),
    text: typeof partial.text === "string" ? partial.text : "",
    done: partial.done === true,
    comment: typeof partial.comment === "string" ? partial.comment : "",
    carriedFrom: typeof partial.carriedFrom === "string" ? partial.carriedFrom : "",
  };
}

/** Coerce arbitrary Firestore / cache data into a PlanItem array.
 *  Drops any entry whose `text` couldn't be coerced to a string. */
export function normalizePlanItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  const out: PlanItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const partial = raw as Partial<PlanItem>;
    const text = typeof partial.text === "string" ? partial.text : "";
    out.push(
      makePlanItem({
        id: partial.id,
        text,
        done: partial.done === true,
        comment: typeof partial.comment === "string" ? partial.comment : "",
        carriedFrom: typeof partial.carriedFrom === "string" ? partial.carriedFrom : "",
      }),
    );
  }
  return out;
}

/** Lift a legacy `plan: string` into PlanItem rows. Splits on newlines
 *  and trims common bullet-style prefixes ("・", "-", "*", "✓") so an
 *  already-checklisted plan migrates cleanly. The leading `✓` is
 *  preserved as the `done` flag. */
export function planItemsFromLegacyText(plan: string): PlanItem[] {
  if (!plan) return [];
  const lines = plan
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line) => {
    let done = false;
    let text = line;
    // Strip a `✓` prefix (with or without space) — that's our own
    // derived format when re-loading what we previously wrote.
    if (text.startsWith("✓")) {
      done = true;
      text = text.slice(1).trimStart();
    }
    // Strip common bullet prefixes.
    text = text.replace(/^[・\-*●○•]\s*/, "").trim();
    return makePlanItem({ text, done });
  });
}

/** Generate a plain-text representation of the items so the existing
 *  `plan: string` field, Team Daily previews, and history search keep
 *  working without view-side changes. */
export function derivePlanText(items: PlanItem[]): string {
  return items
    .map((item) => {
      const prefix = item.done ? "✓ " : "・";
      const main = `${prefix}${item.text}`.trimEnd();
      const comment = item.comment?.trim();
      return comment ? `${main}\n  ${comment}` : main;
    })
    .join("\n");
}

/** Look across `reports` for the most recent report dated strictly
 *  before `todayDate`. Returns its unfinished items (after stripping
 *  empty rows) with fresh ids and a `carriedFrom` marker. */
export function getCarriedOverItems(
  reports: { date: string; planItems?: PlanItem[]; plan?: string }[],
  todayDate: string,
): PlanItem[] {
  // Find the freshest prior report. We deliberately don't restrict to
  // "yesterday only" — if the writer skipped a day, the previous day's
  // open threads still feel like the right starting point.
  const prior = reports
    .filter((report) => report.date && report.date < todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prior) return [];

  const sourceItems =
    prior.planItems && prior.planItems.length > 0
      ? prior.planItems
      : planItemsFromLegacyText(prior.plan || "");

  return sourceItems
    .filter((item) => !item.done && item.text.trim().length > 0)
    .map((item) =>
      makePlanItem({
        text: item.text,
        done: false,
        // Preserve the original source date when chaining across days
        // — a carried item that was already a carryover yesterday
        // should still point at the day it originated.
        carriedFrom: item.carriedFrom || prior.date,
      }),
    );
}

/** Concatenate all text and comments across the items into a single
 *  string. Used as input to `extractMentionsFromFields` at save time. */
export function planItemsToMentionScannable(items: PlanItem[]): string {
  return items.map((item) => `${item.text} ${item.comment || ""}`).join("\n");
}

/** Compact summary of a checklist for previews — count, done count.
 *  Returned shape lets callers format however they like. */
export function summarizePlanItems(items: PlanItem[]) {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return { total, done };
}
