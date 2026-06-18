import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate } from "./i18n/LanguageContext";
import type { Language } from "./i18n/translations";

const LANGUAGE_STORAGE_KEY = "contribution-arc-language";
function readLang(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === "ja" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.language === "string" &&
    navigator.language.toLowerCase().startsWith("ja")
  ) {
    return "ja";
  }
  return "en";
}

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

/**
 * Phase 11d: オリジナルのエラー画面。
 * nondo 風の「純黒/純白 + 1.5px ink hairline + 太字見出し + ink pill CTA」
 * の語彙に統一。装飾的な glass / shadow / 角丸 30px は廃止し、
 * Habit / Profile menu と同じ視覚言語にする。
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Contribution Arc render error", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const lang = readLang();
    const t = (s: string) => translate(lang, s);

    return (
      <main className="app-error-shell">
        <section
          className="app-error-card"
          role="alert"
          aria-live="assertive"
        >
          <span className="app-error-mark" aria-hidden="true">!</span>
          <p className="app-error-kicker">Contribution Arc</p>
          <h1 className="app-error-title">{t("画面の復帰が必要です。")}</h1>
          <p className="app-error-body">
            {t("データの読み込み中に表示が止まりました。再読み込みすると直前の状態から復帰します。")}
          </p>
          <pre className="app-error-detail" aria-label={t("エラー詳細")}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="app-error-cta"
            onClick={this.handleReset}
          >
            {t("再読み込み")}
          </button>
        </section>
      </main>
    );
  }
}
