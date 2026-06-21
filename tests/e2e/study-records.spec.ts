// ゴール② 学習記録（ライブラリの学習対象）: 作成・編集・削除・永続化
// Auth + Firestore Emulator 前提。
import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/login";

// ライブラリ（learning view）へ移動して「追加」エディタを開き、対象を1件作る。
async function createLearningItem(page: Page, name: string) {
  await page.getByTestId("bottomnav-learning").click();
  await page.getByTestId("learning-add-button").click();
  await page.getByTestId("learning-editor-name").fill(name);
  await page.getByTestId("learning-editor-save").click();
  // 一覧に対象カードが現れる。
  await expect(
    page.getByTestId("learning-card-trigger").filter({ hasText: name }),
  ).toBeVisible();
}

// カード → 記録モーダル →「詳細・編集」→ 詳細 →「編集」でエディタ(編集モード)を開く。
async function openEditorForItem(page: Page, name: string) {
  await page.getByTestId("learning-card-trigger").filter({ hasText: name }).click();
  await page.getByTestId("learning-record-edit-link").click();
  await page.getByTestId("learning-detail-edit").click();
  await expect(page.getByTestId("learning-editor-name")).toBeVisible();
}

test.describe("study records", () => {
  // W-E2E-RECORD-CRUD: 作成 → 編集 → 削除が一周する
  test("学習対象を作成・編集・削除できる", async ({ page }) => {
    await login(page);

    const name = `book-${Date.now()}`;
    const renamed = `${name}-edited`;

    // Create
    await createLearningItem(page, name);

    // Edit（名前を変更して保存 → 一覧に反映）
    await openEditorForItem(page, name);
    await page.getByTestId("learning-editor-name").fill(renamed);
    await page.getByTestId("learning-editor-save").click();
    await expect(
      page.getByTestId("learning-card-trigger").filter({ hasText: renamed }),
    ).toBeVisible();

    // Delete（編集モードの危険ゾーンから削除 → 一覧から消える）
    await openEditorForItem(page, renamed);
    await page.getByTestId("learning-editor-delete-trigger").click();
    await page.getByTestId("learning-editor-delete-confirm").click();
    await expect(
      page.getByTestId("learning-card-trigger").filter({ hasText: renamed }),
    ).toHaveCount(0);
  });

  // W-E2E-RECORD-PERSIST: リロード後も保持される
  test("作成した学習対象がリロード後も残る", async ({ page }) => {
    await login(page);

    const name = `persist-${Date.now()}`;
    await createLearningItem(page, name);

    await page.reload();
    // リロード後もログイン状態（IndexedDB persistence）で、対象が残っている。
    await page.getByTestId("bottomnav-learning").click();
    await expect(
      page.getByTestId("learning-card-trigger").filter({ hasText: name }),
    ).toBeVisible();
  });
});
