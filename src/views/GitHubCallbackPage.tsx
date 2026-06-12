export function GitHubCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  return (
    <main className="app-shell callback-shell">
      <section className="card callback-card">
        <p className="card-kicker">GitHub OAuth Callback</p>
        <h1>Contribution Arc is ready to complete your GitHub connection.</h1>
        {error ? (
          <p className="callback-message error">
            GitHub returned an error: <strong>{error}</strong>
          </p>
        ) : (
          <p className="callback-message">
            Authorization code received. The next step is exchanging this code on a
            backend server, not in the browser.
          </p>
        )}

        <div className="callback-detail">
          <span>code</span>
          <code>{code || "No code parameter found"}</code>
        </div>
        <div className="callback-detail">
          <span>state</span>
          <code>{state || "No state parameter found"}</code>
        </div>

        <a className="callback-back" href="/">
          Back to Contribution Arc
        </a>
      </section>
    </main>
  );
}
