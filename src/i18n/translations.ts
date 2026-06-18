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
  "メインナビゲーション": "Main navigation",
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
  // === Profile week chart ===
  "{active}日 / 7日":             "{active} / 7 days",
  "今週の合計 {duration}":         "Week total {duration}",
  "{day} の学習を編集":            "Edit {day}'s learning",
  "選択した曜日の詳細":            "Selected day details",
  "「{subject}」({minutes}分) を削除しますか？":
                                  "Delete \"{subject}\" ({minutes} min)?",
  "学習時間 (分)":                 "Study minutes",
  "学習時間を更新できませんでした": "Couldn't update study time",
  "学習記録を削除できませんでした": "Couldn't delete the study log",
  "学習記録を追加できませんでした": "Couldn't add the study log",
  "分":                            "min",
  // 曜日ラベル (Mon-Sun)
  "月": "Mon",
  "火": "Tue",
  "水": "Wed",
  "木": "Thu",
  "金": "Fri",
  "土": "Sat",
  "日": "Sun",
  // 詳細パネル: 行操作 / 追加フォーム
  "この日の学習ログはまだありません。下のフォームから追加できます。":
                                  "No study logs for this day yet. Add one with the form below.",
  "時間を調整":                    "Adjust minutes",
  "この日に追加":                  "Add to this day",
  "ライブラリに学習対象がありません。先に追加してください。":
                                  "No learning items in your library. Add one first.",
  "学習対象を選ぶ":                "Pick a learning item",
  "クイック入力":                  "Quick input",
  "追加":                          "Add",

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
  "ユーザーIDで探す (例: ari.dev)":
                                "Search by user ID (e.g. ari.dev)",
  "届いている申請":             "Incoming requests",
  "まだフレンドがいません。上の検索からユーザーIDで申請してみよう。":
                                "No friends yet. Search by user ID above to send a request.",
  "申請中":                     "Requested",
  "承認":                       "Accept",

  // === Settings guide (Contribution Arc の使い方) ===
  "Contribution Arc の使い方":  "How to use Contribution Arc",
  "はじめての方へ":             "New here?",
  "学んだことを記録すると、積み上げがグラフに残ります。まずはここから。":
                                "Log what you're learning and watch your progress fill in the graph. Start here.",
  "その日の予定と振り返りを書いて、仲間と共有できます。":
                                "Write your day's plan and reflection, and share it with peers.",
  "フレンドや仲間の投稿・日報が流れてきます。ハートやリプライで反応できます。":
                                "See your friends' posts and daily reports — react with hearts and replies.",
  "同じ部屋に入って一緒に作業できます。今やっていることがリアルタイムで共有されます。":
                                "Join the same room and work together — what you're doing is shared in real time.",
  "相手のユーザーIDで申請し、承認されるとつながります。申請はお知らせに届きます。":
                                "Send a request with someone's user ID — once they accept, you're connected. Requests show up in Announcements.",
  "会社やチームで使うときは、組織を作って招待リンクで仲間を招きます。組織限定の作業部屋が作れます。":
                                "Using this for work? Create an organization and invite teammates with a link. You can make workrooms private to your org.",
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
  "同じ目標":                   "Same goal",
  "同じ目標の人を探す":         "Find people with the same goal",
  "同じ目標のユーザーはまだ見つかりません。":
                                "No users with this goal yet.",

  // === Friend requests ===
  "フレンド上限に達しています。":"You've reached the friend limit.",
  "自分自身にはフレンド申請できません。":
                                "You can't send a friend request to yourself.",
  "すでにフレンドです。":        "You're already friends.",
  "フレンド申請を送信済みです。":"Friend request already sent.",
  "フレンド申請を送信しました。承認されるとFriendsに表示されます。":
                                "Friend request sent. You'll see them in Friends once they accept.",
  "{name} にフレンド申請を送りました":
                                "Sent a friend request to {name}",
  "フレンド申請を送れませんでした (permission-denied)。Firestore ルールが更新されていない可能性があります。":
                                "Couldn't send the friend request (permission-denied). The Firestore rules may not be updated.",
  "フレンド申請を送れませんでした ({code})":
                                "Couldn't send the friend request ({code})",
  "フレンド申請を送れませんでした。時間をおいて再度お試しください。":
                                "Couldn't send the friend request. Please try again later.",
  "フレンドになりました。":      "You're now friends.",
  "{name} とフレンドになりました":
                                "You're now friends with {name}",
  "フレンド申請は相手が承認すると成立します。":
                                "The other person needs to accept to become friends.",
  "承認できませんでした (permission-denied)。Firestore ルールが更新されていない可能性があります。":
                                "Couldn't accept (permission-denied). The Firestore rules may not be updated.",
  "承認できませんでした ({code})":"Couldn't accept ({code})",
  "承認できませんでした。時間をおいて再度お試しください。":
                                "Couldn't accept. Please try again later.",
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
  "今週の学習時間":             "This week's study time",
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
  "作業部屋を解体しました":      "Workroom disbanded",
  "Room名を入力してください。": "Please enter a room name.",
  "作業部屋は 1 人につき 1 つまでです。既存の部屋 「{name}」 を解体してから作成してください。":
                                "You can only create one workroom per person. Disband \"{name}\" first to create another.",
  "1 人 1 部屋":                 "1 per user",
  "1 人 1 部屋まで。既存の部屋を解体すると新しく作れます。":
                                "Only one room per user. Disband the existing one to create another.",
  "名前を変更できるのは作成者だけです。":
                                "Only the room creator can rename it.",
  "入室中":                      "Inside",
  "開く":                        "Open",
  "ルーム一覧":                  "Rooms",
  "ほかのルーム":                "Other rooms",
  "ポーカー":                    "Poker",
  "Focus Chip {count}枚 — ポーカーで Arc を稼げます":
                                "Focus Chip ×{count} — earn Arc through poker",
  "25分集中で Focus Chip を獲得（ポーカーで配当 ×1.5）":
                                "Earn Focus Chips with 25-min focus blocks (×1.5 payout in poker)",
  "この部屋を解体":              "Disband this room",
  "[Dev] 他ユーザーの部屋を解体":"[Dev] Disband another user's room",
  "解体 (Dev)":                  "Disband (Dev)",
  "作業部屋を解体できませんでした。時間をおいて再度お試しください。":
                                "Couldn't disband the workroom. Please try again in a moment.",
  "解体できませんでした (permission-denied)。この部屋は別アカウントで作成された可能性があります。":
                                "Couldn't disband (permission-denied). This room may have been created by another account.",
  "解体できませんでした ({code})":"Couldn't disband ({code})",
  "解体不可 (permission-denied) | login={email} / createdBy={creator} / uid={uid}":
                                "Disband denied (permission-denied) | login={email} / createdBy={creator} / uid={uid}",
  "この部屋は別アカウントで作成されたため、本番ルール側で削除を拒否されました (rules 未デプロイ)。":
                                "This room was created by another account. Firestore rules currently reject the delete — please redeploy the rules.",
  "削除権限がありません (permission-denied)。":
                                "You don't have permission to delete this room (permission-denied).",
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

  // === Premium Navigation ===
  "{name}のGitHubを開く":                          "Open {name}'s GitHub",
  "フレンドを招待して、":                          "Invite friends to",
  "一緒に学びを積み上げよう":                      "stack up learning together",
  "フレンドを招待する":                            "Invite friends",
  "今は静かです。誰かの記録が始まるとここに流れます。":
    "It's quiet now. New activity will show here as people log work.",

  // === Share to X modal ===
  "Xでシェア":                       "Share on X",
  "今日の作業時間をXでシェア":       "Share today's work time on X",
  "シェア画像プレビュー":             "Share image preview",
  "画像を生成中…":                    "Generating image…",
  "投稿文":                           "Post text",
  "投稿内容を編集できます":           "You can edit the post text",
  "投稿文 {count} / 280 文字":        "Post text {count} / 280 chars",
  "※ X の Web 投稿画面は画像の自動添付に対応していないため、先に「画像をコピー」してから「X を開く」を押し、投稿画面でペースト（Cmd+V / Ctrl+V）してください。":
    "X's web composer doesn't auto-attach images, so copy the image first, then open X and paste it (Cmd+V / Ctrl+V) in the composer.",
  "画像をダウンロード":               "Download image",
  "画像をコピー":                     "Copy image",
  "Xを開く":                          "Open X",
  "画像の生成に失敗しました。":       "Failed to generate the image.",
  "画像をダウンロードしました。":     "Image downloaded.",
  "このブラウザは画像のクリップボードコピーに対応していません。ダウンロードしてからご利用ください。":
    "This browser can't copy images to the clipboard. Please download instead.",
  "画像をコピーしました。Xの投稿画面で貼り付けてください。":
    "Image copied. Paste it in the X composer.",
  "クリップボードへのコピーに失敗しました。":
    "Failed to copy to clipboard.",

  // === Goal Picker Modal ===
  "カテゴリ":                                       "Category",
  "名前・かな・略称で検索 (例: とうだい / AWS)":  "Search by name, kana, or abbreviation (e.g. todai / AWS)",
  "{total} 件 (上位 {max} 件を表示)":              "{total} results (showing top {max})",
  "{count} 件":                                    "{count} results",
  "該当する目標が見つかりません。検索語を変えてみてください。":
    "No matching goal. Try a different search term.",

  // === iOS install hint / PWA install ===
  "ホーム画面に追加":                              "Add to Home Screen",
  "下の":                                          "Tap the",
  "共有ボタン → 「ホーム画面に追加」で、ネイティブアプリのように開けます。":
    "Share button → 'Add to Home Screen' to open like a native app.",
  "アプリとして追加":                              "Add as app",
  "アプリとして追加しますか？":                    "Add as an app?",
  "ホーム画面 / Dock に追加すると、ブラウザを開かずに 1 タップで起動できます。":
    "Add to home screen / Dock to launch in one tap without opening a browser.",
  "後で":                                          "Later",
  "追加する":                                      "Add",

  // === Install Instructions Modal ===
  "スマホアプリとしてダウンロード":                "Install as a mobile app",
  "ブラウザに登録するだけで、Contribution Arc がスマホアプリのように起動できます。お使いの環境向けの手順を表示しています。":
    "Just register it in your browser and Contribution Arc launches like a mobile app. Showing the steps for your environment.",
  "すでにホーム画面から起動しています。最新のアイコンに更新したい場合は、一度ホーム画面のアイコンを長押しで削除してから、下の手順で再追加してください。":
    "You're already launching from the home screen. To refresh the icon, long-press to remove it, then re-add it with the steps below.",
  "画面下の":                                      "From the bottom of the screen,",
  "共有ボタン":                                    "Share button",
  "をタップ":                                      "and tap it",
  "メニューを下にスクロールし、":                  "Scroll down the menu, then",
  "「ホーム画面に追加」":                          "'Add to Home Screen'",
  "を選ぶ":                                        "select",
  "右上の":                                        "In the top-right,",
  "「追加」":                                      "'Add'",
  "をタップして完了":                              "tap to finish",
  "ブラウザ右上のメニュー":                        "From the browser's top-right menu",
  "を開く":                                        "open",
  "または":                                        "or",
  "「アプリをインストール」":                      "'Install app'",
  "確認ダイアログで":                              "In the confirm dialog,",
  "追加中…":                                       "Adding…",
  "今すぐ追加する":                                "Add now",
  "追加しました。ホーム画面のアイコンから起動できます。":
    "Added. Launch from the home screen icon.",
  "ブラウザのメニューを開く":                      "Open the browser menu",
  "の項目を選ぶ":                                  "select the item",
  "すでに古いアイコンを置いている場合は、長押しで一度削除してから再追加すると新しいアイコンに更新されます。":
    "If you have an old icon, long-press to remove and re-add to refresh to the new icon.",

  // === Arc Purchase Panel ===
  "Arc を購入":                       "Buy Arc",
  "シルエット解錠などに使えます":     "Use for silhouette unlocks and more",
  "+{amount} Arc を付与しました":     "+{amount} Arc granted",
  "確認中…":                          "Verifying…",
  "処理中…":                          "Processing…",
  "購入に失敗しました":               "Purchase failed",
  "レシートの読み取りに失敗しました": "Failed to read receipt",
  "サーバー検証で問題が発生しました": "Server verification failed",
  "通信エラーが発生しました":         "Network error occurred",
  "この端末では課金できません":       "This device can't make payments",
  "購入を開始できませんでした":       "Could not start purchase",

  // === Silent Workspace Room ===
  "今":                               "now",
  "{n}秒前":                          "{n}s ago",
  "{n}分前":                          "{n}m ago",
  "{n}時間前":                        "{n}h ago",
  "{n}日前":                          "{n}d ago",
  "{name} さんが入室":                "{name} joined",
  "{name} さん他 {count} 人が入室":   "{name} and {count} others joined",
  "{count}人が作業中":                "{count} working now",
  "作業内容を入力":                   "Enter what you're working on",
  "入室する":                         "Join room",
  "解体する":                         "Disband room",
  "未入室":                           "Not joined",
  "ルームメニューを閉じる":           "Close room menu",
  "ルームメニューを開く":             "Open room menu",
  "募集を取り消す":                   "Cancel recruitment",
  "取消":                             "Cancel",
  "今やってること":                   "Now working on",
  "+ 「{task}」を記録に追加":          "+ Add '{task}' to records",
  "休憩終了":                         "End break",
  "ルーム情報":                       "Room info",
  "ルーム内アクション":               "Room actions",
  "定型文を閉じる":                   "Close presets",
  "定型文を開く":                     "Open presets",
  "定型文":                           "Presets",
  "置き手紙を残す":                   "Leave a note",
  "置き手紙":                         "Note",
  "分身の見た目を変える":             "Change avatar appearance",
  "着替え":                           "Change look",
  "静かな部屋。最初のひと言を残してみよう。":
    "Quiet room. Try leaving the first word.",
  "ルームの発言ログ":                 "Room message log",
  "最近の発言":                       "Recent messages",
  "{name}さんの置き手紙":             "{name}'s note",
  "床をタップして移動できます":       "Tap the floor to walk",
  "在室者":                           "Members in room",
  "まだ誰もいません。最初の一人になりましょう。":
    "No one here yet. Be the first.",
  "（あなた）":                        " (you)",
  "自分の操作":                       "Your controls",
  "集中に戻る":                       "Back to focus",
  "休憩する":                         "Take a break",
  "ひとこと送る":                     "Send a quick word",
  "（{count}人）":                    " ({count} people)",
  "退出する":                         "Leave room",
  "作業中のメンバー":                 "Members working",
  "まだ誰もいません":                 "No one here yet",
  "メニューを閉じる":                 "Close menu",
  "操作メニューを開く":               "Open actions menu",
  "定型コミュニケーション":           "Quick comms",
  "{message} ({key} キーで送信)":     "{message} (press {key} to send)",
  "定型文編集":                       "Edit presets",
  "定型文を入力":                     "Enter a preset",

  // === Manager Dashboard ===
  "チーム学習ダッシュボード":         "Team learning dashboard",
  "あなたのチーム":                   "Your team",
  "{n} 名":                           "{n} members",
  "チーム学習サマリーをSlackに送信":  "Send team learning summary to Slack",
  "Slackに送信済み":                  "Sent to Slack",
  "Slackにサマリー送信":              "Send summary to Slack",
  "メンバー一覧をCSVでダウンロード": "Download member list as CSV",
  "CSVをダウンロード":                "Download CSV",
  "メンバーを招待すると、ここにチームの学習が集まります":
    "Invite teammates and their learning activity will show here",
  "設定の「招待リンク」からメンバーを追加すると、稼働状況・学習時間・フォローしたいメンバーが自動でまとまります。":
    "Use the 'Invite link' in Settings to add teammates — their activity, study time, and who to follow up with will be summarized automatically.",
  "メンバー数":                       "Members",
  "稼働率（7日以内）":                "Active rate (7 days)",
  "{n} 名がアクティブ":               "{n} members active",
  "総学習時間":                       "Total study time",
  "平均 {n}h / 人":                   "Average {n}h / person",
  "総アウトプット":                   "Total output",
  "コミット・投稿 EXP":               "Commit & post EXP",
  "チームの学習トレンド":             "Team learning trend",
  "直近 {n} 週間":                    "Last {n} weeks",
  "{n} 名が記録":                     "{n} members logging",
  "トレンドを読み込めませんでした。": "Couldn't load trend.",
  "この期間の学習記録はまだありません。メンバーが学習を記録すると、ここに週ごとの推移が表示されます。":
    "No study records for this period yet. Once members log study time, weekly trends will appear here.",
  "週ごとのチーム学習時間の推移":     "Weekly team study time trend",
  "{n}週前":                          "{n} weeks ago",
  "今週 {n}h":                        "This week {n}h",
  "学習トピック":                     "Learning topics",
  "トピックの記録がありません。":     "No topics recorded.",
  "他 {n} トピック":                  "{n} more topics",
  "チームの状態":                     "Team status",
  "最終同期から":                     "Since last sync",
  "{label} {n}名":                    "{label} {n} members",
  "アクティブ":                       "Active",
  "停滞ぎみ":                         "Slowing",
  "休眠":                             "Dormant",
  "フォローしたいメンバー":           "Members to follow up with",
  "全員が直近で記録しています。良いペースです。":
    "Everyone has logged recently. Great pace.",
  "まだ学習記録がありません":         "No study records yet",
  "{when}から記録がありません":       "No records since {when}",
  "メンバー別 学習時間":              "Study time by member",
  "累計（時間）":                     "Total (hours)",
  "他 {n} 名":                        "{n} more members",
  "レベル分布":                       "Level distribution",
  "人数":                             "Members",
  "チーム別":                         "By team",
  "学習時間 / 稼働率":                "Study time / active rate",
  "未割り当て":                       "Unassigned",
  "稼働 {n}%":                        "Active {n}%",
  "メンバーを検索（名前またはID）":   "Search members (name or ID)",
  "メンバー検索":                     "Search members",
  "チームで絞り込む":                 "Filter by team",
  "すべてのチーム":                   "All teams",
  "メンバー一覧 ({n})":               "Members ({n})",
  "該当するメンバーがありません":     "No matching members",
  "あなた":                           "You",
  "管理者":                           "Admin",
  "未同期":                           "Not synced",
  "今日":                             "Today",
  "昨日":                             "Yesterday",
  "{n}週間前":                        "{n} weeks ago",
  "{n}ヶ月前":                        "{n} months ago",
  "{n}年前":                          "{n} years ago",
  "{name} の学習詳細":                "{name}'s study details",
  "累計学習":                         "Total study",
  "レベル":                           "Level",
  "アウトプット":                     "Output",
  "最終同期":                         "Last sync",
  "詳細データは利用できません。":     "Detail data unavailable.",
  "学習記録を読み込めませんでした。": "Couldn't load study records.",
  "直近 13 週間の学習記録はまだありません。記録が増えると、ここに学習の推移が表示されます。":
    "No study records in the last 13 weeks yet. As records accumulate, trends will appear here.",
  "直近 13 週間 ・ {days} 日活動 ・ {hours}h":
    "Last 13 weeks · {days} days active · {hours}h",
  "13週間の学習ヒートマップ":         "13-week study heatmap",
  "少":                               "Less",
  "多":                               "More",
  "週ごとの推移":                     "Weekly trend",
  "週ごとの学習時間":                 "Weekly study time",
  "他 {n}":                           "{n} more",
  "送信しました":                     "Sent",
  "送信に失敗しました":               "Failed to send",

  // === App.tsx notification / activity / monument / presence ===
  "いいね":                           "Like",
  "フレンド申請":                     "Friend request",
  "作業しました":                     "worked",
  "{subject}を{duration}{verb}。":     "{verb} {subject} for {duration}.",
  "30日連続ログイン":                  "30-day streak",
  "レベル20到達":                      "Reached level 20",
  "累計1,000コントリビュート":         "1,000 total contributions",
  "レベル10到達":                      "Reached level 10",
  "7日連続ログイン":                   "7-day streak",
  "{name} さんの記念碑：{short}":      "{name}'s monument: {short}",

  // === 残り画面の一括翻訳 (i18n: フェーズ 3) ===
  "{count}人": "{count} people",



  // === 追加: setToast / showToast / promptUI 残り ===
  "CSVをダウンロードしました": "CSV downloaded",
  "Slack設定を保存しました": "Slack settings saved",
  "アカウントを削除しました": "Account deleted",
  "エクスポートに失敗しました": "Export failed",
  "フレンド申請をローカルに保存しました。再接続後に同期します。": "Friend request saved locally. Will sync when you reconnect.",
  "ブロックを解除しました": "Unblocked",
  "プロフィールリンク（コピーしてください）": "Profile link (copy this)",
  "今日はもう応援を送りました": "You've already sent support today",
  "今日やることを記録しました。1日を始めましょう。": "Today's plan saved. Let's start the day.",
  "個人データをダウンロードしました": "Your data has been downloaded",
  "名前を入力してください": "Please enter a name",
  "名前を変更できませんでした": "Couldn't rename",
  "投稿しました": "Posted",
  "招待を送れませんでした。時間をおいて再度お試しください": "Couldn't send invite. Please try again in a moment.",
  "招待リンクをコピーしました（14日有効）": "Invite link copied (valid for 14 days)",
  "日次サマリーをSlackに送信": "Send daily summary to Slack",
  "決済ページを開けませんでした。時間をおいて再度お試しください。": "Couldn't open the checkout page. Please try again in a moment.",
  "申請を拒否しました": "Request declined",
  "画像を読み込めませんでした": "Couldn't load the image",
  "組織から退出しました": "Left the organization",
  "請求ポータルを開けませんでした。": "Couldn't open the billing portal.",

  // === Phase 4: missing keys discovered by audit ===
  "今週 {time}": "This week {time}",
  "連続 {days}日": "{days}-day streak",
  "{hours}時間 学習": "{hours} h studied",
  "直近13週": "Last 13 weeks",
  "{days}日学習": "{days} days studied",
  "日コミット": "daily commits",
  "先週比 {diff}": "vs last week {diff}",
  "連続して記録した最長期間": "Longest streak ever logged",
  "最長連続": "Longest streak",
  "合計 {minutes}": "Total {minutes}",
  "最も学んだ月": "Most studied month",
  "直近13週: {days}日学習{commit}": "Last 13 weeks: {days} days studied{commit}",
  "曜": "",
  "ほか {count} 件": "{count} more",
  "記録なし": "No records",
  "コミット": "Commits",
  "クイック記録 — 今日 {duration} 学習": "Quick log — {duration} studied today",
  "クイック記録": "Quick log",
  "今日 {duration}": "Today {duration}",
  "平日連続記録 {n}日(土日は対象外)": "Weekday streak {n} day(s) (weekends excluded)",
  "平日連続記録 {n}日 — 今日も記録済み": "Weekday streak {n} — logged today too",
  "平日連続記録 {n}日 — 今日はまだ記録なし": "Weekday streak {n} — no log yet today",
  "平日連続記録 {n}日": "Weekday streak {n}",
  "フォロー機能を使うには、設定から自分のユーザーIDを登録してください。":
    "To use following, set your user ID in Settings.",
  "管理": "Manage",
  "教科書の表紙などを撮ると、ライブラリでアイコンとして表示されます。":
    "Snap a textbook cover and it becomes the icon in your library.",
  "書籍": "Book",
  "累計": "Total",
  "時間を指定して記録": "Log specific time",
  "時間数": "Hours",
  "時間": "Hours",
  "分数": "Minutes",
  "作業部屋を5分以上利用したり、本のページが進んだら自動でタイムラインに流れます。仲間の積み上げが見えるようになり、お互いを応援しやすくなります。":
    "When you spend 5+ minutes in a workroom or make progress in a book, it flows into the timeline automatically. You'll see your peers' progress and can cheer each other on.",
  "スマホアプリ": "Mobile app",
  "ホーム画面 / Dock に追加すると、ブラウザを開かずに 1 タップで起動できます。iPhone / Android どちらも対応。アイコンを更新したい場合もここから手順を確認できます。":
    "Add to your home screen / Dock for one-tap launch without opening a browser. Works on both iPhone and Android. You can also re-check the steps to refresh the icon here.",
  "ダウンロード": "Download",
  "運営からのお知らせ": "Announcements",
  "要望を書く": "Write feedback",
  "追加してほしい機能や不具合など、お気軽にお寄せください。今後の開発の参考にさせていただきます。":
    "Share feature requests, bugs, or anything else. We'll use it to guide future development.",
  "例: 日報にタグを付けられるようにしてほしい / ○○の画面で△△が起きる":
    "e.g. I'd like tags on daily reports / On screen XX, YY happens",
  "下書き": "Draft",
  "記録する — 学びの時間を積み上げる中心":
    "Log — the home of your learning hours",
  "学習対象を登録し、各カードから時間を記録。残した時間はホームのグラフと EXP に反映されます。":
    "Register learning subjects and log time from each card. Logged time feeds your home graph and EXP.",
  "時間を入力すると、その分だけ Effort EXP が貯まります":
    "Entering time grows your Effort EXP",
  "ページ数を持つ本タイプは「現在ページ / 総ページ」も追えます":
    "Books with page counts also track current / total pages",
  "学習対象をジャンルと色で登録・整理。各カードから時間を記録できます。":
    "Register and organize learning subjects by category and color. Log time directly from each card.",
  "記録する時間数": "Hours to log",
  "記録する分数": "Minutes to log",
  "他の時間を指定して記録": "Log a different amount of time",
  "記録中": "Logging…",
  "積み上げの累計と、見た目・連携の設定をここでまとめます。":
    "Cumulative progress plus appearance and integration settings all live here.",
  "キャラクターの色を変えて、作業部屋での自分を識別しやすく":
    "Change your character color so others spot you in workrooms",
  "「決意」欄に短い宣言を書いておくと、毎日の起動時に思い出せます":
    "Write a short \"resolve\" so you see it every time you launch",
  "あなたのユーザーID (@xxx) は他の人があなたを検索する手掛かり":
    "Your user ID (@xxx) is how others find you",
  "「今やってること」を入力 → 入室すると 2D 部屋にあなたのキャラが現れます":
    "Type \"what I'm doing\" and enter — your character appears in the 2D room",
  "「募集する」で同じ時間に集まる仲間を呼べます":
    "Use \"Recruit\" to call peers to work at the same time",
  "退室すると今回の作業時間が記録され、EXP として加算されます":
    "Leaving the room logs your session time and adds to your EXP",
  "通話も雑談も主役にしない。同じ時間に手を動かしている気配だけを共有します。":
    "No calls, no chatter. Just the quiet presence of people working at the same time.",
  "部屋を作る": "Create room",
  "作業部屋を作成": "Create workroom",
  "公開範囲": "Visibility",
  "公開": "Public",
  "のみ": "only",
  "一覧を更新": "Refresh list",
  "組織限定": "Org only",
  "組織限定ルーム": "Org-only room",
  "まだ部屋がありません。上の「+ 部屋を作る」から作成しましょう。":
    "No rooms yet. Tap \"+ Create room\" above to make one.",
  "すべて見る": "View all",
  "いまは新しいお知らせはありません。": "No new announcements right now.",
  "積み上げの全体像と、いま仲間が何をしているかをまとめて見られます。":
    "See your overall progress and what your peers are doing at a glance.",
  "13週間のコントリビューショングラフで毎日の取り組みを可視化":
    "Visualize daily effort with a 13-week contribution graph",
  "GitHub を連携すると commit もこのグラフに合流します":
    "Link GitHub and your commits join the same graph",
  "今日の予定を立てる": "Plan today",
  "おはよう。今日は何をやる？": "Good morning. What's on the plate today?",
  "今日は書かずに進む": "Skip and start the day",
  "スキップ": "Skip",
  "例: DDIA Ch.7 を読み切る": "e.g. Finish DDIA Ch.7",
  "日報の「今日やること」として保存される。短くてもOK。":
    "Saved as today's plan in your daily report. Short is fine.",
  "今日を始める": "Start the day",
  "投稿を閉じる": "Close post",
  "投稿を開く": "Open post",
  "作業部屋 — 現在 {count} 人が作業中": "Workroom — {count} people working now",
  "今すぐ記録": "Log now",
  "学習対象がまだありません。1つ登録すると、ここから時間を記録できます。":
    "No learning subjects yet. Add one to start logging time here.",
  "学習対象を管理": "Manage learning subjects",

  // === Phase 4b: AppErrorBoundary / ToastHost / misc components ===
  "画面の復帰が必要です。": "We need to restore the screen.",
  "データの読み込み中に表示が止まりました。再読み込みすると直前の状態から復帰します。":
    "The display froze while loading data. Reloading will restore the previous state.",
  "エラー詳細": "Error details",
  "通知: {message} (タップで閉じる)": "Notification: {message} (tap to dismiss)",
  "{value} / {max} 文字": "{value} / {max} characters",
  "メンション候補": "Mention suggestions",
  "はじめてのヒント": "First-time hint",
  "わかった": "Got it",

  "13週合計に戻す": "Back to 13-week total",
  "Contribution Arc の世界": "Contribution Arc's world",
  "Roomタイトル": "Room title",
  "Slack連携": "Slack integration",
  "いまの活動": "Current activity",
  "その他の操作": "More actions",
  "よくある質問": "FAQ",
  "ショップヘッダー": "Shop header",
  "タイムラインの表示範囲": "Timeline range",
  "ダッシュボードのイメージ": "Dashboard preview",
  "ドメイン自動参加": "Domain auto-join",
  "ビュー切替": "Switch view",
  "フィードの種類": "Feed type",
  "フィードの表示範囲": "Feed scope",
  "フレンドを検索": "Search friends",
  "フレンド申請を拒否": "Decline friend request",
  "プライバシー方針": "Privacy policy",
  "プラン": "Plan",
  "プロフィールヘッダー": "Profile header",
  "メニュー": "Menu",
  "世界観を見る": "View the world",
  "主な機能": "Key features",
  "今日の足場": "Today's footing",
  "今日獲得したEXP": "EXP earned today",
  "今週のランキング": "This week's ranking",
  "今週の学習記録": "This week's learning",
  "作業部屋での積み上げ": "Workroom progress",
  "価値提案": "Value proposition",
  "危険な操作": "Dangerous actions",
  "始める": "Get started",
  "学習記録から自動投稿": "Auto post from study logs",
  "導入の流れ": "Onboarding flow",
  "所持 Arc": "Arc owned",
  "投稿で Arc を貯める": "Earn Arc by posting",
  "投稿を作成": "Create a post",
  "投稿を削除": "Delete post",
  "操作": "Actions",
  "現在のプラン": "Current plan",
  "認証モード": "Auth mode",
  "通知イベント": "Notification events",
  "選択日の学習詳細": "Study details for selected day",
  "開始タイミング": "Start timing",
  "開発ログタイムライン": "Dev log timeline",
  "集計": "Aggregate",
  // === WorkspaceRecruitmentFeedCard ===
  "まもなく": "Soon",
  "あと{minutes}分": "{minutes} min left",
  "あと{hours}時間{rest}分": "{hours}h {rest}m left",
  "あと{hours}時間": "{hours}h left",
  "今日 {hh}:{mm}": "Today {hh}:{mm}",
  "たった今": "Just now",
  "{minutes}分前": "{minutes} min ago",
  "{hours}時間前": "{hours} h ago",
  "{days}日前": "{days} d ago",
  "残り {hours}時間{rest}分": "{hours}h {rest}m left",
  "残り {hours}時間": "{hours}h left",
  "残り {minutes}分": "{minutes} min left",
  "残り {minutes}:{seconds}": "{minutes}:{seconds} left",
  "🗓 予定": "🗓 Scheduled",
  "募集中": "Open",
  "終了": "Ended",
  "{start} 開始 · {relative}": "Starts {start} · {relative}",
  "終了しました": "Ended",
  "作業": "Task",
  "参加": "Joined",
  "人": " people",
  "取り消す": "Cancel",
  "参加中": "Joined",
  "参加する": "Join",
  "参加予定": "Going",
  "参加予定にする": "RSVP",
  "この募集は終了しました": "This recruitment has ended",

  // === PokerView ===
  "← 作業部屋に戻る": "← Back to workroom",
  "♠ Arc を増やすには集中して稼ぐ。": "♠ To grow Arc, earn it by focusing.",
  "残高": "Balances",
  "Arc 残高": "Arc balance",
  "ポーカーチップ残高": "Poker chip balance",
  "今日のFocus Chip残高（集中作業で獲得）": "Today's Focus Chip balance (earned via focus work)",
  "ペイテーブル": "Paytable",
  "Royal Flush は MAX BET 時 800×bet。": "Royal Flush pays 800×bet at MAX BET.",
  "Focus Chip モードは全配当 ×1.5、HOT STREAK は次の当たり配当 +20%。": "Focus Chip mode pays ×1.5 on all wins; HOT STREAK adds +20% to the next win.",
  "連勝カウンタ": "Win streak counter",
  "ベットを決めて ": "Set your bet, then ",
  "。": ".",
  "残したい札をタップ → ": "Tap cards to hold → ",
  "ノーペイ": "No pay",
  "通常チップ": "Normal chips",
  "作業部屋に25分滞在で Focus Chip を獲得（1日8枚まで）": "Stay in a workroom for 25 minutes to earn a Focus Chip (up to 8/day).",
  "配当 ×1.5": "Payout ×1.5",
  "ベット額": "Bet amount",
  "RTP 95% — 長くやると確率的に負け越す": "RTP 95% — over the long run you lose statistically",
  "配当 ×1.5 — 集中で稼いだ Focus でだけ勝ち越せる": "Payout ×1.5 — only Focus earned through focus work lets you come out ahead",
  "残してない札を交換": "Swap unheld cards",
  "チップ不足": "Not enough chips",
  "Focus 不足": "Not enough Focus",
  "両替が必要です": "Exchange required",
  "両替を閉じる": "Close exchange",
  "Arc ⇄ チップ 両替": "Arc ⇄ Chip exchange",
  "両替・換金": "Exchange & cash out",
  "Arc → チップは 1 Arc = {chip} chip。チップ → Arc は {cashout} chip = {arc} Arc。": "Arc → Chip is 1 Arc = {chip} chip. Chip → Arc is {cashout} chip = {arc} Arc.",
  "所持 Arc: {n}": "Arc owned: {n}",
  "{amt} Arc": "{amt} Arc",
  "→ {n} chip": "→ {n} chip",
  "Arc が足りません → ショップへ": "Not enough Arc → go to Shop",
  "所持 chip: {n}": "Chip owned: {n}",
  "換金レートは購入レートより辛口。たくさん勝ってまとめて換金しよう。": "The cashout rate is stingier than the buy rate. Win a lot, then cash out in bulk.",

  // === Phase 4c: LoginScreen ===
  "日々のコミットが、あなたの軌跡を描く。": "Every daily commit traces your arc.",
  "メールフォームを閉じる": "Close email form",
  "メールで続行": "Continue with email",
  "続行するとアカウントが自動的に作成されます。": "By continuing, an account is created automatically.",

  // === ManagerDashboard ===
  "ロール": "Role",
  "チーム": "Team",
  "学習時間（時間）": "Study time (hours)",
  "アウトプットEXP": "Output EXP",
  "ストリーク（日）": "Streak (days)",
  "コミット数": "Commits",
  "最終同期日時": "Last synced at",
  "学習時間が多い順": "Most study time",
  "最近アクティブな順": "Recently active",
  "レベルが高い順": "Highest level",
  "アウトプットが多い順": "Most output",
  "その他": "Other",
  "、": ", ",
};
