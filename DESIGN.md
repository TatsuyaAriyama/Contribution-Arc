---
version: alpha
name: Contribution Arc
description: A strictly black-and-white, minimal study workspace. White surfaces, near-black text, thin neutral-gray hairlines. No accent color, no decoration, no serif or hand-drawn flourishes — hierarchy comes from the type scale and whitespace alone.

colors:
  bg: "#ffffff"
  surface: "#ffffff"
  ink: "#1a1a1a"
  ink-strong: "#000000"
  ink-muted: "#6b6b6b"
  hairline: "#e6e6e6"
  hairline-soft: "rgba(0, 0, 0, 0.06)"
  hairline-strong: "rgba(0, 0, 0, 0.12)"
  fill-soft: "rgba(0, 0, 0, 0.04)"
  cta-bg: "#000000"
  cta-fg: "#ffffff"

typography:
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
  display:
    fontSize: 34px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.02em
  heading-1:
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.01em
  heading-2:
    fontSize: 17px
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.55
  body-sm:
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  eyebrow:
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.04em

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 22px
  xl: 28px

components:
  card:
    description: 基本コンテンツカード。白地 + 1px グレー罫線のフラット。影は使わない。
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
    border: "1px solid {colors.hairline}"

  button-cta:
    description: 唯一の塗りボタン。黒 pill + 白文字。画面内で「次のアクション」を独占する。
    backgroundColor: "{colors.cta-bg}"
    textColor: "{colors.cta-fg}"
    rounded: "{rounded.full}"
    padding: "12px 18px"

  button-secondary:
    description: 補助ボタン。塗らず 1px 罫線で輪郭を出す。
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
    border: "1px solid {colors.hairline-strong}"

  stat-tile:
    description: 数値タイル(今日の学習・連続日数など)。薄い ink 塗り、色は付けない。
    backgroundColor: "{colors.fill-soft}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.md}"
    padding: "8px 10px"

  contribution-cell:
    description: 積み上げグリッドのセル。1 色(黒インク)の濃淡 5 段で活動量を表す。緑は使わない。
    scale: "lv-0 rgba(0,0,0,0.06) / lv-1 0.22 / lv-2 0.42 / lv-3 0.66 / lv-4 0.90"

---


## Overview

Contribution Arc は **白黒ミニマル** の学習トラッキングアプリ。背景は白 `#ffffff`、
文字は近黒 `#1a1a1a`、区切りは薄いグレー罫線。**アクセント色を持たない** —
緑・金・赤・青などの構造色は一切使わず、階層は **タイポグラフィ（サイズと
ウェイト）と余白** だけで作る。

唯一の塗りは主要 CTA の黒 pill（白文字）。それ以外の要素は「白地・黒文字・
グレー罫線」の三要素で構成する。装飾（紙テクスチャ・マスキングテープ・
カードの傾き・手描きの下線・明朝体・グラデーション・影の演出）は使わない。

**Key Characteristics:**
- 白 `#ffffff` サーフェス、近黒 `#1a1a1a` テキスト、薄グレー `#e6e6e6` 罫線
- アクセント色ゼロ。強調は色ではなくウェイトと余白で
- 唯一の塗り CTA は黒 pill + 白文字
- フォントは Inter のみ（serif/明朝・monospace は使わない）
- カードはフラット（1px 罫線のみ、ドロップシャドウを盛らない）
- 積み上げグリッドは黒インクの濃淡 5 段

## Colors

| Token | Value | Use |
|---|---|---|
| `{colors.bg}` / `{colors.surface}` | `#ffffff` | ページとカードの地。白。 |
| `{colors.ink}` | `#1a1a1a` | 本文・見出しの近黒。 |
| `{colors.ink-strong}` | `#000000` | 最強調（大きな数値・見出し）。 |
| `{colors.ink-muted}` | `#6b6b6b` | キャプション・メタ・placeholder。 |
| `{colors.hairline}` | `#e6e6e6` | 1px カード罫線・区切り線。 |
| `{colors.fill-soft}` | `rgba(0,0,0,0.04)` | stat タイルなどの薄い塗り。 |
| `{colors.cta-bg}` / `{colors.cta-fg}` | `#000000` / `#ffffff` | 主要 CTA の黒 pill。 |

> **色は増やさない。** 「達成」「成功」「注意」などの意味づけも色では
> 表さず、文言・ウェイト・配置で伝える。実装上のトークン（`--ink` /
> `--muted` / `--line` など）はほぼ中立なグレースケールで、これをそのまま
> 使う。緑（`--green`）は本デザインでは使用しない。

## Typography

全文 **Inter**（fallback: `ui-sans-serif, system-ui, -apple-system, "Segoe UI",
sans-serif`）。serif / 明朝 / monospace は使わない。数値は `tabular-nums` で桁を
揃える。

| Token | Size | Weight | Use |
|---|---|---|---|
| `{typography.display}` | 34px | 800 | 画面ヒーロー（日付など）。 |
| `{typography.heading-1}` | 22px | 800 | ページタイトル。 |
| `{typography.heading-2}` | 17px | 800 | カードタイトル。 |
| `{typography.title}` | 15px | 700 | ミニ見出し。 |
| `{typography.body}` | 14px | 600 | 既定の本文。 |
| `{typography.body-sm}` | 13px | 600 | メタ・密集 UI。 |
| `{typography.caption}` | 12px | 600 | 補助テキスト。 |
| `{typography.eyebrow}` | 11px | 700 | ラベル・kicker（+0.04em）。 |

**原則:** 重く・短く・静か。本文は weight 600 以上（400/500 は使わない）。
強調はサイズとウェイトで作り、`letter-spacing` は eyebrow を除き 0 前後に留める。

## Layout

- **Base unit:** 4px。spacing は `{spacing.xs}` 8 / `{spacing.sm}` 12 /
  `{spacing.md}` 16 / `{spacing.lg}` 22 / `{spacing.xl}` 28。
- カード内 padding は 18〜20px。カード同士は 12〜14px の縦 gap。
- **線で区切らず、余白で区切る。** 罫線を足したくなったら、まず余白で
  離せないか検討する。引くときは 1px の `{colors.hairline}` 一択。
- モバイル優先。タップ可能要素は最低 44×44px。

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 8px | 小さいタグ・チップ。 |
| `{rounded.md}` | 12px | stat タイル・入力。 |
| `{rounded.lg}` | 16px | カード。 |
| `{rounded.full}` | 9999px | CTA pill・アバター。 |

pill（`{rounded.full}`）は CTA とアバター専用。入力・本文カードには使わない。

## Elevation

原則フラット。奥行きは **1px 罫線** で表し、ドロップシャドウは盛らない
（モーダルなど本当に浮かせる必要がある層でのみ、ごく控えめに 1 段）。
`0 8px 32px` 級の重い影は使わない。

## Components

**`card`** — 白地 + 1px `{colors.hairline}` + `{rounded.lg}`、padding 18〜20px。
影なしのフラット。

**`button-cta`** — 黒 `{colors.cta-bg}` + 白文字 `{colors.cta-fg}`、`{rounded.full}`。
画面内で唯一の塗りボタン。press で `scale(0.98)`。

**`button-secondary`** — 白地 + 1px `{colors.hairline-strong}` 輪郭、`{colors.ink}` 文字。

**`stat-tile`** — `{colors.fill-soft}` の薄い塗り、`{rounded.md}`。ラベルは
`{typography.eyebrow}` の muted、値は `{typography.heading-2}` 相当の ink-strong。
色は付けない。

**`contribution-cell`** — 積み上げグリッドのセル。緑スケールをやめ、黒インクの
濃淡 5 段（lv-0 `rgba(0,0,0,0.06)` → lv-4 `rgba(0,0,0,0.90)`）で活動量を表す。
特別な日（連動など）は色ではなく、内側の白リングなど無彩の形で区別する。

## Do's and Don'ts

### Do
- 白地・黒文字・グレー罫線の 3 要素で構成する。
- 主要 CTA は黒 pill ひとつ。アクションが渋滞したら 1 つだけ pill、残りは
  `button-secondary`。
- 階層は **サイズ・ウェイト・余白** で作る。
- カードはフラット（1px 罫線）。区切りは余白を優先し、必要な時だけ hairline。
- 数値は `tabular-nums` で桁を揃える。

### Don't
- ❌ アクセント色（緑・金・赤・青・紫など）を使わない。意味づけも色で表さない。
- ❌ 装飾を足さない（紙テクスチャ・マスキングテープ・カードの傾き・手描きの
  下線・グラデーション・演出的な影）。
- ❌ serif / 明朝 / monospace を使わない。全文 Inter。
- ❌ 本文に weight 400 / 500 を使わない（最低 600）。
- ❌ 重いドロップシャドウをカードに盛らない。
- ❌ pill（`{rounded.full}`）を入力や本文カードに使わない。
