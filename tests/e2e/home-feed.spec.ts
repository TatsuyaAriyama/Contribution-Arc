// ゴール① ホーム画面: 自由投稿 / フィード閲覧 / スクロール
// Auth + Firestore Emulator 前提（npm run test:e2e / verify.sh が起動）。
import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/login";

// composer から1件投稿し、フィード先頭に現れるまで待つ。
async function createPost(page: Page, body: string) {
  const composer = page.getByTestId("home-post-textarea");
  await composer.fill(body);
  await page.getByTestId("home-post-submit").click();
  // 送信に成功すると postDraft がクリアされ、投稿がフィードに出る。
  await expect(composer).toHaveValue("");
  await expect(page.getByTestId("feed-post").filter({ hasText: body })).toBeVisible();
}

test.describe("home feed", () => {
  // W-E2E-HOME-POST: 自由投稿がフィードに出る
  test("自由投稿を作成するとフィードに出現する", async ({ page }) => {
    await login(page);
    const body = `e2e-post-${Date.now()}`;
    await createPost(page, body);
  });

  // W-E2E-HOME-SCROLL: 複数投稿してスクロールしても投稿が欠落しない
  test("フィードをスクロールしても投稿が欠落しない", async ({ page }) => {
    await login(page);

    const stamp = Date.now();
    const COUNT = 12;
    const bodies: string[] = [];
    for (let i = 0; i < COUNT; i += 1) {
      const body = `scroll-${stamp}-${i.toString().padStart(2, "0")}`;
      bodies.push(body);
      await createPost(page, body);
    }

    const posts = page.getByTestId("feed-post");
    // 自分の投稿が少なくとも COUNT 件は DOM に存在する。
    await expect.poll(async () => await posts.count()).toBeGreaterThanOrEqual(COUNT);
    const before = await posts.count();

    // 末尾までプログラム的にスクロールする。
    await page.getByTestId("feed-post").last().scrollIntoViewIfNeeded();
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(120);
    }

    // スクロール後も件数が減っていない（＝投稿が消えない）。
    const after = await posts.count();
    expect(after).toBeGreaterThanOrEqual(before);

    // 最初と最後に作った投稿の本文が、どちらもまだ存在する。
    await expect(page.getByTestId("feed-post").filter({ hasText: bodies[0] })).toHaveCount(1);
    await expect(
      page.getByTestId("feed-post").filter({ hasText: bodies[COUNT - 1] }),
    ).toHaveCount(1);
  });

  // W-SCROLL-LONGTASK: スクロール中の Long Task を機械判定（R5 で実装）。
  test.fixme("スクロール中の long task が閾値以下", async ({ page }) => {
    await login(page);
    await page.evaluate(() => {
      (window as unknown as { __longtasks: number[] }).__longtasks = [];
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          (window as unknown as { __longtasks: number[] }).__longtasks.push(e.duration);
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    });
    const longtasks = await page.evaluate(
      () => (window as unknown as { __longtasks: number[] }).__longtasks,
    );
    const over50 = longtasks.filter((d) => d > 50);
    expect(over50.length).toBeLessThanOrEqual(3);
  });
});
