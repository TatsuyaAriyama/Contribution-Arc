---
version: alpha
name: Contribution Arc
description: A quiet, paper-warm learning workspace built on a low-chroma off-white canvas, near-ink Inter type, and a single confident forest green. Chrome stays muted so the user's積み上げ (study logs, daily reports, FEED posts) feels like the only thing on screen. Dark mode mirrors the same restraint with pure black + bright spring green.

colors:
  primary: "#1f6f4a"
  primary-active: "#2d8a5b"
  primary-soft: "#dce8e1"
  on-primary: "#ffffff"
  cta-bg: "#111827"
  cta-fg: "#ffffff"
  canvas: "#fafaf8"
  surface: "#ffffff"
  surface-warm: "#fffdfa"
  surface-elevated: "#ffffff"
  ink: "#111827"
  ink-strong: "#0a0f1c"
  ink-muted: "#6b7280"
  hairline: "#e5e7eb"
  hairline-soft: "rgba(17, 24, 39, 0.06)"
  hairline-strong: "rgba(17, 24, 39, 0.12)"
  accent-rare: "#c8a95b"
  accent-warm: "#d3573b"
  accent-auto-workspace: "#3a5bb7"
  accent-auto-study: "#2c8a5a"
  reward-gold: "#d49a1a"

  # Dark theme overrides — applied via [data-theme="dark"]
  dark-canvas: "#000000"
  dark-surface: "#16181c"
  dark-surface-elevated: "#1e2024"
  dark-ink: "#ffffff"
  dark-ink-muted: "#a7adb3"
  dark-hairline: "rgba(255, 255, 255, 0.14)"
  dark-primary: "#4ade80"
  dark-primary-active: "#6ee7b7"
  dark-primary-soft: "rgba(74, 222, 128, 0.16)"
  dark-cta-bg: "#ffffff"
  dark-cta-fg: "#000000"
  dark-accent-rare: "#fbbf24"
  dark-accent-warm: "#fb923c"

typography:
  display-1:
    fontFamily: Inter
    fontSize: 46px
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: 0
  display-2:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 850
    lineHeight: 1.1
    letterSpacing: 0
  heading-1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: 0
  heading-2:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0
  heading-3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: 0
  title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0
  eyebrow:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: 0.08em

rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 18px
  xxl: 24px
  modal: 26px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 22px
  xl: 28px
  xxl: 40px

shadow:
  hairline: "0 1px 0 rgba(17, 24, 39, 0.02)"
  card: "0 1px 3px rgba(17, 24, 39, 0.04), 0 6px 22px rgba(17, 24, 39, 0.05)"
  card-elevated: "0 18px 58px rgba(17, 24, 39, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)"
  modal: "0 30px 90px rgba(17, 24, 39, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)"
  toast: "0 20px 48px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.18)"
  cta-press: "0 14px 32px rgba(17, 24, 39, 0.18)"
  focus-ring: "0 0 0 3px rgba(31, 111, 74, 0.22)"

components:
  app-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"

  card:
    description: "基本コンテンツカード。FEED の親枠、プロフィール、設定セクションで使い回す。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xxl}"
    padding: "{spacing.lg}"
    shadow: "{shadow.card-elevated}"
    border: "1px solid {colors.hairline-soft}"

  log-post-card:
    description: "FEED のタイムライン投稿カード。手動投稿と auto-* 自動投稿のどちらも同じ chrome。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
    shadow: "{shadow.hairline}"

  button-cta:
    description: "アプリ全体の主要 CTA。ink-on-canvas で最も目立つ唯一の塗りボタン。"
    backgroundColor: "{colors.cta-bg}"
    textColor: "{colors.cta-fg}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    pressShadow: "{shadow.cta-press}"

  button-primary:
    description: "ブランドアクセントを乗せたい 2 次的な CTA（投稿送信、達成系）。"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "10px 18px"

  button-secondary:
    description: "セクション内の補助ボタン。塗らずに hairline で輪郭を出す。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "10px 18px"
    border: "1px solid {colors.hairline-strong}"

  button-utility:
    description: "ナビ / メニューの小型ボタン。pill ほど主張せず、角を md に抑える。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    border: "1px solid {colors.hairline}"

  badge-pill:
    description: "ピル形バッジ（status / Lv バッジなど）。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
    border: "1px solid {colors.hairline-strong}"

  player-chip:
    description: "🔥連続日数 / Lv / GitHub などの細長いチップ。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    border: "1px solid {colors.hairline-strong}"

  log-post-auto-badge-study:
    description: "学習記録の自動投稿バッジ「📘 学習ログ」。"
    backgroundColor: "rgba(70, 160, 110, 0.14)"
    textColor: "{colors.accent-auto-study}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "2px 8px"

  log-post-auto-badge-workspace:
    description: "作業部屋退室の自動投稿バッジ「✦ 作業ログ」。"
    backgroundColor: "rgba(80, 110, 200, 0.12)"
    textColor: "{colors.accent-auto-workspace}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "2px 8px"

  text-input:
    description: "1 行入力、テキストエリア共通の field chrome。pill にせず角を抑える。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    border: "1px solid {colors.hairline}"
    focusShadow: "{shadow.focus-ring}"

  modal-backdrop:
    description: "モーダル背景。blur + 半透明 ink で背面コンテンツを沈める。"
    backgroundColor: "rgba(17, 24, 39, 0.18)"
    backdropBlur: "10px"
    zIndex: 100

  modal:
    description: "中央配置のシート/モーダル本体（設定、日報詳細など）。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
    padding: "26px"
    shadow: "{shadow.modal}"
    border: "1px solid rgba(31, 111, 74, 0.14)"

  toast:
    description: "ボトム固定のステータストースト。常にダーク（ライト/ダーク両モード共通）。"
    backgroundColor: "rgba(15, 23, 42, 0.94)"
    textColor: "#fafafa"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    shadow: "{shadow.toast}"
    zIndex: 200

  daily-reward-banner:
    description: "日報「両方共有で +50 Arc」インセンティブバナー。未達は緑グラデ + 緑チップ、獲得済 (is-earned) は金グラデに切替え。"
    backgroundColor: "linear-gradient(135deg, rgba(44, 138, 90, 0.18), rgba(80, 180, 130, 0.28))"
    textColor: "#0f3a25"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: "12px 14px"
    border: "1px solid rgba(44, 138, 90, 0.45)"
  daily-reward-banner-earned:
    description: "獲得済みステート。金色グラデで「今日は終わった、明日もどうぞ」を伝える。"
    backgroundColor: "linear-gradient(135deg, rgba(255, 200, 70, 0.32), rgba(255, 180, 60, 0.42))"
    textColor: "#5a3a08"
    border: "1px solid rgba(180, 130, 20, 0.55)"

  profile-character-preview:
    description: "ユーザーの「分身キャラ」を表示する 1:1 ステージ。グリッドラインの背景で workspace 感を出す。"
    backgroundColor: "#fafafa"
    rounded: "{rounded.xxl}"
    shadow: "0 18px 46px rgba(17, 24, 39, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)"

  shape-tile:
    description: "キャラクター形 / アバター選択タイル。active 時に primary 枠で強調。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "10px"
    border: "1px solid {colors.hairline}"
    activeBorder: "2px solid {colors.primary}"

  bottom-nav:
    description: "モバイル底部のタブナビ。z-index 70。active 4px グリーンドット表示。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.eyebrow}"
    zIndex: 70

  topbar-popover:
    description: "検索 / ユーザーメニューのポップオーバー。モバイルでは position:fixed で画面端に張り付かないよう調整。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm}"
    shadow: "{shadow.card-elevated}"

  announcement-trigger:
    description: "ホームの「お知らせ」アコーディオン。左 4px 赤アクセント、26px の赤シェブロン。"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    accentColor: "#e53935"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"

---


## Overview

Contribution Arc は「静かな書斎」のような学習トラッキング SNS。背景は紙のような暖かい off-white `{colors.canvas}` (#fafaf8) に Inter の太字。アクセントは森のような深緑 `{colors.primary}` (#1f6f4a) ひとつだけで、それも CTA・タイトル下線・focus リングなど「ここを見て」というポイントにしか使わない。残りのチャンクは hairline と barely-there な shadow で「紙の層」を作るだけ。

唯一目立つ CTA は深紺の `{colors.cta-bg}` (#111827) で塗った pill ボタンで、ユーザー名 / 投稿送信 / 設定確定など「次のアクション」を必ず ink-on-canvas で表す。ブランド緑はそこから一歩引いて、ステータス・アクセント・データの「達成感」を担当する。

ダークモードは黒の真上に白テキストを置く Twitter/Instagram 流の純色設計に切り替わる。背景 `#000000` に surface `#16181c`、緑は明るい新緑 `#4ade80` に反転、CTA も `#ffffff` 塗り + 黒文字に polarity flip するので、暗所でも「ここを押す」が即座に分かる。

タイポは Inter 一族で統一。本文は 14px / weight 600 で読みやすく、見出しは 28〜46px / weight 800〜900 でガッとくる。letter-spacing はほぼ 0、ただし eyebrow（小キャプション）だけ +0.08em でセンタリングする。

シャドウは「浮かせる」のではなく「紙の層を重ねる」感覚。`{shadow.card-elevated}` のように外側に大きく薄く、内側 inset で 1px の白ハイライトを足す形が定番。

**Key Characteristics:**
- Warm paper canvas `{colors.canvas}` (#fafaf8) / pure white `{colors.surface}` for cards — 図書館の机
- Single structural accent: forest green `{colors.primary}` — ステータス、達成、focus signal
- 唯一の塗り CTA は ink-on-canvas `{colors.cta-bg}` — pill `{rounded.full}` で「次のアクション」を独占
- Inter のみ、display は 800〜900 で重く、本文は 14px / 600 で読みやすく
- 自動投稿（学習ログ / 作業ログ）専用のセカンダリアクセント (#2c8a5a / #3a5bb7) を tiny pill badge にだけ使う
- Elevation = hairline + 多層 micro shadow（`{shadow.card-elevated}`）。heavy drop shadow は使わない
- ダークモードは「純黒 + 純白 + 明るい緑」へ polarity flip、CTA も白塗り黒文字に逆転

## Colors

### Brand & Accent
- **Forest Green** (`{colors.primary}` — #1f6f4a): 唯一の構造アクセント。focus リング、Lv 上昇、達成ステート、リンク、ブランド sprite の塗り。
- **Active Green** (`{colors.primary-active}` — #2d8a5b): hover / pressed。
- **Soft Green** (`{colors.primary-soft}` — #dce8e1): 達成 chip、リワード banner の優しい背景。
- **CTA Ink** (`{colors.cta-bg}` — #111827) / **CTA Surface** (`{colors.cta-fg}` — #ffffff): 主要 CTA は塗りで ink-on-canvas、これだけが「最も濃い塗り」になる。

### Secondary Accents
- **Rare Gold** (`{colors.accent-rare}` — #c8a95b): 称号「Rare+」、レアアイテム、reward 獲得済バナーの金色。
- **Warm Coral** (`{colors.accent-warm}` — #d3573b): 危険操作 / 警告（解体ボタンなど）の唯一の暖色。
- **Auto-Workspace Blue** (`{colors.accent-auto-workspace}` — #3a5bb7): 作業部屋 auto-post バッジ専用。
- **Auto-Study Green** (`{colors.accent-auto-study}` — #2c8a5a): 学習ログ auto-post バッジ専用。
- **Reward Gold** (`{colors.reward-gold}` — #d49a1a): 日報報酬獲得済 (is-earned) のアイコン丸塗り。

### Surface
- **Canvas** (`{colors.canvas}` — #fafaf8): ページ全面。warm off-white、紙の机。
- **Surface** (`{colors.surface}` — #ffffff): カード / モーダル / nav の上層。
- **Surface Warm** (`{colors.surface-warm}` — #fffdfa): 一部の暖かい見せ場（onboarding カードなど）。

### Text
- **Ink** (`{colors.ink}` — #111827): 本文と見出し。
- **Ink Strong** (`{colors.ink-strong}` — #0a0f1c): 見出し最強調。
- **Ink Muted** (`{colors.ink-muted}` — #6b7280): キャプション / hint / placeholder。

### Lines
- **Hairline** (`{colors.hairline}` — #e5e7eb): 1px の card border。
- **Hairline Soft** (`rgba(17, 24, 39, 0.06)`) / **Hairline Strong** (`rgba(17, 24, 39, 0.12)`): 強弱の境界。

### Dark Mode
ライトの全てのトークンが `[data-theme="dark"]` で書き換わる。canvas は純黒、ink は純白、緑は #4ade80、CTA は polarity flip で白塗り黒文字に。

### Semantic
- **成功 / 達成**: ブランド緑 `{colors.primary}` または `{colors.accent-auto-study}`
- **金 / レア / 報酬獲得済み**: `{colors.accent-rare}` `{colors.reward-gold}`
- **警告 / 暖色アクセント**: `{colors.accent-warm}`
- **エラー**: 専用のエラー色は持たず、文中ラベルで伝える（赤を増やさない設計判断）

## Typography

### Font Family
全文 **`Inter`**（fallback: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial`）。serif / monospace は使わない。OpenType `lnum` を本文 / 数値で有効にし、player chip の Lv 数字を等幅に揃える。

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-1}` | 46px | 900 | 1.05 | 0 | 最大ヒーロー（オンボーディング、ホーム入口） |
| `{typography.display-2}` | 32px | 850 | 1.1 | 0 | セクションヒーロー |
| `{typography.heading-1}` | 28px | 800 | 1.1 | 0 | ページタイトル |
| `{typography.heading-2}` | 22px | 800 | 1.2 | 0 | サブセクション |
| `{typography.heading-3}` | 18px | 800 | 1.25 | 0 | カードタイトル |
| `{typography.title}` | 16px | 700 | 1.35 | 0 | ミニ見出し |
| `{typography.body-md}` | 14px | 600 | 1.55 | 0 | 既定の本文 |
| `{typography.body-sm}` | 13px | 600 | 1.5 | 0 | 日付、メタ、密集 UI |
| `{typography.button}` | 14px | 700 | 1.0 | 0 | ボタンラベル |
| `{typography.caption}` | 12px | 700 | 1.4 | 0 | 補助テキスト |
| `{typography.eyebrow}` | 11px | 800 | 1.3 | +0.08em | カード kicker、badge、pill chip |

### Principles
**重く・短く・静か**。display は weight 900 でぐっと締める。本文は 600 という重めの常用ウェイトで、Inter 400 にしない（ブランドの「決意感」を保つため）。eyebrow は唯一 positive letter-spacing を持つロールで、`UPPER` か日本語小キャプションを揃える。letter-spacing で英文を伸ばすことはしない（letter-spacing は読みやすさのため 0 が基準）。

### Substitutes
Inter が読み込めない環境では `system-ui` にフォールバック。display / heading のウェイトを system フォントの最も近い semi-bold/bold に差し替える。

## Layout

### Spacing System
- **Base unit**: 4px。
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 22px · `{spacing.xl}` 28px · `{spacing.xxl}` 40px。
- カード内 padding は `{spacing.lg}` 前後、モーダルは 26px、ボトムナビ上端の toast offset は 120px（モーダル開いていてもフッターと被らない位置）。

### Grid & Container
- 標準 max-width は 1080px、サイドバー含むレイアウトは 1200〜1280px まで広げる。
- モバイルは calc(100vw - 32px) で 16px ずつのマージンを保証。
- ホーム / FEED は 1 カラム、プロフィールは 2 カラム（Player Status 左 / Character Card 右）。

### Whitespace Philosophy
線で区切らず、空白で区切る。セクション間は 24〜40px の縦余白で離し、カード同士は 12〜16px gap。罫線を引きたくなったら hairline と影だけで止める。

### Responsive Strategy

#### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Wide | 1440px+ | 2 カラム以上のプロフィール / 設定 |
| Desktop | 1080–1300px | 標準 1080px 中央寄せ |
| Tablet | 720–1080px | 2 カラムは 1 カラムへ落ちる場合あり |
| Mobile | ≤720px | 1 カラム、ボトムナビ表示、トースト bottom 120px |

#### Touch Targets
タップ可能要素は最低 44×44px。pill ボタンは padding `12px 20px` でこの境界を確保。

#### Collapsing Strategy
- トップバーのナビ要素は順序 `order: 80/90` で右端優先、左から落ちる。
- ポップオーバー（検索、ユーザーメニュー）はモバイルで `position: fixed` に切り替えて viewport 端に張り付かない。
- ボトムナビ active 状態は 4px 緑ドット + spring transition。

#### Image Behavior
画像は `{rounded.lg}` または `{rounded.xl}` の枠に scale fluidly。avatar は full radius 円。

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Hairline | 1px `{colors.hairline-soft}`、shadow なし | 既定のカード、リスト行 |
| 1 — Card | `{shadow.card}` (2 stop micro shadow) | FEED 投稿、player chip 周辺 |
| 2 — Elevated | `{shadow.card-elevated}` (外側 + inset 白ハイライト) | プロフィール card、character preview、設定セクション |
| 3 — Modal | `{shadow.modal}` (30/90 stop) + backdrop blur 10px | settings-modal、daily-detail-modal |
| 4 — Toast | `{shadow.toast}` 固定ダーク + backdrop-filter blur 20px | ステータストースト |
| Focus | `{shadow.focus-ring}` (3px 緑 22% alpha) | キーボード focus 全般 |

### Decorative Depth
ブランドの「奥行き感」は影ではなく **キャラクター sprite + コントリビューショングリッド**で出す。プロフィールの分身キャラは grid 背景の上に立ち、studyLog の積み上げが下にゆっくり溜まる。インタラクションは framer-motion の spring（duration 0.18〜0.22s, cubic-bezier(0.34, 1.56, 0.64, 1)）で柔らかく着地する。

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | tiny tags |
| `{rounded.sm}` | 8px | utility button、small input |
| `{rounded.md}` | 12px | text input、ボトムナビ button |
| `{rounded.lg}` | 14px | log-post-card、toast |
| `{rounded.xl}` | 18px | shape tile、small card、トップバーポップオーバー |
| `{rounded.xxl}` | 24px | 主要 card、character preview |
| `{rounded.modal}` | 26px | モーダル本体 |
| `{rounded.full}` | 9999px | pill CTA、badge、player chip、avatar |

### Photography Geometry
キャラクター sprite は `{rounded.xxl}` の grid ステージ内に常駐、avatar 写真は full radius 円。投稿カードに写真は載らない（テキスト + メタのみ）。

## Components

> **Hover states minimal.** モバイル優先のためほぼ全てのインタラクションは `:active` / `aria-pressed` で表現。`@media (hover: hover)` 限定で `:hover` を追加する箇所のみホバー記述を持つ。

### Navigation

**`bottom-nav`** — モバイル底部のタブナビ
- `{colors.surface}` 塗り、`{typography.eyebrow}` のラベル、z-index 70。アクティブタブは 4px 緑ドット + spring scale-in。タップで haptic-feel な scale 0.96 → 1。

**`topbar-popover`** — 検索 / ユーザーメニュー / 通知のポップオーバー
- `{colors.surface}` + `{shadow.card-elevated}`、`{rounded.xl}`、モバイルでは `position: fixed` で viewport 内に確実に収まる。

### Buttons

**`button-cta`** — 主要 CTA（「投稿」「送信」「保存」など）
- `{colors.cta-bg}` 塗り + `{colors.cta-fg}` 白文字、`{rounded.full}`、`{typography.button}`、padding `12px 20px`。
- press 時 `{shadow.cta-press}` + `scale(0.97)`。アプリ内で「次のアクション」を独占する唯一の塗り CTA。

**`button-primary`** — セカンダリ CTA（ブランド緑を乗せたい達成系操作）
- `{colors.primary}` 塗り + 白文字、`{rounded.full}`、`{typography.button}`。

**`button-secondary`** — 補助ボタン
- `{colors.surface}` + 1px `{colors.hairline-strong}` 輪郭、`{colors.ink}` 文字、`{rounded.full}`。

**`button-utility`** — ナビ / メニュー内の小型ボタン
- `{colors.surface}` + hairline、`{rounded.md}` のタイト角、padding `6px 12px`、`{typography.body-sm}`。

### Cards & Containers

**`card`** — 主要カード
- `{colors.surface}` + 1px `{colors.hairline-soft}`、`{rounded.xxl}` (24px)、padding `{spacing.lg}`、`{shadow.card-elevated}`。

**`log-post-card`** — FEED 投稿カード
- `{colors.surface}` + `{shadow.hairline}`、`{rounded.lg}` (14px)、padding `16px 18px`。
- `is-own` クラスで左 3px 緑アクセント、`.compact` でモバイル/プロフィール側のリストにフィット。

**`modal`** & **`modal-backdrop`**
- modal は `{colors.surface}` + `{shadow.modal}` + `{rounded.modal}`、center placement (`place-items: center`)。
- backdrop は `rgba(17, 24, 39, 0.18)` + `backdrop-filter: blur(10px)`、z-index 100。

### Inputs & Forms

**`text-input`** — 1行入力 / textarea
- `{colors.surface}` + 1px `{colors.hairline}`、`{rounded.md}` (12px) でタイト、`{typography.body-sm}`、focus 時 `{shadow.focus-ring}`。
- pill 形にはしない（pill は CTA / badge 専用の形状）。

### Status / Badges / Chips

**`badge-pill`** — Lv / ステータス バッジ
- `{colors.surface}` + 1px `{colors.hairline-strong}`、`{rounded.full}`、`{typography.eyebrow}`、padding `3px 9px`。

**`player-chip`** — 🔥連続 / Lv / GitHub などの細長チップ
- `{colors.surface}` + 1px `{colors.hairline-strong}`、`{rounded.full}`、padding `0 10px`。

**`log-post-auto-badge-study`** / **`log-post-auto-badge-workspace`** — 自動投稿バッジ
- 透過した kind 色塗り（rgba(70,160,110,.14) または rgba(80,110,200,.12)）+ kind 文字色、`{rounded.full}`、padding `2px 8px`。author 名の直後に並べる。

### Signature Components

**`daily-reward-banner`** — 日報「両方共有で +50 Arc」インセンティブ
- 緑グラデ背景 + 1px 緑枠 + `{rounded.xl}`、padding `12px 14px`。
- 進捗チップ（plan / reflection）は未達は白背景 + 緑枠 + 緑文字、達成は緑塗り + 白文字に切替え。
- `is-earned` で金色グラデ + 金枠 + reward-gold 塗りアイコンに polarity flip。

**`profile-character-preview`** — 分身キャラのステージ
- `#fafafa` の grid 背景、`{rounded.xxl}`、深い inset shadow。プロフィールのヒーロー要素として center に配置。

**`shape-tile`** — キャラ形 / アイテム選択タイル
- `{colors.surface}` + 1px hairline + `{rounded.xl}`。active は 2px `{colors.primary}` 枠 + 中央 ✓ アイコン、locked は半透明 + 🔒。

**`toast`** — ステータストースト
- `rgba(15, 23, 42, 0.94)` 固定ダーク + 白文字（ライト/ダーク両モード共通）、`{rounded.lg}`、`{shadow.toast}` + backdrop-filter blur(20px)。
- `position: fixed` を確実にするため React Portal で document.body にマウント。z-index 200 でモーダル背景（100）の上に乗る。

**`announcement-trigger`** — ホームのお知らせアコーディオン
- `{colors.surface}` + 左端 4px 赤アクセント (`#e53935`) + 右端 26px 赤シェブロン。ピン留め + 最新 1 件のみ表示し、それ以外は一覧モーダルへ。


## Do's and Don'ts

### Do
- 主要 CTA は **`{colors.cta-bg}` 塗りの pill ひとつ** で表現する。アクションが渋滞したら 1 つだけ pill、残りは `button-secondary`。
- ブランド緑 `{colors.primary}` は「達成 / focus / アクセント」だけに使う。背景に塗らない。
- 本文は `{typography.body-md}` 14px / weight 600。weight 400 は使わない（ブランドの「決意感」が抜けるため）。
- カードは hairline + `{shadow.card-elevated}` の組み合わせで「紙の層」を作る。重いドロップシャドウは使わない。
- pill `{rounded.full}` は CTA / badge / chip / avatar 専用。
- 入力フィールドは `{rounded.md}` (12px) でタイトに留める。
- 自動投稿バッジは「📘 学習ログ」「✦ 作業ログ」のいずれかで、kind 色は変えない。
- モーダルの上に出るオーバーレイ要素（toast、popover）は必ず Portal で document.body に出して `position: fixed` の祖先 transform 罠を避ける。
- 色とウェイトのコントラストで階層を作る（罫線を引かない、塗りを増やさない）。
- ダークモードは「全部書き直す」のではなく `[data-theme="dark"]` で token を polarity flip するだけ。

### Don't
- ❌ 赤・紫・水色を構造色として使わない。エラーも `{colors.accent-warm}` か文中ラベルで伝える。
- ❌ pill `{rounded.full}` を入力フィールドや本文カードに使わない。
- ❌ 本文に weight 400 / 500 を使わない。最低 600。
- ❌ heavy drop shadow（`0 8px 32px rgba(0,0,0,0.4)` 級）を card に塗らない。modal だけが許される。
- ❌ ブランド緑を背景の塗り潰しに使わない（pill ボタン、bar accent、focus ring 専用）。
- ❌ letter-spacing を本文に効かせない（eyebrow のみ +0.08em）。
- ❌ canvas に純白 (#ffffff) を全面で敷かない。`{colors.canvas}` の warm off-white を維持する。
- ❌ 2 つ目の構造アクセント色を追加しない。新しい色を増やしたくなったら、まず既存の `{colors.primary}` / `{colors.cta-bg}` / `{colors.accent-warm}` で代用できないか検討する。
- ❌ モーダルの中に position: fixed を直接置かない（祖先 motion.main の transform で祖先基準になる）。Portal を使う。
- ❌ 「ホバーで色が変わる」だけの装飾を増やさない。モバイル優先のため `:active` / `aria-pressed` で状態を表すのが基本。
