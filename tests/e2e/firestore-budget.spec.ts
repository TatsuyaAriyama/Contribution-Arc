// F-RUNTIME-BUDGET: 代表的な1セッションの Firestore 実行時トラフィックが
// 予算内かを機械判定する。ゴール③「重くない / データが破綻しない」を、
// 主観でなく実測のランタイム指標で守るのが狙い。
//
// 計測方法: Firebase JS SDK は Firestore を WebChannel で話す。
//   - 読み取り（onSnapshot 購読 / getDoc 一回読み）→ /Listen/channel への POST
//   - 書き込み（commit）→ /Write/channel への POST
// テスト側の page.on("request") で emulator(127.0.0.1:8080) 宛の POST を
// チャネル種別ごとに数える。生のドキュメント数ではなく「クライアント→サーバの
// バースト数」だが、リスナー暴走や書き込みループといった③が嫌う回帰は
// この値の急増として確実に捕まえられる。production code には一切触れない。
import { test, expect, type Page, type Request } from "@playwright/test";
import { login } from "./fixtures/login";

// acceptance-criteria.md の Firestore ランタイム予算と同期させること。
// 実測（2026-06-21, 代表シナリオ）: listen=6, write=8。WebChannel の batching で
// run ごとに多少ぶれるため、回帰検知力を保ちつつ flaky にならない範囲で
// ヘッドルームを乗せた上限。
const LISTEN_BUDGET = 30; // 読み取り系（/Listen/channel POST）実測6
const WRITE_BUDGET = 20; //  書き込み系（/Write/channel POST）実測8

function isFirestore(req: Request) {
  const u = req.url();
  return u.includes("127.0.0.1:8080") || u.includes("localhost:8080");
}

test("1セッションの Firestore ランタイム書き込み/読み取りが予算内", async ({
  page,
}: {
  page: Page;
}) => {
  let listenPosts = 0;
  let writePosts = 0;
  page.on("request", (req) => {
    if (req.method() !== "POST" || !isFirestore(req)) return;
    const u = req.url();
    if (u.includes("/Write/channel")) writePosts += 1;
    else if (u.includes("/Listen/channel")) listenPosts += 1;
  });

  // --- 代表シナリオ ---
  await login(page); // 認証 → フィード表示（初期購読が立ち上がる）
  // 学習対象を1件作る（書き込みが1バースト発生する代表操作）
  await page.getByTestId("bottomnav-learning").click();
  await page.getByTestId("learning-add-button").click();
  await page.getByTestId("learning-editor-name").fill(`budget-${Date.now()}`);
  await page.getByTestId("learning-editor-save").click();
  await expect(page.getByTestId("learning-card-trigger").first()).toBeVisible();
  // ホームへ戻って1件投稿（もう1バースト）。投稿の composer はホーム再構成
  // で専用の posts view に分離されたので、「みんなの投稿」入口行から移動する。
  await page.getByTestId("bottomnav-home").click();
  await page.getByTestId("home-posts-entry").click();
  await page.getByTestId("home-post-textarea").fill(`budget-post-${Date.now()}`);
  await page.getByTestId("home-post-submit").click();
  await expect(page.getByTestId("feed-post").first()).toBeVisible();
  // 後続のフラッシュ分を取りこぼさないよう少しだけ待つ。
  await page.waitForTimeout(1500);

  // 実測値をログ（予算チューニング用）。
  console.log(`[F-RUNTIME-BUDGET] listenPosts=${listenPosts} writePosts=${writePosts}`);

  expect(listenPosts, "Listen(読み取り)バーストが予算超過").toBeLessThanOrEqual(
    LISTEN_BUDGET,
  );
  expect(writePosts, "Write(書き込み)バーストが予算超過").toBeLessThanOrEqual(
    WRITE_BUDGET,
  );
});
