// F-RUNTIME-BUDGET: 代表的な1セッションの Firestore 読み/書き回数が予算内か。
// スケルトン: Firestore SDK の呼び出しを計測する手段は2案。
//   案A) Firestore Emulator を使い、サーバ側メトリクス / リクエストログから集計。
//   案B) アプリ起動時に getDoc/getDocs/onSnapshot/setDoc... をラップして window.__fsOps に記録。
// ここでは案B 用のフックを置き、しきい値だけ先に定義しておく。
import { test, expect } from "@playwright/test";

// acceptance-criteria.md の Firestore 予算と同期させること（暫定値）。
const READ_BUDGET = 300;
const WRITE_BUDGET = 30;

test.fixme("1セッションの Firestore 読み/書きが予算内", async ({ page }) => {
  // TODO: アプリ側に計測フックを用意する（dev/E2E ビルド限定で window.__fsOps を公開）。
  //   例: src/firebase.ts で E2E フラグ時に getDocs/onSnapshot 等を counting proxy で包む。
  await page.goto("/");

  // TODO: 代表シナリオを実行（ログイン → フィード閲覧 → 記録1件編集）。

  const ops = await page.evaluate(
    () =>
      (window as unknown as { __fsOps?: { reads: number; writes: number } }).__fsOps ?? {
        reads: -1,
        writes: -1,
      },
  );

  expect(ops.reads, "計測フック未配線").toBeGreaterThanOrEqual(0);
  expect(ops.reads).toBeLessThanOrEqual(READ_BUDGET);
  expect(ops.writes).toBeLessThanOrEqual(WRITE_BUDGET);
});
