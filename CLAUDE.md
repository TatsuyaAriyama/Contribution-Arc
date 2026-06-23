# Contribution Arc — Claude working notes

## Reporting after finishing work

When a task is complete and merged/deployed, share **only** the live site
URL in the final message. Nothing else — no PR link, no commit hash, no
Actions link.

```
https://tatsuyaariyama.github.io/Contribution-Arc/
```

## Merging / deploying

本番反映は基本的に `main` への直接マージで進めてよい（毎回の確認は不要）。
feature ブランチで作業 → ビルドが通ることを確認 → `main` にマージして
push すると、`deploy.yml` が走り github.io に反映される。PR は明示的に
求められたときだけ作成する。

**毎回必ず本番に反映させること**。タスクが完了したら、コミット → push →
`main` マージ → push まで一連で実行し、デプロイ成功を確認してから URL
を返す。ユーザーから「反映して」と都度言われなくても、常にこの流れで
進める。

## Working language

作業中の思考（thinking / reasoning）は日本語で行うこと。ユーザーへの
返答も日本語を基本とする。

## デザインシステム

UI を実装するときは必ず `DESIGN.md` を参照してスタイル（色、余白、
角丸、影、タイポ、コンポーネントのバリエーション等）を適用すること。
新規 CSS を書くときも、既存ルールを変更するときも、まず DESIGN.md の
規約に合わせる。DESIGN.md に該当が無いケースを見つけたら、勝手に
新規スタイルを生やさず、ユーザーに確認するか DESIGN.md への追記提案
を行う。

## ループ協議

「ループ」と言われたら、各タスクを「直線」ではなく「ループ」として
走らせる。

1. 変更を書く
2. チェックを走らせる: テスト + linter + 型チェック
3. 失敗した? エラーを読み、原因を特定し、直して、2 に戻る

ループは最大 5 回まで。

**停止条件:**
- 全チェック通過 → 「完了」と報告。通過した出力を証拠として添える
- 5 回使い切った → 止まって、何が残っているか報告する
- 同じエラーが 2 回連続 → ループを止め、`@fixer` を呼ぶよう促す

**禁止:**
- チェック出力なしで「完了」と報告すること
- アサーション削除やテスト弱体化で通すこと。直すのはコードであって、
  スコアボードではない
