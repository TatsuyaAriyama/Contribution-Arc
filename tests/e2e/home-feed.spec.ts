// ゴール① ホーム画面: 自由投稿 / フィード閲覧 / スクロール
// スケルトン: まだ緑にしなくてよい。data-testid やフローは実装に合わせて埋める。
import { test, expect } from "@playwright/test";

test.describe("home feed", () => {
  // W-E2E-HOME-POST: 自由投稿がフィード先頭に出る
  test.fixme("自由投稿を作成するとフィード先頭に出現する", async ({ page }) => {
    await page.goto("/");
    // TODO: テスト用ユーザーでログイン（emulator / テストアカウント）
    // TODO: 自由投稿 composer を開く（home の post ボタン）
    // TODO: 本文を入力して送信
    const body = `e2e-post-${Date.now()}`;
    // await page.getByTestId("home-compose").click();
    // await page.getByTestId("post-input").fill(body);
    // await page.getByTestId("post-submit").click();
    await expect(page.getByText(body)).toBeVisible();
  });

  // W-E2E-HOME-SCROLL: 長距離スクロールで投稿が欠落しない
  test.fixme("フィードを最後までスクロールしても投稿が欠落しない", async ({ page }) => {
    await page.goto("/");
    // TODO: フィードに十分な件数を用意（seed）
    // TODO: 最下部までスクロールし、件数・先頭/末尾の同一性を検証
  });

  // W-SCROLL-LONGTASK: スクロール中の Long Task を機械判定（カクつき＝主観でなく閾値で）
  test.fixme("スクロール中の long task が閾値以下", async ({ page }) => {
    await page.goto("/");
    // PerformanceObserver('longtask') を仕込み、スクロール中の longtask 合計を測る
    await page.evaluate(() => {
      (window as unknown as { __longtasks: number[] }).__longtasks = [];
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          (window as unknown as { __longtasks: number[] }).__longtasks.push(e.duration);
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    });
    // TODO: フィードをプログラム的にスクロール
    const longtasks = await page.evaluate(
      () => (window as unknown as { __longtasks: number[] }).__longtasks,
    );
    const over50 = longtasks.filter((d) => d > 50);
    // 閾値: 50ms 超の long task が連続/多発しないこと（要・実測でしきい値調整）
    expect(over50.length).toBeLessThanOrEqual(3);
  });
});
