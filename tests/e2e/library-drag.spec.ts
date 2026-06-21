// ゴール②（学習対象の直感操作）: ライブラリのカードを長押し → ドラッグで
// 並べ替えできること、その並びがリロード後も保持されることを検証する。
// 実装は Pointer Events ではなく Touch/Mouse Events を直接ハンドルする
// カスタム実装（src/App.tsx startLearningDrag）。ここでは mouse モードの
// 長押しドラッグ（down → 16px 以内で 400ms 維持 → 段階移動 → up）を再現する。
import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/login";

// learning view 内の、指定名を含むカード（article）を返す。
function cardByName(page: Page, name: string) {
  return page
    .locator(".learning-grid .learning-card")
    .filter({ has: page.locator(".learning-card-head strong", { hasText: name }) });
}

// 現在のグリッドに並ぶカード名のうち、自分が作った names だけを表示順で返す。
// （Firestore Emulator は run 内で共有され、他テストの対象が混ざりうるため
//   インデックス決め打ちを避ける）
async function myOrder(page: Page, names: string[]): Promise<string[]> {
  const all = await page.locator(".learning-grid .learning-card-head strong").allInnerTexts();
  const trimmed = all.map((t) => t.trim());
  return trimmed.filter((t) => names.includes(t));
}

test.describe("library drag reorder", () => {
  test("カードを長押しドラッグで並べ替えでき、リロード後も保持される", async ({ page }) => {
    await login(page);
    await page.getByTestId("bottomnav-learning").click();

    const ts = Date.now();
    const names = [`dragA-${ts}`, `dragB-${ts}`, `dragC-${ts}`];
    for (const n of names) {
      await page.getByTestId("learning-add-button").click();
      await page.getByTestId("learning-editor-name").fill(n);
      await page.getByTestId("learning-editor-save").click();
      await expect(
        page.getByTestId("learning-card-trigger").filter({ hasText: n }),
      ).toBeVisible();
    }

    const before = await myOrder(page, names);
    expect(before.length).toBe(3);
    const fromName = before[0];
    const toName = before[before.length - 1];

    const fromBox = await cardByName(page, fromName).boundingBox();
    const toBox = await cardByName(page, toName).boundingBox();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();
    const fb = fromBox!;
    const tb = toBox!;

    // mouse モードの長押しドラッグを再現。
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    // 16px 以内に留めたまま 400ms 経過させて long-press を成立させる。
    await page.waitForTimeout(450);
    // 段階的に動かす（computeDropTarget が hover を更新できるよう刻む）。
    await page.mouse.move(fb.x + fb.width / 2 + 8, fb.y + fb.height / 2, { steps: 4 });
    // 末尾カードの右側へ落とす → そのカードの後ろに挿入される。
    await page.mouse.move(tb.x + tb.width * 0.8, tb.y + tb.height / 2, { steps: 14 });
    await page.mouse.up();

    // 先頭だった対象が先頭ではなくなり（末尾側へ移動）、消えてはいない。
    await expect
      .poll(async () => (await myOrder(page, names))[0])
      .not.toBe(fromName);
    const after = await myOrder(page, names);
    expect(after).toContain(fromName);
    expect(after.indexOf(fromName)).toBeGreaterThan(0);

    // リロード後も custom 並びが保持される（order を Firestore に永続化し、
    // sort mode を localStorage に保持）。
    await page.reload();
    await page.getByTestId("bottomnav-learning").click();
    await expect.poll(async () => myOrder(page, names)).toEqual(after);
  });
});
