import { useCallback, useRef } from "react";
import { makePlanItem, type PlanItem } from "../services/dailyPlanItems";

/**
 * Phase 10b — plan-as-checklist editor.
 *
 * Replaces the plan textarea in the daily report editor with a vertical
 * list of small task rows. Each row is a single-line text input plus a
 * checkbox; toggling the checkbox reveals an optional 1-line comment
 * field (typically used as an end-of-day note like "did → shipped" or
 * "didn't → blocked on review"). This is the smallest surface that
 * captures the way engineers actually plan their day, without making
 * the report feel like a project-management tool.
 *
 * Why no inline @mention autocomplete inside item text:
 *   - Item text is usually a 1-line task ("レビュー対応", "API設計まとめ").
 *     The reflection textarea below still uses DailyMentionTextarea —
 *     that's where the writer typically thanks/asks teammates. Keeping
 *     the checklist input plain reduces visual noise and matches how
 *     people actually write a todo line.
 *   - Mentions in item text and comments are still picked up at save
 *     time via `planItemsToMentionScannable`, so a writer who does type
 *     `@alice` still feeds the mentions inbox correctly.
 *
 * Carryover surfacing:
 *   - Items with `carriedFrom` show a small "←前日から" chip so the
 *     writer notices yesterday's open threads at a glance. Editing the
 *     text doesn't clear the chip — once an item is recognized as
 *     carried, it stays labeled for the day.
 */

type DailyPlanChecklistProps = {
  items: PlanItem[];
  onChange: (next: PlanItem[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Localized strings. Passed in so the component stays i18n-agnostic. */
  labels?: {
    addItem?: string;
    placeholderText?: string;
    placeholderComment?: string;
    carriedFrom?: string;
    remove?: string;
    commentAriaLabel?: string;
  };
};

const DEFAULT_LABELS = {
  addItem: "項目を追加",
  placeholderText: "やることを1行で",
  placeholderComment: "完了メモ(任意) — 何をやったか / 何で詰まったか",
  carriedFrom: "←前日から",
  remove: "削除",
  commentAriaLabel: "完了メモ",
} as const;

export function DailyPlanChecklist({
  items,
  onChange,
  disabled = false,
  ariaLabel,
  labels,
}: DailyPlanChecklistProps) {
  const l = { ...DEFAULT_LABELS, ...labels };

  /* Track the most recently added row so we can move focus into it.
     Without this, "+ 項目を追加" forces the user to click the new row
     before typing — a small but real friction point.

     input[type="text"] から textarea に変更 (モバイルで長い文章が
     1 行に押し込まれて見えなくなる不具合への対応)。auto-grow は
     onInput で scrollHeight を直接 height に代入する素朴な方式と、
     CSS の field-sizing: content の二段構え。 */
  const lastAddedIdRef = useRef<string | null>(null);
  const textInputRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const setItemRef = useCallback((id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) {
      textInputRefs.current.set(id, el);
      // 初期マウント時にも 1 度 auto-grow を走らせて、長い既存テキスト
      // (前日からの繰越など) が 1 行押し込みで切れないようにする。
      autoGrow(el);
      if (lastAddedIdRef.current === id) {
        el.focus();
        lastAddedIdRef.current = null;
      }
    } else {
      textInputRefs.current.delete(id);
    }
  }, []);

  const updateItem = (id: string, patch: Partial<PlanItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    const created = makePlanItem({ text: "" });
    lastAddedIdRef.current = created.id;
    onChange([...items, created]);
  };

  /* Enter on the text input adds a new row — mirrors how Notion / Linear
     todo lists feel. Shift+Enter は textarea のデフォルト改行を許可
     (長文タスクが折り返しだけでなく明示改行できるように)。 */
  const handleTextKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    item: PlanItem,
  ) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      // If this row is empty, blur instead of adding another empty row.
      if (!item.text.trim()) {
        (event.currentTarget as HTMLTextAreaElement).blur();
        return;
      }
      addItem();
    } else if (
      event.key === "Backspace" &&
      !item.text &&
      !item.comment &&
      items.length > 1
    ) {
      // Backspace on an empty row removes it and jumps focus to the
      // previous row's end — same shortcut as most checklist editors.
      event.preventDefault();
      const index = items.findIndex((other) => other.id === item.id);
      const prev = index > 0 ? items[index - 1] : null;
      removeItem(item.id);
      if (prev) {
        window.requestAnimationFrame(() => {
          const el = textInputRefs.current.get(prev.id);
          if (el) {
            el.focus();
            const end = el.value.length;
            el.setSelectionRange(end, end);
          }
        });
      }
    }
  };

  return (
    <div className="plan-checklist" role="group" aria-label={ariaLabel}>
      {items.length === 0 ? (
        <p className="plan-checklist-empty">{/* 空状態は + ボタンだけでよい — 余計な案内文は出さない */}</p>
      ) : null}
      <ul className="plan-checklist-list">
        {items.map((item) => {
          const showComment = item.done || (item.comment?.length ?? 0) > 0;
          return (
            <li
              key={item.id}
              className={`plan-checklist-row${item.done ? " is-done" : ""}`}
            >
              <label className="plan-checklist-check">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={disabled}
                  onChange={(event) => updateItem(item.id, { done: event.target.checked })}
                  aria-label={item.text || "task"}
                />
                <span aria-hidden="true" />
              </label>
              <div className="plan-checklist-body">
                <div className="plan-checklist-line">
                  <textarea
                    ref={setItemRef(item.id)}
                    rows={1}
                    className="plan-checklist-text"
                    value={item.text}
                    placeholder={l.placeholderText}
                    disabled={disabled}
                    onChange={(event) => {
                      updateItem(item.id, { text: event.target.value });
                      autoGrow(event.currentTarget);
                    }}
                    onInput={(event) => autoGrow(event.currentTarget)}
                    onKeyDown={(event) => handleTextKeyDown(event, item)}
                  />
                  {item.carriedFrom ? (
                    <span
                      className="plan-checklist-carry"
                      title={item.carriedFrom}
                      aria-label={`${l.carriedFrom} ${item.carriedFrom}`}
                    >
                      {l.carriedFrom}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="plan-checklist-remove"
                    onClick={() => removeItem(item.id)}
                    disabled={disabled}
                    aria-label={l.remove}
                  >
                    ×
                  </button>
                </div>
                {showComment ? (
                  <input
                    type="text"
                    className="plan-checklist-comment"
                    value={item.comment || ""}
                    placeholder={l.placeholderComment}
                    disabled={disabled}
                    aria-label={l.commentAriaLabel}
                    onChange={(event) => updateItem(item.id, { comment: event.target.value })}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="plan-checklist-add"
        onClick={addItem}
        disabled={disabled}
      >
        + {l.addItem}
      </button>
    </div>
  );
}

/**
 * Read-only renderer used inside the Team Daily card / detail modal.
 * Shows the checklist as a compact, non-editable list — the team feed
 * is a feed, not an editor, so checkboxes here would mislead.
 */
type PlanChecklistPreviewProps = {
  items: PlanItem[];
  /** Cap rendered rows in cramped feed cards. Detail modal passes Infinity. */
  maxRows?: number;
  emptyText?: string;
};

export function PlanChecklistPreview({
  items,
  maxRows = Infinity,
  emptyText,
}: PlanChecklistPreviewProps) {
  if (items.length === 0) {
    return emptyText ? <span className="plan-checklist-preview-empty">{emptyText}</span> : null;
  }
  const shown = Number.isFinite(maxRows) ? items.slice(0, maxRows) : items;
  const hidden = items.length - shown.length;
  // 重要：以前は <span> 構造で render していたが、inline 要素では grid /
  // flex の挙動が一部端末で安定せず、長い日本語 text が改行された時に
  // mark だけが独立して中央に表示される崩れが起きた (実機 Android で
  // 報告)。block-level の <div> に統一して安定化させる。
  return (
    <div className="plan-checklist-preview">
      {shown.map((item) => (
        <div
          key={item.id}
          className={`plan-checklist-preview-row${item.done ? " is-done" : ""}`}
        >
          <span className="plan-checklist-preview-mark" aria-hidden="true">
            {item.done ? "✓" : "・"}
          </span>
          <span className="plan-checklist-preview-text">
            {item.text || "(空)"}
            {item.comment ? <small> — {item.comment}</small> : null}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="plan-checklist-preview-more">+{hidden}件</div>
      ) : null}
    </div>
  );
}
