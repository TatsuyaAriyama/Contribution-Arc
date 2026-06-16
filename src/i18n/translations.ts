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
  "作業部屋":            "Atelier",
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
  "メモ":                        "Note",
  "学んでいる目的、今読んでいる章、次にやることなど":
    "Your goal, the chapter you're on, what's next, etc.",
  "並び替え":                    "Sort",
  "最近の記録順":                "Recently logged",
  "累計時間順":                  "Total time",
  "名前順":                      "Name",
  "{count}件":                   "{count} items",
  "うち書籍{count}":             "{count} books",
  "アーカイブ{count}":           "{count} archived",
  "完了{count}":                 "{count} done",
  "ステータス":                  "Status",
  "進行中":                      "In progress",
  "中断":                        "Paused",
  "今週":                        "This week",
  "記録日数":                    "Days logged",
  "{count}日":                   "{count} days",
  "最終記録":                    "Last logged",
  "最近の記録":                  "Recent activity",
  "{name}の詳細":                "{name} details",
  "現在のページ":                "Current page",
  "現在ページを更新":            "Update current page",
  "ページ進捗":                  "Page progress",
  "ページ数を直接入力":          "Enter page number",
  "ページ":                      "Page",
  "更新":                        "Update",

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

  // === 追加: 主要ナビ / メニュー ===
  "管理ダッシュボード":         "Admin Dashboard",
  "目標":                       "Goal",
  "お知らせ":                   "Announcements",
  "通知":                       "Notifications",
  "フレンド":                   "Friends",
  "フレンド・検索":             "Friends & Search",
  "検索":                       "Search",

  // === 設定モーダル ===
  "自動投稿":                   "Auto post",
  "学習・作業の積み上げを自動で投稿する":
                                "Automatically post your study & workroom progress",
  "個人データ管理":             "Your data",
  "データをエクスポート":       "Export your data",
  "プロフィールリンクをコピー": "Copy profile link",
  "プロフィールリンクをコピーしました":
                                "Profile link copied",
  "プロフィールを編集":         "Edit profile",
  "プロフィールを閉じる":       "Close profile",
  "設定を開く":                 "Open settings",
  "設定を閉じる":               "Close settings",
  "今の決意を一行で書いておこう":
                                "Write today's resolve in one line.",

  // === 目標 (志望校 / 資格) ===
  "目標を設定":                 "Set a goal",
  "高校受験":                   "High school",
  "大学受験":                   "University",
  "資格":                       "Qualification",
  "目標を選ぶ":                 "Choose a goal",
  "目標を変更":                 "Change goal",
  "目標をクリア":               "Clear goal",

  // === ホームフィード ===
  "学習の記録":                 "Study logs",
  "みんなと学びを共有・作業仲間を募集":
                                "Share what you're learning, find work partners",
  "What are you building tonight?":
                                "What are you building tonight?",
  "Roomから作成":               "From your workroom",
  "学習ログから作成":           "From your latest log",
  "今日作っているもの、学んだこと、作業部屋の募集が静かに流れます。":
                                "Today's builds, learnings, and workroom calls quietly flow here.",
  "気になるエンジニアをフォローすると、ここに学びと作業部屋の募集が流れます。":
                                "Follow engineers to see their learnings and workroom calls here.",
  "もっと見る":                 "Load more",

  // === 日報 ===
  "日付":                       "Date",
  "今日やること":               "Today's plan",
  "振り返り":                   "Reflection",
  "Team Daily を読み込む":      "Load Team Daily",
  "更新中…":                    "Updating…",
  "再読み込み":                 "Refresh",
  "下書きにする":               "Save as draft",
  "ローカル下書きとして自動保存されます。":
                                "Auto-saved as a local draft.",
  "共有された日報はまだありません。":
                                "No shared daily reports yet.",
  "日報の編集は当日または1日前までです。":
                                "You can only edit today's or yesterday's report.",
  "1行1タスク。完了したらチェックして、必要なら一言メモを残せます。":
                                "One line per task. Check it when done; add a short note if needed.",
  "{name}の{date}の日報を開く": "Open {name}'s report from {date}",

  // 日報: ヘッダ / ストリーク / 進捗
  "{count}日連続で日報を書いています":
                                "You've written a daily report for {count} days in a row",
  "{count}日連続":               "{count}-day streak",
  "{done}/{total} 完了":         "{done}/{total} done",
  "{text} (完了)":               "{text} (done)",
  "日報を画像で共有":            "Share as image",
  "画像で共有":                  "Share as image",
  "日報の共有画像":              "Daily report share image",
  "画像を保存":                  "Save image",
  "画像を保存して SNS に投稿したり、写真ウィジェットに置けます。":
                                "Save the image to share on social media or place in your photo widget.",

  // 日報: チュートリアル
  "日報 — 1日のはじまりと締めくくり":
                                "Daily — Open and close out the day",
  "その日の計画と振り返りを残すと、明日の自分への布石になります。":
                                "Recording the day's plan and reflection lays the groundwork for tomorrow.",
  "「計画」欄に朝の予定を、「振り返り」欄に夜の感想を書きます":
                                "Use \"plan\" for the morning's intent and \"reflection\" for the evening's notes",
  "保存は自動。書きかけのまま画面を離れても消えません":
                                "Saves automatically — your draft stays even if you leave the screen",
  "編集できるのは当日と前日まで(過去の自分に向き合うため)":
                                "You can only edit today and yesterday (to keep facing the past you)",

  // 日報: 報酬バナー
  "+50 Arc 獲得済み":             "+50 Arc earned",
  "明日も「今日やること」と「振り返り」の両方共有で Arc を狙えます。":
                                "Earn Arc again tomorrow by sharing both today's plan and reflection.",
  "両方を共有すると +50 Arc / 日":
                                "Share both to earn +50 Arc / day",
  "今日の達成状況":              "Today's progress",
  "今日やることの進捗":          "Plan progress",
  "+50 Arc 獲得 ✦ 今日やること & 振り返り を両方完了しました":
                                "+50 Arc earned ✦ You completed both today's plan and reflection",

  // 日報: クイックアクション
  "過去の計画から引き継ぎ":      "Carry over from previous plans",
  "未完了を持ち越し":            "Carry over unfinished",
  "過去の未完了タスクを今日に持ち越す":
                                "Carry forward unfinished tasks to today",
  "前日の計画をコピー":          "Copy yesterday's plan",
  "前日の計画をすべて今日にコピー":
                                "Copy all of yesterday's plan into today",
  "持ち越せる未完了タスクはありません":
                                "No unfinished tasks to carry over",
  "未完了タスクはすでに含まれています":
                                "Unfinished tasks are already included",
  "{count}件の未完了タスクを追加しました":
                                "Added {count} unfinished tasks",
  "前日の計画が見つかりません":  "No plan from yesterday",
  "前日の計画が空です":          "Yesterday's plan is empty",
  "前日の計画はすでに含まれています":
                                "Yesterday's plan is already included",
  "{count}件を前日からコピーしました":
                                "Copied {count} tasks from yesterday",

  // 日報: チェックリスト ラベル
  "項目を追加":                  "Add item",
  "やることを1行で":             "Write a task in one line",
  "完了メモ(任意) — 何をやったか / 何で詰まったか":
                                "Completion note (optional) — what you did / what got you stuck",
  "完了メモ":                    "Completion note",
  "←前日から":                   "← carried from",

  // 日報: 保存ボタン / 状態
  "保存中":                      "Saving",
  "下書きで保存":                "Save as draft",
  "今日やることを更新":          "Update today's plan",
  "今日やることを送信":          "Submit today's plan",
  "振り返りを更新":              "Update reflection",
  "振り返りを送信":              "Submit reflection",
  "できたこと、詰まったこと、明日に回すことなど":
                                "What you did, what got stuck, what to defer to tomorrow…",
  "{section}を入力してください。":
                                "Please enter {section}.",
  "{section}を下書き保存しました。共有はされていません。":
                                "Saved {section} as a draft. It hasn't been shared.",
  "{section}を保存しました。":   "Saved {section}.",
  "{section}をローカルに保存しました。クラウドへ再同期します。":
                                "Saved {section} locally. Will resync to the cloud.",
  "{section}をクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。":
                                "Cloud save permission isn't enabled yet for {section}. It is saved locally.",

  // 日報: 履歴 (mine / team)
  "日報の記録":                  "Daily report history",
  "自分の記録":                  "My history",
  "過去の日報を絞り込む":        "Filter past reports",
  "本文・日付から探す":          "Search text or date",
  "クリア":                      "Clear",
  "今日やることは未入力":        "No plan written",
  "振り返り済み":                "Reflection done",
  "振り返り未入力":              "No reflection",
  "一致する日報はありません。":  "No matching reports.",
  "まだ日報はありません。":      "No reports yet.",
  "みんなの過去の日報を最大100件まで読み込みます。":
                                "Load up to 100 past reports from everyone.",
  "読み込みに失敗しました。もう一度お試しください。":
                                "Failed to load. Please try again.",

  // 日報: 削除確認 / メッセージ
  "{date}の日報を削除しますか？":"Delete the report for {date}?",
  "{date}の日報":                "{date} daily report",
  "日報を削除しました。":        "Report deleted.",
  "日報を削除できませんでした。":"Couldn't delete the report.",

  // 日報: 共有 / 画像
  "共有できる内容がまだありません。":
                                "Nothing to share yet.",
  "画像の作成に失敗しました。":  "Failed to create the image.",
  "画像を保存しました。ホーム画面の写真ウィジェットに置けます。":
                                "Image saved — drop it into your home-screen photo widget.",
  "この環境ではコピーに非対応です。保存をご利用ください。":
                                "Clipboard isn't supported here. Please save instead.",
  "画像をクリップボードにコピーしました。":
                                "Image copied to clipboard.",
  "コピーに失敗しました。保存をご利用ください。":
                                "Copy failed. Please save instead.",
  "（まだありません）":          "(nothing yet)",
  "（無題）":                    "(untitled)",

  // 日報: チェックリストプレビュー
  "+{count}件":                  "+{count} more",
  "(空)":                        "(empty)",

  // 日報: 詳細モーダル
  "本文はまだ書かれていません。":"Nothing written yet.",
  "この日のデータ":              "This day's data",
  "学習時間":                    "Study time",
  "commit":                      "commits",
  "記録":                        "Logs",
  "この日の学習ログはありません。":
                                "No study logs for this day.",
  "他のメンバーの学習データはここでは表示されません。":
                                "Other members' study data isn't shown here.",

  // === プロフィール ===
  "決意":                       "Resolve",
  "決意入力":                   "Edit resolve",
  "今週はまだ記録がありません。":
                                "Nothing recorded this week yet.",
  "今週の学習":                 "This week",
  "曜日別の内訳はまもなく表示されます。":
                                "A per-day breakdown will appear shortly.",

  // === ライブラリ ===
  "学習対象を追加して、学習時間を記録しよう。":
                                "Add a learning item to start recording study time.",
  "すべて":                     "All",
  "アーカイブ":                 "Archived",
  "名前で検索":                 "Search by name",
  "並べ替え":                   "Reorder",
  "並べ替えを終える":           "Done reordering",
  "一つ上へ":                   "Move up",
  "一つ下へ":                   "Move down",
  "自分の順":                   "My order",
  "写真 (任意)":                "Photo (optional)",
  "写真を追加":                 "Add photo",
  "写真を変更":                 "Change photo",
  "教材の表紙などを撮ると、ライブラリでアイコンとして表示されます。":
                                "Take a photo of the cover and it becomes your library icon.",

  // === 作業部屋 / メンバー ===
  "作業部屋を選んでください":   "Pick a workroom first",
  "先に作業部屋を選んでください":"Pick a workroom first",
  "作業部屋への招待":           "Workroom invite",
  "作業部屋を自動退室しました": "Auto-left your workroom",
  "作業部屋 — 同じ時間に手を動かす場所":
                                "Workroom — share quiet focus time",
  "通話なしで、気配だけを共有しながら集中作業ができる空間です。":
                                "A space to share quiet presence without voice or video.",
  "作業部屋の表示":             "Workroom view",
  "みんな":                     "Everyone",
  "自分":                       "You",
  "集中中":                     "Focused",
  "休憩中":                     "On break",
  "今ルームに居るメンバー":     "Members currently in this room",
  "ルームチャット":             "Room chat",
  "チャット":                   "Chat",
  "一言だけ。":                 "Just a quick line.",
  "送る":                       "Send",
  "送信…":                      "Sending…",
  "まだメッセージはありません。最初の一言を。":
                                "No messages yet. Be the first to say something.",
  "送信できません。ルームを選択してください。":
                                "Cannot send — select a workroom first.",
  "不適切な言葉が含まれているため送信できません。":
                                "Message blocked: contains inappropriate language.",
  "送信に失敗しました。時間をおいて再度お試しください。":
                                "Failed to send. Please try again later.",
  "チャットメッセージを書く":   "Write a chat message",
  "メッセージを書く":           "Write a message",

  // === 要望フォーム ===
  "ご要望・不具合のご報告":     "Send feedback",
  "送信中…":                    "Sending…",
  "送信する":                   "Send",
  "ご要望を送信しました。ありがとうございます。":
                                "Thanks for the feedback!",

  // === シェア / GitHub ===
  "GitHubアカウントを連携":     "Link GitHub account",
  "コピー":                     "Copy",
};
