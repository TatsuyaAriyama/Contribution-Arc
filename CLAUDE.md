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
