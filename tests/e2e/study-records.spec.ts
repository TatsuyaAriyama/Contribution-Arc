// ゴール② 学習記録: 作成・編集・削除・永続化
// スケルトン: LearningRecordModal / learningItems サービスに合わせて埋める。
import { test, expect } from "@playwright/test";

test.describe("study records", () => {
  // W-E2E-RECORD-CRUD: 作成 → 編集 → 削除が一周する
  test.fixme("学習記録を作成・編集・削除できる", async ({ page }) => {
    await page.goto("/");
    // TODO: ログイン
    // TODO: 学習記録ビューへ遷移（currentView = "learning" 相当）
    // TODO: 記録を新規作成（name, category, totalPages 等）
    // TODO: 編集してフィールドが反映されることを確認
    // TODO: 削除して一覧から消えることを確認
  });

  // W-E2E-RECORD-PERSIST: リロード後も保持される
  test.fixme("作成した学習記録がリロード後も残る", async ({ page }) => {
    await page.goto("/");
    const name = `book-${Date.now()}`;
    // TODO: 記録を作成
    await page.reload();
    await expect(page.getByText(name)).toBeVisible();
  });
});
