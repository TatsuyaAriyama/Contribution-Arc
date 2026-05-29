/**
 * Minimal service worker — exists purely to make the app installable.
 *
 * Chrome / Edge only fire `beforeinstallprompt` (the event our
 * PWAInstallPrompt banner listens for) when the page is controlled by a
 * service worker that has a `fetch` handler. Without this file the
 * install prompt never triggers, no matter how complete the manifest is.
 *
 * Deliberately NO caching: the fetch handler is a pure network
 * passthrough. Contribution Arc deploys frequently to GitHub Pages, and
 * a caching SW would risk serving a stale app shell after a deploy. We
 * only need the handler to *exist* to satisfy installability, so we keep
 * it as thin as possible and let the network stay the source of truth.
 */

self.addEventListener("install", () => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of already-open pages so they become "controlled"
  // (a prerequisite for the install prompt) without a reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pure passthrough — no cache reads or writes. Required only so a
  // fetch handler is present for installability.
  event.respondWith(fetch(event.request));
});
