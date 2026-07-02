// ゴール① ホーム画面: 自由投稿 / フィード閲覧 / スクロール
// Auth + Firestore Emulator 前提（npm run test:e2e / verify.sh が起動）。
//
// ホーム再構成 (投稿を専用ビューへ分離) 後は、投稿の composer / フィード
// 一覧はホーム (feed view) ではなく「みんなの投稿」入口行から遷移する
// posts view にある。各テストはまずそこへ移動してから投稿を作成する。
import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/login";

// ホームの「みんなの投稿」入口行から posts view へ遷移する。
async function goToPosts(page: Page) {
  await page.getByTestId("home-posts-entry").click();
  await expect(page.getByTestId("home-post-textarea")).toBeVisible();
}

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
    await goToPosts(page);
    const body = `e2e-post-${Date.now()}`;
    await createPost(page, body);
  });

  // W-E2E-HOME-SCROLL: 複数投稿してスクロールしても投稿が欠落しない
  test("フィードをスクロールしても投稿が欠落しない", async ({ page }) => {
    await login(page);
    await goToPosts(page);

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

  // W-SCROLL-LONGTASK: スクロール中の Long Task を機械判定（カクつき＝主観でなく
  // 閾値で）。PerformanceObserver('longtask') で >50ms タスクを数える。
  test("スクロール中の long task が閾値以下", async ({ page }) => {
    await login(page);
    await goToPosts(page);

    // スクロールできるだけの投稿を用意する。
    const stamp = Date.now();
    const COUNT = 14;
    for (let i = 0; i < COUNT; i += 1) {
      await createPost(page, `lt-${stamp}-${i.toString().padStart(2, "0")}`);
    }

    // longtask 計測を仕込む（Chromium のみ対応。config で mobile-chromium 固定）。
    await page.evaluate(() => {
      (window as unknown as { __longtasks: number[] }).__longtasks = [];
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          (window as unknown as { __longtasks: number[] }).__longtasks.push(e.duration);
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    });

    // フィードをプログラム的に上下スクロールして負荷をかける。
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(80);
    }
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, -1400);
      await page.waitForTimeout(80);
    }
    // observer のフラッシュを待つ。
    await page.waitForTimeout(300);

    const longtasks = await page.evaluate(
      () => (window as unknown as { __longtasks: number[] }).__longtasks,
    );
    const over50 = longtasks.filter((d) => d > 50);
    console.log(
      `[W-SCROLL-LONGTASK] total=${longtasks.length} over50=${over50.length} ` +
        `max=${longtasks.length ? Math.max(...longtasks).toFixed(0) : 0}ms`,
    );
    // スクロール中に 50ms 超の long task が多発しないこと（実測 + ヘッドルーム）。
    expect(over50.length).toBeLessThanOrEqual(5);
  });
});
