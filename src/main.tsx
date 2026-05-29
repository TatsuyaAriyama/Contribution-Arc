import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./index.css";

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
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* Registration failures are non-fatal — the app still works,
         it just won't surface the install prompt. */
    });
  });
}
