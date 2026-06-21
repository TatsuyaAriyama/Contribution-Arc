import { useMemo, useState } from "react";
import {
  GOAL_CATALOG,
  GOAL_KIND_LABEL,
  searchGoals,
  type GoalItem,
  type GoalKind,
} from "../data/goalCatalog";
import { useTranslation } from "../i18n/LanguageContext";

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
  /** 現在の自由入力 (英語モード or 一覧外目標)。EN モードでフォームに既定値として表示。 */
  currentCustomName?: string;
  onSelect: (goalId: string) => void;
  /** 自由入力での目標設定 (EN モード)。trim 済み・空文字なら呼ばれない。 */
  onSelectCustom?: (customName: string) => void;
  onClear: () => void;
  onClose: () => void;
};

const MAX_RESULTS = 60;
const CUSTOM_GOAL_MAX_LENGTH = 60;

export function GoalPickerModal({
  currentGoalId,
  currentCustomName = "",
  onSelect,
  onSelectCustom,
  onClear,
  onClose,
}: Props) {
  const { t, language } = useTranslation();

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

  /* EN モードは Japan-specific な高校/大学カタログがほぼ役に立たない
     ので、free-text 入力に切替える。catalog 検索 UI を出すと "Find Tokyo
     University" のような期待を煽ってしまうため、思い切って別画面にする。
     onSelectCustom が無い場合は (後方互換のため) 通常の catalog UI に
     フォールバックする。フックは Rules of Hooks に従い、この早期 return
     より前で全て宣言しておく。 */
  if (language === "en" && onSelectCustom) {
    return (
      <CustomGoalForm
        initialName={currentCustomName}
        hasExisting={Boolean(currentGoalId || currentCustomName)}
        onSubmit={(name) => {
          onSelectCustom(name);
        }}
        onClear={onClear}
        onClose={onClose}
        t={t}
      />
    );
  }

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
            <h2 id="goal-picker-title">{t("目標を選ぶ")}</h2>
          </div>
          <button
            type="button"
            className="goal-picker-close"
            onClick={onClose}
            aria-label={t("閉じる")}
          >
            ×
          </button>
        </header>

        <div className="goal-picker-tabs" role="tablist" aria-label={t("カテゴリ")}>
          {(["highschool", "university", "qualification"] as GoalKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`goal-picker-tab${kind === k ? " is-active" : ""}`}
              onClick={() => setKind(k)}
            >
              {t(GOAL_KIND_LABEL[k])}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="goal-picker-search"
          placeholder={t("名前・かな・略称で検索 (例: とうだい / AWS)")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <p className="goal-picker-meta">
          {totalCount > MAX_RESULTS
            ? t("{total} 件 (上位 {max} 件を表示)", { total: totalCount, max: MAX_RESULTS })
            : t("{count} 件", { count: totalCount })}
        </p>

        <ul className="goal-picker-list">
          {results.length === 0 ? (
            <li className="goal-picker-empty">
              {t("該当する目標が見つかりません。検索語を変えてみてください。")}
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
              {t("目標をクリア")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="goal-picker-done" onClick={onClose}>
            {t("閉じる")}
          </button>
        </footer>
      </section>
    </div>
  );
}

/* EN モード用の自由入力フォーム。
 *  - 1 つのテキストフィールド + "Save" / "Clear" / "Close"
 *  - submit で trim & 長さチェック (60 字)。
 *  - 既存値があれば編集できるよう placeholder ではなく value に流し込む。
 */
function CustomGoalForm({
  initialName,
  hasExisting,
  onSubmit,
  onClear,
  onClose,
  t,
}: {
  initialName: string;
  hasExisting: boolean;
  onSubmit: (name: string) => void;
  onClear: () => void;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [value, setValue] = useState(initialName);
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= CUSTOM_GOAL_MAX_LENGTH;

  return (
    <div className="settings-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="settings-modal goal-picker-modal goal-picker-modal--custom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="goal-picker-head">
          <div>
            <p className="card-kicker">Goal</p>
            <h2 id="goal-picker-title">{t("目標を選ぶ")}</h2>
          </div>
          <button
            type="button"
            className="goal-picker-close"
            onClick={onClose}
            aria-label={t("閉じる")}
          >
            ×
          </button>
        </header>

        <form
          className="goal-picker-custom-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit(trimmed);
          }}
        >
          <label className="goal-picker-custom-label" htmlFor="goal-picker-custom-input">
            {t("あなたの目標")}
          </label>
          <input
            id="goal-picker-custom-input"
            type="text"
            className="goal-picker-search"
            placeholder={t("例: 第一志望合格 / 資格取得 / アプリ開発")}
            value={value}
            maxLength={CUSTOM_GOAL_MAX_LENGTH}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <p className="goal-picker-meta">
            {t("同じ目標を持つ人があなたを見つけられます。")}
          </p>

          <footer className="goal-picker-foot">
            {hasExisting ? (
              <button type="button" className="goal-picker-clear" onClick={onClear}>
                {t("目標をクリア")}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="goal-picker-done" disabled={!canSubmit}>
              {t("保存")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
