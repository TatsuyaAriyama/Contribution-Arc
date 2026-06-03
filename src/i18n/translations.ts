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
  "ライブラリ":          "Library",
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

  // ─── Home & Daily ───────────────────────────────────────────
  "ホーム — あなたの学習を一望できる場所": "Home — see your learning at a glance",
  "ホームへ":                      "Go home",
  "今日の積み上げを静かに記録中。": "Quietly logging your work for today.",
  "勉強・読書・アウトプットの時間を残すと、ホームのグラフに反映されます。":
    "Log study, reading, and output time — it shows up in your home graph.",
  "今週の学習時間・最長連続日数・ジャンル分布をひと目で":
    "This week's study time, longest streak, and subject mix at a glance",
  "13週の学習ジャンル配分":      "13-week subject breakdown",
  "先週の記録はまだありません":   "No records from last week yet",
  "日報 — みんなの日報で刺激をもらう":
    "Daily — Get inspired by what others are working on",
  "みんなの日報":                "Everyone's daily reports",
  "みんなの記録":                "Everyone's learning",
  "みんなの記録 — 仲間の積み上げが流れる場所":
    "Everyone's learning — see what your friends are up to",
  "下の「みんなの記録」「日報」もここから流れてきます":
    "Posts from \"Everyone's learning\" and \"Daily\" also show here",
  "他の人の日報もここから読めて、刺激を受けられます":
    "You can read others' daily reports here and get inspired",
  "フォロー中の投稿はまだありません。":
    "No posts from people you're following yet.",

  // ─── Learning & Study ───────────────────────────────────────
  "学習":                        "Learning",
  "学習サマリ":                  "Learning summary",
  "学習しました":                "Logged learning",
  "「学習対象」をジャンルと色で登録(例: React=青、英語=橙)":
    "Register learning subjects by category and color (e.g., React=blue, English=orange)",
  "よく使われる学習対象":        "Popular subjects",
  "使わなくなった対象はアーカイブ。記録は残ります":
    "Archive subjects you no longer use. Records stay.",
  "まだ記録なし":                "No records yet",
  "学習対象を追加":              "Add learning subject",
  "学習対象を編集":              "Edit learning subject",
  "学習対象":                    "Learning subject",

  // ─── Workspace & Rooms ──────────────────────────────────────
  "Silent Workspace":            "Silent Workspace",
  "新しい場所を作る":            "Create a new room",
  "募集":                        "Recruit",
  "休憩":                        "Break",
  "名前変更":                    "Rename",
  "解体":                        "Disband",
  "名前を変更":                  "Change name",
  "部屋を解体":                  "Disband room",
  "募集の投稿に失敗しました。時間をおいて再度お試しください。":
    "Couldn't post recruitment. Please try again in a moment.",
  "想定時間":                    "Expected duration",
  "メッセージ (任意, 140字)":    "Message (optional, 140 chars)",
  "一緒にやりませんか":          "Want to work together?",

  // ─── Posts & Feed ───────────────────────────────────────────
  "投稿":                        "Post",
  "返信":                        "Reply",
  "投稿の投稿に失敗しました。":  "Couldn't post. Please try again.",
  "あなたの学習を投稿すると、誰かの励みになります":
    "Share your learning — it might inspire someone",
  "まだ投稿はありません。":      "No posts yet.",
  "今日はまだ受け取っていません。ログを投稿してみてください。":
    "Haven't earned today's Arc yet. Try posting a log.",
  "今日の分は受け取り済み。明日また投稿してみてください。":
    "You've already earned today's bonus. Post again tomorrow.",
  "Posting":                    "Posting",

  // ─── Profile ────────────────────────────────────────────────
  "プロフィール — あなたの足跡と設定":
    "Profile — Your footprint and settings",
  "プロフィール画面を開く":      "Open profile",
  "ユーザーを探す":              "Find users",
  "他の人のキャラをタップするとプロフィールが見られます":
    "Tap someone's character to see their profile",

  // ─── Auth / Login ───────────────────────────────────────────
  "アカウントにログイン":        "Sign in to your account",
  "メール、Google、GitHub のいずれかでログインできます。":
    "Sign in with email, Google, or GitHub.",
  "Email":                      "Email",
  "Password":                   "Password",
  "6文字以上のパスワードを入力してください。":
    "Password must be at least 6 characters.",
  "パスワードが短すぎます。":    "Password is too short.",
  "メールアドレスの形式が正しくありません。":
    "Email format is invalid.",
  "メールアドレスまたはパスワードが正しくありません。":
    "Email or password is incorrect.",
  "このメールアドレスはすでに登録されています。":
    "That email is already registered.",
  "このログイン方法がFirebase側で有効化されていません。":
    "This sign-in method isn't enabled in Firebase.",
  "Firebase ConsoleのAuthentication > Sign-in methodで、選んだログイン方法を有効にしてください。":
    "Enable it in Firebase Console > Authentication > Sign-in methods.",
  "Loginに切り替えてログインしてください。":
    "Switch to the Login tab and sign in.",
  "ログイン用ポップアップがブロックされました。":
    "Sign-in popup was blocked. Allow popups and try again.",
  "ログイン画面が閉じられました。":
    "Sign-in window closed. Please try again.",
  "ログイン試行が一時的に制限されています。":
    "Sign-in attempts are temporarily limited. Try again soon.",
  "ログインに失敗しました。":    "Sign-in failed.",
  "同じメールアドレスの別ログイン方法が存在します。":
    "A different sign-in method uses that email. Use that method instead.",
  "以前使ったログイン方法でログインしてください。":
    "Sign in with the method you used before.",
  "127.0.0.1 ではなく localhost で開くとログインできる可能性が高いです。":
    "Try opening via localhost instead of 127.0.0.1.",
  "GitHub を連携すると、commit が学習グラフに重なります":
    "Link GitHub to overlay commits on your learning graph",
  "Googleで続行":                "Continue with Google",
  "GitHubで続行":                "Continue with GitHub",
  "もう一度ログインボタンを押してください。":
    "Please click the sign-in button again.",
  "Connecting...":              "Connecting...",
  "Create account":             "Create account",
  "Login with email":           "Login with email",
};
