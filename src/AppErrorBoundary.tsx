import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

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

    return (
      <main className="app-error-shell">
        <section className="app-error-card">
          <p className="card-kicker">Contribution Arc</p>
          <h1>画面の復帰が必要です。</h1>
          <p>Roomデータの読み込み中に表示が止まりました。再読み込みすると直前の状態から復帰します。</p>
          <button type="button" onClick={this.handleReset}>
            再読み込み
          </button>
        </section>
      </main>
    );
  }
}
