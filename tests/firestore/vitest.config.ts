// Firestore rules test 用 vitest 設定（スケルトン）
// 未導入: vitest, @firebase/rules-unit-testing。
// 実行前提: firebase emulators:exec で Firestore エミュレータを起動した中で動かす。
//   例) firebase emulators:exec --only firestore \
//         "npx vitest run --config tests/firestore/vitest.config.ts"
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/firestore/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    globals: true,
  },
});
