import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./index.css";

/* vite.config.ts の define で各ビルドごとに注入される値。 */
declare const __SW_BUILD_ID__: string;

/* Capture `beforeinstallprompt` as early as possible — it can fire
   before React mounts and the PWAInstallPrompt component's effect
   attaches its own listener, in which case the event would be lost.
   We stash the event on `window` so the component can pick it up on
   mount; we also keep emitting events afterwards for the live case. */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    (window as unknown as { __arcDeferredInstallPrompt?: Event }).__arcDeferredInstallPrompt =
      event;
  });
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AppErrorBoundary>
  </StrictMode>
);

/* index.html に inline で埋め込んだ起動 splash (`#app-splash`) を、
   React mount 後にフェードアウトして DOM から取り除く。
   - 2 連続 rAF：1 度目で React の first paint を fire、2 度目でその
     paint がコミット完了したフレームで `data-state="hide"` を立てる。
   - フェード 450ms 後に setTimeout で element を remove (cleanup)。
   - reduced-motion ユーザーは即時 remove (CSS で transition: none)。
   - 失敗時 (要素が存在しない) は安全に no-op。 */
if (typeof document !== "undefined") {
  const splash = document.getElementById("app-splash");
  if (splash) {
    const hide = () => {
      splash.setAttribute("data-state", "hide");
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cleanupDelay = prefersReducedMotion ? 0 : 500;
      window.setTimeout(() => {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, cleanupDelay);
    };
    // first paint が確実に走った後で hide。requestAnimationFrame の 2 段
    // ネストで「render → commit → paint → hide trigger」の順序を保証。
    requestAnimationFrame(() => {
      requestAnimationFrame(hide);
    });
  }
}

/* Register the minimal service worker so Chrome / Edge will fire
   `beforeinstallprompt` and our install banner can appear. Scoped to the
   Vite base (`/Contribution-Arc/` on web). Skipped on file:// (Electron),
   where there's nothing to install and SWs aren't supported anyway. */
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.location.protocol.startsWith("http")
) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${__SW_BUILD_ID__}`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        /* デプロイのたびに __SW_BUILD_ID__ が変わり、SW の登録 URL が
           変わるので updatefound が発火する。新しい SW が activated に
           なり、かつ既に別の SW が制御中 (= 初回登録ではなく更新) のとき
           だけ一度リロードして、最新の JS/CSS を確実に読み込む。これで
           「デプロイしたのに古い画面のまま」を自動で解消する。 */
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              window.location.reload();
            }
          });
        });
        /* ブラウザ既定の更新チェック (最大 24h 間隔) を待たず、起動直後に
           一度チェックを促す。 */
        void registration.update();
      })
      .catch(() => {
        /* Registration failures are non-fatal — the app still works,
           it just won't surface the install prompt. */
      });
  });
}
