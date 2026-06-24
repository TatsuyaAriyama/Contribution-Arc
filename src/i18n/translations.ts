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
  "日報リマインド（朝・夜）": "Daily report reminders (morning & evening)",
  "日報の時間です":      "Time for your daily report",
  "おはようございます。今日の「やること」を日報に書いて1日を始めましょう。":
                       "Good morning. Start the day by noting today's plan in your daily report.",
  "おつかれさまでした。今日の振り返りを日報に残しておきましょう。":
                       "Nice work today. Take a moment to log your reflection in the daily report.",
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
  "タイムライン":        "Timeline",
  "ライブラリの表示":    "Library view",
  "まだ学習記録がありません。": "No study records yet.",
  "ライブラリの教材から記録すると、ここに時系列で並びます。":
                       "Records you log from your library appear here in order.",
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
  "前の週":                      "Previous week",
  "次の週":                      "Next week",
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
  "{day} の学習を見る":            "View {day}'s learning",
  "選択した曜日の詳細":            "Selected day details",
  "「{subject}」({minutes}分) を削除しますか？":
                                  "Delete \"{subject}\" ({minutes} min)?",
  "学習時間 (分)":                 "Study minutes",
  "学習時間を更新できませんでした": "Couldn't update study time",
  // ─── Library: barcode scan & record form ────────────────────
  "バーコード": "Barcode",
  "バーコードで本を追加": "Add a book by barcode",
  "本の裏表紙にあるバーコード (ISBN) を枠に合わせてください": "Line up the barcode (ISBN) on the back cover",
  "カメラを起動中…": "Starting camera…",
  "このブラウザはカメラを利用できません。ISBN を手入力してください。": "This browser can't use the camera — enter the ISBN manually.",
  "カメラを起動できませんでした。権限を許可するか、ISBN を手入力してください。": "Couldn't start the camera. Allow access, or enter the ISBN manually.",
  "ISBN を手入力 (例: 9784…)": "Enter ISBN (e.g. 9784…)",
  "本の情報を取得しました。内容を確認して保存してください": "Got the book details — review and save.",
  "該当する本が見つかりませんでした。手入力で登録してください": "No matching book found — add it manually.",
  "本の情報の取得に失敗しました。手入力で登録してください": "Couldn't fetch the book — add it manually.",
  "記録の入力": "Log an entry",
  "詳細・編集": "Details & edit",
  "学習量（任意）": "Amount (optional)",
  "問題 / 章 など": "problems / chapters, etc.",
  "学習量": "Amount",
  "単位": "Unit",
  "要点・ひとことメモ（任意）": "Notes (optional)",
  "今日やったこと / 気づき": "What you did / any insights",
  "画像（任意）": "Image (optional)",
  "画像を追加": "Add image",
  "画像を削除": "Remove image",
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
  "Appleで続行":                 "Continue with Apple",
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
  "{count}人をフォロー中":      "Following {count}",
  "残高 {count} Arc":           "{count} Arc",
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
  "起動するたびに目に入る、今の自分への一行。":
                                "A line to yourself you'll see every time you open the app.",
  "GitHub ユーザー名":          "GitHub username",
  "入力すると、あなたの public な草（contribution）がプロフィールの図に重なります。":
                                "Enter it to overlay your public GitHub contributions onto your profile chart.",

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
  "過去の記録":                 "History",
  "日報の表示":                 "Daily report view",
  "見積もり時間(分)":            "Estimated minutes",
  "見積もり時間(時間)":          "Estimated hours",
  "見積もり合計 {time}":         "Estimated total {time}",
  "見積もり {time}":             "Estimate {time}",
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
  "今日の +50 Arc は獲得済み。明日も日報で継続しましょう。":
                                "Today's +50 Arc is earned. Keep the streak going with tomorrow's report.",
  "明日も「今日やること」と「振り返り」の両方共有で Arc を狙えます。":
                                "Earn Arc again tomorrow by sharing both today's plan and reflection.",
  "明日も日報を記録すれば Arc を狙えます。":
                                "Log a report again tomorrow to earn more Arc.",
  "両方を共有すると +50 Arc / 日":
                                "Share both to earn +50 Arc / day",
  "今日の日報を記録すると +50 Arc / 日":
                                "Log today's report to earn +50 Arc / day",
  "今日の達成状況":              "Today's progress",
  "今日やることの進捗":          "Plan progress",
  "+50 Arc 獲得 ✦ 今日の日報を記録しました":
                                "+50 Arc earned ✦ You logged today's report",

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
  "過去の日報 {days} 日分の +{arc} Arc を付与しました":
                                "Granted +{arc} Arc for {days} days of past reports",
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
  "集中":                       "Focused",
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
  "日報を削除": "Delete daily report",
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

  // === Phase 4d: App.tsx toast / window.confirm / org / slack ===
  "ピリオドは先頭と末尾には使えません。": "Period cannot be used at the start or end.",
  "ピリオドは連続して使えません。": "Periods cannot be used consecutively.",
  "「{name}」に参加しました": "Joined \"{name}\"",
  "+{grant} Focus Chip 🔥（ポーカーで通常チップの 1.5× 配当 / 残り {remaining} 枚 ）":
    "+{grant} Focus Chip 🔥 (×1.5 payout in poker vs. normal chips / {remaining} left)",
  "+{reward} Arc 獲得（投稿ボーナス上限 {cap} に到達）":
    "+{reward} Arc earned (reached the {cap} posting-bonus cap)",
  "+{reward} Arc 獲得（累計 {earned} / {cap}）":
    "+{reward} Arc earned (total {earned} / {cap})",
  "このログを削除しますか？": "Delete this log?",
  "{name} をフレンドから外しました": "Removed {name} from friends",
  "{name} をブロックしました": "Blocked {name}",
  "{name} に応援を送りました": "Cheered {name}",
  "{friend} を「{room}」に招待しました": "Invited {friend} to \"{room}\"",
  "{n} 人に一斉招待を送りました": "Sent invites to {n} people",
  "「{name}」へ移動しました": "Moved to \"{name}\"",
  "{name} を作業部屋から強制退出させますか？この操作は取り消せません。":
    "Force {name} out of the workroom? This action cannot be undone.",
  "{name} を退出させました": "Removed {name}",
  "退室しました ・ {time} で +{exp} EXP": "Left the room · +{exp} EXP for {time}",
  "組織「{name}」を作成しました": "Created organization \"{name}\"",
  "招待リンク（コピーしてください）": "Invite link (copy this)",
  "オーナーは退出できません。Admin ダッシュボードから他メンバーへオーナーを譲渡してから退出してください。":
    "Owners cannot leave. Transfer ownership to another member from the Admin dashboard first.",
  "「{name}」から退出します。組織限定のルームは見えなくなります。":
    "Leave \"{name}\"? You'll lose access to org-only rooms.",
  "{name} を「{org}」から除名します。除名後、本人の組織限定ルームは見えなくなります。本人のアカウントとログは残ります。よろしいですか？":
    "Remove {name} from \"{org}\"? They'll lose access to org-only rooms. Their account and logs remain. Proceed?",
  "{name} を除名しました": "Removed {name}",
  "データを削除しました。認証アカウントの完全削除には、もう一度ログインして再度アカウント削除を実行してください。":
    "Your data has been deleted. To fully remove the authentication account, please sign in again and re-run account deletion.",
  "「{org}」のオーナー権限を {name} に譲渡します。譲渡後、あなたはメンバーになります。よろしいですか？":
    "Transfer ownership of \"{org}\" to {name}? You'll become a regular member. Proceed?",
  "オーナーを {name} に譲渡しました": "Transferred ownership to {name}",
  "現在のオーナーのみ譲渡できます。": "Only the current owner can transfer ownership.",
  "譲渡先は同じ組織のメンバーである必要があります。": "The recipient must be a member of the same organization.",
  "同じユーザーへの譲渡はできません。": "You cannot transfer to the same user.",
  "オーナー譲渡に失敗しました。再度お試しください。": "Ownership transfer failed. Please try again.",
  "監査ログを読み込めませんでした。": "Couldn't load audit logs.",
  "https://hooks.slack.com/services/… 形式のURLのみ受け付けます。":
    "Only URLs in the https://hooks.slack.com/services/… format are accepted.",
  "保存しました。": "Saved.",
  "Slack連携を解除しました。": "Slack integration disconnected.",
  "保存に失敗しました。再度お試しください。": "Save failed. Please try again.",
  "先にSlack Incoming Webhook URLを入力してください。": "Please enter the Slack Incoming Webhook URL first.",
  "Slackチャンネルに送信しました。届いていれば設定OKです。":
    "Sent to your Slack channel. If it arrived, the setup is good.",
  "URLが Slack の hooks.slack.com 形式ではありません。": "URL is not in the Slack hooks.slack.com format.",
  "Slackへの送信に失敗しました ({code}).": "Failed to send to Slack ({code}).",
  "日次サマリーを送信しました。": "Daily summary sent.",
  "送信に失敗しました ({code}).": "Send failed ({code}).",
  "再読み込みに失敗しました。": "Reload failed.",
  "役割": "Role",
  "ストリーク": "Streak",
  "最終アクティブ": "Last active",
  "Roomを作成しました。": "Room created.",
  "{name}を解体しますか？このRoomは一覧から消えます。":
    "Disband {name}? This room will be removed from the list.",
  "[Dev] 他ユーザーが作成した「{name}」を解体しますか？この操作は取り消せません。":
    "[Dev] Disband \"{name}\" created by another user? This action cannot be undone.",
  "組織を作って始める": "Create an organization to start",
  "オーナーは削除できません。Admin ダッシュボードからオーナーを譲渡してから削除してください。":
    "Owners cannot be deleted. Transfer ownership from the Admin dashboard first.",
  "プライバシーポリシー": "Privacy policy",
  "利用規約": "Terms of Service",
  "サポート": "Support",
  "ポーカーを準備中…": "Preparing poker…",
  "✦ 分身を変える": "✦ Change your character",
  "組織情報を読み込めませんでした。": "Couldn't load organization info.",

  // === Character shape names / taglines / intros ===
  "灯": "Tomo",
  "朧": "Oboro",
  "宵": "Yoi",
  "そばに灯る相棒": "A companion that lights the dark beside you",
  "ふわりと漂う魂": "A soul that drifts softly",
  "夜更けの番人": "Keeper of the late night",
  "暗がりにそっと灯る、はじまりの相棒。":
    "A first companion that quietly lights the dark.",
  "輪郭をほどいて漂う、もう一人のあなた。":
    "Another you, drifting with edges undone.",
  "夜更けをひとり見守る、静かな番人。":
    "A quiet keeper watching alone through the late night.",
  "朧 Oboro": "Oboro",
  "宵 Yoi": "Yoi",
  "脚のない魂のシルエット。作業部屋の片隅でふわりと漂う、もう一人のあなた。":
    "A footless silhouette of a soul. Another you, drifting softly in the corner of the workroom.",
  "丸い頭に大きな琥珀の眼。深夜にひとり手を動かす時間のお供に。":
    "A round head with large amber eyes — your companion for the quiet hours of working alone late at night.",

  // === 煌 Kō / 環 Tamaki ===
  "煌": "Kō",
  "環": "Tamaki",
  "ネオンを灯す機械仕掛け": "A machine glowing with neon",
  "輪をいただく金色の使い": "A golden envoy crowned with a halo",
  "深夜のスポットライトに胸の M を灯す、機械仕掛けの相棒。":
    "A mechanical companion lighting the M on its chest under the late-night spotlight.",
  "頭上にそっと輪を浮かべて佇む、金色の使い。":
    "A golden envoy standing quietly with a halo floating overhead.",
  "煌 Kō": "Kō",
  "環 Tamaki": "Tamaki",
  "胸にネオンの M を灯したナイトロボ。アンテナと黄金縁のエンブレムが、夜の作業を引き締める。":
    "A night robot with a neon M lit on its chest. The antenna and gold-trimmed emblem sharpen your late hours.",
  "頭上に淡い輪を浮かべた金色のキューブ。穏やかな顔のスクリーンが、静かな時間に寄り添う。":
    "A golden cube with a pale halo above. Its gentle screen face keeps you company in the quiet hours.",

  // === 焰 Homura ===
  "焰": "Homura",
  "焰 Homura": "Homura",
  "胸に焰を宿す幼竜": "A dragon hatchling cradling an ember",
  "小さな角と畳んだ翼。胸の奥に焰を抱え、夜空を焦がす日を待つ竜の子。":
    "Small horns and folded wings — a dragon child holding an ember in its chest, waiting for the day it sets the night sky ablaze.",
  "二本の角と研ぎ澄まされた吊り目を持つ暗赤の幼竜。胸に焰を宿し、夜の作業に静かな熱を添える。":
    "A dark-crimson hatchling with two horns and sharp, slanted eyes. The ember in its chest adds a quiet heat to your late work.",

  // === レベル報酬 ===
  "レベル報酬 +{arc} Arc を受け取る": "Claim +{arc} Arc in level rewards",
  "レベル報酬 +{arc} Arc を受け取りました": "Claimed +{arc} Arc in level rewards",

  // === Arc pack badges ===
  "10%お得": "10% off",
  "20%お得": "20% off",
  "30%お得": "30% off",

  // === Character colors (palette names) ===
  "常磐": "Evergreen",
  "深緑": "Deep Green",
  "青磁": "Celadon",
  "縹": "Hanada Blue",
  "紺": "Navy",
  "鈍色": "Slate",
  "菫": "Violet",
  "梅紫": "Plum Purple",
  "薔薇": "Rose",
  "琥珀": "Amber",
  "苔色": "Moss",
  "煉瓦": "Brick",
  "胡桃": "Walnut",
  "枯草": "Dry Grass",
  "若竹": "Young Bamboo",
  "藍鼠": "Indigo Gray",
  "鴇鼠": "Rose Gray",
  "利休鼠": "Sage Gray",
  "藤鼠": "Wisteria Gray",
  "墨": "Sumi Black",

  // === Shape tile suffixes (composed messages) ===
  "（ショップで購入）": " (buy in Shop)",
  "はショップで購入できます": " is available in the Shop",
  "を選択": " — select",
  "{name} はショップで購入できます": "{name} is available in the Shop",
  "{name} {romaji} はショップで購入できます。ショップへ行きますか？":
    "{name} {romaji} is available in the Shop. Go to the Shop?",
  "{name} {romaji}(ショップで購入)":
    "{name} {romaji} (buy in Shop)",

  // === Workspace preset messages ===
  "進捗どうですか？": "How's it going?",
  "おつかれさまです": "Nice work today",
  "集中します": "Focusing now",
  "休憩します": "Taking a break",
  "一緒にやろう": "Let's work together",
  "今日はReactやります": "Working on React today",


  // === Phase 4c: subagent (App.tsx 1000-4000) follow-ups ===
  "少し休憩中です。": "Taking a short break.",
  "{building}を積み上げています。": "Building {building}.",
  "静かに積み上げています。": "Quietly building.",
  "夜の集中作業に向いた、ゆっくり流れるビルドルーム。": "A slow-paced build room suited for late-night deep work.",
  "小さく集中し、積み上げを共有するための静かな空間。": "A quiet space to focus in small bursts and share progress.",
  "このURLはFirebase Authで許可されていません。": "This URL isn't allowed by Firebase Auth.",
  "Firebase ConsoleのAuthentication設定で、このドメインをAuthorized domainsに追加してください。": "Add this domain to Authorized domains in Firebase Console > Authentication.",
  "こちらで開き直してください:": "Reopen here:",
  "まだ登録していない場合は、Sign upに切り替えてアカウントを作成してください。": "If you haven't signed up yet, switch to Sign up to create an account.",
  "入力内容を確認してもう一度お試しください。": "Check your input and try again.",
  "ブラウザのポップアップ許可設定を確認して、もう一度お試しください。": "Check your browser's popup permissions and try again.",
  "ネットワーク接続に失敗しました。": "Network connection failed.",
  "通信状況を確認して、少し待ってからもう一度お試しください。": "Check your connection and try again in a moment.",
  "時間を置いてからもう一度お試しください。": "Wait a moment and try again.",
  "設定または入力内容を確認してください。詳しいエラーはブラウザコンソールにも出力しています。": "Check your settings or input. Detailed errors are also logged to the browser console.",
  "初めまして！": "Nice to meet you!",
  // === PTR + invite + org admin + post quota + donut chart ===
  "離して更新": "Release to refresh",
  "↓ 引っ張って更新": "↓ Pull to refresh",
  "招待リンクが見つかりません。": "Invite link not found.",
  "招待リンクの有効期限が切れています。": "Invite link has expired.",
  "この招待リンクは上限まで使用されています。":
    "This invite link has reached its usage limit.",
  "組織への参加に失敗しました。": "Failed to join the organization.",
  "メンバー一覧を読み込めませんでした。": "Couldn't load member list.",
  "本日の利用上限に達しました。しばらく経ってから再読み込みしてください。":
    "Today's usage limit reached. Please reload after a while.",
  "ログの読み込みを待っています。": "Waiting to load posts.",
  "{month}月{day}日": "{month}/{day}",
  "13週合計": "13-week total",
  "学習中: {building}": "Studying: {building}",

  // === Phase 4f: orphan setOrgError / setOrgAdminError messages ===
  "組織名を入力してください。": "Please enter an organization name.",
  "招待リンクを発行できませんでした。": "Couldn't create an invite link.",
  "退出に失敗しました。再度お試しください。": "Failed to leave. Please try again.",
  "メンバー一覧を読み込めませんでした。再度お試しください。":
    "Couldn't load the member list. Please try again.",
  "除名に失敗しました。Firestore のルール権限を確認してください。":
    "Couldn't remove the member. Check the Firestore rule permissions.",
  "チーム名の保存に失敗しました。": "Couldn't save the team name.",

  // === Phase 4g: ANNOUNCEMENTS titles + bodies ===
  "ライブラリに写真アイコン機能を追加しました": "Photo icons in your library",
  "ライブラリの学習対象ごとに、写真を自由に設定できるようになりました。\n教材の表紙や好きな写真をアイコンにすると、ライブラリが自分だけの本棚のように見やすく整理できます。\n\n使い方:\n1. ライブラリで学習対象を開き、編集画面の「写真 (任意)」から「写真を追加」をタップ\n2. カメラまたはアルバムから写真を選択\n3. 保存すると、ライブラリの一覧でその写真がアイコンとして表示されます\n\n写真はいつでも変更・削除できます。ぜひお気に入りの教材を登録してみてください。":
    "You can now set a photo for each learning subject in your library.\nUse a textbook cover or any photo you like as the icon — your library will look like your own personal bookshelf.\n\nHow to use:\n1. Open a learning subject in your library, tap \"Add photo\" under \"Photo (optional)\" in the edit view\n2. Pick a photo from camera or album\n3. After saving, that photo will appear as the icon in your library list\n\nPhotos can be changed or removed any time. Try registering your favorite study materials.",
  "Contribution Arc をご利用いただきありがとうございます": "Thank you for using Contribution Arc",
  "いつもご利用いただきありがとうございます。\n現在も、サービスをより良い形でユーザーのみなさまにご利用いただけるよう、日々改善に励んでおります。\n不具合のご報告や、追加してほしい機能などがございましたら、こちらの要望欄にご記載いただけますと幸いです。\nいただいたご意見は、今後の開発の参考にさせていただきます。\n引き続きよろしくお願いいたします。":
    "Thank you for using Contribution Arc.\nWe're still actively improving the service so it works better for everyone.\nIf you find a bug or have a feature request, please share it in the feedback form.\nWe'll use your input to guide future development.\nThank you for your continued support.",

  // === Phase 4d: service files ===
  // plans.ts — pricing / pricing table
  "推奨": "Recommended",
  "個人 / 小規模利用": "Personal / small use",
  "5〜50 名のチーム": "Teams of 5–50",
  "51 名以上 / 法務要件あり": "51+ members / legal requirements",
  "お問い合わせ": "Contact us",
  "/ user / 月": "/ user / month",
  "公開ルーム参加": "Join public rooms",
  "学習ログ・GitHub 連携": "Study log & GitHub integration",
  "Arc 通貨でカスタマイズ": "Customize with Arc currency",
  "組織テナント・招待リンク": "Org tenant & invite links",
  "Admin ダッシュボード + CSV": "Admin dashboard + CSV",
  "Slack 連携": "Slack integration",
  "メール優先サポート": "Priority email support",
  "SAML / SSO 認証": "SAML / SSO authentication",
  "SCIM プロビジョニング": "SCIM provisioning",
  "監査ログ・データレジデンシー": "Audit log & data residency",
  "SLA・専任カスタマーサクセス": "SLA & dedicated customer success",

  // shareImage.ts — share-to-X canvas + tweet body
  "今日の作業時間": "Today's work time",

  // slack.ts — Block Kit fallback / mrkdwn body strings sent to Slack
  "*{name}* が *{room}* に入室（{task}）":
    "*{name}* joined *{room}* ({task})",
  "*{name}* が *{room}* を退室（滞在 {stay}）":
    "*{name}* left *{room}* (stayed {stay})",
  "*{name}* が *{room}* で休憩中":
    "*{name}* is on a break in *{room}*",
  "*{name}* が *{room}* で募集中（{task}・{duration}分・開始 {start}）":
    "*{name}* is recruiting in *{room}* ({task} · {duration} min · starts {start})",
  "*{name}* が記録を投稿しました":
    "*{name}* posted an update",
  "*{org}* の日次サマリー":
    "Daily summary for *{org}*",
  "メンバー *{members}* 人 · Effort *{effort}* · Output *{output}* · Contributions *{contributions}*":
    "*{members}* members · Effort *{effort}* · Output *{output}* · Contributions *{contributions}*",
  "{rank}. *{name}* — Effort {effort} / {streak}日連続":
    "{rank}. *{name}* — Effort {effort} / {streak}-day streak",
  "今日はまだ活動がありません。":
    "No activity yet today.",

  // teamDigest.ts — weekly summary posted via Slack webhook
  "{org} 学習サマリー":
    "{org} Learning Summary",
  "{date} 時点":
    "as of {date}",
  "• チーム総学習時間: *{hours}h*":
    "• Total team study time: *{hours}h*",
  "• 稼働中メンバー: *{active}/{total}* 名 ({rate}%)":
    "• Active members: *{active}/{total}* ({rate}%)",
  "• 平均/人: *{hours}h*":
    "• Average per person: *{hours}h*",
  "メンバー別 学習時間 (累計上位)":
    "Study time by member (top contributors)",

  // === Phase 4h: workspace start / recruitment / domain / delete errors ===
  "作業内容を入力してください。": "Please enter what you're working on.",
  "Roomデータを読み込めませんでした。もう一度Roomを選択してください。":
    "Couldn't load the room data. Please select the room again.",
  "Roomデータを読み込めませんでした。": "Couldn't load the room data.",
  "入室する作業部屋を選択してください。": "Please select a workroom to enter.",
  "作業内容を入力してから募集してください。": "Please enter what you're working on before recruiting.",
  "メッセージは140字までです。": "Messages must be 140 characters or fewer.",
  "開始時刻を入力してください。": "Please enter a start time.",
  "開始時刻が正しくありません。": "The start time is invalid.",
  "開始時刻は今より後を指定してください。": "Please pick a start time after now.",
  "予約は24時間以内までです。": "Reservations are limited to 24 hours from now.",
  "保存に失敗しました。": "Save failed.",
  "確認のため、上のユーザーIDをそのまま入力してください。":
    "For confirmation, please retype your user ID exactly as shown above.",
  "削除に失敗しました。ネットワークまたは権限を確認のうえ、再度お試しください。":
    "Deletion failed. Check your network and permissions, then try again.",

  // === Phase 4i: workspace auto-leave / org / Slack meta / domain ===
  "在室時間が上限を超えていたため自動退室しました。今回は{time}（+{exp} EXP）として記録しています。":
    "You were auto-left because the session exceeded the limit. Recorded as {time} (+{exp} EXP).",
  "無操作が続いたため、最終操作までの{time}（+{exp} EXP）を記録しました。":
    "No activity for a while — recorded {time} up to the last action (+{exp} EXP).",
  "「{task}」を": "\"{task}\" — ",
  "{room} で{taskLabel}{time}積み上げました ✦ +{exp} EXP":
    "Worked {taskLabel}for {time} in {room} ✦ +{exp} EXP",
  "Lv {lv} · {days}日連続": "Lv {lv} · {days}-day streak",
  "組織を作成できませんでした。[{code}] {message}":
    "Couldn't create the organization. [{code}] {message}",
  "組織が見つかりませんでした。": "Organization not found.",
  "このドメインからの自動参加は許可されていません。": "Auto-join is not allowed from this domain.",
  "参加に失敗しました。再度お試しください。": "Couldn't join. Please try again.",
  "{n}件のドメインを保存しました。": "Saved {n} domain(s).",
  "ドメイン自動参加を解除しました。": "Domain auto-join disabled.",

  // === Phase 4j: Shop/IAP, workspace appearance, monument, Teams marketing/FAQ ===
  "{name} {romaji}（ショップで購入）": "{name} {romaji} (buy in shop)",
  "{name} {romaji}はショップで購入できます": "{name} {romaji} can be purchased in the shop",
  "{name} {romaji}を選択": "Select {name} {romaji}",
  "次に来た人へのひとこと（例：明日の朝、レビューお願いします）":
    "A note for whoever shows up next (e.g. \"Please review this tomorrow morning\")",
  "やめる": "Cancel",
  "残しています…": "Leaving it…",
  "置く": "Drop",
  "✉ 置き手紙を残す": "✉ Leave a note",
  "✉ 置き手紙": "✉ Note",
  "・24時間で消えます": " · disappears in 24 hours",
  "🏛️ 記念碑": "🏛️ Monument",
  "{time}開始予定": "Starts at {time}",
  "まずはRoomを作成しましょう。": "Let's start by creating a room.",
  "上の入力欄から、自分の集中場所を作成できます。": "Use the field above to create your own focus space.",
  "チームの学びと集中を、": "Your team's learning and focus,",
  "静かに可視化する。": "quietly made visible.",
  "通知も通話もない作業部屋に集まるだけ。学習時間と GitHub コミットが自動で積み上がり、チームが学びに投じた時間が静かに可視化されます。":
    "Just gather in a workroom with no notifications and no calls. Study time and GitHub commits accumulate automatically, quietly visualizing the time your team invests in learning.",
  "{name} のワークスペースを開く →": "Open {name}'s workspace →",
  "組織を作って始める →": "Create an organization to start →",
  "Google で 30 秒で始める →": "Start with Google in 30 seconds →",
  "導入相談（メール）": "Talk to us about adoption (email)",
  "導入相談(メール)": "Talk to us about adoption (email)",
  "クレジットカード不要・β 期間中は全機能無料": "No credit card required · All features free during beta",
  "通知ゼロ設計": "Zero-notification design",
  "GitHub 連携": "GitHub integration",
  "CSV エクスポート": "CSV export",
  "SSO / SCIM 対応予定": "SSO / SCIM coming soon",
  "Admin ダッシュボード": "Admin dashboard",
  "今月の累計学習": "Total study this month",
  "先月比 +18%": "+18% vs last month",
  "アクティブメンバー": "Active members",
  "継続率 92%": "92% retention",
  "今週のコミット": "Commits this week",
  "直近 7 日間": "Last 7 days",
  "※ 表示はイメージです。チームの学習時間・コミットを集計し、CSV で書き出せます。":
    "* Display is illustrative. Team study time and commits are aggregated and exportable as CSV.",
  "{name} の現在のプラン": "{name}'s current plan",
  "β 期間中はすべての機能を無料でお使いいただけます。": "All features are free during the beta.",
  "正式版の開始時にプランの選択・お支払いが有効になります。":
    "Plan selection and billing will activate at general availability.",
  "Team にアップグレード →": "Upgrade to Team →",
  "Enterprise を相談": "Discuss Enterprise",
  "請求・プランを管理 →": "Manage billing & plan →",
  "アップグレードの相談(メール)": "Talk to us about upgrading (email)",
  "組織限定の作業部屋": "Org-only workrooms",
  "社内・チーム内だけで共有できるルーム。他社や個人ユーザーからは見えず、招待リンクで仲間を招きます。":
    "Rooms shared only within your company or team. Invisible to other organizations and solo users; invite teammates via invite link.",
  "Slack に流れる気配": "Presence in Slack",
  "メンバーの入室・募集・日次サマリーを Slack チャンネルに自動投稿。リモート同士でも空気感が伝わります。":
    "Member joins, recruitments, and daily summaries auto-post to your Slack channel. The atmosphere comes through even when remote.",
  "投資の可視化": "Visualize your investment",
  "Admin ダッシュボードでチームの累計学習時間・ストリーク・コミット数を集計。CSV エクスポートで L&D レポートに直結。":
    "Aggregate your team's total study time, streaks, and commits in the admin dashboard. Export as CSV directly into L&D reports.",
  "最短 30 秒で、チームの可視化を始められる": "Start visualizing your team in as little as 30 seconds",
  "組織を作る": "Create an organization",
  "Google で 30 秒。クレジットカードは要りません。": "30 seconds with Google. No credit card required.",
  "招待リンクを配る": "Share the invite link",
  "リンクを共有するだけ。メンバーは作業部屋に入るだけで集計が始まります。":
    "Just share the link. Aggregation begins as soon as members enter a workroom.",
  "ダッシュボードで可視化": "Visualize in the dashboard",
  "学習時間・コミット・継続率を集計し、CSV で L&D レポートへ。":
    "Aggregate study time, commits, and retention; export as CSV into your L&D report.",
  "監視ではなく、投資の可視化に振り切る": "Visualize investment, not surveillance",
  "個別の学習ログ・投稿内容は admin にも表示しません。可視化されるのは「チームがどれだけ投資したか」だけ。マネージャー・現場の双方が安心して使える設計です。":
    "Individual study logs and post contents are hidden even from admins. Only \"how much the team invested\" is visualized — designed so both managers and the front line can use it with confidence.",
  "個別の作業内容・投稿本文は admin に非表示": "Individual work content and post bodies hidden from admins",
  "退出すると組織限定ルームは即時に見えなくなります": "Org-only rooms become invisible immediately on leaving",
  "データは Firestore に暗号化保存・退会時に削除可能":
    "Data is stored encrypted in Firestore; deletable on account closure",
  "労務管理を意識した長時間警告・休憩促し（順次対応）":
    "Long-session warnings and break prompts mindful of labor management (rolling out)",
  "プラン(β 期間中は全機能無料)": "Plans (all features free during beta)",
  "正式版リリース時に以下の構成で提供予定です。": "We plan to offer the following at general availability.",
  "※ 価格は予定です。β 期間中は全機能無料でお使いいただけます。":
    "* Prices are tentative. All features are free during the beta.",
  "導入前の、よくある質問": "Frequently asked questions before adoption",
  "個人の作業内容は管理者に見えますか？": "Can administrators see individuals' work?",
  "いいえ。個別の学習ログ・投稿本文は admin にも表示しません。可視化されるのは「チームがどれだけ学びに投資したか」だけです。":
    "No. Individual study logs and post bodies are hidden even from admins. Only \"how much the team invested in learning\" is visualized.",
  "データはどこに保存されますか？": "Where is data stored?",
  "Google Cloud(Firestore)に暗号化して保存します。退会時にはデータを削除できます。":
    "Stored encrypted in Google Cloud (Firestore). You can delete your data when you close the account.",
  "最低何人から使えますか？": "What is the minimum team size?",
  "1 人からお使いいただけます。Team プランは 5〜50 名のチームを想定しています。":
    "You can use it from 1 person. The Team plan is designed for teams of 5–50.",
  "解約はいつでもできますか？": "Can I cancel any time?",
  "はい。請求ポータルからいつでも解約でき、当月末までご利用いただけます。":
    "Yes. Cancel any time from the billing portal; access continues through the end of the current month.",
  "SSO / SCIM には対応していますか？": "Do you support SSO / SCIM?",
  "Enterprise プランで SAML / SSO・SCIM プロビジョニング・監査ログに対応します。導入相談からご連絡ください。":
    "The Enterprise plan supports SAML / SSO, SCIM provisioning, and audit logs. Please reach out via the adoption inquiry.",
  "チームの学びを、今日から可視化する。": "Start visualizing your team's learning today.",
  "β 期間中は全機能無料。まずは組織を作って、作業部屋を開いてみてください。":
    "All features are free during the beta. First create an organization and try opening a workroom.",
  "質問・導入相談は": "For questions or adoption inquiries,",
  "までお気軽にどうぞ。": "feel free to reach out.",
  "ホームに戻る": "Back to home",
  "キャラクターをカスタマイズ": "Customize your character",
  "シルエットや姿を変えて、自分だけの分身に。所持している Arc で購入できます。":
    "Change your silhouette and look to make your character your own. Purchase with the Arc you own.",
  "1 日 1 回投稿すると +50 Arc。累計 500 Arc までもらえます。":
    "Post once a day to earn +50 Arc. You can earn up to 500 Arc in total.",
  "上限に到達しました。ありがとうございます！": "You've hit the cap. Thank you!",
  "今日はまだ受け取っていません。投稿してみてください。": "You haven't received today's bonus yet. Try posting.",
  "日報を書くと毎日 +50 Arc。": "Write a daily report to earn +50 Arc every day.",
  "今日の分は受け取り済み。明日また記録してみてください。": "You've claimed today's reward. Try logging again tomorrow.",
  "今日はまだ受け取っていません。日報を記録してみてください。": "You haven't received it yet today. Try logging a report.",
  "分身の姿を変える": "Change your character's look",
  "所持済み": "Owned",
  "使用中": "Equipped",
  "着用する": "Equip",
  "{name} を {price} Arc で購入しますか？": "Buy {name} for {price} Arc?",
  "購入する": "Buy",
  "Arc 不足": "Not enough Arc",
  "Slackウェブフックが設定されていません": "Slack webhook is not configured",
  "Slack送信に失敗: {error}": "Failed to send to Slack: {error}",
  "アクセス権限がありません": "You don't have permission",
  "マネージャーダッシュボードはOrganizationのオーナーのみアクセス可能です":
    "The Manager dashboard is accessible only to the organization owner",
  "{name} に参加する": "Join {name}",
  "あなたのメールドメインが許可されています — タップで参加": "Your email domain is allowed — tap to join",
  "チーム / 企業で使う": "Use with your team / company",
  "組織限定ルーム・Admin ダッシュボード・Slack 連携": "Org-only rooms · Admin dashboard · Slack integration",
  "はじめる": "Get started",

  // === Phase 4k: post/save/search permission errors ===
  "ログをローカルに保存しました。クラウドへ再同期します。": "Saved log locally. We'll re-sync to the cloud.",
  "ログをクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。":
    "Cloud-save permission for logs isn't active yet. Saved locally for now.",
  "{room}で{building}を進めています。": "Working on {building} in {room}.",
  "ユーザー検索に失敗しました。": "User search failed.",
  "ユーザー検索の権限が有効になっていません。少し時間を置いて再度お試しください。":
    "User search permission isn't active yet. Please try again in a moment.",

  // === Phase 4l: Settings → Your data panel ===
  "あなたの学習ログ・投稿・組織メンバーシップなどを JSON で一括ダウンロードできます。アカウント削除は元に戻せません。":
    "Download your learning logs, posts, and organization memberships as a single JSON file. Account deletion cannot be undone.",
  "エクスポート中…": "Exporting…",

  // === Phase 4m: Goal picker — EN free-text mode ===
  "あなたの目標": "Your goal",
  "例: 第一志望合格 / 資格取得 / アプリ開発":
    "e.g. Get into MIT / Pass CFA L1 / Build a SaaS",
  "同じ目標を持つ人があなたを見つけられます。":
    "Others working toward the same goal can find you.",

  // === Phase 12: 振り返り 3 セクション + auto-draft ===
  "今日のハイライト": "Highlight",
  "つまずき": "Stuck on",
  "明日の最初の一歩": "Tomorrow's first step",
  "いちばん進んだこと・気づき": "What moved the most, what you noticed",
  "詰まったところ・分からなかったところ": "What got stuck, what you didn't get",
  "明日まず手をつけること": "What to pick up first tomorrow",
  "今日のログから下書きを挿入": "Insert draft from today's log",
  "今日の学習ログがまだ無いので下書きを作れません。":
    "No study log for today yet — can't generate a draft.",
  "{subject} {time}": "{subject} {time}",
  "{summary} (合計 {total})": "{summary} ({total} total)",
  "日報を更新": "Update daily report",
  "日報を保存": "Save daily report",
  "詳細を開く": "Open details",
  "もっと見る ({count} 件)": "Show more ({count})",
  "この日報を削除": "Delete this entry",

  // === Phase 12: Library status labels rename ===
  "学習中": "Learning",
  "達成済み": "Mastered",
  "休止中": "Paused",
  "休止を解除": "Resume",
  "休止する": "Pause",
  "達成済み{count}": "{count} mastered",
  "休止中{count}": "{count} paused",

  // === Phase 12: daily history empty state ===
  "上の入力欄から「今日やること」と「振り返り」を書くと、ここに記録が並んでいきます。":
    "Write your today's tasks and reflection in the form above — your records will start appearing here.",

  // === Phase 13: Poker double-up ===
  "受け取る +{n}": "Collect +{n}",
  "2× DOUBLE UP": "2× DOUBLE UP",
  "Higher or Lower?": "Higher or Lower?",
  "次の札が dealer ({rank}) より高い / 低い を選ぶ。tie = 負け":
    "Guess if the next card is higher or lower than the dealer's ({rank}). Tie loses.",
  "Lower": "Lower",
  "Higher": "Higher",
  "DOUBLED! → {n} chip": "DOUBLED! → {n} chip",
  "負け。失効。": "Lost. Forfeited.",
  "{n} 連続成功 → 受け取る or もう一度倍にする":
    "{n} in a row — collect, or push for another double",
  "受け取る or 2倍に挑戦": "Collect, or push for 2×",
  "サウンドをオン": "Sound on",
  "サウンドをオフ": "Sound off",

  // === Phase 13b: 自分タブ再設計 ===
  "今、取り組んでいること": "What you're working on",
  "例: 認可ロジックの設計": "e.g. Designing the auth flow",
  "「{task}」を記録に追加": "Add \"{task}\" to your library",
  "ポモドーロ": "Pomodoro",
  "{n}周目": "Round {n}",
  "集中フェーズ": "Focus phase",
  "休息フェーズ": "Rest phase",
  "一時停止": "Pause",
  "開始": "Start",
  "リセット": "Reset",
  "仲間を募集": "Gather others",
  "今やってることに共感する人を呼ぶ": "Invite anyone working on the same thing",
  "同じ作業に共感する人を呼ぶ": "Invite anyone into the same work",
  "入室": "Joined",
  "新しい部屋名を入力": "Enter a new room name",
  "部屋名を変更": "Rename room",
  "{n}時間で消えます": "Disappears in {n}h",
  "学習を記録": "Log study",
  "投稿の詳細を見る": "Open post details",
  "まだ返信はありません。": "No replies yet.",
  "コメントを入力": "Write a comment",
};
