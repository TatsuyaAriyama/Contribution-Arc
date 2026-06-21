# Acceptance Criteria — スマホ版 自動化ループ用

このファイルは、3つのゴールを「`verify.sh` で機械判定できる自動チェック」と
「人間が最終承認する主観項目」に分解したもの。

- **自動チェック (AUTO)** … `verify.sh` が pass/fail を返す。ループの終了条件に使う。
- **人間承認 (HUMAN)** … 主観・体験品質。ループの終了条件にはしない。最後に人間が承認する。

チェック ID は `verify.sh` の出力と 1:1 で対応する。
状態は `PASS` / `FAIL`(赤) / `SKIP`(ツール未導入・未配線で今回は判定不能) の3値。

---

## ゴール① ホーム画面で自由投稿でき、学習記録が快適に見れて、スクロールに問題がないこと

### AUTO（verify.sh）
| ID | 内容 | 判定方法 |
|----|------|----------|
| `W-E2E-HOME-POST` | ホームで自由投稿を作成 → フィード先頭に出現する | Playwright e2e（`tests/e2e/home-feed.spec.ts`） |
| `W-E2E-HOME-SCROLL` | フィードを長距離スクロールしても投稿が欠落せず最後まで到達できる | Playwright e2e |
| `W-SCROLL-LONGTASK` | スクロール中の Long Task が閾値以下（既定: 1フレームあたり50ms超のタスクが連続しない） | Playwright + PerformanceObserver（longtask）で機械判定 |
| `W-LH-PERF-BUDGET` | Lighthouse のパフォーマンス予算（TBT / CLS / TTI 等）を超過しない | Lighthouse CI + `lighthouse-budget.json` |
| `N-MAESTRO-SCROLL` | 実機シミュレータでフィードをフリックスクロールしてもクラッシュ・空白化しない | Maestro flow（`.maestro/scroll-keyboard.yaml`） |

### HUMAN（主観・ループ終了条件にしない）
- スクロールの「気持ちよさ」「慣性・追従感」が自然か。
- 自由投稿の入力フロー（モーダルの開閉、フォーカス遷移）がストレスないか。
- フィードの情報密度・余白が `DESIGN.md` の世界観に合っているか。

---

## ゴール② 学習記録をユーザーが直感的に快適に利用できること

### AUTO（verify.sh）
| ID | 内容 | 判定方法 |
|----|------|----------|
| `W-E2E-RECORD-CRUD` | 学習記録の作成・編集・削除が UI から一周できる | Playwright e2e（`tests/e2e/study-records.spec.ts`） |
| `W-E2E-RECORD-PERSIST` | 記録がリロード後も保持される（永続化の往復） | Playwright e2e |
| `N-MAESTRO-KEYBOARD` | 記録入力でキーボード表示時に入力欄が隠れない／閉じられる | Maestro flow（keyboard フロー） |
| `RULES-RECORD-OWNER` | 学習記録は所有者のみ読み書き可（他人の userId では拒否） | Firestore rules test（`tests/firestore/rules.test.ts`） |

### HUMAN（主観・ループ終了条件にしない）
- 学習記録の一覧・編集導線が「直感的」か。
- 進捗（ページ数・カテゴリ）の見え方が分かりやすいか。
- 入力に必要なタップ数が過剰でないか。

---

## ゴール③ 動作が重くなく、記録データがしっかり管理されていること

### AUTO（verify.sh）
| ID | 内容 | 判定方法 |
|----|------|----------|
| `TYPECHECK` | `tsc --noEmit` が通る | TypeScript |
| `LINT` | ESLint が通る | ESLint（設定は未導入 → 現状 SKIP/FAIL） |
| `BUILD` | 本番ビルドが成功する | `vite build` |
| `UNIT` | ユニットテストが緑 | Vitest（未導入 → SKIP） |
| `F-LISTENER-LEAK` | `onSnapshot` の戻り値を捨てている（解除されない）箇所が無い | 静的解析（grep ヒューリスティック） |
| `F-LISTENER-BUDGET` | 同時 `onSnapshot` リスナー数が予算内（既定上限: 14、現状 12） | 静的カウント |
| `F-RUNTIME-BUDGET` | 代表的な1セッションの Firestore 実行時トラフィック（WebChannel POST バースト）が予算内 | Playwright で `/Listen/channel`・`/Write/channel` POST を計測 |
| `RULES-DENY-DEFAULT` | ルール未定義パスはデフォルト拒否される | Firestore rules test |
| `W-LH-PERF-BUDGET` | パフォーマンス予算内（再掲） | Lighthouse CI |

#### Firestore 予算の定義
- **リスナー予算**: 同時 `onSnapshot` 購読 ≤ `14`（`verify.sh` の `MAX_LISTENERS`）。
- **実行時トラフィック予算 / セッション**（`F-RUNTIME-BUDGET`）: Firebase JS SDK は Firestore を
  WebChannel で話すため、生の document reads/writes ではなく **クライアント→サーバの POST バースト数**を
  計測する（読み取り = `/Listen/channel`、書き込み = `/Write/channel`）。リスナー暴走や書き込みループは
  この値の急増として確実に捕まる。
  - 代表シナリオ: ログイン→フィード表示→学習対象1件作成→投稿1件。
  - **実測（2026-06-21）**: `listen=6` / `write=8`。WebChannel の batching で run ごとに多少ぶれるため、
    回帰検知力を保ちつつ flaky にならない範囲でヘッドルームを乗せ、上限は `listen ≤ 30` / `write ≤ 20`。
  - しきい値は `tests/e2e/firestore-budget.spec.ts` の `LISTEN_BUDGET` / `WRITE_BUDGET` と同期させること。
- **リスナー解除**: すべての `onSnapshot` は `useEffect` の cleanup または明示的 `unsubscribe` で解除されること（`F-LISTENER-LEAK`）。

### HUMAN（主観・ループ終了条件にしない）
- 体感速度（初回表示・画面遷移）が「重くない」と感じられるか。
- データ欠損・重複などの異常が無いか（実運用の目視確認）。

---

## 運用メモ
- ループは **AUTO の FAIL がゼロ** になることを終了条件とする。`SKIP` はツール導入・配線待ちで、潰すべき対象だが「赤」とは別管理。
- `verify.sh web` で Web 層のみ、`RUN_NATIVE=1 ./verify.sh` でネイティブ層も実行。
- 予算値（`MAX_LISTENERS` 等）は `verify.sh` 冒頭の定数で一元管理する。
