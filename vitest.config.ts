// ルートの Vitest 設定（ユニットテスト用）。
// 対象は src の純関数のみ（node 環境）。Firestore rules test は
// tests/firestore/vitest.config.ts に分離（emulator 前提のため）。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
});
