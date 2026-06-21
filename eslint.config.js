import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// Flat config. 型情報なし（fast）の標準セット。
// - React の hooks ルールは error（バグ温床なので妥協しない）
// - exhaustive-deps は warn（巨大な App.tsx を段階的に整える）
// - no-unused-vars は tsconfig(noUnusedLocals/Parameters)+build に委ねて重複を避ける
export default tseslint.config(
  {
    ignores: [
      "dist",
      "build",
      "ios",
      "electron",
      "functions/lib",
      "node_modules",
      "simple1",
      "public",
      "assets",
      "scripts",
      "coverage",
      ".lighthouseci",
      "*.config.js",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 真にバグ温床のルールは error 維持
      "react-hooks/rules-of-hooks": "error",
      // exhaustive-deps と React Compiler 向けの新 advisory 系（set-state-in-effect /
      // purity / refs / immutability / use-memo）は warn に。修正に実ロジックの
      // リファクタを要するため、harness セッションでは可視化に留め段階対応する。
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // テストコードは Node + テストランナーの globals 前提
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
