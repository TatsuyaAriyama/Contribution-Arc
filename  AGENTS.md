# AGENTS.md

# Contribution Arc

Contribution Arc は、
学習記録を「積み上げ」として可視化し、
継続する楽しさを体験できる洗練された学習記録サービス。

単なる記録アプリではなく、

- 静かな没入感
- 成長の実感
- コミュニティの熱量
- 毎日開きたくなる心地良さ

を重視した、
プロダクト品質の高い空間を目指す。

---

# Core Philosophy

「動けばいい」は禁止。

Contribution Arc では、

- 空気感
- 世界観
- 触り心地
- 滑らかさ
- 高級感
- 継続したくなる感覚

を最優先する。

常に、
公式サービスレベルの完成度を維持すること。

---

# Design Direction

## Theme

- White & Black Base
- Minimal
- Elegant
- Premium
- Modern
- Official Product Quality

---

## Color Rules

基本カラーは：

- White
- Black
- Gray

のみを使用する。

---

## Accent Color

緑は特別な意味を持つ。

使用して良いのは：

- Logo
- Contribution
- Growth
- Streak
- Activity
- Success State

のみ。

---

## Exception

棒グラフ・統計・データ可視化は、
視認性を優先してカラー使用を許可する。

ただし、
全体世界観を壊さないこと。

---

# UI Quality Rules

全体的に、
「安っぽさ」を徹底的に排除する。

禁止：

- 強すぎる色
- 子供っぽい装飾
- 過剰なグラデーション
- 過剰な角丸
- 古いUIデザイン
- 情報の詰め込み
- ダサい hover
- 不自然な animation

---

# Official Product Quality

以下のような品質感を目指す：

- Apple
- Linear
- Notion
- GitHub
- Stripe
- Vercel

のような、
静かで洗練されたUI。

---

# Motion Philosophy

動きは必須。

ただし、
派手さではなく、
「気持ち良さ」を重視する。

---

# Motion Rules

- 滑らかな transition
- 上質な hover animation
- 微細な scale
- opacity の丁寧な変化
- scroll に没入感を持たせる
- cursor hover を心地良くする
- loading に世界観を持たせる

---

## Forbidden Motion

禁止：

- ガタつく animation
- 過剰バウンド
- 安っぽい hover
- 急加速 animation
- 長すぎる transition

---

# UX Philosophy

ユーザーが、

「なんかずっと触っていたい」

と感じることを最優先する。

---

# Community Direction

Contribution Arc は、
静かなコミュニティ感を演出する。

直接会話しなくても、

- 誰かも頑張っている
- 今日も積み上げている
- 学習が流れている

空気を感じられる設計にする。

---

# Community UX

推奨：

- Activity Timeline
- Contribution Heatmap
- Learning Streak
- Quiet Ranking
- Live Activity
- User Presence
- Growth Visualization

---

# Development Philosophy

## Small Steps First

巨大実装は禁止。

必ず：

1. 小さく作る
2. 動作確認する
3. 理解しながら修正
4. 小さく commit
5. 徐々に拡張

を徹底する。

---

# Tech Stack

- React
- TypeScript
- Vite
- Firebase
- Firestore

---

# Coding Rules

## General

- any 禁止
- 型安全を重視
- 可読性優先
- シンプルに保つ
- 保守性を重視

---

## Component Rules

- 1ファイル1責務
- UI とロジックを分離
- 巨大コンポーネント禁止
- 再利用性を意識

---

# Security Rules

## Important

機密情報を絶対に読み取らない。

---

## Forbidden

- .env の参照
- Secret Key の出力
- API Secret の表示
- Token の表示
- Webhook URL の表示
- Firebase Admin SDK 秘密鍵の参照
- 個人情報の収集

---

## Security Policy

- env 管理を徹底
- 本番データを壊さない
- Firestore Rules を意識
- 認証情報をコードに直書きしない

---

# Git Rules

commit は小さく行う。

Good:

- feat: add contribution animation
- fix: improve sidebar motion
- style: refine official UI spacing

Bad:

- update
- fix
- various changes

---

# AI Assistant Rules

AI は補助として使用する。

---

## AI Guidelines

推奨：

- 小さな変更
- 段階的実装
- 世界観維持
- 保守性重視
- 洗練されたUI提案

禁止：

- 一括巨大生成
- ダサいUI
- 安っぽいデザイン
- 不要ライブラリ追加
- 複雑すぎる設計
- 勝手な構造変更

---

# Important

コードを変更する前に、
必ず既存の世界観とUIを確認すること。

「動けばいい」ではなく、
Contribution Arc の没入感と高級感を維持することを最優先する。

---

# Final Philosophy

Contribution Arc は、
効率だけを追うサービスではない。

ユーザーが、

「今日も少し積み上げられた」

と静かに実感できる、
居心地の良い学習空間を目指す。