import { useMemo, useState } from "react";
import {
  GOAL_CATALOG,
  GOAL_KIND_LABEL,
  searchGoals,
  type GoalItem,
  type GoalKind,
} from "../data/goalCatalog";

/**
 * 目標 (志望校 / 資格) を一覧 + インクリメンタル検索で選ぶモーダル。
 *
 * 仕様:
 *  - 上部に 3 タブ (高校 / 大学 / 資格)
 *  - その下に検索ボックス。タイプするたびに即時フィルタ
 *  - 一覧は最大 60 件まで描画 (それ以上はパフォーマンス確保のため抑制)
 *  - カードをタップで親に id を返して閉じる
 *  - 「目標をクリア」リンクで未設定にも戻せる
 */
type Props = {
  currentGoalId: string;
  onSelect: (goalId: string) => void;
  onClear: () => void;
  onClose: () => void;
};

const MAX_RESULTS = 60;

export function GoalPickerModal({ currentGoalId, onSelect, onClear, onClose }: Props) {
  const [kind, setKind] = useState<GoalKind>(() => {
    // 現在選択中の goal があればそのカテゴリで開く、なければ大学から
    const current = GOAL_CATALOG.find((g) => g.id === currentGoalId);
    return current?.kind ?? "university";
  });
  const [query, setQuery] = useState("");

  const results = useMemo<GoalItem[]>(() => {
    const list = searchGoals(query, kind);
    return list.slice(0, MAX_RESULTS);
  }, [query, kind]);

  const totalCount = useMemo(
    () => searchGoals(query, kind).length,
    [query, kind],
  );

  return (
    <div className="settings-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="settings-modal goal-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="goal-picker-head">
          <div>
            <p className="card-kicker">Goal</p>
            <h2 id="goal-picker-title">目標を選ぶ</h2>
          </div>
          <button
            type="button"
            className="goal-picker-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        <div className="goal-picker-tabs" role="tablist" aria-label="カテゴリ">
          {(["highschool", "university", "qualification"] as GoalKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`goal-picker-tab${kind === k ? " is-active" : ""}`}
              onClick={() => setKind(k)}
            >
              {GOAL_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="goal-picker-search"
          placeholder="名前・かな・略称で検索 (例: とうだい / AWS)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <p className="goal-picker-meta">
          {totalCount > MAX_RESULTS
            ? `${totalCount} 件 (上位 ${MAX_RESULTS} 件を表示)`
            : `${totalCount} 件`}
        </p>

        <ul className="goal-picker-list">
          {results.length === 0 ? (
            <li className="goal-picker-empty">
              該当する目標が見つかりません。検索語を変えてみてください。
            </li>
          ) : (
            results.map((item) => {
              const isActive = item.id === currentGoalId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`goal-picker-item${isActive ? " is-active" : ""}`}
                    onClick={() => onSelect(item.id)}
                  >
                    <span className="goal-picker-item-name">{item.name}</span>
                    {item.aliases && item.aliases.length > 0 ? (
                      <small className="goal-picker-item-aliases">
                        {item.aliases.slice(0, 3).join(" · ")}
                      </small>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <footer className="goal-picker-foot">
          {currentGoalId ? (
            <button type="button" className="goal-picker-clear" onClick={onClear}>
              目標をクリア
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="goal-picker-done" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </section>
    </div>
  );
}
