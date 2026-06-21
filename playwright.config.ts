// Playwright 設定。e2e は Firebase Emulator Suite 前提で動く。
// 実行は npm run test:e2e（firebase emulators:exec で Auth+Firestore を
// 起動し、その中で playwright test を走らせる）か、verify.sh 経由。
import { defineConfig, devices } from "@playwright/test";

// 専用ポートを使う。5173 など一般的なポートは別プロジェクトの dev サーバと
// 衝突し、reuse すると無関係なアプリを読みに行ってしまう（過去に Madoromi
// という別アプリを掴んだ事故あり）。e2e は必ず自前で起動する。
const PORT = process.env.E2E_PORT ?? "5279";
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}/Contribution-Arc/`;

export default defineConfig({
  testDir: "./tests/e2e",
  // 1ファイル内は直列。emulator 共有なので投稿件数などの干渉を避ける。
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  // dev サーバを emulator 接続モードで自動起動する。VITE_USE_EMULATORS=true
  // のときだけ src/firebase.ts の seam が Auth/Firestore Emulator に繋ぐ。
  webServer: {
    command: `cross-env VITE_USE_EMULATORS=true vite --host localhost --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    // スマホ実機相当のビューポート + Chromium（longtask API を使うため）。
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
