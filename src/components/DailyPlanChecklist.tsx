import { useCallback, useEffect, useRef, useState } from "react";
import { makePlanItem, type PlanItem } from "../services/dailyPlanItems";
import { useTranslation } from "../i18n/LanguageContext";
import { formatStayTime } from "../utils/format";

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

export function DailyPlanChecklist({
  items,
  onChange,
  disabled = false,
  ariaLabel,
  labels,
}: DailyPlanChecklistProps) {
  const { t } = useTranslation();
  const DEFAULT_LABELS = {
    addItem: t("項目を追加"),
    placeholderText: t("やることを1行で"),
    placeholderComment: t("完了メモ(任意) — 何をやったか / 何で詰まったか"),
    carriedFrom: t("←前日から"),
    remove: t("削除"),
    commentAriaLabel: t("完了メモ"),
  };
  const l = { ...DEFAULT_LABELS, ...labels };

  /* Phase 11b：通常時は 1 行 ellipsis の読み取り表示、タップで textarea
     に切り替えて scale 拡大 → 編集 → blur で元の 1 行表示に戻る、という
     SNS 投稿 Composer 風 (X / Threads) のインタラクションに変更。
     - editingId に編集対象の item.id を持つ
     - 通常時は <button> + ellipsis、押すと editingId 切替
     - 編集時は <textarea autoFocus> + auto-grow
     - blur で editingId=null に戻して縮小演出 (CSS transition) */
  const lastAddedIdRef = useRef<string | null>(null);
  const textInputRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);

  /* textarea の内容に合わせて高さを scrollHeight に同期。1 行起点を保つ
     ため最小値は CSS 側の min-height に委ねる。 */
  const autoSizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const setItemRef = useCallback((id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) {
      textInputRefs.current.set(id, el);
      autoSizeTextarea(el);
      if (lastAddedIdRef.current === id) {
        el.focus();
        lastAddedIdRef.current = null;
      }
    } else {
      textInputRefs.current.delete(id);
    }
  }, [autoSizeTextarea]);

  /* 編集モードに切り替わった瞬間に textarea を auto-grow & focus。 */
  useEffect(() => {
    if (!editingId) return;
    const el = textInputRefs.current.get(editingId);
    if (el) {
      autoSizeTextarea(el);
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [editingId, autoSizeTextarea]);

  const updateItem = (id: string, patch: Partial<PlanItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    const created = makePlanItem({ text: "" });
    lastAddedIdRef.current = created.id;
    /* 新規追加した行はそのまま編集モードに入る (SNS 投稿風)。 */
    setEditingId(created.id);
    onChange([...items, created]);
  };

  /* Enter on the text input adds a new row — mirrors how Notion / Linear
     todo lists feel. Shift+Enter で textarea 内改行 (=長文タスクの折返し
     ではなく明示的な複数行入力)。 */
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
          const isEditing = editingId === item.id;
          return (
            <li
              key={item.id}
              className={`plan-checklist-row${item.done ? " is-done" : ""}${
                isEditing ? " is-editing" : ""
              }`}
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
                  {isEditing ? (
                    <textarea
                      ref={setItemRef(item.id)}
                      className="plan-checklist-text is-editing"
                      value={item.text}
                      placeholder={l.placeholderText}
                      disabled={disabled}
                      rows={1}
                      autoFocus
                      onChange={(event) => {
                        updateItem(item.id, { text: event.target.value });
                        autoSizeTextarea(event.currentTarget);
                      }}
                      onKeyDown={(event) => handleTextKeyDown(event, item)}
                      onBlur={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="plan-checklist-text-display"
                      onClick={() => !disabled && setEditingId(item.id)}
                      disabled={disabled}
                      aria-label={item.text || l.placeholderText}
                    >
                      {item.text ? (
                        <span className="plan-checklist-text-display-text">{item.text}</span>
                      ) : (
                        <span className="plan-checklist-text-display-placeholder">
                          {l.placeholderText}
                        </span>
                      )}
                    </button>
                  )}
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
                <div className="plan-checklist-meta">
                  {item.carriedFrom ? (
                    <span
                      className="plan-checklist-carry"
                      title={item.carriedFrom}
                      aria-label={`${l.carriedFrom} ${item.carriedFrom}`}
                    >
                      {l.carriedFrom}
                    </span>
                  ) : null}
                  <span className="plan-checklist-estimate">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={
                        item.estimateMinutes
                          ? String(Math.floor(item.estimateMinutes / 60) || "")
                          : ""
                      }
                      placeholder="0"
                      disabled={disabled}
                      aria-label={t("見積もり時間(時間)")}
                      onChange={(event) => {
                        const h = Math.max(0, Math.floor(Number(event.target.value)) || 0);
                        const m = (item.estimateMinutes || 0) % 60;
                        updateItem(item.id, { estimateMinutes: h * 60 + m });
                      }}
                    />
                    <span aria-hidden="true">{t("時間")}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={59}
                      step={5}
                      value={
                        item.estimateMinutes ? String(item.estimateMinutes % 60 || "") : ""
                      }
                      placeholder="0"
                      disabled={disabled}
                      aria-label={t("見積もり時間(分)")}
                      onChange={(event) => {
                        const m = Math.max(
                          0,
                          Math.min(59, Math.floor(Number(event.target.value)) || 0),
                        );
                        const h = Math.floor((item.estimateMinutes || 0) / 60);
                        updateItem(item.id, { estimateMinutes: h * 60 + m });
                      }}
                    />
                    <span aria-hidden="true">{t("分")}</span>
                  </span>
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
  /** Caller-provided label for the "+N hidden" footer (i18n). */
  moreLabel?: (count: number) => string;
  /** Caller-provided placeholder for items with empty text (i18n). */
  emptyItemText?: string;
};

export function PlanChecklistPreview({
  items,
  maxRows = Infinity,
  emptyText,
  moreLabel,
  emptyItemText,
}: PlanChecklistPreviewProps) {
  const { t, language } = useTranslation();
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
            {item.text || emptyItemText || t("(空)")}
            {item.comment ? <small> — {item.comment}</small> : null}
            {/* 見積もり時間を小さく添える。みんなの日報でも各タスクに
               どれくらい見積もったかが一目で分かる。0 / 未設定は出さない。 */}
            {item.estimateMinutes && item.estimateMinutes > 0 ? (
              <small
                className="plan-checklist-preview-estimate"
                aria-label={t("見積もり {time}", {
                  time: formatStayTime(item.estimateMinutes, language),
                })}
              >
                <span aria-hidden="true">⏱</span>
                {formatStayTime(item.estimateMinutes, language)}
              </small>
            ) : null}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="plan-checklist-preview-more">
          {moreLabel ? moreLabel(hidden) : t("+{count}件", { count: hidden })}
        </div>
      ) : null}
    </div>
  );
}
