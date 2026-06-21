# Contribution Arc — iOS App Store 提出ガイド

このドキュメントは、Contribution Arc を Apple App Store に提出するために
必要な作業を、リポジトリで完了済みのもの／開発者 (=人間) 側がまだやる必要が
あるものに分けて整理したものです。

---

## ✅ リポジトリ側で完了済み

| 項目 | 場所 | 備考 |
|------|------|------|
| Privacy Policy (ja/en) | `public/privacy.html`, `public/privacy.ja.html` | Settings 画面のフッタから到達 |
| Terms of Service (ja/en) | `public/terms.html`, `public/terms.ja.html` | 同上 |
| Support ページ (ja/en) | `public/support.html`, `public/support.ja.html` | App Store Connect の "Support URL" にそのまま登録可 |
| 1024×1024 App icon | `public/icon-512.png`, `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 既に Xcode の AppIcon に組み込み済み |
| Capacitor 設定 | `capacitor.config.ts` | bundleId = `com.ariyamatatsuya.contributionarc` |
| iOS Xcode プロジェクト | `ios/App/App.xcodeproj/` | `npx cap add ios` 実行済み |
| Capacitor Swift Package | `ios/App/CapApp-SPM/` | SPM 経由で Capacitor を取り込み |
| Launch Screen | `ios/App/App/Base.lproj/LaunchScreen.storyboard`, `Splash.imageset/` | 黒背景 + マーク |
| i18n (en) | `src/i18n/translations.ts` | プライマリ言語 EN でも申請可能な品質 |
| Settings 内リンク | `src/App.tsx` (Settings → Data) | "プライバシーポリシー · 利用規約 · サポート" を 1 行で表示 |
| **iOS ビルドのデジタル商品ゲート** | `package.json` `ios:build`/`ios:sync` | `VITE_PLATFORM=ios` を立てて Shop/Arc 購入/ポーカーを非表示化 (3.1.1) |
| **Sign in with Apple ボタン (コード)** | `src/App.tsx` ログイン画面 / `firebase.ts` | iOS ビルド時に Apple ボタンを先頭表示・`handleProviderLogin("apple")` 配線済 (4.8)。※Firebase/Apple 側の有効化は下記の人間作業が残る |
| **カメラ / 写真の用途説明** | `ios/App/App/Info.plist` | `NSCameraUsageDescription` (バーコード/getUserMedia)・`NSPhotoLibraryUsageDescription` を追加 |
| **Privacy manifest** | `ios/App/App/PrivacyInfo.xcprivacy` | Apple 2024 必須。収集データ型 + UserDefaults(CA92.1) を宣言。Xcode の Resources に登録済 |
| **iPhone 専用** | `ios/App/App.xcodeproj` | `TARGETED_DEVICE_FAMILY = 1` |
| **ブロック / ミュート / NGワード** | `src/App.tsx` (`blockedFriendUids`/`mutedFriendUids`/`containsBlockedWord`) | 1.2 のブロック要件は充足。※下記「通報」が未実装 |

---

## ⚠️ Apple のガイドラインで必須になっているもの

### 1. Sign in with Apple (App Store Guideline 4.8) — コードは対応済 / Apple 側設定が残る

> サードパーティ (Google / GitHub) のソーシャルログインを出している以上、
> **Apple は Sign in with Apple の提供を必須**としている。

✅ **済 (リポジトリ側)**: `appleProvider` + `handleProviderLogin("apple")` 配線、
ログイン画面に iOS ビルド限定で「Appleで続行」ボタンを HIG 準拠 (白ボタン/先頭) で追加。

⚠️ **残 (あなたの作業 — Firebase/Apple 側を有効化しないとボタンを押してもエラーになる)**:
1. Apple Developer の "Certificates, IDs & Profiles" で対象 App ID に
   `Sign In with Apple` capability を有効化
2. Apple Developer の Services ID を作成し、Firebase が要求する `return URL` を登録、
   `Sign in with Apple Key` を生成・ダウンロード
3. Firebase Console → Authentication → Sign-in method → Apple を有効化、
   Services ID と Key を登録
4. Xcode の `App` target → Signing & Capabilities → "+" → `Sign In with Apple` を追加

### 2. App Tracking Transparency (ATT)

このアプリは IDFA / 広告 SDK を使っていないので **ATT prompt は不要**。
App Store Connect の Privacy セクションで "ID for advertising = No" を申告する。

### 3. データ収集の宣言 (App Privacy)

App Store Connect → App Privacy で以下を申告する。`privacy.ja.html` の
「収集する情報」セクションと **完全に一致** させる必要がある。

| Data Type | Linked to user | Purpose |
|-----------|----------------|---------|
| Email Address | Yes | App Functionality, Account |
| User ID | Yes | App Functionality, Analytics |
| User Content (text/posts/photos) | Yes | App Functionality |
| Usage Data (study time/sessions) | Yes | App Functionality, Analytics |
| Purchases | Yes | App Functionality |
| Diagnostics / Crash | No | (Firebase Crashlytics を入れていなければ "No") |

### 4. ユーザー生成コンテンツのモデレーション (Guideline 1.2 / 1.4.1)

投稿・返信・チャット機能があるアプリは、以下が必須:

| 要件 | 状況 | 場所 |
|------|------|------|
| **ブロック機能** | ✅ 済 | `src/App.tsx` `blockedFriendUids` |
| **ミュート機能** | ✅ 済 | `src/App.tsx` `mutedFriendUids` |
| **NG ワードフィルタ** | ✅ 済 | `src/App.tsx` `containsBlockedWord` |
| **通報機能** | ⚠️ 未実装 | — |
| **24 時間以内に対応する旨の表明** | ⚠️ 人間作業 | 利用規約 / App Store Connect の Review メモ |

⚠️ **残る 1.2 ギャップ = 通報 (report) 機能**。ブロック・ミュート・NG ワードは充足
しているが、個別の投稿/返信を運営に通報する導線が無い。Apple は UGC アプリに
「不適切コンテンツの通報 → 24h 以内対応」を要求するため、ここが未実装だと 1.2 で
Rejected される可能性がある。

対応方針 (要ユーザー判断):
- 各投稿のオーバーフローメニューに「通報する」を追加し、`reports/{reportId}` へ
  `{ targetPostId, reporterUid, reason, createdAt }` を 1 write する（既存の
  Firestore コスト規律: payload 署名で dedup）。
- 通報受信後 24h 以内に対応する旨を `terms.html` / Review メモに明記。

> 過去に提出実績があるため、前回 1.2 を通過した構成（ブロック等のみ）で再申請し、
> Apple から通報導線を求められた時点で上記を追加する、という運用も選択肢。

---

## 🛠 ローカル (Mac) でやる作業

### 前提
- Mac OS X (Capacitor は Mac 必須)
- Xcode 15+ (推奨 16)
- Apple Developer Program (年 99 USD) 登録済み
- App Store Connect の Team へのアクセス

### 1. 依存をインストール

```bash
npm install        # capacitor 系もここで入る
```

### 2. Web → iOS 同期

```bash
npm run ios:sync   # = CAPACITOR_BUILD=true VITE_PLATFORM=ios vite build && cap sync ios
npx cap open ios   # Xcode 起動
```

> ⚠️ **必ず `npm run ios:sync` を使うこと**。`VITE_PLATFORM=ios` を立てないと
> Shop / Arc 購入 / ポーカーが画面に出たまま提出され、Apple guideline 3.1.1
> (デジタル商品は Apple IAP 必須) で Rejected になる。

### 3. Xcode での署名 / Capability 設定

Xcode で `App` ターゲット → "Signing & Capabilities":

- **Team**: 自分の Apple Developer Team を選択
- **Bundle Identifier**: `com.ariyamatatsuya.contributionarc` (capacitor.config.ts と一致)
- **Capabilities** (+ ボタンで追加):
  - `Sign In with Apple` (Guideline 4.8 対応に必要)
  - `In-App Purchase` (Arc 通貨販売を入れる場合)

### 4. ビルド & TestFlight 配布

Xcode のメニュー: Product → Archive → Distribute App → App Store Connect
→ Upload。 1〜30 分待つと App Store Connect に build が出現する。

TestFlight で内部テスト → 外部テスト → 申請。

---

## 📝 App Store Connect で入力する内容

| フィールド | 値 |
|------|----|
| App Name | Contribution Arc |
| Primary Language | English (i18n を進めたので EN を primary に出来る) |
| Bundle ID | com.ariyamatatsuya.contributionarc |
| SKU | contribution-arc-001 |
| Category (Primary) | Education |
| Category (Secondary) | Productivity |
| Age Rating | 12+ (ユーザー生成コンテンツがあるため) |
| Pricing | Free (IAP あり) |
| Privacy Policy URL | https://tatsuyaariyama.github.io/Contribution-Arc/privacy.html |
| Terms of Use URL | https://tatsuyaariyama.github.io/Contribution-Arc/terms.html |
| Support URL | https://tatsuyaariyama.github.io/Contribution-Arc/support.html |
| Marketing URL | (任意) ランディングページがあれば |

### 必須のスクリーンショット

- 6.7" iPhone (iPhone 15 Pro Max) — 1290×2796: **3〜10枚**
- 6.5" iPhone (iPhone 11 Pro Max) — 1242×2688: **3〜10枚** (互換)
- 12.9" iPad Pro (3rd gen) — 2048×2732: iPad 対応する場合のみ

**推奨フロー**:
1. ホーム (Feed)
2. ライブラリ (学習対象一覧)
3. 学習記録の入力モーダル
4. 作業部屋 (集中タイマー)
5. プロフィール (キャラクター)
6. ポーカー (アクセント用) または日報

### App 説明文 (例文)

**JA**:
> Contribution Arc は、毎日の学習を可視化し、仲間と一緒に積み上げる学習記録アプリです。
> - 教科書や資格、技術書まで何でも追加できる学習ライブラリ
> - 25 分集中 + 5 分休憩のポモドーロタイマー付き作業部屋
> - 仲間の学習時間や日報を見られるホームフィード
> - 学習 + 日報で Arc 通貨を貯めて、キャラクターをカスタマイズ

**EN**:
> Contribution Arc turns your daily learning into a visible streak you
> can share with friends. Log any subject — textbooks, certs, side
> projects — into your library, focus together in a workspace with a
> built-in Pomodoro, and watch your contribution arc grow.

### キーワード (100 文字制限)

```
study tracker, pomodoro, learning, focus timer, study log, exam prep,
self-study, productivity
```

---

## 🔁 サブミッション後の修正フロー

申請が rejected された場合、よくある対応:

| 理由 | 対応 |
|------|------|
| Guideline 4.8 (Apple Sign in 不在) | 上記 #1 を実装 |
| Guideline 5.1.1 (Privacy declaration ⇔ policy 不一致) | App Privacy 申告を `privacy.html` と一致させる |
| Guideline 1.2 (ユーザー生成コンテンツのモデレーション) | 通報機能を追加 (ブロック/ミュート/NGワードは実装済) |
| Guideline 4.2.3 (機能が薄すぎ / Web ラッパー疑惑) | スクリーンショット差替え、Capacitor のネイティブ API 利用箇所を増やす (IAP / Haptics 等) |

---

## ✏️ 修正したくなったら

- **Privacy / Terms / Support 本文**: `public/*.html` を編集 → `main` に
  push → GitHub Pages が反映 → App Store Connect 側の URL は同じなので追加
  作業不要 (Apple 側の審査も不要)。
- **App 内のリンク表示**: Settings → "アカウント" セクション下に
  「プライバシーポリシー · 利用規約 · サポート」を表示。位置や追加リンクを
  変えたい場合は `src/App.tsx` 内の `settings-data-legal` を編集。
- **iOS の表示更新** (アイコン / スプラッシュ等を更新したら):
  `npx cap sync ios` → Xcode で再 Archive → TestFlight に再アップロード。
