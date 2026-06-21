// Playwright 設定（スケルトン）
// まだ devDependency (@playwright/test) は未導入。verify.sh は未導入を SKIP として扱う。
// 導入時: npm i -D @playwright/test && npx playwright install
import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5173/Contribution-Arc/";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  // ローカルの dev サーバを自動起動（CI でも使えるよう strictPort）
  webServer: {
    command: "npm run dev -- --host localhost --port 5173 --strictPort",
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // スマホ実機相当のビューポートで検証する
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});
