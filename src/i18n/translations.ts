// Translation dictionary for Contribution Arc.
//
// Strategy: the Japanese string is the lookup key. This minimizes
// disruption when migrating an existing JA-only codebase — wrap each
// literal in t("…") and add the English mapping below. When language
// is "ja", t() returns the key unchanged; when "en", it looks up the
// translation (falling back to the key if missing).
//
// Interpolation: use {name} placeholders, e.g.
//   t("こんにちは、{name}さん", { name: "Aki" })
//   en: "Hello, {name}"

export type Language = "ja" | "en";

export const SUPPORTED_LANGUAGES: Language[] = ["ja", "en"];

export const LANGUAGE_LABELS: Record<Language, { native: string; english: string }> = {
  ja: { native: "日本語",  english: "Japanese" },
  en: { native: "English", english: "English"  },
};

// Japanese → English mapping. Keys MUST exactly match the Japanese
// string passed to t() at the call site (whitespace and punctuation
// included). Group entries by feature area with comments.
export const EN_TRANSLATIONS: Record<string, string> = {
  // ─── Common UI ──────────────────────────────────────────────
  "キャンセル":     "Cancel",
  "保存":           "Save",
  "閉じる":         "Close",
  "削除":           "Delete",
  "編集":           "Edit",
  "送信":           "Submit",
  "確認":           "Confirm",
  "戻る":           "Back",
  "次へ":           "Next",
  "完了":           "Done",
  "続ける":         "Continue",
  "読み込み中…":    "Loading…",
  "エラー":         "Error",
  "再試行":         "Retry",
  "ログアウト":     "Sign out",
  "ログイン":       "Sign in",
  "OK":             "OK",
  "はい":           "Yes",
  "いいえ":         "No",

  // ─── Language selection (onboarding & settings) ─────────────
  "言語":                                              "Language",
  "言語を選択":                                        "Choose your language",
  "アプリの表示言語を選択してください。":              "Choose the display language for the app.",
  "アプリで使う言語を選んでください。後から設定で変更できます。":
    "Pick the language you want to use. You can change it later in Settings.",
  "この言語で続ける":                                  "Continue in this language",
  "日本語":                                            "Japanese",
  "English":                                           "English",

  // ─── Onboarding ─────────────────────────────────────────────
  "ようこそContribution Arcへ":                  "Welcome to Contribution Arc",
  "最初にあなたのプロフィールを整えます。":      "Let's set up your profile first.",
  "Contribution Arcで使う名前とユーザーIDを設定してください。":
    "Set the name and user ID you'd like to use on Contribution Arc.",
  "Contribution Arcで使う名前とユーザーIDを設定してください。ユーザーIDはフレンド申請やプロフィール表示に使います。":
    "Set the name and user ID you'd like to use on Contribution Arc. The user ID is used for friend requests and profile pages.",
  "ユーザーIDを入力してください。":              "Please enter a user ID.",
  "ユーザーIDは30文字以内にしてください。":      "User IDs must be 30 characters or fewer.",
  "使用できる文字は小文字の半角英数字、_、. のみです。":
    "Only lowercase letters, numbers, _ and . are allowed.",
  "ユーザーIDを入力するとContribution Arcを開始できます。":
    "Enter a user ID to start using Contribution Arc.",

  // ─── Settings ───────────────────────────────────────────────
  "設定":                "Settings",
  "プロフィール設定":    "Profile settings",
  "表示名":              "Display name",
  "ユーザーネーム":      "Username",
  "ユーザーID":          "User ID",
  "表示したい名前":      "Display name",
  "テーマ":              "Theme",
  "ライト":              "Light",
  "ダーク":              "Dark",
  "キャラクター":        "Character",
  "アバター":            "Avatar",
  "写真を選択":          "Choose photo",
  "アカウント":          "Account",
  "アカウントを削除":    "Delete account",
  "分身キャラクター":    "Your character",
  "シルエット":          "Silhouette",
  "キャラクターの形":    "Character shape",
  "カラー":              "Color",
  "分身カラー":          "Character color",
  "表示サイズ":          "Display size",
  "表示を小さくする":    "Make smaller",
  "表示サイズスライダー": "Display size slider",
  "表示を大きくする":    "Make larger",
  "小文字の半角英数字、_、. が使えます。":
    "Lowercase letters, numbers, _ and . are allowed.",
  "Mac通知":             "Mac notifications",
  "日報通知":            "Daily report notifications",
  "投稿通知":            "Post notifications",
  "フレンド申請通知":    "Friend request notifications",
  "通知音":              "Notification sound",
  "通知音量":            "Notification volume",
  "通知音をテスト":      "Test notification sound",
  "保存中…":             "Saving…",
  "Contribution Arcを始める": "Start Contribution Arc",
  "プロフィールを保存しました": "Profile saved",
  "プロフィールをこのブラウザに保存できませんでした。ブラウザのストレージ設定を確認してください。":
    "Couldn't save your profile to this browser. Please check your browser storage settings.",
  "ユーザーIDを保存できませんでした。": "Couldn't save your user ID.",
  "ユーザーIDの保存権限が有効になっていません。少し時間を置いて再度お試しください。":
    "Saving your user ID isn't enabled yet. Please try again in a moment.",
  "このユーザーIDはすでに使われています。": "That user ID is already taken.",

  // ─── Top navigation ─────────────────────────────────────────
  "ホーム":              "Home",
  "作業部屋":            "Workroom",
  "記録する":            "Log",
  "日報":                "Daily",
  "ショップ":            "Shop",
  "ショップ ({coins} Arc)": "Shop ({coins} Arc)",
  "現在 {count} 人が作業中":  "{count} people working now",
  "今日 {duration} 学習":      "{duration} studied today",
  "オフライン":          "Offline",

  // ─── User menu ──────────────────────────────────────────────
  "アカウントメニュー":  "Account menu",
  "未設定":              "Not set",
  "サインイン中のアカウント": "Signed-in account",
  "プロフィール":        "Profile",
  "チュートリアルをもう一度": "Restart tutorial",
  "新しいお知らせはありません。": "No new notifications.",

  // ─── Organization (B2B tenant) ──────────────────────────────
  "組織":                "Organization",
  "オーナー":            "Owner",
  "メンバー":            "Member",
  "組織限定のルームを作って、社内・チーム内だけで一緒に作業できます。":
    "Create org-only rooms so your company or team can work together privately.",
  "招待リンクをコピー":  "Copy invite link",
  "メンバー一覧 / Admin": "Members / Admin",
  "退出":                "Leave",
  "会社やチームで使う場合は、組織を作って招待リンクで仲間を招きます。組織限定のルームで他社や他チームから見えない作業空間が作れます。":
    "Using this for work? Create an organization and invite your teammates with a link. Org-only rooms give you a workspace that other companies and teams can't see.",
  "例: Acme Inc.":       "e.g. Acme Inc.",
  "組織名":              "Organization name",
  "作成":                "Create",

  // ─── Errors ─────────────────────────────────────────────────
  "取得できませんでした":           "Couldn't load",
  "ネットワークエラーが発生しました。": "A network error occurred.",
  "不明なエラーが発生しました。":   "An unknown error occurred.",
};
