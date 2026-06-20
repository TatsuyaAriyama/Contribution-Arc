import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Capacitor config for the iOS (App Store) build.
 *
 * The same web bundle that ships to GitHub Pages / Electron is reused
 * inside a native WKWebView shell. The web assets are built with a
 * RELATIVE base (`vite build` with CAPACITOR_BUILD=true) so they resolve
 * under the `capacitor://localhost/` origin instead of `/Contribution-Arc/`.
 *
 * appId mirrors the existing Apple bundle identifier used for the Mac
 * App Store target so the product stays a single identity across Apple
 * platforms.
 */
const config: CapacitorConfig = {
  appId: "com.ariyamatatsuya.contributionarc",
  appName: "Contribution Arc",
  webDir: "dist",
  ios: {
    // Let our own CSS handle the safe-area insets (the app already uses
    // env(safe-area-inset-*) and viewport-fit=cover), so the webview
    // should sit edge-to-edge rather than Capacitor padding it.
    contentInset: "never",
    // Match the app's dark splash so there's no white flash before the
    // web layer paints.
    backgroundColor: "#000000",
  },
  // The DOM splash (#app-splash in index.html) handles the loading state,
  // so hide Capacitor's native splash immediately to avoid a double splash.
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#000000",
    },
  },
};

export default config;
