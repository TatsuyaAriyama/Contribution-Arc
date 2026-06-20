import {
  Fragment,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  getRedirectResult,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  endAt,
  where,
} from "firebase/firestore";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { auth, db, githubProvider, googleProvider } from "./firebase";
import {
  acceptOrganizationInvite,
  backfillStudyLogOrganizationId,
  createOrganization,
  createOrganizationInvite,
  fetchOrganizationStudyLogs,
  leaveOrganization,
  listAuditLogs,
  listMemberStudyLogs,
  listOrganizationMembers,
  listUsersByGoal,
  type GoalMatchUser,
  loadOrganization,
  migrateStudyLogsToCloud,
  recordAuditLog,
  saveGithubActivitySummary,
  saveStudyLogToCloud,
  deleteStudyLogFromCloud,
  saveUserProgressToCloud,
  saveUserGoalToCloud,
  grantCoinsFloorToCloud,
  saveWorkspaceSessionToCloud,
  subscribeStudyLogsFromCloud,
  transferOrganizationOwnership,
  updateOrganizationSlack,
  updateOrganizationDomains,
  findOrganizationsByEmailDomain,
  joinOrganizationByDomain,
  removeOrganizationMember,
  setMemberTeamName,
  exportUserData,
  deleteUserAccount,
  fetchAuthorAppearances,
  type AuthorAppearance,
  type AuditLogRecord,
  type OrganizationMemberRecord,
  type OrganizationRecord,
} from "./services/cloudData";
import {
  buildBreakStartedBlocks,
  buildDailyDigestBlocks,
  buildPostBlocks,
  buildRecruitmentBlocks,
  buildRoomJoinBlocks,
  buildRoomLeaveBlocks,
  isValidSlackWebhookUrl,
  postToSlackWebhook,
} from "./services/slack";
import { buildWeeklyDigestPayload } from "./services/teamDigest";
import {
  deleteLearningItemFromCloud,
  fetchLearningItemsFromCloud,
  saveLearningItemToCloud,
} from "./services/learningItems";
import {
  cancelRecruitmentInCloud,
  createRecruitmentInCloud,
  joinRecruitmentInCloud,
  subscribeActiveRecruitmentsFromCloud,
  type WorkspaceRecruitmentRecord,
} from "./services/workspaceRecruitments";
import {
  createWorkspaceInvite,
  respondToWorkspaceInvite,
  subscribeIncomingWorkspaceInvites,
  type WorkspaceInviteRecord,
} from "./services/workspaceInvites";
import {
  WorkspaceRecruitmentFeedCard,
  type RecruitmentAuthor,
} from "./components/feed/WorkspaceRecruitmentFeedCard";
import {
  fetchRepliesForPosts,
  savePostToCloud,
  savePostReplyToCloud,
  subscribePostsFromCloud,
  togglePostLikeInCloud,
  type ContributionPostRecord,
  type ContributionReplyRecord,
} from "./services/posts";
import {
  deletePersistentItem,
  putPersistentItem,
  putPersistentItems,
  readPersistentItems,
} from "./services/persistentCache";
import {
  fetchGithubContributions,
  GithubRateLimitError,
  type GithubContributions,
} from "./services/githubContributions";
import { computeStudyStreak } from "./services/studyStreak";
import { PLANS, getPlanLocalized, BETA_ALL_FEATURES_FREE, type PlanTier } from "./services/plans";
import {
  clampNumber,
  formatDailyDate,
  formatLearningLastLogged,
  formatStayTime,
  formatStudyTimeJa,
  getCurrentWeekKey,
  getLearnerDate,
  getTodayKey,
  getWeekStart,
} from "./utils/format";
import {
  createCheckoutSession,
  createPortalSession,
  isBillingConfigured,
} from "./services/billing";
import { type AppView, type FriendPreview } from "./components/PremiumNavigation";
import {
  SilentWorkspaceRoom,
  type FloorNoteMarker,
  type MonumentMarker,
} from "./components/SilentWorkspaceRoom";
import {
  subscribeFloorNotes,
  saveFloorNote,
  deleteFloorNote,
  type FloorNoteRecord,
} from "./services/floorNotes";
import {
  subscribeRoomChat,
  sendRoomChatMessage,
  containsBlockedWord,
  isRoomChatMessageExpired,
  type RoomChatMessage,
} from "./services/roomChat";
import { ArcPurchasePanel } from "./components/ArcPurchasePanel";
import { ManagerDashboard } from "./components/ManagerDashboard";

/* iOS App Store 提出版では Apple 以外のデジタル商品決済 (Stripe で
   Arc コインを売る等) は guideline 3.1.1 で即リジェクトされる。
   ビルド時に VITE_PLATFORM=ios を立てると Arc 購入パネル / Shop へ
   の動線をすべて非表示にする (Web / Android は従来通り表示)。
   将来 StoreKit / RevenueCat 実装を入れた時にここを外す。 */
const IS_IOS_BUILD = import.meta.env.VITE_PLATFORM === "ios";
import { ShareToXModal } from "./components/ShareToXModal";
import { TutorialHint } from "./components/TutorialHint";
import { BarcodeScannerModal } from "./components/BarcodeScannerModal";
import { LearningRecordModal } from "./components/LearningRecordModal";
import streakFlameIcon from "./assets/streak-flame.png";
import { ToastHost } from "./components/ToastHost";
import { PullToRefresh } from "./components/PullToRefresh";
import { InstallInstructionsModal } from "./components/InstallInstructionsModal";
import { IOSInstallHint } from "./components/IOSInstallHint";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import {
  DailyMentionTextarea,
  type MentionCandidate,
} from "./components/DailyMentionTextarea";
import {
  extractMentionsFromFields,
  renderTextWithMentions,
} from "./services/dailyMentions";
import {
  DailyPlanChecklist,
  PlanChecklistPreview,
} from "./components/DailyPlanChecklist";
import {
  derivePlanText,
  getCarriedOverItems,
  makePlanItem,
  normalizePlanItems,
  type PlanItem,
  planItemsFromLegacyText,
  planItemsToMentionScannable,
} from "./services/dailyPlanItems";
import {
  createDailyReportImageBlob,
  dailyShareFilename,
} from "./daily/shareCard";
import { resetAllTutorials } from "./services/tutorial";
import { showToast } from "./services/toast";
import { useTranslation, hasExplicitStoredLanguage } from "./i18n/LanguageContext";
import { CharCountRing } from "./components/CharCountRing";
import { ContributionArcLogo } from "./components/ContributionArcLogo";
import { GoalPickerModal } from "./components/GoalPickerModal";
import { findGoalById } from "./data/goalCatalog";
import {
  renderAngelSvg,
  renderDefaultCharacterSvg,
  renderOwlSvg,
  renderRoboSvg,
} from "./components/CharacterShapeSvg";
import { SettingsIcon } from "./components/icons/SettingsIcon";
import { BellIcon } from "./components/icons/BellIcon";
import { GitHubCallbackPage } from "./views/GitHubCallbackPage";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type Language,
} from "./i18n/translations";
import "./App.css";

// ポーカー（Jacks or Better）は開くまでロードしない（バンドル分割）。
const PokerView = lazy(() => import("./poker/PokerView"));

declare global {
  interface Window {
    contributionArcDesktop?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
      versions: {
        electron?: string;
        chrome?: string;
      };
      onOpenSettings?: (callback: () => void) => () => void;
      notify?: (payload: { title: string; body: string }) => Promise<boolean>;
      iap?: {
        canMakePayments: () => Promise<boolean>;
        getProducts: (productIds: string[]) => Promise<
          Array<{
            productIdentifier: string;
            localizedTitle: string;
            localizedDescription: string;
            formattedPrice: string;
            price: number;
            currencyCode: string | null;
          }>
        >;
        purchase: (productId: string) => Promise<{
          ok: boolean;
          reason: string | null;
        }>;
        finalize: (transactionDate: string) => Promise<boolean>;
        onTransaction: (
          callback: (payload: {
            kind: "completed" | "failed";
            productId: string | null;
            transactionIdentifier?: string | null;
            transactionDate?: string | null;
            receiptBase64?: string | null;
            errorMessage?: string;
          }) => void,
        ) => () => void;
      };
    };
  }
}



type StudyLog = {
  id: string;
  subject: string;
  minutes: number;
  createdAt: string;
  color?: string;
  learningItemId?: string;
  /* 学習量(ページ/問題/章など) + 単位、要点メモ、画像(dataURL)。
     ライブラリの「記録の入力」フォームで残せる任意項目。 */
  amount?: number;
  amountUnit?: string;
  note?: string;
  photo?: string;
};

type LearningCategory = "book" | "stack";

// Lifecycle status, independent of `archived` (which means "retired from
// the active list"). Defaults to "active" for items saved before this
// field existed — see readStatus in learningItems.ts.
type LearningStatus = "active" | "done" | "paused";

type LearningItem = {
  id: string;
  userId: string;
  name: string;
  category: LearningCategory;
  color: string;
  totalPages?: number;
  currentPages?: number;
  note?: string;
  /** 表紙/アイコン写真 (data URL, 144px JPEG ~10-25KB)。 */
  photo?: string;
  status: LearningStatus;
  archived: boolean;
  /** 手動並べ替え順 (小さいほど上)。未設定なら createdAt fallback。 */
  order?: number;
  createdAt: string;
  updatedAt: string;
};

type TitleRank = {
  name: string;
  condition: string;
  unlocked: boolean;
};

type WeeklyStudyDay = {
  day: string;
  hours: number;
  totalMinutes: number;
  dateLabel: string;
  /** その日の正午 (Local) を ISO 化したもの。詳細パネルから新規ログを
   *  追加する際にこのタイムスタンプを使うと、その日の枠内に確実に入る。 */
  dateIso: string;
  isToday: boolean;
  logs: StudyLog[];
};


type AuthErrorDetail = {
  title: string;
  message: string;
  action?: string;
  code?: string;
};

type UserProfile = {
  uid: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  photoURL: string;
  searchName: string;
  following: string[];
  followers: string[];
  determination?: string;
  /** 目標 (志望校 or 資格)。data/goalCatalog の id を保存。 */
  goalId?: string;
  /** 互換用: 一覧に無い自由記述目標を保存する場合に使う。 */
  goalCustomName?: string;
  characterColor?: string;
  /* Visual silhouette of the user's actor sprite. Optional for
     backward compatibility — undefined means the original
     "body + 2 legs" shape. */
  characterShape?: CharacterShape;
  /* Character silhouettes the user owns. Defaults to ["default"]
     for new accounts; ghost/owl are unlocked via the in-app shop. */
  ownedCharacterShapes?: CharacterShape[];
  /* In-app currency balance. Spent in the shop to unlock character
     shapes; future revisions allow purchasing coins with real money. */
  coins?: number;
  /* B2B organization membership. `organizationId` is the only field
     the security rules care about — the name/role fields are
     denormalized snapshots used for navigation chrome so we don't have
     to re-fetch the org doc on every render. `organizationRole`
     defaults to "member" for invitees; "owner" is set on the user that
     created the org. */
  organizationId?: string;
  organizationName?: string;
  organizationRole?: OrganizationRole;
  /* Last YYYY-MM-DD (local timezone) on which the user earned the
     daily "post to feed" Arc bonus. Used to gate the reward so the
     50-Arc payout fires exactly once per calendar day. */
  lastFeedRewardDate?: string;
  /* Total Arc the user has ever earned through the daily feed-post
     bonus. Once this hits the lifetime cap (500) the daily reward
     stops paying out. Independent of the actual coin balance — the
     user can spend Arc and the cap still applies. */
  feedRewardArcEarned?: number;
  /* 日報報酬：今日やること + 振り返り の両方を当日中に書き切ったら 50 Arc。
     最後に受領した YYYY-MM-DD を持ち、PC ↔ モバイル間で同日に二重受領
     しないようにする。キャップは設けず、毎日継続するインセンティブにする。 */
  lastDailyReportRewardDate?: string;
  /* Poker chips — kept separate from Arc so casino swings can't
     destabilise the spend-side economy. */
  pokerChips?: number;
  focusChips?: number;
  focusChipsDate?: string;
  focusStayMinutesSnapshot?: number;
  level?: number;
  effortExp?: number;
  outputExp?: number;
  currentTitle?: string;
  currentCharacter?: string;
  streak?: number;
  unlockedCharacters?: string[];
  characterExp?: number;
  openedWorkspaceGiftLevels?: number[];
  githubId?: string;
  githubUsername?: string;
  contributionCount?: number;
  lastSyncedAt?: string;
  /* Minutes studied during the user's current week (Sunday-start, matching
     the contribution-arc grid). Paired with weekKey so the weekly
     leaderboard can treat values left over from a previous week as zero. */
  weekMinutes?: number;
  /* Identifies which week weekMinutes belongs to — the YYYY-M-D of that
     week's Sunday. When it doesn't match the current week, weekMinutes is
     stale and counts as zero on the leaderboard. */
  weekKey?: string;
  /* 月曜始まりの曜日別学習分数 (7 要素, 月→日)。プロフィールで「今週
     どれだけ学習したか」を棒グラフで見せるために保存する。weekKey が
     現在の週と一致しないときは stale なので 0 扱い。 */
  weekdayMinutes?: number[];
  /* Preferred UI language. Defaults to "ja" when missing for
     backward compatibility with pre-i18n accounts. */
  language?: Language;
  /* デバイス間でユーザー設定を引き継ぐためのフラグ群。いずれも
     localStorage の per-uid キーから昇格させた cross-device 同期版。
     - onboardingCompletedAt: ISO 文字列。null/未設定なら未完了扱い。
       新規デバイスでログインした時にチュートリアルを再開させない判断材料。
     - pinnedFriendUids / mutedFriendUids / blockedFriendUids: それぞれ
       友達ピン・ミュート・ブロックの uid 配列。ブロックは特に "片方の
       デバイスだけで効く" のは安全機能としてダメなので必ず同期する。 */
  onboardingCompletedAt?: string;
  pinnedFriendUids?: string[];
  mutedFriendUids?: string[];
  blockedFriendUids?: string[];
};

type FriendRequestStatus = "pending" | "accepted" | "rejected";
type FriendRequestDirection = "incoming" | "outgoing";

type FriendRequest = {
  id: string;
  profile: UserProfile;
  status: FriendRequestStatus;
  direction: FriendRequestDirection;
  createdAt: string;
  acceptedAt?: string;
};

type CharacterOption = {
  id: string;
  name: string;
  englishName: string;
  label: string;
  concept: string;
  evolution: string;
};

type RoomUserStatus = "working" | "deep-work" | "on-break";

/* Sprite silhouette. Defaults to the original humanoid shape;
   "ghost" is the floating soul shape (body only, wavy hem,
   gentle vertical bob); "owl" is the night-owl companion
   (round head with ear tufts, big amber eyes, beak; ground-hops
   instead of walks; ambient ~270° head turn). New shapes can be
   added here. */
type CharacterShape = "default" | "ghost" | "owl" | "robo" | "angel";

type RoomUser = {
  id: string;
  name: string;
  avatar?: string;
  characterColor?: string;
  characterShape?: CharacterShape;
  x: number;
  y: number;
  currentTask: string;
  status: RoomUserStatus;
  joinedAt: string;
  activeStartedAt?: string;
  accumulatedActiveMinutes?: number;
  breakStartedAt?: string;
  /* Preset/chat bubble that floats above the avatar. Written through
     the same room-sync path as the rest of the member fields, so other
     clients in the same room see it appear and disappear in real time.
     `bubbleAt` is an ISO timestamp; remote viewers ignore bubbles older
     than ~4s as a safety net for orphaned writes. */
  bubble?: string;
  bubbleAt?: string;
};

type WorkspaceMember = RoomUser & {
  userId: string;
  building: string;
  color: string;
  tone: "deep" | "green" | "soft" | "blue";
};

/* Single entry in the workspace chat log surfaced alongside the
   immersive stage. The log is purely a derived client-side cache of
   the bubble field already synced through the room document — it
   doesn't introduce a new Firestore collection. */
type PresetLogEntry = {
  id: string;
  userId: string;
  name: string;
  message: string;
  color?: string;
  at: number;
};

type WorkspaceSession = {
  roomId: string;
  userId: string;
  task: string;
  joinedAt: string;
  leftAt: string;
  durationMinutes: number;
  earnedExp: number;
};

type WorkspaceSessionHistory = WorkspaceSession & {
  id: string;
  userName: string;
  roomName: string;
  building: string;
  color: string;
  minutes: number;
  exp: number;
};

type WorkspaceRoom = {
  id: string;
  name: string;
  ownerName?: string;
  ownerAvatar?: string;
  totalMinutes: number;
  contributions: number;
  commits: number;
  createdAt: string;
  createdBy: string;
  activeMembers: WorkspaceMember[];
  history: WorkspaceSessionHistory[];
  /* Visibility gating. "public" rooms are visible to every signed-in
     user — the existing behavior, and the implicit default for legacy
     documents that pre-date the org tenant. "org" rooms only appear
     in the workspace list for members of `ownerOrgId`. The Firestore
     read rule still permits any signed-in user to fetch the document,
     so this is a client-side privacy gate, not a hard access control;
     stronger gating will require a Cloud Function or a per-org
     members-list rule in a later phase. */
  visibility?: "public" | "org";
  ownerOrgId?: string;
};

/* Organization (tenant). Created by an owner; members join via an
   invite link. Rooms tagged `visibility: "org"` only surface in the
   workspace list for that org's members. Slack integration (Phase
   3) is gated on the URL + per-event toggles below. */
type Organization = {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  /** 契約プラン。サーバ(Stripe webhook)管理・クライアントは read-only。
   *  未設定は free 扱い。詳細は src/services/plans.ts。 */
  planTier?: PlanTier;
  slackWebhookUrl?: string;
  slackEvents?: {
    roomJoins?: boolean;
    roomLeaves?: boolean;
    breakStarted?: boolean;
    recruitments?: boolean;
    posts?: boolean;
    dailyDigest?: boolean;
  };
  autoJoinDomains?: string[];
};

type OrganizationRole = "owner" | "admin" | "member";


type OnboardingStep = "idle" | "language" | "welcome" | "settings" | "firstPost" | "firstDailyPlan";

function getSafeLanguage(value: unknown): Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as string[]).includes(value)
    ? (value as Language)
    : "ja";
}

type RoomCreateState = "idle" | "saving" | "saved" | "offline";

type NotificationItem = {
  id: string;
  type: "dailyLog" | "post" | "friendRequest" | "reply" | "workspaceInvite" | "like";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  sourceUserId: string;
};

type DesktopNotificationSettings = {
  dailyLog: boolean;
  post: boolean;
  reply: boolean;
  friendRequest: boolean;
  sound: boolean;
  soundVolume: number;
};

type DailyReport = {
  id: string;
  userId: string;
  userName?: string;
  characterColor?: string;
  // Snapshot of the author's equipped silhouette at save time; falls
  // back to "default" for reports written before this field existed.
  characterShape?: string;
  currentTitle?: string;
  date: string;
  plan: string;
  reflection: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: "synced" | "pending";
  syncError?: string;
  /* Phase 10a: 下書きフラグ. True when the report is "saved for me only"
     — it lives in localStorage + IndexedDB but never reaches Firestore,
     and is hidden from the Team Daily feed. Flipping it false on a
     subsequent save publishes the report to the cloud. */
  isDraft?: boolean;
  /* Phase 10a: denormalized list of userIds mentioned in plan or
     reflection. Computed at save time from `@<userId>` tokens so a
     future "you were mentioned" inbox can query without re-parsing. */
  mentions?: string[];
  /* Phase 10b: plan-as-checklist. Optional — reports written before
     this version keep `plan: string` only, and the editor lazily lifts
     legacy text into items on open. When present, `plan` is derived
     from `planItems` at save time and serves as the canonical preview
     / search field for legacy clients. */
  planItems?: PlanItem[];
};

type KnowledgeNode = {
  id: string;
  title: string;
  minutes: number;
  size: number;
  x: number;
  y: number;
  cluster?: string;
};

type KnowledgeLink = {
  source: string;
  target: string;
};

type KnowledgeGraphData = {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
};


const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];

// Unified motion language — used by all framer-motion components so the app
// has one coherent physical feel rather than a mix of eased curves.
const SPRING_SOFT = { type: "spring", stiffness: 280, damping: 28, mass: 0.7 } as const;
const SPRING_SNAPPY = { type: "spring", stiffness: 380, damping: 30, mass: 0.6 } as const;

const studyColorOptions = [
  { name: "Evergreen", labelJa: "緑", value: "#1f6f4a" },
  { name: "Sage", labelJa: "若草", value: "#7aa874" },
  { name: "Jade", labelJa: "翡翠", value: "#2f8f83" },
  { name: "Sea", labelJa: "青緑", value: "#2f7890" },
  { name: "Azure", labelJa: "空", value: "#4f7fb2" },
  { name: "Indigo", labelJa: "藍", value: "#5b68a6" },
  { name: "Lavender", labelJa: "藤", value: "#8b72b6" },
  { name: "Plum", labelJa: "梅", value: "#9b4f83" },
  { name: "Rose", labelJa: "薔薇", value: "#bf5f78" },
  { name: "Clay", labelJa: "土", value: "#b87555" },
  { name: "Amber", labelJa: "琥珀", value: "#c8a95b" },
  { name: "Moss", labelJa: "苔", value: "#6f8f45" },
];



/* Character silhouette options offered in the profile editor.
   Order is intentional — "default" stays first so it's the
   visual fallback for legacy users. Adding a new shape here also
   requires:
   - extending the CharacterShape type
   - adding the shape to CHARACTER_SHAPES (the runtime allow-list)
   - implementing `.actor-sprite.shape-<value>` styles in App.css */
// Character silhouettes. Named with a single evocative kanji + a romaji
// reading (shown as "宵 Yoi") so they fit the quiet "積み上げる" world
// instead of reading like dictionary labels (the old 人型 / ゴースト /
// フクロウ broke immersion):
//   灯 Tomo — 灯。そばに灯る、はじまりの相棒（the blocky origin builder;
//             Tomo doubles as 友 = friend）
//   朧 Oboro — 朧。おぼろげに漂う、もう一人のあなた（the floating soul）
//   宵 Yoi   — 宵。夜更けを見守る、夜型のお供（the nocturnal owl）
const characterShapeOptions: {
  value: CharacterShape;
  name: string;
  romaji: string;
  tagline: string;
  /* One-line poetic intro shown beside the large preview when this
     shape is selected. Longer / more evocative than `tagline`. */
  intro: string;
}[] = [
  {
    value: "default",
    name: "灯",
    romaji: "Tomo",
    tagline: "そばに灯る相棒",
    intro: "暗がりにそっと灯る、はじまりの相棒。",
  },
  {
    value: "ghost",
    name: "朧",
    romaji: "Oboro",
    tagline: "ふわりと漂う魂",
    intro: "輪郭をほどいて漂う、もう一人のあなた。",
  },
  {
    value: "owl",
    name: "宵",
    romaji: "Yoi",
    tagline: "夜更けの番人",
    intro: "夜更けをひとり見守る、静かな番人。",
  },
  {
    value: "robo",
    name: "煌",
    romaji: "Kō",
    tagline: "ネオンを灯す機械仕掛け",
    intro: "深夜のスポットライトに胸の M を灯す、機械仕掛けの相棒。",
  },
  {
    value: "angel",
    name: "環",
    romaji: "Tamaki",
    tagline: "輪をいただく金色の使い",
    intro: "頭上にそっと輪を浮かべて佇む、金色の使い。",
  },
];

// Shop catalog. "default" is intentionally not listed — every account
// owns it from signup. Prices are in coins; coins are seeded for the
// admin account and (eventually) purchasable with real money.
type ShapeShopItem = {
  shape: Exclude<CharacterShape, "default">;
  name: string;
  tagline: string;
  description: string;
  price: number;
};

const shapeShopCatalog: ShapeShopItem[] = [
  {
    shape: "ghost",
    name: "朧 Oboro",
    tagline: "ふわりと漂う魂",
    description: "脚のない魂のシルエット。作業部屋の片隅でふわりと漂う、もう一人のあなた。",
    price: 1000,
  },
  {
    shape: "owl",
    name: "宵 Yoi",
    tagline: "夜更けの番人",
    description: "丸い頭に大きな琥珀の眼。深夜にひとり手を動かす時間のお供に。",
    price: 500,
  },
  {
    shape: "angel",
    name: "環 Tamaki",
    tagline: "輪をいただく金色の使い",
    description: "頭上に淡い輪を浮かべた金色のキューブ。穏やかな顔のスクリーンが、静かな時間に寄り添う。",
    price: 800,
  },
  {
    shape: "robo",
    name: "煌 Kō",
    tagline: "ネオンを灯す機械仕掛け",
    description: "胸にネオンの M を灯したナイトロボ。アンテナと黄金縁のエンブレムが、夜の作業を引き締める。",
    price: 1500,
  },
];

// IAP の Arc パック。Product ID は App Store Connect 側と
// functions/src/arcPacks.ts と完全一致させる必要がある。
type ArcPack = {
  productId: string;
  arcAmount: number;
  fallbackPrice: string;
  badge: string | null;
};

const ARC_PACK_CATALOG: ArcPack[] = [
  {
    productId: "com.ariyamatatsuya.contributionarc.arc_pack_small",
    arcAmount: 100,
    fallbackPrice: "¥160",
    badge: null,
  },
  {
    productId: "com.ariyamatatsuya.contributionarc.arc_pack_medium",
    arcAmount: 600,
    fallbackPrice: "¥860",
    badge: "10%お得",
  },
  {
    productId: "com.ariyamatatsuya.contributionarc.arc_pack_large",
    arcAmount: 1500,
    fallbackPrice: "¥1,800",
    badge: "20%お得",
  },
  {
    productId: "com.ariyamatatsuya.contributionarc.arc_pack_xlarge",
    arcAmount: 4000,
    fallbackPrice: "¥4,400",
    badge: "30%お得",
  },
];

const characterColorOptions = [
  { name: "常磐", value: "#1f6f4a" },
  { name: "深緑", value: "#176345" },
  { name: "青磁", value: "#2f8f83" },
  { name: "縹", value: "#3f6f9f" },
  { name: "紺", value: "#20334a" },
  { name: "鈍色", value: "#475569" },
  { name: "菫", value: "#7667a8" },
  { name: "梅紫", value: "#7c3f6f" },
  { name: "薔薇", value: "#b05268" },
  { name: "琥珀", value: "#c8a95b" },
  { name: "苔色", value: "#6f8f3f" },
  { name: "煉瓦", value: "#9c5a4a" },
  { name: "胡桃", value: "#8a6a4f" },
  { name: "枯草", value: "#a8986a" },
  { name: "若竹", value: "#4f977a" },
  { name: "藍鼠", value: "#5f6f7f" },
  { name: "鴇鼠", value: "#a88088" },
  { name: "利休鼠", value: "#6e7b6e" },
  { name: "藤鼠", value: "#8a82a8" },
  { name: "墨", value: "#111827" },
];

const defaultStudyLogs: StudyLog[] = [];

const outputStats = {
  commits: 0,
  contributions: 0,
  pullRequests: 0,
};

const workspaceRooms: WorkspaceRoom[] = [];

/**
 * 運営からのお知らせ（ホーム上部に表示）。
 *
 * 設計: Firestore ではなくコードに直書きで管理する。お知らせは運営
 * （= 開発者本人）が書くものなので、更新時はこの配列を編集して
 * デプロイすれば反映される。新規 Firestore 読み取りを増やさない
 * ための意図的な選択（MEMORY の Firestore コスト規律に沿う）。
 *
 * 表示順は配列の上から。新しいお知らせほど上に追加する。
 * date は表示用文字列（"YYYY.MM.DD" など自由）。
 */
type Announcement = {
  id: string;
  date: string;
  title: string;
  body: string;
  /* 常にホーム先頭に固定表示するウェルカム告知。1 件だけ true に
     する想定。pinned 以外の中で最新 1 件をその下に出し、残りは
     「お知らせ一覧」モーダルから辿る (ホームを煩雑にしない方針)。 */
  pinned?: boolean;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "2026-06-11-library-photos",
    date: "2026.06.11",
    title: "ライブラリに写真アイコン機能を追加しました",
    body:
      "ライブラリの学習対象ごとに、写真を自由に設定できるようになりました。\n" +
      "教材の表紙や好きな写真をアイコンにすると、ライブラリが自分だけの本棚のように見やすく整理できます。\n" +
      "\n" +
      "使い方:\n" +
      "1. ライブラリで学習対象を開き、編集画面の「写真 (任意)」から「写真を追加」をタップ\n" +
      "2. カメラまたはアルバムから写真を選択\n" +
      "3. 保存すると、ライブラリの一覧でその写真がアイコンとして表示されます\n" +
      "\n" +
      "写真はいつでも変更・削除できます。ぜひお気に入りの教材を登録してみてください。",
  },
  {
    id: "2026-06-01-welcome",
    date: "2026.06.01",
    title: "Contribution Arc をご利用いただきありがとうございます",
    body:
      "いつもご利用いただきありがとうございます。\n" +
      "現在も、サービスをより良い形でユーザーのみなさまにご利用いただけるよう、日々改善に励んでおります。\n" +
      "不具合のご報告や、追加してほしい機能などがございましたら、こちらの要望欄にご記載いただけますと幸いです。\n" +
      "いただいたご意見は、今後の開発の参考にさせていただきます。\n" +
      "引き続きよろしくお願いいたします。",
    pinned: true,
  },
];
/* ホーム先頭固定の pinned 告知 (ウェルカム)。最大 1 件。 */
const PINNED_ANNOUNCEMENT = ANNOUNCEMENTS.find((item) => item.pinned) || null;
/* pinned 以外の告知 (= 通常の更新履歴)。配列の上ほど新しい前提。 */
const NON_PINNED_ANNOUNCEMENTS = ANNOUNCEMENTS.filter((item) => !item.pinned);
/* ホームにはこの最新 1 件だけ出す。残りは一覧モーダルへ。 */
const LATEST_ANNOUNCEMENT = NON_PINNED_ANNOUNCEMENTS[0] || null;
/* 新ホーム (feed) 最上部のコンパクト告知バナーに出す 1 件。配列の
   先頭 = 最新の告知。タップで一覧モーダルを開く。 */
const HEADLINE_ANNOUNCEMENT = ANNOUNCEMENTS[0] || null;
const sanitizeStoragePart = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
const getAccountStorageScope = (uid: string, registeredUserId: string) =>
  sanitizeStoragePart(registeredUserId) || `uid-${uid}`;
const getAccountStorageKey = (scope: string, key: string) => `contribution-arc-${scope}-${key}`;
const sharedWorkspaceRoomsStorageKey = "contribution-arc-shared-workspace-rooms-cache";
const workspaceRoomsCollectionName = "rooms";
const legacyWorkspaceRoomsCollectionName = "workspaceRooms";
const betaWorkspaceRoomId = "beta-room";
const legacyDeepWorkStudioRoomId = "deep-work-studio";
const minaUserId = "npc-mina";
const nishimiyaUserId = "npc-nishimiya";
// 退出忘れ対策の在室上限。入室からこの分数（＝20時間）が経過したユーザーは
// 自動退室させる。タブ非表示中も「裏で作業中」とみなして退室はさせないので、
// この上限だけがゴースト在室（退室し忘れた在席）の歯止めになる。
const maxWorkspacePresenceMinutes = 20 * 60;
const workspacePresenceResetVersion = "2026-05-20-clear-stuck-presence";
const workspaceMovementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);
const defaultWorkspacePresetMessages = [
  "進捗どうですか？",
  "おつかれさまです",
  "集中します",
  "休憩します",
  "一緒にやろう",
  "今日はReactやります",
];
const defaultDesktopNotificationSettings: DesktopNotificationSettings = {
  dailyLog: true,
  post: true,
  reply: true,
  friendRequest: true,
  sound: true,
  soundVolume: 0.35,
};
const notificationCooldownMs = 90 * 1000;
const notificationSoundCooldownMs = 12 * 1000;
const notificationSoundSources = {
  default: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  dailyLog: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  post: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  reply: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  friendRequest: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  workspaceInvite: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
  like: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
} as const;
const workspaceActorSlots = [
  { x: 28, y: 54 },
  { x: 40, y: 52 },
  { x: 55, y: 50 },
  { x: 68, y: 54 },
  { x: 78, y: 64 },
  { x: 63, y: 69 },
  { x: 48, y: 72 },
  { x: 32, y: 70 },
  { x: 20, y: 63 },
  { x: 84, y: 48 },
  { x: 73, y: 39 },
  { x: 59, y: 36 },
  { x: 43, y: 37 },
  { x: 27, y: 40 },
  { x: 16, y: 78 },
  { x: 30, y: 82 },
  { x: 45, y: 84 },
  { x: 60, y: 83 },
  { x: 75, y: 80 },
  { x: 88, y: 73 },
];
const emptyKnowledgeGraph: KnowledgeGraphData = { nodes: [], links: [] };
const knowledgeClusterAnchors: Record<string, { x: number; y: number }> = {
  frontend: { x: 322, y: 198 },
  backend: { x: 456, y: 198 },
  platform: { x: 410, y: 304 },
  language: { x: 270, y: 320 },
  product: { x: 520, y: 312 },
};
const defaultKnowledgeNodes: Array<Omit<KnowledgeNode, "minutes" | "size"> & { weight: number }> = [
  { id: "React", title: "React", cluster: "frontend", x: 310, y: 190, weight: 6 },
  { id: "useState", title: "useState", cluster: "frontend", x: 250, y: 158, weight: 2 },
  { id: "Hooks", title: "Hooks", cluster: "frontend", x: 265, y: 218, weight: 3 },
  { id: "Component", title: "Component", cluster: "frontend", x: 338, y: 142, weight: 3 },
  { id: "UI", title: "UI", cluster: "frontend", x: 365, y: 222, weight: 4 },
  { id: "State", title: "State", cluster: "frontend", x: 318, y: 258, weight: 3 },
  { id: "TypeScript", title: "TypeScript", cluster: "language", x: 244, y: 305, weight: 5 },
  { id: "JavaScript", title: "JavaScript", cluster: "language", x: 195, y: 260, weight: 4 },
  { id: "Java", title: "Java", cluster: "language", x: 192, y: 356, weight: 4 },
  { id: "Generics", title: "Generics", cluster: "language", x: 286, y: 362, weight: 2 },
  { id: "API", title: "API", cluster: "backend", x: 455, y: 198, weight: 5 },
  { id: "Firebase", title: "Firebase", cluster: "backend", x: 512, y: 156, weight: 5 },
  { id: "Firestore", title: "Firestore", cluster: "backend", x: 562, y: 210, weight: 3 },
  { id: "Authentication", title: "Authentication", cluster: "backend", x: 492, y: 252, weight: 3 },
  { id: "Security", title: "Security", cluster: "backend", x: 420, y: 142, weight: 3 },
  { id: "Cloud Functions", title: "Cloud Functions", cluster: "backend", x: 586, y: 146, weight: 2 },
  { id: "GitHub", title: "GitHub", cluster: "platform", x: 395, y: 302, weight: 5 },
  { id: "Contribution", title: "Contribution", cluster: "platform", x: 438, y: 358, weight: 4 },
  { id: "Pull Request", title: "Pull Request", cluster: "platform", x: 356, y: 370, weight: 3 },
  { id: "CI/CD", title: "CI/CD", cluster: "platform", x: 480, y: 318, weight: 3 },
  { id: "Docker", title: "Docker", cluster: "platform", x: 420, y: 408, weight: 3 },
  { id: "Linux", title: "Linux", cluster: "platform", x: 520, y: 398, weight: 2 },
  { id: "Learning Log", title: "Learning Log", cluster: "platform", x: 322, y: 426, weight: 3 },
  { id: "Architecture", title: "Architecture", cluster: "product", x: 574, y: 306, weight: 4 },
  { id: "Database", title: "Database", cluster: "product", x: 632, y: 262, weight: 3 },
  { id: "Performance", title: "Performance", cluster: "product", x: 626, y: 358, weight: 3 },
  { id: "Accessibility", title: "Accessibility", cluster: "product", x: 542, y: 364, weight: 2 },
  { id: "Testing", title: "Testing", cluster: "product", x: 552, y: 254, weight: 3 },
  { id: "Design System", title: "Design System", cluster: "frontend", x: 388, y: 280, weight: 3 },
];
const defaultKnowledgeLinks: KnowledgeLink[] = [
  { source: "React", target: "Hooks" },
  { source: "React", target: "Component" },
  { source: "React", target: "UI" },
  { source: "React", target: "State" },
  { source: "Hooks", target: "useState" },
  { source: "Hooks", target: "State" },
  { source: "TypeScript", target: "React" },
  { source: "TypeScript", target: "Generics" },
  { source: "JavaScript", target: "TypeScript" },
  { source: "Java", target: "Generics" },
  { source: "UI", target: "Design System" },
  { source: "UI", target: "Accessibility" },
  { source: "Design System", target: "Component" },
  { source: "API", target: "Firebase" },
  { source: "API", target: "Authentication" },
  { source: "API", target: "Security" },
  { source: "Firebase", target: "Firestore" },
  { source: "Firebase", target: "Cloud Functions" },
  { source: "Firestore", target: "Database" },
  { source: "Authentication", target: "Security" },
  { source: "GitHub", target: "Contribution" },
  { source: "GitHub", target: "Pull Request" },
  { source: "GitHub", target: "CI/CD" },
  { source: "CI/CD", target: "Docker" },
  { source: "Docker", target: "Linux" },
  { source: "Architecture", target: "API" },
  { source: "Architecture", target: "Database" },
  { source: "Architecture", target: "Performance" },
  { source: "Testing", target: "CI/CD" },
  { source: "Testing", target: "React" },
  { source: "Contribution", target: "Learning Log" },
];

const characterOptions: CharacterOption[] = [
  {
    id: "simple",
    name: "アバター",
    englishName: "Avatar",
    label: "初期解放キャラクター",
    concept: "角丸ボディに小さな足。学習の積み重ねを静かに見守る、シンプルな相棒。",
    evolution: "",
  },
];

const githubCallbackPath = "/auth/github/callback";


function withKnowledgeLayout(
  data: Omit<KnowledgeGraphData, "nodes"> & {
    nodes: Array<Partial<Pick<KnowledgeNode, "x" | "y">> & Omit<KnowledgeNode, "x" | "y">>;
  },
): KnowledgeGraphData {
  const clusterCounts = new Map<string, number>();
  const fallbackCenter = { x: 380, y: 252 };

  return {
    links: data.links,
    nodes: data.nodes.map((node, index) => {
      if (typeof node.x === "number" && typeof node.y === "number") {
        return { ...node, x: node.x, y: node.y };
      }

      const cluster = node.cluster || "product";
      const clusterIndex = clusterCounts.get(cluster) || 0;
      clusterCounts.set(cluster, clusterIndex + 1);
      const anchor = knowledgeClusterAnchors[cluster] || fallbackCenter;
      const angle = clusterIndex * 1.45 + (index % 2) * 0.42 - Math.PI / 2;
      const radius = 28 + Math.floor(clusterIndex / 2) * 28 + (clusterIndex % 2) * 18;
      return {
        ...node,
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
      };
    }),
  };
}


function buildStudyKnowledgeGraph(logs: StudyLog[]): KnowledgeGraphData {
  const grouped = new Map<string, number>();
  logs.forEach((log) => {
    const subject = log.subject.trim();
    if (!subject) {
      return;
    }
    grouped.set(subject, (grouped.get(subject) || 0) + log.minutes);
  });

  const nodes = defaultKnowledgeNodes.map((node) => {
    const learnedMinutes = grouped.get(node.id) || 0;
    return {
      id: node.id,
      title: node.title,
      cluster: node.cluster,
      minutes: learnedMinutes,
      size: Math.min(30, 9 + node.weight * 2.1 + Math.sqrt(learnedMinutes) * 0.5),
      x: node.x,
      y: node.y,
    };
  });

  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const extraNodes = [...grouped.entries()]
    .filter(([subject]) => !knownNodeIds.has(subject))
    .map(([subject, minutes], index) => {
      const angle = index * 1.2 - Math.PI / 3;
      const radius = 56 + (index % 4) * 18;
      return {
        id: subject,
        title: subject,
        cluster: "product",
        minutes,
        size: Math.min(28, 11 + Math.sqrt(minutes) * 0.62),
        x: knowledgeClusterAnchors.product.x + Math.cos(angle) * radius,
        y: knowledgeClusterAnchors.product.y + Math.sin(angle) * radius,
      };
    });

  const extraLinks = extraNodes.map((node) => ({
    source: "Learning Log",
    target: node.id,
  }));

  return withKnowledgeLayout({
    nodes: [...nodes, ...extraNodes],
    links: [...defaultKnowledgeLinks, ...extraLinks],
  });
}

function getWeeklyStudyHours(logs: StudyLog[]): WeeklyStudyDay[] {
  const weekStart = getWeekStart();
  const todayKey = getTodayKey();
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(weekStart.getDate() + 7);

  return dayLabels.map((day, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dayLogs = logs.filter((log) => {
      const createdAt = new Date(log.createdAt);
      return createdAt >= date && createdAt < new Date(date.getTime() + 24 * 60 * 60 * 1000);
    });
    const totalMinutes = dayLogs.reduce((sum, log) => sum + log.minutes, 0);
    /* 正午 ISO: 新規ログ追加時にこのタイムスタンプを使うと、ローカル
       タイムゾーンの境界 (00:00 / 23:59) で誤って前後の日に飛ばない。 */
    const noon = new Date(date);
    noon.setHours(12, 0, 0, 0);

    return {
      day,
      hours: totalMinutes / 60,
      totalMinutes,
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      dateIso: noon.toISOString(),
      isToday: getTodayKey(date) === todayKey,
      logs: dayLogs,
    };
  }).filter((item) => {
    const itemDate = new Date(weekStart);
    itemDate.setDate(weekStart.getDate() + dayLabels.indexOf(item.day));
    return itemDate < nextWeek;
  });
}

type ContributionArcDay = {
  date: Date;
  key: string;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
};

type ContributionArcWeek = {
  monthLabel: string | null;
  days: (ContributionArcDay | null)[];
};

function getContributionArcLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

const CONTRIBUTION_ARC_WEEKS = 13;

function getContributionArc(logs: StudyLog[]): {
  weeks: ContributionArcWeek[];
  totalMinutes: number;
  activeDays: number;
  weekMinutes: number[];
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  longestStreak: number;
  topMonthLabel: string | null;
  topMonthMinutes: number;
} {
  const WEEKS = CONTRIBUTION_ARC_WEEKS;
  const minutesByDay = new Map<string, number>();
  for (const log of logs) {
    const d = new Date(log.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + log.minutes);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWeekday = today.getDay();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const startOffset = (WEEKS - 1) * 7 + todayWeekday;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - startOffset);

  let totalMinutes = 0;
  let activeDays = 0;
  let lastMonthShown = -1;
  const weeks: ContributionArcWeek[] = [];
  const weekMinutes: number[] = [];
  const monthTotals = new Map<string, { label: string; minutes: number }>();

  let currentStreak = 0;
  let longestStreak = 0;

  for (let w = 0; w < WEEKS; w++) {
    const days: (ContributionArcDay | null)[] = [];
    let weekTotal = 0;
    let monthLabel: string | null = null;
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w * 7 + d);
      if (cellDate > today) {
        days.push(null);
        continue;
      }
      const key = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
      const minutes = minutesByDay.get(key) || 0;
      if (minutes > 0) {
        totalMinutes += minutes;
        activeDays += 1;
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
      weekTotal += minutes;
      const monthKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}`;
      const monthEntry = monthTotals.get(monthKey) || {
        label: `${cellDate.getMonth() + 1}月`,
        minutes: 0,
      };
      monthEntry.minutes += minutes;
      monthTotals.set(monthKey, monthEntry);
      days.push({
        date: cellDate,
        key,
        minutes,
        level: getContributionArcLevel(minutes),
        isToday: key === todayKey,
      });
    }
    weekMinutes.push(weekTotal);
    const firstCell = days.find((cell) => cell !== null) as ContributionArcDay | undefined;
    if (firstCell && firstCell.date.getMonth() !== lastMonthShown && firstCell.date.getDate() <= 7) {
      monthLabel = `${firstCell.date.getMonth() + 1}月`;
      lastMonthShown = firstCell.date.getMonth();
    }
    weeks.push({ monthLabel, days });
  }

  const thisWeekMinutes = weekMinutes[weekMinutes.length - 1] || 0;
  const lastWeekMinutes = weekMinutes[weekMinutes.length - 2] || 0;

  let topMonthLabel: string | null = null;
  let topMonthMinutes = 0;
  for (const entry of monthTotals.values()) {
    if (entry.minutes > topMonthMinutes) {
      topMonthMinutes = entry.minutes;
      topMonthLabel = entry.label;
    }
  }

  return {
    weeks,
    totalMinutes,
    activeDays,
    weekMinutes,
    thisWeekMinutes,
    lastWeekMinutes,
    longestStreak,
    topMonthLabel,
    topMonthMinutes,
  };
}

/**
 * GitHub-equivalent of getContributionArc — same 13-week, today-anchored
 * grid so the heatmap renders identically to the study one. Takes the raw
 * day list from the jogruber endpoint and projects it onto the same date
 * scaffold the study heatmap already walks.
 */
type GithubArcDay = {
  date: Date;
  key: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
};
type GithubArcWeek = { monthLabel: string | null; days: (GithubArcDay | null)[] };

function getGithubContributionArc(days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[]): {
  weeks: GithubArcWeek[];
  total: number;
  activeDays: number;
  thisWeekCount: number;
  lastWeekCount: number;
  longestStreak: number;
} {
  const WEEKS = CONTRIBUTION_ARC_WEEKS;
  // The endpoint uses ISO "YYYY-MM-DD" keys, but our grid walks with
  // (year, month, day) integers — normalize the lookup map to the same
  // composite key the grid uses so lookups are O(1).
  const byKey = new Map<string, { count: number; level: 0 | 1 | 2 | 3 | 4 }>();
  for (const d of days) {
    const [y, m, dd] = d.date.split("-").map((n) => Number(n));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(dd)) continue;
    byKey.set(`${y}-${m - 1}-${dd}`, { count: d.count, level: d.level });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWeekday = today.getDay();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const startOffset = (WEEKS - 1) * 7 + todayWeekday;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - startOffset);

  let total = 0;
  let activeDays = 0;
  let lastMonthShown = -1;
  let currentStreak = 0;
  let longestStreak = 0;
  const weeks: GithubArcWeek[] = [];
  const weekCounts: number[] = [];

  for (let w = 0; w < WEEKS; w++) {
    const cells: (GithubArcDay | null)[] = [];
    let weekTotal = 0;
    let monthLabel: string | null = null;
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w * 7 + d);
      if (cellDate > today) {
        cells.push(null);
        continue;
      }
      const key = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
      const hit = byKey.get(key);
      const count = hit?.count || 0;
      const level = hit?.level ?? 0;
      if (count > 0) {
        total += count;
        activeDays += 1;
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
      weekTotal += count;
      cells.push({ date: cellDate, key, count, level, isToday: key === todayKey });
    }
    weekCounts.push(weekTotal);
    const firstCell = cells.find((c) => c !== null) as GithubArcDay | undefined;
    if (firstCell && firstCell.date.getMonth() !== lastMonthShown && firstCell.date.getDate() <= 7) {
      monthLabel = `${firstCell.date.getMonth() + 1}月`;
      lastMonthShown = firstCell.date.getMonth();
    }
    weeks.push({ monthLabel, days: cells });
  }

  return {
    weeks,
    total,
    activeDays,
    thisWeekCount: weekCounts[weekCounts.length - 1] || 0,
    lastWeekCount: weekCounts[weekCounts.length - 2] || 0,
    longestStreak,
  };
}

function getEffortExp(logs: StudyLog[]) {
  const studyMinutes = logs.reduce((sum, log) => sum + log.minutes, 0);
  const activeDays = new Set(logs.map((log) => new Date(log.createdAt).toDateString())).size;
  return Math.round((studyMinutes / 60) * 80 + activeDays * 20);
}

function getStudyStreak(logs: StudyLog[]) {
  const studiedDays = new Set(
    logs.map((log) => {
      const date = new Date(log.createdAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }),
  );
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  while (studiedDays.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/* 連続日報ストリーク。"date" フィールド (YYYY-MM-DD) ベースで今日から
   遡って連続している日数を数える。drafts でも reports に含まれていれば
   counter に入れる (=「書いた事実」を評価)。空 (plan も reflection も
   空) のものは含めない。 */
function getDailyReportStreak(reports: DailyReport[]) {
  const writtenDates = new Set(
    reports
      .filter(
        (report) =>
          (report.planItems && report.planItems.length > 0) ||
          (report.plan && report.plan.trim().length > 0) ||
          (report.reflection && report.reflection.trim().length > 0),
      )
      .map((report) => report.date),
  );
  let cursor = new Date();
  let streak = 0;
  while (true) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    if (!writtenDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getOutputExp() {
  return outputStats.commits * 90 + outputStats.contributions * 24 + outputStats.pullRequests * 160;
}

function removeSeedStudyLogs(logs: StudyLog[]) {
  return logs.filter((log) => !log.id.startsWith("seed-"));
}

function validateUserId(value: string, t: (k: string) => string) {
  if (!value) {
    return t("ユーザーIDを入力してください。");
  }

  if (value.length > 30) {
    return t("ユーザーIDは30文字以内にしてください。");
  }

  if (!/^[a-z0-9._]+$/.test(value)) {
    return t("使用できる文字は小文字の半角英数字、_、. のみです。");
  }

  if (value.startsWith(".") || value.endsWith(".")) {
    return t("ピリオドは先頭と末尾には使えません。");
  }

  if (value.includes("..")) {
    return t("ピリオドは連続して使えません。");
  }

  return "";
}

function normalizeUserProfile(uid: string, data: Partial<UserProfile>): UserProfile {
  return {
    uid,
    userId: data.userId || "",
    displayName: data.displayName || "Developer",
    avatarUrl: data.avatarUrl || "",
    photoURL: data.photoURL || data.avatarUrl || "",
    searchName: data.searchName || (data.displayName || "Developer").toLowerCase(),
    following: Array.isArray(data.following) ? data.following : [],
    followers: Array.isArray(data.followers) ? data.followers : [],
    determination: data.determination || "",
    goalId: typeof data.goalId === "string" ? data.goalId : "",
    goalCustomName: typeof data.goalCustomName === "string" ? data.goalCustomName : "",
    characterColor: getSafeCharacterColor(data.characterColor),
    characterShape: getSafeCharacterShape(data.characterShape),
    ownedCharacterShapes: Array.isArray(data.ownedCharacterShapes)
      ? (data.ownedCharacterShapes
          /* 後方互換: 旧シルエット "frost" を所持していたユーザーは
             "morph" を所持していた扱いに置き換える (霜 → 相 への置換)。
             これがないと旧 frost ユーザーは無料で morph を着用できず、
             かつ「変えても戻る」体感の一因にもなる。 */
          .map((shape) => getSafeCharacterShape(shape))
          .filter((shape, index, arr) => arr.indexOf(shape) === index) as CharacterShape[])
      : ["default"],
    coins: typeof data.coins === "number" && Number.isFinite(data.coins) ? Math.max(0, Math.floor(data.coins)) : 0,
    lastFeedRewardDate: typeof data.lastFeedRewardDate === "string" ? data.lastFeedRewardDate : "",
    feedRewardArcEarned:
      typeof data.feedRewardArcEarned === "number" && Number.isFinite(data.feedRewardArcEarned)
        ? Math.max(0, Math.floor(data.feedRewardArcEarned))
        : 0,
    lastDailyReportRewardDate:
      typeof data.lastDailyReportRewardDate === "string" ? data.lastDailyReportRewardDate : "",
    pokerChips:
      typeof data.pokerChips === "number" && Number.isFinite(data.pokerChips)
        ? Math.max(0, Math.floor(data.pokerChips))
        : 0,
    focusChips:
      typeof data.focusChips === "number" && Number.isFinite(data.focusChips)
        ? Math.max(0, Math.floor(data.focusChips))
        : 0,
    focusChipsDate: typeof data.focusChipsDate === "string" ? data.focusChipsDate : "",
    focusStayMinutesSnapshot:
      typeof data.focusStayMinutesSnapshot === "number" && Number.isFinite(data.focusStayMinutesSnapshot)
        ? Math.max(0, Math.floor(data.focusStayMinutesSnapshot))
        : 0,
    organizationId: typeof data.organizationId === "string" && data.organizationId ? data.organizationId : undefined,
    organizationName: typeof data.organizationName === "string" ? data.organizationName : undefined,
    organizationRole:
      data.organizationRole === "owner" || data.organizationRole === "admin" || data.organizationRole === "member"
        ? data.organizationRole
        : undefined,
    level: data.level || 1,
    effortExp: data.effortExp || 0,
    outputExp: data.outputExp || 0,
    currentTitle: data.currentTitle || "",
    currentCharacter: data.currentCharacter || characterOptions[0].id,
    streak: data.streak || 0,
    unlockedCharacters: Array.isArray(data.unlockedCharacters) ? data.unlockedCharacters : [characterOptions[0].id],
    characterExp: data.characterExp || 0,
    openedWorkspaceGiftLevels: Array.isArray(data.openedWorkspaceGiftLevels)
      ? data.openedWorkspaceGiftLevels
          .map((level) => Number(level))
          .filter((level) => Number.isFinite(level) && level > 0)
      : [],
    githubId: data.githubId || "",
    githubUsername: data.githubUsername || "",
    contributionCount: data.contributionCount || 0,
    lastSyncedAt: data.lastSyncedAt || "",
    weekMinutes:
      typeof data.weekMinutes === "number" && Number.isFinite(data.weekMinutes)
        ? Math.max(0, Math.floor(data.weekMinutes))
        : 0,
    weekKey: typeof data.weekKey === "string" ? data.weekKey : "",
    weekdayMinutes:
      Array.isArray(data.weekdayMinutes) && data.weekdayMinutes.length === 7
        ? data.weekdayMinutes.map((m) =>
            typeof m === "number" && Number.isFinite(m) ? Math.max(0, Math.floor(m)) : 0,
          )
        : undefined,
    language: getSafeLanguage(data.language),
    /* cross-device 同期版フィールド。未設定は undefined / 空配列で
       後方互換を保つ。文字列で来た場合や配列以外は黙って弾いて
       既存ユーザーが壊れないように。 */
    onboardingCompletedAt:
      typeof data.onboardingCompletedAt === "string" && data.onboardingCompletedAt
        ? data.onboardingCompletedAt
        : undefined,
    pinnedFriendUids: Array.isArray(data.pinnedFriendUids)
      ? data.pinnedFriendUids.filter((value): value is string => typeof value === "string")
      : undefined,
    mutedFriendUids: Array.isArray(data.mutedFriendUids)
      ? data.mutedFriendUids.filter((value): value is string => typeof value === "string")
      : undefined,
    blockedFriendUids: Array.isArray(data.blockedFriendUids)
      ? data.blockedFriendUids.filter((value): value is string => typeof value === "string")
      : undefined,
  };
}

function getSafeCharacterColor(color: string | undefined): string {
  return color && characterColorOptions.some((option) => option.value === color)
    ? color
    : characterColorOptions[0].value;
}

/* Allow-list guard for character shape. Anything outside the known
   set (including legacy `undefined` from older profile docs) falls
   back to "default" — the original humanoid silhouette. */
const CHARACTER_SHAPES: readonly CharacterShape[] = [
  "default",
  "ghost",
  "owl",
  "robo",
  "angel",
];
function getSafeCharacterShape(shape: unknown): CharacterShape {
  if (typeof shape !== "string") return "default";
  /* 後方互換: 旧シルエット "frost" / "morph" は廃止 ─ どちらも
     default に戻す。既存ユーザーで morph を装備中だった場合は
     起動時に自動で default に切替わる。 */
  if (shape === "frost" || shape === "morph") return "default";
  return (CHARACTER_SHAPES as readonly string[]).includes(shape)
    ? (shape as CharacterShape)
    : "default";
}

function getFriendGithubUrl(userId: string) {
  return userId && !userId.startsWith("npc-") ? `https://github.com/${userId}` : "";
}

function profileToFriend(profile: UserProfile, t: (k: string) => string): FriendPreview {
  return {
    uid: profile.uid,
    userId: profile.userId,
    name: profile.displayName,
    avatar: profile.photoURL,
    status: "offline",
    activity: profile.determination || t("オフライン"),
    githubUrl: getFriendGithubUrl(profile.userId),
    githubUsername: profile.githubUsername || "",
  };
}

function getFriendRequestDocId(fromUid: string, toUid: string) {
  return `${fromUid}_${toUid}`;
}

function createWorkspaceRoomId() {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `custom-${randomId}`;
}

function getCurrentProfile(
  user: User,
  displayName: string,
  currentUserId: string,
  avatar: string,
  currentDetermination = "",
  currentCharacterColor = characterColorOptions[0].value,
): UserProfile {
  const nextName = displayName.trim() || user.displayName || user.email?.split("@")[0] || "Developer";

  return normalizeUserProfile(user.uid, {
    userId: currentUserId,
    displayName: nextName,
    photoURL: avatar || user.photoURL || "",
    determination: currentDetermination,
    characterColor: getSafeCharacterColor(currentCharacterColor),
  });
}

function getFriendRequestsStorageKey(scope: string) {
  return getAccountStorageKey(scope, "friend-requests");
}

function readStoredFriendRequests(scope: string) {
  try {
    const savedRequests = window.localStorage.getItem(getFriendRequestsStorageKey(scope));
    return savedRequests ? (JSON.parse(savedRequests) as FriendRequest[]) : [];
  } catch {
    return [];
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (key === sharedWorkspaceRoomsStorageKey) {
      try {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.info("Shared workspace cache write skipped.", retryError);
      }
    }

    console.info("Local storage write skipped.", { key, error });
    return false;
  }
}

function getSerializableAvatar(avatar: string | undefined) {
  if (!avatar || avatar.startsWith("data:")) {
    return "";
  }

  return avatar;
}

function upsertStoredFriendRequest(scope: string, nextRequest: FriendRequest) {
  try {
    const requests = readStoredFriendRequests(scope);
    const nextRequests = [
      nextRequest,
      ...requests.filter(
        (request) =>
          !(request.id === nextRequest.id && (request.direction || "outgoing") === nextRequest.direction),
      ),
    ];

    safeSetLocalStorage(getFriendRequestsStorageKey(scope), JSON.stringify(nextRequests));
  } catch {
    // Local mirror is a convenience for same-browser account switching.
  }
}

function removeStoredFriendRequest(scope: string, requestId: string) {
  try {
    const requests = readStoredFriendRequests(scope);
    const nextRequests = requests.filter((request) => request.id !== requestId);
    safeSetLocalStorage(getFriendRequestsStorageKey(scope), JSON.stringify(nextRequests));
  } catch {
    /* localStorage 不可なら無視。クラウド側が真実。 */
  }
}

function workspaceMemberToProfile(
  member: WorkspaceMember,
  t: (k: string, vars?: Record<string, string | number>) => string,
): UserProfile {
  return {
    uid: member.userId,
    userId: member.userId.startsWith("npc-") ? member.name.toLowerCase() : member.userId,
    displayName: member.name,
    photoURL: member.avatar || "",
    searchName: member.name.toLowerCase(),
    following: [],
    followers: [],
    determination:
      member.status === "on-break"
        ? t("少し休憩中です。")
        : t("{building}を積み上げています。", { building: member.building }),
    characterColor: getSafeCharacterColor(member.characterColor || member.color),
    characterShape: member.characterShape,
  };
}

function profileResolveText(profile: UserProfile, t: (k: string) => string) {
  return profile.determination?.trim() || t("静かに積み上げています。");
}

function formatPostTime(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return "";
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdTime) / 60000));
  if (diffMinutes < 1) {
    return "now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffMinutes < 60 * 24) {
    return `${Math.floor(diffMinutes / 60)}h`;
  }

  return new Date(createdAt).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

// 返信のタイムスタンプ。直近(24時間以内)は「N分前 / N時間前」で相対表示し、
// 1日以上経過したものは日時(M/D HH:mm)を出して「いつ返信されたか」が
// 一目で分かるようにする。小さく添えるバイライン用途。
function formatReplyTime(createdAt: string, t: (k: string, vars?: Record<string, string | number>) => string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return "";
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdTime) / 60000));
  if (diffMinutes < 1) {
    return t("たった今");
  }
  if (diffMinutes < 60) {
    return t("{minutes}分前", { minutes: diffMinutes });
  }
  if (diffMinutes < 60 * 24) {
    return t("{hours}時間前", { hours: Math.floor(diffMinutes / 60) });
  }

  return new Date(createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}



// LIVE ACTIVITY only surfaces study sessions of at least this many minutes.
// Sub-5-minute pings would crowd the timeline with low-signal noise — they're
// still persisted to Firestore, just hidden from the public ticker. Bump this
// up if the feed still feels too chatty.
const LIVE_ACTIVITY_MIN_MINUTES = 5;



function getDailyDateAgeInDays(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  // Use the 6 AM-shifted "learner today" so a 2 AM session still edits yesterday's report.
  const today = new Date(`${getLearnerDate()}T00:00:00`);
  parsedDate.setHours(0, 0, 0, 0);

  return Math.round((today.getTime() - parsedDate.getTime()) / 86400000);
}

function canEditDailyReportDate(date: string) {
  const ageInDays = getDailyDateAgeInDays(date);
  return ageInDays >= 0 && ageInDays <= 1;
}

/* Phase 12: 振り返り (reflection) を 3 セクション構造に分割する。
 *
 *   ### highlight     ← 今日のハイライト
 *   本文…
 *
 *   ### stuck         ← つまずき
 *   本文…
 *
 *   ### tomorrow      ← 明日の最初の一歩
 *   本文…
 *
 * データ層は引き続き reflection: string の単一カラム。マーカーは
 * 言語非依存 (lowercase ASCII) にして round-trip を安定させる。
 * マーカーが無い既存レポートは highlight に全文を入れる。
 */
const REFLECTION_SECTION_KEYS = ["highlight", "stuck", "tomorrow"] as const;
type ReflectionSectionKey = (typeof REFLECTION_SECTION_KEYS)[number];
type ReflectionParts = Record<ReflectionSectionKey, string>;
const REFLECTION_SECTION_LINE = /^###\s+(highlight|stuck|tomorrow)\s*$/i;

function makeEmptyReflectionParts(): ReflectionParts {
  return { highlight: "", stuck: "", tomorrow: "" };
}

function parseReflectionParts(raw: string): ReflectionParts {
  const parts = makeEmptyReflectionParts();
  if (!raw) return parts;
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let firstMarker = -1;
  for (let i = 0; i < lines.length; i++) {
    if (REFLECTION_SECTION_LINE.test(lines[i])) {
      firstMarker = i;
      break;
    }
  }
  if (firstMarker === -1) {
    parts.highlight = raw.trim();
    return parts;
  }
  if (firstMarker > 0) {
    const preamble = lines.slice(0, firstMarker).join("\n").trim();
    if (preamble) parts.highlight = preamble;
  }
  const buf: Record<ReflectionSectionKey, string[]> = {
    highlight: [],
    stuck: [],
    tomorrow: [],
  };
  let current: ReflectionSectionKey = "highlight";
  for (let i = firstMarker; i < lines.length; i++) {
    const m = REFLECTION_SECTION_LINE.exec(lines[i]);
    if (m) {
      current = m[1].toLowerCase() as ReflectionSectionKey;
      continue;
    }
    buf[current].push(lines[i]);
  }
  for (const key of REFLECTION_SECTION_KEYS) {
    const joined = buf[key].join("\n").replace(/^\n+|\n+$/g, "");
    if (!joined) continue;
    if (key === "highlight" && parts.highlight) {
      parts.highlight = `${parts.highlight}\n${joined}`.trim();
    } else {
      parts[key] = joined;
    }
  }
  return parts;
}

function serializeReflectionParts(parts: ReflectionParts): string {
  const segments: string[] = [];
  for (const key of REFLECTION_SECTION_KEYS) {
    const v = parts[key].trim();
    if (v) segments.push(`### ${key}\n${v}`);
  }
  return segments.join("\n\n");
}

/* Notification / preview 系で reflection を 1 行に圧縮するときに使う。
 * 構造化されていれば一番上のセクション本文だけ、なければ全体を返す。 */
function extractReflectionPreview(text: string): string {
  if (!text) return "";
  const parts = parseReflectionParts(text);
  return (parts.highlight || parts.stuck || parts.tomorrow || text).trim();
}

/* 振り返り 3 セクションのアイコン。Unicode glyph (✦ / ⌖ / →) は
 * iOS / Android / Web でレンダリングが揺れる + 小さい円の中で潰れる
 * ので、解像度に依らず崩れない line-art SVG に差し替える。
 * stroke="currentColor" にして親 (.reflection-icon) の color で着色。 */
function ReflectionSectionIcon({ section }: { section: ReflectionSectionKey }) {
  if (section === "highlight") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        {/* lightbulb — 気づき / アハ */}
        <path
          d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.6-1 2.5v.5H9v-.5c0-.9-.3-1.8-1-2.5A6 6 0 0 1 12 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (section === "stuck") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        {/* warning triangle — つまずき */}
        <path
          d="M12 3l10 18H2L12 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M12 10v5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      {/* forward arrow — 明日の最初の一歩 / next */}
      <path
        d="M5 12h14M13 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* 振り返りをモーダル / 詳細セクションでレンダリングするヘルパー。
 * 構造化マーカー (### highlight 等) があればセクション見出し付きの
 * カード型レイアウトに、無ければ単一の段落にフォールバックする。
 * 既存の reflection を上書きしないので、旧データはそのまま自然に表示。 */
function renderReflectionBody(
  text: string,
  opts: {
    t: (key: string, vars?: Record<string, string | number>) => string;
    lookup?: (userId: string) => string | undefined;
    onClickMention?: (userId: string) => void;
    keyPrefix: string;
  },
): ReactNode {
  if (!text || !text.trim()) return null;
  const hasMarker = REFLECTION_SECTION_LINE.test(text) || /### (highlight|stuck|tomorrow)/i.test(text);
  if (!hasMarker) {
    return (
      <p>
        {renderTextWithMentions(text, {
          lookup: opts.lookup,
          onClickMention: opts.onClickMention,
          keyPrefix: opts.keyPrefix,
        })}
      </p>
    );
  }
  const parts = parseReflectionParts(text);
  const labelOf = (key: ReflectionSectionKey) =>
    key === "highlight"
      ? opts.t("今日のハイライト")
      : key === "stuck"
        ? opts.t("つまずき")
        : opts.t("明日の最初の一歩");
  const nonEmpty = REFLECTION_SECTION_KEYS.filter((key) => parts[key].trim());
  if (nonEmpty.length === 0) return null;
  return (
    <div className="reflection-structured">
      {nonEmpty.map((key) => (
        <div
          key={key}
          className="reflection-structured-section"
          data-section={key}
        >
          <div className="reflection-structured-label">
            <span className="reflection-structured-icon" aria-hidden="true">
              <ReflectionSectionIcon section={key} />
            </span>
            <span className="reflection-structured-name">{labelOf(key)}</span>
          </div>
          <p>
            {renderTextWithMentions(parts[key], {
              lookup: opts.lookup,
              onClickMention: opts.onClickMention,
              keyPrefix: `${opts.keyPrefix}-${key}`,
            })}
          </p>
        </div>
      ))}
    </div>
  );
}

/* "今日のログから下書きを挿入" 用のサマリ。selectedDailyDate と同じ
 * 学習日に属する studyLogs を subject 別に集計し、1 行の自然文に整形。
 * ログが無ければ空文字を返し、呼び出し側でトーストを出す。 */
function summarizeStudyLogsForDate(
  logs: StudyLog[],
  date: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language,
): string {
  const todays = logs.filter((log) => {
    if (!log.createdAt) return false;
    const parsed = new Date(log.createdAt);
    if (Number.isNaN(parsed.getTime())) return false;
    return getLearnerDate(parsed) === date;
  });
  if (todays.length === 0) return "";
  const bySubject = new Map<string, number>();
  let totalMinutes = 0;
  for (const log of todays) {
    const subject = (log.subject || "").trim() || t("学習");
    bySubject.set(subject, (bySubject.get(subject) || 0) + log.minutes);
    totalMinutes += log.minutes;
  }
  const sorted = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const segments = sorted.map(([subject, minutes]) =>
    t("{subject} {time}", { subject, time: formatStayTime(minutes, language) }),
  );
  const joiner = language === "en" ? ", " : "、";
  return t("{summary} (合計 {total})", {
    summary: segments.join(joiner),
    total: formatStayTime(totalMinutes, language),
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}

function normalizeDailyReport(data: Partial<DailyReport>, fallbackUserId: string): DailyReport {
  const date = typeof data.date === "string" && data.date ? data.date : getLearnerDate();
  return {
    id: typeof data.id === "string" && data.id ? data.id : `${fallbackUserId}_${date}`,
    userId: typeof data.userId === "string" && data.userId ? data.userId : fallbackUserId,
    userName: typeof data.userName === "string" ? data.userName : "",
    characterColor: typeof data.characterColor === "string" ? data.characterColor : "",
    characterShape: typeof data.characterShape === "string" ? data.characterShape : "default",
    currentTitle: typeof data.currentTitle === "string" ? data.currentTitle : "",
    date,
    plan: typeof data.plan === "string" ? data.plan : "",
    reflection: typeof data.reflection === "string" ? data.reflection : "",
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt ? data.updatedAt : new Date().toISOString(),
    syncStatus: data.syncStatus === "pending" ? "pending" : "synced",
    syncError: typeof data.syncError === "string" ? data.syncError : "",
    isDraft: data.isDraft === true,
    mentions: Array.isArray(data.mentions)
      ? data.mentions.filter((value): value is string => typeof value === "string")
      : [],
    planItems: normalizePlanItems(data.planItems),
  };
}

function dailyReportToCloudPayload(report: DailyReport) {
  // Strip local-only sync metadata AND the draft flag. Drafts never
  // hit Firestore — `handleDailyReportSectionSave` already skips the
  // cloud write — but if a future code path (e.g. legacy migration)
  // tries to upload a draft, this defense-in-depth ensures the cloud
  // copy is always treated as published.
  const { syncStatus, syncError, isDraft, ...cloudReport } = report;
  return cloudReport;
}

function mergeDailyReports(reports: DailyReport[]) {
  const reportMap = new Map<string, DailyReport>();

  reports.forEach((report) => {
    const key = report.date || report.id;
    const existingReport = reportMap.get(key);
    if (!existingReport || new Date(report.updatedAt).getTime() >= new Date(existingReport.updatedAt).getTime()) {
      reportMap.set(key, report);
    }
  });

  return Array.from(reportMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function getDailyReportStorageKeys(uid: string, registeredUserId: string) {
  return Array.from(
    new Set([
      getAccountStorageKey(getAccountStorageScope(uid, registeredUserId), "daily-reports"),
      getAccountStorageKey(getAccountStorageScope(uid, ""), "daily-reports"),
    ]),
  );
}

function readCachedDailyReports(uid: string, registeredUserId: string): DailyReport[] {
  if (typeof window === "undefined") {
    return [];
  }

  return mergeDailyReports(
    getDailyReportStorageKeys(uid, registeredUserId).flatMap((key) => {
      const savedReports = window.localStorage.getItem(key);
      if (!savedReports) {
        return [];
      }

      try {
        return (JSON.parse(savedReports) as Partial<DailyReport>[]).map((report) =>
          normalizeDailyReport(report, uid),
        );
      } catch {
        return [];
      }
    }),
  );
}

function writeCachedDailyReports(uid: string, registeredUserId: string, reports: DailyReport[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedReports = JSON.stringify(mergeDailyReports(reports));
  getDailyReportStorageKeys(uid, registeredUserId).forEach((key) => {
    safeSetLocalStorage(key, serializedReports);
  });
}

async function readDurableDailyReports(uid: string, registeredUserId: string) {
  const indexedReports = await readPersistentItems<DailyReport>("dailyReports");
  return mergeDailyReports([
    ...readCachedDailyReports(uid, registeredUserId),
    ...indexedReports
      .filter((report) => report.userId === uid)
      .map((report) => normalizeDailyReport(report, uid)),
  ]);
}

function persistDailyReports(uid: string, registeredUserId: string, reports: DailyReport[]) {
  const normalizedReports = mergeDailyReports(reports);
  writeCachedDailyReports(uid, registeredUserId, normalizedReports);
  void putPersistentItems("dailyReports", normalizedReports);
}

function getPostTime(post: ContributionPostRecord) {
  const time = new Date(post.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

// Deterministic dedupe for posts coming from multiple sources (cloud + local
// pending). Rules (highest priority first):
//   1. Drop invalid / daily-report-mirror posts.
//   2. For the same post id, prefer `synced` (cloud is the source of truth for
//      likes and other server-side fields) over `pending`.
//   3. If both are the same syncStatus, prefer the later createdAt.
// Caller order no longer matters — same input set always produces the same
// result. This avoids the historical bug where a late-arriving cache load
// could overwrite cloud data depending on `forEach` ordering.
function mergePosts(posts: ContributionPostRecord[]) {
  const postMap = new Map<string, ContributionPostRecord>();

  for (const post of posts) {
    if (!post.id || !post.userId || !post.text.trim() || isDailyReportMirrorPost(post)) {
      continue;
    }

    const existing = postMap.get(post.id);
    if (!existing) {
      postMap.set(post.id, post);
      continue;
    }

    const existingIsSynced = existing.syncStatus === "synced";
    const incomingIsSynced = post.syncStatus === "synced";

    // synced beats pending unconditionally.
    if (incomingIsSynced && !existingIsSynced) {
      postMap.set(post.id, post);
      continue;
    }
    if (!incomingIsSynced && existingIsSynced) {
      continue;
    }

    // Same syncStatus → newer createdAt wins.
    if (getPostTime(post) > getPostTime(existing)) {
      postMap.set(post.id, post);
    }
  }

  return Array.from(postMap.values()).sort((a, b) => getPostTime(b) - getPostTime(a));
}

// Boot-time UI seed only. We keep `synced` posts from any user (so other
// users' posts can flash in instantly on reload before the cloud snapshot
// arrives) and the current user's `pending` posts (their own optimistic
// writes that haven't been confirmed yet). We never keep *other* users'
// pending posts because they don't make sense outside the writer's device.
async function readDurablePosts(currentUid: string) {
  const indexedPosts = await readPersistentItems<ContributionPostRecord>("posts");
  return mergePosts(
    indexedPosts.filter((post) => post.syncStatus === "synced" || post.userId === currentUid),
  );
}

// Fire-and-forget IndexedDB write. Callers should pass `.catch(logPersistError)`
// when invoking so a failure here doesn't silently rot the cache.
async function persistPosts(posts: ContributionPostRecord[]) {
  await putPersistentItems("posts", mergePosts(posts));
}

function logPersistError(error: unknown) {
  console.warn("Failed to persist posts to IndexedDB:", error);
}

function isDailyReportMirrorPost(post: Pick<ContributionPostRecord, "text">) {
  const text = post.text.trimStart();
  return text.startsWith("今日やること\n") || text.startsWith("今日の振り返り\n");
}

function readDesktopNotificationSettings(scope: string): DesktopNotificationSettings {
  if (typeof window === "undefined") {
    return defaultDesktopNotificationSettings;
  }

  const savedSettings = window.localStorage.getItem(getAccountStorageKey(scope, "desktop-notification-settings"));
  if (!savedSettings) {
    return defaultDesktopNotificationSettings;
  }

  try {
    const parsedSettings = JSON.parse(savedSettings) as Partial<DesktopNotificationSettings>;
    const volume =
      typeof parsedSettings.soundVolume === "number" && Number.isFinite(parsedSettings.soundVolume)
        ? Math.min(1, Math.max(0, parsedSettings.soundVolume))
        : defaultDesktopNotificationSettings.soundVolume;

    return {
      ...defaultDesktopNotificationSettings,
      ...parsedSettings,
      soundVolume: volume,
    };
  } catch {
    return defaultDesktopNotificationSettings;
  }
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function playFallbackNotificationTone(volume: number) {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return Promise.resolve(false);
  }

  const audioContext = new AudioContextConstructor();
  const gain = audioContext.createGain();
  const firstTone = audioContext.createOscillator();
  const secondTone = audioContext.createOscillator();
  const startTime = audioContext.currentTime;
  const safeVolume = Math.min(0.5, Math.max(0.02, volume));

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(safeVolume * 0.14, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.52);

  firstTone.type = "sine";
  firstTone.frequency.setValueAtTime(660, startTime);
  firstTone.frequency.exponentialRampToValueAtTime(880, startTime + 0.16);

  secondTone.type = "sine";
  secondTone.frequency.setValueAtTime(990, startTime + 0.08);
  secondTone.frequency.exponentialRampToValueAtTime(1180, startTime + 0.28);

  firstTone.connect(gain);
  secondTone.connect(gain);
  gain.connect(audioContext.destination);

  firstTone.start(startTime);
  firstTone.stop(startTime + 0.44);
  secondTone.start(startTime + 0.08);
  secondTone.stop(startTime + 0.48);

  return new Promise<boolean>((resolve) => {
    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined);
      resolve(true);
    }, 620);
  });
}

async function playNotificationSound(
  type: NotificationItem["type"] | "default",
  settings: DesktopNotificationSettings,
) {
  if (typeof window === "undefined" || !settings.sound) {
    return false;
  }

  const volume = Math.min(1, Math.max(0, settings.soundVolume));
  if (volume <= 0) {
    return false;
  }

  const audio = new Audio(notificationSoundSources[type] || notificationSoundSources.default);
  audio.volume = Math.min(0.7, volume);

  try {
    await audio.play();
    return true;
  } catch {
    return playFallbackNotificationTone(volume);
  }
}

function readAppNotifications(scope: string): NotificationItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const savedNotifications = window.localStorage.getItem(getAccountStorageKey(scope, "app-notifications"));
  if (!savedNotifications) {
    return [];
  }

  try {
    return (JSON.parse(savedNotifications) as Partial<NotificationItem>[])
      .filter((item) => item.id && item.type && item.title && item.createdAt)
      .map((item) => ({
        id: String(item.id),
        type: item.type as NotificationItem["type"],
        title: String(item.title),
        body: typeof item.body === "string" ? item.body : "",
        createdAt: String(item.createdAt),
        read: Boolean(item.read),
        sourceUserId: typeof item.sourceUserId === "string" ? item.sourceUserId : "",
      }));
  } catch {
    return [];
  }
}

function getNotificationSourceText(type: NotificationItem["type"], t: (k: string) => string) {
  if (type === "dailyLog") return t("日報");
  if (type === "post") return t("投稿");
  if (type === "workspaceInvite") return t("作業部屋への招待");
  if (type === "like") return t("いいね");
  if (type === "reply") return t("返信");
  return t("フレンド申請");
}

// Shared ghost (朧 / Oboro) artwork. Drawn once as an inline SVG so the
// dark line-art outline + draped tail-curl stay crisp at any size, and
// 「相 Sou」(morph) のシルエット — 縁取り金線つきの立方体。
// HSL ベースで color から top (lighter) / right (darker) を派生させる
// ので、既存の characterColorOptions (8 色) どれを選んでも同じ視覚言語
// で立体感が出る。edge は固定の金 (#C7A24E)。
/* shadeHex / renderMorphCubeSvg / renderDefaultCharacterSvg は
   components/CharacterShapeSvg.tsx に切り出し済み (App.tsx / atelier
   stage 双方から再利用するため)。下の import で読み込んでいる。 */

// swatches) so they always read as the exact same character.
const ghostSvgMarkup = (
  <svg
    className="ghost-svg"
    viewBox="0 0 128 140"
    aria-hidden="true"
    focusable="false"
  >
    {/* Steady halo stays put behind while the body floats over it, so
        the ghost reads as lifting off its own glow (adds depth). */}
    <ellipse className="ghost-aura" cx="62" cy="78" rx="52" ry="54" />
    {/* Two nested groups carry the motion (see App.css): .ghost-sway is a
        slow pendulum, .ghost-bob a faster bob with squash-&-stretch.
        Defining the motion on <g> wrappers keeps it in SVG user units,
        so it scales with the sprite in every context. */}
    <g className="ghost-sway">
      <g className="ghost-bob">
        {/* Arm nubs drawn before the body so their roots tuck behind it */}
        <path className="ghost-arm" d="M18 86 q-12 2 -16 9 q9 1 17 -2 Z" />
        <path className="ghost-arm" d="M110 86 q12 2 16 9 q-9 1 -17 -2 Z" />
        <path
          className="ghost-body"
          d="M64 14 C40 14 18 32 17 60 C16 74 16 86 19 98 C21 107 24 116 31 116 C37 116 39 108 45 108 C51 108 53 118 60 118 C66 118 68 107 75 109 C90 113 104 120 116 108 C124 100 121 86 112 88 C106 89 106 96 100 94 C109 86 113 73 112 60 C110 32 88 14 64 14 Z"
        />
        <ellipse className="ghost-eye" cx="48" cy="64" rx="5.2" ry="7.4" />
        <ellipse className="ghost-eye" cx="78" cy="64" rx="5.2" ry="7.4" />
        <path className="ghost-mouth" d="M52 80 q4 -6 8 0 t8 0" />
        <g className="ghost-hat" transform="rotate(20 96 30)">
          <path className="ghost-hat-brim" d="M80 40 h36 v5 h-36 Z" />
          <path className="ghost-hat-crown" d="M88 14 h20 v26 h-20 Z" />
          <rect className="ghost-hat-band" x="88" y="33" width="20" height="4" />
        </g>
      </g>
    </g>
  </svg>
);

// The main character: a rounded blocky body + inner highlight (sprite-body)
// + two short legs. No sprout, no eyes — a minimal silhouette that matches
// the workspace-room representation of the character. The "ghost" and "owl"
// shapes (driven by the `shape` prop) render their own distinct silhouettes.
//
// memo 化必須：50 箇所以上で繰り返し描画される sprite。color / shape が
// 変わらなければ再描画スキップしてよい (内部 DOM は完全に props だけで
// 決まる)。App.tsx の他の state が動くたびに 50 箇所の sprite が
// reconcile されていたのを止める。
export const ProfileCharacterPreview = memo(function ProfileCharacterPreview({
  color,
  shape = "default",
}: {
  color?: string;
  /* When set to "ghost" the preview switches to the soul shape
     (no legs, wavy hem, floating). Other shapes can be
     added here in the future. */
  shape?: CharacterShape;
}) {
  const isGhost = shape === "ghost";
  const isOwl = shape === "owl";
  const isRobo = shape === "robo";
  const isAngel = shape === "angel";
  const isDefault = shape === "default";
  const isCustomShape = isGhost || isOwl || isRobo || isAngel || isDefault;
  const resolvedColor = color || characterColorOptions[0].value;
  return (
    <div
      className={`profile-character-preview${
        isGhost ? " is-ghost" : ""
      }${isOwl ? " is-owl" : ""}${
        isRobo ? " is-robo" : ""
      }${isAngel ? " is-angel" : ""}${
        isDefault ? " is-default-char" : ""
      }`}
      style={{ "--actor-color": resolvedColor } as CSSProperties}
      aria-hidden="true"
    >
      <span className={`actor-sprite deep shape-${shape} ${isCustomShape ? "" : "is-blocky"}`}>
        {isOwl ? (
          /* 宵 (Yoi) は朧と同じ line-art 語彙に統一。CSS sprite 版は
             saturated カートゥーン調で 朧 / 灯 と並んだ時にシリーズ感が
             崩れていたので、共有 renderer (clean line-art) に差し替え。 */
          renderOwlSvg(resolvedColor)
        ) : isRobo ? (
          renderRoboSvg(resolvedColor)
        ) : isAngel ? (
          renderAngelSvg(resolvedColor)
        ) : isGhost ? (
          ghostSvgMarkup
        ) : isDefault ? (
          renderDefaultCharacterSvg(resolvedColor)
        ) : (
          <>
            <span className="sprite-body" />
            <span className="sprite-leg sprite-leg-left" />
            <span className="sprite-leg sprite-leg-right" />
          </>
        )}
      </span>
    </div>
  );
});

function getFirestoreErrorMessage(error: unknown, fallback: string, permissionFallback = fallback) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";

  if (code.includes("permission-denied") || message.includes("Missing or insufficient permissions")) {
    return permissionFallback;
  }

  return message || fallback;
}

function canSaveProfileLocally(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";

  // `resource-exhausted` is the Firestore daily-quota error on the Spark
  // plan ("Quota exceeded."). Without treating it as recoverable, a new
  // user who happens to hit the project-wide quota during onboarding
  // gets permanently stuck on the settings form. Letting them through
  // via localStorage means the app stays usable; the cloud sync will
  // converge when the quota window resets.
  return (
    code.includes("permission-denied") ||
    code.includes("unavailable") ||
    code.includes("resource-exhausted") ||
    message.includes("Missing or insufficient permissions") ||
    message.includes("Quota exceeded")
  );
}

function getLevelState(totalExp: number) {
  let level = 1;
  let spentExp = 0;
  let neededExp = 120;

  while (totalExp >= spentExp + neededExp) {
    spentExp += neededExp;
    level += 1;
    neededExp = Math.round(120 + Math.pow(level, 1.55) * 42);
  }

  const currentExp = totalExp - spentExp;
  return {
    level,
    currentExp,
    neededExp,
    percent: Math.min(100, Math.round((currentExp / neededExp) * 100)),
  };
}

function getTitleRanks(logs: StudyLog[], effortExp: number, outputExp: number): TitleRank[] {
  const activeDays = new Set(logs.map((log) => new Date(log.createdAt).toDateString())).size;
  const totalHours = logs.reduce((sum, log) => sum + log.minutes, 0) / 60;

  return [
    {
      name: "Consistent Mind",
      condition: "Study on 3 different days",
      unlocked: activeDays >= 3,
    },
    {
      name: "Night Committer",
      condition: "Output EXP reaches 1,800",
      unlocked: outputExp >= 1800,
    },
    {
      name: "Bug Slayer",
      condition: "Effort EXP reaches 1,000",
      unlocked: effortExp >= 1000,
    },
    {
      name: "Merge Wizard",
      condition: "Total study time reaches 12h",
      unlocked: totalHours >= 12,
    },
  ];
}

function formatStudyTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}




function getElapsedMinutes(joinedAt: string, nowMs = Date.now()) {
  return Math.max(1, Math.floor((nowMs - new Date(joinedAt).getTime()) / 60000));
}

function getWorkspaceActiveMinutes(member: Pick<WorkspaceMember, "joinedAt" | "status" | "activeStartedAt" | "accumulatedActiveMinutes">, nowMs = Date.now()) {
  const accumulated = member.accumulatedActiveMinutes;

  if (typeof accumulated !== "number") {
    return getElapsedMinutes(member.joinedAt, nowMs);
  }

  if (member.status === "on-break" || !member.activeStartedAt) {
    return Math.max(0, Math.floor(accumulated));
  }

  return Math.max(1, Math.floor(accumulated + (nowMs - new Date(member.activeStartedAt).getTime()) / 60000));
}

function getRoomSessionExp(minutes: number) {
  return Math.max(20, Math.round((minutes / 60) * 80));
}

/* App-side monument record. Extends the marker the room component renders
   with the data the detail popover needs (owner name + achievement). */
type RoomMonument = MonumentMarker & { name: string; detail: string };

/* Milestone tiers, highest-prestige first. Each member contributes at
   most one monument (their top achievement) so the room floor stays
   uncluttered. Derived live from the members' synced profiles — no extra
   Firestore collection — so a stone appears whenever a qualifying member
   is present and quietly fades when they leave. */
const MONUMENT_TIERS: { test: (p: UserProfile) => boolean; icon: string; short: string }[] = [
  { test: (p) => (p.streak ?? 0) >= 30, icon: "🔥", short: "30日連続ログイン" },
  { test: (p) => (p.level ?? 0) >= 20, icon: "🏛️", short: "レベル20到達" },
  { test: (p) => (p.contributionCount ?? 0) >= 1000, icon: "🌱", short: "累計1,000コントリビュート" },
  { test: (p) => (p.level ?? 0) >= 10, icon: "⭐", short: "レベル10到達" },
  { test: (p) => (p.streak ?? 0) >= 7, icon: "📅", short: "7日連続ログイン" },
];

// Translation keys for monument tier short labels (used in JSX via t()).
// Keeping the labels as JA literals above keeps the build side-effect-free —
// runtime t() call below translates them when rendered.


function buildRoomMonuments(
  members: WorkspaceMember[],
  profiles: Record<string, UserProfile>,
  t: (k: string, vars?: Record<string, string | number>) => string,
): RoomMonument[] {
  const found: { id: string; name: string; icon: string; short: string; color: string }[] = [];
  for (const member of members) {
    const profile = profiles[member.userId];
    if (!profile) continue;
    const tier = MONUMENT_TIERS.find((entry) => entry.test(profile));
    if (!tier) continue;
    found.push({
      id: `mon-${member.userId}-${tier.short}`,
      name: member.name,
      icon: tier.icon,
      short: t(tier.short),
      color: member.characterColor || member.color,
    });
  }

  const top = found.slice(0, 6);
  return top.map((monument, index) => ({
    id: monument.id,
    icon: monument.icon,
    color: monument.color,
    name: monument.name,
    label: t("{name} さんの記念碑：{short}", { name: monument.name, short: monument.short }),
    detail: monument.short,
    // Line the stones up along the upper-middle of the room so they read
    // as dedications rather than obstacles — kept clear of the top-left
    // room overlay and the top-right chat log.
    x: top.length <= 1 ? 50 : 36 + (index * 40) / (top.length - 1),
    y: 12,
  }));
}

function getStableHash(value: string) {
  return Array.from(value).reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

function seededRandom(seed: number) {
  let value = seed || 1;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}


function getWorkspaceStatusFromMessage(message: string): RoomUserStatus {
  if (message.includes("休憩")) {
    return "on-break";
  }

  if (message.includes("集中")) {
    return "deep-work";
  }

  return "working";
}

function createWorkspaceMember(
  member: Omit<WorkspaceMember, "currentTask" | "building"> & { currentTask: string; building?: string },
): WorkspaceMember {
  const task = member.currentTask || member.building || "Deep Work";
  return {
    ...member,
    id: member.id || member.userId,
    building: member.building || task,
    currentTask: task,
  };
}

function getRoomDescription(room: WorkspaceRoom, t: (k: string) => string) {
  if (room.name.toLowerCase().includes("night")) {
    return t("夜の集中作業に向いた、ゆっくり流れるビルドルーム。");
  }

  return t("小さく集中し、積み上げを共有するための静かな空間。");
}


function getWorkspaceSeatPosition(task: string) {
  const normalizedTask = task.toLowerCase();

  if (normalizedTask.includes("java")) {
    return { x: 58, y: 52 };
  }

  if (normalizedTask.includes("aws") || normalizedTask.includes("cloud")) {
    return { x: 72, y: 68 };
  }

  if (normalizedTask.includes("deep") || normalizedTask.includes("focus")) {
    return { x: 44, y: 74 };
  }

  return { x: 32, y: 58 };
}

function createMinaMember(joinedAt: Date, nowMs: number, status: RoomUserStatus): WorkspaceMember {
  const joinedAtMs = joinedAt.getTime();
  const activeMinutes = Math.max(0, Math.floor((nowMs - joinedAtMs) / 60000));
  const isOnBreak = status === "on-break";
  const activeStartedAt = new Date(nowMs - Math.max(1, activeMinutes % 50) * 60000).toISOString();
  const breakStartedAt = isOnBreak ? new Date(nowMs - Math.max(1, activeMinutes % 12) * 60000).toISOString() : "";

  return createWorkspaceMember({
    id: minaUserId,
    userId: minaUserId,
    name: "Mina",
    avatar: "",
    characterColor: "#3f6f9f",
    x: 66,
    y: 58,
    currentTask: "仕事を片付ける",
    color: "#3f6f9f",
    joinedAt: joinedAt.toISOString(),
    activeStartedAt,
    accumulatedActiveMinutes: isOnBreak ? Math.max(0, activeMinutes - (activeMinutes % 12)) : 0,
    breakStartedAt,
    status,
    tone: "blue",
  });
}

function createNishimiyaMember(joinedAt: Date, nowMs: number, status: RoomUserStatus): WorkspaceMember {
  const joinedAtMs = joinedAt.getTime();
  const activeMinutes = Math.max(0, Math.floor((nowMs - joinedAtMs) / 60000));
  const isOnBreak = status === "on-break";
  // Slightly different cycle lengths from Mina so the two NPCs don't pulse
  // their break states in sync — keeps the room feeling human-paced.
  const activeStartedAt = new Date(nowMs - Math.max(1, activeMinutes % 42) * 60000).toISOString();
  const breakStartedAt = isOnBreak ? new Date(nowMs - Math.max(1, activeMinutes % 9) * 60000).toISOString() : "";

  return createWorkspaceMember({
    id: nishimiyaUserId,
    userId: nishimiyaUserId,
    name: "Nishimiya",
    avatar: "",
    // Bright yellow-green (黄緑). Not part of the palette dropdown, but
    // sprite colors are free-form hex per member.
    characterColor: "#9ccc65",
    x: 38,
    y: 64,
    currentTask: "コードを書く",
    color: "#9ccc65",
    joinedAt: joinedAt.toISOString(),
    activeStartedAt,
    accumulatedActiveMinutes: isOnBreak ? Math.max(0, activeMinutes - (activeMinutes % 9)) : 0,
    breakStartedAt,
    status,
    tone: "green",
  });
}

function getScheduledMinaMember(nowMs: number): WorkspaceMember | null {
  const now = new Date(nowMs);
  const hour = now.getHours();

  if (hour < 7 || hour >= 24) {
    return null;
  }

  const dayStart = new Date(now);
  dayStart.setHours(7, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(24, 0, 0, 0);

  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const random = seededRandom(getStableHash(`mina-room-${dateKey}`));
  let cursor = dayStart.getTime() + Math.floor(random() * 70) * 60000;

  while (cursor < dayEnd.getTime()) {
    const durationMinutes = 70 + Math.floor(random() * 100);
    const sessionEnd = cursor + durationMinutes * 60000;

    if (nowMs >= cursor && nowMs < sessionEnd) {
      const elapsedMinutes = Math.floor((nowMs - cursor) / 60000);
      const cycleMinutes = elapsedMinutes % 58;
      const status: RoomUserStatus = cycleMinutes >= 45 && cycleMinutes < 55 ? "on-break" : "working";
      return createMinaMember(new Date(cursor), nowMs, status);
    }

    const breakMinutes = 35 + Math.floor(random() * 130);
    cursor = sessionEnd + breakMinutes * 60000;
  }

  return null;
}

function getScheduledNishimiyaMember(nowMs: number): WorkspaceMember | null {
  const now = new Date(nowMs);
  const hour = now.getHours();

  // Slightly later wake window than Mina (Mina is 07-24) so the two NPCs
  // overlap but aren't always co-present.
  if (hour < 9 || hour >= 26) {
    return null;
  }

  const dayStart = new Date(now);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(24, 0, 0, 0);

  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const random = seededRandom(getStableHash(`nishimiya-room-${dateKey}`));
  let cursor = dayStart.getTime() + Math.floor(random() * 95) * 60000;

  while (cursor < dayEnd.getTime()) {
    // Slightly shorter focus blocks than Mina so Nishimiya breaks more often.
    const durationMinutes = 55 + Math.floor(random() * 80);
    const sessionEnd = cursor + durationMinutes * 60000;

    if (nowMs >= cursor && nowMs < sessionEnd) {
      const elapsedMinutes = Math.floor((nowMs - cursor) / 60000);
      const cycleMinutes = elapsedMinutes % 50;
      const status: RoomUserStatus = cycleMinutes >= 38 && cycleMinutes < 47 ? "on-break" : "working";
      return createNishimiyaMember(new Date(cursor), nowMs, status);
    }

    const breakMinutes = 25 + Math.floor(random() * 110);
    cursor = sessionEnd + breakMinutes * 60000;
  }

  return null;
}

function isScheduledWorkspaceNpc(member: Pick<WorkspaceMember, "userId" | "id" | "name">) {
  return (
    member.userId === minaUserId ||
    member.id === minaUserId ||
    member.userId === nishimiyaUserId ||
    member.id === nishimiyaUserId ||
    member.userId === "npc-deta" ||
    member.id === "npc-deta" ||
    member.userId === "npc-ari" ||
    member.id === "npc-ari"
  );
}

function isLegacyWorkspaceRoom(room: WorkspaceRoom) {
  const roomName = room.name.trim();

  return (
    room.id === legacyDeepWorkStudioRoomId ||
    room.id === betaWorkspaceRoomId ||
    roomName === "Deep Work Studio" ||
    roomName === "ベータ版" ||
    roomName.toLowerCase() === "a"
  );
}

function getScheduledMinaRoomId(rooms: WorkspaceRoom[], nowMs: number) {
  const minaMember = getScheduledMinaMember(nowMs);
  if (!minaMember) {
    return "";
  }

  const candidateRooms = rooms.filter((room) => !isLegacyWorkspaceRoom(room));
  if (candidateRooms.length === 0) {
    return "";
  }

  const sortedRooms = [...candidateRooms].sort((a, b) => a.id.localeCompare(b.id));
  const now = new Date(nowMs);
  const roomRotationKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${Math.floor(
    (now.getHours() * 60 + now.getMinutes()) / 90,
  )}`;
  const roomIndex = getStableHash(`mina-room-choice-${roomRotationKey}`) % sortedRooms.length;
  return sortedRooms[roomIndex]?.id || "";
}

function getScheduledNishimiyaRoomId(rooms: WorkspaceRoom[], nowMs: number) {
  const nishimiyaMember = getScheduledNishimiyaMember(nowMs);
  if (!nishimiyaMember) {
    return "";
  }

  const candidateRooms = rooms.filter((room) => !isLegacyWorkspaceRoom(room));
  if (candidateRooms.length === 0) {
    return "";
  }

  const sortedRooms = [...candidateRooms].sort((a, b) => a.id.localeCompare(b.id));
  const now = new Date(nowMs);
  // Same 90-minute rotation cadence as Mina, but a different seed string
  // so Nishimiya often picks a different room — and a shifted minute
  // floor so the rotation boundaries don't align exactly with Mina's.
  const roomRotationKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${Math.floor(
    (now.getHours() * 60 + now.getMinutes() + 45) / 90,
  )}`;
  const roomIndex = getStableHash(`nishimiya-room-choice-${roomRotationKey}`) % sortedRooms.length;
  return sortedRooms[roomIndex]?.id || "";
}

function applyScheduledWorkspacePresence(
  room: WorkspaceRoom,
  nowMs: number,
  scheduledMinaRoomId: string,
  scheduledNishimiyaRoomId: string,
): WorkspaceRoom {
  const activeMembers = Array.isArray(room.activeMembers) ? room.activeMembers : [];
  const nextActiveMembers = activeMembers.filter((member) => member && !isScheduledWorkspaceNpc(member));

  const isMinaRoom = scheduledMinaRoomId && room.id === scheduledMinaRoomId;
  const isNishimiyaRoom = scheduledNishimiyaRoomId && room.id === scheduledNishimiyaRoomId;

  if (!isMinaRoom && !isNishimiyaRoom) {
    return nextActiveMembers.length === activeMembers.length
      ? room
      : normalizeWorkspaceRoom({ ...room, activeMembers: nextActiveMembers });
  }

  const injected = [...nextActiveMembers];
  if (isMinaRoom) {
    const minaMember = getScheduledMinaMember(nowMs);
    if (minaMember) injected.unshift(minaMember);
  }
  if (isNishimiyaRoom) {
    const nishimiyaMember = getScheduledNishimiyaMember(nowMs);
    if (nishimiyaMember) injected.unshift(nishimiyaMember);
  }

  return {
    ...room,
    activeMembers: injected,
  };
}

function isValidWorkspacePresence(member: WorkspaceMember, userId: string, nowMs: number) {
  if (member.userId !== userId) {
    return true;
  }

  const joinedAtMs = new Date(member.joinedAt).getTime();
  if (!Number.isFinite(joinedAtMs)) {
    return false;
  }

  if (joinedAtMs > nowMs + 1000 * 60 * 5) {
    return false;
  }

  return (nowMs - joinedAtMs) / 60000 <= maxWorkspacePresenceMinutes;
}

function cleanWorkspacePresenceForUser(rooms: WorkspaceRoom[], userId: string, nowMs = Date.now()) {
  let foundActivePresence = false;

  const nextRooms = rooms.map((room) => {
    const normalizedRoom = normalizeWorkspaceRoom(room);
    const activeMembers = normalizedRoom.activeMembers.filter((member) => {
      if (member.userId !== userId) {
        return true;
      }

      if (foundActivePresence || !isValidWorkspacePresence(member, userId, nowMs)) {
        return false;
      }

      foundActivePresence = true;
      return true;
    });

    return activeMembers.length === normalizedRoom.activeMembers.length
      ? normalizedRoom
      : normalizeWorkspaceRoom({ ...normalizedRoom, activeMembers });
  });

  return nextRooms;
}

function removeWorkspacePresenceForUser(rooms: WorkspaceRoom[], userId: string) {
  const nextRooms = rooms.map((room) => {
    const normalizedRoom = normalizeWorkspaceRoom(room);
    const activeMembers = normalizedRoom.activeMembers.filter((member) => member.userId !== userId);
    if (activeMembers.length !== normalizedRoom.activeMembers.length) {
      return normalizeWorkspaceRoom({ ...normalizedRoom, activeMembers });
    }

    return normalizedRoom;
  });

  return nextRooms;
}

function seedWorkspaceRooms(rooms: WorkspaceRoom[]): WorkspaceRoom[] {
  return rooms
    .map((room) => {
      const normalizedRoom = normalizeWorkspaceRoom(room);
      return normalizeWorkspaceRoom({
        ...normalizedRoom,
        activeMembers: normalizedRoom.activeMembers.filter((member) => !isScheduledWorkspaceNpc(member)),
      });
    })
    .filter((room) => !isLegacyWorkspaceRoom(room));
}


function normalizeWorkspaceRoom(room: Partial<WorkspaceRoom> | null | undefined): WorkspaceRoom {
  const safeRoom = room || {};
  const roomId =
    typeof safeRoom.id === "string" && safeRoom.id.trim()
      ? safeRoom.id
      : createWorkspaceRoomId();
  const roomName =
    typeof safeRoom.name === "string" && safeRoom.name.trim()
      ? safeRoom.name
      : "Untitled Room";
  const activeMembers = Array.isArray(safeRoom.activeMembers) ? safeRoom.activeMembers : [];
  const history = Array.isArray(safeRoom.history) ? safeRoom.history : [];

  return {
    ...safeRoom,
    id: roomId,
    name: roomName,
    totalMinutes: safeRoom.totalMinutes || 0,
    contributions: safeRoom.contributions || 0,
    commits: safeRoom.commits || 0,
    createdAt: safeRoom.createdAt || new Date().toISOString(),
    createdBy: safeRoom.createdBy || "legacy",
    ownerName: safeRoom.ownerName || "Developer",
    ownerAvatar: safeRoom.ownerAvatar || "",
    activeMembers: activeMembers.filter(Boolean).map((member, index) => {
      const task = member.currentTask || member.building || "Deep Work";

      const memberId = member.userId || member.id || `member-${roomId}-${index}`;

      return {
        ...member,
        id: member.id || memberId,
        userId: memberId,
        name: member.name || "Developer",
        avatar: member.avatar || "",
        characterColor: getSafeCharacterColor(member.characterColor || member.color),
        x: typeof member.x === "number" ? member.x : clampNumber(24 + index * 18, 12, 88),
        y: typeof member.y === "number" ? member.y : clampNumber(34 + index * 12, 16, 84),
        currentTask: task,
        status: member.status || "working",
        joinedAt: member.joinedAt || new Date().toISOString(),
        activeStartedAt: member.activeStartedAt || member.joinedAt || new Date().toISOString(),
        accumulatedActiveMinutes: member.accumulatedActiveMinutes || 0,
        breakStartedAt: member.breakStartedAt || "",
        building: member.building || task,
        color: member.color || studyColorOptions[0].value,
        tone: member.tone || "deep",
      };
    }),
    history: history.filter(Boolean).map((item, index) => ({
      ...item,
      id: item.id || `history-${roomId}-${index}`,
      roomId: item.roomId || roomId,
      roomName: item.roomName || roomName,
      userId: item.userId || "unknown",
      userName: item.userName || "Developer",
      task: item.task || item.building || "Deep Work",
      durationMinutes: item.durationMinutes || item.minutes || 0,
      earnedExp: item.earnedExp || item.exp || 0,
      leftAt: item.leftAt || new Date().toISOString(),
      joinedAt: item.joinedAt || item.leftAt || new Date().toISOString(),
      building: item.building || item.task || "Deep Work",
      minutes: item.minutes || item.durationMinutes || 0,
      exp: item.exp || item.earnedExp || 0,
      color: item.color || studyColorOptions[0].value,
    })),
  };
}

function serializeWorkspaceRoom(room: WorkspaceRoom): WorkspaceRoom {
  const normalizedRoom = normalizeWorkspaceRoom(room);

  return {
    id: normalizedRoom.id,
    name: normalizedRoom.name,
    ownerName: normalizedRoom.ownerName || "Developer",
    ownerAvatar: getSerializableAvatar(normalizedRoom.ownerAvatar),
    totalMinutes: normalizedRoom.totalMinutes || 0,
    contributions: normalizedRoom.contributions || 0,
    commits: normalizedRoom.commits || 0,
    createdAt: normalizedRoom.createdAt || new Date().toISOString(),
    createdBy: normalizedRoom.createdBy || "legacy",
    activeMembers: (normalizedRoom.activeMembers || []).map((member) => ({
      ...member,
      avatar: getSerializableAvatar(member.avatar),
    })),
    history: normalizedRoom.history || [],
    // Carry the new visibility flags through the cloud write. Optional
    // so legacy rooms that lack them stay implicit-public; explicit
    // "public" is fine too.
    ...(normalizedRoom.visibility ? { visibility: normalizedRoom.visibility } : {}),
    ...(normalizedRoom.ownerOrgId ? { ownerOrgId: normalizedRoom.ownerOrgId } : {}),
  };
}

function serializeWorkspaceRooms(rooms: WorkspaceRoom[]) {
  return rooms.map(serializeWorkspaceRoom);
}

function getSerializedWorkspaceRoomText(room: WorkspaceRoom) {
  return JSON.stringify(serializeWorkspaceRoom(room));
}

async function saveWorkspaceRoomToCloud(
  room: WorkspaceRoom,
  currentUserUid?: string,
  options?: { allowCreate?: boolean },
) {
  const ref = doc(db, workspaceRoomsCollectionName, room.id);
  /* 復活バグ対策 (2026-06-13): デフォルトは update-only。
     部屋が Firestore から削除済み (= 他端末で解体) の場合、sync effect の
     書き戻しが doc を再作成して「解体してもリロードで戻る」原因になっていた。
     別タブ / スマホ PWA の customRooms に残った亡霊部屋が、presence 心拍の
     たびに setDoc で蘇る構図。doc が存在しない時は書き込みをスキップする。
     新規部屋の作成だけ allowCreate: true で明示的に許可。 */
  const allowCreate = options?.allowCreate === true;

  // Without the transaction below, every room write would replace the
  // entire `activeMembers` array with the writer's local snapshot.
  // Firestore's merge: true doesn't deep-merge arrays — it overwrites
  // them as a single value. That meant if user A edited their own
  // color or shape, user A's stale local copy of user B (e.g. before
  // user B picked the owl silhouette) would get rewritten back over
  // user B's fresh data on the server. The visible symptom: any
  // character edit on one account silently reset every other account
  // in the same room to the default humanoid.
  //
  // The fix: read the remote `activeMembers`, splice in just the
  // current user's local entry, leave every other member exactly as
  // the server has them, then write back. Room-level metadata (name,
  // owner, etc.) still comes from the local payload because those
  // fields are owned by the writer.
  if (!currentUserUid) {
    if (!allowCreate) {
      /* update-only: 削除済み doc を merge:true setDoc が再作成しない
         よう、存在チェックを transaction で行う。 */
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return;
        transaction.set(
          ref,
          {
            ...serializeWorkspaceRoom(room),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
      return;
    }
    await setDoc(
      ref,
      {
        ...serializeWorkspaceRoom(room),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists() && !allowCreate) {
      /* 部屋は削除済み — 書き戻すと復活してしまうのでスキップ。
         (transaction.get の後に return しても安全: 書き込みゼロの
         transaction は commit が no-op になる) */
      return;
    }
    const remoteRoom = snap.exists()
      ? normalizeWorkspaceRoom({
          ...((snap.data() as Partial<WorkspaceRoom>) || {}),
          id: room.id,
        })
      : null;

    const localMembers = room.activeMembers || [];
    const localSelf = localMembers.find((member) => member.userId === currentUserUid);
    const remoteMembers = remoteRoom?.activeMembers || [];
    const otherMembers = remoteMembers.filter((member) => member.userId !== currentUserUid);
    const mergedMembers = localSelf ? [...otherMembers, localSelf] : otherMembers;

    const payload = {
      ...serializeWorkspaceRoom({ ...room, activeMembers: mergedMembers }),
      updatedAt: serverTimestamp(),
    };

    transaction.set(ref, payload, { merge: true });
  });
}

// 開発者アカウント専用：任意のユーザーを作業部屋の在室リストから外す。通常の
// saveWorkspaceRoomToCloud は「自分以外のメンバーは必ずリモートの値を維持」する
// 設計なので他人を消せない。ここではリモートの activeMembers を読み、対象だけを
// 取り除いて書き戻すトランザクションで、他メンバーの最新データを保ったまま退出させる。
async function adminRemoveWorkspaceMemberFromCloud(roomId: string, targetUserId: string) {
  const ref = doc(db, workspaceRoomsCollectionName, roomId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      return;
    }
    const remoteRoom = normalizeWorkspaceRoom({
      ...((snap.data() as Partial<WorkspaceRoom>) || {}),
      id: roomId,
    });
    const nextMembers = (remoteRoom.activeMembers || []).filter(
      (member) => member.userId !== targetUserId,
    );
    transaction.set(
      ref,
      {
        ...serializeWorkspaceRoom({ ...remoteRoom, activeMembers: nextMembers }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}





function GoogleIcon() {
  return (
    <svg className="provider-icon google-icon" viewBox="0 0 533.5 544.3" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z"
      />
      <path
        fill="#34a853"
        d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z"
      />
      <path
        fill="#fbbc04"
        d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z"
      />
      <path
        fill="#ea4335"
        d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="provider-icon github-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.62 7.62 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}






function getAuthErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

function getLocalhostUrl() {
  if (window.location.hostname !== "127.0.0.1") {
    return "";
  }

  return `${window.location.protocol}//localhost:${window.location.port}${window.location.pathname}${window.location.search}`;
}

function getAuthErrorDetail(error: unknown, t: (k: string) => string): AuthErrorDetail {
  const code = getAuthErrorCode(error);
  const localhostUrl = getLocalhostUrl();

  console.error("Firebase auth failed", error);

  switch (code) {
    case "auth/unauthorized-domain":
      return {
        title: t("このURLはFirebase Authで許可されていません。"),
        message: localhostUrl
          ? t("127.0.0.1 ではなく localhost で開くとログインできる可能性が高いです。")
          : t("Firebase ConsoleのAuthentication設定で、このドメインをAuthorized domainsに追加してください。"),
        action: localhostUrl ? `${t("こちらで開き直してください:")} ${localhostUrl}` : undefined,
        code,
      };
    case "auth/operation-not-allowed":
      return {
        title: t("このログイン方法がFirebase側で有効化されていません。"),
        message: t("Firebase ConsoleのAuthentication > Sign-in methodで、選んだログイン方法を有効にしてください。"),
        code,
      };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return {
        title: t("メールアドレスまたはパスワードが正しくありません。"),
        message: t("まだ登録していない場合は、Sign upに切り替えてアカウントを作成してください。"),
        code,
      };
    case "auth/email-already-in-use":
      return {
        title: t("このメールアドレスはすでに登録されています。"),
        message: t("Loginに切り替えてログインしてください。"),
        code,
      };
    case "auth/weak-password":
      return {
        title: t("パスワードが短すぎます。"),
        message: t("6文字以上のパスワードを入力してください。"),
        code,
      };
    case "auth/invalid-email":
      return {
        title: t("メールアドレスの形式が正しくありません。"),
        message: t("入力内容を確認してもう一度お試しください。"),
        code,
      };
    case "auth/popup-blocked":
      return {
        title: t("ログイン用ポップアップがブロックされました。"),
        message: t("ブラウザのポップアップ許可設定を確認して、もう一度お試しください。"),
        code,
      };
    case "auth/popup-closed-by-user":
      return {
        title: t("ログイン画面が閉じられました。"),
        message: t("もう一度ログインボタンを押してください。"),
        code,
      };
    case "auth/account-exists-with-different-credential":
      return {
        title: t("同じメールアドレスの別ログイン方法が存在します。"),
        message: t("以前使ったログイン方法でログインしてください。"),
        code,
      };
    case "auth/network-request-failed":
      return {
        title: t("ネットワーク接続に失敗しました。"),
        message: t("通信状況を確認して、少し待ってからもう一度お試しください。"),
        code,
      };
    case "auth/too-many-requests":
      return {
        title: t("ログイン試行が一時的に制限されています。"),
        message: t("時間を置いてからもう一度お試しください。"),
        code,
      };
    default:
      return {
        title: t("ログインに失敗しました。"),
        message: t("設定または入力内容を確認してください。詳しいエラーはブラウザコンソールにも出力しています。"),
        code: code || undefined,
      };
  }
}

function LoginScreen() {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<AuthErrorDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /* showcase 風のログイン画面ではメール認証フォームを折りたたみで保持。
     初期表示では GitHub / Google の 2 ボタンだけ見せて、メール派は
     「メールで続行」を開いてから記入する。視線をブランドビジュアル
     から逸らさない狙い。 */
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false);

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setAuthError(getAuthErrorDetail(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderLogin = async (provider: "google" | "github") => {
    const localhostUrl = getLocalhostUrl();
    if (localhostUrl) {
      window.location.replace(localhostUrl);
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);

    // Always use `signInWithPopup`, even on mobile. The previous
    // `signInWithRedirect` branch for mobile broke real-world sign-in:
    // this site is on `tatsuyaariyama.github.io` but the Firebase
    // `authDomain` is `github-contribution-rpg.firebaseapp.com`. The
    // redirect flow needs to hand the OAuth result back across those
    // two origins via storage on the auth domain, which iOS Safari /
    // strict browsers block under third-party storage restrictions —
    // the user signs in successfully on Google's side and then gets
    // dropped back at the login screen with no error.
    //
    // Modern iOS Safari / Chrome allow popups opened from a user
    // gesture (which this is — the user just tapped the button), so
    // popup works in practice on the platforms where redirect breaks.
    const oauthProvider = provider === "google" ? googleProvider : githubProvider;

    try {
      const result = await signInWithPopup(auth, oauthProvider);
      // GitHub's Firebase provider exposes the OAuth login (handle) only in
      // additionalUserInfo.profile, not in providerData. Cache it per-uid so
      // the contribution heatmap fetcher can target the right user even when
      // their GitHub display name differs from their login.
      if (provider === "github") {
        const additional = getAdditionalUserInfo(result);
        const login = (additional?.profile as { login?: string } | null | undefined)?.login;
        if (login && result.user.uid) {
          try {
            window.localStorage.setItem(`ca:gh-login:${result.user.uid}`, login);
          } catch {
            /* storage disabled — fall back to displayName/userId */
          }
        }
      }
    } catch (error) {
      setAuthError(getAuthErrorDetail(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell login-shell-showcase" aria-label="Contribution Arc login">
      {/* showcase 画面と共通の没入背景。Sky / Canopy / Mist / Grid /
          Figure / Foreground の層で深さを作る。中央キャラはコミットの
          地層を見上げる「分身」として、ブランドの下の余白に立たせる。 */}
      <div className="showcase-scene" aria-hidden="true">
        <div className="showcase-sky" />
        <div className="showcase-canopy" />
        <div className="showcase-mist" />
        <div className="showcase-grid showcase-grid-login" role="presentation">
          {Array.from({ length: 7 * 18 }).map((_, idx) => {
            const col = idx % 18;
            const row = Math.floor(idx / 18);
            const intensity = ((col * 7 + row * 13 + (col % 3) * 5) % 5) / 4;
            return (
              <span
                key={idx}
                className="showcase-grid-cell"
                style={
                  {
                    "--cell-intensity": intensity.toFixed(2),
                    "--cell-delay": `${(col * 0.08 + row * 0.05).toFixed(2)}s`,
                  } as CSSProperties
                }
              />
            );
          })}
        </div>
        <div className="showcase-figure showcase-figure-login">
          {/* ログイン画面の分身は、特別な frost（白髪）ではなく新規ユーザーが
              最初に持つ初期キャラ（blocky の default shape）を見せる。 */}
          <ProfileCharacterPreview shape="default" color="#7667a8" />
        </div>
        <div className="showcase-foreground" />
      </div>

      <section className="login-showcase-brand">
        {/* App icon — タイトル直上に小さく配置し "アプリ" であることを
            ストアレベルで伝える。Contribution Arc の SVG ロゴを再利用。 */}
        <div className="login-showcase-appicon" aria-hidden="true">
          <ContributionArcLogo />
        </div>

        <svg
          className="showcase-brand-mark"
          viewBox="0 0 1100 300"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Contribution"
          focusable="false"
        >
          <defs>
            <linearGradient id="loginShowcaseInk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0fff5" />
              <stop offset="1" stopColor="#bfe7cc" />
            </linearGradient>
          </defs>
          <text
            x="50%"
            y="62%"
            textAnchor="middle"
            fontFamily="'Caveat', 'Pacifico', 'Brush Script MT', cursive"
            fontSize="200"
            fontWeight="700"
            fill="url(#loginShowcaseInk)"
            textLength="980"
            lengthAdjust="spacingAndGlyphs"
            style={{ letterSpacing: "0.01em" }}
          >
            Contribution
          </text>
          <text
            x="50%"
            y="92%"
            textAnchor="middle"
            fontFamily="'Caveat', 'Pacifico', 'Brush Script MT', cursive"
            fontSize="64"
            fontWeight="600"
            fill="#bfe7cc"
            opacity="0.86"
          >
            — arc —
          </text>
        </svg>
        <p className="showcase-tagline">
          {t("日々のコミットが、あなたの軌跡を描く。")}
        </p>

        <div className="login-showcase-actions">
          <button
            type="button"
            className="provider-button github"
            onClick={() => handleProviderLogin("github")}
            disabled={isSubmitting}
          >
            <GitHubIcon />
            <span>{t("GitHubで続行")}</span>
          </button>
          <button
            type="button"
            className="provider-button google"
            onClick={() => handleProviderLogin("google")}
            disabled={isSubmitting}
          >
            <GoogleIcon />
            <span>{t("Googleで続行")}</span>
          </button>
          <button
            type="button"
            className="login-email-toggle"
            onClick={() => setIsEmailFormOpen((prev) => !prev)}
            aria-expanded={isEmailFormOpen}
          >
            {isEmailFormOpen ? t("メールフォームを閉じる") : t("メールで続行")}
          </button>
        </div>

        {isEmailFormOpen ? (
          <div className="login-showcase-email">
            <div className="auth-mode-tabs" aria-label={t("認証モード")}>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
            </div>
            <form className="login-form" onSubmit={handleEmailAuth}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ari@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </label>
              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Connecting..."
                  : authMode === "signup"
                    ? "Create account"
                    : "Login with email"}
              </button>
            </form>
          </div>
        ) : null}

        {authError ? (
          <div className="auth-error login-showcase-error" role="alert">
            <strong>{authError.title}</strong>
            <span>{authError.message}</span>
            {authError.action ? <span>{authError.action}</span> : null}
            {authError.code ? <code>{authError.code}</code> : null}
          </div>
        ) : null}

        <p className="login-showcase-fineprint">
          {t("続行するとアカウントが自動的に作成されます。")}
        </p>
      </section>
    </main>
  );
}

/* ===============================================================
   日報のローカル下書き (Phase 11)
   「下書きにする」トグルを撤去したので、ユーザーが「今日やること」
   「振り返り」を送信しない限り入力中のテキストはローカルに残るよう
   にする (リロード / 日付切り替え / 別画面往復に強い)。
   ・key は YYYY-MM-DD 単位
   ・plan items と reflection を分けて保存
   ・送信成功時は明示的にクリアしない (state が送信内容と同期するので
     復元しても結果が変わらない)
   =============================================================== */
const DAILY_DRAFT_STORAGE_PREFIX = "ca-daily-draft-v1";
type LocalDailyDraft = {
  planItems?: PlanItem[];
  reflection?: string;
  updatedAt?: number;
};
function readLocalDailyDraft(date: string): LocalDailyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DAILY_DRAFT_STORAGE_PREFIX}:${date}`);
    return raw ? (JSON.parse(raw) as LocalDailyDraft) : null;
  } catch {
    return null;
  }
}
function writeLocalDailyDraft(date: string, patch: LocalDailyDraft) {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalDailyDraft(date) || {};
    const next: LocalDailyDraft = { ...current, ...patch, updatedAt: Date.now() };
    window.localStorage.setItem(
      `${DAILY_DRAFT_STORAGE_PREFIX}:${date}`,
      JSON.stringify(next),
    );
  } catch {
    /* localStorage が満杯 / 無効でも編集自体は continue */
  }
}

/* ===============================================================
   ライブラリの表紙写真：File → アスペクト比を保ったまま長辺 480px に
   縮小して JPEG data URL 化する。表紙(縦長)をそのまま高画質で見せたいので
   正方形 crop はしない。Firebase Storage 未導入のため Firestore doc に直接
   保存する前提で、長辺と画質で ~200KB 未満に収める。
   =============================================================== */
const LEARNING_PHOTO_MAX = 480;
async function fileToLearningPhotoDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = objectUrl;
    });
    const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
    const scale = Math.min(1, LEARNING_PHOTO_MAX / longest);
    const cw = Math.max(1, Math.round(image.naturalWidth * scale));
    const ch = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-2d-unavailable");
    ctx.drawImage(image, 0, 0, cw, ch);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function App() {
  const { language, setLanguage, t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(defaultStudyLogs);
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [learningEditorState, setLearningEditorState] = useState<{
    mode: "create" | "edit";
    itemId?: string;
    name: string;
    category: LearningCategory;
    color: string;
    totalPages: string;
    currentPages: string;
    note: string;
    /** 表紙/アイコン写真 (data URL)。空文字 = 写真なし。 */
    photo: string;
    status: LearningStatus;
  } | null>(null);
  // タブ UI は撤去したが、フィルタ判定で参照するため "all" 固定で保持。
  const [learningCategoryTab] = useState<"all" | "active" | "done" | "archived">("all");
  const [learningSearchQuery, setLearningSearchQuery] = useState("");
  // Library sort order. "recent" (default) keeps the active-work-first
  // behaviour; the others let the user reorder without touching data.
  // localStorage に永続化するので、ユーザーが「自分の順」(custom) を
  // 選んで並べ替えた結果が reload しても保持される (以前は毎回 "recent"
  // にリセットされ、せっかく振った order が見えず「反映されない」ように
  // 感じていた)。
  const [learningSortMode, setLearningSortMode] = useState<"recent" | "total" | "name" | "custom">(() => {
    if (typeof window === "undefined") return "recent";
    try {
      const raw = window.localStorage.getItem("contribution-arc-learning-sort-mode");
      if (raw === "recent" || raw === "total" || raw === "name" || raw === "custom") {
        return raw;
      }
    } catch {
      /* localStorage 不可 — default */
    }
    return "recent";
  });
  /* sort mode 変更を localStorage にミラー。setLearningSortMode の呼び出し
     箇所全てを書き換える代わりに effect で集約する。 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("contribution-arc-learning-sort-mode", learningSortMode);
    } catch {
      /* ignore — best-effort */
    }
  }, [learningSortMode]);
  /* 並べ替えモード: on の間、各カードに↑↓ボタンを表示し、ユーザーが
     好きな順に並べ替えられる。モバイル前提だが PC でも有効。
     並べ替え結果は item.order に保存され、sort mode は自動で "custom"
     に切り替わる (= 反映されたことが視覚的に分かる)。 */
  /* === 長押し → ドラッグ並べ替え (徹底改修版) ===
     ・各カードの onPointerDown で 400ms 静止判定
     ・成立したら document に直接 pointermove / pointerup を貼る
       (= 指がどのカードを跨いでも追跡できる)
     ・drag 中は touchAction: none + setPointerCapture でブラウザの
       スクロール介入を遮断
     ・指の Y delta を CSS 変数で渡してドラッグ中カードを実際に動かす
     ・drop index は全カードの中点との比較で連続的に更新 */
  const [dragLibraryItemId, setDragLibraryItemId] = useState<string | null>(null);
  const [dragLibraryOverIndex, setDragLibraryOverIndex] = useState<number | null>(null);
  /* 長押し成立前 (0〜400ms) の前駆フィードバック対象。視覚的に「掴めて
     いる途中」のヒントを出さないと、ユーザーは何も起きていないように
     感じる。 */
  const [pressingLibraryItemId, setPressingLibraryItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartYRef = useRef(0);
  const longPressStartXRef = useRef(0);
  const longPressStartIndexRef = useRef(0);
  const dragWasCommittedRef = useRef(false);
  const cardRectsRef = useRef<Map<string, HTMLElement>>(new Map());
  /* drag 中の最新 sorted 順を保持する ref。 commit は callback 経由なので
     クロージャ古値を避けるため。 */
  const dragSortedRef = useRef<LearningItem[]>([]);
  /* document に貼る handler 参照を覚えて detach する。
     Touch / Mouse それぞれ別 type のイベントを使うので個別に保持。 */
  const dragTouchMoveHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const dragTouchEndHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const dragMouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const dragMouseUpHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  // バーコード(ISBN)スキャンで本を追加するモーダルの開閉。
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  // 「記録の入力」フォーム(時間/量/メモ/画像)の対象 learning item id。
  const [learningRecordItemId, setLearningRecordItemId] = useState<string | null>(null);
  /* プロフィールの「This Week」棒グラフから曜日をタップして、
     その日に記録した学習項目・時間を編集できる詳細パネルを開く。
     null = 閉じている、0..6 = Mon..Sun。 */
  const [profileWeekDayIndex, setProfileWeekDayIndex] = useState<number | null>(null);
  /* 同じ目標のユーザー一覧モーダル。null = 閉じている。
     開くと指定 goal で Firestore を query して結果を表示する。 */
  const [goalMatchModal, setGoalMatchModal] = useState<{
    goalId?: string;
    goalCustomName?: string;
    goalLabel: string;
    users: GoalMatchUser[];
    loading: boolean;
    error: string;
  } | null>(null);
  const [profileWeekLogEditMinutes, setProfileWeekLogEditMinutes] = useState<Record<string, string>>({});
  /* 詳細パネル下部の「+ Add log」フォーム state。Subject は learningItems
     から選び、minutes は分単位で入力する。日付は選択されている曜日の
     dateIso を流用 (= その日に追加される)。 */
  const [profileWeekAddSubjectId, setProfileWeekAddSubjectId] = useState("");
  const [profileWeekAddMinutes, setProfileWeekAddMinutes] = useState("");
  const [isLearningDeleteConfirming, setIsLearningDeleteConfirming] = useState(false);
  // Item detail view (B-4): the learning item whose history/stats panel
  // is open. null = closed. Read-only over existing studyLogs (no new reads).
  const [learningDetailId, setLearningDetailId] = useState<string | null>(null);
  // Inline page-progress quick edit (C-6): the book card id whose page
  // input is open, plus the in-flight text value. null = closed.
  const [learningPageEditId, setLearningPageEditId] = useState<string | null>(null);
  const [learningPageEditValue, setLearningPageEditValue] = useState("");
  const [studySubject, setStudySubject] = useState("");
  const [studyColor, setStudyColor] = useState(studyColorOptions[0].value);
  /* Phase 10c: Learning Item ごとのインライン「他の時間…」入力. null
     なら閉, それ以外なら開いてるカードの id. 文字列入力なので空白や
     0 の場合は記録ボタンを無効化する. */
  const [learningQuickLogOpenId, setLearningQuickLogOpenId] = useState<string | null>(null);
  const [learningQuickLogCustomMinutes, setLearningQuickLogCustomMinutes] = useState("");
  /* 「他の時間…」のカスタム入力。分だけだと「2 時間」を 120 と暗算
     させることになるので、時間と分の 2 欄に分けて直感的に入力できる
     ようにする。確定時に hours*60 + minutes の合計分数で記録する。 */
  const [learningQuickLogCustomHours, setLearningQuickLogCustomHours] = useState("");
  /* 学習対象の詳細モーダルでの自由時間入力(分)。固定プリセットではなく
     任意の分数を直接入れて記録できるようにするための専用 state。 */
  const [detailLogMinutes, setDetailLogMinutes] = useState("");
  /* 詳細モーダルの記録欄も時間 + 分で入力できるようにする (カードの
     「他の時間…」と同じ直感的な 2 欄方式)。 */
  const [detailLogHours, setDetailLogHours] = useState("");
  /* Phase 10d: グローバルなクイック記録ポップオーバー. トップバーと
     mobile bottom nav の「+ 記録」から開かれ、どの画面からでも 1-2
     タップで時間を残せるようにする. 同じ popover 内で各 Learning Item
     の「他の時間…」をインライン展開できる. */
  const [isQuickLogPopoverOpen, setIsQuickLogPopoverOpen] = useState(false);
  /* ホーム上部の「お知らせ」をアコーディオン化する状態。
     タップで body を開閉。同時に開けるのは 1 件まで。 */
  const [openAnnouncementId, setOpenAnnouncementId] = useState<string | null>(null);
  /* お知らせ一覧モーダルの開閉。ホームには pinned + 最新 1 件だけ出し、
     過去のお知らせはここを開いて全件を見せる。 */
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  /* 要望フォーム。固定お知らせの「要望欄」CTA から開く。
     送信内容は Firestore feedback/{id} に保存し、開発者だけが読める。 */
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  /* 各 Learning Item ごとに記入中の分数 (string) を保持する. プリセット
     チップは廃止し、最初から数値入力欄を表示してそのまま打ち込める
     ようにした (チップ → 「他の時間…」 と段階を踏ませる方が逆に遅い、
     という指摘を受けての変更). */
  const [quickLogMinutesById, setQuickLogMinutesById] = useState<Record<string, string>>({});
  /* 学習カードのクイック記録 (+1m / +10m / +1h) を「連続タップでまとめて
     1 記録」にするための保留状態。直近のタップから QUICK_LOG_MERGE_MS の
     間に押されたぶんを合算し、止まった時点で 1 件の StudyLog として確定
     する。例: +1h を 3 連打すると 1h を 3 件刻まず 3h の 1 記録になる。
     pendingById は加算中の合計 (分) を「+3時間 記録中…」のように見せる
     表示用。確定タイマーと確定対象の item は ref で同期管理する。 */
  const [quickLogPendingById, setQuickLogPendingById] = useState<Record<string, number>>({});
  const quickLogMergeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const quickLogPendingRef = useRef<Map<string, number>>(new Map());
  const quickLogPendingItemRef = useRef<Map<string, LearningItem>>(new Map());
  const [selectedArcDayKey, setSelectedArcDayKey] = useState<string | null>(null);
  /* Donut legend インライン編集中の subject。null=非編集。
     draft はそのまま input の controlled value。 */
  const [editingDonutSubject, setEditingDonutSubject] = useState<string | null>(null);
  const [editingDonutDraft, setEditingDonutDraft] = useState("");
  const [hoveredArcCell, setHoveredArcCell] = useState<
    { day: ContributionArcDay; left: number; top: number; placement: "above" | "below" } | null
  >(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Per-user UI scale (browser zoom-like density control). Persisted in
  // localStorage so the setting survives reloads. Clamped to a sensible
  // range so we never end up with an unreadably small or huge UI.
  const UI_SCALE_MIN = 0.8;
  const UI_SCALE_MAX = 1.15;
  // Default 0.85: at 100% the cards feel too zoomed-in on typical laptop
  // viewports. Existing users with a stored preference keep their value;
  // only first-time users hit this default.
  const UI_SCALE_DEFAULT = 0.85;
  const [uiScale, setUiScale] = useState<number>(() => {
    if (typeof window === "undefined") return UI_SCALE_DEFAULT;
    try {
      const stored = window.localStorage.getItem("ca:ui-scale");
      const parsed = stored ? parseFloat(stored) : NaN;
      if (Number.isFinite(parsed) && parsed >= UI_SCALE_MIN && parsed <= UI_SCALE_MAX) {
        return parsed;
      }
    } catch {
      /* localStorage unavailable — fall through to default */
    }
    return UI_SCALE_DEFAULT;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    try {
      window.localStorage.setItem("ca:ui-scale", String(uiScale));
    } catch {
      /* localStorage unavailable — just skip persistence */
    }
  }, [uiScale]);


  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handler = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserMenuOpen]);
  // Topbar popovers for Friends and Live Activity. These replace the old
  // left-rail sidebar panels — the topbar surfaces them as on-demand
  // popovers so the main canvas can be a clean 50/50 split (left = views,
  // right = always-visible feed). Outside-click closes them, mirroring the
  // user-menu / notifications pattern just above.
  const [isFriendsPopoverOpen, setIsFriendsPopoverOpen] = useState(false);
  // Full friends directory dialog (opened from the popover footer). Lets the
  // user see every friend beyond the 8-row popover cap and send room invites.
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  // Friends already invited this session — flips the per-row button to a
  // settled "招待済み" state so the user can't spam-send.
  const [invitedFriendUids, setInvitedFriendUids] = useState<Set<string>>(new Set());
  const friendsPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFriendsPopoverOpen) return;
    const handler = (event: MouseEvent) => {
      if (friendsPopoverRef.current && !friendsPopoverRef.current.contains(event.target as Node)) {
        setIsFriendsPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isFriendsPopoverOpen]);
  const [isLivePopoverOpen, setIsLivePopoverOpen] = useState(false);
  const livePopoverRef = useRef<HTMLDivElement>(null);
  /* 検索ポップオーバーの outside-click 制御。
     アイコン直下に inline で出す UX に統一 (旧フル画面モーダルだと
     モバイルで画面が下にスクロールされて違和感があるとの報告)。
     ref と effect だけここで宣言し、開閉フラグの isSearchOpen は
     既存 state を流用する。effect 本体は isSearchOpen 宣言の後で
     useEffect が呼ばれるので問題ないが、ref はここで先行宣言できる。 */
  const searchPopoverRef = useRef<HTMLDivElement>(null);
  /* linkWithPopup は currentUser.providerData を in-place 更新するだけで
     onAuthStateChanged を発火させないため、GitHub 連携直後に再 render
     されない。この tick の bump が再 render トリガーとして機能している
     意図的な state — read されないが削除しないこと。 */
  const [, setAuthRefreshTick] = useState(0);
  useEffect(() => {
    if (!isLivePopoverOpen) return;
    const handler = (event: MouseEvent) => {
      if (livePopoverRef.current && !livePopoverRef.current.contains(event.target as Node)) {
        setIsLivePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isLivePopoverOpen]);
  const [customUserName, setCustomUserName] = useState("");
  const [draftUserName, setDraftUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [draftUserId, setDraftUserId] = useState("");
  const [settingsError, setSettingsError] = useState("");
  /* オンボーディング完了タイムスタンプ (ISO)。localStorage の per-uid
     キーで持っていた "complete=true" を、cloud 同期可能な形に昇格させた版。
     - 旧: contribution-arc-onboarding-complete-{uid} (boolean, 端末固有)
     - 新: users/{uid}.onboardingCompletedAt (timestamp, cross-device)
     localStorage は引き続き fast-path のローカルキャッシュとして残し、
     新規デバイスでも cloud profile の onboardingCompletedAt が
     立っていればスキップする。 */
  const [cloudOnboardingCompletedAt, setCloudOnboardingCompletedAt] = useState<string>("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  /* 「テーマ (ダーク/ライト)」は廃止。基本はライトモードのみ。
     互換のため localStorage の "contribution-arc-theme" は触らない
     (将来再導入する余地)。data-theme は mount 時に light 固定する。 */
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("idle");
  // Final onboarding step ("firstPost"): the user must write a greeting
  // AND their 決意 (resolution) before any other operation is possible.
  // Both are captured in a blocking modal; the post combines the two.
  const [onboardingGreeting, setOnboardingGreeting] = useState(t("初めまして！"));
  const [onboardingResolve, setOnboardingResolve] = useState("");
  /* Tutorial step "firstDailyPlan" の入力。firstPost 完了後にこの step
     へ遷移し、ユーザーに「今日やること」を 1〜2 行で書かせる。
     保存後 onboarding-complete を立てて idle へ。 */
  const [onboardingFirstPlanDraft, setOnboardingFirstPlanDraft] = useState("");
  const [onboardingFirstPlanError, setOnboardingFirstPlanError] = useState("");
  const [isSavingOnboardingFirstPlan, setIsSavingOnboardingFirstPlan] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    if (!isSearchOpen) return;
    const handler = (event: MouseEvent) => {
      if (searchPopoverRef.current && !searchPopoverRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isSearchOpen]);
  // FEED right-pane visibility. Defaults open (matches previous
  // behaviour); the value is persisted to localStorage so a deliberate
  // collapse survives reloads. Hidden entirely during the workspace
  // view via an existing render gate, so this state only matters on
  // the home / logs / daily / etc. surfaces.
  const [isFeedOpen, setIsFeedOpen] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem("ca:feed-open");
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  // Persist the FEED open/closed preference. Pure UI state, so it
  // doesn't ride the Firestore user-profile sync — localStorage is
  // sufficient and keeps the toggle responsive offline.
  useEffect(() => {
    try {
      window.localStorage.setItem("ca:feed-open", isFeedOpen ? "1" : "0");
    } catch {
      /* localStorage may be blocked (private mode); ignore. */
    }
  }, [isFeedOpen]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [workspaceProfiles, setWorkspaceProfiles] = useState<Record<string, UserProfile>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  // 古い pending request の自動非表示（クライアント側フィルタ・30日）。
  // 起動時 + 6h ごとに一括掃く。effect は **早期 return より前** に置く
  // 必要があるため、handler セクションではなく state 宣言の隣に配置。
  // 後段の `if (!isAuthReady) return` などより前に呼ばれないと、認証状態
  // 変化時に hooks の呼び出し数が変わって React error #310 を引き起こす
  // ── 実際に本番でこの順序ミスでクラッシュした（"画面の復帰が必要です"
  // エラーバウンダリ）。
  useEffect(() => {
    const dismissStale = () => {
      const cutoff = Date.now() - 30 * 86400000;
      setFriendRequests((requests) =>
        requests.filter((request) => {
          if (request.status !== "pending") return true;
          return new Date(request.createdAt).getTime() >= cutoff;
        }),
      );
    };
    dismissStale();
    const id = window.setInterval(dismissStale, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const [friendMessage, setFriendMessage] = useState("");
  // Pinned friends（ローカルだけで保持）。お気に入りの友達を一覧の上位に
  // 固定する。Firestore 同期は P2 でやる予定 ── ひとまずデバイス毎の
  // 設定として動作させる。
  // 重要：複数アカウントの相互混入防止のため、uid scope なキーで保存。
  // currentUser が未確定の初期化時は空で開始し、useEffect で uid 確定後に
  // localStorage から hydrate する。
  const [pinnedFriendUids, setPinnedFriendUids] = useState<string[]>([]);
  const [mutedFriendUids, setMutedFriendUids] = useState<string[]>([]);
  const [blockedFriendUids, setBlockedFriendUids] = useState<string[]>([]);
  const [encouragementsSent, setEncouragementsSent] = useState<Set<string>>(() => new Set());

  // uid 確定後 (ログイン後) に localStorage から hydrate。
  useEffect(() => {
    if (!currentUser?.uid) {
      // ログアウト時は state をクリア (他ユーザーへの leak 防止)
      setPinnedFriendUids([]);
      setMutedFriendUids([]);
      setBlockedFriendUids([]);
      setEncouragementsSent(new Set());
      return;
    }
    const uid = currentUser.uid;
    try {
      const raw = localStorage.getItem(`ca:pinned-friends:${uid}`);
      setPinnedFriendUids(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setPinnedFriendUids([]);
    }
    try {
      const raw = localStorage.getItem(`ca:muted-friends:${uid}`);
      setMutedFriendUids(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setMutedFriendUids([]);
    }
    try {
      const raw = localStorage.getItem(`ca:blocked-friends:${uid}`);
      setBlockedFriendUids(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setBlockedFriendUids([]);
    }
    try {
      const raw = localStorage.getItem(`ca:encouragements-sent:${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { date: string; uids: string[] };
        const today = new Date().toISOString().slice(0, 10);
        setEncouragementsSent(parsed.date === today ? new Set(parsed.uids) : new Set());
      } else {
        setEncouragementsSent(new Set());
      }
    } catch {
      setEncouragementsSent(new Set());
    }
    /* 投稿ドラフト / 既読 置き手紙 ID も uid scope で hydrate。
       過去にレガシーな uid 非依存キーで書かれた値があれば優先で読み、
       次回の write で uid scope キーに上書きされる migration 経路を残す。 */
    try {
      const scoped = localStorage.getItem(`ca:post-draft:${uid}`);
      const legacy = localStorage.getItem("contribution-arc:post-draft");
      setPostDraft(scoped || legacy || "");
    } catch {
      setPostDraft("");
    }
    try {
      const scoped = localStorage.getItem(`ca:read-floor-notes:${uid}`);
      const legacy = localStorage.getItem("ca:read-floor-notes");
      const raw = scoped || legacy;
      setReadFloorNoteIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setReadFloorNoteIds(new Set<string>());
    }
  }, [currentUser?.uid]);


  // state 変化時の保存 (uid scope)。
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      localStorage.setItem(
        `ca:pinned-friends:${currentUser.uid}`,
        JSON.stringify(pinnedFriendUids),
      );
    } catch {
      /* ignore */
    }
  }, [pinnedFriendUids, currentUser?.uid]);
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      localStorage.setItem(
        `ca:muted-friends:${currentUser.uid}`,
        JSON.stringify(mutedFriendUids),
      );
    } catch {
      /* ignore */
    }
  }, [mutedFriendUids, currentUser?.uid]);
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      localStorage.setItem(
        `ca:blocked-friends:${currentUser.uid}`,
        JSON.stringify(blockedFriendUids),
      );
    } catch {
      /* ignore */
    }
  }, [blockedFriendUids, currentUser?.uid]);
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        `ca:encouragements-sent:${currentUser.uid}`,
        JSON.stringify({ date: today, uids: Array.from(encouragementsSent) }),
      );
    } catch {
      /* ignore */
    }
  }, [encouragementsSent]);
  // Friends modal の表示モード / 検索 / ソート。それぞれセッション保持。
  const [friendsModalQuery, setFriendsModalQuery] = useState("");
  const [friendsModalSort, setFriendsModalSort] = useState<
    "online" | "name" | "recent" | "level" | "streak"
  >("online");
  // 一括招待モード（複数選択 → まとめて invite）。
  const [friendsBulkSelectMode, setFriendsBulkSelectMode] = useState(false);
  const [friendsBulkSelectedUids, setFriendsBulkSelectedUids] = useState<Set<string>>(() => new Set());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // 通知パネルのトリガーボタンはトップバーから撤去し、アバターメニューに
  // 移したので、開いている間はパネル外クリックで閉じる（旧はボタン再押下で
  // トグルしていた）。ref はパネルを包む wrap に付ける。
  const notificationsWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handler = (event: MouseEvent) => {
      if (notificationsWrapRef.current && !notificationsWrapRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isNotificationsOpen]);
  const [lastNotificationReadAt, setLastNotificationReadAt] = useState("");
  const [appNotifications, setAppNotifications] = useState<NotificationItem[]>([]);
  const [desktopNotificationSettings, setDesktopNotificationSettings] = useState<DesktopNotificationSettings>(
    defaultDesktopNotificationSettings,
  );
  // 「学習記録の進捗 / 作業部屋退室の積み上げ」を FEED に自動投稿するか。
  // デフォルト ON で“仲間と作業している感”を出すが、静かに使いたいユーザーが
  // 抜けないよう設定で OFF できる。永続化は localStorage（uid スコープ）。
  const [isAutoPostEnabled, setIsAutoPostEnabled] = useState<boolean>(true);
  // 同種の自動投稿が連投で流れないよう、最後に出した時刻を kind 別に覚えておく。
  // 同 kind は 60 分以内は集約（=出さない）。
  const lastAutoPostAtRef = useRef<Record<string, number>>({});
  // 設定モーダルから呼び出す「ホーム画面に追加」インストラクション modal の表示状態。
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  // リロード時の初期 view は "feed"（= bottom-nav のホームに対応する新ホーム）。
  // bottom-nav swap でラベル「ホーム」が view "feed" を指すよう変更したため、
  // 初期表示も「ホーム」と書かれた画面 = feed view にする。
  const [currentView, setCurrentViewRaw] = useState<AppView>("feed");
  /* Pull-to-refresh：ホーム (= feed view) のみで有効。
     v2 (2026-06-13) — 「過敏すぎる」報告への対応で全面作り直し:
     - 閾値 100 → 180px (ネイティブ PTR 相当)
     - 縦方向優位ガード: |ΔY| が |ΔX| の 1.5 倍を超えない限り無効
       (横スワイプ中の誤発火を遮断)
     - touchmove 即 reload → touchend 判定に変更
       (引っ張ったまま指を戻せばキャンセルできる)
     - 引っ張り中はインジケータ pill を表示 (「↓ 引っ張って更新」/
       「離して更新」)。視覚なしの突然リロードを廃止
     - 発火直前にもう一度 scrollY === 0 を確認 (iOS バウンス対策) */
  useEffect(() => {
    if (currentView !== "feed") return;
    if (typeof window === "undefined") return;
    const PULL_THRESHOLD = 180;
    let startY: number | null = null;
    let startX = 0;
    let armed = false; // 縦引っ張りとして成立しているか
    let indicator: HTMLDivElement | null = null;

    const ensureIndicator = () => {
      if (indicator) return indicator;
      indicator = document.createElement("div");
      indicator.className = "ptr-indicator";
      indicator.setAttribute("aria-hidden", "true");
      document.body.appendChild(indicator);
      return indicator;
    };
    const removeIndicator = () => {
      if (indicator?.parentNode) indicator.parentNode.removeChild(indicator);
      indicator = null;
    };

    const onStart = (event: TouchEvent) => {
      if (window.scrollY <= 0) {
        startY = event.touches[0]?.clientY ?? null;
        startX = event.touches[0]?.clientX ?? 0;
        armed = false;
      } else {
        startY = null;
      }
    };
    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY;
      const deltaX = Math.abs(touch.clientX - startX);
      // 縦方向優位でなければ即解除 — 横スワイプ・斜めドラッグを除外。
      if (deltaY < 0 || (deltaY > 24 && deltaY < deltaX * 1.5)) {
        startY = null;
        armed = false;
        removeIndicator();
        return;
      }
      // スクロールが発生していたら PTR ではない。
      if (window.scrollY > 0) {
        startY = null;
        armed = false;
        removeIndicator();
        return;
      }
      if (deltaY > 48) {
        armed = deltaY >= PULL_THRESHOLD;
        const el = ensureIndicator();
        el.textContent = armed ? t("離して更新") : t("↓ 引っ張って更新");
        el.dataset.armed = armed ? "true" : "false";
        // 抵抗カーブ: 実距離の平方根近似で「ぐっと重くなる」感触。
        const visual = Math.min(64, Math.sqrt(deltaY) * 4);
        el.style.transform = `translateX(-50%) translateY(${visual}px)`;
        el.style.opacity = String(Math.min(1, deltaY / 120));
      }
    };
    const onEnd = () => {
      const shouldReload = armed && startY !== null && window.scrollY <= 0;
      startY = null;
      armed = false;
      removeIndicator();
      if (shouldReload) {
        window.location.reload();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      removeIndicator();
    };
  }, [currentView, t]);

  const setCurrentView = useCallback((next: AppView) => {
    if (typeof document === "undefined") {
      setCurrentViewRaw(next);
      return;
    }

    // After the view actually mounts, the window scroll position is
    // still wherever it was on the previous view. Snap it back to the
    // top so the user starts each surface at the beginning — the
    // typical browser SPA expectation and what every SNS app does on
    // tab change. Run on next frame so it lands AFTER any view
    // transition has begun.
    const scrollToTop = () => {
      if (typeof window === "undefined") return;
      // `instant` keeps the snap silent — the view-transition animation
      // is doing the perceived smoothness, a smooth scroll on top of
      // it just looks jittery.
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => {
        setCurrentViewRaw(next);
        requestAnimationFrame(scrollToTop);
      });
    } else {
      setCurrentViewRaw(next);
      requestAnimationFrame(scrollToTop);
    }
  }, []);
  const [profileMember, setProfileMember] = useState<WorkspaceMember | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  // In-stage compact profile popover (tapping another member's avatar in
  // the workspace room). Kept separate from the full-screen profile view
  // above so the room context stays visible behind the card.
  const [roomMemberPanel, setRoomMemberPanel] = useState<WorkspaceMember | null>(null);
  const [roomMemberPanelUser, setRoomMemberPanelUser] = useState<UserProfile | null>(null);
  /* ルームチャット (atelier の「みんな」タブ下に表示)。selectedRoomId が
     変わるたびに購読を張り替える。最大 50 件を表示。 */
  const [roomChatMessages, setRoomChatMessages] = useState<RoomChatMessage[]>([]);
  const [roomChatError, setRoomChatError] = useState("");
  /* チャットは "その場限り" を演出するため、CHAT_TTL_HOURS を過ぎた
     メッセージは表示から落とす。Firestore TTL ポリシーが効くまでの
     遷移期間でも client filter で見た目を統一する。1 分ごとに tick
     して expire したものが自然に消えるようにする。 */
  const [chatExpiryTick, setChatExpiryTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setChatExpiryTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const liveRoomChatMessages = useMemo(
    () => roomChatMessages.filter((msg) => !isRoomChatMessageExpired(msg, chatExpiryTick)),
    [roomChatMessages, chatExpiryTick],
  );
  // Floor notes (置き手紙) + monuments (記念碑) popover state.
  const [floorNotes, setFloorNotes] = useState<FloorNoteRecord[]>([]);
  /* 置き手紙の既読 ID 集合。以前は uid scope の無い "ca:read-floor-notes"
     に書いていたため、複アカウント切替で既読状態が混在していた。
     初期値は空にして、uid 確定後の useEffect で uid scope キーから hydrate。 */
  const [readFloorNoteIds, setReadFloorNoteIds] = useState<Set<string>>(() => new Set());
  const [openFloorNoteId, setOpenFloorNoteId] = useState<string | null>(null);
  const [isComposingFloorNote, setIsComposingFloorNote] = useState(false);
  const [floorNoteDraft, setFloorNoteDraft] = useState("");
  const [floorNoteError, setFloorNoteError] = useState("");
  const [isSavingFloorNote, setIsSavingFloorNote] = useState(false);
  const [isEditingAppearance, setIsEditingAppearance] = useState(false);
  const [openMonumentId, setOpenMonumentId] = useState<string | null>(null);
  const [determination, setDetermination] = useState("");
  const [draftDetermination, setDraftDetermination] = useState("");
  /* 目標 (志望校 or 資格)。決意とは別軸で「ゴール」を 1 つだけ持つ。
     goalId は data/goalCatalog の id。自由記述派には goalCustomName。 */
  const [goalId, setGoalId] = useState("");
  const [goalCustomName, setGoalCustomName] = useState("");
  const [isGoalPickerOpen, setIsGoalPickerOpen] = useState(false);
  // Flips true only once the account-load `getDoc` has settled (any
  // outcome). The periodic profile-sync effect gates its cloud write on
  // this so the *pre-hydration* profile state — which, on a returning
  // device whose localStorage `determination` was written under a stale
  // scope, can be empty even though `userId` is already set — never gets
  // flushed back to Firestore and clobbers the saved 決意. Without this
  // gate the sync could write determination:"" before the cloud value
  // loaded, wiping it; the user's edit then "reverts" on the next reload.
  const [isProfileHydrated, setIsProfileHydrated] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [playerCharacterColor, setPlayerCharacterColor] = useState(characterColorOptions[0].value);
  const [playerCharacterShape, setPlayerCharacterShape] = useState<CharacterShape>("default");
  const [ownedCharacterShapes, setOwnedCharacterShapes] = useState<CharacterShape[]>(["default"]);
  // Set the moment the user picks a color/shape in this session. The
  // account-load effect runs an async `getDoc` whose `.then()` writes the
  // cloud's stored appearance back into local state — if that resolves
  // *after* the user has already changed their character (and before the
  // 1.5s-debounced save round-trips to Firestore), it would clobber the
  // fresh pick with the stale server value, snapping the avatar back to a
  // previous character. This lock makes the choice authoritative: once the
  // user selects, the load no longer overwrites it. Reset at the top of the
  // load effect so a genuine account switch still hydrates from the cloud.
  const characterChoiceLockedRef = useRef(false);
  /* リロードでセッション lock が失われた後の hydrate 競合対策。
     ユーザーが shape/color を選択した時刻を localStorage に書き、
     hydrate 時に「localStorage の時刻 > cloud の lastSyncedAt」なら
     ローカル選択を優先する。これでデバウンス (writeDebounceMs=1500ms)
     未完了のままリロードしても、書きかけの選択が cloud の古い値で
     上書きされない。別端末で変えた場合は cloud の方が新しくなるため
     正しく cloud 値が採用される。 */
  const writeCharacterChoiceStamp = useCallback(() => {
    if (!currentUser) return;
    try {
      const scope = getAccountStorageScope(currentUser.uid, userId);
      safeSetLocalStorage(
        getAccountStorageKey(scope, "character-updated-at"),
        String(Date.now()),
      );
    } catch {
      /* localStorage 不可なら諦め — cloud デバウンス完了に賭ける */
    }
  }, [currentUser, userId]);
  const chooseCharacterColor = useCallback((value: string) => {
    characterChoiceLockedRef.current = true;
    setPlayerCharacterColor(value);
    writeCharacterChoiceStamp();
  }, [writeCharacterChoiceStamp]);
  const chooseCharacterShape = useCallback((shape: CharacterShape) => {
    characterChoiceLockedRef.current = true;
    setPlayerCharacterShape(shape);
    writeCharacterChoiceStamp();
  }, [writeCharacterChoiceStamp]);
  const [coins, setCoins] = useState<number>(0);
  /* 開発者(ADMIN_EMAIL)アカウントへ Arc を一度だけ実クラウド付与する。
     hydrate の floor だけだと realtime 購読が cloud(=0) で上書きして 0 に
     戻るため、cloud 側の coins を直接 30000 まで引き上げる(不足時のみ)。
     端末ごとの localStorage フラグで一度だけ実行し、以後の購入で減らせる。 */
  useEffect(() => {
    if (!currentUser || !isProfileHydrated) return;
    if ((currentUser.email || "").toLowerCase() !== "ari.initx@gmail.com") return;
    const flag = `ca:admin-arc-grant-30000:${currentUser.uid}`;
    if (window.localStorage.getItem(flag)) return;
    let cancelled = false;
    void grantCoinsFloorToCloud(db, currentUser.uid, 30000)
      .then((coinsNow) => {
        if (cancelled) return;
        safeSetLocalStorage(flag, "1");
        setCoins((c) => Math.max(c, coinsNow));
      })
      .catch((error) => {
        console.info("Admin Arc grant skipped.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, isProfileHydrated]);
  /* Daily feed-post Arc reward bookkeeping. Both fields are mirrored
     to the user profile doc so a second device sees the same gate.
     The lifetime cap is enforced against `feedRewardArcEarned` (not
     the live `coins` balance) so spending Arc never re-opens the
     reward — exactly what the user asked for. */
  const [lastFeedRewardDate, setLastFeedRewardDate] = useState<string>("");
  const [feedRewardArcEarned, setFeedRewardArcEarned] = useState<number>(0);
  /* 日報報酬：当日 (YYYY-MM-DD) に「今日やること」と「振り返り」を両方
     書き終わると 1日 1回 50 Arc。最後に受領した日付を保持してこれを
     gate にする。プロファイル doc にミラーされる。 */
  const [lastDailyReportRewardDate, setLastDailyReportRewardDate] = useState<string>("");
  /* Poker chip economy. `pokerChips` is the "normal" currency you buy
     by spending Arc (1 Arc → 100 chips). `focusChips` are the
     better-paying chips you earn by staying in a workspace room (25
     min → 1 chip, capped at 8/day). Both are mirrored to the profile
     doc through the existing debounced save path. */
  const [pokerChips, setPokerChips] = useState<number>(0);
  const [focusChips, setFocusChips] = useState<number>(0);
  const [focusChipsDate, setFocusChipsDate] = useState<string>("");
  const [focusStayMinutesSnapshot, setFocusStayMinutesSnapshot] = useState<number>(0);
  // Organization (tenant) state. `currentOrganization` mirrors the
  // joined org doc; the user's role + denormalized name sit on the
  // user profile but we cache the live doc here for use in settings.
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [orgError, setOrgError] = useState<string>("");
  const [orgInviteToken, setOrgInviteToken] = useState<string>("");
  const [isOrgWorking, setIsOrgWorking] = useState<boolean>(false);
  // Stripe Checkout / Portal への遷移中フラグ。組織管理(isOrgWorking)とは
  // 別にして、teams ビューの課金ボタンだけを無効化できるようにする。
  const [billingBusy, setBillingBusy] = useState<boolean>(false);
  const [newOrgName, setNewOrgName] = useState<string>("");
  // Teams ランディングの「組織を作って始める」用の軽量モーダル。設定
  // パネルの奥までスクロールさせずに、その場で組織名→作成まで完結させる。
  const [isOrgCreateOpen, setIsOrgCreateOpen] = useState<boolean>(false);
  // Admin dashboard (Phase 2) — owner-only modal with members list,
  // aggregate metrics, CSV export. Members are loaded on demand
  // (not on every settings open) since the query is per-org.
  const [isOrgAdminOpen, setIsOrgAdminOpen] = useState<boolean>(false);
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberRecord[]>([]);
  const [isLoadingOrgMembers, setIsLoadingOrgMembers] = useState<boolean>(false);
  const [orgAdminError, setOrgAdminError] = useState<string>("");
  // Slack integration editor state — local copies so the input
  // doesn't lose focus mid-typing, then committed via the save
  // button. Initialised when the admin modal opens.
  const [slackDraftUrl, setSlackDraftUrl] = useState<string>("");
  const [slackDraftRoomJoins, setSlackDraftRoomJoins] = useState<boolean>(false);
  const [slackDraftRoomLeaves, setSlackDraftRoomLeaves] = useState<boolean>(false);
  const [slackDraftBreakStarted, setSlackDraftBreakStarted] = useState<boolean>(false);
  const [slackDraftRecruitments, setSlackDraftRecruitments] = useState<boolean>(false);
  const [slackDraftPosts, setSlackDraftPosts] = useState<boolean>(false);
  const [slackDraftDailyDigest, setSlackDraftDailyDigest] = useState<boolean>(false);
  const [slackSaveState, setSlackSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [slackSaveMessage, setSlackSaveMessage] = useState<string>("");
  // Audit log state — Phase 5. Tab switcher between members and
  // audit, plus a separate loading flag so the two queries can fire
  // independently.
  const [orgAdminTab, setOrgAdminTab] = useState<"members" | "audit">("members");
  const [orgAuditLogs, setOrgAuditLogs] = useState<AuditLogRecord[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);
  // Domain auto-join — Phase 7. discoveredOrgs holds any orgs that
  // have opted in for the current user's email domain. domainDraft
  // is the comma/newline-separated edit field in the admin modal.
  const [discoveredOrgs, setDiscoveredOrgs] = useState<OrganizationRecord[]>([]);
  const [domainDraft, setDomainDraft] = useState<string>("");
  const [domainSaveState, setDomainSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [domainSaveMessage, setDomainSaveMessage] = useState<string>("");
  // Personal data management — Phase 8. Export status is purely
  // UI-feedback (the file download happens via blob URL). Delete
  // requires a two-step confirmation: the user has to type their
  // userId before the cascade runs.
  const [isExportingData, setIsExportingData] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");
  // Records the token we've already attempted to auto-claim so a
  // re-render after the successful accept doesn't fire the call a
  // second time.
  const autoJoinAttemptedRef = useRef<string>("");

  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [customRooms, setCustomRooms] = useState<WorkspaceRoom[]>([]);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  // 退出忘れ対策の作業時間トラッキング。lastWorkspaceActivityRef は最後にユーザーが
  // 操作した時刻（EXP はここまでで確定）、closeWorkspaceSessionRef は在室上限の監視
  // effect から最新の closeWorkspaceSession を呼ぶための参照。
  const lastWorkspaceActivityRef = useRef(Date.now());
  const closeWorkspaceSessionRef = useRef<
    (roomId: string, options?: { auto?: boolean; overrideMinutes?: number }) => void
  >(() => {});
  const [newRoomName, setNewRoomName] = useState("");
  // モバイル時の "+ 部屋を作る" 折り畳み state。デフォルト false で
  // 作成フォームを隠しておく ── 初見ユーザーが画面に圧倒されないよう
  // 段階的に表示する設計。PC 側は CSS で常に展開済みにする。
  const [isRoomCreatorOpen, setIsRoomCreatorOpen] = useState(false);
  /* Visibility picker for the new-room form. Defaults to public so
     the existing UX (anyone can find your room) is unchanged for solo
     users; org members get the "組織のみ" option which scopes the
     room to their tenant. */
  const [newRoomVisibility, setNewRoomVisibility] = useState<"public" | "org">("public");
  const [roomCreateState, setRoomCreateState] = useState<RoomCreateState>("idle");
  const [roomCreateMessage, setRoomCreateMessage] = useState("");
  const [isRefreshingLobby, setIsRefreshingLobby] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState("");
  const [editingRoomName, setEditingRoomName] = useState("");
  const [workspaceTask, setWorkspaceTask] = useState("");
  const [workspaceDraftTask, setWorkspaceDraftTask] = useState("");
  const [workspaceDraftColor, setWorkspaceDraftColor] = useState(studyColorOptions[0].value);
  const [workspaceStartError, setWorkspaceStartError] = useState("");
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [workspaceNow, setWorkspaceNow] = useState(Date.now());
  /* setter のみ使用 (退室時のセッション記録)。表示 UI は撤去済みだが、
     セッション確定処理が setLastRoomSession を呼ぶ構造は維持する。 */
  const [, setLastRoomSession] = useState<WorkspaceSessionHistory | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 18, y: 72 });
  const [isPlayerWalking, setIsPlayerWalking] = useState(false);
  const [workspaceBubble, setWorkspaceBubble] = useState("");
  /* Rolling chat log of recently-sent preset messages. The per-actor
     bubble above each avatar still fades after a few seconds; this
     log keeps the last dozen messages around so you can catch up on
     what was said while you were focused. Entries are appended as
     soon as a member's synced `bubble` field flips to a value newer
     than what we've already logged for that user. */
  const [presetLog, setPresetLog] = useState<PresetLogEntry[]>([]);
  const lastLoggedBubbleAtRef = useRef<Map<string, number>>(new Map());
  const [workspacePresetMessages, setWorkspacePresetMessages] = useState(defaultWorkspacePresetMessages);
  const [openedWorkspaceGiftLevels, setOpenedWorkspaceGiftLevels] = useState<number[]>([]);
  const [posts, setPosts] = useState<ContributionPostRecord[]>([]);
  // Draft is hydrated from localStorage so that switching views or closing
  // the quick-capture modal (⌘K) never silently throws away what the user
  // was typing. Cleared explicitly on successful submit.
  /* 投稿の下書き。以前は "contribution-arc:post-draft" の uid 非依存キーで
     localStorage に書き戻していたため、同一ブラウザで A → B にアカウント
     切替した時に A の下書きが B の投稿フォームに残るリークがあった。
     初期値は常に空で、uid 確定後の useEffect で uid scope キーから復元する。 */
  const [postDraft, setPostDraft] = useState("");
  /* postDraft の per-uid 永続化。ログアウト時はクリア。 */
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      if (postDraft) {
        localStorage.setItem(`ca:post-draft:${currentUser.uid}`, postDraft);
      } else {
        localStorage.removeItem(`ca:post-draft:${currentUser.uid}`);
      }
      // レガシー uid 非依存キーは害があるので削除しておく
      localStorage.removeItem("contribution-arc:post-draft");
    } catch {
      /* ignore */
    }
  }, [postDraft, currentUser?.uid]);
  const [postError, setPostError] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"following" | "all">("all");
  /* ホームフィードの種別フィルタ。範囲 (Following/All) と直交する軸。
     旧設計: 「投稿 / 学習の記録」の 2 軸セグメントだったが、全部 1 つの
     フィードに統合する方針に変更。 setFeedKindFilter は未使用化。 */
  const [workspaceRecruitments, setWorkspaceRecruitments] = useState<WorkspaceRecruitmentRecord[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<WorkspaceInviteRecord[]>([]);
  const [feedNowTick, setFeedNowTick] = useState(() => Date.now());
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const [isRecruitmentModalOpen, setIsRecruitmentModalOpen] = useState(false);
  const [recruitmentDraft, setRecruitmentDraft] = useState<{
    mode: "now" | "scheduled";
    durationMinutes: number;
    message: string;
    scheduledAt: string;
  }>(() => ({ mode: "now", durationMinutes: 60, message: "", scheduledAt: "" }));
  const [recruitmentError, setRecruitmentError] = useState("");
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [sharedDailyReports, setSharedDailyReports] = useState<DailyReport[]>([]);
  /* Team Daily の lazy load 状態。
     - isSharedDailyLoaded: ユーザーが "読み込む" を 1 度でも踏んだか
     - isLoadingSharedDaily: 取得 in-flight
     初回マウントの自動 fetch は廃止し、ボタン押下時に limit(100) で
     一括取得する。 */
  const [isSharedDailyLoaded, setIsSharedDailyLoaded] = useState(false);
  /* みんなの日報の表示件数。デフォルト 12 → 「もっと見る」で +12 ずつ。
     fetch は別途 limit(100) 取得しているので、ここはあくまで描画件数。
     画面切替などでスクロール位置が大きく初期化されないよう state で保持。 */
  const SHARED_DAILY_PAGE_SIZE = 12;
  const [sharedDailyDisplayLimit, setSharedDailyDisplayLimit] = useState(SHARED_DAILY_PAGE_SIZE);
  const [isLoadingSharedDaily, setIsLoadingSharedDaily] = useState(false);
  const [sharedDailyLoadError, setSharedDailyLoadError] = useState("");
  const [selectedDailyDate, setSelectedDailyDate] = useState(getLearnerDate());
  const [dailyPlanItemsDraft, setDailyPlanItemsDraft] = useState<PlanItem[]>([]);
  const [dailyReflectionPartsDraft, setDailyReflectionPartsDraft] = useState<ReflectionParts>(
    makeEmptyReflectionParts,
  );
  const [dailyHistoryDateFilter, setDailyHistoryDateFilter] = useState("");
  const [dailyHistorySearch, setDailyHistorySearch] = useState("");
  // 右パネルのセグメントタブ: "mine" = 自分の過去日報 / "team" = みんなの日報。
  // 性質の違う 2 リストを縦積みせず切替式にして、Team Daily の発見性を上げる。
  const [dailyHistoryTab, setDailyHistoryTab] = useState<"mine" | "team">("mine");
  /* 自分の日報リストは未展開時は直近 7 日分のみ。"もっと見る" を押すと
     全件 (最大 50) まで広げる。リスト全体が常に長く伸びてスクロール
     負担になっていたのを抑える。 */
  const [showAllMyReports, setShowAllMyReports] = useState(false);
  // 他ユーザーのプロフィールカードの ⋯(その他)メニュー開閉。ブロック等の
  // 破壊的アクションを主要動線から隠してここに収める。常に1ユーザー分の
  // カードしか表示しないので単一の boolean で足りる。
  const [profileActionsMenuOpen, setProfileActionsMenuOpen] = useState(false);
  // Modal state for the "tap a past daily report" → expanded detail
  // view in the Team Daily feed. Stores the full report; we look up
  // study/commit data for that date on the fly when rendering.
  const [expandedDailyReport, setExpandedDailyReport] = useState<DailyReport | null>(null);
  /* 投稿の詳細モーダル。フィードカードの本文をタップで開く。 */
  const [expandedPost, setExpandedPost] = useState<ContributionPostRecord | null>(null);
  // PC など Web Share(ファイル)非対応環境で「画像で共有」を押したときの
  // プレビューモーダル。生成済み PNG を保存 / クリップボードにコピーできる。
  const [dailySharePreview, setDailySharePreview] = useState<{
    url: string;
    blob: Blob;
    filename: string;
  } | null>(null);
  const [dailyMessage, setDailyMessage] = useState("");
  /* dailyMessage は手動でクリアしないと画面に残り続けて視覚ノイズ
     になっていた。空でない値が入ったら 4 秒後に自動で消す。同じ
     副作用で次のメッセージが来たら前のタイマーをキャンセル。 */
  useEffect(() => {
    if (!dailyMessage) return;
    const id = window.setTimeout(() => setDailyMessage(""), 4000);
    return () => window.clearTimeout(id);
  }, [dailyMessage]);
  const [isSavingDailyReport, setIsSavingDailyReport] = useState(false);
  /* Phase 10a: 下書きモード. When true, the next save persists locally
     only (no Firestore write). Defaulting to false keeps the published
     flow as the path of least resistance — drafting is an explicit
     opt-in for in-progress notes the writer doesn't want the team to
     see yet. Resets to the loaded report's flag on date change. */
  const [dailyIsDraftDraft, setDailyIsDraftDraft] = useState(false);
  const [postReplies, setPostReplies] = useState<ContributionReplyRecord[]>([]);
  // Live appearance (shape + color) for every non-self author visible in
  // the feed / replies / daily reports, keyed by uid. Posts only snapshot
  // the color at write time and never the shape, so to make an avatar
  // mirror its author's *currently equipped* character we resolve it from
  // their live profile here. localStorage に前回 fetch の結果をキャッシュ
  // しておくことで、リロード直後から live 色で sprite が描画される。
  // これがないと「最初に snapshot 色 (古い色) → fetch 完了で live 色」の
  // 2 段階チラつきが毎リロードで発生し、ユーザーから「リロードのたびに
  // 他人の色が変わる」と見える。
  const [authorAppearances, setAuthorAppearances] = useState<
    Record<string, AuthorAppearance>
  >(() => {
    try {
      const raw = window.localStorage.getItem("ca:author-appearances");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const fetchedAppearanceIdsRef = useRef<Set<string>>(new Set());

  // authorAppearances が変わるたびに localStorage へ書き戻す。容量爆発を
  // 防ぐため直近 200 件まで（最後に書いた author を優先）に絞る。
  useEffect(() => {
    try {
      const entries = Object.entries(authorAppearances);
      const trimmed = Object.fromEntries(entries.slice(-200));
      window.localStorage.setItem("ca:author-appearances", JSON.stringify(trimmed));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [authorAppearances]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyError, setReplyError] = useState("");
  const [openReplyPostIds, setOpenReplyPostIds] = useState<Set<string>>(() => new Set());
  const [likeBurstPostId, setLikeBurstPostId] = useState<string | null>(null);
  const [dailyPromptDraft, setDailyPromptDraft] = useState("");
  const [dailyPromptDismissedFor, setDailyPromptDismissedFor] = useState<string>("");
  const [isSavingDailyPrompt, setIsSavingDailyPrompt] = useState(false);
  const [dailyPromptError, setDailyPromptError] = useState("");
  const [isDesktopWelcomeVisible, setIsDesktopWelcomeVisible] = useState(true);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData>(emptyKnowledgeGraph);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState("");
  const [hoveredKnowledgeId, setHoveredKnowledgeId] = useState("");
  const [knowledgePositions, setKnowledgePositions] = useState<Record<string, { x: number; y: number }>>({});
  const pressedWorkspaceKeysRef = useRef<Set<string>>(new Set());
  // Walk-state ref mirrors `isPlayerWalking` so the walk loop can read
  // the current value without a stale-closure capture, and so keydown
  // can flip the class in the same frame the key was pressed instead
  // of waiting for the next rAF tick to notice the change.
  const isPlayerWalkingRef = useRef(false);
  // タップ移動の目的地（ステージ内座標 %）。スマホ向けに「ステージ床
  // をタップしたらそこへ歩く」操作を実装するための ref。WASD と同じ
  // walk loop 内で処理され、目的地まで毎フレーム補間して移動する。
  // キー入力があれば即座にキャンセル（WASD 優先）。
  const tapWalkTargetRef = useRef<{ x: number; y: number } | null>(null);
  // タップ移動した時の "ここに行きます" マーカー。視覚フィードバック用に
  // 短時間（~1.5s）だけステージに ring を表示する。id でリセット可能。
  const [tapWalkMarker, setTapWalkMarker] = useState<{
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const syncedRoomPositionRef = useRef<string | null>(null);
  const isApplyingRemoteRoomsRef = useRef(false);
  const lastSyncedWorkspaceRoomsRef = useRef("");
  // Cost control: the user-progress effect has ~15 deps, several of which are
  // arrays (following, openedWorkspaceGiftLevels) whose *reference* flips on
  // every Firestore snapshot even when contents are identical. Without dedup
  // we burn 2 writes (users/{uid} + githubActivities/{uid}-summary) per tick.
  // These refs hold a JSON signature of the last successful write so we can
  // short-circuit identical follow-ups. Cleared implicitly on full reload.
  const lastSyncedUserProgressRef = useRef("");
  const lastSyncedGithubActivityRef = useRef("");
  const pendingWorkspaceRoomsRef = useRef<Map<string, WorkspaceRoom>>(new Map());
  const cleanedLegacyWorkspaceRoomsRef = useRef<Set<string>>(new Set());
  /* 解体ボタンを押した room id を残し、applyRemoteRooms など全ての
     再ハイドレーション経路で必ず無視する。delete の cloud 反映が
     遅延中に lobby fetch / onSnapshot で「亡霊部屋」が復活する
     経路 (報告: 何度解体しても残る) を完全に塞ぐ。session 中のみ
     有効で、リロードでクリア (= 真に Firestore から消えれば消える)。 */
  const deletedWorkspaceRoomIdsRef = useRef<Set<string>>(new Set());
  const remoteWorkspaceRoomsRef = useRef<{ rooms: WorkspaceRoom[]; legacyRooms: WorkspaceRoom[] }>({
    rooms: [],
    legacyRooms: [],
  });
  // True once the lobby (all-rooms) snapshot has been fetched for the current
  // workspace-open session. Reset when the user leaves the workspace view so
  // re-entering pulls a fresh lobby. While inside the workspace, the lobby is
  // only refreshed when the user presses the manual refresh button — there is
  // no live all-rooms subscription anymore.
  const lobbyFetchedRef = useRef(false);
  const didRequestStudyLogMigrationRef = useRef(false);
  const didRequestDailyReportMigrationRef = useRef(false);
  const seenNotificationKeysRef = useRef<Set<string>>(new Set());
  const notificationCooldownRef = useRef<Record<string, number>>({});
  const lastNotificationSoundAtRef = useRef(0);
  // FEED の post に対する like 通知用。すでに見た (postId, likerUid)
  // ペアを保持し、初回ハイドレート時の bulk 通知を抑制する。
  // 連続 like/unlike では同 id で upsert するので、Set への add 自体は
  // しない (= 何度でも upsert 通知を発火可能)。一方、初回 hydrate 時に
  // 既存 like を全部 "seen" として登録し、起動直後にずらっと通知が出る
  // 事故を防ぐ。
  // 前回 render での "post id → likedUserIds の Set" スナップショット。
  // 差分検出で「新しく like を付けた瞬間」のみ通知を発火する。
  // unlike → 通知発火しない (既存通知はそのまま残る)
  // re-like → 前回 (= unlike 後) には居なかった likerUid が現れる →
  //          upsertAppNotification で同 id を最新位置に置き換える
  // この設計により「連続で like/unlike を繰り返しても最新の 1 通知
  // だけが残る」を実現する。
  const prevLikedSnapshotRef = useRef<Map<string, Set<string>>>(new Map());
  const likeNotificationsInitializedRef = useRef(false);
  const notificationBootedRef = useRef(false);
  const notificationStartedAtRef = useRef(Date.now());

  /* Capture a ?join-org=<token> URL parameter on the very first
     render. Stash it in state so it survives any sign-in redirect on
     a fresh session; the auto-accept effect below claims it once the
     user is authenticated. Also handles the marketing-friendly
     ?view=teams short-link by switching the app to the B2B landing
     view immediately, regardless of auth state — that page is the
     prospect-facing pitch surface and must render pre-sign-in. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("join-org");
      if (token) setOrgInviteToken(token);
      const view = url.searchParams.get("view");
      if (view === "teams") {
        setCurrentViewRaw("teams");
      }
    } catch {
      /* ignore malformed URLs */
    }
  }, []);

  /* Auto-accept the captured invite token once the user is signed in.
     Inlined (rather than calling handleAcceptOrgInvite) so the effect
     doesn't get tangled in stale-closure issues with the handler.
     The autoJoinAttemptedRef makes the call idempotent so a re-render
     after a successful accept doesn't fire it again. */
  useEffect(() => {
    if (!orgInviteToken || !currentUser) return;
    if (autoJoinAttemptedRef.current === orgInviteToken) return;
    autoJoinAttemptedRef.current = orgInviteToken;
    const token = orgInviteToken;
    void acceptOrganizationInvite(db, token, currentUser.uid, playerName || currentUser.displayName || "Developer")
      .then((org) => {
        setCurrentOrganization(org);
        setOrgInviteToken("");
        showToast(t("「{name}」に参加しました", { name: org.name }), { kind: "success" });
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("join-org");
          window.history.replaceState({}, "", url.toString());
        } catch {
          /* ignore */
        }
      })
      .catch((error) => {
        const code = (error as Error)?.message || "";
        const message =
          code === "INVITE_NOT_FOUND"
            ? t("招待リンクが見つかりません。")
            : code === "INVITE_EXPIRED"
              ? t("招待リンクの有効期限が切れています。")
              : code === "INVITE_EXHAUSTED"
                ? t("この招待リンクは上限まで使用されています。")
                : t("組織への参加に失敗しました。");
        setOrgError(message);
      });
  }, [orgInviteToken, currentUser]);

  /* Load organization members when manager view is opened.
     Only org owners can access the manager dashboard. */
  useEffect(() => {
    if (currentView !== "manager" || !currentOrganization) return;
    if (currentUser?.uid !== currentOrganization.ownerUid) return;
    if (orgMembers.length > 0 && !isLoadingOrgMembers) return; // Already loaded

    setIsLoadingOrgMembers(true);
    listOrganizationMembers(db, currentOrganization.id)
      .then((members) => {
        setOrgMembers(members);
      })
      .catch((error) => {
        console.warn("Failed to load org members for manager dashboard", error);
        setOrgAdminError(t("メンバー一覧を読み込めませんでした。"));
      })
      .finally(() => {
        setIsLoadingOrgMembers(false);
      });
  }, [currentView, currentOrganization, currentUser?.uid]);

  /* One-time, member-side backfill of organizationId onto pre-rollout
     study logs. Every org member runs this once so the owner's Manager
     Dashboard sees their full history rather than only logs created
     after the org-stamping rollout. Guarded by a per-(user,org)
     localStorage marker so it never re-runs — honoring the project's
     write-dedup discipline (no repeated batch writes on every load). */
  useEffect(() => {
    const uid = currentUser?.uid;
    const orgId = currentOrganization?.id;
    if (!uid || !orgId) return;
    const marker = `contribution-arc-orgstamp-${uid}-${orgId}`;
    let alreadyDone = false;
    try {
      alreadyDone = window.localStorage.getItem(marker) === "done";
    } catch {
      /* private mode / storage disabled — fall through and run once */
    }
    if (alreadyDone) return;
    safeSetLocalStorage(marker, "done");
    void backfillStudyLogOrganizationId(db, uid, orgId).catch((error) => {
      // Non-fatal: future logs still stamp via the write path. Clear the
      // marker so a later session can retry the historical backfill.
      try {
        window.localStorage.removeItem(marker);
      } catch {
        /* ignore */
      }
      console.warn("Study log org backfill skipped.", error);
    });
  }, [currentUser?.uid, currentOrganization?.id]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      didRequestStudyLogMigrationRef.current = false;
      didRequestDailyReportMigrationRef.current = false;
      cleanedLegacyWorkspaceRoomsRef.current = new Set();
      remoteWorkspaceRoomsRef.current = { rooms: [], legacyRooms: [] };
      setIsWorkspaceLoaded(false);
      // 起動 / リロード / sign in 直後の初期 view。ユーザー要望で新ホーム =
      // feed (旧投稿) を最初に見せる仕様に変更。
      setCurrentView("feed");
      setProfileMember(null);
      setProfileUser(null);
      setOnboardingStep("idle");
      /* ログアウト時は cross-device 同期 state も明示クリア。次のユーザーが
         前のユーザーのスタンプを引きずって payload に書いてしまう事故を防ぐ。 */
      setCloudOnboardingCompletedAt("");
      setIsSettingsOpen(false);
      setIsSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setWorkspaceProfiles({});
      setSearchError("");
      setStudyLogs(defaultStudyLogs);
      setLearningItems([]);
      setCustomUserName("");
      setDraftUserName("");
      setUserId("");
      setDraftUserId("");
      setSettingsError("");
      setFollowing([]);
      setFriends([]);
      setFriendRequests([]);
      setIncomingInvites([]);
      setInvitedFriendUids(new Set());
      setIsFriendsModalOpen(false);
      setFriendMessage("");
      setIsNotificationsOpen(false);
      setLastNotificationReadAt("");
      setAppNotifications([]);
      setDesktopNotificationSettings(defaultDesktopNotificationSettings);
      seenNotificationKeysRef.current = new Set();
      notificationCooldownRef.current = {};
      lastNotificationSoundAtRef.current = 0;
      notificationBootedRef.current = false;
      notificationStartedAtRef.current = Date.now();
      setDetermination("");
      setDraftDetermination("");
      setPlayerAvatar("");
      setPlayerCharacterColor(characterColorOptions[0].value);
      setSelectedRoomId("");
      setCustomRooms([]);
      setRoomCreateState("idle");
      setRoomCreateMessage("");
      setPendingJoinRoomId(null);
      setWorkspaceStartError("");
      setLastRoomSession(null);
      setWorkspaceTask("");
      setWorkspaceDraftTask("");
      setWorkspacePresetMessages(defaultWorkspacePresetMessages);
      setOpenedWorkspaceGiftLevels([]);
      setPosts([]);
      setPostDraft("");
      setPostError("");
      setIsPosting(false);
      setDailyReports([]);
      setSharedDailyReports([]);
      setIsSharedDailyLoaded(false);
      setIsLoadingSharedDaily(false);
      setSharedDailyLoadError("");
      setSelectedDailyDate(getLearnerDate());
      setDailyPlanItemsDraft([]);
      setDailyReflectionPartsDraft(makeEmptyReflectionParts());
      setDailyHistoryDateFilter("");
      setDailyHistorySearch("");
      setDailyMessage("");
      setIsSavingDailyReport(false);
      setPostReplies([]);
      setReplyDrafts({});
      setReplyError("");
      setOpenReplyPostIds(new Set());
      setLikeBurstPostId(null);
      setDailyPromptDraft("");
      setDailyPromptDismissedFor("");
      setIsSavingDailyPrompt(false);
      setDailyPromptError("");
      setIsDesktopWelcomeVisible(true);
      setKnowledgeGraph(emptyKnowledgeGraph);
      setSelectedKnowledgeId("");
      setHoveredKnowledgeId("");
      setKnowledgePositions({});
      setWorkspaceBubble("");
      setPlayerPosition({ x: 18, y: 72 });
      setCurrentUser(user);
      setIsAuthReady(true);
    });
  }, []);

  // Safety net for users whose previous session went through the now-
  // removed `signInWithRedirect` path. `getRedirectResult` resolves on
  // mount with whatever the SDK stashed during a redirect — for fresh
  // popup-based sessions it's a no-op (`result === null`). Without this,
  // anyone mid-redirect during the deploy could get stuck at the login
  // screen forever. Safe to leave in even after the redirect callers
  // are gone; the cost is one synchronous SDK call per page load.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        const pendingProvider =
          window.sessionStorage.getItem("ca:pending-oauth-provider") || "";
        window.sessionStorage.removeItem("ca:pending-oauth-provider");
        if (pendingProvider === "github") {
          const additional = getAdditionalUserInfo(result);
          const login = (additional?.profile as { login?: string } | null | undefined)?.login;
          if (login && result.user.uid) {
            try {
              window.localStorage.setItem(`ca:gh-login:${result.user.uid}`, login);
            } catch {
              /* storage disabled — fall back to displayName/userId */
            }
          }
        }
      })
      .catch((error) => {
        console.error("OAuth redirect result failed.", error);
      });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    // Fresh account load: allow the cloud profile to hydrate the avatar.
    // Any in-session pick re-locks this via chooseCharacterColor/Shape.
    characterChoiceLockedRef.current = false;
    // Block the profile-sync write until the cloud profile has loaded, so
    // the pre-hydration state can't flush a stale/empty determination back
    // to Firestore. Re-enabled in the getDoc `.finally` below.
    setIsProfileHydrated(false);

    const savedUserId = window.localStorage.getItem(`contribution-arc-user-id-${currentUser.uid}`);
    const accountScope = getAccountStorageScope(currentUser.uid, savedUserId || "");
    const shouldUseLegacyUserStorage = !savedUserId;
    const savedLogs =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "study")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-study-${currentUser.uid}`) : null);
    const savedUserName =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "name")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-name-${currentUser.uid}`) : null);
    const savedDetermination =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "determination")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-determination-${currentUser.uid}`) : null);
    /* 目標 (志望校 / 資格) を localStorage にもミラーする。cloud read の
       タイミング / 失敗に左右されず、この端末では確実に残すための保険。
       goal-updated-at は「ローカルが新しければ cloud より優先」判定用。 */
    const savedGoalId =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "goal-id")) || "";
    const savedGoalCustomName =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "goal-custom-name")) || "";
    const savedGoalStampRaw = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "goal-updated-at"),
    );
    const savedAvatar =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "avatar")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-avatar-${currentUser.uid}`) : null);
    const savedCharacterColor =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "character-color")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-character-color-${currentUser.uid}`) : null);
    const savedCharacterShape = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "character-shape"),
    );
    /* 所有 shape のローカルキャッシュ。これが無い (= 未確認) 状態で
       characterShape が "robo" 等の有料を指していたら、ユーザーが
       localStorage を改ざんした可能性が高いので "default" に落とす。
       cloud 同期が後で正しい所有リストで上書きするので safe。 */
    const savedOwnedShapesRaw = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "owned-character-shapes"),
    );
    const savedOwnedShapes: CharacterShape[] = (() => {
      if (!savedOwnedShapesRaw) return ["default"];
      try {
        const parsed = JSON.parse(savedOwnedShapesRaw);
        if (Array.isArray(parsed)) {
          return Array.from(
            new Set<CharacterShape>([
              "default",
              ...parsed.map((value: unknown) => getSafeCharacterShape(value)),
            ]),
          );
        }
      } catch {
        /* corrupted — fall through */
      }
      return ["default"];
    })();
    const savedFriends =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "friends")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-friends-${currentUser.uid}`) : null);
    const savedFriendRequests = window.localStorage.getItem(getFriendRequestsStorageKey(accountScope));
    const savedNotificationReadAt = window.localStorage.getItem(getAccountStorageKey(accountScope, "notifications-read-at"));
    const savedOnboardingComplete = window.localStorage.getItem(`contribution-arc-onboarding-complete-${currentUser.uid}`);
    const savedRoomId =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "room")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-room-${currentUser.uid}`) : null);
    const workspaceRoomsStorageKey = sharedWorkspaceRoomsStorageKey;
    const savedRooms = window.localStorage.getItem(workspaceRoomsStorageKey);
    const savedWorkspaceTask =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "workspace-task")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-workspace-task-${currentUser.uid}`) : null);
    const savedWorkspacePresetMessages = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "workspace-preset-messages"),
    );
    const savedOpenedWorkspaceGiftLevels = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "workspace-opened-gift-levels"),
    );
    const savedKnowledgeGraph =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "knowledge-graph")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-knowledge-graph-${currentUser.uid}`) : null);
    const legacyRooms = shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-rooms-${currentUser.uid}`) : null;
    const parsedRooms = savedRooms
      ? (JSON.parse(savedRooms) as WorkspaceRoom[]).map(normalizeWorkspaceRoom)
      : [];
    if (!savedRooms && legacyRooms) {
      (JSON.parse(legacyRooms) as WorkspaceRoom[]).map(normalizeWorkspaceRoom).forEach((room) => {
        parsedRooms.push(room);
      });
    }
    const presenceResetKey = getAccountStorageKey(
      accountScope,
      `workspace-presence-reset-${workspacePresenceResetVersion}`,
    );
    const shouldResetPresence = !window.localStorage.getItem(presenceResetKey);
    const seededRooms = cleanWorkspacePresenceForUser(
      shouldResetPresence
        ? removeWorkspacePresenceForUser(seedWorkspaceRooms(parsedRooms), currentUser.uid)
        : seedWorkspaceRooms(parsedRooms),
      currentUser.uid,
    );
    if (shouldResetPresence) {
      safeSetLocalStorage(presenceResetKey, "true");
    }
    if (savedLogs) {
      setStudyLogs(removeSeedStudyLogs(JSON.parse(savedLogs) as StudyLog[]));
    } else {
      setStudyLogs(defaultStudyLogs);
    }
    setCustomUserName(savedUserName || "");
    setDraftUserName(savedUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
    setUserId(savedUserId || "");
    setDraftUserId(savedUserId || "");
    setSettingsError("");
    setFriendMessage("");
    setLastNotificationReadAt(savedNotificationReadAt || "");
    setDesktopNotificationSettings(readDesktopNotificationSettings(accountScope));
    setAppNotifications(readAppNotifications(accountScope));
    try {
      const storedAutoPost = window.localStorage.getItem(`ca:auto-post-enabled:${currentUser.uid}`);
      setIsAutoPostEnabled(storedAutoPost === null ? true : storedAutoPost !== "false");
    } catch {
      setIsAutoPostEnabled(true);
    }
    setFriends(savedFriends ? (JSON.parse(savedFriends) as FriendPreview[]) : []);
    setFriendRequests(
      savedFriendRequests
        ? (JSON.parse(savedFriendRequests) as FriendRequest[]).map((request) => ({
            ...request,
            direction: request.direction || "outgoing",
          }))
        : [],
    );
    setDetermination(savedDetermination || "");
    setDraftDetermination(savedDetermination || "");
    /* cloud 解決前でも localStorage の目標を先に反映して、設定済みなら
       即チップが出る & cloud 失敗時もこの端末では残る。 */
    setGoalId(savedGoalId);
    setGoalCustomName(savedGoalCustomName);
    setPlayerAvatar(savedAvatar || currentUser.photoURL || "");
    setPlayerCharacterColor(savedCharacterColor || characterColorOptions[0].value);
    /* 起動直後はローカル所有キャッシュ (savedOwnedShapes) を信用源にする。
       cloud 未取得の段階で localStorage 改ざんで非所持の shape を装着
       させない。cloud 取得後に正しい所有リストで上書きされる。 */
    setOwnedCharacterShapes(savedOwnedShapes);
    const hydratedShape = getSafeCharacterShape(savedCharacterShape);
    setPlayerCharacterShape(
      savedOwnedShapes.includes(hydratedShape) ? hydratedShape : "default",
    );
    setCustomRooms(seededRooms);
    if (savedRoomId && seededRooms.some((room) => room.id === savedRoomId)) {
      setSelectedRoomId(savedRoomId);
    } else if (seededRooms[0]) {
      setSelectedRoomId(seededRooms[0].id);
    } else {
      setSelectedRoomId("");
    }
    const initialWorkspaceTask = savedWorkspaceTask === "React" ? "" : savedWorkspaceTask || "";
    setWorkspaceTask(initialWorkspaceTask);
    setWorkspaceDraftTask(initialWorkspaceTask);
    setWorkspaceDraftColor(studyColorOptions[0].value);
    setWorkspacePresetMessages(
      savedWorkspacePresetMessages
        ? [
            ...(JSON.parse(savedWorkspacePresetMessages) as string[]).slice(0, 6),
            ...defaultWorkspacePresetMessages,
          ].slice(0, 6)
        : defaultWorkspacePresetMessages,
    );
    setOpenedWorkspaceGiftLevels(
      savedOpenedWorkspaceGiftLevels
        ? Array.from(
            new Set(
              (JSON.parse(savedOpenedWorkspaceGiftLevels) as unknown[])
                .map((level) => Number(level))
                .filter((level) => Number.isFinite(level) && level > 0),
            ),
          )
        : [],
    );
    setKnowledgeGraph(savedKnowledgeGraph ? (JSON.parse(savedKnowledgeGraph) as KnowledgeGraphData) : emptyKnowledgeGraph);
    setSelectedKnowledgeId("");
    setHoveredKnowledgeId("");
    setKnowledgePositions({});
    setIsWorkspaceLoaded(true);

    getDoc(doc(db, "users", currentUser.uid))
      .then((snapshot) => {
        let resolvedUserId = savedUserId || "";
        if (!snapshot.exists()) {
          if (!resolvedUserId) {
            // Brand-new account: start with language selection so
            // every subsequent onboarding screen is rendered in the
            // user's chosen language.
            setOnboardingStep("language");
          } else if (!savedOnboardingComplete) {
            safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
          }
          return;
        }

        const profile = normalizeUserProfile(currentUser.uid, snapshot.data() as Partial<UserProfile>);
        /* Adopt the cloud language preference ONLY when this device has
           no explicit choice yet. Otherwise, a debounced profile-sync
           write that hasn't landed could overwrite the user's just-saved
           choice on reload — the bug "英語で保存したのに日本語に戻される"
           is precisely this race. The local choice still propagates to
           cloud via the periodic sync, so other devices catch up. */
        if (profile.language && !hasExplicitStoredLanguage()) {
          setLanguage(profile.language);
        }
        /* cross-device 同期：cloud profile に pin/mute/block の uid 配列
           があれば適用。最初の "1 回読み" の time-of-flight 中に local
           で書いた差分は、profile 適用直後に union を取り直す形にして、
           PC とスマホで同時編集してもどちらかの追加が消えないようにする。 */
        if (Array.isArray(profile.pinnedFriendUids)) {
          setPinnedFriendUids((local) =>
            Array.from(new Set([...local, ...(profile.pinnedFriendUids || [])])).sort(),
          );
        }
        if (Array.isArray(profile.mutedFriendUids)) {
          setMutedFriendUids((local) =>
            Array.from(new Set([...local, ...(profile.mutedFriendUids || [])])).sort(),
          );
        }
        if (Array.isArray(profile.blockedFriendUids)) {
          setBlockedFriendUids((local) =>
            Array.from(new Set([...local, ...(profile.blockedFriendUids || [])])).sort(),
          );
        }
        if (profile.onboardingCompletedAt) {
          setCloudOnboardingCompletedAt(profile.onboardingCompletedAt);
        }
        resolvedUserId = profile.userId || resolvedUserId;
        setUserId(resolvedUserId);
        setDraftUserId(resolvedUserId);
        setCustomUserName(profile.displayName || savedUserName || "");
        setDraftUserName(profile.displayName || savedUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
        setFollowing(profile.following);
        setDetermination(profile.determination || savedDetermination || "");
        setDraftDetermination(profile.determination || savedDetermination || "");
        /* 目標の hydrate 競合対策: ローカル選択時刻 > cloud lastSyncedAt
           なら、cloud 反映前 / 書き込み失敗時でもローカルの最新選択を
           優先する（「設定して即リロード」しても消えない）。それ以外は
           cloud を採用し、cloud が空ならローカルにフォールバック。 */
        const cloudGoalStamp = profile.lastSyncedAt
          ? new Date(profile.lastSyncedAt).getTime()
          : 0;
        const localGoalStamp = savedGoalStampRaw ? Number(savedGoalStampRaw) : 0;
        const preferLocalGoal =
          Number.isFinite(localGoalStamp) && localGoalStamp > cloudGoalStamp;
        setGoalId(preferLocalGoal ? savedGoalId : profile.goalId || savedGoalId);
        setGoalCustomName(
          preferLocalGoal ? savedGoalCustomName : profile.goalCustomName || savedGoalCustomName,
        );
        setPlayerAvatar(profile.photoURL || savedAvatar || currentUser.photoURL || "");
        /* hydrate 競合対策: ローカル選択時刻 > cloud lastSyncedAt なら、
           cloud デバウンス未完了の最新ローカル選択を優先する。
           これで「変えて即リロード」しても戻らない。 */
        const localCharStampRaw = window.localStorage.getItem(
          getAccountStorageKey(accountScope, "character-updated-at"),
        );
        const localCharStamp = localCharStampRaw ? Number(localCharStampRaw) : 0;
        const cloudCharStamp = profile.lastSyncedAt
          ? new Date(profile.lastSyncedAt).getTime()
          : 0;
        const preferLocalChar =
          Number.isFinite(localCharStamp) && localCharStamp > cloudCharStamp;
        if (!characterChoiceLockedRef.current) {
          const fallbackColor = profile.characterColor || savedCharacterColor || characterColorOptions[0].value;
          setPlayerCharacterColor(
            preferLocalChar && savedCharacterColor ? savedCharacterColor : fallbackColor,
          );
        }
        // Shape ownership migration. ADMIN_EMAIL gets every silhouette plus
        // a generous coin grant (used to seed test purchases). Everyone
        // else has their owned set narrowed to whatever they legitimately
        // possess — only "default" by default, since pre-monetization
        // users could freely pick ghost/owl from settings. If they were
        // mid-wearing a non-owned shape, snap them back to "default".
        const ADMIN_EMAIL = "ari.initx@gmail.com";
        const isAdmin = (currentUser.email || "").toLowerCase() === ADMIN_EMAIL;
        // Honor the shapes the player actually owns. `ownedCharacterShapes`
        // is written to the profile only on purchase (see the shop), and is
        // already validated/deduped by normalizeUserProfile, so trusting it
        // here lets a bought silhouette survive a reload. The previous code
        // filtered this down to ["default"] on every load, which not only
        // snapped the equipped shape back to default but, via the write-back
        // effect, erased the purchase server-side too. Admins keep the full
        // set. The currently-equipped shape is folded in so a freshly
        // selected/purchased shape is never momentarily treated as unowned.
        const loadedOwned = profile.ownedCharacterShapes || ["default"];
        const loadedShape = getSafeCharacterShape(profile.characterShape || savedCharacterShape || "default");
        /* 所有判定は purchase の事実 (= ownedCharacterShapes フィールド)
           のみに基づく。以前は admin 自動付与 + loadedShape 自動付与で
           実質ロック無効状態だったので、購入していない shape は
           default に snap-back させる方針に変更。
           admin (= 開発者本人) もテスト時に正しくロック挙動を再現できる
           ように同じ判定を通す。coin 30k 付与だけは残して購入で確認可能に。 */
        const resolvedOwned: CharacterShape[] = Array.from(
          new Set<CharacterShape>(["default", ...loadedOwned]),
        );
        const safeShape: CharacterShape = resolvedOwned.includes(loadedShape) ? loadedShape : "default";
        const grantedCoins = isAdmin ? Math.max(profile.coins || 0, 30000) : profile.coins || 0;
        /* purchase 直後の reload で local の新規所持シルエットが cloud
           の stale な値に上書きされて消える事故を防ぐため、現在 state
           (localStorage hydrate 由来) と union してから採用する。 */
        setOwnedCharacterShapes((current) =>
          Array.from(new Set<CharacterShape>([...resolvedOwned, ...current])),
        );
        setCoins(grantedCoins);
        setLastFeedRewardDate(profile.lastFeedRewardDate || "");
        setFeedRewardArcEarned(profile.feedRewardArcEarned || 0);
        setLastDailyReportRewardDate(profile.lastDailyReportRewardDate || "");
        setPokerChips(profile.pokerChips ?? 0);
        setFocusChips(profile.focusChips ?? 0);
        setFocusChipsDate(profile.focusChipsDate ?? "");
        setFocusStayMinutesSnapshot(profile.focusStayMinutesSnapshot ?? 0);
        // Sync the GitHub login from the cloud profile so devices that
        // never went through the OAuth popup (e.g. mobile after the user
        // linked on desktop) still resolve the right username for the
        // contribution fetch. Mirror it to this device's localStorage too,
        // matching the cache key the sign-in path writes, so the render-time
        // resolver picks it up without a code-path special case.
        if (profile.githubUsername) {
          setSyncedGithubUsername(profile.githubUsername);
          safeSetLocalStorage(`ca:gh-login:${currentUser.uid}`, profile.githubUsername);
        }
        // Hydrate the live org doc if the profile says we're a member.
        // Failure is non-fatal — the user still has the denormalized
        // org name from their profile and can retry from settings.
        if (profile.organizationId) {
          void loadOrganization(db, profile.organizationId)
            .then((org) => {
              if (org) setCurrentOrganization(org);
            })
            .catch(() => {
              /* tolerate offline; settings can refresh later */
            });
        } else {
          setCurrentOrganization(null);
        }
        if (!characterChoiceLockedRef.current) {
          /* 同じく hydrate 競合対策: ローカル選択が cloud lastSyncedAt
             より新しければ、保存待ち (デバウンス中) のローカル値を採用。
             ただし所有していない shape は弾く (safeShape の owned 検査と
             整合させる)。 */
          const localShape = preferLocalChar
            ? getSafeCharacterShape(savedCharacterShape)
            : safeShape;
          const finalShape = resolvedOwned.includes(localShape) ? localShape : safeShape;
          setPlayerCharacterShape(finalShape);
        }
        setOpenedWorkspaceGiftLevels((levels) =>
          Array.from(new Set([...levels, ...(profile.openedWorkspaceGiftLevels || [])])).sort(
            (first, second) => first - second,
          ),
        );
        if (resolvedUserId) {
          safeSetLocalStorage(`contribution-arc-user-id-${currentUser.uid}`, resolvedUserId);
          /* cross-device 同期：cloud profile に onboardingCompletedAt が
             立っていれば、その新規デバイスではチュートリアル不要。 */
          const cloudOnboardingDone = !!(profile.onboardingCompletedAt && profile.onboardingCompletedAt.trim());
          if (cloudOnboardingDone) {
            setCloudOnboardingCompletedAt(profile.onboardingCompletedAt!);
            // 新規デバイスでも localStorage を mark し、次回からは fast-path
            safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
          }
          if (savedOnboardingComplete === "true" || cloudOnboardingDone) {
            setOnboardingStep("idle");
          } else if ((profile.determination || "").trim()) {
            // 既に 決意 が cloud に保存されている = firstPost は通過済み。
            // チュートリアル後半 (今日やることを書く) からの再開へ。
            setOnboardingStep("firstDailyPlan");
            setCurrentView("daily");
          } else {
            setOnboardingStep("firstPost");
            // 新ホーム (feed) で「最初の投稿」を書かせるためにそこへ遷移
            setCurrentView("feed");
          }
        } else if (!profile.language) {
          // Profile exists but has no language and no userId — treat
          // as fresh onboarding starting from language selection.
          setOnboardingStep("language");
        } else {
          setOnboardingStep("welcome");
        }
      })
      .catch(() => {
        if (!savedUserId) {
          setOnboardingStep("language");
        } else if (!savedOnboardingComplete) {
          safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
        }
      })
      // Cloud profile has settled (loaded, absent, or errored) — from here
      // the profile-sync effect may safely write, including the determination
      // we just hydrated from cloud/localStorage.
      .finally(() => {
        setIsProfileHydrated(true);
      });
    /* 依存は currentUser.uid と setLanguage に固定。currentUser の参照は
       auth token refresh / linkWithPopup 等で別オブジェクトに差し替わる
       ことがあり、参照変化のたびにこの effect が再走 →
       characterChoiceLockedRef=false → cloud hydrate でユーザーの選択が
       保存後でも勝手に元の値に戻る (キャラを変えても毎回戻される) 不具合
       の根本原因だったので、uid (本当のアカウント切替) でのみ走らせる。 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, setLanguage]);

  /* PC ↔ モバイル のキャラ反映ラグ対策 (realtime sync).
     これまで初回 getDoc で 1 回読みだけだったので、別端末で characterShape /
     characterColor を変えても、こちらでは reload するまで反映されなかった
     (報告: 「PC が古いキャラのまま」)。
     本人の user doc を onSnapshot で購読し、変更があれば
     character / coins / 所有 shape / 連動フィールドだけを差分反映する。
     プロフィール本体 (displayName / userId / following etc.) は初回 hydrate
     と専用 UI 編集が source of truth なので、ここでは "見た目に直結する
     軽量フィールド" だけに絞り、競合を最小化する。
     ローカルで chooseCharacter* が押された直後 (characterChoiceLockedRef=true)
     は cloud → local 上書きをスキップ (自分の選択が一瞬で戻る事故防止)。 */
  useEffect(() => {
    if (!currentUser) return;
    let didFirst = false;
    const unsub = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => {
        if (!snap.exists()) return;
        // 初回 snapshot は getDoc が既に同じ内容を applied しているのでスキップ。
        if (!didFirst) {
          didFirst = true;
          return;
        }
        const data = snap.data() as Partial<UserProfile>;
        const profile = normalizeUserProfile(currentUser.uid, data);
        const accountScope = getAccountStorageScope(currentUser.uid, userId);
        /* hydrate と同じ「ローカルが新しければ守る」ガード。 */
        const localStampRaw = window.localStorage.getItem(
          getAccountStorageKey(accountScope, "character-updated-at"),
        );
        const localStamp = localStampRaw ? Number(localStampRaw) : 0;
        const cloudStamp = profile.lastSyncedAt
          ? new Date(profile.lastSyncedAt).getTime()
          : 0;
        const cloudWinsForChar =
          !characterChoiceLockedRef.current &&
          (cloudStamp >= localStamp || !localStamp);
        if (cloudWinsForChar) {
          if (profile.characterColor) {
            setPlayerCharacterColor(profile.characterColor);
          }
          const safeShape = getSafeCharacterShape(profile.characterShape);
          if (safeShape) {
            setPlayerCharacterShape(safeShape);
          }
        }
        /* 所有 shape / コイン / 報酬日付など、別端末で買ったり受領した
           ものが反映されないと「ショップで買ったのに使えない」が起きる。
           こちらは ChoiceLock とは独立に常に最新を採用。 */
        if (Array.isArray(profile.ownedCharacterShapes)) {
          setOwnedCharacterShapes((current) => {
            const merged = Array.from(
              new Set<CharacterShape>([
                ...current,
                ...(profile.ownedCharacterShapes as CharacterShape[]),
              ]),
            );
            return merged.length === current.length &&
              merged.every((s, i) => s === current[i])
              ? current
              : merged;
          });
        }
        if (typeof profile.coins === "number") {
          /* realtime sync では admin floor を適用しない。
             ここで Math.max(profile.coins, 30000) すると、購入で減らした
             直後に snapshot が降ってきて 30000 に戻され「coin が減らない /
             購入が無効化される」回帰が起きる。初回 hydrate (5447 付近) で
             だけ floor を当てる方針に変更。 */
          const nextCoins = profile.coins;
          setCoins((current) => (current === nextCoins ? current : nextCoins));
        }
      },
      (error) => {
        console.info("User profile realtime sync skipped.", error);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, userId]);

  useEffect(() => {
    if (!currentUser || onboardingStep !== "welcome") {
      return;
    }

    // welcome 直後の遷移先も新ホーム (feed)
    setCurrentView("feed");
    setProfileMember(null);
    setProfileUser(null);
    setIsSearchOpen(false);
    setPendingJoinRoomId(null);
    setIsSettingsOpen(false);

    const timeoutId = window.setTimeout(() => {
      setDraftUserName(customUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
      setDraftUserId(userId);
      setSettingsError(t("ユーザーIDを入力するとContribution Arcを開始できます。"));
      setIsSettingsOpen(true);
      setOnboardingStep("settings");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [currentUser, customUserName, onboardingStep, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "study"),
      JSON.stringify(studyLogs),
    );
  }, [currentUser, studyLogs, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    let handledInitialSnapshot = false;

    const unsubscribe = subscribeStudyLogsFromCloud(
      db,
      currentUser.uid,
      (cloudLogs) => {
        const remoteLogs = removeSeedStudyLogs(cloudLogs);

        // Merge cloud snapshot with whatever the user already has locally
        // so records that never made it to Firestore (silent write failures,
        // offline edits) are preserved across reloads instead of being
        // overwritten by an incomplete cloud snapshot.
        setStudyLogs((prevLogs) => {
          const cachedNow = removeSeedStudyLogs(prevLogs);
          const remoteIds = new Set(remoteLogs.map((log) => log.id));
          const localOnly = cachedNow.filter((log) => !remoteIds.has(log.id));

          if (localOnly.length > 0 && !didRequestStudyLogMigrationRef.current) {
            didRequestStudyLogMigrationRef.current = true;
            void migrateStudyLogsToCloud(db, currentUser.uid, localOnly, {
              organizationId: currentOrganization?.id,
            }).catch((error) => {
              didRequestStudyLogMigrationRef.current = false;
              console.error("Study log recovery upload failed.", error);
            });
          }

          const merged = [...remoteLogs, ...localOnly].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          if (merged.length === 0 && !handledInitialSnapshot) {
            handledInitialSnapshot = true;
            return defaultStudyLogs;
          }

          handledInitialSnapshot = true;
          return merged;
        });
      },
      (error) => {
        console.error("Study log cloud sync failed.", error);
      },
    );

    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    // One-time fetch instead of a live subscription: learning items are
    // owner-only and every local mutation already updates state
    // optimistically, so a realtime listener would just re-read data the
    // client already has. `cancelled` guards against a late resolve writing
    // into an unmounted / switched-account tree.
    let cancelled = false;
    void fetchLearningItemsFromCloud(db, currentUser.uid)
      .then((cloudItems) => {
        if (!cancelled) {
          setLearningItems(cloudItems);
        }
      })
      .catch((error) => {
        console.info("Learning items cloud fetch skipped.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, isWorkspaceLoaded]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    if (learningItems.length > 0 || studyLogs.length === 0) {
      return;
    }
    const migrationFlagKey = `contribution-arc-learning-items-migration-v1-${currentUser.uid}`;
    if (window.localStorage.getItem(migrationFlagKey)) {
      return;
    }
    window.localStorage.setItem(migrationFlagKey, "true");

    const grouped = new Map<string, { name: string; color: string }>();
    studyLogs.forEach((log) => {
      const trimmed = log.subject.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, { name: trimmed, color: log.color || studyColorOptions[0].value });
      }
    });
    const nowIso = new Date().toISOString();
    const migrated: LearningItem[] = Array.from(grouped.values()).map((entry) => ({
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      name: entry.name.slice(0, 60),
      category: "stack",
      color: entry.color || studyColorOptions[0].value,
      status: "active",
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    if (migrated.length === 0) {
      return;
    }
    setLearningItems(migrated);
    migrated.forEach((item) => {
      void saveLearningItemToCloud(db, item).catch((error) => {
        console.info("Learning item migration save skipped.", error);
      });
    });
  }, [currentUser, isWorkspaceLoaded, learningItems.length, studyLogs.length]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded || !isPageVisible) {
      return;
    }
    const unsubscribe = subscribeActiveRecruitmentsFromCloud(
      db,
      (items) => setWorkspaceRecruitments(items),
      (error) => console.info("Workspace recruitments sync skipped.", error),
    );
    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded, isPageVisible]);

  // Incoming workspace invites. Recipient-scoped (where toUid == me, status
  // pending, limit 20) — same targeted-delivery shape as friendRequests.
  // Pending invites surface as in-app notifications below; accepting one
  // jumps the user into the inviter's room.
  useEffect(() => {
    if (!currentUser) {
      return;
    }
    const unsubscribe = subscribeIncomingWorkspaceInvites(
      db,
      currentUser.uid,
      (items) => setIncomingInvites(items),
      (error) => console.info("Workspace invites sync skipped.", error),
    );
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    // 30 秒固定の粗い tick。以前は募集ライブ中 1 秒間隔にしていたが、
    // それだと App 全体 (2 万行のコンポーネントツリー) が毎秒再レンダー
    // され、タイピング・スクロール・タップすべてがモサつく主因になっていた。
    // 秒単位のカウントダウン表示は WorkspaceRecruitmentFeedCard が内部の
    // ローカル tick で賄うので、App 側は粗い時刻だけ流せば足りる。
    const interval = window.setInterval(() => setFeedNowTick(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    // ライトモード固定。古い localStorage の "dark" が残っていても、
    // 起動時にここで上書きされて常に light が適用される。
    document.documentElement.dataset.theme = "light";
    window.localStorage.setItem("contribution-arc-theme", "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", "#fafaf8");
    }
  }, []);

  // Cursor spotlight — Linear / Stripe style two-layer cursor light.
  //
  // Layout:
  //   .cursor-spotlight-core   — small dot following the pointer
  //                              exactly (1:1, no lerp).
  //   .cursor-spotlight-aura   — large soft halo lerping behind the
  //                              cursor, scales with pointer velocity
  //                              so fast motion stretches it into a
  //                              comet-like wisp.
  //   .cursor-spotlight-ripple — momentary expanding ring on every
  //                              mousedown; pure CSS animation
  //                              re-fired by toggling a class.
  //
  // The pointer position is fed as CSS variables on the parent so
  // each child consumes them via transform: translate3d(var(--...)).
  // body has `zoom: var(--ui-scale)` applied — see existing comment
  // — so all coordinates are divided by that scale before being
  // written into the variables.
  //
  // Interactive elements get a hover class so the cursor reads as
  // "this is clickable" without needing a per-element CSS hover rule.
  //
  // prefers-reduced-motion gets a stripped-down path: lerp is
  // disabled (aura tracks exactly), ripple does not fire.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = spotlightRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let auraX = pointerX;
    let auraY = pointerY;
    let prevPointerX = pointerX;
    let prevPointerY = pointerY;
    // Damped velocity in 0..1 range — fed into the aura's CSS scale
    // so the halo widens during fast strokes and contracts when the
    // user pauses on a target.
    let velocity = 0;
    let frame = 0;
    let isMoving = false;
    let isVisible = false;
    const lerpAmount = reducedMotion ? 1 : 0.18;
    const velocityDecay = reducedMotion ? 0 : 0.85;
    const velocityNorm = 28; // px/frame mapped to scale=1

    const readScale = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-scale").trim();
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    const tick = () => {
      // Lerp aura toward pointer. With reducedMotion lerpAmount=1
      // so it snaps exactly to pointer.
      auraX += (pointerX - auraX) * lerpAmount;
      auraY += (pointerY - auraY) * lerpAmount;

      const stepX = pointerX - prevPointerX;
      const stepY = pointerY - prevPointerY;
      const stepVelocity = Math.min(1, Math.hypot(stepX, stepY) / velocityNorm);
      velocity = velocity * velocityDecay + stepVelocity * (1 - velocityDecay);
      prevPointerX = pointerX;
      prevPointerY = pointerY;

      const z = readScale();
      el.style.setProperty("--core-x", `${pointerX / z}px`);
      el.style.setProperty("--core-y", `${pointerY / z}px`);
      el.style.setProperty("--aura-x", `${auraX / z}px`);
      el.style.setProperty("--aura-y", `${auraY / z}px`);
      // Aura scale 1.0 at rest, up to 1.6 at peak velocity. The
      // stretch happens via scaleX too via the CSS class — kept on
      // CSS side so the math stays declarative.
      el.style.setProperty("--aura-scale", `${1 + velocity * 0.6}`);
      el.style.setProperty("--aura-velocity", velocity.toFixed(3));

      // Stop the rAF loop when the aura has settled. Restarts as
      // soon as another mousemove arrives.
      const settled = Math.abs(pointerX - auraX) < 0.4 && Math.abs(pointerY - auraY) < 0.4 && velocity < 0.01;
      if (settled && !isMoving) {
        frame = 0;
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const ensureRunning = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      isMoving = true;
      if (!isVisible) {
        isVisible = true;
        // First show: snap aura to pointer so it doesn't fly in from
        // (0, 0) on first render.
        auraX = pointerX;
        auraY = pointerY;
        prevPointerX = pointerX;
        prevPointerY = pointerY;
        el.classList.add("is-visible");
      }
      ensureRunning();
      // Mark moving inactive shortly after — the rAF loop checks
      // this flag to decide whether to stop after settling.
      window.clearTimeout(moveSettleTimer);
      moveSettleTimer = window.setTimeout(() => {
        isMoving = false;
      }, 80);
    };

    let moveSettleTimer = 0;

    const onLeave = () => {
      isVisible = false;
      el.classList.remove("is-visible");
    };

    // Hover detection — adds .is-hover when the pointer is over
    // anything the user can click. Uses event delegation so we don't
    // attach per-element listeners.
    const HOVER_SELECTOR = "button, a, [role='button'], [role='tab'], [role='menuitem'], input, select, textarea, label, [data-cursor-hover]";
    const onOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest) return;
      if (target.closest(HOVER_SELECTOR)) {
        if (!el.classList.contains("is-hover")) el.classList.add("is-hover");
      } else {
        if (el.classList.contains("is-hover")) el.classList.remove("is-hover");
      }
    };

    const onDown = (event: MouseEvent) => {
      if (reducedMotion) return;
      const z = readScale();
      el.style.setProperty("--ripple-x", `${event.clientX / z}px`);
      el.style.setProperty("--ripple-y", `${event.clientY / z}px`);
      // Restart the animation by toggling the class off → reflow →
      // back on. Without the reflow the same animation doesn't
      // re-trigger.
      el.classList.remove("is-clicking");
      void el.offsetWidth;
      el.classList.add("is-clicking");
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      if (frame) window.cancelAnimationFrame(frame);
      if (moveSettleTimer) window.clearTimeout(moveSettleTimer);
    };
  }, []);

  // Posts feed subscription.
  //
  // The posts feed is a global Firestore stream (`allow read: if signedIn()`)
  // so every signed-in user reads every user's posts. There are three things
  // this effect has to coordinate without stepping on its own toes:
  //
  //   (1) Boot UX:           Seed the UI from IndexedDB so reload is instant.
  //   (2) Truth from cloud:  Once Firestore delivers a snapshot, that is the
  //                          source of truth — the cache must never overwrite
  //                          fresh cloud data.
  //   (3) Offline writes:    The user's own posts that failed to upload are
  //                          held as `pending` and retried periodically.
  //
  // Historical bugs we are guarding against:
  //   • A late-arriving cache read silently overwriting cloud data (the cache
  //     only contained "own posts", so other users' posts vanished). Guarded
  //     by `cloudHasArrived` — once true, the cache seed is dropped.
  //   • An infinite reconnect loop on quota errors that hammered the API.
  //     Quota errors now stop the loop and surface a message instead.
  //   • Async IndexedDB reads inside the snapshot callback racing with other
  //     setPosts calls. Resolved by using functional `setPosts(prev => ...)`
  //     for all merge work.
  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;
    let isActive = true;
    let unsubscribe: (() => void) | null = null;
    let reconnectTimer: number | null = null;
    let pendingRetryTimer: number | null = null;
    let reconnectAttempt = 0;
    // Set to true the first time Firestore delivers a snapshot. After that
    // point we no longer trust the IndexedDB cache for *reads* — it is purely
    // a write target.
    let cloudHasArrived = false;

    // (1) Seed UI from cache for an instant first paint. If the cloud snapshot
    // beats us, drop the seed so we never roll the UI backwards.
    void readDurablePosts(uid)
      .then((cachedPosts) => {
        if (!isActive || cloudHasArrived || cachedPosts.length === 0) return;
        setPosts(cachedPosts);
      })
      .catch((error) => {
        console.warn("Failed to seed posts from IndexedDB:", error);
      });

    // (2) Subscribe to the live feed. Cloud is authoritative from here on.
    const subscribe = () => {
      unsubscribe = subscribePostsFromCloud(
        db,
        (cloudPosts) => {
          if (!isActive) return;
          cloudHasArrived = true;
          reconnectAttempt = 0;
          setPostError("");

          const syncedPosts = cloudPosts.map((post) => ({
            ...post,
            syncStatus: "synced" as const,
            syncError: "",
          }));

          // Functional update — read current state synchronously to preserve
          // the user's own pending posts (not yet uploaded) without an async
          // IndexedDB read that could race with other setPosts calls.
          setPosts((currentPosts) => {
            const ownPending = currentPosts.filter(
              (post) => post.userId === uid && post.syncStatus === "pending",
            );
            const nextPosts = mergePosts([...syncedPosts, ...ownPending]);
            void persistPosts(nextPosts).catch(logPersistError);
            return nextPosts;
          });
        },
        (error) => {
          if (!isActive) return;
          const code = (error as { code?: string })?.code ?? "";
          const message = (error as { message?: string })?.message ?? "";
          const isQuotaError =
            code.includes("resource-exhausted") || message.includes("Quota exceeded");

          if (isQuotaError) {
            // Quota exhausted: retrying just wastes whatever is left. Stop
            // the loop and surface a message instead.
            console.info("Posts realtime sync paused — quota exhausted.");
            setPostError(t("本日の利用上限に達しました。しばらく経ってから再読み込みしてください。"));
            return;
          }

          console.info("Posts realtime sync errored — will reconnect.", error);
          setPostError(t("ログの読み込みを待っています。"));
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }

          const delayMs = Math.min(60_000, 2_000 * 2 ** reconnectAttempt);
          reconnectAttempt += 1;
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            if (isActive) subscribe();
          }, delayMs);
        },
      );
    };
    subscribe();

    // (3) Retry locally-pending posts. We do an immediate pass on mount so a
    // stale session heals as soon as the cloud is reachable, then poll every
    // 5 minutes as a safety net. Retries are read from current state — never
    // from IndexedDB — so we don't fight with the cloud snapshot.
    const retryPendingPosts = () => {
      if (!isActive) return;
      setPosts((currentPosts) => {
        const ownPending = currentPosts.filter(
          (post) => post.userId === uid && post.syncStatus === "pending",
        );
        for (const post of ownPending) {
          void savePostToCloud(db, post)
            .then(() => {
              if (!isActive) return;
              const syncedPost: ContributionPostRecord = {
                ...post,
                syncStatus: "synced",
                syncError: "",
              };
              void putPersistentItem("posts", syncedPost).catch(logPersistError);
              setPosts((items) =>
                mergePosts([syncedPost, ...items.filter((item) => item.id !== post.id)]),
              );
            })
            .catch((error) => {
              console.info("Pending post sync skipped.", error);
            });
        }
        return currentPosts;
      });
    };
    retryPendingPosts();
    pendingRetryTimer = window.setInterval(retryPendingPosts, 300_000);

    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pendingRetryTimer) window.clearInterval(pendingRetryTimer);
    };
  }, [currentUser, t]);

  // Fetch replies for every visible post whenever the post list
  // changes. Previously this used a single collection-group query
  // which silently failed without an explicit Firestore index — so
  // replies vanished on every reload. The per-post helper has no
  // such requirement and is fast in practice because the queries
  // run in parallel. Optimistic updates inside handlePostReplySubmit
  // keep the local state ahead of the cloud round-trip so the user
  // never sees a delay.
  //
  // The fetch is keyed by the post-id signature so it doesn't fire
  // on irrelevant post-record updates (likes, etc.) — only when the
  // visible set of posts actually changes.
  const visiblePostIdsKey = useMemo(
    () =>
      posts
        .map((post) => post.id)
        .filter(Boolean)
        .sort()
        .join(","),
    [posts],
  );
  useEffect(() => {
    if (!currentUser) return;
    const postIds = visiblePostIdsKey ? visiblePostIdsKey.split(",") : [];
    if (postIds.length === 0) {
      setPostReplies([]);
      return;
    }
    let cancelled = false;
    void fetchRepliesForPosts(db, postIds, (error) => {
      console.info("Post reply fetch skipped.", error);
    }).then((replies) => {
      if (!cancelled) setPostReplies(replies);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, visiblePostIdsKey]);

  // Resolve live avatars for everyone visible in the feed, replies and
  // shared daily reports. We never look the current user up — their own
  // avatar always renders from live state (real-time, free). For everyone
  // else we fetch their equipped shape + color once per session; the
  // result refreshes whenever the page reloads or new authors appear, so
  // a teammate re-skinning shows up on the next load without any per-frame
  // listener cost.
  // Author UIDs を string key に集約しておく。posts / replies / reports の
  // 内容が更新されても、登場ユーザーの集合が変わらなければ key は変化せず、
  // 下の useEffect が再評価されない (= 不要な Firestore fetch が走らない)。
  // 元は posts/postReplies/dailyReports/sharedDailyReports そのものを deps
  // にしていたため、誰かが 1 投稿いいねしただけで Firestore に問い合わせて
  // いた。Avatar は users/{uid} のスナップショットなので、ユーザー数の
  // 増減でしか再 fetch する意味がない。
  const visibleAuthorIdsKey = useMemo(() => {
    if (!currentUser) return "";
    const ids = new Set<string>();
    const collect = (uid?: string) => {
      if (uid && uid !== currentUser.uid) ids.add(uid);
    };
    posts.forEach((post) => collect(post.userId));
    postReplies.forEach((reply) => collect(reply.userId));
    dailyReports.forEach((report) => collect(report.userId));
    sharedDailyReports.forEach((report) => collect(report.userId));
    return Array.from(ids).sort().join(",");
  }, [currentUser, posts, postReplies, dailyReports, sharedDailyReports]);

  useEffect(() => {
    if (!currentUser || !visibleAuthorIdsKey) return;
    const ids = visibleAuthorIdsKey.split(",").filter(Boolean);
    const toFetch = ids.filter(
      (uid) => !fetchedAppearanceIdsRef.current.has(uid),
    );
    if (toFetch.length === 0) return;
    toFetch.forEach((uid) => fetchedAppearanceIdsRef.current.add(uid));

    let cancelled = false;
    void fetchAuthorAppearances(db, toFetch)
      .then((map) => {
        if (cancelled || Object.keys(map).length === 0) return;
        setAuthorAppearances((prev) => ({ ...prev, ...map }));
      })
      .catch((error) => {
        // Non-fatal: the snapshot color is the fallback. Allow a retry
        // on the next change by forgetting the ids we couldn't resolve.
        toFetch.forEach((uid) => fetchedAppearanceIdsRef.current.delete(uid));
        console.info("Author appearance fetch skipped.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, visibleAuthorIdsKey]);

  // 著者ごとの「代表アピアランス」。同一人物の投稿/返信が記録時点ごとに
  // 違う色で保存されていても、最新レコードの色・形へ寄せて FEED 上で
  // 統一する。users/{uid} の現在値 (live) が取れればそちらを最優先するので、
  // キャラを変更すれば過去投稿のアイコンもまとめて現在の見た目に揃う。
  const authorFallbackAppearances = useMemo(() => {
    const records: { uid?: string; color?: string; shape?: string; createdAt?: string }[] = [
      ...posts.map((p) => ({
        uid: p.userId,
        color: p.characterColor,
        shape: p.characterShape,
        createdAt: p.createdAt,
      })),
      ...postReplies.map((r) => ({
        uid: r.userId,
        color: r.characterColor,
        shape: r.characterShape,
        createdAt: r.createdAt,
      })),
    ];
    records.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    const map: Record<string, { color: string; shape: string }> = {};
    for (const rec of records) {
      if (!rec.uid || map[rec.uid]) continue;
      map[rec.uid] = {
        color: typeof rec.color === "string" ? rec.color : "",
        shape: typeof rec.shape === "string" ? rec.shape : "",
      };
    }
    return map;
  }, [posts, postReplies]);

  // Pick the avatar shape + color to render for a piece of authored
  // content. The current user always renders from their live equipped
  // state; everyone else resolves to their live profile when we've
  // fetched it, then to that author's most-recent record so the same
  // person never renders in two different colors across the feed.
  const resolveAuthorAppearance = useCallback(
    (
      authorUid: string | undefined,
      fallbackColor?: string,
      fallbackShape?: string,
    ): { color: string; shape: CharacterShape } => {
      if (authorUid && authorUid === currentUser?.uid) {
        return { color: playerCharacterColor, shape: playerCharacterShape };
      }
      const live = authorUid ? authorAppearances[authorUid] : undefined;
      const rep = authorUid ? authorFallbackAppearances[authorUid] : undefined;
      return {
        color: getSafeCharacterColor(
          live?.characterColor || rep?.color || fallbackColor || "",
        ),
        shape: getSafeCharacterShape(
          live?.characterShape || rep?.shape || fallbackShape || "default",
        ),
      };
    },
    [
      authorAppearances,
      authorFallbackAppearances,
      currentUser,
      playerCharacterColor,
      playerCharacterShape,
    ],
  );

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    let isActive = true;
    const cachedReports = readCachedDailyReports(currentUser.uid, userId);
    let durableReportsCache = cachedReports;
    if (cachedReports.length > 0) {
      setDailyReports(cachedReports);
    }
    void readDurableDailyReports(currentUser.uid, userId).then((durableReports) => {
      if (!isActive || durableReports.length === 0) {
        return;
      }

      durableReportsCache = durableReports;
      setDailyReports(durableReports);
      persistDailyReports(currentUser.uid, userId, durableReports);

      durableReports
        // Skip drafts here — pending sync is only for *published*
        // reports whose cloud write was deferred. Draft persistence is
        // intentionally local-only.
        .filter(
          (report) =>
            report.userId === currentUser.uid &&
            report.syncStatus === "pending" &&
            report.isDraft !== true,
        )
        .forEach((report) => {
          void setDoc(
            doc(db, "dailyReports", report.id),
            {
              ...dailyReportToCloudPayload(report),
              userId: currentUser.uid,
              serverUpdatedAt: serverTimestamp(),
            },
            { merge: true },
          )
            .then(() => {
              const syncedReport: DailyReport = { ...report, syncStatus: "synced", syncError: "" };
              void putPersistentItem("dailyReports", syncedReport);
              if (isActive) {
                setDailyReports((reports) => mergeDailyReports([syncedReport, ...reports]));
              }
            })
            .catch((error) => {
              console.info("Pending daily report sync skipped.", error);
            });
        });
    });

    let handledOwnInitialSnapshot = false;
    const ownDailyQuery = query(collection(db, "dailyReports"), where("userId", "==", currentUser.uid));
    const unsubscribeOwnReports = onSnapshot(
      ownDailyQuery,
      (snapshot) => {
        const ownCloudReports = mergeDailyReports(
          snapshot.docs
            .map((item) => {
              const data = {
                ...(item.data() as Partial<DailyReport>),
                id: item.id,
              };
              return {
                ...normalizeDailyReport(data, currentUser.uid),
                syncStatus: "synced" as const,
                syncError: "",
              };
            })
            .filter((report) => report.userId === currentUser.uid && (report.plan.trim() || report.reflection.trim())),
        );

        if (ownCloudReports.length > 0) {
          const reports = mergeDailyReports([...durableReportsCache, ...ownCloudReports]);
          durableReportsCache = reports;
          setDailyReports(reports);
          persistDailyReports(currentUser.uid, userId, reports);
          handledOwnInitialSnapshot = true;
          return;
        }

        if (!handledOwnInitialSnapshot && durableReportsCache.length > 0 && !didRequestDailyReportMigrationRef.current) {
          didRequestDailyReportMigrationRef.current = true;
          setDailyReports(durableReportsCache);
          persistDailyReports(currentUser.uid, userId, durableReportsCache);
          void Promise.all(
            durableReportsCache
              // Drafts stay local-only even during a first-login
              // migration — uploading them would silently publish
              // notes the writer marked as private.
              .filter((report) => report.isDraft !== true)
              .map((report) =>
                setDoc(
                  doc(db, "dailyReports", report.id),
                  {
                    ...dailyReportToCloudPayload(report),
                    userId: currentUser.uid,
                    serverUpdatedAt: serverTimestamp(),
                  },
                  { merge: true },
                ),
              ),
          ).catch((error) => {
            console.info("Daily report migration to cloud skipped.", error);
          });
        } else if (!handledOwnInitialSnapshot && durableReportsCache.length === 0) {
          setDailyReports([]);
        }

        handledOwnInitialSnapshot = true;
      },
      (error) => {
        console.info("Own daily report realtime sync skipped.", error);
        if (durableReportsCache.length > 0) {
          setDailyReports(durableReportsCache);
        }
      },
    );
    /* Team Daily (みんなの日報) は明示的にユーザーが「読み込む」ボタンを
       押した時にだけ 100 件まで取りに行く。マウント時の自動 fetch を
       廃止することで、日報画面を開くたびに巨大なネットワーク往復が
       走らなくなる (報告ベース)。 */

    return () => {
      isActive = false;
      unsubscribeOwnReports();
    };
  }, [currentUser, isWorkspaceLoaded, userId]);

  useEffect(() => {
    const nextReport = dailyReports.find((report) => report.date === selectedDailyDate);
    /* Phase 10b: pick the freshest plan representation.
       Priority: explicit planItems > legacy plan text (lifted lazily)
       > carryover from the most recent prior report (only when there
       is no report at all for today — we don't want to clobber an
       in-progress edit).
       Phase 11: 「下書きにする」トグルを廃止した代わりに、未送信の
       入力をローカル下書き (localStorage) に保持する。サーバー側の
       report より新しいローカル下書きがあれば必ずそれを優先する。 */
    const localDraft = readLocalDailyDraft(selectedDailyDate);

    let nextPlanItems: PlanItem[];
    if (localDraft?.planItems && localDraft.planItems.length > 0) {
      nextPlanItems = localDraft.planItems;
    } else if (nextReport?.planItems && nextReport.planItems.length > 0) {
      nextPlanItems = nextReport.planItems;
    } else if (nextReport?.plan) {
      nextPlanItems = planItemsFromLegacyText(nextReport.plan);
    } else if (!nextReport) {
      nextPlanItems = getCarriedOverItems(dailyReports, selectedDailyDate);
    } else {
      nextPlanItems = [];
    }
    setDailyPlanItemsDraft(nextPlanItems);

    if (typeof localDraft?.reflection === "string") {
      setDailyReflectionPartsDraft(parseReflectionParts(localDraft.reflection));
    } else {
      setDailyReflectionPartsDraft(parseReflectionParts(nextReport?.reflection || ""));
    }
    setDailyIsDraftDraft(nextReport?.isDraft === true);
  }, [dailyReports, selectedDailyDate]);

  /* Phase 11: 入力中の plan / reflection を localStorage に同期。
     送信前のテキストがリロード / 日付切替で消えないようにする。
     書き込みは debounce せず毎回行う (localStorage は十分速い)。
     reflection は内部表現 (parts) を serialize 後の string 形式で保存し、
     旧 string のローカルドラフトとフォーマットを互換に保つ。 */
  useEffect(() => {
    writeLocalDailyDraft(selectedDailyDate, { planItems: dailyPlanItemsDraft });
  }, [dailyPlanItemsDraft, selectedDailyDate]);

  useEffect(() => {
    writeLocalDailyDraft(selectedDailyDate, {
      reflection: serializeReflectionParts(dailyReflectionPartsDraft),
    });
  }, [dailyReflectionPartsDraft, selectedDailyDate]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "knowledge-graph"),
      JSON.stringify(knowledgeGraph),
    );
  }, [currentUser, knowledgeGraph, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    const stored = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "daily-prompt-dismissed"),
    );
    setDailyPromptDismissedFor(stored || "");
  }, [currentUser, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(getAccountStorageKey(accountScope, "friends"), JSON.stringify(friends));
  }, [currentUser, friends, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getFriendRequestsStorageKey(accountScope),
      JSON.stringify(friendRequests),
    );
  }, [currentUser, friendRequests, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const applyCloudRequests = (direction: FriendRequestDirection, cloudRequests: FriendRequest[]) => {
      // ブロック中の uid からの request は UI に出さない。
      const filteredCloudRequests = cloudRequests.filter(
        (request) => !blockedFriendUids.includes(request.profile.uid),
      );
      setFriendRequests((requests) => {
        const localRequests = requests
          .map((request) => ({
            ...request,
            direction: request.direction || "outgoing",
          }))
          .filter((request) => request.direction !== direction);
        const nextRequests = [...filteredCloudRequests, ...localRequests];

        return nextRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      setFriends((items) => {
        const nextFriends = [...items];
        cloudRequests
          .filter((request) => request.status === "accepted")
          .forEach((request) => {
            const nextFriend = profileToFriend(request.profile, t);
            if (!nextFriends.some((friend) => friend.uid === nextFriend.uid)) {
              nextFriends.unshift(nextFriend);
            }
          });

        return nextFriends;
      });
    };

    const outgoingQuery = query(collection(db, "friendRequests"), where("fromUid", "==", currentUser.uid));
    const incomingQuery = query(collection(db, "friendRequests"), where("toUid", "==", currentUser.uid));

    const unsubscribeOutgoing = onSnapshot(
      outgoingQuery,
      (snapshot) => {
        const cloudRequests: FriendRequest[] = snapshot.docs
          .map((item) => {
            const data = item.data() as {
              toProfile?: Partial<UserProfile>;
              status?: FriendRequestStatus;
              createdAt?: string;
              acceptedAt?: string;
            };

            return {
              id: item.id,
              profile: normalizeUserProfile(data.toProfile?.uid || "", data.toProfile || {}),
              status: (data.status === "accepted" ? "accepted" : "pending") as FriendRequestStatus,
              direction: "outgoing" as const,
              createdAt: data.createdAt || new Date().toISOString(),
              acceptedAt: data.acceptedAt,
            };
          })
          .filter((request) => request.profile.uid);

        applyCloudRequests("outgoing", cloudRequests);
      },
      (error) => {
        console.info("Outgoing friend request realtime sync skipped.", error);
      },
    );
    const unsubscribeIncoming = onSnapshot(
      incomingQuery,
      (snapshot) => {
        const cloudRequests: FriendRequest[] = snapshot.docs
          .map((item) => {
            const data = item.data() as {
              fromProfile?: Partial<UserProfile>;
              status?: FriendRequestStatus;
              createdAt?: string;
              acceptedAt?: string;
            };

            return {
              id: item.id,
              profile: normalizeUserProfile(data.fromProfile?.uid || "", data.fromProfile || {}),
              status: (data.status === "accepted" ? "accepted" : "pending") as FriendRequestStatus,
              direction: "incoming" as const,
              createdAt: data.createdAt || new Date().toISOString(),
              acceptedAt: data.acceptedAt,
            };
          })
          .filter((request) => request.profile.uid);

        applyCloudRequests("incoming", cloudRequests);
      },
      (error) => {
        console.info("Incoming friend request realtime sync skipped.", error);
      },
    );

    return () => {
      unsubscribeOutgoing();
      unsubscribeIncoming();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(getAccountStorageKey(accountScope, "room"), selectedRoomId);
  }, [currentUser, selectedRoomId, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    const serializedRooms = serializeWorkspaceRooms(customRooms);
    const serializedRoomText = JSON.stringify(serializedRooms);
    safeSetLocalStorage(sharedWorkspaceRoomsStorageKey, serializedRoomText);

    if (isApplyingRemoteRoomsRef.current) {
      isApplyingRemoteRoomsRef.current = false;
      lastSyncedWorkspaceRoomsRef.current = serializedRoomText;
      return;
    }

    if (lastSyncedWorkspaceRoomsRef.current === serializedRoomText) {
      return;
    }

    lastSyncedWorkspaceRoomsRef.current = serializedRoomText;
    // Only push back rooms the user actually owns or is present in. The lobby
    // copy of *other* rooms is now a static snapshot (fetched on open / manual
    // refresh), so writing those back could regress another room's
    // server-side metadata (e.g. roll totalMinutes backwards) with our stale
    // copy. saveWorkspaceRoomToCloud already protects other members via a
    // transaction, but room-level fields come from the local payload — so we
    // simply don't write rooms we have no business owning.
    serializedRooms
      .filter(
        (room) =>
          room.createdBy === currentUser.uid ||
          (room.activeMembers || []).some((member) => member.userId === currentUser.uid),
      )
      .forEach((room) => {
        void saveWorkspaceRoomToCloud(room, currentUser.uid).catch((error) => {
          console.info("Workspace room cloud sync skipped.", error);
        });
      });
  }, [currentUser, customRooms, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "workspace-task"),
      workspaceTask,
    );
  }, [currentUser, workspaceTask, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(getAccountStorageKey(accountScope, "character-color"), playerCharacterColor);
  }, [currentUser, playerCharacterColor, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(getAccountStorageKey(accountScope, "character-shape"), playerCharacterShape);
  }, [currentUser, playerCharacterShape, isWorkspaceLoaded, userId]);

  /* 所有 shape を localStorage にもミラーする。次回起動時の即時 hydrate
     でロック判定に使うため。cloud 側 (ownedCharacterShapes フィールド)
     と二重管理になるが、起動直後にロックを正しく見せるためのキャッシュ
     用途として割り切る。 */
  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "owned-character-shapes"),
      JSON.stringify([...ownedCharacterShapes].sort()),
    );
  }, [currentUser, ownedCharacterShapes, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "workspace-preset-messages"),
      JSON.stringify(workspacePresetMessages.slice(0, 6)),
    );
  }, [currentUser, workspacePresetMessages, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser) return;
    safeSetLocalStorage(
      `ca:auto-post-enabled:${currentUser.uid}`,
      isAutoPostEnabled ? "true" : "false",
    );
  }, [currentUser, isAutoPostEnabled]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "workspace-opened-gift-levels"),
      JSON.stringify(openedWorkspaceGiftLevels),
    );
  }, [currentUser, openedWorkspaceGiftLevels, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "desktop-notification-settings"),
      JSON.stringify(desktopNotificationSettings),
    );
  }, [currentUser, desktopNotificationSettings, isWorkspaceLoaded, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }
    const accountScope = getAccountStorageScope(currentUser.uid, userId);

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "app-notifications"),
      JSON.stringify(appNotifications.slice(0, 40)),
    );
  }, [currentUser, appNotifications, isWorkspaceLoaded, userId]);

  useEffect(() => {
    const timerId = window.setInterval(() => setWorkspaceNow(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    setCustomRooms((rooms) => cleanWorkspacePresenceForUser(rooms, currentUser.uid, workspaceNow));
  }, [currentUser, isWorkspaceLoaded, workspaceNow]);

  // Merge whatever is currently in `remoteWorkspaceRoomsRef` (the last lobby
  // fetch + the live snapshot of the room the user is in) into `customRooms`.
  // Hoisted out of the old all-rooms subscription effect so the manual refresh
  // button and the single-room live subscription can both drive it.
  //
  // scope:
  //   "lobby"      … remote が全 room を持つ (lobby fetch 直後)。
  //                  → currentRooms に「remote にない」room があれば、それは
  //                    削除済み or 自分以外が消したもの。cache 復活を防ぐため
  //                    pending write 中のローカル新規 room 以外は捨てる。
  //   "activeRoom" … remote は active room しか含まない (single-room snapshot)。
  //                  → 他の room は currentRooms から保持する (既存挙動)。
  //
  // 不具合の原因だった「部屋を解体しても reload で復活する」は、リロード時の
  // lobby fetch 後にも "remote にない → 保持" が走り、localStorage cache 内の
  // 削除済み room が finalRoomMap に戻されていたことに起因する。scope="lobby"
  // のときだけ「remote に存在しない room は捨てる」挙動に切り替える。
  const applyRemoteRooms = useCallback((scope: "lobby" | "activeRoom" = "activeRoom") => {
    if (!currentUser) {
      return;
    }
    const remoteRoomMap = new Map<string, WorkspaceRoom>();

    remoteWorkspaceRoomsRef.current.legacyRooms.forEach((room) => {
      if (deletedWorkspaceRoomIdsRef.current.has(room.id)) return;
      remoteRoomMap.set(room.id, room);
    });
    remoteWorkspaceRoomsRef.current.rooms.forEach((room) => {
      if (deletedWorkspaceRoomIdsRef.current.has(room.id)) return;
      remoteRoomMap.set(room.id, room);
    });

    const remoteRooms = Array.from(remoteRoomMap.values());
    const remoteRoomIds = new Set(remoteRooms.map((room) => room.id));

    remoteRooms
      .filter((room) => isLegacyWorkspaceRoom(room) && room.createdBy === currentUser.uid)
      .forEach((room) => {
        if (cleanedLegacyWorkspaceRoomsRef.current.has(room.id)) {
          return;
        }

        cleanedLegacyWorkspaceRoomsRef.current.add(room.id);
        void deleteDoc(doc(db, workspaceRoomsCollectionName, room.id)).catch((error) => {
          console.info("Legacy room cleanup skipped.", error);
        });
        void deleteDoc(doc(db, legacyWorkspaceRoomsCollectionName, room.id)).catch((error) => {
          console.info("Legacy workspace room cleanup skipped.", error);
        });
      });

    remoteRooms.forEach((room) => {
      const pendingRoom = pendingWorkspaceRoomsRef.current.get(room.id);
      if (pendingRoom && getSerializedWorkspaceRoomText(pendingRoom) === getSerializedWorkspaceRoomText(room)) {
        pendingWorkspaceRoomsRef.current.delete(room.id);
      }
    });

    setCustomRooms((currentRooms) => {
      // Per-room merge: we used to *drop* a remote room update
      // entirely if we still had a pending local write for it, which
      // meant two users actively working in the same room would each
      // keep filtering out the other's updates — bubbles, position,
      // status, everything — until their own write debounce settled.
      // The fix is to splice instead of replace: take the remote
      // room as the base (so other members' freshly-arrived bubbles
      // come through), then graft ONLY the current user's local
      // self-member on top so our in-flight edits don't snap back.
      const finalRoomMap = new Map<string, WorkspaceRoom>();

      remoteRooms.forEach((remoteRoom) => {
        const pendingLocal = pendingWorkspaceRoomsRef.current.get(remoteRoom.id);
        if (!pendingLocal) {
          finalRoomMap.set(remoteRoom.id, remoteRoom);
          return;
        }
        const localSelf = pendingLocal.activeMembers.find(
          (member) => member.userId === currentUser.uid,
        );
        const remoteOthers = remoteRoom.activeMembers.filter(
          (member) => member.userId !== currentUser.uid,
        );
        const mergedMembers = localSelf
          ? [...remoteOthers, localSelf]
          : remoteOthers;
        finalRoomMap.set(
          remoteRoom.id,
          // Keep the remote room as the base for server-owned fields
          // (totalMinutes, history, other members…), but let a pending local
          // edit win for the owner-controlled `name` so an in-flight rename
          // doesn't snap back to the old title before the write lands. For
          // every non-rename handler pendingLocal.name === remoteRoom.name,
          // so this is a no-op there.
          normalizeWorkspaceRoom({
            ...remoteRoom,
            name: pendingLocal.name,
            activeMembers: mergedMembers,
          }),
        );
      });

      // Pending locally-created rooms that haven't synced yet still
      // belong in the merge.
      pendingWorkspaceRoomsRef.current.forEach((pendingLocal, roomId) => {
        if (!finalRoomMap.has(roomId)) {
          finalRoomMap.set(roomId, pendingLocal);
        }
      });

      // Rooms that only exist locally (e.g. offline edits) — and rooms
      // that were in the previous lobby snapshot but aren't in the
      // current merge source (because the single-room live subscription
      // only refreshes the active room) — stay as-is until the next
      // lobby refresh. This keeps the lobby list stable between manual
      // refreshes instead of collapsing to just the active room.
      //
      // ただし scope="lobby" のときは remote が全 room を持つので、
      // currentRooms にあって remote に無い room は「削除された」
      // と判断できる。pending write 中 (未同期の新規 room) だけは保護し、
      // それ以外は捨てる ─ これで「解体 → reload で復活」の経路を絶つ。
      currentRooms.forEach((room) => {
        if (deletedWorkspaceRoomIdsRef.current.has(room.id)) return; // skip ghosts
        if (!finalRoomMap.has(room.id) && !remoteRoomIds.has(room.id)) {
          if (scope === "lobby" && !pendingWorkspaceRoomsRef.current.has(room.id)) {
            return; // skip — remote が "存在しない" と確定したので cache 復活させない
          }
          finalRoomMap.set(room.id, room);
        }
      });

      const nextRooms = cleanWorkspacePresenceForUser(
        seedWorkspaceRooms(Array.from(finalRoomMap.values())),
        currentUser.uid,
        Date.now(),
      );

      // The merged customRooms already reflect everything we'd write
      // back (our local self + the remote other-members). Suppress
      // the next sync-effect run so we don't burn a redundant write
      // just to push the data we just merged in.
      isApplyingRemoteRoomsRef.current = true;
      lastSyncedWorkspaceRoomsRef.current = JSON.stringify(serializeWorkspaceRooms(nextRooms));
      setSelectedRoomId((currentRoomId) =>
        nextRooms.some((room) => room.id === currentRoomId) ? currentRoomId : nextRooms[0]?.id || "",
      );

      return nextRooms;
    });
  }, [currentUser]);

  const readRoomsSnapshot = useCallback(
    (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) =>
      snapshot.docs.map((item) =>
        normalizeWorkspaceRoom({
          ...((item.data() as Partial<WorkspaceRoom>) || {}),
          id: item.id,
        } as WorkspaceRoom),
      ),
    [],
  );

  // Cost control: we no longer hold a live subscription on the entire
  // workspaceRooms / legacyWorkspaceRooms collections (that fan-out dominated
  // Firestore reads — the 2026-05-26 spike). Instead the lobby list of *other*
  // rooms is fetched once when the workspace opens and thereafter only when the
  // user presses the refresh button; the room the user is actually in stays
  // live via a single-document subscription below.
  const refreshLobbyRooms = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    try {
      const [modernSnap, legacySnap] = await Promise.all([
        getDocs(collection(db, workspaceRoomsCollectionName)),
        getDocs(collection(db, legacyWorkspaceRoomsCollectionName)),
      ]);
      remoteWorkspaceRoomsRef.current.rooms = readRoomsSnapshot(modernSnap);
      remoteWorkspaceRoomsRef.current.legacyRooms = readRoomsSnapshot(legacySnap);
      // lobby fetch 後は remote が全 room を持つので、cache に居て remote に
      // 居ない room は "削除済み" と確定できる。"lobby" scope で適用。
      applyRemoteRooms("lobby");
    } catch (error) {
      console.info("Workspace lobby fetch skipped.", error);
    }
  }, [currentUser, readRoomsSnapshot, applyRemoteRooms]);

  // Manual lobby refresh: the only way (besides the initial open) to pull a
  // fresh list of other rooms. Wraps refreshLobbyRooms with a short loading
  // state so the button can show progress.
  const handleManualLobbyRefresh = useCallback(async () => {
    if (isRefreshingLobby) {
      return;
    }
    setIsRefreshingLobby(true);
    try {
      await refreshLobbyRooms();
    } finally {
      setIsRefreshingLobby(false);
    }
  }, [isRefreshingLobby, refreshLobbyRooms]);

  // Lobby: fetch the all-rooms snapshot once per workspace-open session. The
  // ref guard prevents re-fetching on tab visibility toggles; leaving the
  // workspace resets it so re-entering pulls a fresh lobby.
  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded || currentView !== "workspace") {
      lobbyFetchedRef.current = false;
      return;
    }
    if (lobbyFetchedRef.current) {
      return;
    }
    lobbyFetchedRef.current = true;
    void refreshLobbyRooms();
  }, [currentUser, isWorkspaceLoaded, currentView, refreshLobbyRooms]);

  // Active room: keep ONLY the room the user is currently in live. This is the
  // single remaining realtime room subscription, so other members' moves and
  // bubbles still appear instantly while we avoid subscribing to every room.
  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded || !isPageVisible || currentView !== "workspace" || !selectedRoomId) {
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, workspaceRoomsCollectionName, selectedRoomId),
      (snap) => {
        if (!snap.exists()) {
          return;
        }
        /* 解体済み id は無視。delete の cloud 反映までに別端末の
           書き込みでこの onSnapshot が走ると、亡霊部屋として復活
           してしまう経路を塞ぐ。 */
        if (deletedWorkspaceRoomIdsRef.current.has(snap.id)) {
          return;
        }
        const liveRoom = normalizeWorkspaceRoom({
          ...((snap.data() as Partial<WorkspaceRoom>) || {}),
          id: snap.id,
        } as WorkspaceRoom);
        const rooms = remoteWorkspaceRoomsRef.current.rooms;
        const index = rooms.findIndex((room) => room.id === liveRoom.id);
        if (index >= 0) {
          rooms[index] = liveRoom;
        } else {
          rooms.push(liveRoom);
        }
        applyRemoteRooms();
      },
      (error) => {
        console.info("Workspace active-room realtime sync skipped.", error);
      },
    );

    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded, isPageVisible, currentView, selectedRoomId, applyRemoteRooms]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const currentUserId = currentUser.uid;
    const workspaceRoomsStorageKey = sharedWorkspaceRoomsStorageKey;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== workspaceRoomsStorageKey || !event.newValue) {
        return;
      }

      setCustomRooms(
        cleanWorkspacePresenceForUser(
          seedWorkspaceRooms((JSON.parse(event.newValue) as WorkspaceRoom[]).map(normalizeWorkspaceRoom)),
          currentUserId,
        ),
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [currentUser, userId]);

  // Cost control: customRooms gets a *new array reference* every 30s (the
  // workspaceNow tick → cleanWorkspacePresenceForUser → setCustomRooms),
  // even when no member actually joined/left. If the effect below depended
  // directly on `customRooms`, it would tear down + recreate the users
  // onSnapshot every 30s — each re-subscribe pulls 30 full user docs.
  // Reduce to a stable string key so we only re-subscribe when the set of
  // target IDs actually changes.
  const workspaceProfileTargetIdsKey = useMemo(() => {
    if (!currentUser) return "";
    const activeMemberIds = customRooms.flatMap((r) => r.activeMembers.map((m) => m.userId));
    return [...new Set([...following, ...activeMemberIds])]
      .filter((id) => id && id !== currentUser.uid)
      .slice(0, 30)
      .sort()
      .join(",");
  }, [currentUser, following, customRooms]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded || !isPageVisible) {
      return;
    }

    const targetIds = workspaceProfileTargetIdsKey ? workspaceProfileTargetIdsKey.split(",") : [];
    if (targetIds.length === 0) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "users"), where(documentId(), "in", targetIds)),
      (snapshot) => {
        const nextProfiles: Record<string, UserProfile> = {};
        snapshot.docs.forEach((item) => {
          nextProfiles[item.id] = normalizeUserProfile(item.id, item.data() as Partial<UserProfile>);
        });
        setWorkspaceProfiles((prev) => ({ ...prev, ...nextProfiles }));
      },
      (error) => {
        console.info("Workspace profile realtime sync skipped.", error);
      },
    );

    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded, isPageVisible, workspaceProfileTargetIdsKey]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    const nextName =
      customUserName.trim() || currentUser.displayName || currentUser.email?.split("@")[0] || "Developer";
    const nextBuilding = workspaceTask.trim() || "Deep Work";

    setCustomRooms((rooms) => {
      let changed = false;
      const nextRooms = rooms.map((room) => {
        const normalizedRoom = normalizeWorkspaceRoom(room);
        const nextRoomOwner =
          normalizedRoom.createdBy === currentUser.uid &&
          (normalizedRoom.ownerName !== nextName || normalizedRoom.ownerAvatar !== playerAvatar)
            ? {
                ownerName: nextName,
                ownerAvatar: playerAvatar,
              }
            : null;
        let memberChanged = false;
        const nextMembers = normalizedRoom.activeMembers.map((member) => {
          if (member.userId !== currentUser.uid) {
            return member;
          }

          if (
            member.name === nextName &&
            member.building === nextBuilding &&
            member.avatar === playerAvatar &&
            member.characterColor === playerCharacterColor &&
            (member.characterShape || "default") === playerCharacterShape
          ) {
            return member;
          }

          memberChanged = true;
          return {
            ...member,
            name: nextName,
            building: nextBuilding,
            currentTask: nextBuilding,
            avatar: playerAvatar,
            characterColor: playerCharacterColor,
            characterShape: playerCharacterShape,
          };
        });

        if (nextRoomOwner) {
          changed = true;
        }

        if (memberChanged) {
          changed = true;
        }

        if (!nextRoomOwner && !memberChanged) {
          return normalizedRoom;
        }

        const nextRoom = normalizeWorkspaceRoom({ ...normalizedRoom, ...nextRoomOwner, activeMembers: nextMembers });
        pendingWorkspaceRoomsRef.current.set(nextRoom.id, nextRoom);
        return nextRoom;
      });

      return changed ? nextRooms : rooms;
    });
  }, [currentUser, customUserName, isWorkspaceLoaded, playerAvatar, playerCharacterColor, playerCharacterShape, studySubject, workspaceTask]);

  useEffect(() => {
    if (!currentUser) {
      syncedRoomPositionRef.current = null;
      return;
    }

    const selectedLocalRoom = customRooms.map(normalizeWorkspaceRoom).find((room) => room.id === selectedRoomId);
    const member = selectedLocalRoom?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!member) {
      pressedWorkspaceKeysRef.current.clear();
      isPlayerWalkingRef.current = false;
      setIsPlayerWalking(false);
      syncedRoomPositionRef.current = null;
      return;
    }

    // Only seed the local playerPosition once per (user, room) entry. After that
    // local state owns the avatar position — otherwise every Firestore tick or
    // normalization pass would snap the avatar back to the persisted x/y and
    // visually teleport mid-walk.
    const syncKey = `${currentUser.uid}:${selectedRoomId}`;
    if (syncedRoomPositionRef.current === syncKey) {
      return;
    }
    syncedRoomPositionRef.current = syncKey;

    setPlayerPosition({
      x: typeof member.x === "number" ? member.x : 18,
      y: typeof member.y === "number" ? member.y : 72,
    });
  }, [currentUser, customRooms, selectedRoomId]);

  useEffect(() => {
    if (!workspaceBubble) {
      return;
    }

    const timeoutId = window.setTimeout(() => setWorkspaceBubble(""), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [workspaceBubble]);

  // Reset the chat log when the user switches rooms — the old room's
  // conversation isn't useful context for the new one, and the
  // per-user "last logged at" timestamps would otherwise prevent
  // bubbles in the new room from being captured if they happened to
  // share a userId with the previous room.
  useEffect(() => {
    setPresetLog([]);
    lastLoggedBubbleAtRef.current = new Map();
  }, [selectedRoomId]);

  // Watch the selected room's member array for newly-arrived bubbles.
  // Every preset send already writes `bubble` + `bubbleAt` onto the
  // member's room entry (see handleWorkspacePresetMessage) and that
  // change rides the existing Firestore room sync — so by the time
  // this effect runs the data is already here. We just need to
  // recognise each new bubble once and append it to the log.
  useEffect(() => {
    if (!selectedRoomId) return;
    const room = customRooms.find((item) => item.id === selectedRoomId);
    if (!room || !Array.isArray(room.activeMembers)) return;
    const now = Date.now();
    const additions: PresetLogEntry[] = [];
    for (const member of room.activeMembers) {
      if (!member.bubble || !member.bubbleAt) continue;
      const at = new Date(member.bubbleAt).getTime();
      if (!Number.isFinite(at)) continue;
      const lastAt = lastLoggedBubbleAtRef.current.get(member.userId) || 0;
      if (at <= lastAt) continue;
      // Always advance the high-water mark so we don't reconsider the
      // same bubble next tick — even if we end up discarding it as
      // stale below.
      lastLoggedBubbleAtRef.current.set(member.userId, at);
      // Skip bubbles older than 30s. This protects the log from being
      // spammed with historical bubbles when the user first joins a
      // room (every member's last bubble would otherwise replay) and
      // from replaying old data when the tab wakes from background.
      if (now - at > 30_000) continue;
      additions.push({
        id: `${member.userId}-${at}`,
        userId: member.userId,
        name: member.name || "Developer",
        message: member.bubble,
        color: member.characterColor || (member as { color?: string }).color,
        at,
      });
    }
    if (additions.length === 0) return;
    setPresetLog((log) => {
      const seen = new Set(log.map((entry) => entry.id));
      const fresh = additions.filter((entry) => !seen.has(entry.id));
      if (fresh.length === 0) return log;
      // Newest first, oldest dropped past 12.
      return [...fresh.reverse(), ...log].slice(0, 12);
    });
  }, [customRooms, selectedRoomId]);

  // Membership gate as a single boolean — flips only when the user
  // actually enters or leaves a room, not on every Firestore tick. The
  // previous walk effect listed `customRooms` in its deps, so each
  // member-position snapshot from any other user in the room tore down
  // the keyboard listeners and cleared `pressedWorkspaceKeysRef`. That
  // meant the avatar would briefly stop responding to held keys every
  // time anyone moved. Now the listener stays mounted the whole session.
  const canMoveInRoom = useMemo(() => {
    if (!currentUser) {
      return false;
    }
    const room = customRooms.find((r) => r.id === selectedRoomId);
    if (!room) {
      return false;
    }
    return normalizeWorkspaceRoom(room).activeMembers.some(
      (member) => member.userId === currentUser.uid,
    );
  }, [currentUser, customRooms, selectedRoomId]);

  useEffect(() => {
    if (!currentUser || (currentView !== "workspace" && currentView !== "home") || !canMoveInRoom) {
      pressedWorkspaceKeysRef.current.clear();
      isPlayerWalkingRef.current = false;
      setIsPlayerWalking(false);
      return;
    }

    // Don't treat plain buttons as typing targets — every workspace actor
    // is a <button>, so the old check made the avatar unresponsive any
    // time focus landed on another actor or any nearby control. The only
    // real "user is typing here" surfaces are real inputs and
    // contenteditable regions.
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!workspaceMovementKeys.has(key) || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      // Skip auto-repeat work — the Set already has this key, the walk
      // loop is already running, and flipping the walking flag again
      // would be a redundant React render.
      if (pressedWorkspaceKeysRef.current.has(key)) {
        return;
      }
      pressedWorkspaceKeysRef.current.add(key);
      // Flip walking class immediately. Previously this only happened on
      // the next rAF tick, which combined with the throttled tick cadence
      // and the CSS transition produced ~100ms of visible input lag. Now
      // the class is on the element by the time the next paint runs.
      if (!isPlayerWalkingRef.current) {
        isPlayerWalkingRef.current = true;
        setIsPlayerWalking(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!workspaceMovementKeys.has(key)) {
        return;
      }

      event.preventDefault();
      pressedWorkspaceKeysRef.current.delete(key);
    };

    // Walk loop. The previous implementation throttled state updates to
    // ~30fps and relied on a 70ms CSS transition on `left`/`top` to make
    // the motion read as smooth. That combination — first-tick skip
    // (~16ms) + throttle wait (up to 33ms) + transition catch-up (~70ms)
    // — added up to roughly 100ms of latency between pressing a key and
    // seeing the avatar actually start moving. Users felt it as a
    // "stutter on press".
    //
    // The new loop integrates Δt every frame (60fps when the browser
    // can hit it) and the CSS transition is gone, so each frame snaps
    // exactly to the integrated position. React re-rendering App.tsx
    // 60 times a second is fine in practice because the workspace view
    // doesn't render that much, and the responsiveness win is large.
    const SPEED_PERCENT_PER_SEC = 22;
    let frameId = 0;
    let lastTimestamp: number | null = null;
    const tick = (timestamp: number) => {
      const keys = pressedWorkspaceKeysRef.current;
      const dxKey = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const dyKey = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const hasKeyInput = dxKey !== 0 || dyKey !== 0;
      // キー入力があればタップ移動目的地をキャンセル（手動操作優先）
      if (hasKeyInput) {
        tapWalkTargetRef.current = null;
      }
      const tapTarget = tapWalkTargetRef.current;
      const isMoving = hasKeyInput || tapTarget !== null;

      if (!isMoving) {
        if (isPlayerWalkingRef.current) {
          isPlayerWalkingRef.current = false;
          setIsPlayerWalking(false);
        }
        lastTimestamp = null;
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      // walking flag を即時 ON（タップ直後にも歩行アニメが反映される）
      if (!isPlayerWalkingRef.current) {
        isPlayerWalkingRef.current = true;
        setIsPlayerWalking(true);
      }

      // Seed lastTimestamp on the first active frame so the integration
      // starts with a real Δt next frame — but DON'T skip the position
      // update; even a 1ms initial step is enough to register as "the
      // avatar moved" so the press feels instant.
      const previous = lastTimestamp ?? timestamp;
      lastTimestamp = timestamp;

      // Clamp huge gaps (tab unfocus, debugger pause, etc.) so we don't
      // teleport across the room on resume.
      const elapsed = Math.min(timestamp - previous, 64);
      const seconds = elapsed / 1000;
      const stepMagnitude = SPEED_PERCENT_PER_SEC * seconds;

      setPlayerPosition((position) => {
        if (hasKeyInput) {
          // キー操作 — 方向ベクトルで等速移動
          const length = Math.hypot(dxKey, dyKey) || 1;
          return {
            x: clampNumber(position.x + (dxKey / length) * stepMagnitude, 7, 93),
            y: clampNumber(position.y + (dyKey / length) * stepMagnitude, 14, 88),
          };
        }
        if (tapTarget) {
          // タップ移動 — 目的地に向けて毎フレーム step ずつ近付く
          const vx = tapTarget.x - position.x;
          const vy = tapTarget.y - position.y;
          const dist = Math.hypot(vx, vy);
          if (dist <= stepMagnitude || dist < 0.6) {
            // 到着 — 目的地を消費して位置をスナップ
            tapWalkTargetRef.current = null;
            return {
              x: clampNumber(tapTarget.x, 7, 93),
              y: clampNumber(tapTarget.y, 14, 88),
            };
          }
          const nx = vx / dist;
          const ny = vy / dist;
          return {
            x: clampNumber(position.x + nx * stepMagnitude, 7, 93),
            y: clampNumber(position.y + ny * stepMagnitude, 14, 88),
          };
        }
        return position;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.cancelAnimationFrame(frameId);
      pressedWorkspaceKeysRef.current.clear();
      isPlayerWalkingRef.current = false;
      setIsPlayerWalking(false);
    };
  }, [currentUser, currentView, canMoveInRoom]);

  const studyKnowledgeGraph = useMemo(() => buildStudyKnowledgeGraph(studyLogs), [studyLogs]);

  const currentUserUid = currentUser?.uid || "";
  // 開発者（管理）アカウント。このアカウントだけが他ユーザーを作業部屋から
  // 強制退出させられる。判定は profile ロード側（ADMIN_EMAIL）と同じメール。
  const isDeveloperAccount =
    (currentUser?.email || "").toLowerCase() === "ari.initx@gmail.com";
  const visibleTimelinePosts = useMemo(() => {
    if (timelineFilter === "all") {
      return posts;
    }
    const followingSet = new Set(following);
    if (currentUserUid) {
      followingSet.add(currentUserUid);
    }
    return posts.filter((post) => followingSet.has(post.userId));
  }, [posts, timelineFilter, following, currentUserUid]);
  const playerName =
    customUserName.trim() || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Developer";
  const playerInitial = playerName.slice(0, 1).toUpperCase();
  const isDesktopApp = Boolean(window.contributionArcDesktop?.isElectron);
  const isOnboardingSettings = onboardingStep === "settings";
  const weeklyStudyHours = getWeeklyStudyHours(studyLogs);
  const contributionArc = useMemo(() => getContributionArc(studyLogs), [studyLogs]);
  // GitHub contribution heatmap state. Fetched lazily from the public
  // jogruber endpoint once we know the user's GitHub username. Errors are
  // kept around so the UI can render a non-fatal "取得できませんでした" hint.
  const [githubContributions, setGithubContributions] = useState<GithubContributions | null>(null);
  const [githubContributionsError, setGithubContributionsError] = useState<string | null>(null);
  // GitHub login name mirrored from the cloud profile (users doc). The real
  // login is captured at sign-in via getAdditionalUserInfo, but that only
  // lands in *this device's* localStorage. On a second device (e.g. mobile
  // after linking on PC) that cache is empty, so we'd fall back to the
  // GitHub *display name* — which usually isn't the API-queryable login and
  // makes the contribution fetch fail. Reading the login that PC persisted
  // to Firestore lets every device resolve the same username.
  const [syncedGithubUsername, setSyncedGithubUsername] = useState("");
  // Drives the "GitHub アカウントを連携" CTA shown in the contribution-arc
  // card for users signed in via email or Google. linkWithPopup attaches
  // the GitHub provider to the existing Firebase user, so they don't need
  // to create a separate account just to surface their commits.
  const [isLinkingGithub, setIsLinkingGithub] = useState(false);
  const [linkGithubError, setLinkGithubError] = useState<string | null>(null);
  const githubContributionArc = useMemo(
    () => (githubContributions ? getGithubContributionArc(githubContributions.days) : null),
    [githubContributions],
  );
  // Flatten the GitHub 13-week grid into a date-keyed map so the unified
  // heatmap can look up commit count/level per cell in O(1) and blend it
  // with the study level on the same date.
  const githubByKey = useMemo(() => {
    const map = new Map<string, { count: number; level: 0 | 1 | 2 | 3 | 4 }>();
    if (!githubContributionArc) return map;
    for (const week of githubContributionArc.weeks) {
      for (const day of week.days) {
        if (day) map.set(day.key, { count: day.count, level: day.level });
      }
    }
    return map;
  }, [githubContributionArc]);
  const studyLogsByDay = useMemo(() => {
    const map = new Map<string, StudyLog[]>();
    for (const log of studyLogs) {
      const d = new Date(log.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(log);
      map.set(key, arr);
    }
    return map;
  }, [studyLogs]);
  // Shared aggregator used for both the 13-week donut and the per-day
  // donut. Bucketing by linked learning item (when present) keeps the
  // same item from splitting across multiple raw subject labels.
  const aggregateSubjectTotals = (logs: StudyLog[]) => {
    const itemById = new Map(learningItems.map((item) => [item.id, item] as const));
    const totals = new Map<string, { subject: string; minutes: number; color: string }>();
    for (const log of logs) {
      const linkedItem = log.learningItemId ? itemById.get(log.learningItemId) : undefined;
      const subject = linkedItem ? linkedItem.name : log.subject;
      const key = linkedItem ? `item:${linkedItem.id}` : `subject:${subject}`;
      const fallbackColor = linkedItem ? linkedItem.color : log.color || "rgba(31,111,74,0.7)";
      const entry = totals.get(key) || { subject, minutes: 0, color: fallbackColor };
      entry.minutes += log.minutes;
      if (linkedItem) {
        entry.color = linkedItem.color;
        entry.subject = linkedItem.name;
      } else if (log.color) {
        entry.color = log.color;
      }
      totals.set(key, entry);
    }
    const list = [...totals.values()].sort((a, b) => b.minutes - a.minutes);
    const TOP = 6;
    const top = list.slice(0, TOP);
    const rest = list.slice(TOP);
    const restMinutes = rest.reduce((sum, entry) => sum + entry.minutes, 0);
    if (restMinutes > 0) {
      top.push({ subject: "その他", minutes: restMinutes, color: "rgba(17,24,39,0.3)" });
    }
    const total = top.reduce((sum, entry) => sum + entry.minutes, 0);
    return { items: top, total };
  };
  const arcSubjectTotals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWeekday = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - ((CONTRIBUTION_ARC_WEEKS - 1) * 7 + todayWeekday));
    const windowed = studyLogs.filter((log) => {
      const d = new Date(log.createdAt);
      return !Number.isNaN(d.getTime()) && d >= startDate;
    });
    return aggregateSubjectTotals(windowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyLogs, learningItems]);
  const hoveredArcDayLogs = useMemo(() => {
    if (!hoveredArcCell) return [] as StudyLog[];
    return studyLogsByDay.get(hoveredArcCell.day.key) || [];
  }, [hoveredArcCell, studyLogsByDay]);

  const computeArcTooltipPlacement = (
    target: HTMLElement,
    day: ContributionArcDay,
  ): { day: ContributionArcDay; left: number; top: number; placement: "above" | "below" } | null => {
    const cellRect = target.getBoundingClientRect();

    // Estimate tooltip height from the day's actual content so a
    // 4-item + "more" + total + EXP tooltip (~260px) flips below
    // earlier than a 1-item tooltip (~110px). Numbers are rough
    // per-section measurements from the live tooltip CSS.
    const dayLogs = studyLogsByDay.get(day.key) || [];
    const visibleItems = Math.min(dayLogs.length, 4);
    const hasMore = dayLogs.length > 4;
    const PADDING = 20;
    const HEAD = 24;
    let estimatedHeight = PADDING + HEAD;
    if (day.minutes > 0) {
      estimatedHeight += 22; // total line
      estimatedHeight += visibleItems * 22; // each list row
      if (hasMore) estimatedHeight += 18;
      estimatedHeight += 22; // EXP footer
    } else {
      estimatedHeight += 14;
    }

    const ARROW_GAP = 10;
    const VIEWPORT_MARGIN = 12;
    // If "above" placement would overflow the viewport top, flip below.
    const wouldClipAbove = cellRect.top < estimatedHeight + ARROW_GAP + VIEWPORT_MARGIN;
    const viewportH = window.innerHeight;
    const wouldClipBelowIfFlipped =
      cellRect.bottom + estimatedHeight + ARROW_GAP + VIEWPORT_MARGIN > viewportH;

    // Prefer "above". Only flip "below" when above clips AND below has room.
    const placement: "above" | "below" =
      wouldClipAbove && !wouldClipBelowIfFlipped ? "below" : "above";

    // Coordinates are viewport-relative because the tooltip is
    // `position: fixed` — needed to escape the `.contribution-arc-grid`
    // scroll container (overflow-x: auto forces overflow-y to clip too).
    return {
      day,
      left: cellRect.left + cellRect.width / 2,
      top: placement === "below" ? cellRect.bottom : cellRect.top,
      placement,
    };
  };
  const selectedArcDay = useMemo(() => {
    if (!selectedArcDayKey) return null;
    for (const week of contributionArc.weeks) {
      for (const day of week.days) {
        if (day && day.key === selectedArcDayKey) return day;
      }
    }
    return null;
  }, [contributionArc, selectedArcDayKey]);
  const selectedArcDayLogs = useMemo(() => {
    if (!selectedArcDay) return [] as StudyLog[];
    return studyLogsByDay.get(selectedArcDay.key) || [];
  }, [studyLogsByDay, selectedArcDay]);
  // Donut switches between "selected day" and "13-week total" depending
  // on whether a heatmap cell is currently selected. Memoised separately
  // so a selection change only recomputes the small per-day breakdown.
  const selectedArcDaySubjectTotals = useMemo(() => {
    if (!selectedArcDay) return null;
    return aggregateSubjectTotals(selectedArcDayLogs);
    // aggregateSubjectTotals reads learningItems from closure each render —
    // that's fine because it's only called inside this memo when inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArcDay, selectedArcDayLogs, learningItems]);
  const donutDisplay = useMemo(() => {
    // When a heatmap day is selected, always show that day's data —
    // even if it's empty (no study logs). Selecting an empty day still
    // needs to update the donut so the user gets clear feedback that
    // their click registered.
    if (selectedArcDay) {
      const totals = selectedArcDaySubjectTotals ?? { items: [], total: 0 };
      return {
        ...totals,
        label: t("{month}月{day}日", { month: selectedArcDay.date.getMonth() + 1, day: selectedArcDay.date.getDate() }),
        isDaily: true,
        // Stable key so framer-motion's AnimatePresence re-mounts on
        // day change, triggering the swap animation.
        key: `day-${selectedArcDay.key}`,
      };
    }
    return {
      ...arcSubjectTotals,
      label: t("13週合計"),
      isDaily: false,
      key: "total",
    };
  }, [selectedArcDay, selectedArcDaySubjectTotals, arcSubjectTotals, t]);
  const contributionArcCurvePath = useMemo(() => {
    const weekMinutes = contributionArc.weekMinutes;
    if (weekMinutes.length === 0) return "";
    const max = Math.max(1, ...weekMinutes);
    const width = 100;
    const height = 100;
    return weekMinutes
      .map((m, i) => {
        const x = (i / Math.max(1, weekMinutes.length - 1)) * width;
        const y = height - (m / max) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [contributionArc.weekMinutes]);
  const effortExp = getEffortExp(studyLogs);
  const outputExp = getOutputExp();
  const levelState = getLevelState(effortExp + outputExp);
  const titles = getTitleRanks(studyLogs, effortExp, outputExp);
  const currentTitle =
    [...titles].reverse().find((title) => title.unlocked)?.name || "Commit Knight";
  const studyStreak = getStudyStreak(studyLogs);
  const githubProviderInfo = currentUser?.providerData.find((provider) => provider.providerId === "github.com");
  const githubId = githubProviderInfo?.uid || "";
  // Prefer the cached GitHub login captured at sign-in (via
  // getAdditionalUserInfo) because providerData.displayName is the user's
  // GitHub *display name*, which often differs from the login the
  // contributions API needs. Fall back to displayName, then to userId.
  const githubLoginCached = (() => {
    if (!currentUser || !githubProviderInfo) return "";
    try {
      return window.localStorage.getItem(`ca:gh-login:${currentUser.uid}`) || "";
    } catch {
      return "";
    }
  })();
  // Resolution order: this device's sign-in cache → the login synced from
  // the cloud profile (covers a fresh device) → the GitHub display name →
  // userId. Only resolve when the GitHub provider is actually linked so an
  // unlinked account doesn't keep querying a stale synced login.
  const githubUsername = githubProviderInfo
    ? githubLoginCached || syncedGithubUsername || githubProviderInfo.displayName || userId
    : "";
  // Lazy-fetch the user's public GitHub contribution grid. If the first
  // candidate (the resolved username above) doesn't exist on GitHub — which
  // happens when displayName ≠ login — we transparently retry with the
  // remaining candidates so a single bad fallback can't permanently break
  // the grid. Successful candidates are persisted back to localStorage so
  // subsequent mounts skip the retry.
  const githubCandidatesKey = [
    githubLoginCached,
    syncedGithubUsername,
    githubProviderInfo?.displayName || "",
    userId,
  ]
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    if (!githubProviderInfo) return;
    const candidates = Array.from(
      new Set(
        [
          githubLoginCached,
          syncedGithubUsername,
          githubProviderInfo.displayName || "",
          userId,
        ]
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
    if (candidates.length === 0) return;
    let cancelled = false;
    setGithubContributionsError(null);
    (async () => {
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const data = await fetchGithubContributions(candidate);
          if (cancelled) return;
          setGithubContributions(data);
          // Pin the working candidate so future mounts/devices skip the
          // retry loop and the cloud-synced login converges to a real one.
          if (currentUser && candidate !== githubLoginCached) {
            safeSetLocalStorage(`ca:gh-login:${currentUser.uid}`, candidate);
          }
          if (candidate !== syncedGithubUsername) {
            setSyncedGithubUsername(candidate);
          }
          return;
        } catch (err) {
          lastError = err;
          // レート制限に当たったら、残りの候補を試さず即中断する。
          // 候補を総当たりすると 1 ユーザーで最大 4 リクエストになり、
          // レート制限を悪化させるため (コスト削減の肝)。
          if (err instanceof GithubRateLimitError) {
            break;
          }
        }
      }
      if (cancelled) return;
      const message =
        lastError instanceof GithubRateLimitError
          ? lastError.message
          : lastError instanceof Error
            ? lastError.message
            : String(lastError);
      setGithubContributionsError(message);
    })();
    return () => {
      cancelled = true;
    };
  }, [githubProviderInfo, githubCandidatesKey, currentUser, githubLoginCached, syncedGithubUsername, userId]);
  const totalWeeklyMinutes = weeklyStudyHours.reduce((sum, item) => sum + item.totalMinutes, 0);
  const todayStudyMinutes = weeklyStudyHours.find((item) => item.isToday)?.totalMinutes ?? 0;
  /* Phase 10d: クイック記録ポップオーバーに並べる「最近の対象」.
     直近の studyLogs を新しい順に走査して、まだ拾っていない
     learningItemId を集める. archived は除外、最大 5 件まで.
     登録 0 件のときは空配列 — ポップオーバー側で「学習対象を追加」へ
     誘導する空状態を出す. */
  const quickLogRecentItems = useMemo(() => {
    const activeItems = learningItems.filter((item) => !item.archived);
    if (activeItems.length === 0) return [] as LearningItem[];
    const byId = new Map(activeItems.map((item) => [item.id, item] as const));
    const ordered: LearningItem[] = [];
    const seen = new Set<string>();
    for (let i = studyLogs.length - 1; i >= 0 && ordered.length < 5; i--) {
      const log = studyLogs[i];
      const id = log.learningItemId;
      if (!id || seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      ordered.push(item);
      seen.add(id);
    }
    // 直近ログが少ないユーザーは、最近作った Learning Item で補完
    // する. 全く記録していない状態でもポップオーバーから出発できる.
    if (ordered.length < 5) {
      const remaining = activeItems
        .filter((item) => !seen.has(item.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      for (const item of remaining) {
        if (ordered.length >= 5) break;
        ordered.push(item);
        seen.add(item.id);
      }
    }
    return ordered;
  }, [studyLogs, learningItems]);


  const closeQuickLogPopover = useCallback(() => {
    setIsQuickLogPopoverOpen(false);
    setQuickLogMinutesById({});
  }, []);

  // 「記録する」CTA をもう一度押すと閉じるトグル動作。
  // モバイルでは右上の "×" よりも、慣れたボトムナビの CTA が
  // 自然な「閉じる」導線になる。state を見て open / close を切替。
  const toggleQuickLogPopover = useCallback(() => {
    setIsQuickLogPopoverOpen((open) => {
      if (open) {
        setQuickLogMinutesById({});
        return false;
      }
      setQuickLogMinutesById({});
      return true;
    });
  }, []);
  // Most-time-spent subject of today's logs — used as the share-image label.
  const todayTopSubject = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = studyLogs.filter((log) => {
      const day = new Date(log.createdAt);
      day.setHours(0, 0, 0, 0);
      return day.getTime() === today.getTime();
    });
    if (todays.length === 0) return "";
    const tally = new Map<string, number>();
    for (const log of todays) {
      tally.set(log.subject, (tally.get(log.subject) || 0) + log.minutes);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [studyLogs]);
  const [isShareToXOpen, setIsShareToXOpen] = useState(false);
  const lastStudyLog = useMemo(() => {
    if (studyLogs.length === 0) {
      return null;
    }
    return [...studyLogs].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    })[0];
  }, [studyLogs]);
  const baseWorkspaceRooms = [...workspaceRooms, ...customRooms]
    .map(normalizeWorkspaceRoom)
    .filter((room) => !isLegacyWorkspaceRoom(room));
  /* mina / nishimiya は表示専用のスケジュール NPC。決定論的に部屋を
     選ぶので、解体後の localStorage cache の幽霊部屋や、まだ
     remote 同期されていない pending 新規部屋が候補に混じると
     「解体した部屋に NPC が入る」謎演出になる。
     → Firestore で実在が確認された (= remote snapshot に居る) 部屋
     だけを NPC 配置の候補にして、幽霊部屋への注入を遮断する。 */
  const npcCandidateRoomIds = new Set([
    ...remoteWorkspaceRoomsRef.current.rooms.map((room) => room.id),
    ...remoteWorkspaceRoomsRef.current.legacyRooms.map((room) => room.id),
  ]);
  const npcCandidateRooms = baseWorkspaceRooms.filter((room) =>
    npcCandidateRoomIds.has(room.id),
  );
  const scheduledMinaRoomId = getScheduledMinaRoomId(npcCandidateRooms, workspaceNow);
  const scheduledNishimiyaRoomId = getScheduledNishimiyaRoomId(npcCandidateRooms, workspaceNow);
  const allWorkspaceRooms = baseWorkspaceRooms
    .map((room) =>
      normalizeWorkspaceRoom(
        applyScheduledWorkspacePresence(room, workspaceNow, scheduledMinaRoomId, scheduledNishimiyaRoomId),
      ),
    )
    /* Org-private rooms only surface for members of their owning org.
       Public rooms (the implicit default) stay visible to everyone.
       Room owners always see their own rooms regardless of visibility,
       so they can return to manage them even after leaving the org. */
    .filter((room) => {
      if (room.visibility !== "org") return true;
      if (room.createdBy === currentUser?.uid) return true;
      if (currentOrganization && room.ownerOrgId === currentOrganization.id) return true;
      return false;
    });
  const selectedRoom = allWorkspaceRooms.find((room) => room.id === selectedRoomId) || allWorkspaceRooms[0];
  const currentBuilding = workspaceTask.trim() || studySubject.trim() || "Deep work";
  /* YYYY-MM-DD for the user's local day. Re-computed every render so
     a midnight roll-over flips the daily-reward gate without needing
     a separate timer. */
  const todayDateKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  })();
  const activeRoom =
    allWorkspaceRooms.find((room) => room.activeMembers.some((member) => member.userId === currentUserUid)) || null;
  const githubConnectionLabel = githubId ? "GitHub connected" : "GitHub ready";
  const isInSelectedRoom = Boolean(
    selectedRoom?.activeMembers.some((member) => member.userId === currentUserUid),
  );
  const visibleMembers = selectedRoom?.activeMembers || [];
  const currentPresence = visibleMembers.find((member) => member.userId === currentUserUid) || null;
  const currentStayMinutes = currentPresence ? getWorkspaceActiveMinutes(currentPresence, workspaceNow) : 0;

  /* Focus Chip grant loop — every 25 minutes of in-room presence on a
     given calendar day awards 1 chip, capped at 8/day. The snapshot
     tracks "minutes already credited" so the user can leave and come
     back without losing or double-claiming partial progress. Day
     rollover (different `focusChipsDate`) zeroes both the chip count
     and the snapshot so a streak from yesterday doesn't suddenly
     materialise after midnight. */
  useEffect(() => {
    if (!currentUser) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    if (focusChipsDate !== todayKey) {
      setFocusChipsDate(todayKey);
      setFocusChips(0);
      // Yesterday's accumulated minutes don't count toward today.
      setFocusStayMinutesSnapshot(currentStayMinutes);
      return;
    }
    const FOCUS_CHIP_INTERVAL_MIN = 25;
    const FOCUS_CHIP_DAILY_CAP = 8;
    if (focusChips >= FOCUS_CHIP_DAILY_CAP) return;
    const diff = currentStayMinutes - focusStayMinutesSnapshot;
    if (diff < FOCUS_CHIP_INTERVAL_MIN) return;
    const earnable = Math.floor(diff / FOCUS_CHIP_INTERVAL_MIN);
    const room = FOCUS_CHIP_DAILY_CAP - focusChips;
    const grant = Math.min(earnable, room);
    if (grant <= 0) return;
    setFocusChips((v) => v + grant);
    setFocusStayMinutesSnapshot((v) => v + grant * FOCUS_CHIP_INTERVAL_MIN);
    /* Focus Chip 獲得時のトースト ("+N Focus Chip … 残り X 枚") は
       ユーザー指摘でホームに毎回出るのが煩わしいため非表示。
       チップは引き続き残高に反映される。ポーカー画面の Focus 残高
       メーターで状況確認できる。 */
  }, [
    currentStayMinutes,
    focusChipsDate,
    focusChips,
    focusStayMinutesSnapshot,
    currentUser,
  ]);

  const resolvedVisibleMembers = visibleMembers.map((member) => {
    const profile = workspaceProfiles[member.userId];
    const isCurrentUserMember = member.userId === currentUserUid;
    const nextName = isCurrentUserMember ? playerName : profile?.displayName || member.name;
    const nextCharacterColor = isCurrentUserMember
      ? playerCharacterColor
      : getSafeCharacterColor(profile?.characterColor || member.characterColor || member.color);
    /* Shape resolves in the same priority order as color:
       - Current user always reflects local state immediately
       - Other users prefer their live profile, then the snapshot
         that was stored on their presence entry. Falls back to
         "default" for legacy data. */
    const nextCharacterShape: CharacterShape = isCurrentUserMember
      ? playerCharacterShape
      : getSafeCharacterShape(profile?.characterShape || member.characterShape);

    return {
      ...member,
      name: nextName,
      characterColor: nextCharacterColor,
      color: nextCharacterColor,
      characterShape: nextCharacterShape,
      avatar: "",
    };
  });
  const workspaceActors = resolvedVisibleMembers.map((member) =>
    member.userId === currentUserUid
      ? {
          ...member,
          x: playerPosition.x,
          y: playerPosition.y,
        }
      : {
          ...member,
          ...workspaceActorSlots[
            Math.abs(
              Array.from(member.userId || member.id).reduce((sum, character) => sum + character.charCodeAt(0), 0),
            ) % workspaceActorSlots.length
          ],
        },
  );
  const roomMonuments = buildRoomMonuments(resolvedVisibleMembers, workspaceProfiles, t);

  // Subscribe to the selected room's floor notes while it's open. Cheap:
  // a single onSnapshot over a tiny, capped subcollection, torn down when
  // you leave the room or close it.
  const selectedRoomNotesId = selectedRoom?.id || "";
  useEffect(() => {
    if (!currentUser || !selectedRoomNotesId) {
      setFloorNotes([]);
      return;
    }
    const unsubscribe = subscribeFloorNotes(
      db,
      selectedRoomNotesId,
      (notes) => setFloorNotes(notes),
      (error) => console.info("Floor notes sync skipped.", error),
    );
    return () => unsubscribe();
  }, [currentUser, selectedRoomNotesId]);

  /* ルームチャットの購読。selectedRoom が変わるたびに張り替え。
     PC は workspace view を開いている時のみ、モバイルは atelier view
     開いている時のみ (currentView === "workspace"). */
  useEffect(() => {
    if (!currentUser || !selectedRoomNotesId || currentView !== "workspace") {
      setRoomChatMessages([]);
      return;
    }
    const unsubscribe = subscribeRoomChat(
      db,
      selectedRoomNotesId,
      (messages) => setRoomChatMessages(messages),
      (error) => console.info("Room chat sync skipped.", error),
    );
    return () => unsubscribe();
  }, [currentUser, selectedRoomNotesId, currentView]);

  const handleRoomChatSend = async (rawText: string): Promise<boolean> => {
    if (!currentUser || !selectedRoom) {
      setRoomChatError(t("送信できません。ルームを選択してください。"));
      return false;
    }
    const text = rawText.trim().slice(0, 280);
    if (!text) return false;
    if (containsBlockedWord(text)) {
      setRoomChatError(t("不適切な言葉が含まれているため送信できません。"));
      return false;
    }
    setRoomChatError("");
    try {
      await sendRoomChatMessage(db, {
        roomId: selectedRoom.id,
        userId: currentUser.uid,
        userName: playerName || "Developer",
        characterColor: playerCharacterColor,
        characterShape: playerCharacterShape,
        text,
      });
      return true;
    } catch (error) {
      console.info("Room chat send failed.", error);
      setRoomChatError(t("送信に失敗しました。時間をおいて再度お試しください。"));
      return false;
    }
  };

  const floorNoteMarkers: FloorNoteMarker[] = floorNotes.map((note) => ({
    id: note.id,
    name: note.name,
    color: note.color,
    x: note.x,
    y: note.y,
    isMine: note.userId === currentUserUid,
    isUnread: note.userId !== currentUserUid && !readFloorNoteIds.has(note.id),
  }));

  const roomTotalMinutes =
    (selectedRoom?.totalMinutes || 0) +
    visibleMembers.reduce((sum, member) => sum + getWorkspaceActiveMinutes(member, workspaceNow), 0);
  const roomCommits = (selectedRoom?.commits || 0) + outputStats.commits;
  const roomOnlineCount = visibleMembers.length;
  const activeMembers = allWorkspaceRooms.flatMap((room) => room.activeMembers);
  const pinnedFriendUidSet = new Set(pinnedFriendUids);
  const sidebarFriends = friends
    .map((friend) => {
      // 友達の最新プロフィール（クラウドから随時取得される workspaceProfiles
      // を流用）。表示名・avatar・determination・キャラ色などが本人の変更を
      // 即座に反映する。なければ申請時の snapshot をそのまま使う（fallback）。
      const liveProfile = workspaceProfiles[friend.uid];
      const enriched = liveProfile
        ? {
            ...friend,
            name: liveProfile.displayName || friend.name,
            avatar: liveProfile.photoURL || friend.avatar,
            userId: liveProfile.userId || friend.userId,
          }
        : friend;

      const activeFriend = activeMembers.find((member) => member.userId === friend.uid);
      if (activeFriend) {
        return {
          ...enriched,
          status: "online" as const,
          activity: t("学習中: {building}", { building: activeFriend.building }),
        };
      }

      return enriched;
    })
    // ピン留めされた友達を先頭に。残りは元の順序を維持（接続順）。
    .sort((a, b) => {
      const aPinned = pinnedFriendUidSet.has(a.uid) ? 0 : 1;
      const bPinned = pinnedFriendUidSet.has(b.uid) ? 0 : 1;
      return aPinned - bPinned;
    });
  // Hide short pings, then collapse runs of identical sessions (same subject +
  // minutes from the same author) into a single row with a ×N badge so the
  // ticker doesn't repeat "Ari completed 5分 開発" five times in a row.
  const eligibleStudyLogs = [...studyLogs]
    .filter((log) => log.minutes >= LIVE_ACTIVITY_MIN_MINUTES)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  type StudyActivityGroup = { log: StudyLog; count: number };
  const studyActivityGroups: StudyActivityGroup[] = [];
  for (const log of eligibleStudyLogs) {
    const last = studyActivityGroups[studyActivityGroups.length - 1];
    if (last && last.log.subject === log.subject && last.log.minutes === log.minutes) {
      last.count += 1;
    } else {
      studyActivityGroups.push({ log, count: 1 });
    }
  }
  const selectedRoomPosts = selectedRoom ? posts.filter((post) => post.roomId === selectedRoom.id).slice(0, 4) : [];
  const selectedDailyReport = dailyReports.find((report) => report.date === selectedDailyDate) || null;
  const currentLearnerDate = getLearnerDate(new Date(feedNowTick));
  const todayDailyReport = dailyReports.find((report) => report.date === currentLearnerDate) || null;
  // 連続日報ストリーク (今日まで連続して書いた日数)
  const dailyReportStreak = useMemo(() => getDailyReportStreak(dailyReports), [dailyReports]);
  // 日報を 1 枚の画像カードに書き出して共有/保存する。ネイティブな
  // ホーム画面ウィジェットは Web では作れないため、「写真に保存 → iOS
  // の写真ウィジェット/ショートカットで置く」導線の起点にする。
  // 保存前のライブ下書きを優先し、無ければ保存済みレポートを使う。
  const handleShareDailyImage = async () => {
    const sourceItems =
      dailyPlanItemsDraft.length > 0
        ? dailyPlanItemsDraft
        : selectedDailyReport?.planItems ?? [];
    const planItems = sourceItems
      .map((item) => ({ text: item.text, done: item.done }))
      .filter((item) => item.text.trim());
    const reflectionFromDraft = serializeReflectionParts(dailyReflectionPartsDraft);
    const reflection = (reflectionFromDraft || selectedDailyReport?.reflection || "").trim();
    if (planItems.length === 0 && !reflection) {
      setDailyMessage(t("共有できる内容がまだありません。"));
      return;
    }
    try {
      const dateLabel = formatDailyDate(selectedDailyDate, language);
      const blob = await createDailyReportImageBlob({
        dateLabel,
        authorName: selectedDailyReport?.userName || playerName || "Developer",
        streakDays: dailyReportStreak,
        planItems,
        reflection,
        labels: {
          kicker: "DAILY REPORT",
          planTitle: t("今日やること"),
          reflectionTitle: t("振り返り"),
          emptyPlaceholder: t("（まだありません）"),
          untitled: t("（無題）"),
          streakSuffix: (days) => t("{count}日連続", { count: days }),
          shareTitle: (label) => t("{date}の日報", { date: label }),
        },
      });
      const filename = dailyShareFilename(dateLabel);
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      // モバイル等 (ファイル共有対応) は従来どおりネイティブ共有シート。
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: t("{date}の日報", { date: dateLabel }) });
          setDailyMessage("");
          return;
        } catch (err) {
          // ユーザーキャンセルはそこで終了。それ以外はプレビューに倒す。
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      // PC など非対応環境: プレビューモーダルで保存 / コピーを選ばせる。
      setDailySharePreview({ url: URL.createObjectURL(blob), blob, filename });
      setDailyMessage("");
    } catch {
      setDailyMessage(t("画像の作成に失敗しました。"));
    }
  };

  const closeDailySharePreview = () => {
    setDailySharePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handleSaveDailyShareImage = () => {
    if (!dailySharePreview) return;
    const a = document.createElement("a");
    a.href = dailySharePreview.url;
    a.download = dailySharePreview.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDailyMessage(t("画像を保存しました。ホーム画面の写真ウィジェットに置けます。"));
  };

  const handleCopyDailyShareImage = async () => {
    if (!dailySharePreview) return;
    const clip = navigator as Navigator & {
      clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> };
    };
    if (typeof ClipboardItem === "undefined" || !clip.clipboard?.write) {
      setDailyMessage(t("この環境ではコピーに非対応です。保存をご利用ください。"));
      return;
    }
    try {
      await clip.clipboard.write([
        new ClipboardItem({ "image/png": dailySharePreview.blob }),
      ]);
      setDailyMessage(t("画像をクリップボードにコピーしました。"));
    } catch {
      setDailyMessage(t("コピーに失敗しました。保存をご利用ください。"));
    }
  };
  // Plan items の完了率 (進捗バー用)
  const planProgress = useMemo(() => {
    const valid = dailyPlanItemsDraft.filter((item) => item.text.trim().length > 0);
    if (valid.length === 0) return { total: 0, done: 0, ratio: 0 };
    const done = valid.filter((item) => item.done).length;
    return { total: valid.length, done, ratio: done / valid.length };
  }, [dailyPlanItemsDraft]);

  /* 平日連続記録(ストリーク)。学習記録・日報・GitHub のいずれかが
     ある平日を連結して数える(土日は対象外・猶予なし)。既存データの
     集計のみで、新規 onSnapshot や write は無し。dailyReports は他人の
     共有日報も含むので自分の userId に絞る. */
  const weekdayStreak = useMemo(() => {
    const active = new Set<string>();
    for (const log of studyLogs) {
      const d = new Date(log.createdAt);
      if (!Number.isNaN(d.getTime())) active.add(getLearnerDate(d));
    }
    const uid = currentUser?.uid;
    for (const report of dailyReports) {
      if (uid && report.userId !== uid) continue;
      if (report.date) active.add(report.date);
    }
    if (githubContributions) {
      for (const day of githubContributions.days) {
        if (day.count > 0) active.add(day.date);
      }
    }
    return computeStudyStreak(active, currentLearnerDate);
  }, [studyLogs, dailyReports, githubContributions, currentUser?.uid, currentLearnerDate]);
  const canEditSelectedDailyReport = canEditDailyReportDate(selectedDailyDate);
  /* Candidate pool for @mentions inside the daily editor. We surface
     org members first — in the B2B context they're the people you
     actually want to call out by name. Solo users with no org get an
     empty pool, so the popup simply never appears (typing `@foo`
     still works as plain text). */
  const dailyMentionCandidates: MentionCandidate[] = useMemo(
    () =>
      orgMembers
        .filter((member) => member.userId && member.uid !== currentUserUid)
        .map((member) => ({
          userId: member.userId,
          displayName: member.displayName || member.userId,
          avatarUrl: member.avatarUrl || undefined,
        })),
    [orgMembers, currentUserUid],
  );
  /* userId → display name resolver for rendering inline mentions in
     the team feed / modal. Built once per render rather than per
     mention token so a long body with many @mentions stays cheap. */
  const dailyMentionLookup = useMemo(() => {
    const map = new Map<string, string>();
    orgMembers.forEach((member) => {
      if (member.userId) map.set(member.userId, member.displayName || member.userId);
    });
    if (userId) {
      map.set(userId, playerName || userId);
    }
    return (id: string) => map.get(id);
  }, [orgMembers, userId, playerName]);
  const allVisibleSharedDailyReports = Array.from(
    new Map([...sharedDailyReports, ...dailyReports].map((report) => [report.id, report])).values(),
  )
    // Drafts never reach Firestore, but `dailyReports` (own cache) can
    // hold a local-only draft for today — exclude it from the team
    // feed so the writer's own placeholder doesn't leak in.
    .filter((report) => report.isDraft !== true)
    .sort((a, b) => b.date.localeCompare(a.date) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  // 旧名は描画 limit 後のリストを指していた。互換のため変数名を維持。
  const visibleSharedDailyReports = allVisibleSharedDailyReports.slice(0, sharedDailyDisplayLimit);
  const hasMoreSharedDailyReports =
    allVisibleSharedDailyReports.length > visibleSharedDailyReports.length;
  const normalizedDailyHistorySearch = dailyHistorySearch.trim().toLowerCase();
  const filteredDailyReports = dailyReports.filter((report) => {
    const matchesDate = !dailyHistoryDateFilter || report.date === dailyHistoryDateFilter;
    const searchableText = [
      report.date,
      formatDailyDate(report.date, "ja"),
      formatDailyDate(report.date, "en"),
      report.plan,
      report.reflection,
      report.userName || "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedDailyHistorySearch || searchableText.includes(normalizedDailyHistorySearch);

    return matchesDate && matchesSearch;
  });
  const accountScope = getAccountStorageScope(currentUserUid, userId);
  const sameRoomUserIds = new Set(
    allWorkspaceRooms
      .filter((room) => room.activeMembers.some((member) => member.userId === currentUserUid))
      .flatMap((room) => room.activeMembers.map((member) => member.userId)),
  );
  const notifiableUserIds = new Set([...friends.map((friend) => friend.uid), ...sameRoomUserIds]);
  const notificationFeedItems = appNotifications
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);
  const unreadNotificationCount = appNotifications.filter((item) => !item.read).length;
  const handleNotificationSoundTest = () => {
    lastNotificationSoundAtRef.current = 0;
    void playNotificationSound("default", desktopNotificationSettings);
  };
  const pushAppNotification = (item: NotificationItem, shouldSendNative: boolean) => {
    // ブロック中のユーザーからの通知は完全に無視。
    if (blockedFriendUids.includes(item.sourceUserId)) {
      seenNotificationKeysRef.current.add(item.id);
      return;
    }
    const cooldownKey = `${item.type}:${item.sourceUserId}`;
    const now = Date.now();
    const lastNotifiedAt = notificationCooldownRef.current[cooldownKey] || 0;
    // ミュート中：一覧には残すがネイティブ通知 / 音は抑制。
    const isMuted = mutedFriendUids.includes(item.sourceUserId);
    const canSendNative = shouldSendNative && !isMuted && now - lastNotifiedAt > notificationCooldownMs;
    const canPlaySound =
      canSendNative &&
      desktopNotificationSettings.sound &&
      now - lastNotificationSoundAtRef.current > notificationSoundCooldownMs;

    seenNotificationKeysRef.current.add(item.id);
    if (canSendNative) {
      notificationCooldownRef.current[cooldownKey] = now;
      void window.contributionArcDesktop?.notify?.({
        title: item.title,
        body: item.body,
      });
    }
    if (canPlaySound) {
      lastNotificationSoundAtRef.current = now;
      void playNotificationSound(item.type, desktopNotificationSettings);
    }

    setAppNotifications((items) => {
      if (items.some((existingItem) => existingItem.id === item.id)) {
        return items;
      }

      return [item, ...items].slice(0, 40);
    });
  };

  /* like 通知専用の upsert。pushAppNotification は同 id がある時 skip
     する dedup 動作だが、like は「連続で付けたり消したりしても最新の
     ものだけが残る」要件があるので、同 id があったら除去してから先頭に
     append する形に変える (＝最新位置に上書き)。 */
  const upsertAppNotification = (item: NotificationItem) => {
    // ブロック中のユーザーからの通知は完全に無視 (push と同条件)
    if (blockedFriendUids.includes(item.sourceUserId)) return;
    setAppNotifications((items) => {
      const filtered = items.filter((existing) => existing.id !== item.id);
      return [item, ...filtered].slice(0, 40);
    });
  };

  const handleNotificationsToggle = () => {
    const nextIsOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextIsOpen);

    if (nextIsOpen) {
      const nextReadAt = new Date().toISOString();
      setLastNotificationReadAt(nextReadAt);
      safeSetLocalStorage(getAccountStorageKey(accountScope, "notifications-read-at"), nextReadAt);
      setAppNotifications((items) => items.map((item) => ({ ...item, read: true })));
    }
  };
  // 退出忘れ対策の在室上限ウォッチャー。入室から maxWorkspacePresenceMinutes
  // （＝20時間）が経過したら自動退室させる。タブ非表示中も「裏で作業中」と
  // みなすので無操作では退室させない。markActivity は EXP 計測（入室〜最終操作）
  // 用に最終操作時刻を記録するだけで、退室判定には使わない。
  // フック順序を一定に保つため、必ず early return より前のこの位置に置く。
  useEffect(() => {
    const joinedAt = currentPresence?.joinedAt;
    if (
      !currentUser ||
      currentView !== "workspace" ||
      !selectedRoomId ||
      !isInSelectedRoom ||
      !joinedAt
    ) {
      return;
    }
    const roomId = selectedRoomId;
    const joinedAtMs = new Date(joinedAt).getTime();
    // 起動時点で既に在室上限を超えている＝退出し忘れのゴースト在席。最終操作時刻が
    // 残っていないため実測はできないので、一律 4 時間（240分）として強制退出させる。
    if (Date.now() - joinedAtMs >= maxWorkspacePresenceMinutes * 60000) {
      closeWorkspaceSessionRef.current(roomId, { auto: true, overrideMinutes: 240 });
      return;
    }
    lastWorkspaceActivityRef.current = Date.now();
    const markActivity = () => {
      lastWorkspaceActivityRef.current = Date.now();
    };
    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "pointerdown",
      "wheel",
      "touchstart",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true }),
    );
    const interval = window.setInterval(() => {
      if (Date.now() - joinedAtMs >= maxWorkspacePresenceMinutes * 60000) {
        closeWorkspaceSessionRef.current(roomId, { auto: true });
      }
    }, 60000);
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, markActivity));
      window.clearInterval(interval);
    };
  }, [currentUser, currentView, selectedRoomId, isInSelectedRoom, currentPresence?.joinedAt]);
  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    const startedAt = notificationStartedAtRef.current - 5000;
    const isRecentEnough = (createdAt: string) => new Date(createdAt).getTime() >= startedAt;

    visibleSharedDailyReports.forEach((report) => {
      const notificationId = `dailyLog:${report.id}:${report.updatedAt}`;
      const sourceUserId = report.userId;
      const createdAt = report.updatedAt || report.createdAt;
      const isRelevantUser = sourceUserId !== currentUserUid && notifiableUserIds.has(sourceUserId);

      if (!isRelevantUser || seenNotificationKeysRef.current.has(notificationId)) {
        return;
      }

      if (!isRecentEnough(createdAt)) {
        seenNotificationKeysRef.current.add(notificationId);
        return;
      }

      pushAppNotification(
        {
          id: notificationId,
          type: "dailyLog",
          title: t("{name}の日報", { name: report.userName || "Developer" }),
          body: (
            extractReflectionPreview(report.reflection) ||
            report.plan ||
            t("日報が更新されました。")
          ).slice(0, 120),
          createdAt,
          read: false,
          sourceUserId,
        },
        desktopNotificationSettings.dailyLog,
      );
    });

    posts.forEach((post) => {
      const notificationId = `post:${post.id}`;
      const sourceUserId = post.userId;
      const isSameRoomPost = Boolean(
        post.roomId &&
          allWorkspaceRooms.some(
            (room) => room.id === post.roomId && room.activeMembers.some((member) => member.userId === currentUserUid),
          ),
      );
      const isRelevantUser =
        sourceUserId !== currentUserUid && (friends.some((friend) => friend.uid === sourceUserId) || isSameRoomPost);

      if (!isRelevantUser || seenNotificationKeysRef.current.has(notificationId)) {
        return;
      }

      if (!isRecentEnough(post.createdAt)) {
        seenNotificationKeysRef.current.add(notificationId);
        return;
      }

      pushAppNotification(
        {
          id: notificationId,
          type: "post",
          title: t("{name}の投稿", { name: post.username }),
          body: post.text.slice(0, 120),
          createdAt: post.createdAt,
          read: false,
          sourceUserId,
        },
        desktopNotificationSettings.post,
      );
    });

    // Like notifications — 自分の post に他人が like を付けた瞬間に通知。
    //  - 初回ハイドレート時はスナップショットだけ保存、通知は出さない
    //    (起動時に既存 like がずらっと並ぶのを避ける)
    //  - 2回目以降は「前回には居なかった likerUid」を差分検知
    //  - 通知 id を `like:${postId}:${likerUid}` で固定して upsert
    //  - 再 like ( unlike → like ) は前回に居ないので新規通知として再発火
    //    upsert により同 id の既存通知が最新位置に置換される
    //    → 「連続で付けたり消したりしても最新だけが残る」を実現
    if (!likeNotificationsInitializedRef.current) {
      posts.forEach((post) => {
        prevLikedSnapshotRef.current.set(post.id, new Set(post.likedUserIds));
      });
      likeNotificationsInitializedRef.current = true;
    } else {
      posts.forEach((post) => {
        const prevLikers = prevLikedSnapshotRef.current.get(post.id) || new Set<string>();
        const currentLikers = new Set(post.likedUserIds);
        if (post.userId === currentUserUid) {
          // 自分の投稿に新規 like が付いた liker を抽出
          currentLikers.forEach((likerUid) => {
            if (likerUid === currentUserUid) return;
            if (prevLikers.has(likerUid)) return; // 前回も like 済み → diff なし
            const likerProfile = workspaceProfiles[likerUid];
            const likerName = likerProfile?.displayName || "Developer";
            const preview = post.text.slice(0, 40) || t("あなたの投稿");
            upsertAppNotification({
              id: `like:${post.id}:${likerUid}`,
              type: "like",
              title: t("{name} がいいねしました", { name: likerName }),
              body: preview,
              createdAt: new Date().toISOString(),
              read: false,
              sourceUserId: likerUid,
            });
          });
        }
        // すべての post でスナップショットを更新 (自分以外の post も
        // 差分追跡しておかないと、後で自分の post になった時に bulk 通知)
        prevLikedSnapshotRef.current.set(post.id, currentLikers);
      });
    }

    // Reply notifications — fire when someone else replies to one
    // of the current user's own posts. Map post.userId once up front
    // so the per-reply check stays O(1). Uses the same
    // seenNotificationKeysRef + isRecentEnough guard as the other
    // event types: historical replies (loaded on app start) are
    // marked seen but never pushed, so the user isn't spam-notified
    // for stuff from before the session began.
    if (postReplies.length > 0) {
      const ownPostIds = new Set(
        posts.filter((post) => post.userId === currentUserUid).map((post) => post.id),
      );
      const postLookup = new Map(posts.map((post) => [post.id, post]));
      postReplies.forEach((reply) => {
        if (reply.userId === currentUserUid) return;
        if (!ownPostIds.has(reply.postId)) return;
        const notificationId = `reply:${reply.id}`;
        if (seenNotificationKeysRef.current.has(notificationId)) return;
        if (!isRecentEnough(reply.createdAt)) {
          seenNotificationKeysRef.current.add(notificationId);
          return;
        }
        const parentPost = postLookup.get(reply.postId);
        const parentPreview = parentPost?.text
          ? parentPost.text.slice(0, 30) + (parentPost.text.length > 30 ? "…" : "")
          : t("あなたの投稿");
        pushAppNotification(
          {
            id: notificationId,
            type: "reply",
            title: t("{name}が返信", { name: reply.username || "Developer" }),
            body: t("{text}\n― {preview}", { text: reply.text.slice(0, 120), preview: parentPreview }),
            createdAt: reply.createdAt,
            read: false,
            sourceUserId: reply.userId,
          },
          desktopNotificationSettings.reply,
        );
      });
    }

    // フレンド申請は「相手がオフラインの間に届く」のが普通なので、他の通知
    // とは扱いを変える。セッション開始後に来た申請 (recent) はデスクトップ
    // 通知込みで知らせ、開く前に届いていて未読の申請 (backlog) は通知ベルに
    // だけ積む。既読化済み (通知パネルを開いた時刻 lastNotificationReadAt
    // 以前) の申請は通知しない。lastNotificationReadAt が空のときは基準 0 =
    // 全 pending を未読扱いにして拾う。
    const notificationReadAtMs = lastNotificationReadAt
      ? new Date(lastNotificationReadAt).getTime()
      : 0;
    friendRequests
      .filter((request) => request.direction === "incoming" && request.status === "pending")
      .forEach((request) => {
        const notificationId = `friendRequest:${request.id}`;
        if (seenNotificationKeysRef.current.has(notificationId)) {
          return;
        }

        const recent = isRecentEnough(request.createdAt);
        const unreadBacklog = new Date(request.createdAt).getTime() > notificationReadAtMs;
        if (!recent && !unreadBacklog) {
          seenNotificationKeysRef.current.add(notificationId);
          return;
        }

        pushAppNotification(
          {
            id: notificationId,
            type: "friendRequest",
            title: t("フレンド申請"),
            body: t("{name}からフレンド申請が届きました", { name: request.profile.displayName }),
            createdAt: request.createdAt,
            read: false,
            sourceUserId: request.profile.uid,
          },
          // backlog (過去の未読) はベルに積むだけ。デスクトップ通知 / 音は
          // セッション中に届いた新規申請に限定し、再ログイン時の通知洪水を防ぐ。
          recent && desktopNotificationSettings.friendRequest,
        );
      });

    incomingInvites
      .filter((invite) => invite.status === "pending")
      .forEach((invite) => {
        const notificationId = `workspaceInvite:${invite.id}`;
        if (seenNotificationKeysRef.current.has(notificationId)) {
          return;
        }

        if (!isRecentEnough(invite.createdAt)) {
          seenNotificationKeysRef.current.add(notificationId);
          return;
        }

        pushAppNotification(
          {
            id: notificationId,
            type: "workspaceInvite",
            title: t("作業部屋への招待"),
            body: t("{name}が「{room}」に招待しました", { name: invite.fromName, room: invite.roomName }),
            createdAt: invite.createdAt,
            read: false,
            sourceUserId: invite.fromUid,
          },
          // Reuse the friend-request channel toggle — both are "someone
          // reached out to you" notifications; no separate setting needed.
          desktopNotificationSettings.friendRequest,
        );
      });
  }, [
    allWorkspaceRooms,
    currentUser,
    currentUserUid,
    desktopNotificationSettings,
    friendRequests,
    friends,
    incomingInvites,
    isWorkspaceLoaded,
    lastNotificationReadAt,
    notifiableUserIds,
    posts,
    postReplies,
    pushAppNotification,
    visibleSharedDailyReports,
  ]);
  const activeKnowledgeGraph = knowledgeGraph.nodes.length > 0 ? knowledgeGraph : studyKnowledgeGraph;
  const graphNodes = activeKnowledgeGraph.nodes.map((node) => ({
    ...node,
    ...(knowledgePositions[node.id] || {}),
  }));
  const selectedKnowledgeNode =
    graphNodes.find((node) => node.id === selectedKnowledgeId) || graphNodes[0] || null;
  const activeKnowledgeId = hoveredKnowledgeId || selectedKnowledgeNode?.id || "";
  const relatedKnowledgeIds = new Set<string>();
  activeKnowledgeGraph.links.forEach((link) => {
    if (link.source === activeKnowledgeId) {
      relatedKnowledgeIds.add(link.target);
    }
    if (link.target === activeKnowledgeId) {
      relatedKnowledgeIds.add(link.source);
    }
  });
  const selectedKnowledgeRelatedIds = new Set<string>();
  if (selectedKnowledgeNode) {
    activeKnowledgeGraph.links.forEach((link) => {
      if (link.source === selectedKnowledgeNode.id) {
        selectedKnowledgeRelatedIds.add(link.target);
      }
      if (link.target === selectedKnowledgeNode.id) {
        selectedKnowledgeRelatedIds.add(link.source);
      }
    });
  }
  const pendingJoinRoom = pendingJoinRoomId
    ? allWorkspaceRooms.find((room) => room.id === pendingJoinRoomId)
    : null;
  /* Phase 10c: ワンタップで Learning Item に時間を記録する.
     `記録する` 画面の各カードから直接呼ばれる。これまでは Profile
     画面の手動フォーム経由でしか時間を残せなかったので、`記録する`
     タブに来た目的（=記録）が完了せず、毎回 Profile まで降りる必要
     があった。同じ StudyLog 形状で保存するので、集計・グラフ・EXP
     は既存ルートと完全に整合する。 */
  const handleLearningQuickLog = (item: LearningItem, minutes: number) => {
    if (!currentUser) return;
    const safeMinutes = Math.round(minutes);
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return;
    const nextLog: StudyLog = {
      id: crypto.randomUUID(),
      subject: item.name,
      minutes: safeMinutes,
      createdAt: new Date().toISOString(),
      color: item.color,
      learningItemId: item.id,
    };
    setStudyLogs((logs) => [...logs, nextLog]);
    void saveStudyLogToCloud(db, currentUser.uid, nextLog, {
      earnedExp: Math.round(safeMinutes * 1.25),
      source: "learning-quick",
      organizationId: currentOrganization?.id,
    }).catch((error) => {
      console.error("Quick study log save failed.", error);
    });
    // 控えめなフィードバック. 煽らない・派手にしない — MEMORY の
    // デザイン方針(Linear/Arc 系) に合わせる.
    showToast(t("+{time} {name}", { time: formatStudyTimeJa(safeMinutes), name: item.name }), { kind: "success" });
    // 学習を記録したら自動的に FEED にも流す（細長コンパクト表示）。
    // 通常の手書き投稿と違って横長 1 行で出るのでタイムラインを圧迫しない。
    // 集約は enqueueAutoPost 側で 5 分ガード。
    void enqueueAutoPost({
      kind: "auto-study",
      text: `『${item.name}』を ${formatStudyTimeJa(safeMinutes)} 学習しました`,
      studyMinutesValue: safeMinutes,
    });
  };

  /* 「記録の入力」フォーム(時間/量/メモ/画像)からの保存。
     handleLearningQuickLog の上位版で、学習量・メモ・画像も 1 件の
     StudyLog として残す。本タイプで単位がページなら現在ページも進める。 */
  const handleSaveLearningRecord = (
    item: LearningItem,
    values: { minutes: number; amount?: number; amountUnit?: string; note?: string; photo?: string },
  ) => {
    if (!currentUser) return;
    const safeMinutes = Math.round(values.minutes);
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return;
    const nextLog: StudyLog = {
      id: crypto.randomUUID(),
      subject: item.name,
      minutes: safeMinutes,
      createdAt: new Date().toISOString(),
      color: item.color,
      learningItemId: item.id,
      ...(values.amount && values.amount > 0 ? { amount: values.amount } : {}),
      ...(values.amount && values.amount > 0 && values.amountUnit ? { amountUnit: values.amountUnit } : {}),
      ...(values.note ? { note: values.note } : {}),
      ...(values.photo ? { photo: values.photo } : {}),
    };
    setStudyLogs((logs) => [...logs, nextLog]);
    void saveStudyLogToCloud(db, currentUser.uid, nextLog, {
      earnedExp: Math.round(safeMinutes * 1.25),
      source: "learning-record",
      organizationId: currentOrganization?.id,
    }).catch((error) => {
      console.error("Learning record save failed.", error);
    });
    // 本で学習量(ページ)を記録したら、現在ページも前進させる
    // (単位の文字列に依存しない＝多言語でも動く)。
    if (item.category === "book" && values.amount && values.amount > 0) {
      handleLearningPageUpdate(item.id, (item.currentPages || 0) + values.amount);
    }
    setLearningRecordItemId(null);
    showToast(t("+{time} {name}", { time: formatStudyTimeJa(safeMinutes), name: item.name }), { kind: "success" });
    /* ユーザーが「記録の入力」フォームから明示的に保存したケースは、
       時間 + 学習量 + メモ + 画像 を Studyplus 風のサブカード型投稿として
       ホームのフィードに流す。本文 (text) はユーザーが書いたメモのみに
       絞り、subject/itemPhoto/studyMinutes でカードを描画する。 */
    const noteLines: string[] = [];
    if (values.amount && values.amount > 0) {
      const unit = values.amountUnit?.trim();
      noteLines.push(unit ? `${values.amount} ${unit}` : `${values.amount}`);
    }
    if (values.note) {
      noteLines.push(values.note);
    }
    void enqueueAutoPost({
      kind: "auto-study",
      text: noteLines.join("\n") || `${item.name}`, // 空テキストは弾かれるので最低限 subject を fallback
      studyMinutesValue: safeMinutes,
      photo: values.photo,
      itemPhoto: item.photo,
      subject: item.name,
      skipCooldown: true,
    });
  };

  /* クイック記録チップの連続タップを 1 件にまとめる猶予 (ms)。最後の
     タップからこの時間が空いたら確定する。連打の間隔としては十分に
     余裕があり、かつ確定が体感で遅すぎない値。 */
  const QUICK_LOG_MERGE_MS = 1500;

  /* +1m / +10m / +1h を押すたびに即記録せず、いったん保留合計に足して
     確定タイマーを張り直す。タップが止まって QUICK_LOG_MERGE_MS 経つと
     合計を 1 件の StudyLog として handleLearningQuickLog に渡す。 */
  const accumulateLearningQuickLog = (item: LearningItem, minutes: number) => {
    if (!currentUser) return;
    const id = item.id;
    const nextTotal = (quickLogPendingRef.current.get(id) || 0) + minutes;
    quickLogPendingRef.current.set(id, nextTotal);
    quickLogPendingItemRef.current.set(id, item);
    setQuickLogPendingById((prev) => ({ ...prev, [id]: nextTotal }));

    const existingTimer = quickLogMergeTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      const total = quickLogPendingRef.current.get(id) || 0;
      const targetItem = quickLogPendingItemRef.current.get(id) || item;
      quickLogPendingRef.current.delete(id);
      quickLogPendingItemRef.current.delete(id);
      quickLogMergeTimersRef.current.delete(id);
      setQuickLogPendingById((prev) => {
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
      if (total > 0) handleLearningQuickLog(targetItem, total);
    }, QUICK_LOG_MERGE_MS);
    quickLogMergeTimersRef.current.set(id, timer);
  };

  /* アンマウント時に未確定タイマーを掃除する。保留中だった合計は破棄
     されるが、画面遷移時に勝手な記録が走らない方が安全。 */
  useEffect(() => {
    const timers = quickLogMergeTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // 入力中の学習名に一致する既存の学習対象（active のみ・大文字小文字無視）。
  // 同名は1つの学習対象に統一するための「集約先」。一致した場合は色も
  // その対象に固定し、記録ごとに色がぶれないようにする。
  const matchedStudyItem = useMemo(() => {
    const normalized = studySubject.trim().toLowerCase();
    if (!normalized) return null;
    return (
      learningItems.find(
        (item) => !item.archived && item.name.toLowerCase() === normalized,
      ) ?? null
    );
  }, [studySubject, learningItems]);

  // 既存名を入力したら、その学習対象の登録色へ自動同期。これで「同名は
  // 同じ色」が UI 上も保証され、ユーザーは色を選び直す必要がなくなる。
  useEffect(() => {
    if (matchedStudyItem) {
      setStudyColor(matchedStudyItem.color);
    }
  }, [matchedStudyItem]);



  const openLearningEditorForCreate = (presetName = "") => {
    setIsLearningDeleteConfirming(false);
    setLearningEditorState({
      mode: "create",
      name: presetName,
      category: "stack",
      color: studyColorOptions[0].value,
      totalPages: "",
      currentPages: "",
      note: "",
      photo: "",
      status: "active",
    });
  };


  /* バーコード(ISBN)で本を登録。Google Books から書名・表紙・ページ数を
     引き、学習項目エディタを「本」モードでプリフィルして開く(内容を確認
     してから保存する流れ)。見つからなければ空の本として手入力に委ねる。 */
  const handleBookIsbnDetected = async (rawIsbn: string) => {
    const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");
    setIsBarcodeScanOpen(false);
    if (!isbn) return;
    setIsLearningDeleteConfirming(false);
    const openBookEditor = (info?: {
      title?: string;
      authors?: string[];
      pageCount?: number;
      cover?: string;
    }) => {
      setLearningEditorState({
        mode: "create",
        name: info?.title || "",
        category: "book",
        color: studyColorOptions[0].value,
        totalPages: info?.pageCount ? String(info.pageCount) : "",
        currentPages: "",
        note: Array.isArray(info?.authors) ? info!.authors.join(", ") : "",
        photo: info?.cover || "",
        status: "active",
      });
    };
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&country=${language === "ja" ? "JP" : "US"}`,
      );
      const data = (await res.json()) as {
        items?: Array<{
          volumeInfo?: {
            title?: string;
            authors?: string[];
            pageCount?: number;
            imageLinks?: { thumbnail?: string; smallThumbnail?: string };
          };
        }>;
      };
      const info = data.items?.[0]?.volumeInfo;
      if (info?.title) {
        const cover = (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "").replace(
          /^http:/,
          "https:",
        );
        openBookEditor({
          title: info.title,
          authors: info.authors,
          pageCount: info.pageCount,
          cover,
        });
        showToast(t("本の情報を取得しました。内容を確認して保存してください"), { kind: "success" });
      } else {
        openBookEditor();
        showToast(t("該当する本が見つかりませんでした。手入力で登録してください"), { kind: "error" });
      }
    } catch {
      openBookEditor();
      showToast(t("本の情報の取得に失敗しました。手入力で登録してください"), { kind: "error" });
    }
  };

  const openLearningEditorForEdit = (item: LearningItem) => {
    setIsLearningDeleteConfirming(false);
    setLearningEditorState({
      mode: "edit",
      itemId: item.id,
      name: item.name,
      category: item.category,
      color: item.color,
      totalPages: typeof item.totalPages === "number" ? String(item.totalPages) : "",
      currentPages: typeof item.currentPages === "number" ? String(item.currentPages) : "",
      note: item.note ?? "",
      photo: item.photo ?? "",
      status: item.status ?? "active",
    });
  };

  const closeLearningEditor = () => {
    setIsLearningDeleteConfirming(false);
    setLearningEditorState(null);
  };

  /* ライブラリの手動並べ替え。並べ替えモード on の時、各カードの↑↓
     ボタンから呼ばれる。
     - 「視覚的に1つ上/下に動く」が期待値なので、現在画面に出ている
       sort 順 (recent / total / name / custom) で並べてから index 操作する
     - swap した結果の表示順を 1..N で order に再付与し、sort mode を
       "custom" に切替 (= 今後はこの順序で固定)
     - cloud sync: 影響したアイテムだけ save (差分のみ書く) */

  /* === ドラッグ並べ替えの commit ロジック ===
     orderedItems: 現在の表示順 (sorted)
     itemId: 動かす対象
     targetIndex: 移動先の表示順 index
     handleMoveLearningItem と同じ pattern で order を 1..N で再付与し、
     custom sort モードに切替えてクラウド sync する。 */
  const commitLearningDragReorder = (
    orderedItems: LearningItem[],
    itemId: string,
    targetIndex: number,
  ) => {
    if (!currentUser) return;
    const fromIdx = orderedItems.findIndex((it) => it.id === itemId);
    if (fromIdx < 0 || fromIdx === targetIndex) return;
    const next = orderedItems.slice();
    const [moved] = next.splice(fromIdx, 1);
    const clampedTarget = Math.max(0, Math.min(next.length, targetIndex));
    next.splice(clampedTarget, 0, moved);
    const nowIso = new Date().toISOString();
    const updates = new Map<string, LearningItem>();
    next.forEach((item, i) => {
      const desired = i + 1;
      if (item.order !== desired) {
        updates.set(item.id, { ...item, order: desired, updatedAt: nowIso });
      }
    });
    if (updates.size === 0) return;
    setLearningItems((items) => items.map((it) => updates.get(it.id) ?? it));
    if (learningSortMode !== "custom") setLearningSortMode("custom");
    updates.forEach((item) => {
      void saveLearningItemToCloud(db, item).catch((error) => {
        console.info("Learning item drag reorder cloud sync skipped.", error);
      });
    });
  };

  /* === Library カード: 長押し → ドラッグ並べ替え ===

     Pointer Events + setPointerCapture を使うと iOS Safari で「translate
     されたカードの上にカーソルが乗った状態で pointermove が止まる」
     既知の挙動があり、指追従が壊れた。
     より素朴な Touch Events / Mouse Events を直接ハンドルする実装に
     置き換えて根本解決する。
       - Touch: タッチ開始時に document に touchmove / touchend を貼り、
         drag 中は preventDefault でスクロールを遮断
       - Mouse: 同様に mousemove / mouseup を document に貼る
     CSS は同じ (--drag-offset-y の値を直接 DOM へ書く)。 */
  const startLearningDrag = (opts: {
    articleEl: HTMLElement;
    startX: number;
    startY: number;
    itemId: string;
    sortedIndex: number;
    sortedList: LearningItem[];
    mode: "touch" | "mouse";
  }) => {
    const { articleEl, startX, startY, itemId, sortedIndex, sortedList, mode } = opts;

    longPressStartXRef.current = startX;
    longPressStartYRef.current = startY;
    longPressStartIndexRef.current = sortedIndex;
    dragWasCommittedRef.current = false;
    dragSortedRef.current = sortedList;

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }

    /* touch-action: none を直接 DOM に書き込み、ブラウザのスクロール
       判定に先回り。 */
    articleEl.style.touchAction = "none";

    setPressingLibraryItemId(itemId);

    /* 2D ヒットテスト: 指の真下にあるカードと、その左右どちら側に乗って
       いるかから挿入位置を計算する。 */
    const computeDropTarget = (clientX: number, clientY: number) => {
      const live = dragSortedRef.current;
      const fromIdx = live.findIndex((x) => x.id === itemId);
      const fallback = { hoverIdx: fromIdx, targetIdx: fromIdx };
      const stack = document.elementsFromPoint(clientX, clientY);
      for (const node of stack) {
        const article = (node as HTMLElement).closest?.(".learning-card") as HTMLElement | null;
        if (!article) continue;
        let hoverId: string | null = null;
        for (const [id, el] of cardRectsRef.current) {
          if (el === article) {
            hoverId = id;
            break;
          }
        }
        if (!hoverId || hoverId === itemId) continue;
        const i = live.findIndex((x) => x.id === hoverId);
        if (i < 0) continue;
        const rect = article.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const insertBefore = clientX < midX;
        let targetIdx: number;
        if (insertBefore) {
          targetIdx = i < fromIdx ? i : i - 1;
        } else {
          targetIdx = i < fromIdx ? i + 1 : i;
        }
        return { hoverIdx: i, targetIdx };
      }
      return fallback;
    };

    const onMoveCommon = (clientX: number, clientY: number, e: TouchEvent | MouseEvent) => {
      if (longPressTimerRef.current) {
        const dx = clientX - longPressStartXRef.current;
        const dy = clientY - longPressStartYRef.current;
        if (Math.abs(dx) > 16 || Math.abs(dy) > 16) {
          window.clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
          setPressingLibraryItemId(null);
          articleEl.style.touchAction = "";
          cleanupListeners();
        }
        return;
      }
      const dy = clientY - longPressStartYRef.current;
      articleEl.style.setProperty("--drag-offset-y", `${dy}px`);
      if (e.cancelable) e.preventDefault();
      const { hoverIdx } = computeDropTarget(clientX, clientY);
      setDragLibraryOverIndex(hoverIdx);
    };

    const finalize = (clientX: number, clientY: number) => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const live = dragSortedRef.current;
      const { targetIdx } = computeDropTarget(clientX, clientY);
      if (
        dragWasCommittedRef.current &&
        targetIdx >= 0 &&
        targetIdx !== longPressStartIndexRef.current
      ) {
        commitLearningDragReorder(live, itemId, targetIdx);
      }
      setDragLibraryItemId(null);
      setDragLibraryOverIndex(null);
      setPressingLibraryItemId(null);
      articleEl.style.setProperty("--drag-offset-y", "0px");
      articleEl.style.touchAction = "";
      cleanupListeners();
    };

    const cleanupListeners = () => {
      if (dragTouchMoveHandlerRef.current) {
        document.removeEventListener("touchmove", dragTouchMoveHandlerRef.current);
        dragTouchMoveHandlerRef.current = null;
      }
      if (dragTouchEndHandlerRef.current) {
        document.removeEventListener("touchend", dragTouchEndHandlerRef.current);
        document.removeEventListener("touchcancel", dragTouchEndHandlerRef.current);
        dragTouchEndHandlerRef.current = null;
      }
      if (dragMouseMoveHandlerRef.current) {
        document.removeEventListener("mousemove", dragMouseMoveHandlerRef.current);
        dragMouseMoveHandlerRef.current = null;
      }
      if (dragMouseUpHandlerRef.current) {
        document.removeEventListener("mouseup", dragMouseUpHandlerRef.current);
        dragMouseUpHandlerRef.current = null;
      }
    };

    if (mode === "touch") {
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        onMoveCommon(t.clientX, t.clientY, e);
      };
      const onTouchEnd = (e: TouchEvent) => {
        const t = e.changedTouches[0];
        const x = t ? t.clientX : longPressStartXRef.current;
        const y = t ? t.clientY : longPressStartYRef.current;
        finalize(x, y);
      };
      cleanupListeners();
      dragTouchMoveHandlerRef.current = onTouchMove;
      dragTouchEndHandlerRef.current = onTouchEnd;
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
      document.addEventListener("touchcancel", onTouchEnd);
    } else {
      const onMouseMove = (e: MouseEvent) => {
        onMoveCommon(e.clientX, e.clientY, e);
      };
      const onMouseUp = (e: MouseEvent) => {
        finalize(e.clientX, e.clientY);
      };
      cleanupListeners();
      dragMouseMoveHandlerRef.current = onMouseMove;
      dragMouseUpHandlerRef.current = onMouseUp;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setPressingLibraryItemId(null);
      setDragLibraryItemId(itemId);
      setDragLibraryOverIndex(sortedIndex);
      dragWasCommittedRef.current = true;
      if (navigator.vibrate) navigator.vibrate([15, 30, 25]);
    }, 400);
  };

  const handleLearningEditorSave = () => {
    if (!currentUser || !learningEditorState) {
      return;
    }
    const trimmedName = learningEditorState.name.trim();
    if (!trimmedName) {
      return;
    }
    const nowIso = new Date().toISOString();
    const totalPagesNum = Number(learningEditorState.totalPages);
    const currentPagesNum = Number(learningEditorState.currentPages);
    const isBook = learningEditorState.category === "book";
    const hasTotal = isBook && Number.isFinite(totalPagesNum) && totalPagesNum > 0;
    // Clamp current page to [0, total] so progress can never exceed 100%
    // or go negative from a stray keystroke.
    const clampedCurrent =
      isBook && Number.isFinite(currentPagesNum) && currentPagesNum >= 0
        ? hasTotal
          ? Math.min(currentPagesNum, totalPagesNum)
          : currentPagesNum
        : undefined;
    const trimmedNote = learningEditorState.note.trim().slice(0, 280);

    if (learningEditorState.mode === "create") {
      const newItem: LearningItem = {
        id: crypto.randomUUID(),
        userId: currentUser.uid,
        name: trimmedName.slice(0, 60),
        category: learningEditorState.category,
        color: learningEditorState.color,
        status: learningEditorState.status,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...(hasTotal ? { totalPages: totalPagesNum } : {}),
        ...(clampedCurrent !== undefined ? { currentPages: clampedCurrent } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        ...(learningEditorState.photo ? { photo: learningEditorState.photo } : {}),
      };
      setLearningItems((items) => [...items, newItem]);
      void saveLearningItemToCloud(db, newItem).catch((error) => {
        console.info("Learning item cloud save skipped.", error);
      });
    } else if (learningEditorState.itemId) {
      const existing = learningItems.find((item) => item.id === learningEditorState.itemId);
      if (!existing) {
        return;
      }
      const updated: LearningItem = {
        ...existing,
        name: trimmedName.slice(0, 60),
        category: learningEditorState.category,
        color: learningEditorState.color,
        status: learningEditorState.status,
        updatedAt: nowIso,
        note: trimmedNote || undefined,
        photo: learningEditorState.photo || undefined,
        ...(hasTotal ? { totalPages: totalPagesNum } : { totalPages: undefined }),
        ...(clampedCurrent !== undefined ? { currentPages: clampedCurrent } : { currentPages: undefined }),
      };
      setLearningItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      void saveLearningItemToCloud(db, updated).catch((error) => {
        console.info("Learning item cloud save skipped.", error);
      });
      // 「未完了 → 完了」に切り替わったタイミングだけ自動投稿で祝う。
      // 単なる名前変更や色変更で投稿が走ると鬱陶しいので、状態遷移を見る。
      if (existing.status !== "done" && updated.status === "done") {
        void enqueueAutoPost({
          kind: "auto-study",
          text: `『${updated.name}』をやり遂げました ✨`,
        });
      }
    }

    setLearningEditorState(null);
  };

  const handleLearningEditorArchiveToggle = () => {
    if (!learningEditorState || !learningEditorState.itemId) {
      return;
    }
    const existing = learningItems.find((item) => item.id === learningEditorState.itemId);
    if (!existing) {
      return;
    }
    const updated: LearningItem = {
      ...existing,
      archived: !existing.archived,
      updatedAt: new Date().toISOString(),
    };
    setLearningItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    void saveLearningItemToCloud(db, updated).catch((error) => {
      console.info("Learning item cloud save skipped.", error);
    });
    setIsLearningDeleteConfirming(false);
    setLearningEditorState(null);
  };

  const handleLearningEditorDelete = () => {
    if (!learningEditorState || !learningEditorState.itemId) {
      return;
    }
    const targetId = learningEditorState.itemId;
    setLearningItems((items) => items.filter((item) => item.id !== targetId));
    void deleteLearningItemFromCloud(db, targetId).catch((error) => {
      console.info("Learning item cloud delete skipped.", error);
    });
    setIsLearningDeleteConfirming(false);
    setLearningEditorState(null);
  };

  // C-6: persist a new current-page value for a book straight from the
  // card, clamped to [0, totalPages]. Fire-and-forget like every other
  // learning mutation. When the book reaches the last page we DON'T flip
  // status to "done" automatically — that stays an explicit user choice
  // (no surprise side effects), but the full progress bar makes it obvious.
  const handleLearningPageUpdate = (itemId: string, rawPage: number) => {
    const existing = learningItems.find((item) => item.id === itemId);
    if (!existing) {
      return;
    }
    if (!Number.isFinite(rawPage) || rawPage < 0) {
      return;
    }
    const clamped =
      typeof existing.totalPages === "number" && existing.totalPages > 0
        ? Math.min(Math.round(rawPage), existing.totalPages)
        : Math.round(rawPage);
    const updated: LearningItem = {
      ...existing,
      currentPages: clamped,
      updatedAt: new Date().toISOString(),
    };
    setLearningItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    void saveLearningItemToCloud(db, updated).catch((error) => {
      console.info("Learning item cloud save skipped.", error);
    });
    // 20 ページ以上進めたら積み上げを FEED に流す（毎ページ通知は鬱陶しい）。
    // 60 分のクールダウンは enqueueAutoPost 側で見る。
    const previousPages =
      typeof existing.currentPages === "number" ? existing.currentPages : 0;
    const advanced = clamped - previousPages;
    if (advanced >= 20) {
      const pageLabel =
        typeof existing.totalPages === "number" && existing.totalPages > 0
          ? `${clamped} / ${existing.totalPages} ページ`
          : `${clamped} ページ`;
      void enqueueAutoPost({
        kind: "auto-study",
        text: `『${existing.name}』を ${pageLabel} まで進めました 📘`,
      });
    }
  };

  // 「学習記録の進捗」「作業部屋退室の積み上げ」を FEED に自動投稿する共通入口。
  // 通常の handlePostSubmit と違って draft / toast / Arc 報酬 / オンボーディング
  // ステップを動かさず、サイレントに 1 件足す（連投を防ぐため、同 kind は 60 分
  // 集約、設定 OFF / 未ログインなら no-op）。これで「ユーザーが投稿ボタンを
  // 押さなくても、仲間の積み上げが流れてくる」状態を作る。
  const enqueueAutoPost = async ({
    kind,
    text,
    studyMinutesValue = 0,
    roomIdValue = "",
    roomNameValue = "",
    photo,
    itemPhoto,
    subject,
    skipCooldown = false,
  }: {
    kind: "auto-study" | "auto-workspace";
    text: string;
    studyMinutesValue?: number;
    roomIdValue?: string;
    roomNameValue?: string;
    /** ユーザーが学習記録フォームで添付した画像 (dataURL)。 */
    photo?: string;
    /** ライブラリ項目の photo (本の表紙等)。 inset サムネに使う。 */
    itemPhoto?: string;
    /** 対象項目名 (例: "速読英熟語")。 inset の見出しに使う。 */
    subject?: string;
    /** 5 分クールダウンを無視する (= ユーザーが明示的に投稿したいケース)。
     *  ライブラリの「記録の入力」から保存した場合は意図的な行動なので true。 */
    skipCooldown?: boolean;
  }) => {
    if (!currentUser) return;
    /* auto-post 設定は「作業部屋退室」など暗黙の積み上げ通知を黙らせる
       ためのもの。skipCooldown=true (= ユーザーが「記録の入力」フォーム
       から明示保存) のときは、ユーザーが投稿を意図しているとみなして
       設定を上書きする (報告: 設定 OFF で何度記録しても流れない症状)。 */
    if (!skipCooldown && !isAutoPostEnabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (!skipCooldown) {
      const lastAt = lastAutoPostAtRef.current[kind] || 0;
      // 5 分以内に同じ kind を出していたら集約してスキップ。通常の手書き投稿
      // と違い auto-* はコンパクト 1 行カードで表示されるためタイムラインを
      // 圧迫しない設計。連続記録で 1 件ずつ流しても許容範囲。
      if (now - lastAt < 5 * 60 * 1000) return;
    }
    lastAutoPostAtRef.current[kind] = now;

    const autoPost: ContributionPostRecord = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      username: playerName,
      avatar: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
      currentCharacter: characterOptions[0].id,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      currentTitle,
      text: trimmed.slice(0, 280),
      createdAt: new Date().toISOString(),
      roomId: roomIdValue,
      roomName: roomNameValue,
      githubContributionCount: outputStats.commits,
      studyMinutes: studyMinutesValue,
      likesCount: 0,
      likedUserIds: [],
      /* skipCooldown=true は「ライブラリの記録の入力フォームから明示
         保存」した時に立つ。 home feed の kind フィルタ ("posts" / "study")
         で auto-study は別タブに隔離されてしまい、明示記録が見えない
         症状の根本原因だったため、明示保存は postType を "manual" にして
         デフォルトの "posts" タブに流す。 */
      postType: skipCooldown ? "manual" : kind,
      ...(photo ? { photo } : {}),
      ...(itemPhoto ? { itemPhoto } : {}),
      ...(subject ? { subject } : {}),
      syncStatus: "pending",
      syncError: "",
    };
    setPosts((items) => mergePosts([autoPost, ...items.filter((item) => item.id !== autoPost.id)]));
    void putPersistentItem("posts", autoPost).catch(logPersistError);
    try {
      await savePostToCloud(db, autoPost);
      const synced: ContributionPostRecord = { ...autoPost, syncStatus: "synced", syncError: "" };
      setPosts((items) => mergePosts([synced, ...items.filter((item) => item.id !== autoPost.id)]));
      void putPersistentItem("posts", synced).catch(logPersistError);
    } catch (error) {
      // 失敗してもユーザー操作ではないので、UI でエラー表示はしない。ローカル
      // キャッシュには残っているので、後の手動投稿/再ログインで再同期される。
      console.info("Auto post cloud save skipped.", error);
    }
  };

  const handlePostSubmit = async (
    event?: FormEvent<HTMLFormElement>,
    overrideText?: string,
  ) => {
    event?.preventDefault();

    if (!currentUser || isPosting) {
      return;
    }

    const text = (overrideText ?? postDraft).trim();
    if (!text) {
      setPostError(t("ログ内容を入力してください。"));
      return;
    }

    const currentPostRoom = activeRoom || selectedRoom || null;
    const createdAt = new Date().toISOString();
    const nextPost: ContributionPostRecord = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      username: playerName,
      avatar: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
      currentCharacter: characterOptions[0].id,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      currentTitle,
      text: text.slice(0, 280),
      createdAt,
      roomId: currentPostRoom?.id || "",
      roomName: currentPostRoom?.name || "",
      githubContributionCount: outputStats.commits,
      studyMinutes: totalWeeklyMinutes,
      likesCount: 0,
      likedUserIds: [],
      syncStatus: "pending",
      syncError: "",
    };

    setIsPosting(true);
    setPostError("");
    setPosts((items) => mergePosts([nextPost, ...items.filter((item) => item.id !== nextPost.id)]));
    void putPersistentItem("posts", nextPost).catch(logPersistError);
    setPostDraft("");

    // Daily-post Arc reward. First successful post each local day pays
    // out 50 Arc up to a lifetime cap of 500. The cap tracks total
    // *earned* (feedRewardArcEarned), not the live coin balance, so
    // spending Arc in the shop never re-opens the daily reward.
    const FEED_REWARD_PER_DAY = 50;
    const FEED_REWARD_LIFETIME_CAP = 500;
    const now = new Date();
    const todayKey =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`;
    const remainingCap = Math.max(0, FEED_REWARD_LIFETIME_CAP - feedRewardArcEarned);
    if (todayKey !== lastFeedRewardDate && remainingCap > 0) {
      const reward = Math.min(FEED_REWARD_PER_DAY, remainingCap);
      const nextEarned = feedRewardArcEarned + reward;
      setCoins((value) => value + reward);
      setLastFeedRewardDate(todayKey);
      setFeedRewardArcEarned(nextEarned);
      const reachedCap = nextEarned >= FEED_REWARD_LIFETIME_CAP;
      showToast(
        reachedCap
          ? t("+{reward} Arc 獲得（投稿ボーナス上限 {cap} に到達）", { reward, cap: FEED_REWARD_LIFETIME_CAP })
          : t("+{reward} Arc 獲得（累計 {earned} / {cap}）", { reward, earned: nextEarned, cap: FEED_REWARD_LIFETIME_CAP }),
        { kind: "success" },
      );
    }

    if (onboardingStep === "firstPost") {
      // チュートリアルの後半 (今日やることを書く) へ進む。
      // onboarding-complete はそこを通過してから立てるので、ここでは
      // まだ「完了済み」マークは付けない。
      // Persist the 決意 the user just wrote as their profile determination,
      // so it lives on in the profile "決意" card rather than only inside
      // the first post. Mirrors handleDeterminationSubmit.
      const firstResolve = onboardingResolve.trim();
      if (firstResolve) {
        setDetermination(firstResolve);
        setDraftDetermination(firstResolve);
        const accountScope = getAccountStorageScope(currentUser.uid, userId);
        safeSetLocalStorage(getAccountStorageKey(accountScope, "determination"), firstResolve);
        if (userId) {
          void setDoc(
            doc(db, "users", currentUser.uid),
            {
              uid: currentUser.uid,
              userId,
              displayName: playerName,
              photoURL: playerAvatar,
              determination: firstResolve,
              characterColor: playerCharacterColor,
              searchName: playerName.toLowerCase(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ).catch((error) => {
            console.info("Onboarding determination sync skipped.", error);
          });
        }
      }
      setOnboardingResolve("");
      // 日報画面へ移動して 今日やること を書かせる step に切替。
      setCurrentView("daily");
      setOnboardingStep("firstDailyPlan");
    }

    try {
      await savePostToCloud(db, nextPost);
      const syncedPost: ContributionPostRecord = { ...nextPost, syncStatus: "synced", syncError: "" };
      setPosts((items) => mergePosts([syncedPost, ...items.filter((item) => item.id !== nextPost.id)]));
      void putPersistentItem("posts", syncedPost).catch(logPersistError);
      // The new post appears in the feed below, but on a long list it's
      // easy to miss the visual update. The toast confirms the send so
      // the user doesn't second-guess whether their tap landed.
      showToast(t("投稿しました"), { kind: "success" });

      // Phase 9: mirror the post to Slack if the org opted in.
      if (
        currentOrganization?.slackWebhookUrl &&
        currentOrganization.slackEvents?.posts
      ) {
        void postToSlackWebhook(
          currentOrganization.slackWebhookUrl,
          buildPostBlocks(
            { name: playerName, meta: `Lv ${levelState.level}` },
            text,
            language,
          ),
        );
      }
    } catch (error) {
      setPostError(
        getFirestoreErrorMessage(
          error,
          t("ログをローカルに保存しました。クラウドへ再同期します。"),
          t("ログをクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。"),
        ),
      );
      const pendingPost: ContributionPostRecord = {
        ...nextPost,
        syncStatus: "pending",
        syncError: "cloud-save-failed",
      };
      setPosts((items) => mergePosts([pendingPost, ...items.filter((item) => item.id !== nextPost.id)]));
      void putPersistentItem("posts", pendingPost).catch(logPersistError);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostLike = (post: ContributionPostRecord) => {
    if (!currentUser) {
      return;
    }

    const isLiked = post.likedUserIds.includes(currentUser.uid);
    setPosts((items) =>
      items.map((item) => {
        if (item.id !== post.id) {
          return item;
        }

        return {
          ...item,
          likedUserIds: isLiked
            ? item.likedUserIds.filter((likedUserId) => likedUserId !== currentUser.uid)
            : [...item.likedUserIds, currentUser.uid],
          likesCount: Math.max(0, item.likesCount + (isLiked ? -1 : 1)),
        };
      }),
    );

    if (!isLiked) {
      setLikeBurstPostId(post.id);
      window.setTimeout(() => {
        setLikeBurstPostId((current) => (current === post.id ? null : current));
      }, 650);
    }

    void togglePostLikeInCloud(db, post.id, currentUser.uid, isLiked).catch((error) => {
      console.info("Post like sync skipped.", error);
      setPostError(t("リアクションを保存できませんでした。"));
      // 楽観的更新を rollback。元の post を該当 id で復元する。
      // (onSnapshot でいずれサーバー値が同期されるが、瞬間的な不整合と
      //  カウンタの逆ズレを防ぐ)
      setPosts((items) =>
        items.map((item) => (item.id === post.id ? post : item)),
      );
    });
  };

  const togglePostReplyOpen = (postId: string) => {
    setOpenReplyPostIds((set) => {
      const next = new Set(set);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
    setReplyError("");
  };

  const handlePostReplySubmit = async (post: ContributionPostRecord) => {
    if (!currentUser) {
      return;
    }

    const text = (replyDrafts[post.id] || "").trim();
    if (!text) {
      return;
    }

    const reply: ContributionReplyRecord = {
      id: crypto.randomUUID(),
      postId: post.id,
      userId: currentUser.uid,
      username: playerName,
      avatar: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      text: text.slice(0, 160),
      createdAt: new Date().toISOString(),
    };

    setReplyError("");
    setPostReplies((items) => [reply, ...items.filter((item) => item.id !== reply.id)]);
    setReplyDrafts((drafts) => ({ ...drafts, [post.id]: "" }));
    setOpenReplyPostIds((set) => {
      if (!set.has(post.id)) return set;
      const next = new Set(set);
      next.delete(post.id);
      return next;
    });

    try {
      await savePostReplyToCloud(db, reply);
    } catch (error) {
      console.info("Post reply save skipped.", error);
      setReplyError(t("返信を保存できませんでした。"));
      setPostReplies((items) => items.filter((item) => item.id !== reply.id));
      setReplyDrafts((drafts) => ({ ...drafts, [post.id]: text }));
    }
  };

  const handlePostDelete = (post: ContributionPostRecord) => {
    if (!currentUser || post.userId !== currentUser.uid) {
      return;
    }

    const isConfirmed = window.confirm(t("このログを削除しますか？"));
    if (!isConfirmed) {
      return;
    }

    setPosts((items) => items.filter((item) => item.id !== post.id));
    setPostReplies((items) => items.filter((item) => item.postId !== post.id));
    void deletePersistentItem("posts", post.id);
    void deleteDoc(doc(db, "posts", post.id)).catch((error) => {
      console.info("Post delete skipped.", error);
      setPostError(t("ログを削除できませんでした。"));
    });
  };

  /* Team Daily の lazy load。「読み込む」ボタンから呼ばれて、最新 100 件
     の共有日報を一括取得する。リロードしたい時のために 2 回目以降も
     呼べる (loaded 状態は維持)。 */
  /* 要望の送信。Firestore feedback/{auto-id} に書き込む。
     - 本文 trim、1〜2000 字でクランプ
     - uid / userId / displayName / createdAt / 環境情報を添えて保存
     - rules で create は本人のみ、read は開発者のみに制限する */
  const handleFeedbackSubmit = async () => {
    if (!currentUser || isSendingFeedback) return;
    const text = feedbackDraft.trim().slice(0, 2000);
    if (!text) {
      setFeedbackError(t("内容を入力してください。"));
      return;
    }
    setIsSendingFeedback(true);
    setFeedbackError("");
    try {
      const ref = doc(collection(db, "feedback"));
      await setDoc(ref, {
        id: ref.id,
        uid: currentUser.uid,
        userId: userId || "",
        displayName: playerName || "",
        // email は保存しない (データ最小化)。問い合わせ対応が必要な場合は
        // uid から Auth コンソールで特定できるため、平文の PII をここに
        // 複製する必要がない。users doc が email を持たない設計とも整合。
        text,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "",
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        status: "open",
      });
      setFeedbackDraft("");
      setIsFeedbackModalOpen(false);
      showToast(t("ご要望を送信しました。ありがとうございます。"), { kind: "success" });
    } catch (error) {
      console.info("Feedback submit failed.", error);
      setFeedbackError(t("送信に失敗しました。時間をおいて再度お試しください。"));
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const handleLoadSharedDailyReports = async () => {
    if (!currentUser || isLoadingSharedDaily) return;
    setIsLoadingSharedDaily(true);
    setSharedDailyLoadError("");
    try {
      const snapshot = await getDocs(
        query(collection(db, "dailyReports"), orderBy("date", "desc"), limit(100)),
      );
      const syncedCloudReports = snapshot.docs
        .map((item) => {
          const data = {
            ...(item.data() as Partial<DailyReport>),
            id: item.id,
          };
          return {
            ...normalizeDailyReport(data, currentUser.uid),
            syncStatus: "synced" as const,
            syncError: "",
          };
        })
        .filter(
          (report) => report.userId && (report.plan.trim() || report.reflection.trim()),
        );
      setSharedDailyReports(syncedCloudReports);
      void putPersistentItems("dailyReports", syncedCloudReports);
      setIsSharedDailyLoaded(true);
      // 再取得したら表示も先頭ページに戻す。
      setSharedDailyDisplayLimit(SHARED_DAILY_PAGE_SIZE);
    } catch (error) {
      console.info("Team Daily fetch failed.", error);
      setSharedDailyLoadError(t("読み込みに失敗しました。もう一度お試しください。"));
    } finally {
      setIsLoadingSharedDaily(false);
    }
  };

  const handleDailyReportDelete = (report: DailyReport) => {
    if (!currentUser || report.userId !== currentUser.uid) {
      return;
    }

    const isConfirmed = window.confirm(
      t("{date}の日報を削除しますか？", { date: formatDailyDate(report.date, language) }),
    );
    if (!isConfirmed) {
      return;
    }

    const nextReports = dailyReports.filter((item) => item.id !== report.id);
    setDailyReports(nextReports);
    setSharedDailyReports((reports) => reports.filter((item) => item.id !== report.id));
    persistDailyReports(currentUser.uid, userId, nextReports);
    void deletePersistentItem("dailyReports", report.id);

    if (selectedDailyDate === report.date) {
      setDailyPlanItemsDraft([]);
      setDailyReflectionPartsDraft(makeEmptyReflectionParts());
      setDailyMessage(t("日報を削除しました。"));
    }

    void deleteDoc(doc(db, "dailyReports", report.id)).catch((error) => {
      console.info("Daily report delete skipped.", error);
      setDailyMessage(t("日報を削除できませんでした。"));
    });
  };

  const handleDailyPromptDismiss = () => {
    if (!currentUser) return;
    const date = getLearnerDate();
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    safeSetLocalStorage(getAccountStorageKey(accountScope, "daily-prompt-dismissed"), date);
    setDailyPromptDismissedFor(date);
    setDailyPromptError("");
  };

  const handleDailyPromptSave = async () => {
    if (!currentUser || isSavingDailyPrompt) return;

    const planText = dailyPromptDraft.trim();
    if (!planText) {
      setDailyPromptError(t("今日やることを入力してください。"));
      return;
    }

    const date = getLearnerDate();
    const now = new Date().toISOString();
    const existingReport = dailyReports.find((report) => report.date === date);
    const report: DailyReport = {
      id: `${currentUser.uid}_${date}`,
      userId: currentUser.uid,
      userName: playerName,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      currentTitle,
      date,
      plan: planText,
      reflection: existingReport?.reflection || "",
      createdAt: existingReport?.createdAt || now,
      updatedAt: now,
      syncStatus: "pending",
      syncError: "",
    };

    setIsSavingDailyPrompt(true);
    setDailyPromptError("");
    setDailyReports((reports) => {
      const nextReports = [report, ...reports.filter((item) => item.id !== report.id)].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      persistDailyReports(currentUser.uid, userId, nextReports);
      return nextReports;
    });
    void putPersistentItem("dailyReports", report);

    // Keep the daily-screen draft in sync if the user opens it next.
    // The home-screen prompt is plain text (single textarea), so we
    // lift it into PlanItem rows the same way the editor would on open.
    if (selectedDailyDate === date) {
      setDailyPlanItemsDraft(planItemsFromLegacyText(planText));
    }

    try {
      await withTimeout(
        setDoc(
          doc(db, "dailyReports", report.id),
          {
            ...dailyReportToCloudPayload(report),
            updatedAt: report.updatedAt,
            serverUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
        8000,
        "daily-report-save-timeout",
      );
    } catch (error) {
      console.info("Daily plan prompt save fell back to local cache.", error);
    } finally {
      setIsSavingDailyPrompt(false);
      setDailyPromptDraft("");
    }
  };

  /* チュートリアル "firstDailyPlan" の保存。今日の dailyReport の plan
     として書き出してから onboarding を idle に戻し、完了マーク
     (contribution-arc-onboarding-complete-${uid}) をやっと立てる。
     失敗してもクラウド側だけがコケる形 (ローカルは入っている) なので
     チュートリアルは進める。 */
  const handleOnboardingFirstPlanSubmit = async () => {
    if (!currentUser || isSavingOnboardingFirstPlan) return;
    const planText = onboardingFirstPlanDraft.trim();
    if (!planText) {
      setOnboardingFirstPlanError(t("今日やることを 1 行で書いてみよう。"));
      return;
    }

    const date = getLearnerDate();
    const now = new Date().toISOString();
    const existingReport = dailyReports.find((report) => report.date === date);
    const report: DailyReport = {
      id: `${currentUser.uid}_${date}`,
      userId: currentUser.uid,
      userName: playerName,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      currentTitle,
      date,
      plan: planText,
      reflection: existingReport?.reflection || "",
      createdAt: existingReport?.createdAt || now,
      updatedAt: now,
      syncStatus: "pending",
      syncError: "",
    };

    setIsSavingOnboardingFirstPlan(true);
    setOnboardingFirstPlanError("");
    setDailyReports((reports) => {
      const nextReports = [report, ...reports.filter((item) => item.id !== report.id)].sort(
        (a, b) => b.date.localeCompare(a.date),
      );
      persistDailyReports(currentUser.uid, userId, nextReports);
      return nextReports;
    });
    void putPersistentItem("dailyReports", report);

    if (selectedDailyDate === date) {
      setDailyPlanItemsDraft(planItemsFromLegacyText(planText));
    }

    try {
      await withTimeout(
        setDoc(
          doc(db, "dailyReports", report.id),
          {
            ...dailyReportToCloudPayload(report),
            updatedAt: report.updatedAt,
            serverUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
        8000,
        "daily-report-save-timeout",
      );
    } catch (error) {
      console.info("Onboarding first plan cloud sync skipped.", error);
    } finally {
      setIsSavingOnboardingFirstPlan(false);
    }

    safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
    /* cross-device 同期：cloud profile にもタイムスタンプを書く。
       これで他端末で新規ログインしてもチュートリアルが再開しない。 */
    setCloudOnboardingCompletedAt(new Date().toISOString());
    setOnboardingStep("idle");
    setOnboardingFirstPlanDraft("");
    showToast(t("今日やることを記録しました。1日を始めましょう。"), { kind: "success" });
  };

  const handleDailyDateChange = (date: string) => {
    const nextReport = dailyReports.find((report) => report.date === date);
    setSelectedDailyDate(date);
    /* Same priority as the load effect — see comment above.
       Phase 11: 切り替え先日付のローカル下書きがあれば最優先で復元。 */
    const localDraft = readLocalDailyDraft(date);

    let nextPlanItems: PlanItem[];
    if (localDraft?.planItems && localDraft.planItems.length > 0) {
      nextPlanItems = localDraft.planItems;
    } else if (nextReport?.planItems && nextReport.planItems.length > 0) {
      nextPlanItems = nextReport.planItems;
    } else if (nextReport?.plan) {
      nextPlanItems = planItemsFromLegacyText(nextReport.plan);
    } else if (!nextReport) {
      nextPlanItems = getCarriedOverItems(dailyReports, date);
    } else {
      nextPlanItems = [];
    }
    setDailyPlanItemsDraft(nextPlanItems);

    if (typeof localDraft?.reflection === "string") {
      setDailyReflectionPartsDraft(parseReflectionParts(localDraft.reflection));
    } else {
      setDailyReflectionPartsDraft(parseReflectionParts(nextReport?.reflection || ""));
    }
    // Carry the saved draft flag forward so reopening an in-progress
    // draft doesn't accidentally publish it on the next save.
    setDailyIsDraftDraft(nextReport?.isDraft === true);
    setDailyMessage("");
  };

  /* 過去日の未完了タスクを今日の plan draft に追加する。
     既存 draft の text と完全一致する item は重複しないよう skip。
     getCarriedOverItems は "今日の前で最も新しい日報" の未完了を取るので、
     昨日のものに限らず数日前の漏れも拾える。 */
  const handleCarryOverUnfinished = () => {
    const candidates = getCarriedOverItems(dailyReports, selectedDailyDate);
    if (candidates.length === 0) {
      showToast(t("持ち越せる未完了タスクはありません"), { kind: "info" });
      return;
    }
    const existingTexts = new Set(
      dailyPlanItemsDraft.map((item) => item.text.trim()).filter(Boolean),
    );
    const newItems = candidates.filter(
      (item) => !existingTexts.has(item.text.trim()),
    );
    if (newItems.length === 0) {
      showToast(t("未完了タスクはすでに含まれています"), { kind: "info" });
      return;
    }
    setDailyPlanItemsDraft((prev) => [...prev, ...newItems]);
    showToast(t("{count}件の未完了タスクを追加しました", { count: newItems.length }), { kind: "success" });
  };

  /* 昨日 (= 選択日の前日) の plan items 全部を today に複製。
     未完了/完了問わず "同じことを今日もやる" 用。done は全て false に
     リセットしてから追加。重複は skip。 */
  const handleCopyPreviousDayPlan = () => {
    const prior = dailyReports
      .filter((report) => report.date && report.date < selectedDailyDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prior) {
      showToast(t("前日の計画が見つかりません"), { kind: "info" });
      return;
    }
    const sourceItems =
      prior.planItems && prior.planItems.length > 0
        ? prior.planItems
        : planItemsFromLegacyText(prior.plan || "");
    if (sourceItems.length === 0) {
      showToast(t("前日の計画が空です"), { kind: "info" });
      return;
    }
    const existingTexts = new Set(
      dailyPlanItemsDraft.map((item) => item.text.trim()).filter(Boolean),
    );
    const newItems = sourceItems
      .filter((item) => item.text.trim().length > 0)
      .filter((item) => !existingTexts.has(item.text.trim()))
      .map((item) => makePlanItem({ text: item.text, done: false }));
    if (newItems.length === 0) {
      showToast(t("前日の計画はすでに含まれています"), { kind: "info" });
      return;
    }
    setDailyPlanItemsDraft((prev) => [...prev, ...newItems]);
    showToast(t("{count}件を前日からコピーしました", { count: newItems.length }), { kind: "success" });
  };

  const handleDailyReportSectionSave = async (section: "plan" | "reflection") => {
    if (!currentUser || isSavingDailyReport) {
      return;
    }

    if (!canEditDailyReportDate(selectedDailyDate)) {
      setDailyMessage(t("日報の編集は当日または1日前までです。"));
      return;
    }

    /* Phase 10b: when the writer saves the plan section, drop empty
       rows but otherwise keep the checklist intact. Empty rows are an
       in-editor artifact ("+ 項目を追加" left blank) — persisting them
       would clutter the carryover list tomorrow. Trim text per row so
       trailing whitespace doesn't sneak into search / Team Daily. */
    const trimmedPlanItems = dailyPlanItemsDraft
      .map((item) => ({
        ...item,
        text: item.text.trim(),
        comment: item.comment?.trim() || "",
      }))
      .filter((item) => item.text.length > 0);
    const planTextFromItems = derivePlanText(trimmedPlanItems);
    /* 3 セクション draft を 1 本の string に serialize してから保存する。
       空セクションは省かれるので、片方しか書いてない場合も最小限の
       text しか残らない。 */
    const reflectionText = serializeReflectionParts(dailyReflectionPartsDraft).trim();
    const sectionLabel = section === "plan" ? t("今日やること") : t("振り返り");

    if (section === "plan" && trimmedPlanItems.length === 0) {
      setDailyMessage(t("{section}を入力してください。", { section: sectionLabel }));
      return;
    }
    /* 今日やること / 振り返り は別々に送信できる。振り返り送信時は
       振り返り本文が空なら中止する (plan を巻き込まない)。 */
    if (section === "reflection" && !reflectionText) {
      setDailyMessage(t("{section}を入力してください。", { section: sectionLabel }));
      return;
    }

    const now = new Date().toISOString();
    const existingReport = dailyReports.find((report) => report.date === selectedDailyDate);
    /* セクション分割でセーブしていたが「振り返り」を保存した時に
       既存の planItems がコピーされ、ユーザーがチェックリストで
       チェックを入れた状態が失われていた (報告)。
       現在の draft (trimmedPlanItems) には done 状態を含む最新の
       チェック状態が反映されているので、draft が空でない限り常に
       draft を採用する。空 draft はリセット扱いを避けて既存を維持。 */
    const nextPlanItems =
      trimmedPlanItems.length > 0 ? trimmedPlanItems : existingReport?.planItems || [];
    const nextPlan =
      trimmedPlanItems.length > 0 ? planTextFromItems : existingReport?.plan || "";
    const nextReflection = section === "reflection" ? reflectionText : existingReport?.reflection || "";
    const isDraft = dailyIsDraftDraft;
    /* Mention extraction scans the plan checklist (text + per-item
       comments) plus the reflection body, so an `@alice` typed inside
       an item comment still feeds the future mentions inbox.
       (旧: section==="plan" の時だけ items を走査していたが、上の
        nextPlanItems が draft 由来になったので両 section で同じ
        nextPlanItems を使う) */
    const planMentionScannable =
      nextPlanItems.length > 0
        ? planItemsToMentionScannable(nextPlanItems)
        : nextPlan;
    const report: DailyReport = {
      id: `${currentUser.uid}_${selectedDailyDate}`,
      userId: currentUser.uid,
      userName: playerName,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      currentTitle,
      date: selectedDailyDate,
      plan: nextPlan,
      reflection: nextReflection,
      createdAt: existingReport?.createdAt || now,
      updatedAt: now,
      syncStatus: "pending",
      syncError: "",
      isDraft,
      mentions: extractMentionsFromFields(planMentionScannable, nextReflection),
      planItems: nextPlanItems,
    };

    setIsSavingDailyReport(true);
    setDailyMessage("");
    setDailyReports((reports) => {
      const nextReports = [report, ...reports.filter((item) => item.id !== report.id)].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      persistDailyReports(currentUser.uid, userId, nextReports);
      return nextReports;
    });
    void putPersistentItem("dailyReports", report);

    // 下書きはクラウドへ送らない. 公開時に切り替えれば、その時点の
    // 内容がそのまま Firestore へ flush される.
    if (isDraft) {
      const localReport: DailyReport = { ...report, syncStatus: "synced", syncError: "" };
      setDailyReports((reports) => {
        const nextReports = mergeDailyReports([localReport, ...reports.filter((item) => item.id !== report.id)]);
        persistDailyReports(currentUser.uid, userId, nextReports);
        return nextReports;
      });
      setDailyMessage(t("{section}を下書き保存しました。共有はされていません。", { section: sectionLabel }));
      setIsSavingDailyReport(false);
      return;
    }

    try {
      await withTimeout(
        setDoc(
          doc(db, "dailyReports", report.id),
          {
            ...dailyReportToCloudPayload(report),
            updatedAt: report.updatedAt,
            serverUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
        8000,
        "Daily report cloud save timed out.",
      );
      const syncedReport: DailyReport = { ...report, syncStatus: "synced", syncError: "" };
      setDailyReports((reports) => {
        const nextReports = mergeDailyReports([syncedReport, ...reports.filter((item) => item.id !== report.id)]);
        persistDailyReports(currentUser.uid, userId, nextReports);
        return nextReports;
      });
      setDailyMessage(t("{section}を保存しました。", { section: sectionLabel }));

      // 日報報酬：当日の「今日やること」と「振り返り」を両方書き終えたら 50 Arc。
      // 1日1回・端末間で二重受領しないよう lastDailyReportRewardDate で gate する。
      // - 過去日の編集には払わない（バックフィルで Arc 稼ぎを成立させない）
      // - 下書き保存では払わない（共有された時点が達成）
      // - 失敗 (catch) 経路でも払わない（クラウドに届いていないため）
      const todayLocal = new Date();
      const todayLocalKey = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;
      const planComplete = syncedReport.planItems && syncedReport.planItems.length > 0;
      const reflectionComplete = syncedReport.reflection.trim().length > 0;
      if (
        selectedDailyDate === todayLocalKey &&
        lastDailyReportRewardDate !== todayLocalKey &&
        !syncedReport.isDraft &&
        planComplete &&
        reflectionComplete
      ) {
        setCoins((value) => value + 50);
        setLastDailyReportRewardDate(todayLocalKey);
        showToast(t("+50 Arc 獲得 ✦ 今日やること & 振り返り を両方完了しました"), {
          kind: "success",
        });
      }
    } catch (error) {
      const pendingReport: DailyReport = {
        ...report,
        syncStatus: "pending",
        syncError: "cloud-save-failed",
      };
      setDailyReports((reports) => {
        const nextReports = mergeDailyReports([pendingReport, ...reports.filter((item) => item.id !== report.id)]);
        persistDailyReports(currentUser.uid, userId, nextReports);
        return nextReports;
      });
      setDailyMessage(
        getFirestoreErrorMessage(
          error,
          t("{section}をローカルに保存しました。クラウドへ再同期します。", { section: sectionLabel }),
          t("{section}をクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。", { section: sectionLabel }),
        ),
      );
    } finally {
      setIsSavingDailyReport(false);
    }
  };

  const handleDailyReportSectionSubmit = (event: FormEvent<HTMLFormElement>, section: "plan" | "reflection") => {
    event.preventDefault();
    void handleDailyReportSectionSave(section);
  };

  const handlePostAuthorOpen = (post: ContributionPostRecord) => {
    if (post.userId === currentUserUid) {
      setProfileMember(null);
      setProfileUser(null);
      setCurrentView("profile");
      return;
    }

    const profile = workspaceProfiles[post.userId];
    if (profile) {
      handleUserProfileOpen(profile);
      return;
    }

    setProfileMember(null);
    setProfileUser({
      uid: post.userId,
      userId: post.userId,
      displayName: post.username,
      photoURL: post.avatar,
      searchName: post.username.toLowerCase(),
      following: [],
      followers: [],
      determination: post.text,
      characterColor: post.characterColor,
      currentTitle: post.currentTitle,
    });
    setCurrentView("profile");
  };

  // Tapping a reply opens the replier's profile — same resolution path as
  // the post author (own profile → cached workspace profile → minimal
  // fallback built from the reply's denormalized author fields).
  const handleReplyAuthorOpen = (reply: ContributionReplyRecord) => {
    if (reply.userId === currentUserUid) {
      setProfileMember(null);
      setProfileUser(null);
      setCurrentView("profile");
      return;
    }

    const profile = workspaceProfiles[reply.userId];
    if (profile) {
      handleUserProfileOpen(profile);
      return;
    }

    setProfileMember(null);
    setProfileUser({
      uid: reply.userId,
      userId: reply.userId,
      displayName: reply.username,
      photoURL: reply.avatar,
      searchName: reply.username.toLowerCase(),
      following: [],
      followers: [],
      characterColor: reply.characterColor,
    });
    setCurrentView("profile");
  };

  /* 旧 quick-fill ヘルパー (useLatestStudyLogAsPost / useRoomPresenceAsPost)
     は対応する composer shortcut ボタンと一緒に撤去。 */

  const handleSettingsOpen = () => {
    setDraftUserName(playerName);
    setDraftUserId(userId);
    setSettingsError("");
    setIsSettingsOpen(true);
  };

  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }

    const timerId = window.setTimeout(() => setIsDesktopWelcomeVisible(false), 2600);
    return () => window.clearTimeout(timerId);
  }, [isDesktopApp, currentUser?.uid]);

  useEffect(() => {
    if (!isDesktopApp || !window.contributionArcDesktop?.onOpenSettings) {
      return;
    }

    return window.contributionArcDesktop.onOpenSettings(() => {
      setDraftUserName(playerName);
      setDraftUserId(userId);
      setSettingsError("");
      setIsSettingsOpen(true);
    });
  }, [isDesktopApp, playerName, userId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded || !userId) {
      return;
    }

    const safeAvatar = getSerializableAvatar(playerAvatar || currentUser.photoURL || "");

    // Build the payload first, then dedupe via JSON signature. lastSyncedAt
    // is intentionally NOT part of the signature — otherwise every render
    // would generate a new timestamp and defeat the dedup. The timestamp is
    // only generated *if* we actually need to write.
    const userProgressPayload = {
      uid: currentUser.uid,
      userId,
      displayName: playerName,
      email: currentUser.email || "",
      avatarUrl: safeAvatar,
      photoURL: safeAvatar,
      level: levelState.level,
      effortExp,
      outputExp,
      currentTitle,
      currentCharacter: characterOptions[0].id,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
      ownedCharacterShapes: [...ownedCharacterShapes].sort(),
      coins,
      lastFeedRewardDate,
      feedRewardArcEarned,
      lastDailyReportRewardDate,
      pokerChips,
      focusChips,
      focusChipsDate,
      focusStayMinutesSnapshot,
      streak: studyStreak,
      determination,
      goalId,
      goalCustomName,
      following: [...following].sort(),
      followers: [] as string[],
      unlockedCharacters: [characterOptions[0].id],
      characterExp: effortExp,
      openedWorkspaceGiftLevels: [...openedWorkspaceGiftLevels].sort(),
      githubId,
      githubUsername,
      contributionCount: outputStats.contributions,
      // Current-week study minutes + the Sunday-start week key they belong
      // to, so friends can build a weekly leaderboard without any extra
      // reads. weekKey lets a stale (previous-week) value count as zero.
      weekMinutes: contributionArc.thisWeekMinutes,
      weekKey: getCurrentWeekKey(),
      // 曜日別 (月→日) の学習分数。プロフィールの週棒グラフ用。
      weekdayMinutes: weeklyStudyHours.map((day) => day.totalMinutes),
      /* cross-device 同期: 旧 localStorage 限定だった設定を user doc
         にも常時 mirror する。スマホで設定したら PC で反映、その逆も。 */
      language,
      pinnedFriendUids: [...pinnedFriendUids].sort(),
      mutedFriendUids: [...mutedFriendUids].sort(),
      blockedFriendUids: [...blockedFriendUids].sort(),
      onboardingCompletedAt: cloudOnboardingCompletedAt,
      // Mirror the current org membership into the periodic progress
      // write so the user doc converges to one consistent shape even
      // if the user just joined/left via the dedicated helpers.
      ...(currentOrganization
        ? {
            organizationId: currentOrganization.id,
            organizationName: currentOrganization.name,
            organizationRole:
              currentOrganization.ownerUid === currentUser.uid
                ? ("owner" as const)
                : ("member" as const),
          }
        : {}),
    };
    const userProgressSignature = JSON.stringify(userProgressPayload);

    // Wait for the cloud profile to hydrate before writing. Flushing the
    // pre-hydration payload could clobber a saved determination with the
    // empty/stale value held before getDoc resolved.
    if (isProfileHydrated && lastSyncedUserProgressRef.current !== userProgressSignature) {
      lastSyncedUserProgressRef.current = userProgressSignature;
      void saveUserProgressToCloud(db, {
        ...userProgressPayload,
        lastSyncedAt: new Date().toISOString(),
      }).catch((error) => {
        console.info("User progress cloud sync skipped.", error);
        // Reset on failure so the next render retries.
        lastSyncedUserProgressRef.current = "";
      });
    }

    const githubActivityPayload = {
      userId: currentUser.uid,
      githubId,
      githubUsername,
      contributionCount: outputStats.contributions,
    };
    const githubActivitySignature = JSON.stringify(githubActivityPayload);

    if (lastSyncedGithubActivityRef.current !== githubActivitySignature) {
      lastSyncedGithubActivityRef.current = githubActivitySignature;
      void saveGithubActivitySummary(db, {
        ...githubActivityPayload,
        lastSyncedAt: new Date().toISOString(),
      }).catch((error) => {
        console.info("GitHub activity cloud sync skipped.", error);
        lastSyncedGithubActivityRef.current = "";
      });
    }
  }, [
    currentTitle,
    currentUser,
    determination,
    goalId,
    goalCustomName,
    effortExp,
    following,
    githubId,
    githubUsername,
    isProfileHydrated,
    isWorkspaceLoaded,
    levelState.level,
    outputExp,
    openedWorkspaceGiftLevels,
    playerAvatar,
    playerCharacterColor,
    playerCharacterShape,
    playerName,
    studyStreak,
    userId,
    coins,
    ownedCharacterShapes,
    lastFeedRewardDate,
    feedRewardArcEarned,
    lastDailyReportRewardDate,
    pokerChips,
    focusChips,
    focusChipsDate,
    focusStayMinutesSnapshot,
    currentOrganization,
    /* cross-device 同期で新規に payload に乗せた依存。これらが変わる
       たびに sync 再評価して、PC で変えた直後にスマホ側からも見えるよう
       にする。 */
    language,
    pinnedFriendUids,
    mutedFriendUids,
    blockedFriendUids,
    cloudOnboardingCompletedAt,
    contributionArc.thisWeekMinutes,
    outputStats.contributions,
  ]);

  /* Auto-join domain discovery (Phase 7). Fires when the user is
     signed in, has an email address, and isn't already in an org.
     Surfaces any orgs that have whitelisted the user's email domain
     so they can one-tap join without an invite link. The query is
     cheap (array-contains on a top-level field, single equality)
     so we re-run it on signin / when the user lands without an org.

     NOTE: this hook MUST stay above the early returns below — moving
     it below them caused React error #310 (rendered fewer hooks than
     expected) on initial load, since the auth-loading render path
     skipped the hook entirely. */
  useEffect(() => {
    if (!currentUser?.email || currentOrganization) {
      setDiscoveredOrgs([]);
      return;
    }
    const domain = currentUser.email.split("@")[1]?.toLowerCase().trim();
    if (!domain) return;
    let cancelled = false;
    void findOrganizationsByEmailDomain(db, domain)
      .then((orgs) => {
        if (!cancelled) setDiscoveredOrgs(orgs);
      })
      .catch((error) => {
        console.info("Domain auto-join discovery skipped.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.email, currentOrganization]);

  if (window.location.pathname === githubCallbackPath) {
    return <GitHubCallbackPage />;
  }

  if (!isAuthReady) {
    /* Phase 11d: 起動 splash と同じ nondo 風語彙の「auth 復帰中」表示。
       純黒/純白 + 1.5px ink hairline + 3 dot 呼吸で世界観を統一し、
       「起動 splash → ここ → ログイン or ホーム」の流れに違和感を出さない。 */
    return (
      <main className="boot-loading-shell" aria-busy="true">
        <section className="boot-loading-card" role="status" aria-live="polite">
          <span className="boot-loading-mark" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
          </span>
          <h1 className="boot-loading-title">Contribution Arc</h1>
          <p className="boot-loading-subtitle">Loading</p>
          <div className="boot-loading-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const handleLinkGithub = async () => {
    if (!currentUser) return;
    setIsLinkingGithub(true);
    setLinkGithubError(null);
    try {
      const result = await linkWithPopup(currentUser, githubProvider);
      // Cache the real GitHub login (additionalUserInfo.profile.login) so
      // the contribution heatmap fetcher uses the correct handle rather
      // than the display name on providerData.
      const additional = getAdditionalUserInfo(result);
      const login = (additional?.profile as { login?: string } | null | undefined)?.login;
      if (login && result.user.uid) {
        try {
          window.localStorage.setItem(`ca:gh-login:${result.user.uid}`, login);
        } catch {
          /* storage disabled — fall back to displayName/userId */
        }
      }
      // linkWithPopup mutates currentUser.providerData in place without
      // firing onAuthStateChanged, so we'd never re-render to pick up the
      // new GitHub provider. Bump a tick to force a fresh derivation pass.
      setAuthRefreshTick((tick) => tick + 1);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code || "";
      let message: string;
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        message = "この GitHub アカウントは別のユーザーで既に使われています。";
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        message = "";
      } else if (code === "auth/provider-already-linked") {
        message = "既に GitHub と連携済みです。";
      } else {
        message = err instanceof Error ? err.message : String(err);
      }
      if (message) setLinkGithubError(message);
    } finally {
      setIsLinkingGithub(false);
    }
  };

  // Persist the chosen language to Firestore (best-effort) and advance
  // onboarding past the language picker into the welcome step. Used by
  // the first-login onboarding flow only — settings-panel language
  // changes go through handleSettingsSubmit / setLanguage directly.
  const completeLanguageOnboarding = async (chosen: Language) => {
    setLanguage(chosen);
    if (currentUser) {
      try {
        await setDoc(
          doc(db, "users", currentUser.uid),
          { language: chosen, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } catch (error) {
        // Non-fatal — language is also cached in localStorage by setLanguage.
        console.warn("Could not save language preference to Firestore", error);
      }
    }
    setOnboardingStep("welcome");
  };

  const handleSettingsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftUserName.trim();
    const nextDisplayName = nextName || playerName || currentUser.email?.split("@")[0] || "Developer";
    const nextUserId = draftUserId.trim();
    const userIdError = validateUserId(nextUserId, t);
    if (userIdError) {
      setSettingsError(userIdError);
      return;
    }

    setIsSavingSettings(true);
    setSettingsError("");

    // Wrap the Firestore transaction with a hard timeout. `runTransaction`
    // has no built-in deadline — on a flaky network it can sit pending
    // indefinitely, which was leaving the onboarding "Saving…" button
    // stuck forever. Tag the timeout error with `code: "unavailable"` so
    // it routes through the existing `canSaveProfileLocally` fallback and
    // the user can still complete onboarding via localStorage.
    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          const err = new Error("Firestore profile sync timed out");
          (err as Error & { code?: string }).code = "unavailable";
          reject(err);
        }, ms);
        promise.then(
          (value) => {
            window.clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            window.clearTimeout(timer);
            reject(error);
          },
        );
      });

    try {
      try {
        const userRef = doc(db, "users", currentUser.uid);

        await withTimeout(
          runTransaction(db, async (transaction) => {
            const userSnapshot = await transaction.get(userRef);
            const currentProfile = userSnapshot.exists()
              ? normalizeUserProfile(currentUser.uid, userSnapshot.data() as Partial<UserProfile>)
              : normalizeUserProfile(currentUser.uid, {
                  displayName: playerName,
                  following,
                  photoURL: playerAvatar,
                  determination,
                  characterColor: playerCharacterColor,
                  characterShape: playerCharacterShape,
                });
            const currentUserId = currentProfile.userId || userId;
            const nextUserIdRef = doc(db, "usernames", nextUserId);
            const nextUserIdSnapshot = await transaction.get(nextUserIdRef);

            if (nextUserIdSnapshot.exists() && nextUserIdSnapshot.data().uid !== currentUser.uid) {
              throw new Error(t("このユーザーIDはすでに使われています。"));
            }

            if (currentUserId && currentUserId !== nextUserId) {
              transaction.delete(doc(db, "usernames", currentUserId));
            }

            transaction.set(nextUserIdRef, {
              uid: currentUser.uid,
              updatedAt: serverTimestamp(),
            });
            transaction.set(
              userRef,
              {
                uid: currentUser.uid,
                userId: nextUserId,
                displayName: nextDisplayName,
                avatarUrl: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
                photoURL: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
                determination,
                characterColor: playerCharacterColor,
                characterShape: playerCharacterShape,
                ownedCharacterShapes: [...ownedCharacterShapes].sort(),
                coins,
                searchName: nextDisplayName.toLowerCase(),
                following: currentProfile.following,
                followers: currentProfile.followers,
                level: levelState.level,
                effortExp,
                outputExp,
                currentTitle,
                currentCharacter: characterOptions[0].id,
                streak: studyStreak,
                unlockedCharacters: [characterOptions[0].id],
                characterExp: effortExp,
                githubId,
                githubUsername,
                contributionCount: outputStats.contributions,
                lastSyncedAt: new Date().toISOString(),
                language,
                ...(userSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }),
          12000,
        );
      } catch (error) {
        if (!canSaveProfileLocally(error)) {
          setSettingsError(
            getFirestoreErrorMessage(
              error,
              t("ユーザーIDを保存できませんでした。"),
              t("ユーザーIDの保存権限が有効になっていません。少し時間を置いて再度お試しください。"),
            ),
          );
          return;
        }

        console.info("Profile cloud sync skipped; saved locally.", error);
      }

      const wasOnboardingSettings = onboardingStep === "settings";
      try {
        const accountScope = getAccountStorageScope(currentUser.uid, nextUserId);
        setUserId(nextUserId);
        setCustomUserName(nextDisplayName);
        safeSetLocalStorage(`contribution-arc-user-id-${currentUser.uid}`, nextUserId);
        safeSetLocalStorage(getAccountStorageKey(accountScope, "name"), nextDisplayName);
        if (!wasOnboardingSettings) {
          safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
        }
      } catch (error) {
        setSettingsError(
          error instanceof Error
            ? error.message
            : t("プロフィールをこのブラウザに保存できませんでした。ブラウザのストレージ設定を確認してください。"),
        );
        return;
      }

      if (wasOnboardingSettings) {
        setOnboardingStep("firstPost");
        // onboarding settings 完了 → 新ホーム (feed) で最初の投稿
        setCurrentView("feed");
      } else {
        setOnboardingStep("idle");
        // Onboarding has its own celebratory flow ("first post" banner),
        // so only toast for regular saves — otherwise the user sees both
        // and the banner gets stepped on.
        showToast(t("プロフィールを保存しました"), { kind: "success" });
      }
      setIsSettingsOpen(false);
    } finally {
      // Guarantee the submit button never stays in "Saving…" regardless of
      // which exit path (success, validation error, sync failure, timeout)
      // we took above.
      setIsSavingSettings(false);
    }
  };

  const handleUserSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const nextQuery = searchQuery.trim();
    if (!nextQuery) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      const usersQuery = query(
        collection(db, "users"),
        orderBy("userId"),
        startAt(nextQuery),
        endAt(`${nextQuery}\uf8ff`),
        limit(12),
      );
      const snapshot = await getDocs(usersQuery);
      const blockedSet = new Set(blockedFriendUids);
      const results = snapshot.docs
        .map((item) => normalizeUserProfile(item.id, item.data() as Partial<UserProfile>))
        .filter(
          (profile) =>
            profile.uid !== currentUser.uid &&
            profile.userId &&
            !blockedSet.has(profile.uid),
        );

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError(t("該当するユーザーが見つかりません。"));
      }
    } catch (error) {
      setSearchError(
        getFirestoreErrorMessage(
          error,
          t("ユーザー検索に失敗しました。"),
          t("ユーザー検索の権限が有効になっていません。少し時間を置いて再度お試しください。"),
        ),
      );
    } finally {
      setIsSearching(false);
    }
  };

  /* 同じ目標のユーザー一覧を開く。catalog 一致 (goalId) と自由入力
     (goalCustomName) は排他的なので、片方が入っていればそれで query。
     自分自身は結果から除外する。 */
  const handleOpenGoalMatch = async (goal: {
    goalId?: string;
    goalCustomName?: string;
    goalLabel: string;
  }) => {
    setGoalMatchModal({
      goalId: goal.goalId,
      goalCustomName: goal.goalCustomName,
      goalLabel: goal.goalLabel,
      users: [],
      loading: true,
      error: "",
    });
    try {
      const results = await listUsersByGoal(db, {
        goalId: goal.goalId,
        goalCustomName: goal.goalCustomName,
      });
      const filtered = results.filter((user) => user.uid !== currentUser?.uid);
      setGoalMatchModal((current) =>
        current
          ? { ...current, users: filtered, loading: false }
          : current,
      );
    } catch (error) {
      console.info("listUsersByGoal failed.", error);
      setGoalMatchModal((current) =>
        current
          ? { ...current, loading: false, error: t("読み込みに失敗しました。もう一度お試しください。") }
          : current,
      );
    }
  };

  /* 目標一覧の行から該当ユーザーのプロフィールを開く。 */
  const handleOpenUserFromGoalMatch = async (user: GoalMatchUser) => {
    setGoalMatchModal(null);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const profile = normalizeUserProfile(user.uid, snap.data() as Partial<UserProfile>);
        handleUserProfileOpen(profile);
      }
    } catch (error) {
      console.info("Open user from goal match skipped.", error);
    }
  };

  const handleUserProfileOpen = (profile: UserProfile) => {
    setProfileMember(null);
    setProfileUser(profile);
    setFriendMessage("");
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setCurrentView("profile");
  };

  const handleFriendRequest = async (profile: UserProfile) => {
    if (!currentUser) {
      return;
    }

    if (friends.length >= 20) {
      setFriendMessage(t("フレンド上限に達しています。"));
      showToast(t("フレンド上限に達しています。"), { kind: "error" });
      return;
    }

    if (profile.uid === currentUser.uid) {
      setFriendMessage(t("自分自身にはフレンド申請できません。"));
      showToast(t("自分自身にはフレンド申請できません。"), { kind: "error" });
      return;
    }

    if (friends.some((friend) => friend.uid === profile.uid)) {
      setFriendMessage(t("すでにフレンドです。"));
      showToast(t("すでにフレンドです。"), { kind: "info" });
      return;
    }

    /* 相手から先に申請が届いている場合は、本人が「申請」を押したら
       そのまま承認扱いにしてしまうのが自然 (= 双方向の意思表示が揃った
       タイミングで成立)。以前は「送信済み」と誤ったエラーを出して
       ユーザーが二度詰みになる原因だった。 */
    const pendingIncomingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === profile.uid &&
        request.status === "pending" &&
        request.direction === "incoming",
    );
    if (pendingIncomingRequest) {
      void handleFriendAccept(pendingIncomingRequest);
      return;
    }

    const pendingOutgoingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === profile.uid &&
        request.status === "pending" &&
        request.direction === "outgoing",
    );
    if (pendingOutgoingRequest) {
      setFriendMessage(t("フレンド申請を送信済みです。"));
      showToast(t("フレンド申請を送信済みです。"), { kind: "info" });
      return;
    }

    const requestId = getFriendRequestDocId(currentUser.uid, profile.uid);
    const outgoingRequest: FriendRequest = {
      id: requestId,
      profile,
      status: "pending",
      direction: "outgoing",
      createdAt: new Date().toISOString(),
    };
    const currentProfile = getCurrentProfile(
      currentUser,
      playerName,
      userId,
      playerAvatar,
      determination,
      playerCharacterColor,
    );
    const incomingRequest: FriendRequest = {
      id: requestId,
      profile: currentProfile,
      status: "pending",
      direction: "incoming",
      createdAt: outgoingRequest.createdAt,
    };

    setFriendRequests((requests) => [
      outgoingRequest,
      ...requests,
    ]);
    upsertStoredFriendRequest(getAccountStorageScope(currentUser.uid, userId), outgoingRequest);
    upsertStoredFriendRequest(getAccountStorageScope(profile.uid, profile.userId), incomingRequest);

    try {
      await setDoc(doc(db, "friendRequests", requestId), {
        fromUid: currentUser.uid,
        toUid: profile.uid,
        fromProfile: currentProfile,
        toProfile: profile,
        status: "pending",
        createdAt: outgoingRequest.createdAt,
        updatedAt: serverTimestamp(),
      });
      // Profile screens / search results don't visibly change state when
      // a request is sent (the "リクエスト" button just goes disabled),
      // so a confirmation toast keeps the user from re-tapping.
      showToast(t("{name} にフレンド申請を送りました", { name: profile.displayName }), { kind: "success" });
      setFriendMessage(t("フレンド申請を送信しました。承認されるとFriendsに表示されます。"));
    } catch (error) {
      /* 旧コードは catch で console.info だけ出して toast は
         「ローカルに保存しました」と success 風に表示していたため、
         実際は cloud 拒否されているのにユーザーは送信成功と勘違いし、
         相手にも届かない → 友達が成立しない、を生んでいた。
         エラーコードを toast に出して即診断できるようにする。
         同時に optimistic に追加したローカル request も rollback。 */
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "")
          : "";
      console.warn("Friend request send failed.", { code, error, requestId });
      setFriendRequests((requests) =>
        requests.filter((item) => item.id !== requestId || item.direction !== "outgoing"),
      );
      removeStoredFriendRequest(getAccountStorageScope(currentUser.uid, userId), requestId);
      if (code === "permission-denied") {
        showToast(
          t("フレンド申請を送れませんでした (permission-denied)。Firestore ルールが更新されていない可能性があります。"),
          { kind: "error" },
        );
      } else if (code) {
        showToast(t("フレンド申請を送れませんでした ({code})", { code }), { kind: "error" });
      } else {
        showToast(t("フレンド申請を送れませんでした。時間をおいて再度お試しください。"), { kind: "error" });
      }
      setFriendMessage("");
    }
  };

  const handleFriendAccept = async (request: FriendRequest) => {
    if (!currentUser) {
      return;
    }

    if (request.direction !== "incoming") {
      setFriendMessage(t("フレンド申請は相手が承認すると成立します。"));
      return;
    }

    if (friends.length >= 20) {
      setFriendMessage(t("フレンド上限に達しています。"));
      showToast(t("フレンド上限に達しています。"), { kind: "error" });
      return;
    }

    const nextFriend = profileToFriend(request.profile, t);
    const currentProfile = getCurrentProfile(
      currentUser,
      playerName,
      userId,
      playerAvatar,
      determination,
      playerCharacterColor,
    );
    setFriends((items) => (items.some((friend) => friend.uid === nextFriend.uid) ? items : [nextFriend, ...items]));
    const acceptedAt = new Date().toISOString();
    setFriendRequests((requests) =>
      requests.map((item) => (item.id === request.id ? { ...item, status: "accepted", acceptedAt } : item)),
    );
    upsertStoredFriendRequest(getAccountStorageScope(currentUser.uid, userId), { ...request, status: "accepted", acceptedAt });
    upsertStoredFriendRequest(getAccountStorageScope(request.profile.uid, request.profile.userId), {
      id: request.id,
      profile: currentProfile,
      status: "accepted",
      direction: "outgoing",
      createdAt: request.createdAt,
      acceptedAt,
    });

    try {
      await setDoc(
        doc(db, "friendRequests", request.id),
        {
          fromUid: request.profile.uid,
          toUid: currentUser.uid,
          fromProfile: request.profile,
          toProfile: currentProfile,
          status: "accepted",
          createdAt: request.createdAt,
          acceptedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setFriendMessage(t("フレンドになりました。"));
      showToast(t("{name} とフレンドになりました", { name: nextFriend.name }), { kind: "success" });
    } catch (error) {
      /* 承認自体は楽観的にローカル反映済み。cloud 同期が失敗したら
         相手側に accept が届かないため、ローカルも rollback して
         整合性を取る (一方的に友達認定された状態を防ぐ)。 */
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "")
          : "";
      console.warn("Friend request accept failed.", { code, error, requestId: request.id });
      setFriends((items) => items.filter((friend) => friend.uid !== nextFriend.uid));
      setFriendRequests((requests) =>
        requests.map((item) => (item.id === request.id ? { ...item, status: "pending" as const, acceptedAt: undefined } : item)),
      );
      if (code === "permission-denied") {
        showToast(
          t("承認できませんでした (permission-denied)。Firestore ルールが更新されていない可能性があります。"),
          { kind: "error" },
        );
      } else if (code) {
        showToast(t("承認できませんでした ({code})", { code }), { kind: "error" });
      } else {
        showToast(t("承認できませんでした。時間をおいて再度お試しください。"), { kind: "error" });
      }
      setFriendMessage("");
    }
  };

  const handleNotificationFriendAccept = (
    event: ReactMouseEvent<HTMLButtonElement>,
    request: FriendRequest,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    void handleFriendAccept(request);
  };

  // 申請の拒否。受信した pending request を rejected に更新し、
  // ローカルからも消す（履歴は cloud 側に rejected として残るが、
  // notification には現れない）。送信側にも rejected status が同期される
  // ので「断られた」が分かる ── 既存の "永久 pending" 状態を解消する。
  const handleFriendReject = async (request: FriendRequest) => {
    if (!currentUser) return;
    if (request.direction !== "incoming") return;

    setFriendRequests((requests) => requests.filter((item) => item.id !== request.id));
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    removeStoredFriendRequest(accountScope, request.id);

    try {
      await setDoc(
        doc(db, "friendRequests", request.id),
        {
          status: "rejected",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      // しばらく後に doc を delete して spam を防ぐ。失敗しても無視。
      void deleteDoc(doc(db, "friendRequests", request.id)).catch(() => {});
    } catch (error) {
      console.info("Friend request reject cloud sync skipped.", error);
    }
    showToast(t("申請を拒否しました"), { kind: "info" });
  };

  const handleNotificationFriendReject = (
    event: ReactMouseEvent<HTMLButtonElement>,
    request: FriendRequest,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    void handleFriendReject(request);
  };

  // 友達削除。friendRequests/{id} を双方とも delete する（rules で許可済み）。
  // 双方の friends list / pinnedFriends / mutedFriends から該当 uid を除外。
  // confirm はモーダル側で取ってから呼び出す前提（呼び側で window.confirm）。
  const handleFriendRemove = async (friend: FriendPreview) => {
    if (!currentUser) return;
    const requestId = getFriendRequestDocId(currentUser.uid, friend.uid);
    const reverseRequestId = getFriendRequestDocId(friend.uid, currentUser.uid);

    setFriends((items) => items.filter((item) => item.uid !== friend.uid));
    setFriendRequests((requests) =>
      requests.filter((item) => item.profile.uid !== friend.uid),
    );
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    removeStoredFriendRequest(accountScope, requestId);
    removeStoredFriendRequest(accountScope, reverseRequestId);
    setPinnedFriendUids((ids) => ids.filter((id) => id !== friend.uid));

    try {
      // どちらの方向で friendRequest が作られたか分からないので両方試す。
      await Promise.allSettled([
        deleteDoc(doc(db, "friendRequests", requestId)),
        deleteDoc(doc(db, "friendRequests", reverseRequestId)),
      ]);
    } catch (error) {
      console.info("Friend remove cloud sync skipped.", error);
    }
    showToast(t("{name} をフレンドから外しました", { name: friend.name }), { kind: "info" });
  };

  // ミュート切替（関係維持・通知のみ抑制）
  const handleToggleFriendMute = (uid: string) => {
    setMutedFriendUids((ids) => (ids.includes(uid) ? ids.filter((id) => id !== uid) : [...ids, uid]));
  };

  // ブロック：友達関係を解除しつつ blockedFriendUids に追加。
  // クライアント側のフィルタなので完全防御ではないが、UI 上は完全に
  // 見えなくなる。仕様としては「自分のクライアントから消す」スコープ。
  const handleBlockUser = async (target: { uid: string; name: string }) => {
    if (!currentUser) return;
    if (target.uid === currentUser.uid) return;

    setBlockedFriendUids((ids) => (ids.includes(target.uid) ? ids : [...ids, target.uid]));
    const wasFriend = friends.some((friend) => friend.uid === target.uid);
    if (wasFriend) {
      const friend = friends.find((item) => item.uid === target.uid);
      if (friend) {
        await handleFriendRemove(friend).catch(() => {});
      }
    }
    setFriendRequests((requests) => requests.filter((item) => item.profile.uid !== target.uid));
    showToast(t("{name} をブロックしました", { name: target.name }), { kind: "info" });
  };

  const handleUnblockUser = (uid: string) => {
    setBlockedFriendUids((ids) => ids.filter((id) => id !== uid));
    showToast(t("ブロックを解除しました"), { kind: "success" });
  };

  // 応援 (👏)。1 日 1 回まで。doc ID で二重防止 → ローカル即時 disable。
  const handleSendEncouragement = async (recipient: { uid: string; name: string }) => {
    if (!currentUser) return;
    if (recipient.uid === currentUser.uid) return;
    if (encouragementsSent.has(recipient.uid)) {
      showToast(t("今日はもう応援を送りました"), { kind: "info" });
      return;
    }
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const docId = `${currentUser.uid}_${recipient.uid}_${today}`;
    setEncouragementsSent((set) => {
      const next = new Set(set);
      next.add(recipient.uid);
      return next;
    });
    try {
      await setDoc(doc(db, "encouragements", docId), {
        senderUid: currentUser.uid,
        senderName: playerName || "Developer",
        senderUserId: userId,
        recipientUid: recipient.uid,
        createdAt: new Date().toISOString(),
      });
      showToast(t("{name} に応援を送りました", { name: recipient.name }), { kind: "success" });
    } catch (error) {
      console.info("Encouragement send skipped (likely duplicate).", error);
    }
  };

  // dismiss-stale の実体 useEffect は state 宣言直下に移動済み
  // （早期 return より前に hook を呼ぶため。React error #310 回避）。

  // Send a friend a targeted invite to the room the user currently has
  // selected. Optimistically flips the row to "招待済み"; rolls back if the
  // write fails so the user can retry.
  const handleSendWorkspaceInvite = async (friend: FriendPreview) => {
    if (!currentUser) return;
    if (!selectedRoom) {
      showToast(t("先に作業部屋を選んでください"), { kind: "info" });
      return;
    }

    setInvitedFriendUids((prev) => {
      const next = new Set(prev);
      next.add(friend.uid);
      return next;
    });

    const invite: WorkspaceInviteRecord = {
      id: crypto.randomUUID(),
      fromUid: currentUser.uid,
      fromName: playerName || "Developer",
      toUid: friend.uid,
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      message: "",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    try {
      await createWorkspaceInvite(db, invite);
      showToast(t("{friend} を「{room}」に招待しました", { friend: friend.name, room: selectedRoom.name }), { kind: "success" });
    } catch (error) {
      console.info("Workspace invite send skipped.", error);
      setInvitedFriendUids((prev) => {
        const next = new Set(prev);
        next.delete(friend.uid);
        return next;
      });
      showToast(t("招待を送れませんでした。時間をおいて再度お試しください"), { kind: "error" });
    }
  };

  // 一括招待。複数 friend uid を受けて逐次 invite を送る。
  const handleBatchInvite = async (targetUids: string[]) => {
    if (!currentUser) return;
    if (!selectedRoom) {
      showToast(t("先に作業部屋を選んでください"), { kind: "info" });
      return;
    }
    if (targetUids.length === 0) return;
    let sent = 0;
    for (const uid of targetUids) {
      const friend = friends.find((item) => item.uid === uid);
      if (!friend) continue;
      try {
        await handleSendWorkspaceInvite(friend);
        sent += 1;
      } catch {
        /* 1件失敗しても続行 */
      }
    }
    if (sent > 1) showToast(t("{n} 人に一斉招待を送りました", { n: sent }), { kind: "success" });
  };

  // Accept an incoming invite: jump to the inviter's room and mark the
  // invite accepted (which drops it from the pending snapshot).
  const handleAcceptWorkspaceInvite = async (invite: WorkspaceInviteRecord) => {
    setSelectedRoomId(invite.roomId);
    setCurrentView("workspace");
    setIsNotificationsOpen(false);
    setAppNotifications((items) =>
      items.map((item) =>
        item.id === `workspaceInvite:${invite.id}` ? { ...item, read: true } : item,
      ),
    );

    try {
      await respondToWorkspaceInvite(db, invite.id, "accepted");
    } catch (error) {
      console.info("Workspace invite accept sync skipped.", error);
    }

    showToast(t("「{name}」へ移動しました", { name: invite.roomName }), { kind: "success" });
  };

  const handleNotificationInviteAccept = (
    event: ReactMouseEvent<HTMLButtonElement>,
    invite: WorkspaceInviteRecord,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    void handleAcceptWorkspaceInvite(invite);
  };

  const handleFriendOpen = (friend: FriendPreview) => {
    setProfileMember(null);
    setProfileUser({
      uid: friend.uid,
      userId: friend.userId,
      displayName: friend.name,
      photoURL: friend.avatar,
      searchName: friend.name.toLowerCase(),
      following: [],
      followers: [],
    });
    setFriendMessage("");
    setCurrentView("profile");
  };


  /* 「決意」の自動保存。保存ボタンを廃止し、入力欄から focus が外れた
     タイミング (onBlur) で呼ぶ。値が既存と同じなら no-op。 */
  const handleDeterminationSave = (rawText?: string) => {
    const sourceText = typeof rawText === "string" ? rawText : draftDetermination;
    const nextDetermination = sourceText.trim();
    if (nextDetermination === determination.trim()) return;
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    setDetermination(nextDetermination);
    setDraftDetermination(nextDetermination);
    safeSetLocalStorage(getAccountStorageKey(accountScope, "determination"), nextDetermination);
    if (userId) {
      void setDoc(
        doc(db, "users", currentUser.uid),
        {
          uid: currentUser.uid,
          userId,
          displayName: playerName,
          photoURL: playerAvatar,
          determination: nextDetermination,
          characterColor: playerCharacterColor,
          searchName: playerName.toLowerCase(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch((error) => {
        console.info("Determination cloud sync skipped.", error);
      });
    }
  };

  // Pull to Refresh のハンドラ。posts は Firestore の onSnapshot で
  // リアルタイム購読中なので技術的には refresh 不要だが、X 流の引いて
  // 更新ジェスチャを実装した時に「何も起きない」と無効感が出る。短い
  // delay で indicator スピンを見せて「更新した」体感を作る。
  const handleFeedRefresh = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
  };

  const handleProfileBack = () => {
    // プロフィールから「戻る」も新ホーム (feed) へ
    setCurrentView("feed");
    setProfileMember(null);
    setProfileUser(null);
  };

  const handleMemberProfileOpen = async (member: WorkspaceMember) => {
    setProfileMember(member.userId === currentUser.uid ? null : member);
    setProfileUser(null);
    if (member.userId !== currentUser.uid && !member.userId.startsWith("npc-")) {
      try {
        const snapshot = await getDoc(doc(db, "users", member.userId));
        if (snapshot.exists()) {
          setProfileUser(normalizeUserProfile(member.userId, snapshot.data() as Partial<UserProfile>));
          setProfileMember(null);
        }
      } catch (error) {
        console.info("Member profile cloud load skipped.", error);
      }
    }
    setCurrentView("profile");
  };

  // Dismiss every in-stage popover (profile / note / monument). Wired to
  // the shared backdrop and to the cards' close buttons.
  const handleCloseRoomPanels = () => {
    setRoomMemberPanel(null);
    setRoomMemberPanelUser(null);
    setOpenFloorNoteId(null);
    setIsComposingFloorNote(false);
    setFloorNoteError("");
    setIsEditingAppearance(false);
    setOpenMonumentId(null);
  };

  // 開発者アカウント専用：任意のユーザーを作業部屋から強制退出させる。誤操作で
  // 取り返しがつかないので、必ず window.confirm の確認フェーズを一度挟んでから
  // 実行する。本人の EXP は当人の領域なので加算できず、ここでは在室表示だけを外す。
  const handleAdminForceLeave = (member: WorkspaceMember, roomId: string) => {
    if (!isDeveloperAccount) {
      return;
    }
    const confirmed = window.confirm(
      t("{name} を作業部屋から強制退出させますか？この操作は取り消せません。", { name: member.name }),
    );
    if (!confirmed) {
      return;
    }
    handleCloseRoomPanels();
    setCustomRooms((rooms) =>
      rooms.map((item) => {
        const normalizedRoom = normalizeWorkspaceRoom(item);
        if (normalizedRoom.id !== roomId) {
          return normalizedRoom;
        }
        const nextRoom = normalizeWorkspaceRoom({
          ...normalizedRoom,
          activeMembers: normalizedRoom.activeMembers.filter(
            (activeMember) => activeMember.userId !== member.userId,
          ),
        });
        pendingWorkspaceRoomsRef.current.set(roomId, nextRoom);
        return nextRoom;
      }),
    );
    void adminRemoveWorkspaceMemberFromCloud(roomId, member.userId)
      .then(() => {
        pendingWorkspaceRoomsRef.current.delete(roomId);
      })
      .catch((error) => {
        console.error("Admin force-leave failed.", error);
      });
    showToast(t("{name} を退出させました", { name: member.name }), { kind: "success" });
  };

  // Tapping an avatar *inside the workspace room*. Opens the same compact
  // in-stage profile card for every member — including yourself — so the
  // popover stays a consistent "tap a character to see who they are" gesture.
  // The card swaps its friend-request affordances for an "あなた" label when
  // the tapped member is the current user (see `roomMemberCompactCard`).
  const handleRoomMemberTap = (member: WorkspaceMember) => {
    handleCloseRoomPanels();
    setFriendMessage("");
    setRoomMemberPanel(member);
    setRoomMemberPanelUser(null);
    if (!member.userId.startsWith("npc-") && member.userId !== currentUser.uid) {
      void getDoc(doc(db, "users", member.userId))
        .then((snapshot) => {
          if (snapshot.exists()) {
            setRoomMemberPanelUser(
              normalizeUserProfile(member.userId, snapshot.data() as Partial<UserProfile>),
            );
          }
        })
        .catch((error) => {
          console.info("Room member profile cloud load skipped.", error);
        });
    }
  };

  const markFloorNoteRead = (id: string) => {
    setReadFloorNoteIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        const key = currentUser?.uid
          ? `ca:read-floor-notes:${currentUser.uid}`
          : "ca:read-floor-notes";
        localStorage.setItem(key, JSON.stringify(Array.from(next)));
      } catch {
        // localStorage unavailable (private mode) — unread state just
        // won't persist across reloads, which is acceptable.
      }
      return next;
    });
  };

  const handleComposeFloorNote = () => {
    handleCloseRoomPanels();
    setFloorNoteDraft("");
    setFloorNoteError("");
    setIsComposingFloorNote(true);
  };

  // Open the in-room "着替え" popover so members can restyle their
  // avatar (shape + color) without leaving the workspace. The picker
  // reuses the same setters as the settings/profile screens, so changes
  // persist through the existing saveUserProgressToCloud effect.
  const handleComposeAppearance = () => {
    handleCloseRoomPanels();
    setIsEditingAppearance(true);
  };

  const handleFloorNoteOpen = (id: string) => {
    handleCloseRoomPanels();
    setOpenFloorNoteId(id);
    markFloorNoteRead(id);
  };

  const handleSaveFloorNote = async () => {
    if (!currentUser || !selectedRoom) return;
    const text = floorNoteDraft.trim();
    if (!text) {
      setFloorNoteError(t("メッセージを入力してください。"));
      return;
    }
    setIsSavingFloorNote(true);
    setFloorNoteError("");
    const now = new Date();
    const note: FloorNoteRecord = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      name: playerName,
      color: playerCharacterColor,
      // Drop it near where you're standing, nudged a little so multiple
      // notes don't stack exactly on top of each other.
      x: Math.min(92, Math.max(8, playerPosition.x + (Math.random() * 16 - 8))),
      y: Math.min(86, Math.max(14, playerPosition.y + (Math.random() * 10 - 5))),
      text: text.slice(0, 200),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
    try {
      await saveFloorNote(db, selectedRoom.id, note);
      // Author has obviously "read" their own note.
      markFloorNoteRead(note.id);
      setIsComposingFloorNote(false);
      setFloorNoteDraft("");
    } catch (error) {
      console.info("Floor note save failed.", error);
      setFloorNoteError(t("置き手紙を残せませんでした。"));
    } finally {
      setIsSavingFloorNote(false);
    }
  };

  const handleDeleteFloorNote = async (id: string) => {
    if (!selectedRoom) return;
    try {
      await deleteFloorNote(db, selectedRoom.id, id);
    } catch (error) {
      console.info("Floor note delete failed.", error);
    }
    handleCloseRoomPanels();
  };





  const closeWorkspaceSession = (
    roomId: string,
    options?: { auto?: boolean; overrideMinutes?: number },
  ) => {
    const room = customRooms.map(normalizeWorkspaceRoom).find((item) => item.id === roomId);
    const member = room?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!room || !member) {
      return;
    }

    const isAutoLeave = options?.auto ?? false;
    // overrideMinutes は退出し忘れゴーストの救済退出用。最終操作時刻が残って
    // いないため EXP を実測できないので、一律の換算値を minutes として使う。
    const isGhostCleanup = typeof options?.overrideMinutes === "number";

    const leftAt = new Date().toISOString();
    // EXP は「入室〜最後に操作した時刻」で確定。最終操作以降の放置分は計上せず、
    // 手動休憩は getWorkspaceActiveMinutes 側で従来通り除外される。
    const lastActivityMs = Math.min(lastWorkspaceActivityRef.current, Date.now());
    const minutes = isGhostCleanup
      ? (options?.overrideMinutes ?? 0)
      : getWorkspaceActiveMinutes(member, lastActivityMs);
    const session: WorkspaceSessionHistory = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      userName: member.name,
      roomId: room.id,
      roomName: room.name,
      task: member.currentTask || member.building,
      building: member.building,
      color: member.color,
      joinedAt: member.joinedAt,
      leftAt,
      durationMinutes: minutes,
      earnedExp: getRoomSessionExp(minutes),
      minutes,
      exp: getRoomSessionExp(minutes),
    };

    setCustomRooms((rooms) =>
      rooms.map((item) => {
        const normalizedRoom = normalizeWorkspaceRoom(item);

        if (normalizedRoom.id !== roomId) {
          return normalizedRoom;
        }

        const nextRoom = normalizeWorkspaceRoom({
          ...normalizedRoom,
          totalMinutes: normalizedRoom.totalMinutes + minutes,
          contributions: normalizedRoom.contributions + 1,
          activeMembers: normalizedRoom.activeMembers.filter((activeMember) => activeMember.userId !== currentUser.uid),
          history: [session, ...normalizedRoom.history],
        });

        pendingWorkspaceRoomsRef.current.set(roomId, nextRoom);
        return nextRoom;
      }),
    );

    // 退室をクラウドにも反映する。同期 effect は「自分が含まれる部屋」しか
    // 書き戻さないため、抜けた部屋には自分が Firestore 上に残り続け、複数部屋
    // 同時在席や解体後の復活の原因になっていた。自分を除いた room を直接書き戻す。
    const leftRoom = pendingWorkspaceRoomsRef.current.get(roomId);
    if (leftRoom) {
      void saveWorkspaceRoomToCloud(leftRoom, currentUser.uid).catch((error) => {
        console.info("Workspace leave cloud sync skipped.", error);
      });
    }

    const matchedSessionItem = learningItems.find(
      (item) => !item.archived && item.name.toLowerCase() === session.building.trim().toLowerCase(),
    );
    const sessionLog: StudyLog = {
      id: `workspace-${session.id}`,
      subject: matchedSessionItem ? matchedSessionItem.name : session.building,
      minutes: session.minutes,
      createdAt: session.leftAt,
      color: matchedSessionItem ? matchedSessionItem.color : session.color,
      ...(matchedSessionItem ? { learningItemId: matchedSessionItem.id } : {}),
    };

    setStudyLogs((logs) => [...logs, sessionLog]);
    void saveWorkspaceSessionToCloud(db, {
      id: session.id,
      userId: session.userId,
      roomId: session.roomId,
      roomName: session.roomName,
      task: session.task,
      joinedAt: session.joinedAt,
      leftAt: session.leftAt,
      durationMinutes: session.durationMinutes,
      earnedExp: session.earnedExp,
    }).catch((error) => {
      console.info("Workspace session cloud save skipped.", error);
    });
    void saveStudyLogToCloud(db, currentUser.uid, sessionLog, {
      roomId: session.roomId,
      earnedExp: session.earnedExp,
      source: "workspace-session",
      organizationId: currentOrganization?.id,
    }).catch((error) => {
      console.error("Workspace study log cloud save failed.", error);
    });
    setLastRoomSession(session);
    // EXP/minute earnings only become visible on the profile screen,
    // which the user usually isn't looking at when they leave a room.
    // The toast surfaces the reward immediately so the action feels
    // rewarding rather than empty.
    if (session.durationMinutes > 0) {
      if (isAutoLeave) {
        // 放置による自動退室。本人は画面を見ていないので、すぐ消えるトーストでは
        // なく一覧に残るアプリ内通知で記録内容を控えめに伝える。ゴースト救済時は
        // 実測ができないため「換算で記録した」旨を明示する。
        pushAppNotification(
          {
            id: `workspace-auto-leave-${session.id}`,
            type: "dailyLog",
            title: t("作業部屋を自動退室しました"),
            body: isGhostCleanup
              ? t("在室時間が上限を超えていたため自動退室しました。今回は{time}（+{exp} EXP）として記録しています。", {
                  time: formatStayTime(session.durationMinutes, language),
                  exp: session.earnedExp,
                })
              : t("無操作が続いたため、最終操作までの{time}（+{exp} EXP）を記録しました。", {
                  time: formatStayTime(session.durationMinutes, language),
                  exp: session.earnedExp,
                }),
            createdAt: session.leftAt,
            read: false,
            sourceUserId: currentUser.uid,
          },
          false,
        );
      } else {
        showToast(
          t("退室しました ・ {time} で +{exp} EXP", { time: formatStayTime(session.durationMinutes, language), exp: session.earnedExp }),
          { kind: "success" },
        );
      }
    }

    // 「みんなと作業している感」を出すために、5 分以上の積み上げは FEED に
    // 自動で流す。ゴースト救済（実測ではない概算）の場合は本人の意思では
    // ないので流さない。アイドル自動退室は流す — そこで作業していたのは事実。
    if (!isGhostCleanup && session.durationMinutes >= 5) {
      const taskLabel = session.task ? t("「{task}」を", { task: session.task }) : "";
      void enqueueAutoPost({
        kind: "auto-workspace",
        text: t("{room} で{taskLabel}{time}積み上げました ✦ +{exp} EXP", {
          room: session.roomName,
          taskLabel,
          time: formatStayTime(session.durationMinutes, language),
          exp: session.earnedExp,
        }),
        studyMinutesValue: session.durationMinutes,
        roomIdValue: session.roomId,
        roomNameValue: session.roomName,
      });
    }
  };

  // idle 監視 effect（早期 return より前に配置）から、毎レンダー再生成される
  // この関数の最新版を呼べるよう参照を更新する。
  closeWorkspaceSessionRef.current = closeWorkspaceSession;

  const resetWorkspacePresence = () => {
    pressedWorkspaceKeysRef.current.clear();
    isPlayerWalkingRef.current = false;
    setIsPlayerWalking(false);
    setPendingJoinRoomId(null);
    setLastRoomSession(null);
    setCustomRooms((rooms) => removeWorkspacePresenceForUser(rooms, currentUser.uid));
  };

  const startWorkspaceSession = (roomId: string, task: string, color: string) => {
    const nextTask = task.trim();
    if (!nextTask) {
      setWorkspaceStartError(t("作業内容を入力してください。"));
      setWorkspaceBubble(t("作業内容を入力してください。"));
      return;
    }

    setWorkspaceStartError("");
    const joinedAt = new Date().toISOString();
    const seatPosition = getWorkspaceSeatPosition(nextTask);
    const targetRoom = allWorkspaceRooms.find((room) => room.id === roomId);

    if (!targetRoom) {
      setWorkspaceStartError(t("Roomデータを読み込めませんでした。もう一度Roomを選択してください。"));
      setWorkspaceBubble(t("Roomデータを読み込めませんでした。"));
      return;
    }

    // 入室先以外で自分が在席している部屋からは退出扱いにし、Firestore 上も
    // 自分を取り除く。これをしないと 1 人が複数の部屋に同時在席する状態が
    // クラウドに残り、リロード時に解体済みの部屋まで自分ごと復活してしまう。
    allWorkspaceRooms.forEach((room) => {
      if (room.id === roomId) return;
      if (!(room.activeMembers || []).some((member) => member.userId === currentUser.uid)) {
        return;
      }
      const withoutSelf = normalizeWorkspaceRoom({
        ...room,
        activeMembers: (room.activeMembers || []).filter(
          (member) => member.userId !== currentUser.uid,
        ),
      });
      void saveWorkspaceRoomToCloud(withoutSelf, currentUser.uid).catch((error) => {
        console.info("Leave previous room cloud sync skipped.", error);
      });
    });

    const nextMember = createWorkspaceMember({
      id: currentUser.uid,
      userId: currentUser.uid,
      name: playerName,
      building: nextTask,
      currentTask: nextTask,
      color,
      joinedAt,
      activeStartedAt: joinedAt,
      accumulatedActiveMinutes: 0,
      breakStartedAt: "",
      x: seatPosition.x,
      y: seatPosition.y,
      status: "working",
      tone: "deep",
      avatar: playerAvatar,
      characterColor: playerCharacterColor,
      characterShape: playerCharacterShape,
    });

    setSelectedRoomId(roomId);
    setWorkspaceTask(nextTask);
    setLastRoomSession(null);
    setPendingJoinRoomId(null);
    setPlayerPosition(seatPosition);
    pressedWorkspaceKeysRef.current.clear();
    isPlayerWalkingRef.current = false;
    setIsPlayerWalking(false);
    setCustomRooms((rooms) => {
      const normalizedRooms = rooms.map(normalizeWorkspaceRoom).filter((room) => !isLegacyWorkspaceRoom(room));
      const baseRooms =
        normalizedRooms.some((room) => room.id === roomId)
          ? normalizedRooms
          : [
              ...normalizedRooms,
              normalizeWorkspaceRoom({
                ...targetRoom,
                activeMembers: targetRoom.activeMembers.filter((member) => !isScheduledWorkspaceNpc(member)),
              }),
            ];

      const nextRooms = baseRooms.map((room) => {
        const normalizedRoom = normalizeWorkspaceRoom(room);
        const activeMembers = normalizedRoom.activeMembers.filter(
          (member) => member.userId !== currentUser.uid && !isScheduledWorkspaceNpc(member),
        );

        if (normalizedRoom.id !== roomId) {
          return activeMembers.length === normalizedRoom.activeMembers.length
            ? normalizedRoom
            : normalizeWorkspaceRoom({ ...normalizedRoom, activeMembers });
        }

        const nextRoom = normalizeWorkspaceRoom({
          ...normalizedRoom,
          activeMembers: [...activeMembers, nextMember],
        });

        pendingWorkspaceRoomsRef.current.set(roomId, nextRoom);
        return nextRoom;
      });

      return nextRooms;
    });
  };

  const handleRoomJoin = (roomId: string) => {
    const nextTask = workspaceTask.trim();
    if (!nextTask) {
      setPendingJoinRoomId(roomId);
      setWorkspaceDraftTask("");
      setWorkspaceStartError(t("作業内容を入力してください。"));
      setWorkspaceBubble(t("作業内容を入力してください。"));
      return;
    }

    startWorkspaceSession(roomId, nextTask, studyColor);

    // Fire-and-forget Slack notification when the joining user
    // belongs to an org that has opted into the roomJoins event.
    // The fetch is intentionally not awaited — a slow Slack POST
    // must not delay the visible "you're in" feedback. Failures
    // are swallowed inside postToSlackWebhook.
    if (
      currentOrganization?.slackWebhookUrl &&
      currentOrganization.slackEvents?.roomJoins
    ) {
      const room = allWorkspaceRooms.find((item) => item.id === roomId);
      const roomName = room?.name || t("作業部屋");
      void postToSlackWebhook(
        currentOrganization.slackWebhookUrl,
        buildRoomJoinBlocks(
          { name: playerName, meta: t("Lv {lv} · {days}日連続", { lv: levelState.level, days: studyStreak }) },
          roomName,
          nextTask,
          language,
        ),
      );
    }
  };

  const handleWorkspaceStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingJoinRoomId) {
      return;
    }

    const nextTask = workspaceDraftTask.trim();
    if (!nextTask) {
      setWorkspaceStartError(t("作業内容を入力してください。"));
      return;
    }

    startWorkspaceSession(pendingJoinRoomId, nextTask, workspaceDraftColor);
  };

  const handleRoomLeave = () => {
    if (!selectedRoom) {
      return;
    }

    const selectedLocalRoom = customRooms.map(normalizeWorkspaceRoom).find((room) => room.id === selectedRoom.id);
    const member = selectedLocalRoom?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!member) {
      resetWorkspacePresence();
      return;
    }

    // Slack room-leave notification (Phase 9). Captured BEFORE the
    // close call so we still have stayMinutes from the member entry.
    if (
      currentOrganization?.slackWebhookUrl &&
      currentOrganization.slackEvents?.roomLeaves
    ) {
      const stayMinutes = getWorkspaceActiveMinutes(member, Date.now());
      void postToSlackWebhook(
        currentOrganization.slackWebhookUrl,
        buildRoomLeaveBlocks(
          { name: playerName, meta: t("Lv {lv} · {days}日連続", { lv: levelState.level, days: studyStreak }) },
          selectedRoom.name,
          formatStayTime(stayMinutes, language),
          language,
        ),
      );
    }

    closeWorkspaceSession(selectedRoom.id);
  };

  const handleOpenRecruitmentModal = () => {
    setRecruitmentDraft({
      mode: "now",
      durationMinutes: 60,
      message: "",
      scheduledAt: (() => {
        const next = new Date(Date.now() + 60 * 60 * 1000);
        next.setSeconds(0, 0);
        // Format for datetime-local input (YYYY-MM-DDTHH:mm)
        const pad = (value: number) => value.toString().padStart(2, "0");
        return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
      })(),
    });
    setRecruitmentError("");
    setIsRecruitmentModalOpen(true);
  };

  const handleCloseRecruitmentModal = () => {
    setIsRecruitmentModalOpen(false);
    setRecruitmentError("");
  };

  const handleCreateRecruitmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !selectedRoom) {
      setRecruitmentError(t("入室する作業部屋を選択してください。"));
      return;
    }
    const task = workspaceTask.trim();
    if (!task) {
      setRecruitmentError(t("作業内容を入力してから募集してください。"));
      return;
    }
    const message = recruitmentDraft.message.trim();
    if (message.length > 140) {
      setRecruitmentError(t("メッセージは140字までです。"));
      return;
    }

    const now = new Date();
    let startAtDate = now;
    if (recruitmentDraft.mode === "scheduled") {
      if (!recruitmentDraft.scheduledAt) {
        setRecruitmentError(t("開始時刻を入力してください。"));
        return;
      }
      const scheduled = new Date(recruitmentDraft.scheduledAt);
      if (Number.isNaN(scheduled.getTime())) {
        setRecruitmentError(t("開始時刻が正しくありません。"));
        return;
      }
      if (scheduled.getTime() <= now.getTime()) {
        setRecruitmentError(t("開始時刻は今より後を指定してください。"));
        return;
      }
      const maxFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (scheduled.getTime() > maxFuture.getTime()) {
        setRecruitmentError(t("予約は24時間以内までです。"));
        return;
      }
      startAtDate = scheduled;
    }

    const duration = Math.max(15, Math.min(240, recruitmentDraft.durationMinutes));
    const expiresAtDate = new Date(startAtDate.getTime() + duration * 60 * 1000);

    const record: WorkspaceRecruitmentRecord = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      task,
      message,
      durationMinutes: duration,
      createdAt: now.toISOString(),
      startAt: startAtDate.toISOString(),
      expiresAt: expiresAtDate.toISOString(),
      joinedUserIds: [currentUser.uid],
    };

    try {
      await createRecruitmentInCloud(db, record);
      setWorkspaceRecruitments((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
      setIsRecruitmentModalOpen(false);
      setRecruitmentError("");

      // Mirror the recruitment to Slack if the org has opted in.
      // Same fire-and-forget pattern as the room-join hook — must
      // not block the publish acknowledgement.
      if (
        currentOrganization?.slackWebhookUrl &&
        currentOrganization.slackEvents?.recruitments
      ) {
        const startAtLabel = startAtDate.toLocaleString("ja-JP", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        void postToSlackWebhook(
          currentOrganization.slackWebhookUrl,
          buildRecruitmentBlocks(
            { name: playerName, meta: t("Lv {lv} · {days}日連続", { lv: levelState.level, days: studyStreak }) },
            selectedRoom.name,
            task,
            duration,
            startAtLabel,
            message,
            language,
          ),
        );
      }
    } catch (error) {
      console.warn("Failed to create recruitment", error);
      setRecruitmentError(t("募集の投稿に失敗しました。時間をおいて再度お試しください。"));
    }
  };

  const handleJoinRecruitment = (recruitment: WorkspaceRecruitmentRecord) => {
    if (!currentUser) return;
    const nowMs = Date.now();
    const startAtMs = new Date(recruitment.startAt).getTime();
    const isActive = nowMs >= startAtMs && nowMs < new Date(recruitment.expiresAt).getTime();

    setWorkspaceRecruitments((prev) =>
      prev.map((item) =>
        item.id === recruitment.id && !item.joinedUserIds.includes(currentUser.uid)
          ? { ...item, joinedUserIds: [...item.joinedUserIds, currentUser.uid] }
          : item,
      ),
    );

    void joinRecruitmentInCloud(db, recruitment.id, currentUser.uid).catch((error) => {
      console.warn("Failed to join recruitment", error);
    });

    if (isActive) {
      startWorkspaceSession(recruitment.roomId, recruitment.task, studyColor);
    }
  };

  const handleCancelRecruitment = (recruitment: WorkspaceRecruitmentRecord) => {
    if (!currentUser || recruitment.userId !== currentUser.uid) return;
    setWorkspaceRecruitments((prev) => prev.filter((item) => item.id !== recruitment.id));
    void cancelRecruitmentInCloud(db, recruitment.id).catch((error) => {
      console.warn("Failed to cancel recruitment", error);
    });
  };

  const handleWorkspacePresetMessage = (message: string) => {
    if (!currentUser || !selectedRoom || !isInSelectedRoom) {
      return;
    }

    const nextStatus = getWorkspaceStatusFromMessage(message);
    const nextTask = message === "今日はReactやります" ? "React" : workspaceTask.trim() || currentBuilding;
    const now = new Date();
    const nowIso = now.toISOString();
    setWorkspaceBubble(message);

    if (message === "今日はReactやります") {
      setWorkspaceTask("React");
      setStudySubject("React");
    }

    // Phase 9: notify Slack on transition INTO the on-break state.
    // We compare against the previous member status so cycling
    // 休憩 → 休憩 doesn't fire twice.
    if (
      nextStatus === "on-break" &&
      currentPresence?.status !== "on-break" &&
      currentOrganization?.slackWebhookUrl &&
      currentOrganization.slackEvents?.breakStarted
    ) {
      void postToSlackWebhook(
        currentOrganization.slackWebhookUrl,
        buildBreakStartedBlocks(
          { name: playerName, meta: `Lv ${levelState.level}` },
          selectedRoom.name,
          language,
        ),
      );
    }

    setCustomRooms((rooms) =>
      rooms.map((room) => {
        const normalizedRoom = normalizeWorkspaceRoom(room);

        if (normalizedRoom.id !== selectedRoom.id) {
          return normalizedRoom;
        }

        const nextRoom = normalizeWorkspaceRoom({
              ...normalizedRoom,
              activeMembers: normalizedRoom.activeMembers.map((member) =>
                member.userId === currentUser.uid
                  ? (() => {
                      const wasOnBreak = member.status === "on-break";
                      const isStartingBreak = nextStatus === "on-break" && !wasOnBreak;
                      const isEndingBreak = nextStatus !== "on-break" && wasOnBreak;
                      const accumulatedActiveMinutes = isStartingBreak
                        ? getWorkspaceActiveMinutes(member, now.getTime())
                        : member.accumulatedActiveMinutes || 0;

                      return {
                        ...member,
                        status: nextStatus,
                        currentTask: nextTask,
                        building: nextTask,
                        activeStartedAt: isStartingBreak ? "" : isEndingBreak ? nowIso : member.activeStartedAt || member.joinedAt,
                        accumulatedActiveMinutes,
                        breakStartedAt: isStartingBreak ? nowIso : nextStatus === "on-break" ? member.breakStartedAt || nowIso : "",
                        x: playerPosition.x,
                        y: playerPosition.y,
                        // Broadcast the bubble through the room document so
                        // other clients in the same room see it pop in real
                        // time. A matching clear-write below makes it fade
                        // out remotely too.
                        bubble: message,
                        bubbleAt: nowIso,
                      };
                    })()
                  : member,
              ),
            });

        pendingWorkspaceRoomsRef.current.set(nextRoom.id, nextRoom);
        return nextRoom;
      }),
    );

    // After the bubble's lifetime, write an empty bubble back so the
    // value clears from Firestore — without this the last preset would
    // stay attached to the member forever and reappear for anyone who
    // joined the room (or refreshed) before the bubble was overwritten.
    // The matched-tuple guard (bubble === message && bubbleAt === nowIso)
    // makes sure a *newer* preset sent within 3.6s isn't blown away.
    const roomIdForClear = selectedRoom.id;
    window.setTimeout(() => {
      setCustomRooms((rooms) =>
        rooms.map((room) => {
          const normalizedRoom = normalizeWorkspaceRoom(room);
          if (normalizedRoom.id !== roomIdForClear) return normalizedRoom;
          let changed = false;
          const nextMembers = normalizedRoom.activeMembers.map((member) => {
            if (
              member.userId === currentUser.uid &&
              member.bubble === message &&
              member.bubbleAt === nowIso
            ) {
              changed = true;
              return { ...member, bubble: "", bubbleAt: "" };
            }
            return member;
          });
          if (!changed) return normalizedRoom;
          const nextRoom = normalizeWorkspaceRoom({
            ...normalizedRoom,
            activeMembers: nextMembers,
          });
          pendingWorkspaceRoomsRef.current.set(nextRoom.id, nextRoom);
          return nextRoom;
        }),
      );
    }, 3600);
  };

  // Organization handlers — used by the settings panel.
  const handleCreateOrganization = async () => {
    if (!currentUser || isOrgWorking) return;
    const name = newOrgName.trim();
    if (!name) {
      setOrgError(t("組織名を入力してください。"));
      return;
    }
    setIsOrgWorking(true);
    setOrgError("");
    try {
      const org = await createOrganization(db, currentUser.uid, playerName, name);
      setCurrentOrganization(org);
      setNewOrgName("");
      setIsOrgCreateOpen(false);
      showToast(t("組織「{name}」を作成しました", { name: org.name }), { kind: "success" });
    } catch (error) {
      console.warn("Create org failed", error);
      // 原因切り分けのため、Firestore のエラーコード/メッセージを画面に出す。
      const code = (error as { code?: string })?.code;
      const message = (error as { message?: string })?.message;
      setOrgError(
        t("組織を作成できませんでした。[{code}] {message}", {
          code: code ?? "unknown",
          message: message ?? "",
        }).trim(),
      );
    } finally {
      setIsOrgWorking(false);
    }
  };

  const handleCreateOrgInvite = async () => {
    if (!currentUser || !currentOrganization || isOrgWorking) return;
    setIsOrgWorking(true);
    setOrgError("");
    try {
      const token = await createOrganizationInvite(
        db,
        currentOrganization.id,
        currentOrganization.name,
        currentUser.uid,
        { ttlDays: 14 },
      );
      const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}`;
      const url = `${baseUrl}/?join-org=${token}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t("招待リンクをコピーしました（14日有効）"), { kind: "success" });
      } catch {
        // Clipboard may be blocked on some Safari versions; surface
        // the URL so the user can copy it manually.
        window.prompt(t("招待リンク（コピーしてください）"), url);
      }
    } catch (error) {
      console.warn("Create org invite failed", error);
      setOrgError(t("招待リンクを発行できませんでした。"));
    } finally {
      setIsOrgWorking(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!currentUser || !currentOrganization || isOrgWorking) return;
    if (currentOrganization.ownerUid === currentUser.uid) {
      setOrgError(t("オーナーは退出できません。Admin ダッシュボードから他メンバーへオーナーを譲渡してから退出してください。"));
      return;
    }
    const confirmed = window.confirm(
      t("「{name}」から退出します。組織限定のルームは見えなくなります。", { name: currentOrganization.name }),
    );
    if (!confirmed) return;
    setIsOrgWorking(true);
    setOrgError("");
    try {
      await leaveOrganization(db, currentUser.uid, {
        name: playerName,
        orgId: currentOrganization.id,
        orgName: currentOrganization.name,
      });
      setCurrentOrganization(null);
      showToast(t("組織から退出しました"), { kind: "success" });
    } catch (error) {
      console.warn("Leave org failed", error);
      setOrgError(t("退出に失敗しました。再度お試しください。"));
    } finally {
      setIsOrgWorking(false);
    }
  };

  // Stripe Checkout を開始。サーバ(callable)がセッション URL を返すので
  // そこへ遷移する。座席数は現在のメンバー数を初期値として渡す(ユーザーは
  // Stripe の画面でも調整できる)。決済情報・キーには一切触れない。
  const handleStartCheckout = async (tier: "team" | "enterprise") => {
    if (!currentUser || !currentOrganization || billingBusy) return;
    if (currentOrganization.ownerUid !== currentUser.uid) return;
    setBillingBusy(true);
    try {
      const seats = Math.max(1, orgMembers.length);
      const { url } = await createCheckoutSession({
        orgId: currentOrganization.id,
        tier,
        seats,
      });
      window.location.assign(url);
    } catch (error) {
      console.warn("Checkout failed", error);
      showToast(t("決済ページを開けませんでした。時間をおいて再度お試しください。"), {
        kind: "error",
      });
    } finally {
      setBillingBusy(false);
    }
  };

  // 契約済み組織の請求ポータル(プラン変更・解約・領収書)を開く。
  const handleManageBilling = async () => {
    if (!currentUser || !currentOrganization || billingBusy) return;
    if (currentOrganization.ownerUid !== currentUser.uid) return;
    setBillingBusy(true);
    try {
      const { url } = await createPortalSession({ orgId: currentOrganization.id });
      window.location.assign(url);
    } catch (error) {
      console.warn("Portal failed", error);
      showToast(t("請求ポータルを開けませんでした。"), { kind: "error" });
    } finally {
      setBillingBusy(false);
    }
  };

  /* Admin dashboard — Phase 2. Fires the members query on open and
     caches the result; refresh is manual to keep Firestore reads
     predictable (a real-time listener would burn quota on each org
     member's heartbeat-style progress write). */
  const handleOpenOrgAdmin = async () => {
    if (!currentUser || !currentOrganization) return;
    setIsOrgAdminOpen(true);
    setIsSettingsOpen(false);
    setOrgAdminError("");
    setOrgAdminTab("members");
    setOrgAuditLogs([]);
    // Seed Slack editor state from the current org snapshot so the
    // form reflects what's actually persisted, not stale values from
    // a previous open.
    setSlackDraftUrl(currentOrganization.slackWebhookUrl || "");
    setSlackDraftRoomJoins(Boolean(currentOrganization.slackEvents?.roomJoins));
    setSlackDraftRoomLeaves(Boolean(currentOrganization.slackEvents?.roomLeaves));
    setSlackDraftBreakStarted(Boolean(currentOrganization.slackEvents?.breakStarted));
    setSlackDraftRecruitments(Boolean(currentOrganization.slackEvents?.recruitments));
    setSlackDraftPosts(Boolean(currentOrganization.slackEvents?.posts));
    setSlackDraftDailyDigest(Boolean(currentOrganization.slackEvents?.dailyDigest));
    setSlackSaveState("idle");
    setSlackSaveMessage("");
    setDomainDraft((currentOrganization.autoJoinDomains || []).join("\n"));
    setDomainSaveState("idle");
    setDomainSaveMessage("");
    setIsLoadingOrgMembers(true);
    try {
      const members = await listOrganizationMembers(db, currentOrganization.id);
      setOrgMembers(members);
    } catch (error) {
      console.warn("List org members failed", error);
      setOrgAdminError(t("メンバー一覧を読み込めませんでした。再度お試しください。"));
    } finally {
      setIsLoadingOrgMembers(false);
    }
  };

  /* One-tap domain join from the home discovery ribbon. */
  const handleJoinByDomain = async (org: OrganizationRecord) => {
    if (!currentUser?.email || isOrgWorking) return;
    const domain = currentUser.email.split("@")[1]?.toLowerCase().trim();
    if (!domain) return;
    setIsOrgWorking(true);
    setOrgError("");
    try {
      const joined = await joinOrganizationByDomain(
        db,
        org.id,
        currentUser.uid,
        domain,
        playerName,
      );
      setCurrentOrganization(joined);
      setDiscoveredOrgs([]);
      showToast(t("「{name}」に参加しました", { name: joined.name }), { kind: "success" });
    } catch (error) {
      const code = (error as Error)?.message || "";
      const message =
        code === "ORG_NOT_FOUND"
          ? t("組織が見つかりませんでした。")
          : code === "DOMAIN_NOT_ALLOWED"
            ? t("このドメインからの自動参加は許可されていません。")
            : t("参加に失敗しました。再度お試しください。");
      setOrgError(message);
    } finally {
      setIsOrgWorking(false);
    }
  };

  /* Domain whitelist editor — Phase 7. Owner-only in the admin
     modal. Accepts newline / comma-separated domains and persists
     the validated, deduped subset. */
  const handleSaveDomainSettings = async () => {
    if (!currentOrganization) return;
    const list = domainDraft
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    setDomainSaveState("saving");
    setDomainSaveMessage("");
    try {
      await updateOrganizationDomains(
        db,
        currentOrganization.id,
        list,
        currentUser ? { uid: currentUser.uid, name: playerName } : null,
      );
      // Re-load org from cloud to capture the normalised list.
      const refreshed = await loadOrganization(db, currentOrganization.id);
      if (refreshed) {
        setCurrentOrganization(refreshed);
        setDomainDraft((refreshed.autoJoinDomains || []).join("\n"));
      }
      setDomainSaveState("saved");
      setDomainSaveMessage(list.length > 0 ? t("{n}件のドメインを保存しました。", { n: list.length }) : t("ドメイン自動参加を解除しました。"));
    } catch (error) {
      console.warn("Save domain settings failed", error);
      setDomainSaveState("error");
      setDomainSaveMessage(t("保存に失敗しました。"));
    }
  };

  /* Admin removes a member from the org — Phase 8. Confirms before
     execution; on success refreshes the cached members list so the
     row drops out immediately. Self-removal is blocked in the UI
     so the owner can't accidentally orphan themselves. */
  const handleRemoveMember = async (target: OrganizationMemberRecord) => {
    if (!currentUser || !currentOrganization) return;
    if (currentOrganization.ownerUid !== currentUser.uid) return;
    if (target.uid === currentUser.uid) return;
    if (target.organizationRole === "owner") return;
    const confirmed = window.confirm(
      t("{name} を「{org}」から除名します。除名後、本人の組織限定ルームは見えなくなります。本人のアカウントとログは残ります。よろしいですか？", { name: target.displayName, org: currentOrganization.name }),
    );
    if (!confirmed) return;
    setOrgAdminError("");
    try {
      await removeOrganizationMember(
        db,
        currentOrganization.id,
        target.uid,
        { uid: currentUser.uid, name: playerName },
        { name: target.displayName, previousRole: target.organizationRole },
      );
      // Re-pull the members list to drop the removed row.
      try {
        const members = await listOrganizationMembers(db, currentOrganization.id);
        setOrgMembers(members);
      } catch {
        /* the row will refresh on next admin open */
      }
      showToast(t("{name} を除名しました", { name: target.displayName }), { kind: "success" });
    } catch (error) {
      console.warn("Remove member failed", error);
      setOrgAdminError(t("除名に失敗しました。Firestore のルール権限を確認してください。"));
    }
  };

  /* Phase 9: owner edits a member's team label inline. Optimistically
     updates the cached members list so the input value sticks after
     blur even before the Firestore write resolves; rolls back on
     failure. Free-form, 40 char cap matches the rule's size guard. */
  const handleSetMemberTeamName = async (
    target: OrganizationMemberRecord,
    nextTeamName: string,
  ) => {
    if (!currentUser || !currentOrganization) return;
    if (currentOrganization.ownerUid !== currentUser.uid) return;
    const trimmed = nextTeamName.trim().slice(0, 40);
    if (trimmed === (target.teamName || "")) return;
    const previous = target.teamName || "";
    setOrgMembers((current) =>
      current.map((m) => (m.uid === target.uid ? { ...m, teamName: trimmed } : m)),
    );
    try {
      await setMemberTeamName(
        db,
        currentOrganization.id,
        target.uid,
        trimmed,
        { uid: currentUser.uid, name: playerName },
        { name: target.displayName },
      );
    } catch (error) {
      console.warn("Set member team name failed", error);
      setOrgMembers((current) =>
        current.map((m) => (m.uid === target.uid ? { ...m, teamName: previous } : m)),
      );
      setOrgAdminError(t("チーム名の保存に失敗しました。"));
    }
  };

  /* Personal data export — Phase 8. Bundle all user-owned Firestore
     documents into a single JSON file and trigger a browser
     download. Satisfies 個人情報保護法 / GDPR data-subject access
     rights without a backend. */
  const handleExportPersonalData = async () => {
    if (!currentUser || isExportingData) return;
    setIsExportingData(true);
    try {
      const data = await exportUserData(db, currentUser.uid, userId);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const dateKey = new Date().toISOString().slice(0, 10);
      anchor.download = `contribution-arc-data-${userId || currentUser.uid}-${dateKey}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast(t("個人データをダウンロードしました"), { kind: "success" });
    } catch (error) {
      console.warn("Export user data failed", error);
      showToast(t("エクスポートに失敗しました"), { kind: "error" });
    } finally {
      setIsExportingData(false);
    }
  };

  /* Two-step account deletion — Phase 8. First click opens the
     confirmation modal; the user has to type their userId to
     unlock the destructive button. We leave the org first (writing
     the audit log for departure), then cascade-delete every owned
     document, then sign out. */
  const handleDeleteAccount = async () => {
    if (!currentUser || isDeletingAccount) return;
    if (deleteConfirmText.trim() !== (userId || currentUser.uid)) {
      setDeleteError(t("確認のため、上のユーザーIDをそのまま入力してください。"));
      return;
    }
    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      // If still in an org, leave it first so the audit row records
      // a clean departure. Owner accounts must transfer ownership
      // before deletion — UI guards against that case.
      if (currentOrganization && currentOrganization.ownerUid !== currentUser.uid) {
        try {
          await leaveOrganization(db, currentUser.uid, {
            name: playerName,
            orgId: currentOrganization.id,
            orgName: currentOrganization.name,
          });
        } catch (error) {
          console.warn("Leave org before delete failed", error);
        }
      }
      await deleteUserAccount(db, currentUser.uid, userId);
      // Firestore のデータ削除後、Firebase Auth のユーザー本体も削除する。
      // これを忘れると認証レコード (メールアドレス / OAuth 連携) がサーバに
      // 残り続け、GDPR / 個人情報保護法の削除権とストア審査の「アカウント
      // 削除」要件を満たせない。
      try {
        await deleteUser(currentUser);
      } catch (authError) {
        const code = (authError as { code?: string })?.code || "";
        if (code === "auth/requires-recent-login") {
          // セッションが古いと Firebase は破壊的操作を拒否する。データは
          // 既に消えているので、再ログイン → 再実行で Auth レコードだけを
          // 消してもらう。サインアウトはして "削除済み" の状態にする。
          await signOut(auth);
          setIsDeleteConfirmOpen(false);
          setDeleteConfirmText("");
          showToast(
            t("データを削除しました。認証アカウントの完全削除には、もう一度ログインして再度アカウント削除を実行してください。"),
            { kind: "info" },
          );
          return;
        }
        throw authError;
      }
      setIsDeleteConfirmOpen(false);
      setDeleteConfirmText("");
      showToast(t("アカウントを削除しました"), { kind: "success" });
    } catch (error) {
      console.warn("Delete account failed", error);
      setDeleteError(t("削除に失敗しました。ネットワークまたは権限を確認のうえ、再度お試しください。"));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  /* Ownership transfer — Phase 6. Owner picks a member, confirms,
     and the org doc + both user docs flip atomically inside a
     Firestore transaction. After the transaction returns we
     immediately refresh both the local currentOrganization mirror
     (so the UI updates without a reload) and the members list
     (so the new role badges render). */
  const handleTransferOwnership = async (target: OrganizationMemberRecord) => {
    if (!currentUser || !currentOrganization) return;
    if (currentOrganization.ownerUid !== currentUser.uid) return;
    if (target.uid === currentUser.uid) return;
    const confirmed = window.confirm(
      t("「{org}」のオーナー権限を {name} に譲渡します。譲渡後、あなたはメンバーになります。よろしいですか？", { org: currentOrganization.name, name: target.displayName }),
    );
    if (!confirmed) return;
    setOrgAdminError("");
    try {
      await transferOrganizationOwnership(
        db,
        currentOrganization.id,
        currentUser.uid,
        playerName,
        target.uid,
        target.displayName,
      );
      setCurrentOrganization((prev) => (prev ? { ...prev, ownerUid: target.uid } : prev));
      // Refresh the cached members list so the role badges flip.
      try {
        const members = await listOrganizationMembers(db, currentOrganization.id);
        setOrgMembers(members);
      } catch {
        /* non-fatal — the badges will update on next admin open */
      }
      showToast(t("オーナーを {name} に譲渡しました", { name: target.displayName }), { kind: "success" });
    } catch (error) {
      const code = (error as Error)?.message || "";
      const message =
        code === "ORG_NOT_FOUND"
          ? t("組織情報を読み込めませんでした。")
          : code === "NOT_CURRENT_OWNER"
            ? t("現在のオーナーのみ譲渡できます。")
            : code === "NEW_OWNER_NOT_MEMBER"
              ? t("譲渡先は同じ組織のメンバーである必要があります。")
              : code === "SAME_OWNER"
                ? t("同じユーザーへの譲渡はできません。")
                : t("オーナー譲渡に失敗しました。再度お試しください。");
      setOrgAdminError(message);
    }
  };

  /* Audit log fetch — lazy. Only fires when the admin clicks the
     監査ログ tab, so opening the modal doesn't pay for two queries
     up front. listAuditLogs sorts client-side; cap of 100 keeps it
     bounded for the dashboard view. */
  const handleLoadAuditLogs = async () => {
    if (!currentOrganization) return;
    setIsLoadingAuditLogs(true);
    setOrgAdminError("");
    try {
      const logs = await listAuditLogs(db, currentOrganization.id, 100);
      setOrgAuditLogs(logs);
    } catch (error) {
      console.warn("List audit logs failed", error);
      setOrgAdminError(t("監査ログを読み込めませんでした。"));
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };
  // Touch recordAuditLog so the TypeScript "unused import" check
  // is happy even though the call sites use it via dynamic dispatch
  // from the helpers above. (recordAuditLog IS used at the room
  // create site below; this comment is just to document why the
  // import lives at the top of the file alongside listAuditLogs.)
  void recordAuditLog;

  /* Persist the Slack webhook + per-event toggles. The save merges
     onto the existing org doc; once it succeeds we also refresh the
     local currentOrganization mirror so downstream event hooks (room
     join, recruitment) immediately pick up the new URL without
     waiting for the next profile load. */
  const handleSaveSlackSettings = async () => {
    if (!currentOrganization) return;
    const trimmedUrl = slackDraftUrl.trim();
    if (trimmedUrl && !isValidSlackWebhookUrl(trimmedUrl)) {
      setSlackSaveState("error");
      setSlackSaveMessage(t("https://hooks.slack.com/services/… 形式のURLのみ受け付けます。"));
      return;
    }
    setSlackSaveState("saving");
    setSlackSaveMessage("");
    try {
      await updateOrganizationSlack(
        db,
        currentOrganization.id,
        {
          slackWebhookUrl: trimmedUrl,
          slackEvents: {
            roomJoins: slackDraftRoomJoins,
            roomLeaves: slackDraftRoomLeaves,
            breakStarted: slackDraftBreakStarted,
            recruitments: slackDraftRecruitments,
            posts: slackDraftPosts,
            dailyDigest: slackDraftDailyDigest,
          },
        },
        currentUser ? { uid: currentUser.uid, name: playerName } : null,
      );
      setCurrentOrganization((prev) =>
        prev
          ? {
              ...prev,
              slackWebhookUrl: trimmedUrl || undefined,
              slackEvents: {
                roomJoins: slackDraftRoomJoins,
                roomLeaves: slackDraftRoomLeaves,
                breakStarted: slackDraftBreakStarted,
                recruitments: slackDraftRecruitments,
                posts: slackDraftPosts,
                dailyDigest: slackDraftDailyDigest,
              },
            }
          : prev,
      );
      setSlackSaveState("saved");
      setSlackSaveMessage(trimmedUrl ? t("保存しました。") : t("Slack連携を解除しました。"));
      showToast(t("Slack設定を保存しました"), { kind: "success" });
    } catch (error) {
      console.warn("Save slack settings failed", error);
      setSlackSaveState("error");
      setSlackSaveMessage(t("保存に失敗しました。再度お試しください。"));
    }
  };

  /* Test-send a sample message. Bypasses the per-event toggles —
     the admin explicitly clicked the button, so we always attempt
     the POST as long as the URL parses. */
  const handleSlackTestSend = async () => {
    const trimmedUrl = slackDraftUrl.trim();
    if (!currentOrganization) return;
    if (!isValidSlackWebhookUrl(trimmedUrl)) {
      setSlackSaveState("error");
      setSlackSaveMessage(t("先にSlack Incoming Webhook URLを入力してください。"));
      return;
    }
    setSlackSaveState("saving");
    setSlackSaveMessage("");
    const result = await postToSlackWebhook(trimmedUrl, {
      text: `:white_check_mark: ${t("Contribution Arc から *{name}* に接続テストを送信しました。", { name: currentOrganization.name })}`,
    });
    if (result.ok) {
      setSlackSaveState("saved");
      setSlackSaveMessage(t("Slackチャンネルに送信しました。届いていれば設定OKです。"));
    } else {
      setSlackSaveState("error");
      setSlackSaveMessage(
        result.error === "INVALID_WEBHOOK_URL"
          ? t("URLが Slack の hooks.slack.com 形式ではありません。")
          : t("Slackへの送信に失敗しました ({code}).", { code: result.error || "unknown" }),
      );
    }
  };

  /* Manual daily digest — owner taps a button in the admin modal
     and we POST a summary to Slack right then. Production-grade
     scheduling needs a Cloud Function; this MVP keeps it
     user-triggered so we don't need backend infra. */
  const handleSendDailyDigest = async () => {
    if (!currentOrganization?.slackWebhookUrl) return;
    setSlackSaveState("saving");
    setSlackSaveMessage("");
    const totalEffort = orgMembers.reduce((acc, m) => acc + (m.effortExp || 0), 0);
    const totalOutput = orgMembers.reduce((acc, m) => acc + (m.outputExp || 0), 0);
    const totalContributions = orgMembers.reduce((acc, m) => acc + (m.contributionCount || 0), 0);
    const topMembers = orgMembers
      .slice()
      .sort((a, b) => (b.effortExp || 0) - (a.effortExp || 0))
      .slice(0, 5)
      .map((m) => ({ name: m.displayName, effort: m.effortExp, streak: m.streak }));
    const result = await postToSlackWebhook(
      currentOrganization.slackWebhookUrl,
      buildDailyDigestBlocks(
        currentOrganization.name,
        {
          memberCount: orgMembers.length,
          totalEffort,
          totalOutput,
          totalContributions,
        },
        topMembers,
        language,
      ),
    );
    if (result.ok) {
      setSlackSaveState("saved");
      setSlackSaveMessage(t("日次サマリーを送信しました。"));
      showToast(t("日次サマリーをSlackに送信"), { kind: "success" });
    } else {
      setSlackSaveState("error");
      setSlackSaveMessage(t("送信に失敗しました ({code}).", { code: result.error || "unknown" }));
    }
  };

  const handleRefreshOrgMembers = async () => {
    if (!currentOrganization || isLoadingOrgMembers) return;
    setOrgAdminError("");
    setIsLoadingOrgMembers(true);
    try {
      const members = await listOrganizationMembers(db, currentOrganization.id);
      setOrgMembers(members);
    } catch (error) {
      console.warn("Refresh org members failed", error);
      setOrgAdminError(t("再読み込みに失敗しました。"));
    } finally {
      setIsLoadingOrgMembers(false);
    }
  };

  const handleExportOrgMembersCsv = () => {
    if (!currentOrganization || orgMembers.length === 0) return;
    // UTF-8 BOM prefix so Excel on Windows opens the file without
    // mojibake on Japanese display names. Columns are documented in
    // Japanese matching the on-screen labels.
    const header = [
      t("ユーザーID"),
      t("表示名"),
      t("役割"),
      t("レベル"),
      "Effort EXP",
      "Output EXP",
      t("ストリーク"),
      t("コミット数"),
      t("最終アクティブ"),
    ];
    const escape = (value: string | number) => {
      const stringValue = String(value ?? "");
      if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const lines = [header.map(escape).join(",")];
    for (const member of orgMembers) {
      lines.push(
        [
          member.userId,
          member.displayName,
          member.organizationRole === "owner"
            ? t("オーナー")
            : member.organizationRole === "admin"
              ? t("管理者")
              : t("メンバー"),
          member.level,
          member.effortExp,
          member.outputExp,
          member.streak,
          member.contributionCount,
          member.lastSyncedAt || "",
        ]
          .map(escape)
          .join(","),
      );
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const dateKey = new Date().toISOString().slice(0, 10);
    const safeOrgName = currentOrganization.name.replace(/[\\/:*?"<>|]/g, "_");
    anchor.download = `${safeOrgName}-members-${dateKey}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(t("CSVをダウンロードしました"), { kind: "success" });
  };

  const handleRoomCreate = () => {
    if (!currentUser) {
      return;
    }

    const roomName = newRoomName.trim();
    if (!roomName) {
      setRoomCreateState("offline");
      setRoomCreateMessage(t("Room名を入力してください。"));
      return;
    }

    /* 1 人 1 部屋ルール: 既に自分が作成した部屋がある場合は新規作成を拒否。
       開発者は moderation 目的で複数所有可。 */
    const myExistingRoom = allWorkspaceRooms.find(
      (r) => r.createdBy === currentUser.uid,
    );
    if (myExistingRoom && !isDeveloperAccount) {
      setRoomCreateState("offline");
      setRoomCreateMessage(
        t("作業部屋は 1 人につき 1 つまでです。既存の部屋 「{name}」 を解体してから作成してください。", {
          name: myExistingRoom.name,
        }),
      );
      return;
    }

    const resolvedVisibility: "public" | "org" =
      newRoomVisibility === "org" && currentOrganization ? "org" : "public";
    const room = normalizeWorkspaceRoom({
      id: createWorkspaceRoomId(),
      name: roomName,
      ownerName: playerName,
      ownerAvatar: playerAvatar,
      totalMinutes: 0,
      contributions: 0,
      commits: 0,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      activeMembers: [],
      history: [],
      visibility: resolvedVisibility,
      ...(resolvedVisibility === "org" && currentOrganization
        ? { ownerOrgId: currentOrganization.id }
        : {}),
    });

    pendingWorkspaceRoomsRef.current.set(room.id, room);
    setCustomRooms((rooms) => (rooms.some((item) => item.id === room.id) ? rooms : [...rooms, room].map(normalizeWorkspaceRoom)));
    // 新規作成だけは doc が無い状態からの書き込みなので allowCreate を明示。
    void saveWorkspaceRoomToCloud(room, currentUser.uid, { allowCreate: true })
      .then(() => {
        pendingWorkspaceRoomsRef.current.delete(room.id);
      })
      .catch((error) => {
        console.info("Workspace room create cloud sync skipped.", error);
      });

    // Audit-log org-scoped room creations. We deliberately skip the
    // log for public rooms — they aren't org-affecting events and
    // would bloat the org log with personal experiments.
    if (currentOrganization && resolvedVisibility === "org") {
      void recordAuditLog(db, {
        orgId: currentOrganization.id,
        type: "room.created",
        actorUid: currentUser.uid,
        actorName: playerName,
        target: room.name,
        payload: { visibility: "org" },
      });
    }
    setSelectedRoomId(room.id);
    setProfileMember(null);
    setProfileUser(null);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setCurrentView("workspace");
    setNewRoomName("");
    setRoomCreateState("saved");
    setRoomCreateMessage(t("Roomを作成しました。"));
  };

  const startRoomTitleEdit = (room: WorkspaceRoom) => {
    /* 名前変更は作成者本人 (+ developer moderation) のみに制限。
       UI 上でもボタン自体を隠しているが、念の為ハンドラ側でも防御。 */
    if (!currentUser) return;
    if (room.createdBy !== currentUser.uid && !isDeveloperAccount) {
      showToast(t("名前を変更できるのは作成者だけです。"), { kind: "error" });
      return;
    }
    setEditingRoomId(room.id);
    setEditingRoomName(room.name);
  };

  const handleRoomTitleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = editingRoomName.trim();
    const targetId = editingRoomId;
    setEditingRoomId("");
    setEditingRoomName("");
    persistRoomRename(targetId, nextName);
  };

  /* `editingRoom*` state を介さずに直接 rename を発火させる API。
     モバイル workspace の「名前変更」UI から window.prompt 経由で
     呼ぶ。デスクトップの inline-form は handleRoomTitleSave 経由のまま。 */
  const persistRoomRename = (targetRoomId: string, rawName: string) => {
    const nextName = rawName.trim();
    if (!nextName || !targetRoomId) return;
    const target = customRooms.find((room) => room.id === targetRoomId);
    if (!target || target.name === nextName) return;
    /* save 経路でも作成者チェックを通す (UI を経由しない直接呼び出しの保険)。 */
    if (currentUser && target.createdBy !== currentUser.uid && !isDeveloperAccount) {
      showToast(t("名前を変更できるのは作成者だけです。"), { kind: "error" });
      return;
    }
    const nextRoom = normalizeWorkspaceRoom({ ...target, name: nextName });
    pendingWorkspaceRoomsRef.current.set(nextRoom.id, nextRoom);
    setCustomRooms((rooms) =>
      rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room)),
    );
    if (currentUser) {
      void saveWorkspaceRoomToCloud(nextRoom, currentUser.uid)
        .then(() => {
          pendingWorkspaceRoomsRef.current.delete(nextRoom.id);
        })
        .catch((error) => {
          console.info("Workspace room rename cloud sync skipped.", error);
        });
    }
  };

  const handleRoomDelete = (roomId: string) => {
    const room = customRooms.find((item) => item.id === roomId);
    /* デベロッパーアカウント (ari.initx@gmail.com) は作成者でなくても
       どの作業部屋でも解体できる。それ以外は従来通り作成者本人のみ。 */
    if (!room || (room.createdBy !== currentUser.uid && !isDeveloperAccount)) {
      return;
    }

    const isOwnRoom = room.createdBy === currentUser.uid;
    const isConfirmed = window.confirm(
      isOwnRoom
        ? t("{name}を解体しますか？このRoomは一覧から消えます。", { name: room.name })
        : t("[Dev] 他ユーザーが作成した「{name}」を解体しますか？この操作は取り消せません。", { name: room.name }),
    );
    if (!isConfirmed) {
      return;
    }

    /* 解体 id を blocklist に登録。以降の applyRemoteRooms / onSnapshot /
       lobby fetch 全てがこの id を弾くので、cloud delete の反映遅延中に
       他端末の書き込みや snapshot 通知で「亡霊部屋」が復活する経路を
       完全に塞ぐ。リロードで Set はクリアされるので、cloud 側の delete
       がちゃんと走っていれば次回起動時には自然に消える。 */
    deletedWorkspaceRoomIdsRef.current.add(roomId);

    pendingWorkspaceRoomsRef.current.delete(roomId);
    // Purge the in-memory remote caches too. Without this the next
    // applyRemoteRooms() run (e.g. the active-room onSnapshot firing after we
    // switch selectedRoomId) rebuilds customRooms from these stale caches and
    // revives the just-deleted room in the lobby — the reason "解体" looked
    // broken: the Firestore doc was gone but the room kept reappearing.
    remoteWorkspaceRoomsRef.current.rooms = remoteWorkspaceRoomsRef.current.rooms.filter(
      (item) => item.id !== roomId,
    );
    remoteWorkspaceRoomsRef.current.legacyRooms = remoteWorkspaceRoomsRef.current.legacyRooms.filter(
      (item) => item.id !== roomId,
    );
    const nextRooms = customRooms.filter((item) => item.id !== roomId);
    setCustomRooms(nextRooms);
    /* localStorage cache を即時更新 — setCustomRooms → useEffect での
       同期は非同期なので、解体直後にユーザーがリロードしたケースで
       「削除前 cache」が残り、再 hydration で復活する経路を塞ぐ。
       (applyRemoteRooms("lobby") も最後に削除済み判定を入れているが、
       双方掛けてレース完全排除。) */
    try {
      const serialized = JSON.stringify(serializeWorkspaceRooms(nextRooms));
      safeSetLocalStorage(sharedWorkspaceRoomsStorageKey, serialized);
      lastSyncedWorkspaceRoomsRef.current = serialized;
    } catch {
      /* localStorage が落ちていても cloud delete は試みる */
    }

    if (selectedRoomId === roomId) {
      setSelectedRoomId(nextRooms[0]?.id || "");
    }

    if (pendingJoinRoomId === roomId) {
      setPendingJoinRoomId(null);
    }
    if (editingRoomId === roomId) {
      setEditingRoomId("");
      setEditingRoomName("");
    }
    setLastRoomSession(null);

    /* cloud delete は await して成否をユーザーに通知。失敗時は blocklist
       から外し、ローカル state も復元する (情報を失わない)。これまでは
       deleteDoc が rules や network で失敗しても無言で握りつぶしていた
       ため、リロード後に Firestore から復活して「何度解体しても残る」
       症状を生んでいた。
       error code を toast に含めて、permission-denied / unavailable など
       根本原因を即座に切り分けられるようにする (旧コードでは console
       にしか出していなかった)。 */
    void (async () => {
      const isDevTokenFallbackTryable = isDeveloperAccount;
      try {
        await deleteDoc(doc(db, workspaceRoomsCollectionName, roomId));
        /* 旧コレクション (workspaceRooms) にも残骸があれば消す。
           ここは存在しなくても catch すれば良い - エラーは無視。 */
        await deleteDoc(doc(db, legacyWorkspaceRoomsCollectionName, roomId)).catch(() => {
          /* legacy doc は無いことの方が多いので noisy にしない */
        });
        showToast(t("作業部屋を解体しました"), { kind: "success" });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code || "")
            : "";
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message || "")
            : "";
        const name =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: unknown }).name || "")
            : "";
        /* デバッグ用に room 情報も詳細出力 — permission-denied の場合に
           createdBy / 自分の uid / dev 判定がズレていないか確認できる。 */
        console.error("Workspace room delete failed.", {
          code,
          name,
          message,
          roomId,
          createdBy: room.createdBy,
          currentUid: currentUser.uid,
          currentEmail: currentUser.email,
          isDeveloperAccount: isDevTokenFallbackTryable,
        });
        deletedWorkspaceRoomIdsRef.current.delete(roomId);
        setCustomRooms((current) =>
          current.some((item) => item.id === roomId) ? current : [...current, room],
        );
        try {
          const serialized = JSON.stringify(serializeWorkspaceRooms([...nextRooms, room]));
          safeSetLocalStorage(sharedWorkspaceRoomsStorageKey, serialized);
          lastSyncedWorkspaceRoomsRef.current = serialized;
        } catch {
          /* ignore */
        }
        /* 全ての分岐で root cause を toast に出して切り分けやすくする。
           code が無いケース (= 非 FirebaseError) も name / 先頭の
           message で診断できる。 */
        if (code === "permission-denied") {
          /* 別アカウントが作成した部屋の delete は Firestore ルール
             側で deny される。リポジトリの rules ファイルには
             `isDeveloper()` 経由で本人 (ari.initx@gmail.com) が任意の
             部屋を解体できる定義が入っているが、CI の rules-deploy
             ワークフローが FIREBASE_SERVICE_ACCOUNT secret 不在で
             失敗し続けている → 本番ルールに反映されていない。
             対処: ローカルで `npx firebase deploy --only firestore`
             を 1 回実行するか、GitHub secret を再設定して
             Deploy Firestore Rules workflow を回す。 */
          const isOtherCreator = room.createdBy !== currentUser.uid;
          showToast(
            isOtherCreator
              ? t("この部屋は別アカウントで作成されたため、本番ルール側で削除を拒否されました (rules 未デプロイ)。")
              : t("削除権限がありません (permission-denied)。"),
            { kind: "error" },
          );
        } else if (code) {
          showToast(t("解体できませんでした ({code})", { code }), { kind: "error" });
        } else {
          const detail = (name || message || "unknown").slice(0, 60);
          showToast(t("解体できませんでした ({code})", { code: detail }), { kind: "error" });
        }
      }
    })();
  };


  // 過去に記録した学習ログの subject 名を変更する。
  // - 楽観的に local state を更新
  // - cloud (Firestore studyLogs) に setDoc({ merge: true }) で同期
  // - 失敗時は state を元に戻し、エラートーストを出す
  // - 空文字は許可しない (空 → 何の subject か分からなくなる)
  /* 過去の学習記録の時間 (minutes) を変更する。
     - 1〜1440 分の範囲でクランプ (1日を超えない)


  /* Donut legend / ジャンル一覧 から同じ subject の study log をまとめて
     リネーム。「開発」「やあ」など重複・誤入力をユーザーが後から
     掃除できるようにする。
     - 楽観更新 → 全該当 log を並列で saveStudyLogToCloud
     - 1 件でも失敗したら全件 rollback (一貫性のため)
     - 空文字 / 同一文字列は no-op */
  const handleSubjectBulkRename = (oldSubject: string, nextSubject: string) => {
    if (!currentUser) return;
    const trimmed = nextSubject.trim().slice(0, 60);
    if (!trimmed) {
      showToast(t("名前を入力してください"), { kind: "info" });
      return;
    }
    if (oldSubject === trimmed) return;

    const affected = studyLogs.filter((log) => log.subject === oldSubject);
    if (affected.length === 0) return;

    const affectedIds = new Set(affected.map((log) => log.id));
    setStudyLogs((logs) =>
      logs.map((log) => (affectedIds.has(log.id) ? { ...log, subject: trimmed } : log)),
    );

    void Promise.all(
      affected.map((original) =>
        saveStudyLogToCloud(db, currentUser.uid, { ...original, subject: trimmed }, {}),
      ),
    )
      .then(() => {
        showToast(
          t("{count}件を「{name}」に変更しました", { count: affected.length, name: trimmed }),
          { kind: "success" },
        );
      })
      .catch((error) => {
        console.info("Subject bulk rename cloud sync skipped.", error);
        setStudyLogs((logs) =>
          logs.map((log) => (affectedIds.has(log.id) ? { ...log, subject: oldSubject } : log)),
        );
        showToast(t("名前を変更できませんでした"), { kind: "error" });
      });
  };

  /* プロフィールの「This Week」棒グラフから日別に学習ログを編集する。
     1 件分の minutes を再保存／削除。subject は学習対象側 (Library) の
     rename で一括変更されるので、ここでは時間 + 削除に絞る。 */
  const handleProfileWeekLogUpdate = (log: StudyLog, nextMinutesRaw: number) => {
    if (!currentUser) return;
    const safeMinutes = Math.max(0, Math.round(nextMinutesRaw));
    if (!Number.isFinite(safeMinutes) || safeMinutes === log.minutes) return;
    const updated: StudyLog = { ...log, minutes: safeMinutes };
    setStudyLogs((logs) => logs.map((entry) => (entry.id === log.id ? updated : entry)));
    void saveStudyLogToCloud(db, currentUser.uid, updated, {}).catch((error) => {
      console.info("Profile week log update sync skipped.", error);
      setStudyLogs((logs) => logs.map((entry) => (entry.id === log.id ? log : entry)));
      showToast(t("学習時間を更新できませんでした"), { kind: "error" });
    });
  };

  /* 選択中の曜日に学習ログを新規追加する。createdAt はその日の正午
     (dateIso) を使うので、何時に追加してもその日の集計に確実に入る。 */
  const handleProfileWeekLogAdd = (dateIso: string, learningItemId: string, minutes: number) => {
    if (!currentUser) return;
    const safeMinutes = Math.max(0, Math.round(minutes));
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return;
    const item = learningItems.find((entry) => entry.id === learningItemId);
    if (!item) return;
    const nextLog: StudyLog = {
      id: crypto.randomUUID(),
      subject: item.name,
      minutes: safeMinutes,
      createdAt: dateIso,
      color: item.color,
      learningItemId: item.id,
    };
    setStudyLogs((logs) => [...logs, nextLog]);
    void saveStudyLogToCloud(db, currentUser.uid, nextLog, {
      earnedExp: Math.round(safeMinutes * 1.25),
      source: "profile-week-add",
      organizationId: currentOrganization?.id,
    }).catch((error) => {
      console.info("Profile week log add sync skipped.", error);
      setStudyLogs((logs) => logs.filter((entry) => entry.id !== nextLog.id));
      showToast(t("学習記録を追加できませんでした"), { kind: "error" });
    });
  };

  const handleProfileWeekLogDelete = (log: StudyLog) => {
    if (!currentUser) return;
    const confirmed = window.confirm(
      t("「{subject}」({minutes}分) を削除しますか？", {
        subject: log.subject,
        minutes: log.minutes,
      }),
    );
    if (!confirmed) return;
    setStudyLogs((logs) => logs.filter((entry) => entry.id !== log.id));
    void deleteStudyLogFromCloud(db, log.id).catch((error) => {
      console.info("Profile week log delete sync skipped.", error);
      setStudyLogs((logs) => [...logs, log]);
      showToast(t("学習記録を削除できませんでした"), { kind: "error" });
    });
  };

  const playerStatusCard = (isInteractive = false) => {
    const hasGithub = Boolean(githubUsername || githubId);
    const determinationText = determination?.trim() || "";
    /* 自分の目標 (志望校 / 資格)。以前はプロフィール最上部に大きなカードで
       出していたが、設定すると名前のすぐ下を占有して邪魔になるため、
       Player Status の識別チップ行にコンパクトに集約する。タップで
       「同じ目標の人を探す」モーダルを開く。 */
    const ownGoalHit = (goalId || "").trim() ? findGoalById((goalId || "").trim()) : null;
    const ownGoalName = ownGoalHit?.name || (goalCustomName || "").trim();
    const ownGoalKindLabel = ownGoalHit
      ? ownGoalHit.kind === "highschool"
        ? t("高校受験")
        : ownGoalHit.kind === "university"
          ? t("大学受験")
          : t("資格")
      : t("目標");
    return (
    <article
      className={isInteractive ? "card status-card status-card-link" : "card status-card"}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? () => setCurrentView("profile") : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setCurrentView("profile");
              }
            }
          : undefined
      }
      aria-label={isInteractive ? t("プロフィール画面を開く") : undefined}
    >
      <div className="card-kicker">Player Status</div>
      <div className="player-heading">
        <span className="player-avatar player-avatar-character">
          {/* キャラクター silhouette のみ表示。以前は右下に photo を
              重ねていたが「Arc族キャラと顔写真が重なって崩れる」報告に
              対応してアイコンを 1 つ (= 選択しているキャラ + カラー) に
              統一する方針 (写真設定そのものも削除済)。 */}
          <ProfileCharacterPreview
            color={playerCharacterColor}
            shape={playerCharacterShape}
          />
        </span>
        <div className="player-heading-text">
          <h2>{playerName} <span className="player-level-badge">Lv.{levelState.level}</span></h2>
          <div className="player-heading-chips">
            {studyStreak > 0 ? (
              <span className="player-chip player-chip-streak" title={t("{n}日連続で学習中", { n: studyStreak })}>
                🔥 {t("{n}日連続", { n: studyStreak })}
              </span>
            ) : null}
            {todayStudyMinutes > 0 ? (
              <span className="player-chip player-chip-today">
                {t("今日 {duration}", { duration: formatStudyTimeJa(todayStudyMinutes) })}
              </span>
            ) : null}
            {currentOrganization ? (
              <span className="player-chip player-chip-org" title={t("{name}所属", { name: currentOrganization.name })}>
                {currentOrganization.name}
              </span>
            ) : null}
            {hasGithub ? (
              <span className="player-chip player-chip-github" title={t("GitHub 連携済み")}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.04c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.58.23 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.13v3.15c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
                  />
                </svg>
                {githubUsername || "GitHub"}
              </span>
            ) : null}
            {ownGoalName ? (
              <button
                type="button"
                className="player-chip player-chip-link player-chip-goal"
                onClick={() =>
                  void handleOpenGoalMatch({
                    goalId: ownGoalHit ? (goalId || "").trim() : undefined,
                    goalCustomName: ownGoalHit ? undefined : ownGoalName,
                    goalLabel: ownGoalName,
                  })
                }
                title={`${ownGoalKindLabel}: ${ownGoalName} — ${t("同じ目標の人を探す")}`}
                aria-label={`${ownGoalKindLabel}: ${ownGoalName}。${t("同じ目標の人を探す")}`}
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                </svg>
                <span className="player-chip-goal-text">{ownGoalName}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="exp-area">
        <div className="exp-meta">
          <span>Next Level</span>
          <strong>
            {levelState.currentExp.toLocaleString()} / {levelState.neededExp.toLocaleString()}
          </strong>
        </div>
        <div className="exp-track" aria-label="Experience progress">
          <span style={{ width: `${levelState.percent}%` }} />
        </div>
      </div>

      <div className="status-metrics">
        <div>
          <span>Effort EXP</span>
          <strong>{effortExp.toLocaleString()}</strong>
        </div>
        <div>
          <span>Output EXP</span>
          <strong>{outputExp.toLocaleString()}</strong>
        </div>
      </div>

      <div className="contribution-summary" aria-label="GitHub contribution summary">
        {/* 過去 1 年の GitHub 活動を 3 つの数値で要約。jogruber API は
            commits / PRs を分けて返してくれないので、見える情報だけで
            意味のある指標に組み直した。
              - 累計コントリビュート (= githubContributions.total)
              - 活動日数 (count > 0 の日数)
              - 過去 1 年の最長連続日数 */}
        {(() => {
          const days = githubContributions?.days ?? [];
          const total = githubContributions?.total ?? 0;
          const activeDays = days.reduce((acc, day) => (day.count > 0 ? acc + 1 : acc), 0);
          let longest = 0;
          let run = 0;
          for (const day of days) {
            if (day.count > 0) {
              run += 1;
              if (run > longest) longest = run;
            } else {
              run = 0;
            }
          }
          return (
            <>
              <div>
                <strong>{total.toLocaleString()}</strong>
                <span>contributions</span>
              </div>
              <div>
                <strong>{activeDays.toLocaleString()}</strong>
                <span>active days</span>
              </div>
              <div>
                <strong>{longest.toLocaleString()}</strong>
                <span>longest streak</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Determination line. A one-sentence "what I'm aiming at"
          declaration. Always present on the card (rendered as a
          subtle quote block) so users keep their intention visible
          every time they glance at status. Empty state nudges
          editing. */}
      <div className="player-determination">
        <span>{t("決意")}</span>
        {isInteractive ? (
          determinationText ? (
            <p>{determinationText}</p>
          ) : (
            <p className="player-determination-empty">
              {t("プロフィール設定で「決意」を一行書いておくと、起動時の合言葉になります。")}
            </p>
          )
        ) : (
          // プロフィール画面では決意をその場で編集できるようにする。
          // コンパクト 1 行 input + onBlur / Enter での自動保存。
          // 保存ボタンは廃止 (フォーカスが外れた瞬間に確定)。
          <input
            type="text"
            className="determination-inline"
            value={draftDetermination}
            onChange={(event) => setDraftDetermination(event.target.value)}
            onBlur={() => handleDeterminationSave()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur(); // blur が走り handleDeterminationSave が呼ばれる
              }
            }}
            placeholder={t("今の決意を一行で書いておこう")}
            aria-label={t("決意入力")}
            maxLength={140}
          />
        )}
      </div>
    </article>
    );
  };

  const postCard = (post: ContributionPostRecord, variant: "full" | "compact" = "full") => {
    const isLiked = post.likedUserIds.includes(currentUserUid);
    const isAuto = post.postType === "auto-study" || post.postType === "auto-workspace";

    // 自動投稿 (学習記録 / 作業部屋退室) は手書きの長文と並べると圧迫感が
    // 出るので、1 行横並びのコンパクト pill カードで描画する。like ボタンも
    // 縮約してハートだけにする。reply 系の機能は省略 (auto-* に reply を
    // ぶら下げる UX は意味が薄い)。
    if (isAuto) {
      const autoLook = resolveAuthorAppearance(
        post.userId,
        post.characterColor,
        post.characterShape,
      );
      const isOwnAuto = post.userId === currentUserUid;

      /* 学習ログは「『科目』を N 学習しました」の一文をやめ、学習時間を
         主役にしたインク印（蔵書印）風の "学習チケット" に仕立てる。
         印の中の集中メーターは時間に応じて満ちる（4h で full）。 */
      if (post.postType === "auto-study") {
        const subjectMatch = post.text.match(/『(.+?)』/);
        const subject = subjectMatch ? subjectMatch[1] : "";
        const mins = Math.max(0, post.studyMinutes || 0);
        let stampValue: string;
        let stampUnit: string;
        if (mins >= 60) {
          const hours = mins / 60;
          stampValue = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
          stampUnit = "h";
        } else {
          stampValue = String(mins);
          stampUnit = "min";
        }
        const focusFill = Math.min(mins / 240, 1);
        return (
          <article
            className={`study-log-card${isOwnAuto ? " is-own" : ""}`}
            data-kind="study"
            key={post.id}
          >
            <button
              type="button"
              className="study-log-stamp"
              style={{ ["--fill" as string]: String(focusFill) } as React.CSSProperties}
              onClick={() => handlePostAuthorOpen(post)}
              aria-label={t("{username}・{text}", { username: post.username, text: post.text })}
            >
              <span className="study-log-stamp-value">{stampValue}</span>
              <span className="study-log-stamp-unit">{stampUnit}</span>
            </button>
            <button
              type="button"
              className="study-log-main"
              onClick={() => handlePostAuthorOpen(post)}
            >
              <span className="study-log-eyebrow">{t("学習の記録")}</span>
              <strong className="study-log-subject">
                {subject ? `『${subject}』` : post.text}
              </strong>
              <span className="study-log-byline">
                {t("{username}・{time}", { username: post.username, time: formatPostTime(post.createdAt) })}
              </span>
            </button>
            <button
              type="button"
              className={`log-post-compact-like${isLiked ? " is-liked" : ""}`}
              onClick={() => handlePostLike(post)}
              aria-label={isLiked ? t("ハートを取り消す") : t("ハートする")}
              aria-pressed={isLiked}
            >
              <span aria-hidden="true">{isLiked ? "♥" : "♡"}</span>
              {post.likesCount > 0 ? <span className="log-post-compact-like-count">{post.likesCount}</span> : null}
            </button>
          </article>
        );
      }

      return (
        <article
          className={`log-post-card-compact${isOwnAuto ? " is-own" : ""}`}
          data-kind="workspace"
          key={post.id}
        >
          <button
            type="button"
            className="log-post-author-compact"
            onClick={() => handlePostAuthorOpen(post)}
            aria-label={t("{username} のプロフィールを開く", { username: post.username })}
          >
            <ProfileCharacterPreview color={autoLook.color} shape={autoLook.shape} />
          </button>
          <span className="log-post-compact-body">
            <strong className="log-post-compact-name">{post.username}</strong>
            <span className="log-post-compact-text">{post.text}</span>
          </span>
          <small className="log-post-compact-time">{formatPostTime(post.createdAt)}</small>
          <button
            type="button"
            className={`log-post-compact-like${isLiked ? " is-liked" : ""}`}
            onClick={() => handlePostLike(post)}
            aria-label={isLiked ? t("ハートを取り消す") : t("ハートする")}
            aria-pressed={isLiked}
          >
            <span aria-hidden="true">{isLiked ? "♥" : "♡"}</span>
            {post.likesCount > 0 ? <span className="log-post-compact-like-count">{post.likesCount}</span> : null}
          </button>
        </article>
      );
    }

    /* 投稿の下の小さなメタ。以前は studyMinutes が 0 / roomName が空の
       時に "quiet progress" "Quiet log" という英語のプレースホルダーを
       出していたが、意味が伝わらないと報告。データが無い時はそもそも
       表示しない設計に統一する。 */
    const studyLabel = post.studyMinutes > 0 ? `${formatStudyTimeJa(post.studyMinutes)} focused` : "";
    const roomLabel = post.roomName || "";
    const contributionLabel =
      post.githubContributionCount > 0 ? `+${post.githubContributionCount.toLocaleString()} commits` : "";
    const hasMeta = !!(studyLabel || roomLabel || contributionLabel);
    const replies = postReplies
      .filter((reply) => reply.postId === post.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const visibleReplies = variant === "compact" ? replies.slice(-1) : replies.slice(-3);
    const replyDraft = replyDrafts[post.id] || "";
    const isReplyOpen = openReplyPostIds.has(post.id);
    const isBursting = likeBurstPostId === post.id;

    return (
      <article
        className={`log-post-card ${variant === "compact" ? "compact" : ""}${post.userId === currentUserUid ? " is-own" : ""}`}
        key={post.id}
      >
        <button type="button" className="log-post-author" onClick={() => handlePostAuthorOpen(post)}>
          {(() => {
            const look = resolveAuthorAppearance(
              post.userId,
              post.characterColor,
              post.characterShape,
            );
            return <ProfileCharacterPreview color={look.color} shape={look.shape} />;
          })()}
          <span>
            <strong>
              {post.username}
              {post.postType === "auto-workspace" ? (
                <span className="log-post-auto-badge" data-kind="workspace" aria-label={t("作業部屋での積み上げ")}>
                  ✦ {t("作業ログ")}
                </span>
              ) : post.postType === "auto-study" ? (
                <span className="log-post-auto-badge" data-kind="study" aria-label={t("学習記録から自動投稿")}>
                  📘 {t("学習ログ")}
                </span>
              ) : null}
            </strong>
            <small>{formatPostTime(post.createdAt)}</small>
          </span>
        </button>

        {/* 本文ブロック: タップで詳細モーダルを開く。アクション (いいね /
            返信 / 削除) は外側にあるので不用意に発火しない。 */}
        <button
          type="button"
          className="log-post-body-button"
          /* スクロール中の release が click と誤判定されて詳細モーダルが
             開いてしまい "途中で止まる" と認識されていた。 pointer の
             移動量を見て、ほぼ移動していない時だけ真のタップとして発火。 */
          onPointerDown={(event) => {
            (event.currentTarget as HTMLButtonElement & { _ptr?: { x: number; y: number } })._ptr =
              { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const target = event.currentTarget as HTMLButtonElement & {
              _ptr?: { x: number; y: number };
            };
            const start = target._ptr;
            target._ptr = undefined;
            if (!start) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) return;
            setExpandedPost(post);
          }}
          aria-label={t("投稿の詳細を見る")}
        >
          {post.subject ? (
            <div className="log-post-study-inset">
              {post.itemPhoto ? (
                <img
                  className="log-post-study-cover"
                  src={post.itemPhoto}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div
                  className="log-post-study-cover is-empty"
                  style={{ background: post.characterColor || "rgba(0,0,0,0.06)" }}
                  aria-hidden="true"
                >
                  {post.subject.slice(0, 1)}
                </div>
              )}
              <div className="log-post-study-meta">
                <strong className="log-post-study-subject">{post.subject}</strong>
                <span className="log-post-study-time">
                  {formatStayTime(post.studyMinutes || 0, language)}
                </span>
              </div>
            </div>
          ) : null}

          {post.text && post.text.trim() && post.text.trim() !== post.subject ? (
            <p>{post.text}</p>
          ) : null}

          {post.photo ? (
            <img
              className="log-post-photo"
              src={post.photo}
              alt=""
              loading="lazy"
            />
          ) : null}

          {hasMeta && !post.subject ? (
            <div className="log-post-meta">
              {studyLabel ? <span>{studyLabel}</span> : null}
              {contributionLabel ? <span>{contributionLabel}</span> : null}
              {roomLabel ? <span>{roomLabel}</span> : null}
            </div>
          ) : null}
        </button>

        <div className="log-post-actions">
          <motion.button
            type="button"
            className={isLiked ? "log-like-button liked" : "log-like-button"}
            onClick={() => handlePostLike(post)}
            aria-label={isLiked ? t("ハートを取り消す") : t("ハートする")}
            aria-pressed={isLiked}
            data-tooltip={isLiked ? "Liked" : "Like"}
            whileTap={{ scale: 0.84 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
          >
            <span className="log-like-icon" aria-hidden="true">
              <motion.svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                animate={
                  isBursting
                    ? { scale: [1, 1.35, 0.92, 1.08, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.25, 0.5, 0.75, 1] }}
              >
                <path
                  d="M12 20.4s-7.1-4.35-9.05-8.6C1.45 8.55 3.4 5.3 6.6 5.3c1.95 0 3.55 1.05 4.4 2.55h2c.85-1.5 2.45-2.55 4.4-2.55 3.2 0 5.15 3.25 3.65 6.5C19.1 16.05 12 20.4 12 20.4z"
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </motion.svg>
              <AnimatePresence>
                {isBursting ? (
                  <>
                    <motion.span
                      key="ring"
                      className="log-like-ring"
                      initial={{ scale: 0.35, opacity: 0.85 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                    <motion.span
                      key="glow"
                      className="log-like-glow"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1.4, opacity: [0, 0.9, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.65, ease: "easeOut", times: [0, 0.35, 1] }}
                    />
                  </>
                ) : null}
              </AnimatePresence>
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={post.likesCount}
                className="log-like-count"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {post.likesCount.toLocaleString()}
              </motion.span>
            </AnimatePresence>
            {/* スマホでアイコンの意味が分かりづらいとの報告。
                PC は data-tooltip / hover ハロで意図が伝わるが、
                モバイルはタッチで tooltip が出ない & ハートだけだと
                "数値カウントが何を表しているか" 即座に判別できない。
                小さな日本語ラベルを併記し (CSS でモバイルのみ表示)、
                ボタンの意味を明示する。 */}
            <small className="log-action-label">{t("いいね")}</small>
          </motion.button>

          <button
            type="button"
            className={isReplyOpen ? "log-reply-toggle is-open" : "log-reply-toggle"}
            onClick={() => togglePostReplyOpen(post.id)}
            aria-label={isReplyOpen ? t("返信を閉じる") : t("返信を書く")}
            aria-expanded={isReplyOpen}
            data-tooltip={isReplyOpen ? t("閉じる") : t("返信")}
          >
            <span className="log-reply-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M4.5 5.5h15c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H9l-4 3.5V17H4.5C3.67 17 3 16.33 3 15.5V7c0-.83.67-1.5 1.5-1.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {replies.length > 0 ? <span>{replies.length.toLocaleString()}</span> : null}
            <small className="log-action-label">{isReplyOpen ? t("閉じる") : t("返信")}</small>
          </button>

          {/* 削除はメインアクションから外し、控えめな "⋯" overflow に移動。
              本人のみ表示し、タップで window.confirm を経由するので
              誤発火しにくい。 */}
          {post.userId === currentUserUid ? (
            <button
              type="button"
              className="log-post-overflow"
              onClick={() => handlePostDelete(post)}
              aria-label={t("投稿を削除")}
              title={t("削除")}
            >
              ⋯
            </button>
          ) : null}
        </div>

        <div className="post-reply-area">
          {visibleReplies.length > 0 ? (
            <div className="post-reply-list">
              {visibleReplies.map((reply, index) => (
                <motion.button
                  type="button"
                  key={reply.id}
                  className="post-reply-item"
                  onClick={() => handleReplyAuthorOpen(reply)}
                  aria-label={t("{username}のプロフィールを開く", { username: reply.username })}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.34,
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.07,
                  }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {(() => {
                    const look = resolveAuthorAppearance(
                      reply.userId,
                      reply.characterColor,
                      reply.characterShape,
                    );
                    return <ProfileCharacterPreview color={look.color} shape={look.shape} />;
                  })()}
                  <p>
                    <strong>{reply.username}</strong>
                    {formatReplyTime(reply.createdAt, t) ? (
                      <time className="post-reply-time" dateTime={reply.createdAt}>
                        {formatReplyTime(reply.createdAt, t)}
                      </time>
                    ) : null}
                    <span>{reply.text}</span>
                  </p>
                </motion.button>
              ))}
              {replies.length > visibleReplies.length ? <small>{t("ほか {count} 件", { count: replies.length - visibleReplies.length })}</small> : null}
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {isReplyOpen ? (
              <motion.form
                className="post-reply-form"
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePostReplySubmit(post);
                }}
              >
                <input
                  value={replyDraft}
                  autoFocus
                  onChange={(event) => {
                    setReplyDrafts((drafts) => ({ ...drafts, [post.id]: event.target.value }));
                    setReplyError("");
                  }}
                  placeholder={t("短く返信")}
                  maxLength={160}
                />
                <button type="submit" disabled={!replyDraft.trim()}>
                  {t("返信")}
                </button>
              </motion.form>
            ) : null}
          </AnimatePresence>
        </div>
      </article>
    );
  };

  /* 今週の学習を曜日別の棒グラフで見せる。自分・他人どちらの
     プロフィールでも「どれだけ積み上げたか」が一目で分かるようにする。
     minutesByDay は月曜始まりの 7 要素 (月→日)。
     options.editable = true のとき各曜日列がボタンになり、その日の
     学習ログ (subject + 分) を編集できるパネルが開く。自分のプロフィール
     からのみ true で呼ばれる。 */
  const profileWeekChart = (
    minutesByDay: number[],
    todayIndex: number,
    options?: { editable?: boolean; weekData?: WeeklyStudyDay[] },
  ) => {
    const editable = !!options?.editable;
    const weekData = options?.weekData;
    const max = Math.max(1, ...minutesByDay);
    const total = minutesByDay.reduce((sum, m) => sum + m, 0);
    const activeDays = minutesByDay.filter((m) => m > 0).length;
    const selectedIndex = editable ? profileWeekDayIndex : null;
    const selectedDay = selectedIndex !== null ? weekData?.[selectedIndex] : null;
    /* 曜日ラベルは t() で localize する (en: Mon/Tue/.../Sun)。
       辞書側に "月":"Mon" 等を持たせる。 */
    const dayShortLabel = (index: number) => t(dayLabels[index]);
    /* 詳細パネルの subject picker 用に active な learning items を抽出 */
    const activeLearningItems = learningItems
      .filter((entry) => !entry.archived && (entry.status ?? "active") !== "done")
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return (
      <section className="profile-week-chart" aria-label={t("今週の学習時間")}>
        <div className="profile-week-chart-head">
          <p className="card-kicker">This Week</p>
          <div className="profile-week-chart-summary">
            <strong>{formatStudyTimeJa(total, language)}</strong>
            <span>{t("{active}日 / 7日", { active: activeDays })}</span>
          </div>
        </div>
        <div
          className="profile-week-chart-bars"
          role={editable ? "tablist" : "img"}
          aria-label={t("今週の合計 {duration}", { duration: formatStudyTimeJa(total, language) })}
        >
          {minutesByDay.map((minutes, index) => {
            const heightPct = minutes > 0 ? Math.max(8, (minutes / max) * 100) : 0;
            const isSelected = editable && index === selectedIndex;
            const colClass = `profile-week-chart-col${index === todayIndex ? " is-today" : ""}${
              minutes > 0 ? " has-value" : ""
            }${editable ? " is-editable" : ""}${isSelected ? " is-selected" : ""}`;
            const inner = (
              <>
                <span className="profile-week-chart-value">
                  {minutes > 0 ? formatStudyTimeJa(minutes, language) : ""}
                </span>
                <div className="profile-week-chart-track">
                  <span className="profile-week-chart-bar" style={{ height: `${heightPct}%` }} />
                </div>
                <span className="profile-week-chart-day">{dayShortLabel(index)}</span>
              </>
            );
            if (editable) {
              return (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={colClass}
                  onClick={() => {
                    setProfileWeekDayIndex((curr) => (curr === index ? null : index));
                    /* 別の曜日に切り替えたら add フォーム入力をクリア */
                    setProfileWeekAddSubjectId("");
                    setProfileWeekAddMinutes("");
                  }}
                  aria-label={t("{day} の学習を編集", { day: dayShortLabel(index) })}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div key={index} className={colClass}>
                {inner}
              </div>
            );
          })}
        </div>

        {editable && selectedDay ? (
          <div className="profile-week-day-detail" role="region" aria-label={t("選択した曜日の詳細")}>
            <div className="profile-week-day-detail-head">
              <div>
                <strong>
                  {dayShortLabel(selectedIndex!)} · {selectedDay.dateLabel}
                </strong>
                <small>{formatStudyTimeJa(selectedDay.totalMinutes, language)}</small>
              </div>
              <button
                type="button"
                className="profile-week-day-detail-close"
                onClick={() => setProfileWeekDayIndex(null)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </div>
            {selectedDay.logs.length === 0 ? (
              <p className="profile-week-day-detail-empty">
                {t("この日の学習ログはまだありません。下のフォームから追加できます。")}
              </p>
            ) : (
              <ul className="profile-week-day-detail-list">
                {selectedDay.logs
                  .slice()
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((log) => {
                    const editingValue = profileWeekLogEditMinutes[log.id];
                    const inputValue =
                      typeof editingValue === "string" ? editingValue : String(log.minutes);
                    const parsed = Number(inputValue);
                    const isValid = Number.isFinite(parsed) && parsed >= 0;
                    const isDirty = isValid && Math.round(parsed) !== log.minutes;
                    const createdAtDate = new Date(log.createdAt);
                    const timeLabel = Number.isFinite(createdAtDate.getTime())
                      ? `${String(createdAtDate.getHours()).padStart(2, "0")}:${String(
                          createdAtDate.getMinutes(),
                        ).padStart(2, "0")}`
                      : "—";
                    /* +/- chip で 5 / 15 分単位の細かい調整を即座に。
                       入力中の値があればそれを基準に、なければ現在値を基準に増減。 */
                    const adjustBy = (delta: number) => {
                      const base = isValid ? Math.round(parsed) : log.minutes;
                      const next = Math.max(0, base + delta);
                      setProfileWeekLogEditMinutes((prev) => ({
                        ...prev,
                        [log.id]: String(next),
                      }));
                    };
                    return (
                      <li key={log.id} className="profile-week-day-detail-row">
                        <span className="profile-week-day-detail-row-main">
                          <span
                            className="profile-week-day-detail-color"
                            style={{ background: log.color || "rgba(31,111,74,0.5)" }}
                            aria-hidden="true"
                          />
                          <span className="profile-week-day-detail-subject">{log.subject}</span>
                          <span className="profile-week-day-detail-time" aria-hidden="true">
                            {timeLabel}
                          </span>
                          <button
                            type="button"
                            className="profile-week-day-detail-delete"
                            onClick={() => handleProfileWeekLogDelete(log)}
                            aria-label={t("削除")}
                            title={t("削除")}
                          >
                            ×
                          </button>
                        </span>
                        <span className="profile-week-day-detail-row-edit">
                          <span className="profile-week-day-detail-adjust" role="group" aria-label={t("時間を調整")}>
                            <button type="button" onClick={() => adjustBy(-15)} aria-label="-15">−15</button>
                            <button type="button" onClick={() => adjustBy(-5)} aria-label="-5">−5</button>
                            <button type="button" onClick={() => adjustBy(5)} aria-label="+5">+5</button>
                            <button type="button" onClick={() => adjustBy(15)} aria-label="+15">+15</button>
                          </span>
                          <span className="profile-week-day-detail-minutes">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              value={inputValue}
                              onChange={(event) =>
                                setProfileWeekLogEditMinutes((prev) => ({
                                  ...prev,
                                  [log.id]: event.target.value,
                                }))
                              }
                              aria-label={t("学習時間 (分)")}
                            />
                            <small>{t("分")}</small>
                          </span>
                          <button
                            type="button"
                            className="profile-week-day-detail-save"
                            disabled={!isDirty}
                            onClick={() => {
                              if (!isValid) return;
                              handleProfileWeekLogUpdate(log, Math.round(parsed));
                              setProfileWeekLogEditMinutes((prev) => {
                                const next = { ...prev };
                                delete next[log.id];
                                return next;
                              });
                            }}
                          >
                            {t("更新")}
                          </button>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}

            {/* 新規ログ追加フォーム。Subject (Library のアクティブ項目) を選び、
                分を入力 → クイックチップ or 自由入力 → +追加。 */}
            <div className="profile-week-day-detail-add">
              <div className="profile-week-day-detail-add-head">
                <span className="profile-week-day-detail-add-label">{t("この日に追加")}</span>
              </div>
              {activeLearningItems.length === 0 ? (
                <p className="profile-week-day-detail-add-empty">
                  {t("ライブラリに学習対象がありません。先に追加してください。")}
                </p>
              ) : (
                <>
                  <div className="profile-week-day-detail-add-row">
                    <select
                      value={profileWeekAddSubjectId}
                      onChange={(event) => setProfileWeekAddSubjectId(event.target.value)}
                      aria-label={t("学習対象")}
                    >
                      <option value="">{t("学習対象を選ぶ")}</option>
                      {activeLearningItems.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                    <span className="profile-week-day-detail-add-minutes">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        placeholder="30"
                        value={profileWeekAddMinutes}
                        onChange={(event) => setProfileWeekAddMinutes(event.target.value)}
                        aria-label={t("学習時間 (分)")}
                      />
                      <small>{t("分")}</small>
                    </span>
                  </div>
                  <div className="profile-week-day-detail-add-quick" role="group" aria-label={t("クイック入力")}>
                    {[15, 30, 60, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setProfileWeekAddMinutes(String(m))}
                        className={profileWeekAddMinutes === String(m) ? "is-active" : ""}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="profile-week-day-detail-add-submit"
                    disabled={
                      !profileWeekAddSubjectId ||
                      !(Number(profileWeekAddMinutes) > 0)
                    }
                    onClick={() => {
                      const minutes = Math.round(Number(profileWeekAddMinutes));
                      if (!profileWeekAddSubjectId || !(minutes > 0)) return;
                      handleProfileWeekLogAdd(selectedDay.dateIso, profileWeekAddSubjectId, minutes);
                      setProfileWeekAddSubjectId("");
                      setProfileWeekAddMinutes("");
                    }}
                  >
                    + {t("追加")}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  /* 他人のプロフィールから目標 chip を描く。設定済みのときだけ表示し、
     未設定のユーザーには何も出さない (要望対応)。
     - profile.goalId が catalog にヒットすれば公式名 + 種別ラベル
     - 一覧にない自由記述 (goalCustomName) もそのまま表示
     - どちらも空なら null を返してセクションごと消える */
  const profileGoalChip = (profile: { goalId?: string; goalCustomName?: string }) => {
    const goalIdValue = (profile.goalId || "").trim();
    const goalCustom = (profile.goalCustomName || "").trim();
    const catalogHit = goalIdValue ? findGoalById(goalIdValue) : null;
    const goalName = catalogHit?.name || goalCustom;
    if (!goalName) return null;
    const kindLabel = catalogHit
      ? catalogHit.kind === "highschool"
        ? t("高校受験")
        : catalogHit.kind === "university"
          ? t("大学受験")
          : t("資格")
      : t("目標");
    return (
      <section className="profile-goal-chip" aria-label={t("目標")}>
        <div className="profile-goal-chip-main">
          <span className="profile-goal-chip-kicker">{kindLabel}</span>
          <strong className="profile-goal-chip-name">{goalName}</strong>
        </div>
        {/* 同じ目標のユーザーを探す。ログイン中だけ出す (Firestore
            query にサインインが要るため)。catalog hit / custom どちらの
            分岐でも有効。 */}
        {currentUser ? (
          <button
            type="button"
            className="profile-goal-chip-find"
            onClick={() =>
              void handleOpenGoalMatch({
                goalId: catalogHit ? goalIdValue : undefined,
                goalCustomName: catalogHit ? undefined : goalCustom,
                goalLabel: goalName,
              })
            }
          >
            {t("同じ目標の人を探す")}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </section>
    );
  };

  /* 他人のプロフィール (UserProfile) から週グラフを描く。週キーが
     今週と一致するときだけ weekdayMinutes を信頼し、stale / 未保存は
     静かな空状態を返す。 */
  const profileWeekChartFromProfile = (profile: UserProfile) => {
    const todayIndex = (new Date().getDay() + 6) % 7; // 月=0 に正規化
    const isCurrentWeek = profile.weekKey === getCurrentWeekKey();
    const data =
      isCurrentWeek && profile.weekdayMinutes?.length === 7 ? profile.weekdayMinutes : null;
    // 曜日別内訳があればフルの棒グラフ。
    if (data && data.some((m) => m > 0)) {
      return profileWeekChart(data, todayIndex);
    }
    /* フォールバック: weekdayMinutes は今回追加した新フィールドなので、
       まだ新コードで記録していないユーザーは未保存。だが週合計 weekMinutes
       は以前から保存されているので、内訳が無くても「今週の合計」は出せる。
       これで「みんな記録しているのに空」を避ける。weekKey が今週でない
       (= 今週まだ未記録) ときだけ本当の空状態にする。 */
    const weekTotal =
      isCurrentWeek && typeof profile.weekMinutes === "number" ? profile.weekMinutes : 0;
    if (weekTotal > 0) {
      return (
        <section className="profile-week-chart is-summary" aria-label={t("今週の学習時間")}>
          <div className="profile-week-chart-head">
            <p className="card-kicker">This Week</p>
            <div className="profile-week-chart-summary">
              <strong>{formatStudyTimeJa(weekTotal)}</strong>
              <span>{t("今週の学習")}</span>
            </div>
          </div>
          <p className="profile-week-chart-note">{t("曜日別の内訳はまもなく表示されます。")}</p>
        </section>
      );
    }
    return (
      <section className="profile-week-chart is-empty" aria-label={t("今週の学習時間")}>
        <div className="profile-week-chart-head">
          <p className="card-kicker">This Week</p>
        </div>
        <p className="profile-week-chart-empty">{t("今週はまだ記録がありません。")}</p>
      </section>
    );
  };

  const memberProfileCard = (member: WorkspaceMember) => {
    const memberRoom =
      allWorkspaceRooms.find((room) => room.activeMembers.some((item) => item.userId === member.userId)) ||
      selectedRoom;
    const elapsedMinutes = getElapsedMinutes(member.joinedAt, workspaceNow);
    const memberProfile = workspaceMemberToProfile(member, t);
    const pendingOutgoingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === memberProfile.uid && request.status === "pending" && request.direction === "outgoing",
    );
    const pendingIncomingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === memberProfile.uid && request.status === "pending" && request.direction === "incoming",
    );
    const acceptedRequest = friendRequests.find(
      (request) => request.profile.uid === memberProfile.uid && request.status === "accepted",
    );
    const isFriend = friends.some((friend) => friend.uid === memberProfile.uid) || Boolean(acceptedRequest);
    const hasPendingRequest = Boolean(pendingOutgoingRequest || pendingIncomingRequest);

    const connectionLabel = isFriend
      ? t("つながっています")
      : pendingIncomingRequest
        ? t("申請が届いています")
        : pendingOutgoingRequest
          ? t("承認待ち")
          : t("未接続");
    const connectionState = isFriend
      ? "is-friend"
      : hasPendingRequest
        ? "is-pending"
        : "is-stranger";

    // workspaceProfiles のリアルタイム購読値を fallback の最優先に置く。
    // member 詳細を開いた直後はまだ authorAppearances に fetch が走って
    // いないことがあり、その隙に古いスナップショット色が出てしまうのを防ぐ。
    const memberLive = workspaceProfiles[member.userId];
    const memberLook = resolveAuthorAppearance(
      member.userId,
      memberLive?.characterColor || memberProfile.characterColor,
      memberLive?.characterShape || memberProfile.characterShape,
    );
    return (
      <article className="card member-profile-card workspace-member-profile-card">
        <header className="member-profile-hero">
          <ProfileCharacterPreview color={memberLook.color} shape={memberLook.shape} />
          <div className="member-profile-identity">
            {(() => {
              const liveProfile = workspaceProfiles[member.userId];
              const liveLevel = typeof liveProfile?.level === "number" ? liveProfile.level : null;
              const liveStreak = typeof liveProfile?.streak === "number" ? liveProfile.streak : 0;
              return (
                <>
                  <h2>
                    {member.name}{" "}
                    {liveLevel && liveLevel > 1 ? (
                      <span className="player-level-badge">Lv.{liveLevel}</span>
                    ) : null}
                  </h2>
                  {/* workspaceMemberToProfile は member.userId (= Firebase Auth
                      UID) をそのまま userId にしていて、ユーザーが登録した
                      ハンドル ("ari" 等) と別物が表示されていた。 cloud の
                      実 profile (workspaceProfiles[uid]) の userId を優先。
                      未取得 / NPC で取得できないときは @ 行ごと隠す。 */}
                  {liveProfile?.userId ? (
                    <small>@{liveProfile.userId}</small>
                  ) : null}
                  <div className="member-profile-chips">
                    <span className={`member-profile-status-chip ${connectionState}`}>
                      <i />
                      {connectionLabel}
                    </span>
                    {liveStreak > 0 ? (
                      <span className="player-chip player-chip-streak">🔥 {t("{n}日連続", { n: liveStreak })}</span>
                    ) : null}
                    {liveProfile?.githubUsername ? (
                      <a
                        className="player-chip player-chip-github player-chip-link"
                        href={`https://github.com/${liveProfile.githubUsername}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="11" height="11">
                          <path
                            fill="currentColor"
                            d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.04c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.58.23 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.13v3.15c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
                          />
                        </svg>
                        {liveProfile.githubUsername}
                      </a>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        </header>

        <div className="profile-resolve-panel">
          <span>{t("決意")}</span>
          <p>{profileResolveText(memberProfile, t)}</p>
        </div>

        <section className="member-profile-now" aria-label={t("いまの活動")}>
          <div className="member-profile-now-main">
            <span className="member-profile-now-label">{t("いま")}</span>
            <div className="member-profile-now-body">
              <strong>
                <i style={{ background: member.color }} />
                {member.building}
              </strong>
              <small>
                {memberRoom?.name || "Silent Workspace"}
                {` · ${t("滞在")} `}
                {formatStayTime(elapsedMinutes, language)}
              </small>
            </div>
          </div>
          <div className="member-profile-now-exp" aria-label={t("今日獲得したEXP")}>
            <span className="member-profile-now-exp-label">{t("今日")}</span>
            <strong>+{getRoomSessionExp(elapsedMinutes)} EXP</strong>
          </div>
        </section>

        <div className="friend-profile-actions member-profile-actions">
          <button
            type="button"
            disabled={isFriend || hasPendingRequest}
            onClick={() => handleFriendRequest(memberProfile)}
          >
            {isFriend ? t("フレンド") : pendingIncomingRequest ? t("申請が届いています") : pendingOutgoingRequest ? t("申請中") : t("フレンド申請")}
          </button>
          {pendingIncomingRequest ? (
            <button type="button" onClick={() => handleFriendAccept(pendingIncomingRequest)}>
              {t("承認する")}
            </button>
          ) : null}
        </div>

        {friendMessage ? <p className="friend-message">{friendMessage}</p> : null}
        {profileGoalChip(memberLive || memberProfile)}
        {profileWeekChartFromProfile(memberLive || memberProfile)}
      </article>
    );
  };

  // Compact version of the member profile, shown as an in-stage popover
  // when you tap another member's avatar in the workspace room. Same
  // connection logic as memberProfileCard but trimmed to a glanceable
  // card; a "詳細" button still opens the full profile screen.
  const roomMemberCompactCard = (member: WorkspaceMember, cloudUser?: UserProfile | null) => {
    const memberRoom =
      allWorkspaceRooms.find((room) =>
        room.activeMembers.some((item) => item.userId === member.userId),
      ) || selectedRoom;
    const elapsedMinutes = getElapsedMinutes(member.joinedAt, workspaceNow);
    const memberProfile = workspaceMemberToProfile(member, t);
    const liveProfile = cloudUser || workspaceProfiles[member.userId];
    // resolveAuthorAppearance に通すと、本人なら playerCharacterColor/Shape、
    // 他人なら authorAppearances → workspaceProfiles → 投稿スナップショット
    // の順で live を優先する。これで同一人物がカード間で違う色にならない。
    const previewLook = resolveAuthorAppearance(
      member.userId,
      liveProfile?.characterColor || memberProfile.characterColor,
      liveProfile?.characterShape || memberProfile.characterShape,
    );
    const liveLevel = typeof liveProfile?.level === "number" ? liveProfile.level : null;
    const liveStreak = typeof liveProfile?.streak === "number" ? liveProfile.streak : 0;

    const isSelf = member.userId === currentUser.uid;
    const pendingOutgoingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === memberProfile.uid &&
        request.status === "pending" &&
        request.direction === "outgoing",
    );
    const pendingIncomingRequest = friendRequests.find(
      (request) =>
        request.profile.uid === memberProfile.uid &&
        request.status === "pending" &&
        request.direction === "incoming",
    );
    const acceptedRequest = friendRequests.find(
      (request) => request.profile.uid === memberProfile.uid && request.status === "accepted",
    );
    const isFriend =
      friends.some((friend) => friend.uid === memberProfile.uid) || Boolean(acceptedRequest);
    const hasPendingRequest = Boolean(pendingOutgoingRequest || pendingIncomingRequest);

    const connectionLabel = isSelf
      ? t("あなた")
      : isFriend
        ? t("つながっています")
        : pendingIncomingRequest
          ? t("申請が届いています")
          : pendingOutgoingRequest
            ? t("承認待ち")
            : t("未接続");
    const connectionState = isSelf
      ? "is-self"
      : isFriend
        ? "is-friend"
        : hasPendingRequest
          ? "is-pending"
          : "is-stranger";

    return (
      <article className="room-member-card">
        <button
          type="button"
          className="room-member-card-close"
          onClick={handleCloseRoomPanels}
          aria-label={t("閉じる")}
        >
          ×
        </button>
        <div className="room-member-card-head">
          <ProfileCharacterPreview color={previewLook.color} shape={previewLook.shape} />
          <div className="room-member-card-identity">
            <h3>
              {member.name}
              {liveLevel && liveLevel > 1 ? (
                <span className="player-level-badge">Lv.{liveLevel}</span>
              ) : null}
            </h3>
            {/* cloud の実 profile userId を優先 (Auth UID 表示を防ぐ)。 */}
            {liveProfile?.userId ? (
              <small>@{liveProfile.userId}</small>
            ) : null}
            <div className="room-member-card-chips">
              <span className={`room-member-card-status ${connectionState}`}>
                <i />
                {connectionLabel}
              </span>
              {liveStreak > 0 ? (
                <span className="player-chip player-chip-streak">🔥 {t("{n}日連続", { n: liveStreak })}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="room-member-card-now">
          <div className="room-member-card-now-task">
            <strong>
              <i style={{ background: member.color }} />
              {member.building}
            </strong>
            <small>
              {memberRoom?.name || "Silent Workspace"}
              {` · ${t("滞在")} `}
              {formatStayTime(elapsedMinutes, language)}
            </small>
          </div>
          <div className="room-member-card-now-exp">
            <span>{t("今日")}</span>
            <strong>+{getRoomSessionExp(elapsedMinutes)} EXP</strong>
          </div>
        </div>

        <div className="room-member-card-actions">
          {isSelf ? null : (
            <button
              type="button"
              disabled={isFriend || hasPendingRequest}
              onClick={() => handleFriendRequest(memberProfile)}
            >
              {isFriend
                ? t("フレンド")
                : pendingIncomingRequest
                  ? t("申請が届いています")
                  : pendingOutgoingRequest
                    ? t("申請中")
                    : t("フレンド申請")}
            </button>
          )}
          {!isSelf && pendingIncomingRequest ? (
            <button type="button" onClick={() => handleFriendAccept(pendingIncomingRequest)}>
              {t("承認する")}
            </button>
          ) : null}
          <button
            type="button"
            className={isSelf ? undefined : "is-secondary"}
            onClick={() => {
              handleCloseRoomPanels();
              void handleMemberProfileOpen(member);
            }}
          >
            {t("詳細")}
          </button>
          {isDeveloperAccount && !isSelf && memberRoom ? (
            <button
              type="button"
              className="is-danger room-member-card-force-leave"
              onClick={() => handleAdminForceLeave(member, memberRoom.id)}
            >
              {t("退出させる")}
            </button>
          ) : null}
        </div>

        {friendMessage ? <p className="room-member-card-message">{friendMessage}</p> : null}
      </article>
    );
  };

  /* 他人のプロフィール用の「今週」データを Contribution 風の7セル強度
     ストリップに変換する。weekdayMinutes(曜日別)があれば各セルの強度を
     段階化、無ければ週合計だけ・それも無ければ空状態。profileWeekChart の
     バー版とは別物で、こちらは friend-profile-card 専用。 */
  const friendWeekStripData = (profile: UserProfile) => {
    const todayIndex = (new Date().getDay() + 6) % 7; // 月=0
    const isCurrentWeek = profile.weekKey === getCurrentWeekKey();
    const breakdown =
      isCurrentWeek && profile.weekdayMinutes?.length === 7 ? profile.weekdayMinutes : null;
    const levelFor = (minutes: number, max: number): 0 | 1 | 2 | 3 | 4 => {
      if (minutes <= 0) return 0;
      const ratio = max > 0 ? minutes / max : 0;
      if (ratio >= 0.75) return 4;
      if (ratio >= 0.5) return 3;
      if (ratio >= 0.25) return 2;
      return 1;
    };
    if (breakdown && breakdown.some((m) => m > 0)) {
      const max = Math.max(...breakdown);
      const cells = breakdown.map((minutes, index) => ({
        level: levelFor(minutes, max),
        minutes,
        isToday: index === todayIndex,
      }));
      return {
        cells,
        totalMinutes: breakdown.reduce((sum, m) => sum + m, 0),
        activeDays: breakdown.filter((m) => m > 0).length,
        isEmpty: false,
        noBreakdown: false,
      };
    }
    const emptyCells = Array.from({ length: 7 }, (_, index) => ({
      level: 0 as const,
      minutes: 0,
      isToday: index === todayIndex,
    }));
    const weekTotal =
      isCurrentWeek && typeof profile.weekMinutes === "number" ? profile.weekMinutes : 0;
    if (weekTotal > 0) {
      return { cells: emptyCells, totalMinutes: weekTotal, activeDays: 0, isEmpty: false, noBreakdown: true };
    }
    return { cells: emptyCells, totalMinutes: 0, activeDays: 0, isEmpty: true, noBreakdown: false };
  };

  const userProfileCard = (profile: UserProfile) => {
    const pendingOutgoingRequest = friendRequests.find(
      (request) => request.profile.uid === profile.uid && request.status === "pending" && request.direction === "outgoing",
    );
    const pendingIncomingRequest = friendRequests.find(
      (request) => request.profile.uid === profile.uid && request.status === "pending" && request.direction === "incoming",
    );
    const acceptedRequest = friendRequests.find(
      (request) => request.profile.uid === profile.uid && request.status === "accepted",
    );
    const isFriend = friends.some((friend) => friend.uid === profile.uid) || Boolean(acceptedRequest);
    const hasPendingRequest = Boolean(pendingOutgoingRequest || pendingIncomingRequest);
    const githubUrl = getFriendGithubUrl(profile.userId);

    const connectionLabel = isFriend
      ? t("つながっています")
      : pendingIncomingRequest
        ? t("申請が届いています")
        : pendingOutgoingRequest
          ? t("承認待ち")
          : t("未接続");
    const connectionState = isFriend
      ? "is-friend"
      : hasPendingRequest
        ? "is-pending"
        : "is-stranger";

    // Pull the live profile snapshot (level / EXP / streak / GitHub
     // username etc.) — the `profile` arg may carry only the public
     // search-result fields, so we layer on whatever the workspace
     // subscription has fetched so far. Falls back to the arg.
    const liveProfile = workspaceProfiles[profile.uid] || profile;
    const liveLevel = typeof liveProfile.level === "number" ? liveProfile.level : 1;
    const liveStreak = typeof liveProfile.streak === "number" ? liveProfile.streak : 0;
    const liveGithubUrl = liveProfile.githubUsername
      ? `https://github.com/${liveProfile.githubUsername}`
      : githubUrl;
    // 同上：friend を開いた瞬間の表示でも古いスナップショットを使わず、
    // workspaceProfiles のリアルタイム値を fallback として優先する。
    const friendLook = resolveAuthorAppearance(
      profile.uid,
      liveProfile.characterColor || profile.characterColor,
      liveProfile.characterShape || profile.characterShape,
    );
    return (
      <article className="card member-profile-card friend-profile-card">
        <header className="member-profile-hero">
          <ProfileCharacterPreview color={friendLook.color} shape={friendLook.shape} />
          <div className="member-profile-identity">
            <h2>
              {profile.displayName}{" "}
              {liveLevel > 1 ? <span className="player-level-badge">Lv.{liveLevel}</span> : null}
            </h2>
            {profile.userId ? <small>@{profile.userId}</small> : null}
            <div className="member-profile-chips">
              <span className={`member-profile-status-chip ${connectionState}`}>
                <i />
                {connectionLabel}
              </span>
              {liveStreak > 0 ? (
                <span className="player-chip player-chip-streak">🔥 {t("{n}日連続", { n: liveStreak })}</span>
              ) : null}
              {liveProfile.githubUsername ? (
                <span className="player-chip player-chip-github">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="11" height="11">
                    <path
                      fill="currentColor"
                      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.04c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.58.23 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.13v3.15c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
                    />
                  </svg>
                  {liveProfile.githubUsername}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        {/* 決意 — 枠もグラデも持たない引用。細い 2px の緑アクセント線だけ
            添えて、本人の宣言を静かに引き立てる。 */}
        <blockquote className="friend-resolve">{profileResolveText(profile, t)}</blockquote>

        {/* THIS WEEK — このカードの視覚的中心。Contribution 風の7セル強度
            ストリップ＋「今週◯分 · 連続◯日」。記録ゼロでもセルは残し、
            空状態コピーを添える。 */}
        {(() => {
          const week = friendWeekStripData(liveProfile);
          return (
            <section className="friend-week" aria-label={t("今週の学習記録")}>
              <div className="friend-week-head">
                <p className="card-kicker">This Week</p>
                {!week.isEmpty ? (
                  <p className="friend-week-summary">
                    {t("今週 {time}", { time: formatStudyTimeJa(week.totalMinutes) })}
                    {liveStreak > 0 ? ` · ${t("連続 {days}日", { days: liveStreak })}` : ""}
                  </p>
                ) : null}
              </div>
              <div
                className="friend-week-strip"
                role="img"
                aria-label={
                  week.isEmpty
                    ? t("今週はまだ記録がありません")
                    : t("今週の合計 {time}", { time: formatStudyTimeJa(week.totalMinutes) })
                }
              >
                {week.cells.map((cell, index) => (
                  <span
                    key={index}
                    className={`friend-week-cell is-l${cell.level}${cell.isToday ? " is-today" : ""}`}
                  >
                    <small>{dayLabels[index]}</small>
                  </span>
                ))}
              </div>
              {week.isEmpty ? (
                <p className="friend-week-foot is-empty">{t("今週はまだ記録がありません。")}</p>
              ) : week.noBreakdown ? (
                <p className="friend-week-foot">{t("曜日別の内訳はまもなく表示されます。")}</p>
              ) : null}
            </section>
          );
        })()}

        {profileGoalChip(profile)}

        <div className="friend-profile-actions">
          <button
            type="button"
            className="friend-action-primary"
            disabled={isFriend || hasPendingRequest}
            onClick={() => handleFriendRequest(profile)}
          >
            {isFriend ? t("フレンド") : pendingIncomingRequest ? t("申請が届いています") : pendingOutgoingRequest ? t("申請中") : t("フレンド申請")}
          </button>
          {pendingIncomingRequest ? (
            <>
              <button type="button" className="friend-action-accept" onClick={() => handleFriendAccept(pendingIncomingRequest)}>
                {t("承認する")}
              </button>
              <button
                type="button"
                className="friend-action-decline"
                onClick={() => handleFriendReject(pendingIncomingRequest)}
              >
                {t("拒否")}
              </button>
            </>
          ) : null}
          {isFriend ? (
            <button
              type="button"
              className="friend-action-mute"
              onClick={() => handleToggleFriendMute(profile.uid)}
              title={mutedFriendUids.includes(profile.uid) ? t("ミュート解除") : t("通知をミュート")}
            >
              {mutedFriendUids.includes(profile.uid) ? t("ミュート解除") : t("ミュート")}
            </button>
          ) : null}
          {liveGithubUrl ? (
            <a className="friend-action-ghost" href={liveGithubUrl} target="_blank" rel="noreferrer">
              GitHub →
            </a>
          ) : null}
          {/* ブロック等の破壊的・低頻度操作は主要動線から隠し ⋯ メニューへ。
              本人のカードでは出さない。 */}
          {profile.uid !== currentUserUid ? (
            <div className="friend-more">
              <button
                type="button"
                className="friend-more-toggle"
                aria-haspopup="true"
                aria-expanded={profileActionsMenuOpen}
                aria-label={t("その他の操作")}
                onClick={() => setProfileActionsMenuOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  <circle cx="19" cy="12" r="1.6" fill="currentColor" />
                </svg>
              </button>
              {profileActionsMenuOpen ? (
                <div className="friend-more-menu" role="menu">
                  {isFriend ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileActionsMenuOpen(false);
                        const friend = friends.find((item) => item.uid === profile.uid);
                        if (!friend) return;
                        const ok = window.confirm(
                          t("{name} をフレンドから外しますか？", { name: profile.displayName || friend.name }),
                        );
                        if (ok) void handleFriendRemove(friend);
                      }}
                    >
                      {t("フレンド解除")}
                    </button>
                  ) : null}
                  {blockedFriendUids.includes(profile.uid) ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileActionsMenuOpen(false);
                        handleUnblockUser(profile.uid);
                      }}
                    >
                      {t("ブロックを解除する")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => {
                        setProfileActionsMenuOpen(false);
                        const ok = window.confirm(
                          t("{name} をブロックしますか？\nフレンド関係は解除され、申請も届かなくなります。", { name: profile.displayName || t("このユーザー") }),
                        );
                        if (ok) void handleBlockUser({ uid: profile.uid, name: profile.displayName || t("ユーザー") });
                      }}
                    >
                      {t("このユーザーをブロック")}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {friendMessage ? <p className="friend-message">{friendMessage}</p> : null}
      </article>
    );
  };

  const contributionArcCardSection = (
    <section className="contribution-arc-card" aria-label="Contribution Arc">
        <div className="contribution-arc-head">
          <div className="contribution-arc-head-title">
            <p className="card-kicker">
              Contribution Arc
              <button
                type="button"
                className="contribution-arc-showcase-link"
                onClick={() => setCurrentView("showcase")}
                aria-label={t("世界観を見る")}
                title={t("世界観を見る")}
              >
                <span aria-hidden="true">✦</span>
                <span>{t("世界観")}</span>
              </button>
            </p>
            <strong>
              {t("{hours}時間 学習", { hours: Math.round(contributionArc.totalMinutes / 60) })}
              {githubContributionArc ? ` · ${githubContributionArc.total} commit` : ""}
            </strong>
            <span>
              {t("直近13週")}
              {" · "}
              {t("{days}日学習", { days: contributionArc.activeDays })}
              {githubContributionArc ? ` / ${githubContributionArc.activeDays}${t("日コミット")}` : ""}
            </span>
          </div>
          <div className="contribution-arc-stats" aria-label={t("学習サマリ")}>
            <div
              className="arc-stat"
              data-tooltip={
                contributionArc.lastWeekMinutes > 0
                  ? t("先週比 {diff}", { diff: (contributionArc.thisWeekMinutes - contributionArc.lastWeekMinutes >= 0 ? "+" : "") + formatStudyTimeJa(Math.abs(contributionArc.thisWeekMinutes - contributionArc.lastWeekMinutes)) })
                  : t("先週の記録はまだありません")
              }
            >
              <small>{t("今週")}</small>
              <strong>{formatStudyTimeJa(contributionArc.thisWeekMinutes)}</strong>
            </div>
            <div className="arc-stat" data-tooltip={t("連続して記録した最長期間")}>
              <small>{t("最長連続")}</small>
              <strong>{contributionArc.longestStreak}{t("日")}</strong>
            </div>
            <div
              className="arc-stat"
              data-tooltip={
                contributionArc.topMonthMinutes > 0
                  ? t("合計 {minutes}", { minutes: formatStudyTimeJa(contributionArc.topMonthMinutes) })
                  : t("まだ記録なし")
              }
            >
              <small>{t("最も学んだ月")}</small>
              <strong>{contributionArc.topMonthLabel || "—"}</strong>
            </div>
          </div>
        </div>
        <div className="contribution-arc-body">
        <div className="contribution-arc-left">
        <div className="contribution-arc-canvas">
          <div
            className="contribution-arc-grid"
            role="img"
            aria-label={t("直近13週: {days}日学習{commit}", {
              days: contributionArc.activeDays,
              commit: githubContributionArc ? ` · ${githubContributionArc.activeDays}${t("日コミット")}` : ""
            })}
          >
            <div className="contribution-arc-track">
            {contributionArcCurvePath ? (
              <svg
                className="contribution-arc-curve"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={contributionArcCurvePath} />
              </svg>
            ) : null}
            {hoveredArcCell ? (() => {
              const hoveredCommits = githubByKey.get(hoveredArcCell.day.key)?.count ?? 0;
              const hasStudy = hoveredArcCell.day.minutes > 0;
              const hasCommits = hoveredCommits > 0;
              return (
                <div
                  className={`contribution-arc-tooltip${
                    hoveredArcCell.placement === "below" ? " is-below" : ""
                  }`}
                  style={{ left: hoveredArcCell.left, top: hoveredArcCell.top }}
                  role="tooltip"
                >
                  <div className="contribution-arc-tooltip-head">
                    <strong>
                      {hoveredArcCell.day.date.getMonth() + 1}/{hoveredArcCell.day.date.getDate()}
                    </strong>
                    <span>
                      {[t("日"), t("月"), t("火"), t("水"), t("木"), t("金"), t("土")][hoveredArcCell.day.date.getDay()]}{t("曜")}
                    </span>
                  </div>
                  {hasStudy ? (
                    <>
                      <p className="contribution-arc-tooltip-total">
                        {formatStudyTimeJa(hoveredArcCell.day.minutes)} {t("学習")}
                      </p>
                      <ul className="contribution-arc-tooltip-list">
                        {hoveredArcDayLogs.slice(0, 4).map((log) => (
                          <li key={log.id}>
                            <i style={{ background: log.color || "rgba(31,111,74,0.7)" }} />
                            <span>{log.subject}</span>
                            <small>{formatStudyTime(log.minutes)}</small>
                          </li>
                        ))}
                        {hoveredArcDayLogs.length > 4 ? (
                          <li className="contribution-arc-tooltip-more">
                            {t("ほか {count} 件", { count: hoveredArcDayLogs.length - 4 })}
                          </li>
                        ) : null}
                      </ul>
                    </>
                  ) : null}
                  {hasCommits ? (
                    <p className="contribution-arc-tooltip-commits">
                      <i aria-hidden="true" />
                      <span>{hoveredCommits} commit</span>
                    </p>
                  ) : null}
                  {hasStudy ? (
                    <p className="contribution-arc-tooltip-exp">
                      +{Math.round((hoveredArcCell.day.minutes / 60) * 80)} EXP
                    </p>
                  ) : null}
                  {!hasStudy && !hasCommits ? (
                    <p className="contribution-arc-tooltip-empty">{t("記録なし")}</p>
                  ) : null}
                </div>
              );
            })() : null}
            {contributionArc.weeks.map((week, wIndex) => (
              <div className="contribution-arc-week" key={wIndex}>
                <span className="contribution-arc-month">{week.monthLabel || ""}</span>
                {week.days.map((day, dIndex) => {
                  if (!day) {
                    return (
                      <span key={dIndex} className="contribution-arc-cell empty" aria-hidden="true" />
                    );
                  }
                  const githubInfo = githubByKey.get(day.key);
                  const githubLevel = githubInfo?.level ?? 0;
                  const commitCount = githubInfo?.count ?? 0;
                  const displayLevel = (
                    githubContributionArc ? Math.max(day.level, githubLevel) : day.level
                  ) as 0 | 1 | 2 | 3 | 4;
                  const ariaParts: string[] = [];
                  if (day.minutes > 0) ariaParts.push(formatStudyTime(day.minutes));
                  if (commitCount > 0) ariaParts.push(`${commitCount}${t("コミット")}`);
                  const ariaLabel = `${day.date.getMonth() + 1}${t("月")}${day.date.getDate()}${t("日")} ${
                    ariaParts.length > 0 ? ariaParts.join(" / ") : t("記録なし")
                  }`;
                  return (
                    <button
                      type="button"
                      key={dIndex}
                      className={`contribution-arc-cell lv-${displayLevel}${day.isToday ? " today" : ""}${
                        selectedArcDayKey === day.key ? " selected" : ""
                      }`}
                      onClick={() =>
                        setSelectedArcDayKey((prev) => (prev === day.key ? null : day.key))
                      }
                      onMouseEnter={(event) => {
                        const placement = computeArcTooltipPlacement(event.currentTarget, day);
                        if (placement) setHoveredArcCell(placement);
                      }}
                      onMouseLeave={() => setHoveredArcCell(null)}
                      onFocus={(event) => {
                        const placement = computeArcTooltipPlacement(event.currentTarget, day);
                        if (placement) setHoveredArcCell(placement);
                      }}
                      onBlur={() => setHoveredArcCell(null)}
                      aria-label={ariaLabel}
                    />
                  );
                })}
              </div>
            ))}
            </div>
          </div>
        </div>
          <div className="contribution-arc-legend" aria-hidden="true">
            <span>{t("少")}</span>
            <i className="lv-0" />
            <i className="lv-1" />
            <i className="lv-2" />
            <i className="lv-3" />
            <i className="lv-4" />
            <span>{t("多")}</span>
          </div>
          {githubContributionArc ? (
            <div className="contribution-arc-github-stats">
              <span>
                {t("今週")} <strong>{githubContributionArc.thisWeekCount}</strong> commit
              </span>
              <span>
                {t("先週")} <strong>{githubContributionArc.lastWeekCount}</strong>
              </span>
              <span>
                {t("最長")} <strong>{githubContributionArc.longestStreak}{t("日")}</strong>
              </span>
            </div>
          ) : !githubUsername ? (
            <div className="contribution-arc-github-cta">
              <span>{t("GitHub を連携すると commit もこの図に重なります")}</span>
              <button
                type="button"
                className="contribution-arc-github-link-btn"
                onClick={handleLinkGithub}
                disabled={isLinkingGithub}
              >
                {isLinkingGithub ? t("連携中…") : t("GitHub を連携")}
              </button>
              {linkGithubError ? (
                <p className="contribution-arc-github-link-error">{linkGithubError}</p>
              ) : null}
            </div>
          ) : (
            <p className="contribution-arc-github-status">
              {githubContributionsError ? t("GitHub データの取得に失敗しました") : t("GitHub データを読み込み中…")}
            </p>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {donutDisplay.total > 0 ? (
            <motion.div
              key={donutDisplay.key}
              className={`contribution-arc-donut${donutDisplay.isDaily ? " is-daily" : ""}`}
              aria-label={donutDisplay.isDaily ? t("{label}の学習ジャンル配分", { label: donutDisplay.label }) : t("13週の学習ジャンル配分")}
              initial={{ opacity: 0, scale: 0.94, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotate: 6 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="contribution-arc-donut-chart">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                  <circle
                    cx="80"
                    cy="80"
                    r="56"
                    fill="none"
                    stroke="rgba(17, 24, 39, 0.06)"
                    strokeWidth="16"
                  />
                  {(() => {
                    const r = 56;
                    const circumference = 2 * Math.PI * r;
                    let cumulative = 0;
                    return donutDisplay.items.map((item, idx) => {
                      const dash = (item.minutes / donutDisplay.total) * circumference;
                      const seg = (
                        <circle
                          key={`${item.subject}-${idx}`}
                          cx="80"
                          cy="80"
                          r={r}
                          fill="none"
                          stroke={item.color}
                          strokeWidth="16"
                          strokeDasharray={`${dash} ${circumference - dash}`}
                          strokeDashoffset={-cumulative}
                          transform="rotate(-90 80 80)"
                        />
                      );
                      cumulative += dash;
                      return seg;
                    });
                  })()}
                </svg>
                <div className="contribution-arc-donut-center">
                  <small>{donutDisplay.label}</small>
                  <strong>{formatStudyTimeJa(donutDisplay.total)}</strong>
                  <span>{t("{n}ジャンル", { n: donutDisplay.items.length })}</span>
                </div>
              </div>
              <ul className="contribution-arc-donut-legend">
                {donutDisplay.items.map((item) => {
                  const pct = Math.round((item.minutes / donutDisplay.total) * 100);
                  const isEditing = editingDonutSubject === item.subject;
                  /* 「その他」は複数 subject の集約結果なのでリネーム
                     できない (どれを直すか曖昧) */
                  const isRenameable = item.subject !== "その他";
                  const commitRename = () => {
                    const draft = editingDonutDraft;
                    setEditingDonutSubject(null);
                    setEditingDonutDraft("");
                    if (draft && draft.trim() && draft.trim() !== item.subject) {
                      handleSubjectBulkRename(item.subject, draft);
                    }
                  };
                  return (
                    <li key={item.subject} className={isEditing ? "is-editing" : ""}>
                      <i style={{ background: item.color }} aria-hidden="true" />
                      {isEditing ? (
                        <input
                          type="text"
                          className="legend-name-input"
                          value={editingDonutDraft}
                          autoFocus
                          maxLength={60}
                          onChange={(event) => setEditingDonutDraft(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingDonutSubject(null);
                              setEditingDonutDraft("");
                            }
                          }}
                          aria-label={t("{subject}の名前を編集", { subject: item.subject })}
                        />
                      ) : (
                        <strong className="legend-name">{item.subject}</strong>
                      )}
                      <span className="legend-pct">{pct}%</span>
                      <span className="legend-time">{formatStudyTimeJa(item.minutes)}</span>
                      {isRenameable && !isEditing ? (
                        <button
                          type="button"
                          className="legend-edit-button"
                          onClick={() => {
                            setEditingDonutSubject(item.subject);
                            setEditingDonutDraft(item.subject);
                          }}
                          aria-label={t("{subject}の名前を編集", { subject: item.subject })}
                          title={t("名前を編集")}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {donutDisplay.isDaily ? (
                <button
                  type="button"
                  className="contribution-arc-donut-reset"
                  onClick={() => setSelectedArcDayKey(null)}
                  aria-label={t("13週合計に戻す")}
                >
                  {t("13週合計に戻す")}
                </button>
              ) : null}
            </motion.div>
          ) : donutDisplay.isDaily ? (
            <motion.div
              key={donutDisplay.key}
              className="contribution-arc-donut is-daily is-empty-daily"
              aria-label={t("{label}の学習ジャンル配分（記録なし）", { label: donutDisplay.label })}
              initial={{ opacity: 0, scale: 0.94, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotate: 6 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="contribution-arc-donut-chart">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                  <circle
                    cx="80"
                    cy="80"
                    r="56"
                    fill="none"
                    stroke="rgba(17, 24, 39, 0.06)"
                    strokeWidth="16"
                  />
                </svg>
                <div className="contribution-arc-donut-center">
                  <small>{donutDisplay.label}</small>
                  <strong>{t("0時間")}</strong>
                  <span>{t("学習記録なし")}</span>
                </div>
              </div>
              <p className="contribution-arc-donut-empty-note">{t("この日はまだ学習が記録されていません。")}</p>
              <button
                type="button"
                className="contribution-arc-donut-reset"
                onClick={() => setSelectedArcDayKey(null)}
                aria-label={t("13週合計に戻す")}
              >
                {t("13週合計に戻す")}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty-all"
              className="contribution-arc-donut empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <p>{t("学習を記録するとここにジャンル分布が現れます。")}</p>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        {selectedArcDay ? (
          <div className="contribution-arc-detail" role="region" aria-label={t("選択日の学習詳細")}>
            <div className="contribution-arc-detail-head">
              <div>
                <strong>
                  {t("{year}年 {month}月{day}日", { year: selectedArcDay.date.getFullYear(), month: selectedArcDay.date.getMonth() + 1, day: selectedArcDay.date.getDate() })}
                </strong>
                <span>
                  {selectedArcDay.minutes > 0
                    ? t("{duration} 学習", { duration: formatStudyTimeJa(selectedArcDay.minutes) })
                    : t("学習記録なし")}
                </span>
              </div>
              <button
                type="button"
                className="contribution-arc-detail-close"
                onClick={() => setSelectedArcDayKey(null)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </div>
            {selectedArcDaySubjectTotals && selectedArcDaySubjectTotals.items.length > 0 ? (
              <ul className="contribution-arc-detail-list">
                {selectedArcDaySubjectTotals.items.map((entry, index) => (
                  <li key={`${entry.subject}-${index}`}>
                    <span
                      className="contribution-arc-detail-dot"
                      style={{ background: entry.color || "rgba(31,111,74,0.7)" }}
                      aria-hidden="true"
                    />
                    <strong>{entry.subject}</strong>
                    <small>{formatStudyTime(entry.minutes)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="contribution-arc-detail-empty">{t("この日はまだ記録がありません。")}</p>
            )}
          </div>
        ) : null}
      </section>
  );

  // FEED extracted into a standalone block so it can live in the permanent
  // right pane of the two-pane shell (always visible regardless of currentView).
  // The shape mirrors the prior in-home-screen IIFE: build an author lookup,
  // merge posts + workspace recruitments, optionally filter to following, then
  // render composer + tabs + list.
  const feedSection = (() => {
    const authorLookup = new Map<string, RecruitmentAuthor>();
    if (currentUser?.uid) {
      authorLookup.set(currentUser.uid, {
        userId: currentUser.uid,
        displayName: playerName,
        avatar: playerAvatar,
        characterColor: playerCharacterColor,
      });
    }
    posts.forEach((post) => {
      if (!authorLookup.has(post.userId)) {
        authorLookup.set(post.userId, {
          userId: post.userId,
          displayName: post.username || "Builder",
          avatar: post.avatar || undefined,
          characterColor: post.characterColor || undefined,
        });
      }
    });
    friends.forEach((friend) => {
      if (!authorLookup.has(friend.uid)) {
        authorLookup.set(friend.uid, {
          userId: friend.uid,
          displayName: friend.name || "Builder",
          avatar: friend.avatar || undefined,
        });
      }
    });

    const followingSet = new Set(following);
    if (currentUser?.uid) {
      followingSet.add(currentUser.uid);
    }

    type FeedEntry =
      | { kind: "post"; id: string; createdAt: string; post: ContributionPostRecord }
      | { kind: "recruitment"; id: string; createdAt: string; recruitment: WorkspaceRecruitmentRecord };

    const allEntries: FeedEntry[] = [
      ...posts
        /* 旧スタイル「学習の記録」カード (postType === "auto-study" の
           subject 無しレガシー) はもう描画しない。新しい学習記録は
           postType="manual" + subject で Studyplus 風 inset で出る。
           subject が付いている新型の auto-study は念のため残す。 */
        .filter((post) => !(post.postType === "auto-study" && !post.subject))
        .map((post) => ({ kind: "post" as const, id: post.id, createdAt: post.createdAt, post })),
      ...workspaceRecruitments.map((recruitment) => ({
        kind: "recruitment" as const,
        id: recruitment.id,
        createdAt: recruitment.createdAt,
        recruitment,
      })),
    ];

    const scopeFiltered =
      timelineFilter === "following"
        ? allEntries.filter((entry) =>
            followingSet.has(entry.kind === "post" ? entry.post.userId : entry.recruitment.userId),
          )
        : allEntries;

    /* 種別フィルタは廃止 — 全部 1 つのフィードに流す方針に変更。
       手動 / auto-study / auto-workspace / recruitment 全て表示。 */
    const filtered = scopeFiltered;

    const sorted = filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return (
      <section className="home-feed-section" aria-label={t("投稿")}>
        <header className="home-feed-head">
          <div>
            <p className="card-kicker">{t("投稿")}</p>
            <h2>{t("みんなと学びを共有・作業仲間を募集")}</h2>
          </div>
          <span>{t("{count} 件", { count: sorted.length.toLocaleString() })}</span>
        </header>

        <section
          className="home-feed-composer is-living"
          aria-label={t("投稿を作成")}
        >
          <form className="log-composer" onSubmit={(event) => void handlePostSubmit(event)}>
            <ProfileCharacterPreview color={playerCharacterColor} />
            <div>
              <textarea
                value={postDraft}
                onChange={(event) => {
                  setPostDraft(event.target.value);
                  setPostError("");
                }}
                placeholder={t("What are you building tonight?")}
                maxLength={280}
                rows={1}
              />
              <div className="log-composer-footer">
                {/* 旧 shortcuts (学習を記録 / Roomから作成 / 学習ログから作成)
                    はユーザー要望で撤去。投稿は自由入力 + 「投稿」ボタンのみで完結。 */}
                <CharCountRing value={postDraft.length} max={280} />
                <button type="submit" disabled={isPosting || !postDraft.trim()}>
                  {isPosting ? t("Posting") : t("投稿")}
                </button>
              </div>
              {postError ? <p className="log-post-error">{postError}</p> : null}
            </div>
          </form>
        </section>

        {/* 旧「投稿 / 学習の記録」種別セグメントは廃止。全て 1 つのフィードに統合。 */}

        <div className="timeline-filter-tabs" role="tablist" aria-label={t("フィードの表示範囲")}>
          <button
            type="button"
            role="tab"
            aria-selected={timelineFilter === "following"}
            className={`timeline-filter-tab${timelineFilter === "following" ? " is-active" : ""}`}
            onClick={() => setTimelineFilter("following")}
          >
            Following
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={timelineFilter === "all"}
            className={`timeline-filter-tab${timelineFilter === "all" ? " is-active" : ""}`}
            onClick={() => setTimelineFilter("all")}
          >
            All
          </button>
        </div>

        <div className="home-feed-list">
          {sorted.length > 0 ? (
            sorted.map((entry) =>
              entry.kind === "post" ? (
                <Fragment key={`post-${entry.id}`}>{postCard(entry.post)}</Fragment>
              ) : (
                <WorkspaceRecruitmentFeedCard
                  key={`recruitment-${entry.id}`}
                  recruitment={entry.recruitment}
                  author={authorLookup.get(entry.recruitment.userId) || null}
                  now={feedNowTick}
                  currentUserId={currentUser?.uid || ""}
                  onJoin={(rec) => {
                    handleJoinRecruitment(rec);
                    const nowMs = Date.now();
                    const startAtMs = new Date(rec.startAt).getTime();
                    if (nowMs >= startAtMs) {
                      setSelectedRoomId(rec.roomId);
                      setCurrentView("workspace");
                    }
                  }}
                  onCancel={handleCancelRecruitment}
                  onAuthorOpen={(author) => {
                    const friend = friends.find((f) => f.uid === author.userId);
                    if (friend) handleFriendOpen(friend);
                  }}
                />
              ),
            )
          ) : (
            <article className="log-empty-card">
              <p className="card-kicker">
                {timelineFilter === "following" ? "Following" : "Quiet Progress"}
              </p>
              <strong>
                {timelineFilter === "following"
                  ? t("フォロー中の投稿はまだありません。")
                  : t("まだ投稿はありません。")}
              </strong>
              <span>
                {timelineFilter === "following"
                  ? t("気になるエンジニアをフォローすると、ここに学びと作業部屋の募集が流れます。")
                  : t("今日作っているもの、学んだこと、作業部屋の募集が静かに流れます。")}
              </span>
            </article>
          )}
        </div>
      </section>
    );
  })();

  return (
    <MotionConfig reducedMotion="user">
    <motion.main
      className={isDesktopApp ? "app-shell premium-shell desktop-shell" : "app-shell premium-shell"}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SOFT}
    >
      <div ref={spotlightRef} className="cursor-spotlight" aria-hidden="true">
        <div className="cursor-spotlight-aura" />
        <div className="cursor-spotlight-core" />
        <div className="cursor-spotlight-ripple" />
      </div>
      {isDesktopApp ? (
        <header className="desktop-app-header" aria-label="Contribution Arc desktop header">
          <div className="desktop-app-brand">
            <span className="desktop-app-logo" aria-hidden="true">
              <ContributionArcLogo />
            </span>
            <span>
              <strong>Contribution Arc</strong>
              <small>Quiet developer workspace</small>
            </span>
          </div>

          <div className="desktop-app-context">
            <span>{activeRoom ? "In room" : "Viewing"}</span>
            <strong>{activeRoom?.name || selectedRoom?.name || t("作業部屋")}</strong>
          </div>

          <div className="desktop-app-actions">
            <span className="desktop-status-pill">
              <i aria-hidden="true" />
              {activeRoom ? `${formatStayTime(currentStayMinutes, language)} focused` : `${roomOnlineCount} online`}
            </span>
            <span className="desktop-github-pill">{githubConnectionLabel}</span>
            <button type="button" onClick={handleSettingsOpen}>
              {t("プロフィール")}
            </button>
          </div>
        </header>
      ) : null}

      {isDesktopApp && isDesktopWelcomeVisible ? (
        <div className="desktop-welcome-toast" role="status" aria-live="polite">
          Welcome back, {playerName}.
        </div>
      ) : null}

      {onboardingStep === "language" ? (
        <div className="onboarding-language-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-language-title">
          <section className="onboarding-language-card">
            <p className="card-kicker">Contribution Arc</p>
            <h1 id="onboarding-language-title">{t("言語を選択")}</h1>
            <p className="onboarding-language-lead">
              {t("アプリで使う言語を選んでください。後から設定で変更できます。")}
            </p>
            <div className="onboarding-language-options">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`onboarding-language-option${language === lang ? " is-active" : ""}`}
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                >
                  <span className="onboarding-language-option-native">{LANGUAGE_LABELS[lang].native}</span>
                  <span className="onboarding-language-option-english">{LANGUAGE_LABELS[lang].english}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="onboarding-language-cta"
              onClick={() => completeLanguageOnboarding(language)}
            >
              {t("この言語で続ける")}
            </button>
          </section>
        </div>
      ) : null}

      {onboardingStep === "welcome" ? (
        <div className="onboarding-welcome" role="status" aria-live="polite">
          <section>
            <p className="card-kicker">Contribution Arc</p>
            <h1>{t("ようこそContribution Arcへ")}</h1>
            <span>{t("最初にあなたのプロフィールを整えます。")}</span>
          </section>
        </div>
      ) : null}

      {/* Final onboarding step. A full-screen blocking modal: the user
          must write a greeting AND their 決意 before any other operation
          is possible. The backdrop sits above every other UI layer
          (FAB / HUD etc.) so nothing else is interactable until they post. */}
      {onboardingStep === "firstPost" ? (
        <div
          className="onboarding-firstpost-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-firstpost-title"
        >
          <form
            className="onboarding-firstpost-card"
            onSubmit={(event) => {
              event.preventDefault();
              const greeting = onboardingGreeting.trim();
              const resolve = onboardingResolve.trim();
              if (!greeting || !resolve) {
                setPostError(t("あいさつと決意の両方を入力してください。"));
                return;
              }
              void handlePostSubmit(undefined, `${greeting}\n\n${resolve}`);
            }}
          >
            <p className="card-kicker">{t("チュートリアル · 最後のステップ")}</p>
            <h1 id="onboarding-firstpost-title">{t("あいさつと、あなたの決意")}</h1>
            <p className="onboarding-firstpost-lead">
              {t("最初の一歩として、あいさつとこれからの決意を書いて投稿しましょう。")}
              {t("投稿するまで他の操作はできません。")}
            </p>

            <label className="onboarding-firstpost-field">
              <span>{t("あいさつ")}</span>
              <input
                type="text"
                value={onboardingGreeting}
                onChange={(event) => {
                  setOnboardingGreeting(event.target.value);
                  setPostError("");
                }}
                placeholder={t("初めまして！")}
                maxLength={40}
                autoFocus
              />
            </label>

            <label className="onboarding-firstpost-field">
              <span>{t("あなたの決意")}</span>
              <textarea
                value={onboardingResolve}
                onChange={(event) => {
                  setOnboardingResolve(event.target.value);
                  setPostError("");
                }}
                placeholder={t("これから挑戦したいこと・続けたいこと（例: 毎日少しでもコミットを積み上げる）")}
                maxLength={200}
                rows={3}
              />
            </label>

            {postError ? (
              <p className="onboarding-firstpost-error" role="alert">
                {postError}
              </p>
            ) : null}

            <button
              type="submit"
              className="onboarding-firstpost-cta"
              disabled={
                isPosting || !onboardingGreeting.trim() || !onboardingResolve.trim()
              }
            >
              {isPosting ? t("送信中…") : t("この決意を投稿して始める")}
            </button>
          </form>
        </div>
      ) : null}

      {/* チュートリアル後半：今日やることを書かせる。これを越えれば
          onboarding-complete マークが立って通常のアプリ操作に入る。
          1 行でも OK の軽い負荷にして "毎日の最初の一歩" を体験させる。 */}
      {onboardingStep === "firstDailyPlan" ? (
        <div
          className="onboarding-firstpost-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-firstplan-title"
        >
          <form
            className="onboarding-firstpost-card"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOnboardingFirstPlanSubmit();
            }}
          >
            <p className="card-kicker">{t("チュートリアル · 1 日を始める")}</p>
            <h1 id="onboarding-firstplan-title">{t("今日やることを 1 行で書こう")}</h1>
            <p className="onboarding-firstpost-lead">
              {t("日報の「今日やること」として残ります。")}
              <br />
              {t("短くて OK。書いてから 1 日が始まります。")}
              <br />
              <small>{t("※ 1 日の終わりには「振り返り」も書けます (任意)。")}</small>
            </p>

            <label className="onboarding-firstpost-field">
              <span>{t("今日やること")}</span>
              <textarea
                value={onboardingFirstPlanDraft}
                onChange={(event) => {
                  setOnboardingFirstPlanDraft(event.target.value);
                  setOnboardingFirstPlanError("");
                }}
                placeholder={t("例: DDIA Ch.7 を読み切る / API の設計をまとめる")}
                maxLength={300}
                rows={3}
                autoFocus
              />
            </label>

            {onboardingFirstPlanError ? (
              <p className="onboarding-firstpost-error" role="alert">
                {onboardingFirstPlanError}
              </p>
            ) : null}

            <button
              type="submit"
              className="onboarding-firstpost-cta"
              disabled={isSavingOnboardingFirstPlan || !onboardingFirstPlanDraft.trim()}
            >
              {isSavingOnboardingFirstPlan ? t("保存中…") : t("今日を始める")}
            </button>
          </form>
        </div>
      ) : null}

      <div className="app-main-panel">
      <motion.header
        className="site-header premium-dashboard-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.06 }}
      >
        <nav className="topbar-nav" aria-label="Main navigation">
          <button
            type="button"
            className={currentView === "home" ? "is-active" : ""}
            onClick={() => setCurrentView("home")}
          >
            {t("ホーム")}
          </button>
          {/* 作業部屋を「ホームの直後」=動線上で必ず通る位置に移動。
              在室者がいるときは小さなドットとカウントを添えて、
              「今、誰かが居る」気配を静かに伝える（煽らない）。 */}
          <button
            type="button"
            className={`workspace-tab${currentView === "workspace" ? " is-active" : ""}${
              activeMembers.length > 0 ? " has-presence" : ""
            }`}
            onClick={() => setCurrentView("workspace")}
          >
            {activeMembers.length > 0 ? (
              <span className="topbar-presence-dot" aria-hidden="true" />
            ) : null}
            <span className="workspace-tab-label">{t("作業部屋")}</span>
            {activeMembers.length > 0 ? (
              <span
                className="topbar-presence-count"
                aria-label={t("現在 {count} 人が作業中", { count: activeMembers.length })}
              >
                · {activeMembers.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={currentView === "learning" ? "is-active" : ""}
            onClick={() => setCurrentView("learning")}
          >
            {t("ライブラリ")}
          </button>
          <button
            type="button"
            className={currentView === "daily" ? "is-active" : ""}
            onClick={() => setCurrentView("daily")}
          >
            {t("日報")}
          </button>
        </nav>

        <div className="topbar-context">
          {/* Phase 10d: トップバーから直接記録を開く. 静的テキストを
              そのままボタン化し、左にプラスのグリフ、右に「今日 1h30m」
              を出す. 0 分のときも「+ 記録」だけ出して、毎日の初回も
              ひと目で記録できる位置に置く. 煽らない控えめなトーン. */}
          <button
            type="button"
            className={`topbar-quicklog${todayStudyMinutes > 0 ? " has-progress" : ""}${isQuickLogPopoverOpen ? " is-open" : ""}`}
            onClick={toggleQuickLogPopover}
            aria-expanded={isQuickLogPopoverOpen}
            aria-label={
              todayStudyMinutes > 0
                ? t("クイック記録 — 今日 {duration} 学習", { duration: formatStudyTimeJa(todayStudyMinutes) })
                : t("クイック記録")
            }
          >
            <span className="topbar-quicklog-icon" aria-hidden="true">
              +
            </span>
            <span className="topbar-quicklog-label">
              {todayStudyMinutes > 0
                ? t("今日 {duration}", { duration: formatStudyTimeJa(todayStudyMinutes) })
                : t("記録する")}
            </span>
          </button>
          {/* 平日連続記録. 煽らず静かに数字だけ出す. 0 のときは何も
              出さない(プレッシャーにしない). 今日まだ未記録なら淡く,
              記録済みなら少しだけ濃く. 土日は数字を据え置きで「対象外」を
              ツールチップで補足. */}
          {weekdayStreak.current > 0 ? (
            <span
              className={`topbar-streak${weekdayStreak.todayCounts ? " is-active" : ""}`}
              title={
                weekdayStreak.todayIsWeekend
                  ? t("平日連続記録 {n}日(土日は対象外)", { n: String(weekdayStreak.current) })
                  : weekdayStreak.todayCounts
                    ? t("平日連続記録 {n}日 — 今日も記録済み", { n: String(weekdayStreak.current) })
                    : t("平日連続記録 {n}日 — 今日はまだ記録なし", { n: String(weekdayStreak.current) })
              }
              aria-label={t("平日連続記録 {n}日", { n: String(weekdayStreak.current) })}
            >
              <span className="topbar-streak-dot" aria-hidden="true" />
              <span className="topbar-streak-num">{weekdayStreak.current}</span>
              <span className="topbar-streak-unit">{t("日")}</span>
            </span>
          ) : null}
        </div>

        <div className="user-session">
          {/* 旧トップバー右側のアイコン群（管理 / FEED / 作業部屋 / ショップ /
              フレンド / ライブ / 検索 / 通知）は撤去し、すべてアバターの
              ユーザーメニューに集約した。スマホの bottom-nav に倣い、PC でも
              トップバーはコンテキスト＋アバターのみのミニマル構成にする。
              検索・通知パネルは引き続きここに（トリガー無しで）描画し、
              メニュー項目から isSearchOpen / isNotificationsOpen を立てて開く。 */}

          {/* 検索パネルはトリガー無しでここに描画。アバターメニューの
              「ユーザーを探す」項目（または ⌘K）で isSearchOpen を立てて開く。
              開いたときはバックドロップ付きの中央モーダルとして全画面に
              オーバーレイする (旧 topbar 内 popover はモバイル profile 画面
              からだと top-right に隠れて気付かれない問題があった)。 */}
          {isSearchOpen ? (
            <div
              className="user-search-modal-backdrop"
              role="presentation"
              onClick={() => setIsSearchOpen(false)}
            >
              <div className="topbar-popover-wrap topbar-popover-wrap-search topbar-popover-wrap-headless" ref={searchPopoverRef}>
                <section
                  className="topbar-popover topbar-popover-search is-modal"
                  aria-label={t("ユーザーを探す")}
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                <div className="topbar-popover-head">
                  <p className="card-kicker">User Search</p>
                  <strong>{t("ユーザーを探す")}</strong>
                </div>
                <form className="topbar-search-form" onSubmit={handleUserSearch}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value.toLowerCase())}
                    placeholder="ari.dev"
                    maxLength={30}
                    autoFocus
                    aria-label={t("ユーザーID")}
                  />
                  <button type="submit" disabled={isSearching}>
                    {isSearching ? "…" : t("検索")}
                  </button>
                </form>
                {!userId ? (
                  <p className="topbar-popover-empty-text">
                    {t("フォロー機能を使うには、設定から自分のユーザーIDを登録してください。")}
                  </p>
                ) : null}
                {searchError ? (
                  <p className="topbar-popover-empty-text" role="alert">
                    {searchError}
                  </p>
                ) : null}
                {searchResults.length > 0 ? (
                  <div className="topbar-popover-list">
                    {searchResults.slice(0, 6).map((profile) => {
                      const isFriend = friends.some((friend) => friend.uid === profile.uid);
                      const isPending = friendRequests.some(
                        (request) =>
                          request.profile.uid === profile.uid &&
                          request.status === "pending",
                      );
                      return (
                        <button
                          type="button"
                          key={profile.uid}
                          className="topbar-popover-row"
                          onClick={() => {
                            handleUserProfileOpen(profile);
                            setIsSearchOpen(false);
                          }}
                        >
                          <span className="topbar-popover-avatar">
                            {profile.photoURL ? (
                              <img src={profile.photoURL} alt="" />
                            ) : (
                              (profile.displayName || profile.userId || "?").slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span>
                            <strong>{profile.displayName || profile.userId}</strong>
                            <small>
                              @{profile.userId}
                              {isFriend ? ` · ${t("フレンド")}` : isPending ? ` · ${t("申請中")}` : ""}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                </section>
              </div>
            </div>
          ) : null}
          {/* 通知パネルもトリガー無しで描画。アバターメニューの「お知らせ」
              項目から handleNotificationsToggle で開く（未読は同項目にバッジ）。 */}
          <div className="notification-wrap notification-wrap-headless" ref={notificationsWrapRef}>
            {isNotificationsOpen ? (
              <section className="notification-panel" aria-label={t("お知らせ")}>
                <div className="notification-head">
                  <p className="card-kicker">Notifications</p>
                  <strong>{t("お知らせ")}</strong>
                </div>

                <div className="notification-list">
                  {notificationFeedItems.length > 0 ? (
                    notificationFeedItems.map((item) => {
                      const friendRequest = friendRequests.find(
                        (request) => item.id === `friendRequest:${request.id}`,
                      );
                      const workspaceInvite = incomingInvites.find(
                        (invite) => item.id === `workspaceInvite:${invite.id}`,
                      );
                      const sourceProfile = friendRequest?.profile || workspaceProfiles[item.sourceUserId];

                      return (
                      <article key={item.id} className={item.read ? "notification-item" : "notification-item unread"}>
                        <button
                          type="button"
                          onClick={() => {
                            if (sourceProfile) {
                              handleUserProfileOpen(sourceProfile);
                              return;
                            }

                            if (item.type === "dailyLog") {
                              setCurrentView("daily");
                            } else {
                              setCurrentView("logs");
                            }
                          }}
                        >
                          {sourceProfile ? (
                            (() => {
                              const look = resolveAuthorAppearance(
                                item.sourceUserId,
                                sourceProfile.characterColor,
                                sourceProfile.characterShape,
                              );
                              return <ProfileCharacterPreview color={look.color} shape={look.shape} />;
                            })()
                          ) : (
                            <span className="notification-avatar">
                              {item.title.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                            <small>
                              {getNotificationSourceText(item.type, t)} ·{" "}
                              {new Date(item.createdAt).toLocaleString("ja-JP", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </span>
                        </button>
                        {friendRequest?.direction === "incoming" && friendRequest.status === "pending" ? (
                          <div className="notification-friend-actions">
                            <button
                              type="button"
                              className="notification-accept"
                              onClick={(event) => handleNotificationFriendAccept(event, friendRequest)}
                            >
                              {t("承認")}
                            </button>
                            <button
                              type="button"
                              className="notification-decline"
                              onClick={(event) => handleNotificationFriendReject(event, friendRequest)}
                              aria-label={t("フレンド申請を拒否")}
                            >
                              {t("拒否")}
                            </button>
                          </div>
                        ) : null}
                        {workspaceInvite ? (
                          <button
                            type="button"
                            className="notification-accept"
                            onClick={(event) => handleNotificationInviteAccept(event, workspaceInvite)}
                          >
                            {t("参加")}
                          </button>
                        ) : null}
                      </article>
                    );
                    })
                  ) : (
                    <p className="notification-empty">{t("新しいお知らせはありません。")}</p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
          <div className="user-menu-wrap" ref={userMenuRef}>
            <button
              type="button"
              className={`user-menu-button${isUserMenuOpen ? " open" : ""}`}
              aria-label={t("アカウントメニュー")}
              aria-expanded={isUserMenuOpen}
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
            >
              {playerAvatar ? (
                <img src={playerAvatar} alt="" />
              ) : (
                <span>{playerInitial}</span>
              )}
            </button>
            {isUserMenuOpen ? (
              <div className="user-menu-panel" role="menu">
                <div className="user-menu-head">
                  <span className="user-menu-avatar">
                    {playerAvatar ? <img src={playerAvatar} alt="" /> : playerInitial}
                  </span>
                  <span>
                    <strong>{playerName}</strong>
                    <small>@{userId || t("未設定")}</small>
                    {currentUser?.email ? (
                      <small className="user-menu-email" title={t("サインイン中のアカウント")}>
                        {currentUser.email}
                      </small>
                    ) : null}
                  </span>
                </div>

                {/* === トップバーから移設したハブ項目 ===
                    管理 / 作業部屋 / ショップ / フレンド / ライブ / 検索 /
                    通知 / フィード表示 をここに集約。旧アイコン群は撤去済み。 */}
                {currentOrganization && currentUser?.uid === currentOrganization.ownerUid ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setCurrentView("manager");
                    }}
                  >
                    <svg className="user-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <rect x="3" y="6" width="8" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" rx="0.5" />
                      <rect x="13" y="6" width="8" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" rx="0.5" />
                      <circle cx="7" cy="10.5" r="1.2" fill="currentColor" />
                      <circle cx="17" cy="10.5" r="1.2" fill="currentColor" />
                      <path d="M7 12.5v3 M17 12.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span>{t("管理")}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setCurrentView("workspace");
                  }}
                >
                  <svg className="user-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <span>{t("作業部屋")}</span>
                  {activeMembers.length > 0 ? (
                    <span className="user-menu-badge">{activeMembers.length}</span>
                  ) : null}
                </button>

                {!IS_IOS_BUILD ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setCurrentView("shop");
                    }}
                  >
                    <svg className="user-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M5 8h14l-1.1 11.2a1.6 1.6 0 0 1-1.6 1.5H7.7a1.6 1.6 0 0 1-1.6-1.5L5 8z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 8V6.4a3 3 0 0 1 6 0V8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>{t("ショップ")}</span>
                    {coins > 0 ? (
                      <span className="user-menu-badge user-menu-badge-coins">{coins.toLocaleString()}</span>
                    ) : null}
                  </button>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsFriendsModalOpen(true);
                  }}
                >
                  <svg className="user-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="16.5" cy="9" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3 19c1-3 3.4-4.6 6-4.6s5 1.6 6 4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M14.6 19c.8-2.4 2.5-3.6 4.4-3.6s3.6 1.2 4.4 3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span>{t("フレンド")}</span>
                  {sidebarFriends.length > 0 ? (
                    <span className="user-menu-badge">{sidebarFriends.length}</span>
                  ) : null}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                >
                  <svg
                    className="user-menu-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <line x1="20" y1="20" x2="15.5" y2="15.5" />
                  </svg>
                  <span>{t("ユーザーを探す")}</span>
                  <em className="user-menu-hint" aria-hidden="true">⌘K</em>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (!isNotificationsOpen) {
                      handleNotificationsToggle();
                    } else {
                      setIsNotificationsOpen(true);
                    }
                  }}
                >
                  <BellIcon />
                  <span>{t("お知らせ")}</span>
                  {unreadNotificationCount > 0 ? (
                    <span className="user-menu-badge user-menu-badge-unread">{unreadNotificationCount}</span>
                  ) : null}
                </button>

                <div className="user-menu-separator" aria-hidden="true" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setCurrentView("profile");
                  }}
                >
                  <svg
                    className="user-menu-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{t("プロフィール")}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleSettingsOpen();
                  }}
                >
                  <SettingsIcon />
                  <span>{t("設定")}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (currentUser) {
                      resetAllTutorials(currentUser.uid);
                    }
                    // Bounce through home so any already-rendered view
                    // remounts and re-reads the (now cleared) flag.
                    setCurrentView("home");
                  }}
                >
                  <span aria-hidden="true">↻</span>
                  <span>{t("チュートリアルをもう一度")}</span>
                </button>
                <div className="user-menu-separator" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu-signout"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut(auth);
                  }}
                >
                  {t("ログアウト")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.header>

      {isBarcodeScanOpen ? (
        <BarcodeScannerModal
          onClose={() => setIsBarcodeScanOpen(false)}
          onDetected={(isbn) => void handleBookIsbnDetected(isbn)}
        />
      ) : null}

      {(() => {
        const recordItem = learningRecordItemId
          ? learningItems.find((it) => it.id === learningRecordItemId)
          : null;
        if (!recordItem) return null;
        return (
          <LearningRecordModal
            itemName={recordItem.name}
            itemColor={recordItem.color}
            category={recordItem.category}
            onClose={() => setLearningRecordItemId(null)}
            onSubmit={(values) => handleSaveLearningRecord(recordItem, values)}
            onEdit={() => {
              setLearningRecordItemId(null);
              setLearningDetailId(recordItem.id);
            }}
          />
        );
      })()}

      {learningEditorState ? (
        <div className="settings-modal-backdrop" role="presentation" onClick={closeLearningEditor}>
          <section
            className="settings-modal learning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="card-kicker">Learning Item</p>
              <h2 id="learning-modal-title">
                {learningEditorState.mode === "create" ? t("学習対象を追加") : t("学習対象を編集")}
              </h2>
            </div>

            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleLearningEditorSave();
              }}
            >
              <label>
                <span>{t("名前")}</span>
                <input
                  value={learningEditorState.name}
                  onChange={(event) =>
                    setLearningEditorState((state) => (state ? { ...state, name: event.target.value } : state))
                  }
                  placeholder={t("DDIA / Go言語 など")}
                  maxLength={60}
                  autoFocus
                  required
                />
              </label>

              {/* 写真アイコン：教科書の表紙などを撮ってアイコンにする。
                  クライアントで 144px JPEG に圧縮して Firestore doc に
                  直接保存 (Storage 不使用)。 */}
              <div className="learning-photo-field">
                <span>{t("写真 (任意)")}</span>
                <div className="learning-photo-row">
                  <span
                    className={`learning-photo-preview${learningEditorState.photo ? " has-photo" : " is-fallback"}`}
                    style={
                      !learningEditorState.photo
                        ? ({ "--learning-thumb-color": learningEditorState.color } as CSSProperties)
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {learningEditorState.photo ? (
                      <img src={learningEditorState.photo} alt="" />
                    ) : null}
                  </span>
                  <div className="learning-photo-actions">
                    <label className="learning-photo-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          void fileToLearningPhotoDataUrl(file)
                            .then((dataUrl) => {
                              setLearningEditorState((state) =>
                                state ? { ...state, photo: dataUrl } : state,
                              );
                            })
                            .catch(() => {
                              showToast(t("画像を読み込めませんでした"), { kind: "error" });
                            });
                        }}
                      />
                      {learningEditorState.photo ? t("写真を変更") : t("写真を追加")}
                    </label>
                    {learningEditorState.photo ? (
                      <button
                        type="button"
                        className="learning-photo-remove"
                        onClick={() =>
                          setLearningEditorState((state) => (state ? { ...state, photo: "" } : state))
                        }
                      >
                        {t("削除")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <small className="learning-photo-hint">
                  {t("教科書の表紙などを撮ると、ライブラリでアイコンとして表示されます。")}
                </small>
              </div>

              <label className="learning-book-toggle">
                <input
                  type="checkbox"
                  checked={learningEditorState.category === "book"}
                  onChange={(event) =>
                    setLearningEditorState((state) =>
                      state ? { ...state, category: event.target.checked ? "book" : "stack" } : state,
                    )
                  }
                />
                <span>
                  <strong>{t("書籍として記録する")}</strong>
                  <small>{t("チェックするとページ数で進捗を追える")}</small>
                </span>
              </label>

              <div className="learning-color-panel">
                <span>{t("カラー")}</span>
                <div className="character-color-grid compact" aria-label={t("カラー")}>
                  {studyColorOptions.map((color) => (
                    <button
                      type="button"
                      key={color.value}
                      className={learningEditorState.color === color.value ? "active" : ""}
                      onClick={() =>
                        setLearningEditorState((state) => (state ? { ...state, color: color.value } : state))
                      }
                      title={color.name}
                      aria-label={t("{name}を選択", { name: color.name })}
                    >
                      <span style={{ background: color.value }} />
                      <small>{color.name}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="learning-status-field">
                <span>{t("ステータス")}</span>
                <div className="learning-status-segment" role="group" aria-label={t("ステータス")}>
                  {(
                    [
                      { value: "active" as const, label: t("学習中") },
                      { value: "done" as const, label: t("達成済み") },
                      { value: "paused" as const, label: t("休止中") },
                    ]
                  ).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={learningEditorState.status === option.value ? "active" : ""}
                      onClick={() =>
                        setLearningEditorState((state) => (state ? { ...state, status: option.value } : state))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {learningEditorState.category === "book" ? (
                <div className="learning-book-fields">
                  <label>
                    <span>{t("総ページ数")}</span>
                    <input
                      type="number"
                      min={0}
                      value={learningEditorState.totalPages}
                      onChange={(event) =>
                        setLearningEditorState((state) => (state ? { ...state, totalPages: event.target.value } : state))
                      }
                      placeholder={t("例: 600")}
                    />
                  </label>
                  <label>
                    <span>{t("現在のページ")}</span>
                    <input
                      type="number"
                      min={0}
                      value={learningEditorState.currentPages}
                      onChange={(event) =>
                        setLearningEditorState((state) => (state ? { ...state, currentPages: event.target.value } : state))
                      }
                      placeholder={t("例: 120")}
                    />
                  </label>
                </div>
              ) : null}

              <label className="learning-note-field">
                <span>{t("メモ")}</span>
                <textarea
                  value={learningEditorState.note}
                  onChange={(event) =>
                    setLearningEditorState((state) => (state ? { ...state, note: event.target.value } : state))
                  }
                  placeholder={t("学んでいる目的、今読んでいる章、次にやることなど")}
                  maxLength={280}
                  rows={3}
                />
              </label>

              <div className="learning-modal-actions">
                {learningEditorState.mode === "edit" ? (
                  <button
                    type="button"
                    className="learning-archive-button"
                    onClick={handleLearningEditorArchiveToggle}
                  >
                    {learningItems.find((item) => item.id === learningEditorState.itemId)?.archived
                      ? t("休止を解除")
                      : t("休止する")}
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <div className="learning-modal-actions-right">
                  <button type="button" className="learning-cancel-button" onClick={closeLearningEditor}>
                    {t("キャンセル")}
                  </button>
                  <button type="submit" className="learning-save-button">
                    {t("保存")}
                  </button>
                </div>
              </div>
            </form>

            {learningEditorState.mode === "edit" ? (
              <div className="learning-danger-zone" role="group" aria-label={t("危険な操作")}>
                <div className="learning-danger-zone-info">
                  <strong>{t("削除")}</strong>
                  <small>{t("この学習対象の登録を完全に削除します。学習ログ自体は残ります。")}</small>
                </div>
                {isLearningDeleteConfirming ? (
                  <div className="learning-danger-zone-confirm">
                    <button
                      type="button"
                      className="learning-delete-cancel"
                      onClick={() => setIsLearningDeleteConfirming(false)}
                    >
                      {t("やめる")}
                    </button>
                    <button
                      type="button"
                      className="learning-delete-confirm"
                      onClick={handleLearningEditorDelete}
                    >
                      {t("本当に削除する")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="learning-delete-trigger"
                    onClick={() => setIsLearningDeleteConfirming(true)}
                  >
                    {t("削除する")}
                  </button>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {learningDetailId ? (() => {
        // B-4 item detail view. Pure read over existing studyLogs — no
        // new Firestore reads. Resolves this item's logs via the same two
        // paths the card grid uses (learningItemId, else case-insensitive
        // subject match) so historical free-typed logs still count.
        const item = learningItems.find((entry) => entry.id === learningDetailId);
        if (!item) {
          return null;
        }
        const lowerName = item.name.trim().toLowerCase();
        const itemLogs = studyLogs
          .filter((log) =>
            log.learningItemId
              ? log.learningItemId === item.id
              : (log.subject || "").trim().toLowerCase() === lowerName,
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const totalMinutes = itemLogs.reduce((sum, log) => sum + log.minutes, 0);
        const dayMsLocal = 24 * 60 * 60 * 1000;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStartMs = today.getTime() - 6 * dayMsLocal;
        let thisWeekMinutes = 0;
        const loggedDays = new Set<string>();
        const dayKey = (date: Date) =>
          `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        itemLogs.forEach((log) => {
          const ts = new Date(log.createdAt);
          if (Number.isNaN(ts.getTime())) return;
          const midnight = new Date(ts);
          midnight.setHours(0, 0, 0, 0);
          loggedDays.add(dayKey(midnight));
          if (ts.getTime() >= weekStartMs) thisWeekMinutes += log.minutes;
        });
        const lastTs = itemLogs.length ? new Date(itemLogs[0].createdAt).getTime() : undefined;
        const lastLabel = formatLearningLastLogged(lastTs, today.getTime(), dayMsLocal, language);
        const status = item.status ?? "active";
        const isBook = item.category === "book";
        const hasProgress = isBook && typeof item.totalPages === "number" && item.totalPages > 0;
        const progressPercent = hasProgress
          ? Math.min(100, Math.round(((item.currentPages || 0) / (item.totalPages || 1)) * 100))
          : 0;
        const recentLogs = itemLogs.slice(0, 8);
        const closeDetail = () => {
          setLearningDetailId(null);
          setDetailLogMinutes("");
          setDetailLogHours("");
        };
        return (
          <div className="settings-modal-backdrop" role="presentation" onClick={closeDetail}>
            <section
              className="settings-modal learning-detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="learning-detail-title"
              style={{ "--learning-card-color": item.color } as CSSProperties}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="learning-detail-head">
                <div>
                  <p className="card-kicker">{isBook ? t("書籍") : "Learning Item"}</p>
                  <h2 id="learning-detail-title">{item.name}</h2>
                  <div className="learning-detail-badges">
                    {status === "done" ? (
                      <span className="learning-card-status is-done">{t("達成済み")}</span>
                    ) : status === "paused" ? (
                      <span className="learning-card-status is-paused">{t("休止中")}</span>
                    ) : (
                      <span className="learning-card-status is-active">{t("学習中")}</span>
                    )}
                    {item.archived ? (
                      <span className="learning-card-archived">{t("休止中")}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="learning-detail-close"
                  onClick={closeDetail}
                  aria-label={t("閉じる")}
                >
                  ×
                </button>
              </div>

              <div className="learning-detail-stats">
                <div>
                  <small>{t("累計")}</small>
                  <strong>{formatStudyTimeJa(totalMinutes)}</strong>
                </div>
                <div>
                  <small>{t("今週")}</small>
                  <strong>{formatStudyTimeJa(thisWeekMinutes)}</strong>
                </div>
                <div>
                  <small>{t("記録日数")}</small>
                  <strong>{t("{count}日", { count: loggedDays.size })}</strong>
                </div>
                <div>
                  <small>{t("最終記録")}</small>
                  <strong>{lastLabel}</strong>
                </div>
              </div>

              {hasProgress ? (
                <div className="learning-detail-progress">
                  <div className="learning-card-progress" aria-label={`${progressPercent}%`}>
                    <span style={{ width: `${progressPercent}%` }} />
                    <small>
                      {item.currentPages || 0}/{item.totalPages}p ({progressPercent}%)
                    </small>
                  </div>
                </div>
              ) : null}

              {item.note?.trim() ? (
                <p className="learning-detail-note">{item.note.trim()}</p>
              ) : null}

              <div className="learning-detail-section">
                <p className="learning-detail-section-title">{t("最近の記録")}</p>
                {recentLogs.length ? (
                  <ul className="learning-detail-logs">
                    {recentLogs.map((log) => {
                      const date = new Date(log.createdAt);
                      const dateLabel = Number.isNaN(date.getTime())
                        ? "—"
                        : `${date.getMonth() + 1}/${date.getDate()}`;
                      return (
                        <li key={log.id}>
                          <span className="learning-detail-log-date">{dateLabel}</span>
                          <span className="learning-detail-log-min">{formatStudyTimeJa(log.minutes)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="learning-detail-empty">{t("まだ記録なし")}</p>
                )}
              </div>

              <div className="learning-detail-actions">
                {!item.archived ? (() => {
                  /* 空欄は 0 扱いで時間 + 分を合算。どちらか一方だけでも記録可。 */
                  const detailHoursRaw = Number(detailLogHours);
                  const detailMinutesRaw = Number(detailLogMinutes);
                  const detailHoursPart =
                    detailLogHours.trim() === "" || !Number.isFinite(detailHoursRaw)
                      ? 0
                      : detailHoursRaw;
                  const detailMinutesPart =
                    detailLogMinutes.trim() === "" || !Number.isFinite(detailMinutesRaw)
                      ? 0
                      : detailMinutesRaw;
                  const detailMinutesValue = detailHoursPart * 60 + detailMinutesPart;
                  const canRecordDetail = detailMinutesValue > 0;
                  const submitDetailLog = () => {
                    if (!canRecordDetail) return;
                    handleLearningQuickLog(item, Math.round(detailMinutesValue));
                    setDetailLogMinutes("");
                    setDetailLogHours("");
                  };
                  return (
                    <div className="learning-detail-quicklog" role="group" aria-label={t("時間を指定して記録")}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        value={detailLogHours}
                        onChange={(event) => setDetailLogHours(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitDetailLog();
                          }
                        }}
                        placeholder="0"
                        aria-label={t("時間数")}
                      />
                      <span className="learning-detail-quicklog-unit">{t("時間")}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="59"
                        step="1"
                        value={detailLogMinutes}
                        onChange={(event) => setDetailLogMinutes(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitDetailLog();
                          }
                        }}
                        placeholder="30"
                        aria-label={t("分数")}
                      />
                      <span className="learning-detail-quicklog-unit">{t("分")}</span>
                      <button
                        type="button"
                        className="learning-detail-quicklog-submit"
                        onClick={submitDetailLog}
                        disabled={!canRecordDetail}
                      >
                        {t("記録")}
                      </button>
                    </div>
                  );
                })() : (
                  <span aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="learning-save-button"
                  onClick={() => {
                    closeDetail();
                    openLearningEditorForEdit(item);
                  }}
                >
                  {t("編集")}
                </button>
              </div>
            </section>
          </div>
        );
      })() : null}

      {/* === 投稿の詳細モーダル === */}
      {expandedPost ? (() => {
        const post = expandedPost;
        const isOwn = post.userId === currentUserUid;
        const replies = postReplies
          .filter((reply) => reply.postId === post.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const draftKey = post.id;
        const replyDraft = replyDrafts[draftKey] || "";
        return (
          <div
            className="post-detail-modal-backdrop"
            role="presentation"
            onClick={() => setExpandedPost(null)}
          >
            <section
              className="post-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="post-detail-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="post-detail-modal-head">
                <button
                  type="button"
                  className="post-detail-modal-back"
                  onClick={() => setExpandedPost(null)}
                  aria-label={t("閉じる")}
                >
                  ‹
                </button>
                <h2 id="post-detail-modal-title">{t("投稿")}</h2>
                {isOwn ? (
                  <button
                    type="button"
                    className="post-detail-modal-overflow"
                    onClick={() => {
                      handlePostDelete(post);
                      setExpandedPost(null);
                    }}
                    aria-label={t("投稿を削除")}
                    title={t("削除")}
                  >
                    ⋯
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </header>

              <div className="post-detail-modal-body">
                <div className="post-detail-author">
                  {(() => {
                    const look = resolveAuthorAppearance(
                      post.userId,
                      post.characterColor,
                      post.characterShape,
                    );
                    return <ProfileCharacterPreview color={look.color} shape={look.shape} />;
                  })()}
                  <span>
                    <strong>{post.username}</strong>
                    <small>{formatPostTime(post.createdAt)}</small>
                  </span>
                </div>

                {post.subject ? (
                  <div className="log-post-study-inset">
                    {post.itemPhoto ? (
                      <img
                        className="log-post-study-cover"
                        src={post.itemPhoto}
                        alt=""
                      />
                    ) : (
                      <div
                        className="log-post-study-cover is-empty"
                        style={{ background: post.characterColor || "rgba(0,0,0,0.06)" }}
                        aria-hidden="true"
                      >
                        {post.subject.slice(0, 1)}
                      </div>
                    )}
                    <div className="log-post-study-meta">
                      <strong className="log-post-study-subject">{post.subject}</strong>
                      <span className="log-post-study-time">
                        {formatStayTime(post.studyMinutes || 0, language)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {post.text && post.text.trim() && post.text.trim() !== post.subject ? (
                  <p className="post-detail-text">{post.text}</p>
                ) : null}

                {post.photo ? (
                  <img className="log-post-photo" src={post.photo} alt="" />
                ) : null}

                {/* コメント一覧 (全件) */}
                {replies.length > 0 ? (
                  <div className="post-detail-replies">
                    {replies.map((reply) => (
                      <article key={reply.id} className="post-detail-reply">
                        <strong>{reply.username}</strong>
                        <p>{reply.text}</p>
                        <time dateTime={reply.createdAt}>
                          {formatPostTime(reply.createdAt)}
                        </time>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="post-detail-empty">{t("まだ返信はありません。")}</p>
                )}
              </div>

              {/* コメント入力 */}
              <form
                className="post-detail-reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!replyDraft.trim()) return;
                  void handlePostReplySubmit(post);
                }}
              >
                <input
                  value={replyDraft}
                  onChange={(event) =>
                    setReplyDrafts((drafts) => ({ ...drafts, [draftKey]: event.target.value }))
                  }
                  placeholder={t("コメントを入力")}
                  maxLength={280}
                  aria-label={t("コメント")}
                />
                <button type="submit" disabled={!replyDraft.trim()}>
                  {t("送信")}
                </button>
              </form>
            </section>
          </div>
        );
      })() : null}

      {expandedDailyReport ? (() => {
        const report = expandedDailyReport;
        const isMine = report.userId === currentUserUid;
        const displayName =
          report.userName || (isMine ? playerName : "Developer");
        // studyLogsByDay / githubByKey are keyed as `Y-M-D` with 0-indexed
        // month. report.date arrives as "YYYY-MM-DD" so convert.
        const [yStr, mStr, dStr] = report.date.split("-");
        const dayKey = `${Number(yStr)}-${Number(mStr) - 1}-${Number(dStr)}`;
        const logsForDay = isMine ? studyLogsByDay.get(dayKey) || [] : [];
        const totalMinutes = logsForDay.reduce((sum, log) => sum + log.minutes, 0);
        const commitCount = isMine ? githubByKey.get(dayKey)?.count ?? 0 : 0;
        return (
          <div
            className="settings-modal-backdrop"
            role="presentation"
            onClick={() => setExpandedDailyReport(null)}
          >
            <section
              className="settings-modal daily-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="daily-detail-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="daily-detail-modal-head">
                {(() => {
                  const look = resolveAuthorAppearance(
                    report.userId,
                    report.characterColor,
                    report.characterShape,
                  );
                  return (
                    <ProfileCharacterPreview color={look.color} shape={look.shape} />
                  );
                })()}
                <div>
                  <p className="card-kicker">Daily Report</p>
                  <h2 id="daily-detail-modal-title">{displayName}</h2>
                  <small>{formatDailyDate(report.date, language)}</small>
                </div>
                <button
                  type="button"
                  className="daily-detail-modal-close"
                  onClick={() => setExpandedDailyReport(null)}
                  aria-label={t("閉じる")}
                >
                  ×
                </button>
              </header>

              {report.planItems && report.planItems.length > 0 ? (
                <section className="daily-detail-modal-section">
                  <h3>{t("今日やること")}</h3>
                  <PlanChecklistPreview
                    items={report.planItems}
                    moreLabel={(count) => t("+{count}件", { count })}
                    emptyItemText={t("(空)")}
                  />
                </section>
              ) : report.plan ? (
                <section className="daily-detail-modal-section">
                  <h3>{t("今日やること")}</h3>
                  <p>{renderTextWithMentions(report.plan, { lookup: dailyMentionLookup, keyPrefix: `plan-${report.id}` })}</p>
                </section>
              ) : null}

              {report.reflection ? (
                <section className="daily-detail-modal-section">
                  <h3>{t("振り返り")}</h3>
                  {renderReflectionBody(report.reflection, {
                    t,
                    lookup: dailyMentionLookup,
                    keyPrefix: `refl-${report.id}`,
                  })}
                </section>
              ) : null}

              {!report.plan && !report.reflection && !(report.planItems && report.planItems.length > 0) ? (
                <p className="daily-detail-modal-empty">{t("本文はまだ書かれていません。")}</p>
              ) : null}

              {isMine ? (
                <section className="daily-detail-modal-section">
                  <h3>{t("この日のデータ")}</h3>
                  <div className="daily-detail-modal-metrics">
                    <div>
                      <small>{t("学習時間")}</small>
                      <strong>{totalMinutes > 0 ? formatStudyTimeJa(totalMinutes, language) : "—"}</strong>
                    </div>
                    <div>
                      <small>{t("commit")}</small>
                      <strong>{commitCount > 0 ? commitCount : "—"}</strong>
                    </div>
                    <div>
                      <small>{t("記録")}</small>
                      <strong>{logsForDay.length > 0 ? t("{count}件", { count: logsForDay.length }) : "—"}</strong>
                    </div>
                  </div>
                  {logsForDay.length > 0 ? (
                    <ul className="daily-detail-modal-logs">
                      {logsForDay.map((log) => (
                        <li key={log.id}>
                          <i style={{ background: log.color || "rgba(31,111,74,0.7)" }} aria-hidden="true" />
                          <strong>{log.subject}</strong>
                          <span>{formatStudyTime(log.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="daily-detail-modal-empty">{t("この日の学習ログはありません。")}</p>
                  )}
                </section>
              ) : (
                <p className="daily-detail-modal-empty">
                  {t("他のメンバーの学習データはここでは表示されません。")}
                </p>
              )}

              {/* 削除はリスト本体から取り除いたので、詳細モーダル内に
                  破壊的アクションとして配置する。確認 prompt は
                  handleDailyReportDelete 内で出るのでここでは即発火。 */}
              {isMine ? (
                <div className="daily-detail-modal-danger">
                  <button
                    type="button"
                    className="daily-detail-modal-delete"
                    onClick={() => {
                      handleDailyReportDelete(report);
                      setExpandedDailyReport(null);
                    }}
                  >
                    {t("この日報を削除")}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        );
      })() : null}

      {dailySharePreview ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={closeDailySharePreview}
        >
          <section
            className="settings-modal daily-share-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("日報の共有画像")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="daily-share-modal-preview">
              <img src={dailySharePreview.url} alt={t("日報の共有画像")} />
            </div>
            <p className="daily-share-modal-hint">
              {t("画像を保存して SNS に投稿したり、写真ウィジェットに置けます。")}
            </p>
            <div className="daily-share-modal-actions">
              <button
                type="button"
                className="daily-share-modal-copy"
                onClick={() => void handleCopyDailyShareImage()}
              >
                {t("コピー")}
              </button>
              <button
                type="button"
                className="daily-share-modal-save"
                onClick={handleSaveDailyShareImage}
              >
                {t("画像を保存")}
              </button>
            </div>
            <button
              type="button"
              className="daily-share-modal-close"
              onClick={closeDailySharePreview}
              aria-label={t("閉じる")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </section>
        </div>
      ) : null}

      <ShareToXModal
        open={isShareToXOpen}
        onClose={() => setIsShareToXOpen(false)}
        input={{
          displayName: playerName,
          minutes: todayStudyMinutes,
          subject: todayTopSubject,
          date: new Date().toISOString().slice(0, 10),
          streak: studyStreak,
        }}
      />

      {isOrgCreateOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!isOrgWorking) setIsOrgCreateOpen(false);
          }}
        >
          <section
            className="settings-modal org-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-create-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="card-kicker">Teams</p>
              <h2 id="org-create-modal-title">{t("組織を作って始める")}</h2>
              <p className="recruitment-modal-help">
                {t("チーム名を入れるだけで組織を作成できます。あとで招待リンクで仲間を招けます。")}
              </p>
            </div>

            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateOrganization();
              }}
            >
              <label className="recruitment-field">
                <span>{t("チーム名 / 組織名")}</span>
                <input
                  autoFocus
                  value={newOrgName}
                  onChange={(event) => {
                    setNewOrgName(event.target.value);
                    if (orgError) setOrgError("");
                  }}
                  placeholder={t("例: Acme Inc.")}
                  maxLength={64}
                  aria-label={t("組織名")}
                />
              </label>
              {orgError ? <p className="settings-error">{orgError}</p> : null}
              <div className="recruitment-modal-actions">
                <button
                  type="button"
                  className="settings-org-leave"
                  onClick={() => setIsOrgCreateOpen(false)}
                  disabled={isOrgWorking}
                >
                  {t("キャンセル")}
                </button>
                <button
                  type="submit"
                  className="teams-cta-primary"
                  disabled={isOrgWorking || !newOrgName.trim()}
                >
                  {isOrgWorking ? t("作成中…") : t("作成して始める →")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isFriendsModalOpen ? (() => {
        // 友達一覧の拡張表示。検索 / ソート / pin / 削除 / mute / block /
        // 応援 / 一括選択 / おすすめ / "Friends since" などを一画面に集約。
        const pinSet = new Set(pinnedFriendUids);
        const muteSet = new Set(mutedFriendUids);
        const query = friendsModalQuery.trim().toLowerCase();
        const acceptedRequestByUid = new Map<string, FriendRequest>();
        friendRequests.forEach((request) => {
          if (request.status === "accepted") {
            acceptedRequestByUid.set(request.profile.uid, request);
          }
        });

        // 各 friend に表示用メタを乗せた配列を作る。
        const enrichedFriends = sidebarFriends.map((friend) => {
          const profile = workspaceProfiles[friend.uid];
          const acceptedAt = acceptedRequestByUid.get(friend.uid)?.acceptedAt;
          const friendsSinceDays = acceptedAt
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(acceptedAt).getTime()) / 86400000),
              )
            : null;
          // 最終アクティブ日（プロフィールの lastSyncedAt を流用）。
          const lastActiveDays = profile?.lastSyncedAt
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(profile.lastSyncedAt).getTime()) / 86400000),
              )
            : null;
          return {
            friend,
            level: profile?.level || 0,
            streak: profile?.streak || 0,
            effortExp: profile?.effortExp || 0,
            outputExp: profile?.outputExp || 0,
            determination: profile?.determination || "",
            weekMinutes: profile?.weekMinutes || 0,
            weekKey: profile?.weekKey || "",
            friendsSinceDays,
            lastActiveDays,
            isPinned: pinSet.has(friend.uid),
            isMuted: muteSet.has(friend.uid),
          };
        });

        // おすすめフレンド：自分の友達がフォローしている人のうち、自分は
        // まだ友達でなくブロックでも申請中でもない uid を集計。共通フレンド
        // 数 (mutualCount) 順で上位 5 件を表示。
        const myFriendUidSet = new Set(friends.map((f) => f.uid));
        const blockedSet = new Set(blockedFriendUids);
        const pendingUidSet = new Set(
          friendRequests
            .filter((r) => r.status === "pending")
            .map((r) => r.profile.uid),
        );
        const recommendationCount = new Map<string, number>();
        friends.forEach((friend) => {
          const profile = workspaceProfiles[friend.uid];
          if (!profile?.following) return;
          profile.following.forEach((candidateUid) => {
            if (!candidateUid) return;
            if (candidateUid === currentUserUid) return;
            if (myFriendUidSet.has(candidateUid)) return;
            if (blockedSet.has(candidateUid)) return;
            if (pendingUidSet.has(candidateUid)) return;
            recommendationCount.set(candidateUid, (recommendationCount.get(candidateUid) || 0) + 1);
          });
        });
        const recommendedUids = Array.from(recommendationCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([uid, mutualCount]) => ({
            uid,
            mutualCount,
            profile: workspaceProfiles[uid],
          }))
          .filter((item) => item.profile);

        const filtered = query
          ? enrichedFriends.filter(({ friend }) => {
              const haystack = [
                friend.name,
                friend.userId,
                friend.activity,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return haystack.includes(query);
            })
          : enrichedFriends;

        const statusRank = (s: string) => (s === "online" ? 0 : s === "away" ? 1 : 2);
        const sorted = [...filtered].sort((a, b) => {
          // ピンは常に先頭
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          switch (friendsModalSort) {
            case "name":
              return a.friend.name.localeCompare(b.friend.name, "ja");
            case "recent":
              return (
                new Date(acceptedRequestByUid.get(b.friend.uid)?.acceptedAt || 0).getTime() -
                new Date(acceptedRequestByUid.get(a.friend.uid)?.acceptedAt || 0).getTime()
              );
            case "level":
              return b.level - a.level;
            case "streak":
              return b.streak - a.streak;
            case "online":
            default:
              return statusRank(a.friend.status) - statusRank(b.friend.status);
          }
        });

        const onlineCount = enrichedFriends.filter(({ friend }) => friend.status === "online").length;

        // 今週のランキング: 自分 + フレンドを「今週の学習分数」降順で並べる。
        // フレンドの weekMinutes は本人が最後に同期した週のもの。weekKey が
        // 今週と一致しない（＝今週まだ動いていない）人は 0 分扱い。週がまたぐと
        // weekKey が変わって全員自動リセットされる（明示的なリセット処理は不要）。
        const currentWeekKey = getCurrentWeekKey();
        const weeklyLeaderboard = [
          {
            uid: currentUserUid,
            name: playerName,
            avatar: playerAvatar,
            weekMinutes: contributionArc.thisWeekMinutes,
            isSelf: true,
          },
          ...enrichedFriends.map(({ friend, weekMinutes, weekKey }) => ({
            uid: friend.uid,
            name: friend.name,
            avatar: friend.avatar,
            weekMinutes: weekKey === currentWeekKey ? weekMinutes : 0,
            isSelf: false,
          })),
        ].sort((a, b) => b.weekMinutes - a.weekMinutes);
        const selfRank = weeklyLeaderboard.findIndex((entry) => entry.isSelf) + 1;

        return (
          <div
            className="settings-modal-backdrop"
            role="presentation"
            onClick={() => setIsFriendsModalOpen(false)}
          >
            <section
              className="settings-modal friends-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="friends-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="friends-modal-head">
                <div>
                  <p className="card-kicker">Friends</p>
                  <h2 id="friends-modal-title">
                    {t("フレンド一覧")}
                    <span className="friends-modal-count">
                      {t("{count}人 · オンライン {online}人", { count: enrichedFriends.length, online: onlineCount })}
                    </span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="friends-modal-close"
                  aria-label={t("閉じる")}
                  onClick={() => setIsFriendsModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <p className="friends-modal-help">
                {selectedRoom ? (
                  <>
                    {t("招待先の部屋:")} <strong>{selectedRoom.name}</strong>
                  </>
                ) : (
                  t("作業部屋を選ぶと、フレンドを招待できます。")
                )}
              </p>

              {/* 今週のランキング。自分 + フレンドを今週の学習時間で並べる。 */}
              {weeklyLeaderboard.length > 1 ? (
                <section className="friends-leaderboard" aria-label={t("今週のランキング")}>
                  <header className="friends-leaderboard-head">
                    <div>
                      <p className="card-kicker">This week</p>
                      <strong>{t("今週のランキング")}</strong>
                    </div>
                    <span className="friends-leaderboard-myrank">{t("あなた {rank}位", { rank: selfRank })}</span>
                  </header>
                  <ol className="friends-leaderboard-list">
                    {weeklyLeaderboard.slice(0, 10).map((entry, index) => (
                      <li
                        key={entry.uid}
                        className={`friends-leaderboard-row${entry.isSelf ? " is-self" : ""}`}
                      >
                        <span
                          className="friends-leaderboard-rank"
                          data-top={index < 3 ? "true" : undefined}
                        >
                          {index === 0
                            ? "🥇"
                            : index === 1
                              ? "🥈"
                              : index === 2
                                ? "🥉"
                                : index + 1}
                        </span>
                        <span className="friends-leaderboard-avatar" aria-hidden="true">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt="" />
                          ) : (
                            <span>{entry.name.slice(0, 1)}</span>
                          )}
                        </span>
                        <span className="friends-leaderboard-name">
                          {entry.name}
                          {entry.isSelf ? (
                            <span className="friends-leaderboard-you">{t("あなた")}</span>
                          ) : null}
                        </span>
                        <span className="friends-leaderboard-minutes">
                          {entry.weekMinutes > 0 ? formatStudyTimeJa(entry.weekMinutes) : "—"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {/* 検索 + ソート + 一括選択モード。 */}
              {enrichedFriends.length > 0 ? (
                <div className="friends-modal-controls">
                  <input
                    type="search"
                    className="friends-modal-search"
                    placeholder={t("名前・@ID で検索")}
                    value={friendsModalQuery}
                    onChange={(event) => setFriendsModalQuery(event.target.value)}
                    aria-label={t("フレンドを検索")}
                  />
                  <select
                    className="friends-modal-sort"
                    value={friendsModalSort}
                    onChange={(event) =>
                      setFriendsModalSort(event.target.value as typeof friendsModalSort)
                    }
                    aria-label={t("並べ替え")}
                  >
                    <option value="online">{t("オンライン順")}</option>
                    <option value="name">{t("名前順")}</option>
                    <option value="recent">{t("フレンド成立順")}</option>
                    <option value="level">{t("レベル順")}</option>
                    <option value="streak">{t("ストリーク順")}</option>
                  </select>
                  {selectedRoom ? (
                    <button
                      type="button"
                      className={`friends-modal-bulk-toggle${friendsBulkSelectMode ? " is-active" : ""}`}
                      onClick={() => {
                        setFriendsBulkSelectMode((mode) => !mode);
                        setFriendsBulkSelectedUids(new Set());
                      }}
                      title={t("一括招待モード")}
                    >
                      {friendsBulkSelectMode ? t("✓ 一括選択中") : t("□ 一括選択")}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="friends-modal-list">
                {sorted.length > 0 ? (
                  sorted.map(({ friend, level, streak, friendsSinceDays, lastActiveDays, isPinned, isMuted }) => {
                    const invited = invitedFriendUids.has(friend.uid);
                    const isSelected = friendsBulkSelectedUids.has(friend.uid);
                    const encouragedToday = encouragementsSent.has(friend.uid);
                    return (
                      <div
                        key={friend.uid}
                        className={[
                          "friends-modal-row",
                          isPinned ? "is-pinned" : "",
                          isMuted ? "is-muted" : "",
                          friendsBulkSelectMode ? "is-bulk" : "",
                          isSelected ? "is-selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <button
                          type="button"
                          className="friends-modal-person"
                          onClick={() => {
                            if (friendsBulkSelectMode) {
                              setFriendsBulkSelectedUids((set) => {
                                const next = new Set(set);
                                if (next.has(friend.uid)) next.delete(friend.uid);
                                else next.add(friend.uid);
                                return next;
                              });
                              return;
                            }
                            handleFriendOpen(friend);
                            setIsFriendsModalOpen(false);
                          }}
                        >
                          {friendsBulkSelectMode ? (
                            <span
                              className={`friends-modal-checkbox${isSelected ? " is-on" : ""}`}
                              aria-hidden="true"
                            >
                              {isSelected ? "✓" : ""}
                            </span>
                          ) : null}
                          <span className="friends-modal-avatar">
                            {friend.avatar ? (
                              <img src={friend.avatar} alt="" />
                            ) : (
                              friend.name.slice(0, 1).toUpperCase()
                            )}
                            <i className={`topbar-popover-dot ${friend.status}`} />
                          </span>
                          <span className="friends-modal-meta">
                            <strong>
                              {friend.name}
                              {isPinned ? <span className="friends-modal-pin-mark" aria-hidden="true">★</span> : null}
                              {isMuted ? <span className="friends-modal-mute-mark" aria-hidden="true" title={t("ミュート中")}>M</span> : null}
                            </strong>
                            {friend.userId ? <small>@{friend.userId}</small> : null}
                            <small>{friend.activity}</small>
                            {(level > 0 || streak > 0 || friendsSinceDays !== null || lastActiveDays !== null) ? (
                              <span className="friends-modal-stats">
                                {level > 0 ? <em>Lv {level}</em> : null}
                                {streak > 0 ? <em>🔥 {streak}d</em> : null}
                                {friendsSinceDays !== null ? (
                                  <em title={`Friends since ${friendsSinceDays} day(s) ago`}>
                                    {friendsSinceDays === 0 ? t("今日成立") : t("{days}日目", { days: friendsSinceDays })}
                                  </em>
                                ) : null}
                                {lastActiveDays !== null && lastActiveDays >= 14 ? (
                                  <em
                                    className="friends-modal-stale"
                                    title={`Last active ${lastActiveDays} days ago`}
                                  >
                                    {t("{days}日前", { days: lastActiveDays })}
                                  </em>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        {!friendsBulkSelectMode ? (
                          <div className="friends-modal-actions">
                            <button
                              type="button"
                              className={`friends-modal-encourage${encouragedToday ? " is-done" : ""}`}
                              aria-label={encouragedToday ? t("今日応援済み") : t("{name} を応援する", { name: friend.name })}
                              title={encouragedToday ? t("今日は応援済み") : t("応援する（1日1回）")}
                              disabled={encouragedToday}
                              onClick={() =>
                                void handleSendEncouragement({ uid: friend.uid, name: friend.name })
                              }
                            >
                              {t("応援")}
                            </button>
                            <button
                              type="button"
                              className={`friends-modal-mute${isMuted ? " is-active" : ""}`}
                              aria-label={isMuted ? t("ミュート解除") : t("ミュートする")}
                              title={isMuted ? t("ミュート解除") : t("通知をミュート")}
                              onClick={() => handleToggleFriendMute(friend.uid)}
                            >
                              {isMuted ? t("通知ON") : t("ミュート")}
                            </button>
                            <button
                              type="button"
                              className="friends-modal-pin"
                              aria-label={isPinned ? t("ピン留めを外す") : t("ピン留めする")}
                              title={isPinned ? t("ピン留めを外す") : t("ピン留めする")}
                              onClick={() =>
                                setPinnedFriendUids((ids) =>
                                  isPinned
                                    ? ids.filter((id) => id !== friend.uid)
                                    : [friend.uid, ...ids],
                                )
                              }
                            >
                              {isPinned ? "★" : "☆"}
                            </button>
                            <button
                              type="button"
                              className="friends-modal-invite"
                              disabled={!selectedRoom || invited}
                              onClick={() => handleSendWorkspaceInvite(friend)}
                            >
                              {invited ? t("招待済み") : t("招待")}
                            </button>
                            <button
                              type="button"
                              className="friends-modal-block"
                              aria-label={t("{name} をブロック", { name: friend.name })}
                              title={t("ブロックする")}
                              onClick={() => {
                                const ok = window.confirm(
                                  t("{name} をブロックしますか？\nフレンド関係も同時に解除され、相手からの通知や申請が届かなくなります。", { name: friend.name }),
                                );
                                if (ok) void handleBlockUser({ uid: friend.uid, name: friend.name });
                              }}
                            >
                              {t("ブロック")}
                            </button>
                            <button
                              type="button"
                              className="friends-modal-remove"
                              aria-label={t("{name} をフレンドから外す", { name: friend.name })}
                              title={t("フレンドから外す")}
                              onClick={() => {
                                const ok = window.confirm(
                                  t("{name} をフレンドから外しますか？\nお互いの友達リストから消えます。", { name: friend.name }),
                                );
                                if (ok) void handleFriendRemove(friend);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : enrichedFriends.length > 0 ? (
                  <p className="friends-modal-empty">
                    {t("検索に一致するフレンドはいません。")}
                  </p>
                ) : (
                  <p className="friends-modal-empty">
                    {t("まだフレンドがいません。プロフィールから招待しましょう。")}
                  </p>
                )}
              </div>

              {/* おすすめフレンド：友達の友達からの推薦 */}
              {recommendedUids.length > 0 ? (
                <div className="friends-modal-recommend">
                  <p className="friends-modal-recommend-title">
                    {t("あなたへのおすすめ")}
                    <small>{t("共通のフレンドから推薦")}</small>
                  </p>
                  <ul>
                    {recommendedUids.map(({ uid, mutualCount, profile }) => (
                      <li key={uid}>
                        <button
                          type="button"
                          className="friends-modal-recommend-card"
                          onClick={() => {
                            handleUserProfileOpen(profile);
                            setIsFriendsModalOpen(false);
                          }}
                        >
                          <span className="friends-modal-recommend-avatar">
                            {profile.photoURL ? (
                              <img src={profile.photoURL} alt="" />
                            ) : (
                              (profile.displayName || "?").slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span className="friends-modal-recommend-meta">
                            <strong>{profile.displayName}</strong>
                            {profile.userId ? <small>@{profile.userId}</small> : null}
                            <small className="friends-modal-recommend-mutual">
                              {t("共通フレンド {count}人", { count: mutualCount })}
                            </small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* ブロック中の uid 一覧（解除導線） */}
              {blockedFriendUids.length > 0 ? (
                <div className="friends-modal-blocked">
                  <p className="friends-modal-blocked-title">
                    {t("ブロック中")}
                    <small>{t("{count}人", { count: blockedFriendUids.length })}</small>
                  </p>
                  <ul>
                    {blockedFriendUids.map((uid) => {
                      const profile = workspaceProfiles[uid];
                      const name = profile?.displayName || uid.slice(0, 6);
                      return (
                        <li key={uid}>
                          <span>{name}</span>
                          <button
                            type="button"
                            className="friends-modal-unblock"
                            onClick={() => handleUnblockUser(uid)}
                          >
                            {t("解除")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {/* 一括招待フッターバー */}
              {friendsBulkSelectMode ? (
                <div className="friends-modal-bulk-bar" role="status">
                  <span>{t("{count} 人を選択中", { count: friendsBulkSelectedUids.size })}</span>
                  <button
                    type="button"
                    className="friends-modal-bulk-clear"
                    onClick={() => setFriendsBulkSelectedUids(new Set())}
                    disabled={friendsBulkSelectedUids.size === 0}
                  >
                    {t("クリア")}
                  </button>
                  <button
                    type="button"
                    className="friends-modal-bulk-invite"
                    onClick={() => {
                      void handleBatchInvite(Array.from(friendsBulkSelectedUids));
                      setFriendsBulkSelectedUids(new Set());
                      setFriendsBulkSelectMode(false);
                    }}
                    disabled={friendsBulkSelectedUids.size === 0 || !selectedRoom}
                  >
                    {friendsBulkSelectedUids.size > 0
                      ? t("{count} 人を招待", { count: friendsBulkSelectedUids.size })
                      : t("招待先を選択")}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        );
      })() : null}

      {isRecruitmentModalOpen ? (
        <div className="settings-modal-backdrop" role="presentation" onClick={handleCloseRecruitmentModal}>
          <section
            className="settings-modal recruitment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recruitment-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="card-kicker">Workspace Recruitment</p>
              <h2 id="recruitment-modal-title">{t("作業部屋の募集を投稿")}</h2>
              <p className="recruitment-modal-help">
                {selectedRoom ? (
                  <>
                    {t("部屋:")} <strong>{selectedRoom.name}</strong> / {t("作業:")} <strong>{workspaceTask.trim() || t("(作業内容を入力してください)")}</strong>
                  </>
                ) : (
                  t("作業部屋を選択してください。")
                )}
              </p>
            </div>

            <form className="settings-form recruitment-form" onSubmit={handleCreateRecruitmentSubmit}>
              <div className="recruitment-mode-toggle" role="tablist" aria-label={t("開始タイミング")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={recruitmentDraft.mode === "now"}
                  className={recruitmentDraft.mode === "now" ? "is-active" : ""}
                  onClick={() => setRecruitmentDraft((prev) => ({ ...prev, mode: "now" }))}
                >
                  {t("今から")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={recruitmentDraft.mode === "scheduled"}
                  className={recruitmentDraft.mode === "scheduled" ? "is-active" : ""}
                  onClick={() => setRecruitmentDraft((prev) => ({ ...prev, mode: "scheduled" }))}
                >
                  {t("予約")}
                </button>
              </div>

              {recruitmentDraft.mode === "scheduled" ? (
                <label className="recruitment-field">
                  <span>{t("開始時刻")}</span>
                  <input
                    type="datetime-local"
                    value={recruitmentDraft.scheduledAt}
                    onChange={(event) =>
                      setRecruitmentDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))
                    }
                  />
                </label>
              ) : null}

              <div className="recruitment-field">
                <span>{t("想定時間")}</span>
                <div className="recruitment-duration-options" role="radiogroup">
                  {[30, 60, 120, 180].map((minutes) => (
                    <button
                      type="button"
                      key={minutes}
                      role="radio"
                      aria-checked={recruitmentDraft.durationMinutes === minutes}
                      className={recruitmentDraft.durationMinutes === minutes ? "is-active" : ""}
                      onClick={() => setRecruitmentDraft((prev) => ({ ...prev, durationMinutes: minutes }))}
                    >
                      {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                    </button>
                  ))}
                </div>
              </div>

              <label className="recruitment-field">
                <span>{t("メッセージ (任意, 140字)")}</span>
                <textarea
                  value={recruitmentDraft.message}
                  onChange={(event) =>
                    setRecruitmentDraft((prev) => ({ ...prev, message: event.target.value }))
                  }
                  placeholder={t("一緒にやりませんか")}
                  maxLength={140}
                  rows={3}
                />
                <small>{recruitmentDraft.message.length}/140</small>
              </label>

              {recruitmentError ? <p className="log-post-error">{recruitmentError}</p> : null}

              <div className="recruitment-modal-actions">
                <button type="button" className="learning-cancel-button" onClick={handleCloseRecruitmentModal}>
                  {t("キャンセル")}
                </button>
                <button type="submit" className="learning-save-button">
                  {t("投稿する")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!isDeletingAccount) setIsDeleteConfirmOpen(false);
          }}
        >
          <section
            className="settings-modal delete-account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="card-kicker">Danger zone</p>
              <h2 id="delete-account-title">{t("アカウントを削除しますか？")}</h2>
              <p className="delete-account-copy">
                {t("以下のデータが全て削除されます：プロフィール、投稿、学習ログ、日報、Learning Item、作業セッション、募集履歴、GitHub 連携、フレンドリクエスト。組織からは退出し、組織内のあなたのメンバーシップ記録は監査ログに「退出」として残ります（個人特定可能なログ本体は削除されます）。")}
                <br />
                <strong>{t("この操作は取り消せません。")}</strong>
              </p>
            </div>

            <div className="delete-account-confirm">
              <label>
                <span>{t("続行するには、あなたのユーザーID「{id}」を入力してください", { id: userId || currentUser?.uid })}</span>
                <input
                  value={deleteConfirmText}
                  onChange={(event) => {
                    setDeleteConfirmText(event.target.value);
                    if (deleteError) setDeleteError("");
                  }}
                  placeholder={userId || currentUser?.uid || ""}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {deleteError ? <p className="delete-account-error">{deleteError}</p> : null}
            </div>

            <div className="settings-actions">
              <button
                type="button"
                className="settings-secondary"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingAccount}
              >
                {t("やめる")}
              </button>
              <button
                type="button"
                className="settings-data-delete settings-primary"
                onClick={handleDeleteAccount}
                disabled={
                  isDeletingAccount ||
                  deleteConfirmText.trim() !== (userId || currentUser?.uid || "")
                }
              >
                {isDeletingAccount ? t("削除中…") : t("本当に削除する")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isOrgAdminOpen && currentOrganization ? (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsOrgAdminOpen(false)}>
          <section
            className="settings-modal org-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-admin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="org-admin-head">
              <div>
                <p className="card-kicker">Organization · Admin</p>
                <h2 id="org-admin-title">{currentOrganization.name}</h2>
              </div>
              <button
                type="button"
                className="org-admin-close"
                onClick={() => setIsOrgAdminOpen(false)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </header>

            {(() => {
              // Aggregate metrics shown above the table. Computed
              // on every render — the dataset is per-org so the cost
              // is bounded by team size (single-digit ms at any
              // realistic SaaS scale).
              const totalMembers = orgMembers.length;
              const totalEffort = orgMembers.reduce((acc, m) => acc + (m.effortExp || 0), 0);
              const totalOutput = orgMembers.reduce((acc, m) => acc + (m.outputExp || 0), 0);
              const maxStreak = orgMembers.reduce((acc, m) => Math.max(acc, m.streak || 0), 0);
              const totalContribution = orgMembers.reduce(
                (acc, m) => acc + (m.contributionCount || 0),
                0,
              );
              const lastActiveMs = orgMembers.reduce((acc, m) => {
                const ts = new Date(m.lastSyncedAt || 0).getTime();
                return Number.isFinite(ts) && ts > acc ? ts : acc;
              }, 0);
              const lastActiveLabel = lastActiveMs
                ? new Date(lastActiveMs).toLocaleString("ja-JP", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";

              return (
                <div className="org-admin-metrics" role="group" aria-label={t("集計")}>
                  <div className="org-admin-metric">
                    <span>{t("メンバー")}</span>
                    <strong>{t("{count}人", { count: totalMembers.toLocaleString() })}</strong>
                  </div>
                  <div className="org-admin-metric">
                    <span>{t("合計 Effort EXP")}</span>
                    <strong>{totalEffort.toLocaleString()}</strong>
                  </div>
                  <div className="org-admin-metric">
                    <span>{t("合計 Output EXP")}</span>
                    <strong>{totalOutput.toLocaleString()}</strong>
                  </div>
                  <div className="org-admin-metric">
                    <span>{t("最長ストリーク")}</span>
                    <strong>{t("{count}日", { count: maxStreak.toLocaleString() })}</strong>
                  </div>
                  <div className="org-admin-metric">
                    <span>{t("合計 Contributions")}</span>
                    <strong>{totalContribution.toLocaleString()}</strong>
                  </div>
                  <div className="org-admin-metric">
                    <span>{t("最新アクティブ")}</span>
                    <strong>{lastActiveLabel}</strong>
                  </div>
                </div>
              );
            })()}

            <div className="org-admin-tabs" role="tablist" aria-label={t("ビュー切替")}>
              <button
                type="button"
                role="tab"
                aria-selected={orgAdminTab === "members"}
                className={orgAdminTab === "members" ? "is-active" : ""}
                onClick={() => setOrgAdminTab("members")}
              >
                {t("メンバー")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={orgAdminTab === "audit"}
                className={orgAdminTab === "audit" ? "is-active" : ""}
                onClick={() => {
                  setOrgAdminTab("audit");
                  if (orgAuditLogs.length === 0 && !isLoadingAuditLogs) {
                    void handleLoadAuditLogs();
                  }
                }}
              >
                {t("監査ログ")}
              </button>
            </div>

            {orgAdminTab === "members" ? (
            <>
            <div className="org-admin-toolbar">
              <button
                type="button"
                className="org-admin-secondary"
                onClick={handleRefreshOrgMembers}
                disabled={isLoadingOrgMembers}
              >
                {isLoadingOrgMembers ? t("更新中…") : t("再読み込み")}
              </button>
              <button
                type="button"
                className="org-admin-primary"
                onClick={handleExportOrgMembersCsv}
                disabled={orgMembers.length === 0 || isLoadingOrgMembers}
              >
                {t("CSV をダウンロード")}
              </button>
            </div>

            {orgAdminError ? <p className="org-admin-error">{orgAdminError}</p> : null}

            <div className="org-admin-table-scroll">
              <table className="org-admin-table">
                <thead>
                  <tr>
                    <th>{t("名前")}</th>
                    <th>{t("役割")}</th>
                    <th>{t("チーム")}</th>
                    <th>Lv</th>
                    <th>Effort</th>
                    <th>Output</th>
                    <th>{t("ストリーク")}</th>
                    <th>{t("最終アクティブ")}</th>
                    {currentOrganization?.ownerUid === currentUser?.uid ? <th aria-label={t("操作")} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {orgMembers.length === 0 && !isLoadingOrgMembers ? (
                    <tr>
                      <td colSpan={8} className="org-admin-empty">
                        {t("まだメンバーがいません。招待リンクで仲間を招待しましょう。")}
                      </td>
                    </tr>
                  ) : null}
                  {orgMembers
                    .slice()
                    .sort((a, b) => (b.effortExp || 0) - (a.effortExp || 0))
                    .map((member) => {
                      const lastActiveMs = new Date(member.lastSyncedAt || 0).getTime();
                      const lastActive =
                        member.lastSyncedAt && Number.isFinite(lastActiveMs)
                          ? new Date(lastActiveMs).toLocaleDateString("ja-JP", {
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : "—";
                      return (
                        <tr key={member.uid}>
                          <td>
                            <div className="org-admin-member-cell">
                              <span
                                className="org-admin-member-avatar"
                                aria-hidden="true"
                              >
                                {member.avatarUrl ? (
                                  <img src={member.avatarUrl} alt="" />
                                ) : (
                                  (member.displayName || "?").charAt(0).toUpperCase()
                                )}
                              </span>
                              <div className="org-admin-member-name">
                                <strong>{member.displayName}</strong>
                                <small>@{member.userId || "—"}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`org-admin-role role-${member.organizationRole}`}>
                              {member.organizationRole === "owner"
                                ? t("オーナー")
                                : member.organizationRole === "admin"
                                  ? t("管理者")
                                  : t("メンバー")}
                            </span>
                          </td>
                          <td className="org-admin-team-cell">
                            {currentOrganization?.ownerUid === currentUser?.uid ? (
                              <input
                                type="text"
                                className="org-admin-team-input"
                                defaultValue={member.teamName || ""}
                                placeholder={t("未割り当て")}
                                maxLength={40}
                                aria-label={t("{name} のチーム", { name: member.displayName })}
                                onBlur={(event) => {
                                  void handleSetMemberTeamName(member, event.target.value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.currentTarget.blur();
                                  }
                                }}
                              />
                            ) : (
                              <span className="org-admin-team-readonly">
                                {member.teamName || "—"}
                              </span>
                            )}
                          </td>
                          <td className="org-admin-num">{member.level.toLocaleString()}</td>
                          <td className="org-admin-num">{member.effortExp.toLocaleString()}</td>
                          <td className="org-admin-num">{member.outputExp.toLocaleString()}</td>
                          <td className="org-admin-num">{member.streak.toLocaleString()}</td>
                          <td>{lastActive}</td>
                          {currentOrganization?.ownerUid === currentUser?.uid ? (
                            <td className="org-admin-actions-cell">
                              {member.uid !== currentUser?.uid &&
                              member.organizationRole !== "owner" ? (
                                <div className="org-admin-actions-row">
                                  <button
                                    type="button"
                                    className="org-admin-transfer"
                                    onClick={() => handleTransferOwnership(member)}
                                    title={t("このメンバーにオーナーを譲渡")}
                                  >
                                    {t("オーナー譲渡")}
                                  </button>
                                  <button
                                    type="button"
                                    className="org-admin-remove"
                                    onClick={() => handleRemoveMember(member)}
                                    title={t("このメンバーを組織から除名")}
                                  >
                                    {t("除名")}
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            </>
            ) : (
              <div className="org-admin-audit">
                <div className="org-admin-toolbar">
                  <button
                    type="button"
                    className="org-admin-secondary"
                    onClick={handleLoadAuditLogs}
                    disabled={isLoadingAuditLogs}
                  >
                    {isLoadingAuditLogs ? t("更新中…") : t("再読み込み")}
                  </button>
                </div>
                <div className="org-admin-table-scroll">
                  <table className="org-admin-table">
                    <thead>
                      <tr>
                        <th>{t("日時")}</th>
                        <th>{t("イベント")}</th>
                        <th>{t("対象")}</th>
                        <th>{t("実行者")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgAuditLogs.length === 0 && !isLoadingAuditLogs ? (
                        <tr>
                          <td colSpan={4} className="org-admin-empty">
                            {t("記録されたイベントはまだありません。")}
                          </td>
                        </tr>
                      ) : null}
                      {orgAuditLogs.map((log) => {
                        const at = new Date(log.createdAt);
                        const atLabel = Number.isFinite(at.getTime())
                          ? at.toLocaleString("ja-JP", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—";
                        const eventLabel =
                          log.type === "organization.created"
                            ? t("組織を作成")
                            : log.type === "organization.member_joined"
                              ? t("メンバーが参加")
                              : log.type === "organization.member_left"
                                ? t("メンバーが退出")
                                : log.type === "organization.slack_updated"
                                  ? t("Slack設定を更新")
                                  : log.type === "room.created"
                                    ? t("ルームを作成")
                                    : log.type;
                        return (
                          <tr key={log.id}>
                            <td className="org-admin-audit-time">{atLabel}</td>
                            <td>
                              <span className={`org-admin-audit-type type-${log.type.replace(".", "-")}`}>
                                {eventLabel}
                              </span>
                            </td>
                            <td>{log.target || "—"}</td>
                            <td>{log.actorName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="org-admin-foot">
                  {t("追記専用の台帳です。ログは編集・削除できません。最大100件まで表示。")}
                </p>
              </div>
            )}

            <section className="org-admin-slack" aria-label={t("Slack連携")}>
              <header className="org-admin-slack-head">
                <div>
                  <p className="card-kicker">Integrations</p>
                  <h3>{t("Slack 連携")}</h3>
                </div>
                <a
                  className="org-admin-slack-help"
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Webhook URLの取得方法 →")}
                </a>
              </header>
              <p className="org-admin-slack-copy">
                {t("Slack の Incoming Webhook URL を貼り付けると、組織メンバーの入室や募集が指定チャンネルに自動投稿されます。URL は組織のオーナーのみ編集できます。")}
              </p>
              <label className="org-admin-slack-field">
                <span>Webhook URL</span>
                <input
                  type="url"
                  inputMode="url"
                  value={slackDraftUrl}
                  onChange={(event) => {
                    setSlackDraftUrl(event.target.value);
                    if (slackSaveState !== "idle") {
                      setSlackSaveState("idle");
                      setSlackSaveMessage("");
                    }
                  }}
                  placeholder="https://hooks.slack.com/services/T000/B000/XXX"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <div className="org-admin-slack-toggles" role="group" aria-label={t("通知イベント")}>
                <label className={`org-admin-slack-toggle ${slackDraftRoomJoins ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftRoomJoins}
                    onChange={(event) => setSlackDraftRoomJoins(event.target.checked)}
                  />
                  <div>
                    <strong>{t("入室通知")}</strong>
                    <small>{t("メンバーが作業部屋に入った時")}</small>
                  </div>
                </label>
                <label className={`org-admin-slack-toggle ${slackDraftRoomLeaves ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftRoomLeaves}
                    onChange={(event) => setSlackDraftRoomLeaves(event.target.checked)}
                  />
                  <div>
                    <strong>{t("退室通知")}</strong>
                    <small>{t("メンバーが退出した時（滞在時間付き）")}</small>
                  </div>
                </label>
                <label className={`org-admin-slack-toggle ${slackDraftBreakStarted ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftBreakStarted}
                    onChange={(event) => setSlackDraftBreakStarted(event.target.checked)}
                  />
                  <div>
                    <strong>{t("休憩開始")}</strong>
                    <small>{t("メンバーが休憩に入った時")}</small>
                  </div>
                </label>
                <label className={`org-admin-slack-toggle ${slackDraftRecruitments ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftRecruitments}
                    onChange={(event) => setSlackDraftRecruitments(event.target.checked)}
                  />
                  <div>
                    <strong>{t("募集通知")}</strong>
                    <small>{t("メンバーが募集を出した時")}</small>
                  </div>
                </label>
                <label className={`org-admin-slack-toggle ${slackDraftPosts ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftPosts}
                    onChange={(event) => setSlackDraftPosts(event.target.checked)}
                  />
                  <div>
                    <strong>{t("投稿通知")}</strong>
                    <small>{t("メンバーがフィードに投稿した時")}</small>
                  </div>
                </label>
                <label className={`org-admin-slack-toggle ${slackDraftDailyDigest ? "is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={slackDraftDailyDigest}
                    onChange={(event) => setSlackDraftDailyDigest(event.target.checked)}
                  />
                  <div>
                    <strong>{t("日次サマリー")}</strong>
                    <small>{t("手動送信ボタンから利用（自動配信は今後対応）")}</small>
                  </div>
                </label>
              </div>

              <div className="org-admin-slack-actions">
                <button
                  type="button"
                  className="org-admin-secondary"
                  onClick={handleSlackTestSend}
                  disabled={slackSaveState === "saving"}
                >
                  {t("テスト送信")}
                </button>
                {currentOrganization.slackWebhookUrl && slackDraftDailyDigest ? (
                  <button
                    type="button"
                    className="org-admin-secondary"
                    onClick={handleSendDailyDigest}
                    disabled={slackSaveState === "saving" || isLoadingOrgMembers}
                  >
                    {t("日次サマリーを送信")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="org-admin-primary"
                  onClick={handleSaveSlackSettings}
                  disabled={slackSaveState === "saving"}
                >
                  {slackSaveState === "saving" ? t("保存中…") : t("保存")}
                </button>
              </div>

              {slackSaveMessage ? (
                <p
                  className={`org-admin-slack-message ${slackSaveState === "error" ? "is-error" : "is-info"}`}
                  role="status"
                >
                  {slackSaveMessage}
                </p>
              ) : null}
            </section>

            {/* Domain auto-join — Phase 7. Lets the owner whitelist
                one or more email domains; users with matching emails
                see a one-tap join CTA on home. Stored on the org
                doc; queried by signed-in users via array-contains. */}
            <section className="org-admin-slack" aria-label={t("ドメイン自動参加")}>
              <header className="org-admin-slack-head">
                <div>
                  <p className="card-kicker">Domain auto-join</p>
                  <h3>{t("ドメイン自動参加")}</h3>
                </div>
              </header>
              <p className="org-admin-slack-copy">
                {t("許可するメールドメインを 1 行 1 件で入力します。該当ドメインのGoogle アカウントでサインインしたユーザーは、招待リンクなしで組織に参加できます（任意 / オフのままでも招待リンクは使えます）。")}
              </p>
              <label className="org-admin-slack-field">
                <span>{t("許可ドメイン")}</span>
                <textarea
                  value={domainDraft}
                  onChange={(event) => {
                    setDomainDraft(event.target.value);
                    if (domainSaveState !== "idle") {
                      setDomainSaveState("idle");
                      setDomainSaveMessage("");
                    }
                  }}
                  rows={3}
                  placeholder={"acme.com\nacme.jp"}
                  spellCheck={false}
                />
              </label>
              <div className="org-admin-slack-actions">
                <button
                  type="button"
                  className="org-admin-primary"
                  onClick={handleSaveDomainSettings}
                  disabled={domainSaveState === "saving"}
                >
                  {domainSaveState === "saving" ? t("保存中…") : t("保存")}
                </button>
              </div>
              {domainSaveMessage ? (
                <p
                  className={`org-admin-slack-message ${domainSaveState === "error" ? "is-error" : "is-info"}`}
                  role="status"
                >
                  {domainSaveMessage}
                </p>
              ) : null}
            </section>

            <p className="org-admin-foot">
              {t("個別の学習ログ・投稿内容は admin にも表示しません。投資の可視化のみが目的です。")}
            </p>
          </section>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <section
            className={`settings-modal ${isOnboardingSettings ? "onboarding-settings-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            {/* 右上の閉じるバツ。onboarding 中は飛ばせない (必須入力) ので
                出さない。それ以外では誰でも快適に戻れるように常設。 */}
            {!isOnboardingSettings ? (
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setIsSettingsOpen(false)}
                aria-label={t("設定を閉じる")}
                title={t("設定を閉じる")}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ) : null}
            <div>
              <p className="card-kicker">{isOnboardingSettings ? "Welcome Setup" : "Settings"}</p>
              <h2 id="settings-title">{t("プロフィール設定")}</h2>
              {isOnboardingSettings ? (
                <p className="onboarding-settings-copy">
                  {t("Contribution Arcで使う名前とユーザーIDを設定してください。ユーザーIDはフレンド申請やプロフィール表示に使います。")}
                </p>
              ) : null}
            </div>

            <form className="settings-form" onSubmit={handleSettingsSubmit}>
              {/* 順序 (要望対応): ユーザーネーム → ユーザーID → 言語 →
                  表示サイズ → 分身キャラクター → 通知・組織・削除 …
                  「テーマ (dark/light)」は廃止しライトモードのみ。 */}

              <label>
                <span>{t("ユーザーネーム")}</span>
                {/* autoFocus は撤去: 設定を開くたびにキーボードが出て
                    「変更前提」の挙動になっていたため、ユーザーが意図的
                    にタップした時だけ入力に入るよう普通の挙動に戻す。 */}
                <input
                  value={draftUserName}
                  onChange={(event) => setDraftUserName(event.target.value)}
                  placeholder={t("表示したい名前")}
                  maxLength={24}
                />
              </label>

              <label>
                <span>{t("ユーザーID")}</span>
                <input
                  value={draftUserId}
                  onChange={(event) => setDraftUserId(event.target.value.toLowerCase())}
                  placeholder="ari.dev"
                  maxLength={30}
                  required
                />
                {isOnboardingSettings ? <small>{t("小文字の半角英数字、_、. が使えます。")}</small> : null}
              </label>


              {/* Organization (tenant) management. New in the B2B
                  pivot — gives users a way to create or leave an
                  organization and generate an invite link. Solo
                  users see only the "組織を作成" form; org members
                  see the org name + role + invite button + leave. */}
              {/* Personal data management — Phase 8. Export covers
                  個人情報保護法 / GDPR data-subject access rights;
                  account deletion covers the right to be forgotten.
                  Hidden during onboarding because we don't want to
                  show a delete button to a user who hasn't even
                  finished setting up their profile yet. */}
              <div className="settings-theme-panel" role="group" aria-label={t("言語")}>
                <span className="settings-theme-label">{t("言語")}</span>
                <div className="settings-theme-toggle settings-language-toggle">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={language === lang ? "active" : ""}
                      onClick={() => setLanguage(lang)}
                      aria-pressed={language === lang}
                    >
                      {LANGUAGE_LABELS[lang].native}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-zoom-panel" role="group" aria-label={t("表示サイズ")}>
                <div className="settings-zoom-head">
                  <span className="settings-theme-label">{t("表示サイズ")}</span>
                  <span className="settings-zoom-value" aria-live="polite">
                    {Math.round(uiScale * 100)}%
                  </span>
                </div>
                <div className="settings-zoom-control">
                  <button
                    type="button"
                    className="settings-zoom-step"
                    onClick={() =>
                      setUiScale((v) =>
                        Math.max(UI_SCALE_MIN, Math.round((v - 0.05) * 100) / 100),
                      )
                    }
                    aria-label={t("表示を小さくする")}
                    disabled={uiScale <= UI_SCALE_MIN + 1e-6}
                  >
                    −
                  </button>
                  <input
                    type="range"
                    className="settings-zoom-slider"
                    min={UI_SCALE_MIN}
                    max={UI_SCALE_MAX}
                    step={0.05}
                    value={uiScale}
                    onChange={(event) => setUiScale(parseFloat(event.target.value))}
                    aria-label={t("表示サイズスライダー")}
                  />
                  <button
                    type="button"
                    className="settings-zoom-step"
                    onClick={() =>
                      setUiScale((v) =>
                        Math.min(UI_SCALE_MAX, Math.round((v + 0.05) * 100) / 100),
                      )
                    }
                    aria-label={t("表示を大きくする")}
                    disabled={uiScale >= UI_SCALE_MAX - 1e-6}
                  >
                    ＋
                  </button>
                </div>
              </div>
              {!isOnboardingSettings ? (
                <fieldset className="desktop-notification-settings">
                  <legend>{t("通知")}</legend>
                  {([
                    ["dailyLog", "日報通知"],
                    ["post", "投稿通知"],
                    ["friendRequest", "フレンド申請通知"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <span>{t(label)}</span>
                      <input
                        type="checkbox"
                        checked={desktopNotificationSettings[key]}
                        onChange={(event) =>
                          setDesktopNotificationSettings((settings) => ({
                            ...settings,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <span>{t("通知音")}</span>
                    <input
                      type="checkbox"
                      checked={desktopNotificationSettings.sound}
                      onChange={(event) =>
                        setDesktopNotificationSettings((settings) => ({
                          ...settings,
                          sound: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <div className="notification-sound-control">
                    <div>
                      <span>{t("通知音量")}</span>
                      <small>{Math.round(desktopNotificationSettings.soundVolume * 100)}%</small>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={desktopNotificationSettings.soundVolume}
                      disabled={!desktopNotificationSettings.sound}
                      onChange={(event) =>
                        setDesktopNotificationSettings((settings) => ({
                          ...settings,
                          soundVolume: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="notification-sound-test"
                    disabled={!desktopNotificationSettings.sound || desktopNotificationSettings.soundVolume <= 0}
                    onClick={handleNotificationSoundTest}
                  >
                    {t("通知音をテスト")}
                  </button>
                </fieldset>
              ) : null}


              <div className="settings-character-color-panel" id="settings-character-panel">
                {/* === Hero preview ===
                    現在の shape × color を大きく見せる。色 / 形を変えた
                    瞬間にここがリアルタイム更新されるので、ユーザーは
                    プレビューを見ながらカスタマイズできる。 */}
                <div className="settings-character-hero">
                  <span className="settings-character-hero-stage">
                    <ProfileCharacterPreview
                      color={playerCharacterColor}
                      shape={playerCharacterShape}
                    />
                  </span>
                  <div className="settings-character-hero-text">
                    <span className="settings-character-hero-kicker">
                      {t("分身キャラクター")}
                    </span>
                    {(() => {
                      const active = characterShapeOptions.find((o) => o.value === playerCharacterShape);
                      if (!active) return null;
                      return (
                        <>
                          <strong className="settings-character-hero-name">
                            {t(active.name)} <span>{active.romaji}</span>
                          </strong>
                          <small className="settings-character-hero-tag">{t(active.tagline)}</small>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* === Shape (シルエット) ===
                    縦並びカードを横並びコンパクトカードに圧縮。1 行内に
                    収まるので「3 種から選ぶ」が一目で分かる。 */}
                <div className="settings-character-section">
                  <p className="settings-character-section-label">{t("シルエット")}</p>
                  <div className="character-shape-row" aria-label={t("キャラクターの形")}>
                    {characterShapeOptions.map((option) => {
                      const isLocked = !ownedCharacterShapes.includes(option.value);
                      const isActive = playerCharacterShape === option.value;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={`character-shape-tile${isActive ? " is-active" : ""}${
                            isLocked ? " is-locked" : ""
                          }`}
                          onClick={() => {
                            if (isLocked) {
                              /* iOS は Shop 動線そのものが無いので
                                 ロック中タイルは無反応にする (将来 IAP
                                 実装が入ったらここを差し替える)。 */
                              if (IS_IOS_BUILD) return;
                              setIsSettingsOpen(false);
                              setCurrentView("shop");
                            } else {
                              chooseCharacterShape(option.value);
                            }
                          }}
                          title={isLocked ? `${t(option.name)} ${option.romaji}${t("（ショップで購入）")}` : `${t(option.name)} ${option.romaji}`}
                          aria-label={
                            isLocked
                              ? `${t(option.name)} ${option.romaji}${t("はショップで購入できます")}`
                              : `${t(option.name)} ${option.romaji}${t("を選択")}`
                          }
                          aria-pressed={isActive}
                        >
                          <span className="character-shape-tile-preview" aria-hidden="true">
                            <ProfileCharacterPreview
                              color={playerCharacterColor}
                              shape={option.value}
                            />
                          </span>
                          <span className="character-shape-tile-name">
                            {t(option.name)}
                            <small>{option.romaji}</small>
                          </span>
                          {isLocked ? (
                            <span className="character-shape-tile-badge is-lock" aria-hidden="true">
                              🔒
                            </span>
                          ) : isActive ? (
                            <span className="character-shape-tile-badge is-check" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* === Color (カラー) ===
                    縦並びボタンを横並びの円形スウォッチに変更。色名は
                    title (tooltip) と aria-label に残し、画面の情報量を
                    減らして「色を選ぶ」が一目で分かる。 */}
                <div className="settings-character-section">
                  <p className="settings-character-section-label">{t("カラー")}</p>
                  <div className="character-color-row" aria-label={t("分身カラー")}>
                    {characterColorOptions.map((color) => {
                      const isActive = playerCharacterColor === color.value;
                      return (
                        <button
                          type="button"
                          key={color.value}
                          className={`character-color-swatch${isActive ? " is-active" : ""}`}
                          onClick={() => chooseCharacterColor(color.value)}
                          title={t(color.name)}
                          aria-label={`${t(color.name)}${t("を選択")}`}
                          aria-pressed={isActive}
                        >
                          <span style={{ background: color.value }} />
                          {isActive ? (
                            <span className="character-color-swatch-check" aria-hidden="true">✓</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!isOnboardingSettings ? (
                <fieldset className="desktop-notification-settings auto-post-settings">
                  <legend>{t("自動投稿")}</legend>
                  <label className="auto-post-toggle">
                    <span>
                      <strong>{t("学習・作業の積み上げを自動で投稿する")}</strong>
                      <small>
                        {t("作業部屋を5分以上利用したり、本のページが進んだら自動でタイムラインに流れます。仲間の積み上げが見えるようになり、お互いを応援しやすくなります。")}
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={isAutoPostEnabled}
                      onChange={(event) => setIsAutoPostEnabled(event.target.checked)}
                    />
                  </label>
                </fieldset>
              ) : null}

              {!isOnboardingSettings ? (
                <fieldset className="desktop-notification-settings install-app-settings">
                  <legend>{t("スマホアプリ")}</legend>
                  <div className="auto-post-toggle">
                    <span>
                      <strong>{t("スマホアプリとしてダウンロード")}</strong>
                      <small>
                        {t("ホーム画面 / Dock に追加すると、ブラウザを開かずに 1 タップで起動できます。iPhone / Android どちらも対応。アイコンを更新したい場合もここから手順を確認できます。")}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="install-app-cta"
                      onClick={() => setIsInstallModalOpen(true)}
                    >
                      {t("ダウンロード")}
                    </button>
                  </div>
                </fieldset>
              ) : null}

              {!isOnboardingSettings ? (
                <details className="settings-guide">
                  <summary>
                    <span className="settings-guide-title">{t("Contribution Arc の使い方")}</span>
                    <span className="settings-guide-hint">{t("はじめての方へ")}</span>
                  </summary>
                  <dl className="settings-guide-body">
                    <div className="settings-guide-item">
                      <dt>{t("ライブラリ")}</dt>
                      <dd>{t("学んだことを記録すると、積み上げがグラフに残ります。まずはここから。")}</dd>
                    </div>
                    <div className="settings-guide-item">
                      <dt>{t("日報")}</dt>
                      <dd>{t("その日の予定と振り返りを書いて、仲間と共有できます。")}</dd>
                    </div>
                    <div className="settings-guide-item">
                      <dt>{t("みんなの記録")}</dt>
                      <dd>{t("フレンドや仲間の投稿・日報が流れてきます。ハートやリプライで反応できます。")}</dd>
                    </div>
                    <div className="settings-guide-item">
                      <dt>{t("作業部屋")}</dt>
                      <dd>{t("同じ部屋に入って一緒に作業できます。今やっていることがリアルタイムで共有されます。")}</dd>
                    </div>
                    <div className="settings-guide-item">
                      <dt>{t("フレンド")}</dt>
                      <dd>{t("相手のユーザーIDで申請し、承認されるとつながります。申請はお知らせに届きます。")}</dd>
                    </div>
                    <div className="settings-guide-item">
                      <dt>{t("組織")}</dt>
                      <dd>{t("会社やチームで使うときは、組織を作って招待リンクで仲間を招きます。組織限定の作業部屋が作れます。")}</dd>
                    </div>
                  </dl>
                </details>
              ) : null}

              {!isOnboardingSettings ? (
                <div className="settings-org-panel" role="group" aria-label={t("組織")}>
                  <div className="settings-org-head">
                    <span>{t("組織")}</span>
                    {currentOrganization ? (
                      <span className="settings-org-role">
                        {currentOrganization.ownerUid === currentUser?.uid ? t("オーナー") : t("メンバー")}
                      </span>
                    ) : null}
                  </div>
                  {currentOrganization ? (
                    <div className="settings-org-current">
                      <strong>{currentOrganization.name}</strong>
                      <p className="settings-org-copy">
                        {t("組織限定のルームを作って、社内・チーム内だけで一緒に作業できます。")}
                      </p>
                      <div className="settings-org-actions">
                        <button
                          type="button"
                          className="settings-org-invite"
                          onClick={handleCreateOrgInvite}
                          disabled={isOrgWorking}
                        >
                          {t("招待リンクをコピー")}
                        </button>
                        {currentOrganization.ownerUid === currentUser?.uid ? (
                          <button
                            type="button"
                            className="settings-org-admin"
                            onClick={handleOpenOrgAdmin}
                          >
                            {t("メンバー一覧 / Admin")}
                          </button>
                        ) : null}
                        {currentOrganization.ownerUid !== currentUser?.uid ? (
                          <button
                            type="button"
                            className="settings-org-leave"
                            onClick={handleLeaveOrganization}
                            disabled={isOrgWorking}
                          >
                            {t("退出")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="settings-org-create">
                      <p className="settings-org-copy">
                        {t("会社やチームで使う場合は、組織を作って招待リンクで仲間を招きます。組織限定のルームで他社や他チームから見えない作業空間が作れます。")}
                      </p>
                      <div className="settings-org-create-row">
                        <input
                          value={newOrgName}
                          onChange={(event) => {
                            setNewOrgName(event.target.value);
                            if (orgError) setOrgError("");
                          }}
                          placeholder={t("例: Acme Inc.")}
                          maxLength={64}
                          aria-label={t("組織名")}
                        />
                        <button
                          type="button"
                          onClick={handleCreateOrganization}
                          disabled={isOrgWorking}
                        >
                          {t("作成")}
                        </button>
                      </div>
                    </div>
                  )}
                  {orgError ? <p className="settings-org-error">{t(orgError)}</p> : null}
                </div>
              ) : null}

              {!isOnboardingSettings ? (
                <div className="settings-data-panel" role="group" aria-label={t("個人データ管理")}>
                  <div className="settings-data-head">
                    <span>{t("個人データ管理")}</span>
                  </div>
                  <p className="settings-org-copy">
                    {t("あなたの学習ログ・投稿・組織メンバーシップなどを JSON で一括ダウンロードできます。アカウント削除は元に戻せません。")}
                  </p>
                  <div className="settings-data-actions">
                    <button
                      type="button"
                      className="settings-data-export"
                      onClick={handleExportPersonalData}
                      disabled={isExportingData}
                    >
                      {isExportingData ? t("エクスポート中…") : t("データをエクスポート")}
                    </button>
                    <button
                      type="button"
                      className="settings-data-delete"
                      onClick={() => {
                        if (currentOrganization?.ownerUid === currentUser?.uid) {
                          window.alert(
                            t("オーナーは削除できません。Admin ダッシュボードからオーナーを譲渡してから削除してください。"),
                          );
                          return;
                        }
                        setIsDeleteConfirmOpen(true);
                        setDeleteConfirmText("");
                        setDeleteError("");
                      }}
                    >
                      {t("アカウントを削除")}
                    </button>
                  </div>
                  {/* App Store / Google Play 提出には Privacy Policy への
                      アプリ内からのアクセスが必要。言語に合わせて HTML を
                      切替 (en → privacy.html / ja → privacy.ja.html)。 */}
                  <p className="settings-data-legal">
                    <a
                      href={`${import.meta.env.BASE_URL}${language === "ja" ? "privacy.ja.html" : "privacy.html"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("プライバシーポリシー")}
                    </a>
                  </p>
                </div>
              ) : null}

              {settingsError ? <p className="settings-error">{t(settingsError)}</p> : null}

              <div className="settings-actions">
                {!isOnboardingSettings ? (
                  <button type="button" className="settings-secondary" onClick={() => setIsSettingsOpen(false)}>
                    {t("キャンセル")}
                  </button>
                ) : null}
                <button type="submit" className="settings-primary" disabled={isSavingSettings}>
                  {isSavingSettings ? t("保存中…") : isOnboardingSettings ? t("Contribution Arcを始める") : t("保存")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {/* 旧 ユーザー検索フル画面モーダルは topbar のアイコン直下に
          inline popover として吸収済み (Friends 同型)。モーダルだと
          開いた瞬間 backdrop が body を覆って画面が下にスクロールされる
          という報告があったため。コードはコミット履歴に残るので
          ここでは復活させない。 */}

      {/* 目標 (志望校 / 資格) 選択モーダル。プロフィールメニューから開く。
          EN モードでは GoalPickerModal が free-text 入力に切替わるので、
          onSelectCustom 経由で goalCustomName を保存する。 */}
      {isGoalPickerOpen ? (
        <GoalPickerModal
          currentGoalId={goalId}
          currentCustomName={goalCustomName}
          onSelect={(id) => {
            setGoalId(id);
            setGoalCustomName("");
            setIsGoalPickerOpen(false);
            /* 選んだその場で (1) localStorage に即ミラー = この端末では
               リロードで確実に残る、(2) user doc にも即時保存して
               cross-device 同期。useEffect 同期のタイミングに依存しない。 */
            if (currentUser) {
              const scope = getAccountStorageScope(currentUser.uid, userId);
              safeSetLocalStorage(getAccountStorageKey(scope, "goal-id"), id);
              safeSetLocalStorage(getAccountStorageKey(scope, "goal-custom-name"), "");
              safeSetLocalStorage(
                getAccountStorageKey(scope, "goal-updated-at"),
                String(Date.now()),
              );
              void saveUserGoalToCloud(db, currentUser.uid, {
                goalId: id,
                goalCustomName: "",
              }).catch((error) => {
                console.info("Goal cloud save (select) skipped.", error);
              });
            }
          }}
          onSelectCustom={(customName) => {
            setGoalId("");
            setGoalCustomName(customName);
            setIsGoalPickerOpen(false);
            if (currentUser) {
              const scope = getAccountStorageScope(currentUser.uid, userId);
              safeSetLocalStorage(getAccountStorageKey(scope, "goal-id"), "");
              safeSetLocalStorage(
                getAccountStorageKey(scope, "goal-custom-name"),
                customName,
              );
              safeSetLocalStorage(
                getAccountStorageKey(scope, "goal-updated-at"),
                String(Date.now()),
              );
              void saveUserGoalToCloud(db, currentUser.uid, {
                goalId: "",
                goalCustomName: customName,
              }).catch((error) => {
                console.info("Goal cloud save (custom) skipped.", error);
              });
            }
          }}
          onClear={() => {
            setGoalId("");
            setGoalCustomName("");
            setIsGoalPickerOpen(false);
            if (currentUser) {
              const scope = getAccountStorageScope(currentUser.uid, userId);
              safeSetLocalStorage(getAccountStorageKey(scope, "goal-id"), "");
              safeSetLocalStorage(getAccountStorageKey(scope, "goal-custom-name"), "");
              safeSetLocalStorage(
                getAccountStorageKey(scope, "goal-updated-at"),
                String(Date.now()),
              );
              void saveUserGoalToCloud(db, currentUser.uid, {
                goalId: "",
                goalCustomName: "",
              }).catch((error) => {
                console.info("Goal cloud save (clear) skipped.", error);
              });
            }
          }}
          onClose={() => setIsGoalPickerOpen(false)}
        />
      ) : null}

      {/* 同じ目標のユーザー一覧モーダル。chip 上の「同じ目標の人を探す」
          から開かれる。read-only な list + プロフィール行で構成。 */}
      {goalMatchModal ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={() => setGoalMatchModal(null)}
        >
          <section
            className="settings-modal goal-match-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-match-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="goal-match-modal-head">
              <div>
                <p className="card-kicker">{t("同じ目標")}</p>
                <h2 id="goal-match-modal-title">{goalMatchModal.goalLabel}</h2>
              </div>
              <button
                type="button"
                className="goal-match-modal-close"
                onClick={() => setGoalMatchModal(null)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </header>
            {goalMatchModal.loading ? (
              <p className="goal-match-modal-loading">{t("読み込み中…")}</p>
            ) : goalMatchModal.error ? (
              <p className="goal-match-modal-error">{goalMatchModal.error}</p>
            ) : goalMatchModal.users.length === 0 ? (
              <p className="goal-match-modal-empty">
                {t("同じ目標のユーザーはまだ見つかりません。")}
              </p>
            ) : (
              <ul className="goal-match-modal-list">
                {goalMatchModal.users.map((user) => {
                  const look = resolveAuthorAppearance(
                    user.uid,
                    user.characterColor,
                    user.characterShape,
                  );
                  return (
                    <li key={user.uid}>
                      <button
                        type="button"
                        className="goal-match-modal-row"
                        onClick={() => void handleOpenUserFromGoalMatch(user)}
                      >
                        <ProfileCharacterPreview color={look.color} shape={look.shape} />
                        <span className="goal-match-modal-row-text">
                          <strong>{user.displayName || "Developer"}</strong>
                          <small>
                            {user.userId ? `@${user.userId}` : ""}
                            {user.userId && user.level ? " · " : ""}
                            {user.level ? `Lv.${user.level}` : ""}
                            {user.streak > 0 ? ` · 🔥${user.streak}` : ""}
                          </small>
                          {user.determination ? (
                            <em className="goal-match-modal-row-det">
                              {user.determination}
                            </em>
                          ) : null}
                        </span>
                        <span aria-hidden="true" className="goal-match-modal-row-arrow">
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {/* お知らせ一覧モーダル。ホームには pinned + 最新 1 件だけ出して
          いるので、過去のお知らせを全部見たい時はここで一覧表示する。 */}
      {isAnnouncementsModalOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={() => setIsAnnouncementsModalOpen(false)}
        >
          <section
            className="announcements-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcements-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="announcements-modal-head">
              <div>
                <p className="card-kicker">{t("お知らせ")}</p>
                <h2 id="announcements-modal-title">{t("運営からのお知らせ")}</h2>
              </div>
              <button
                type="button"
                className="announcements-modal-close"
                onClick={() => setIsAnnouncementsModalOpen(false)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </header>
            <ol className="home-announcements-list announcements-modal-list">
              {ANNOUNCEMENTS.map((announcement) => {
                const isOpen = openAnnouncementId === announcement.id;
                return (
                  <li
                    key={announcement.id}
                    className={`home-announcement-item${isOpen ? " is-open" : ""}${announcement.pinned ? " is-pinned" : ""}`}
                  >
                    <button
                      type="button"
                      className="home-announcement-trigger"
                      onClick={() =>
                        setOpenAnnouncementId((current) =>
                          current === announcement.id ? null : announcement.id,
                        )
                      }
                      aria-expanded={isOpen}
                    >
                      <span className="home-announcement-row-text">
                        <span className="home-announcement-date">
                          {announcement.pinned ? (
                            <span className="home-announcement-pin" aria-hidden="true">📌 </span>
                          ) : null}
                          {announcement.date}
                        </span>
                        <strong className="home-announcement-title">{t(announcement.title)}</strong>
                      </span>
                      <span
                        className={`home-announcement-chevron${isOpen ? " is-open" : ""}`}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M9 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="home-announcement-body">
                        <p className="home-announcement-body-text">{t(announcement.body)}</p>
                        {announcement.pinned ? (
                          <button
                            type="button"
                            className="home-announcement-feedback-cta"
                            onClick={() => {
                              setFeedbackError("");
                              setIsFeedbackModalOpen(true);
                              setIsAnnouncementsModalOpen(false);
                            }}
                          >
                            {t("要望を書く")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      ) : null}

      {/* 要望フォームモーダル。固定お知らせの「要望を書く」から開く。
          送信内容は Firestore feedback コレクションへ。 */}
      {isFeedbackModalOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={() => setIsFeedbackModalOpen(false)}
        >
          <section
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="feedback-modal-head">
              <div>
                <p className="card-kicker">Feedback</p>
                <h2 id="feedback-modal-title">{t("ご要望・不具合のご報告")}</h2>
              </div>
              <button
                type="button"
                className="announcements-modal-close"
                onClick={() => setIsFeedbackModalOpen(false)}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </header>
            <p className="feedback-modal-lead">
              {t("追加してほしい機能や不具合など、お気軽にお寄せください。今後の開発の参考にさせていただきます。")}
            </p>
            <form
              className="feedback-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleFeedbackSubmit();
              }}
            >
              <textarea
                value={feedbackDraft}
                onChange={(event) => {
                  setFeedbackDraft(event.target.value);
                  setFeedbackError("");
                }}
                placeholder={t("例: 日報にタグを付けられるようにしてほしい / ○○の画面で△△が起きる")}
                maxLength={2000}
                rows={6}
                autoFocus
              />
              <div className="feedback-form-foot">
                {feedbackError ? (
                  <span className="feedback-form-error" role="alert">{feedbackError}</span>
                ) : (
                  <span className="feedback-form-count">{feedbackDraft.length}/2000</span>
                )}
                <button
                  type="submit"
                  className="feedback-form-submit"
                  disabled={isSendingFeedback || !feedbackDraft.trim()}
                >
                  {isSendingFeedback ? t("送信中…") : t("送信する")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingJoinRoom ? (
        <div className="settings-modal-backdrop" role="presentation">
          <section
            className="workspace-start-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-start-title"
          >
            <div>
              <p className="card-kicker" id="workspace-start-title">Start Session / {pendingJoinRoom.name}</p>
            </div>

            <form className="workspace-start-form" onSubmit={handleWorkspaceStart}>
              <label>
                <span>{t("作業内容")}</span>
                <input
                  value={workspaceDraftTask}
                  onChange={(event) => {
                    setWorkspaceDraftTask(event.target.value);
                    if (workspaceStartError) {
                      setWorkspaceStartError("");
                    }
                  }}
                  placeholder=""
                  maxLength={48}
                  autoFocus
                />
              </label>
              {workspaceStartError ? <p className="workspace-start-error">{workspaceStartError}</p> : null}

              <fieldset className="workspace-start-color">
                <legend>{t("記録カラー")}</legend>
                <div className="workspace-start-colors">
                  {studyColorOptions.map((color) => (
                    <label key={color.value} title={t(color.name)}>
                      <input
                        type="radio"
                        name="workspace-session-color"
                        value={color.value}
                        checked={workspaceDraftColor === color.value}
                        onChange={(event) => setWorkspaceDraftColor(event.target.value)}
                      />
                      <span style={{ background: color.value }} />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="workspace-start-actions">
                <button type="button" onClick={() => setPendingJoinRoomId(null)}>
                  {t("Cancel")}
                </button>
                <button type="submit">{t("作業を始める")}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <div
        className={`two-pane-shell${
          currentView !== "workspace" && !isFeedOpen ? " is-feed-collapsed" : ""
        }`}
      >
      <div className="two-pane-left">

      {currentView === "daily" ? (
        <motion.section
          className="daily-screen"
          aria-label="Daily report"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {currentUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="daily"
              title={t("日報 — 1日のはじまりと締めくくり")}
              body={t("その日の計画と振り返りを残すと、明日の自分への布石になります。")}
              bullets={[
                t("「計画」欄に朝の予定を、「振り返り」欄に夜の感想を書きます"),
                t("保存は自動。書きかけのまま画面を離れても消えません"),
                t("他の人の日報もここから読めて、刺激を受けられます"),
                t("編集できるのは当日と前日まで(過去の自分に向き合うため)"),
              ]}
            />
          ) : null}
          <section className="daily-editor-card">
            <div className="daily-editor-head">
              <div>
                <p className="card-kicker">Daily Report</p>
                <h1 className="daily-editor-title">{t("日報")}</h1>
                {/* 連続記録ストリーク。1日以上連続なら表示。0日なら出さない
                    (新規ユーザーへのプレッシャーを抑制)。 */}
                {dailyReportStreak > 0 ? (
                  <p className="daily-streak-badge" aria-label={t("{count}日連続で日報を書いています", { count: dailyReportStreak })}>
                    <img className="streak-flame-icon" src={streakFlameIcon} alt="" aria-hidden="true" />
                    {t("{count}日連続", { count: dailyReportStreak })}
                  </p>
                ) : null}
              </div>
              <div className="daily-editor-head-actions">
                {/* 日報を画像カードとして共有/保存。ホーム画面ウィジェット
                    の代替（写真に保存 → 写真ウィジェットに置ける）。 */}
                <button
                  type="button"
                  className="daily-share-image-button"
                  onClick={() => void handleShareDailyImage()}
                  aria-label={t("日報を画像で共有")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M12 3v11m0-11 3.5 3.5M12 3 8.5 6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t("画像で共有")}</span>
                </button>
                <label>
                  <span>{t("日付")}</span>
                  <input
                    type="date"
                    value={selectedDailyDate}
                    onChange={(event) => handleDailyDateChange(event.target.value)}
                  />
                </label>
              </div>
            </div>

            {/* シンプル投稿 + 日報アプリへの方向転換に伴い、日報上部の
                学習サマリー (学習時間 / 記録 / 最も取り組んだ) は撤去。
                書く行為そのものに集中するため、定量的なメタ情報は出さない。 */}

            {(() => {
              // 当日の日報を編集中なら「両方共有で +50 Arc」のバナーを出す。
              // 達成 (受領済み) なら「獲得済み」表示に切替えて、明日のループへ
              // 期待を引き継ぐ。過去日報の編集ビューでは出さない。
              if (selectedDailyDate !== todayDateKey) return null;
              const todayReport = dailyReports.find((r) => r.date === selectedDailyDate);
              const earned = lastDailyReportRewardDate === todayDateKey;
              const planDone =
                (todayReport?.planItems?.length ?? 0) > 0 && !todayReport?.isDraft;
              const reflectionDone =
                ((todayReport?.reflection || "").trim().length > 0) && !todayReport?.isDraft;
              return (
                <div
                  className={`daily-reward-banner${earned ? " is-earned" : ""}`}
                  role="status"
                >
                  <span className="daily-reward-banner-icon" aria-hidden="true">✦</span>
                  {earned ? (
                    <span className="daily-reward-banner-text">
                      <strong>{t("+50 Arc 獲得済み")}</strong>
                      <small>{t("明日も「今日やること」と「振り返り」の両方共有で Arc を狙えます。")}</small>
                    </span>
                  ) : (
                    <span className="daily-reward-banner-text">
                      <strong>{t("両方を共有すると +50 Arc / 日")}</strong>
                      <span className="daily-reward-banner-progress" aria-label={t("今日の達成状況")}>
                        <span className={planDone ? "is-done" : ""}>
                          {planDone ? "✓ " : "・"}
                          {t("今日やること")}
                        </span>
                        <span className={reflectionDone ? "is-done" : ""}>
                          {reflectionDone ? "✓ " : "・"}
                          {t("振り返り")}
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              );
            })()}

            {!canEditSelectedDailyReport ? (
              <p className="daily-edit-note">{t("日報の編集は当日または1日前までです。")}</p>
            ) : null}

            <div className="daily-editor-form">
              {/* 下書きトグル UI は撤去。新規日報は常に共有扱い (= isDraft
                  false)。過去日報の isDraft 値は state 側で引き継がれる
                  ので、過去下書きが「強制的に共有される」事故は起きない。 */}
              <p className="daily-editor-autosave-note">
                {t("ローカル下書きとして自動保存されます。")}
              </p>

              <form className="daily-entry-card" onSubmit={(event) => handleDailyReportSectionSubmit(event, "plan")}>
                <div className="daily-entry-label-row">
                  <span className="daily-entry-label">{t("今日やること")}</span>
                  <small className="daily-entry-hint">
                    {t("1行1タスク。完了したらチェックして、必要なら一言メモを残せます。")}
                  </small>
                </div>
                {/* クイックアクション：過去の plan items を再利用。
                    実用面で最も需要が高い「持ち越し」「前日コピー」を 1 タップで。 */}
                {canEditSelectedDailyReport ? (
                  <div className="daily-plan-quick-actions" role="group" aria-label={t("過去の計画から引き継ぎ")}>
                    <button
                      type="button"
                      className="daily-plan-quick-action"
                      onClick={handleCarryOverUnfinished}
                      title={t("過去の未完了タスクを今日に持ち越す")}
                    >
                      {t("未完了を持ち越し")}
                    </button>
                    <button
                      type="button"
                      className="daily-plan-quick-action"
                      onClick={handleCopyPreviousDayPlan}
                      title={t("前日の計画をすべて今日にコピー")}
                    >
                      {t("前日の計画をコピー")}
                    </button>
                  </div>
                ) : null}
                {/* Plan items の完了率 progress bar。1 件以上の項目がある時
                    だけ表示。視覚的に「今日どれだけ進んだか」を可視化。 */}
                {planProgress.total > 0 ? (
                  <div
                    className="daily-plan-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={planProgress.total}
                    aria-valuenow={planProgress.done}
                    aria-label={t("今日やることの進捗")}
                  >
                    <div className="daily-plan-progress-meta">
                      <span>
                        {t("{done}/{total} 完了", { done: planProgress.done, total: planProgress.total })}
                      </span>
                      <strong>{Math.round(planProgress.ratio * 100)}%</strong>
                    </div>
                    <div className="daily-plan-progress-track">
                      <div
                        className="daily-plan-progress-fill"
                        style={{ width: `${Math.round(planProgress.ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <DailyPlanChecklist
                  items={dailyPlanItemsDraft}
                  onChange={setDailyPlanItemsDraft}
                  disabled={!canEditSelectedDailyReport}
                  ariaLabel={t("今日やること")}
                  labels={{
                    addItem: t("項目を追加"),
                    placeholderText: t("やることを1行で"),
                    placeholderComment: t("完了メモ(任意) — 何をやったか / 何で詰まったか"),
                    carriedFrom: t("←前日から"),
                    remove: t("削除"),
                    commentAriaLabel: t("完了メモ"),
                  }}
                />

                <div className="daily-editor-actions">
                  <button type="submit" disabled={isSavingDailyReport || !canEditSelectedDailyReport}>
                    {isSavingDailyReport
                      ? t("保存中")
                      : dailyIsDraftDraft
                        ? t("下書きで保存")
                        : selectedDailyReport?.planItems?.length || selectedDailyReport?.plan
                          ? t("今日やることを更新")
                          : t("今日やることを送信")}
                  </button>
                </div>
              </form>

              <form
                className="daily-entry-card"
                onSubmit={(event) => handleDailyReportSectionSubmit(event, "reflection")}
              >
                <div className="daily-entry-label-row">
                  <span className="daily-entry-label">{t("振り返り")}</span>
                </div>
                {/* 今日やることの箇条書きを振り返り欄の上部に再掲する。
                    やること編集側は完了で斜線になるが、ここでは斜線を出さず
                    チェック状態（項目チェック）のみを示し、書きながら各項目を
                    見返せるようにする。下書きの内容をそのまま参照するので、
                    保存前・記入中でもライブで表示される。 */}
                {(() => {
                  const recapItems = dailyPlanItemsDraft.filter(
                    (item) => item.text.trim().length > 0,
                  );
                  if (recapItems.length === 0) {
                    return null;
                  }
                  /* 振り返り欄からもチェックを付け外しできるように、
                     行全体を button にする。state は dailyPlanItemsDraft
                     を直接更新するので、上の「やること」セクションと
                     完全に同期。保存は既存の save ボタンで一括。 */
                  const toggleRecap = (id: string) => {
                    if (!canEditSelectedDailyReport) return;
                    setDailyPlanItemsDraft((items) =>
                      items.map((item) =>
                        item.id === id ? { ...item, done: !item.done } : item,
                      ),
                    );
                  };
                  return (
                    <ul className="reflection-recap" aria-label={t("今日やること")}>
                      {recapItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`reflection-recap-row${item.done ? " is-checked" : ""}`}
                            onClick={() => toggleRecap(item.id)}
                            disabled={!canEditSelectedDailyReport}
                            aria-pressed={item.done}
                            aria-label={item.done ? t("{text} (完了)", { text: item.text }) : item.text}
                          >
                            <span
                              className={`reflection-recap-box${item.done ? " is-checked" : ""}`}
                              aria-hidden="true"
                            >
                              {item.done ? "✓" : ""}
                            </span>
                            <span className="reflection-recap-text">{item.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                {/* 当日選択かつ "今日" の学習ログが 1 件以上ある時だけ、
                    Highlight 欄に一行サマリを挿入する CTA を出す。
                    既存内容には prepend する (上書きはしない)。
                    ログが無い日に出しても押した瞬間にトーストが出るだけで
                    無駄な誘導になるので、事前に non-empty を確認して出す。 */}
                {(() => {
                  if (!canEditSelectedDailyReport) return null;
                  if (selectedDailyDate !== getLearnerDate()) return null;
                  const summary = summarizeStudyLogsForDate(
                    studyLogs,
                    selectedDailyDate,
                    t,
                    language,
                  );
                  if (!summary) return null;
                  return (
                    <div className="reflection-autodraft-row">
                      <button
                        type="button"
                        className="reflection-autodraft-btn"
                        onClick={() => {
                          setDailyReflectionPartsDraft((parts) => ({
                            ...parts,
                            highlight: parts.highlight
                              ? `${summary}\n${parts.highlight}`
                              : summary,
                          }));
                        }}
                        title={summary}
                      >
                        ✦ {t("今日のログから下書きを挿入")}
                      </button>
                    </div>
                  );
                })()}

                {REFLECTION_SECTION_KEYS.map((key) => {
                  const labelText =
                    key === "highlight"
                      ? t("今日のハイライト")
                      : key === "stuck"
                        ? t("つまずき")
                        : t("明日の最初の一歩");
                  const placeholder =
                    key === "highlight"
                      ? t("いちばん進んだこと・気づき")
                      : key === "stuck"
                        ? t("詰まったところ・分からなかったところ")
                        : t("明日まず手をつけること");
                  return (
                    <label key={key} className="reflection-section" data-section={key}>
                      <span className="reflection-section-label">
                        <span className="reflection-section-icon" aria-hidden="true">
                          <ReflectionSectionIcon section={key} />
                        </span>
                        <span>{labelText}</span>
                      </span>
                      <DailyMentionTextarea
                        value={dailyReflectionPartsDraft[key]}
                        onChange={(value) =>
                          setDailyReflectionPartsDraft((parts) => ({ ...parts, [key]: value }))
                        }
                        placeholder={placeholder}
                        rows={3}
                        disabled={!canEditSelectedDailyReport}
                        candidates={dailyMentionCandidates}
                        ariaLabel={labelText}
                      />
                    </label>
                  );
                })}

                <div className="daily-editor-actions">
                  <button type="submit" disabled={isSavingDailyReport || !canEditSelectedDailyReport}>
                    {isSavingDailyReport
                      ? t("保存中")
                      : dailyIsDraftDraft
                        ? t("下書きで保存")
                        : selectedDailyReport?.reflection
                          ? t("振り返りを更新")
                          : t("振り返りを送信")}
                  </button>
                </div>
              </form>
              {dailyMessage ? <p className="daily-message">{dailyMessage}</p> : null}
            </div>
          </section>

          <aside className="daily-history-card">
            <div className="daily-history-tabs" role="tablist" aria-label={t("日報の記録")}>
              <button
                type="button"
                role="tab"
                aria-selected={dailyHistoryTab === "mine"}
                className={`daily-history-tab${dailyHistoryTab === "mine" ? " is-active" : ""}`}
                onClick={() => setDailyHistoryTab("mine")}
              >
                <span>{t("自分の記録")}</span>
                <small>{dailyReports.length}</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dailyHistoryTab === "team"}
                className={`daily-history-tab${dailyHistoryTab === "team" ? " is-active" : ""}`}
                onClick={() => {
                  setDailyHistoryTab("team");
                  /* 「みんなの日報」を初めて押した瞬間に自動 fetch する。
                     以前は中の "Team Daily を読み込む" ボタンをもう一度
                     押す 2 step UI で「タップしたのに何も出ない」と感じる
                     原因になっていた。既に読込済み or in-flight ならスキップ。 */
                  if (!isSharedDailyLoaded && !isLoadingSharedDaily) {
                    void handleLoadSharedDailyReports();
                  }
                }}
              >
                <span>{t("みんなの日報")}</span>
                {isSharedDailyLoaded ? (
                  <small>{allVisibleSharedDailyReports.length}</small>
                ) : null}
              </button>
            </div>

            {dailyHistoryTab === "mine" ? (
            <div className="daily-history-panel" role="tabpanel">
            <div className="daily-history-filters" aria-label={t("過去の日報を絞り込む")}>
              <label>
                <span>{t("日付")}</span>
                <input
                  type="date"
                  value={dailyHistoryDateFilter}
                  onChange={(event) => setDailyHistoryDateFilter(event.target.value)}
                />
              </label>
              <label>
                <span>{t("検索")}</span>
                <input
                  type="search"
                  value={dailyHistorySearch}
                  onChange={(event) => setDailyHistorySearch(event.target.value)}
                  placeholder={t("本文・日付から探す")}
                />
              </label>
              {dailyHistoryDateFilter || dailyHistorySearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setDailyHistoryDateFilter("");
                    setDailyHistorySearch("");
                  }}
                >
                  {t("クリア")}
                </button>
              ) : null}
            </div>
            <div className="daily-history-list">
              {filteredDailyReports.length > 0 ? (() => {
                /* 検索 / 日付フィルタ中はフィルタヒットを全件出す
                   (期待外で隠すと「探した日報が無い」と誤認するため)。
                   未フィルタ時のみ "7 日表示 → もっと見る で 50 件" の
                   ふるい分けを適用する。 */
                const isFiltered = Boolean(dailyHistoryDateFilter || dailyHistorySearch);
                const todayKey = getLearnerDate();
                const visibleReports = isFiltered
                  ? filteredDailyReports.slice(0, 50)
                  : showAllMyReports
                    ? filteredDailyReports.slice(0, 50)
                    : filteredDailyReports.slice(0, 7);
                const hasMore = !isFiltered && filteredDailyReports.length > visibleReports.length;
                return (
                  <>
                    {visibleReports.map((report) => {
                      const isToday = report.date === todayKey;
                      return (
                      <article
                        key={report.id}
                        className={`${report.date === selectedDailyDate ? "active" : ""}${
                          isToday ? " is-today" : ""
                        }`.trim()}
                      >
                        <button type="button" onClick={() => handleDailyDateChange(report.date)}>
                          <strong>
                            {formatDailyDate(report.date, language)}
                            {isToday ? (
                              <span className="daily-history-badge is-today" aria-label={t("今日")}>
                                {t("今日")}
                              </span>
                            ) : null}
                            {report.isDraft ? (
                              <span className="daily-history-badge" aria-label={t("下書き")}>
                                {t("下書き")}
                              </span>
                            ) : null}
                          </strong>
                          <span>{report.plan || t("今日やることは未入力")}</span>
                          <small>{report.reflection ? t("振り返り済み") : t("振り返り未入力")}</small>
                        </button>
                        {/* 詳細モーダルへの導線。削除や全文表示はここから。 */}
                        <button
                          type="button"
                          className="daily-history-detail-button"
                          onClick={() => setExpandedDailyReport(report)}
                          aria-label={t("詳細を開く")}
                          title={t("詳細を開く")}
                        >
                          ⋯
                        </button>
                      </article>
                      );
                    })}
                    {hasMore ? (
                      <button
                        type="button"
                        className="daily-history-more"
                        onClick={() => setShowAllMyReports(true)}
                      >
                        {t("もっと見る ({count} 件)", { count: filteredDailyReports.length - visibleReports.length })}
                      </button>
                    ) : null}
                  </>
                );
              })() : dailyReports.length > 0 ? (
                <p>{t("一致する日報はありません。")}</p>
              ) : (
                /* 初回ユーザー向けの welcoming な空状態。バレ文字だと
                   何をすればいいか分からないので、上の編集エリアへの
                   小さなナビとセットで案内する。 */
                <div className="daily-history-empty">
                  <p className="daily-history-empty-title">
                    {t("まだ日報はありません。")}
                  </p>
                  <p className="daily-history-empty-hint">
                    {t("上の入力欄から「今日やること」と「振り返り」を書くと、ここに記録が並んでいきます。")}
                  </p>
                </div>
              )}
            </div>
            </div>
            ) : (
            <div className="daily-shared-feed" role="tabpanel" aria-label={t("みんなの日報")}>
              {/* タブをタップした瞬間に自動 fetch する (onClick 経由)。
                  読み込み中はシンプルな loading 表示、エラー時は再試行
                  ボタン、未着手 (= 自動 fetch がまだ走ってない初期描画
                  などのエッジ) は手動ボタンにフォールバック。 */}
              {!isSharedDailyLoaded ? (
                <div className="daily-shared-loader">
                  {isLoadingSharedDaily ? (
                    <p>{t("読み込み中…")}</p>
                  ) : sharedDailyLoadError ? (
                    <>
                      <p className="daily-shared-load-error" role="alert">
                        {sharedDailyLoadError}
                      </p>
                      <button
                        type="button"
                        className="daily-shared-load-button"
                        onClick={() => void handleLoadSharedDailyReports()}
                      >
                        {t("再試行")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="daily-shared-load-button"
                      onClick={() => void handleLoadSharedDailyReports()}
                    >
                      {t("Team Daily を読み込む")}
                    </button>
                  )}
                </div>
              ) : visibleSharedDailyReports.length > 0 ? (
                <div className="daily-shared-list">
                  {visibleSharedDailyReports.map((report) => {
                    const isMine = report.userId === currentUserUid;
                    const displayName =
                      report.userName || (isMine ? playerName : "Developer");
                    return (
                      <article
                        key={`shared-${report.id}`}
                        className={`is-clickable${isMine ? " mine" : ""}`}
                      >
                        <button
                          type="button"
                          className="daily-shared-card-trigger"
                          onClick={() => setExpandedDailyReport(report)}
                          aria-label={t("{name}の{date}の日報を開く", { name: displayName, date: formatDailyDate(report.date, language) })}
                        >
                          <div>
                            {(() => {
                              const look = resolveAuthorAppearance(
                                report.userId,
                                report.characterColor,
                                report.characterShape,
                              );
                              return (
                                <ProfileCharacterPreview
                                  color={look.color}
                                  shape={look.shape}
                                />
                              );
                            })()}
                            <span>
                              <strong>{displayName}</strong>
                              <small>{formatDailyDate(report.date, language)}</small>
                            </span>
                          </div>
                          {report.planItems && report.planItems.length > 0 ? (
                            <p className="daily-shared-section">
                              <strong>{t("今日やること")}</strong>
                              <span>
                                <PlanChecklistPreview
                                  items={report.planItems}
                                  maxRows={4}
                                  moreLabel={(count) => t("+{count}件", { count })}
                                  emptyItemText={t("(空)")}
                                />
                              </span>
                            </p>
                          ) : report.plan ? (
                            <p className="daily-shared-section">
                              <strong>{t("今日やること")}</strong>
                              <span>
                                {renderTextWithMentions(report.plan, {
                                  lookup: dailyMentionLookup,
                                  keyPrefix: `feed-plan-${report.id}`,
                                })}
                              </span>
                            </p>
                          ) : null}
                          {report.reflection ? (
                            <div className="daily-shared-section">
                              <strong>{t("振り返り")}</strong>
                              {renderReflectionBody(report.reflection, {
                                t,
                                lookup: dailyMentionLookup,
                                keyPrefix: `feed-refl-${report.id}`,
                              })}
                            </div>
                          ) : null}
                        </button>
                        {isMine ? (
                          <button
                            type="button"
                            className="daily-delete-button"
                            onClick={() => handleDailyReportDelete(report)}
                          >
                            {t("削除")}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                  {hasMoreSharedDailyReports ? (
                    <button
                      type="button"
                      className="daily-shared-loadmore"
                      onClick={() =>
                        setSharedDailyDisplayLimit((limit) => limit + SHARED_DAILY_PAGE_SIZE)
                      }
                    >
                      {t("もっと見る")}
                      <small>
                        {visibleSharedDailyReports.length} / {allVisibleSharedDailyReports.length}
                      </small>
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="daily-shared-empty">{t("共有された日報はまだありません。")}</p>
              )}
            </div>
            )}
          </aside>
        </motion.section>
      ) : currentView === "learning" ? (
        <motion.section
          className="learning-screen"
          aria-label={t("記録する")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <header className="learning-header">
            <div>
              <h2>{t("ライブラリ")}</h2>
            </div>
            <div className="learning-header-actions">
              <button
                type="button"
                className="learning-scan-button"
                onClick={() => setIsBarcodeScanOpen(true)}
                aria-label={t("バーコードで本を追加")}
                title={t("バーコードで本を追加")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14" />
                </svg>
                {t("バーコード")}
              </button>
              <button type="button" className="learning-add-button" onClick={() => openLearningEditorForCreate("")}>
                + {t("追加")}
              </button>
            </div>
          </header>

          <div className="learning-controls">
            <input
              className="learning-search"
              type="search"
              placeholder={t("名前で検索")}
              value={learningSearchQuery}
              onChange={(event) => setLearningSearchQuery(event.target.value)}
            />
            <select
              className="learning-sort"
              value={learningSortMode}
              onChange={(event) =>
                setLearningSortMode(event.target.value as "recent" | "total" | "name" | "custom")
              }
              aria-label={t("並び替え")}
            >
              <option value="recent">{t("最近の記録順")}</option>
              <option value="total">{t("累計時間順")}</option>
              <option value="name">{t("名前順")}</option>
              <option value="custom">{t("自分の順")}</option>
            </select>
            {/* 旧 "並べ替えモード" トグル + ↑↓ UI はユーザー要望で廃止。
                並べ替えは長押し → ドラッグだけで完結する。 */}
          </div>

          {(() => {
            const lowerQuery = learningSearchQuery.trim().toLowerCase();
            const filtered = learningItems
              .filter((item) => {
                if (learningCategoryTab === "archived") {
                  return item.archived;
                }
                if (item.archived) return false;
                const status = item.status ?? "active";
                // "進行中" groups active + paused (i.e. not finished); the
                // card badge still distinguishes 中断. "完了" is done-only.
                if (learningCategoryTab === "active") return status !== "done";
                if (learningCategoryTab === "done") return status === "done";
                return true;
              })
              .filter((item) => !lowerQuery || item.name.toLowerCase().includes(lowerQuery));

            // Build per-item aggregates in one pass: cumulative minutes,
            // last-logged timestamp, this-week total, and a 7-day
            // sparkline (index 0 = 6 days ago, index 6 = today). The
            // sparkline drives the visual freshness signal so users can
            // tell at a glance which items they actually touched.
            const totalsByItem = new Map<string, number>();
            const lastLoggedByItem = new Map<string, number>();
            const sparklineByItem = new Map<string, number[]>();
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const dayMs = 24 * 60 * 60 * 1000;
            const sparkStartMs = todayMidnight.getTime() - 6 * dayMs;
            // Resolve a log to its Learning Item via TWO paths so we
            // count both flavours of historical data:
            //   (a) Modern logs carry learningItemId — the canonical
            //       link set at save time.
            //   (b) Older or free-typed logs only carry `subject`
            //       (no learningItemId), but the user can still mean
            //       a known item — match case-insensitively by name.
            // Without (b), manual entries typed before the item was
            // created, or room-task strings that didn't match at exit
            // time, silently fall out of the totals. Matches the same
            // fallback pattern used by getSubjectSummary / getStudySegments.
            const itemIdByLowerName = new Map<string, string>();
            const knownItemIds = new Set<string>();
            learningItems.forEach((item) => {
              knownItemIds.add(item.id);
              const key = item.name.trim().toLowerCase();
              if (key && !itemIdByLowerName.has(key)) itemIdByLowerName.set(key, item.id);
            });
            studyLogs.forEach((log) => {
              const targetId =
                log.learningItemId && knownItemIds.has(log.learningItemId)
                  ? log.learningItemId
                  : itemIdByLowerName.get((log.subject || "").trim().toLowerCase());
              if (!targetId) return;
              totalsByItem.set(targetId, (totalsByItem.get(targetId) || 0) + log.minutes);
              const ts = new Date(log.createdAt).getTime();
              if (!Number.isFinite(ts)) return;
              const prevLast = lastLoggedByItem.get(targetId) || 0;
              if (ts > prevLast) lastLoggedByItem.set(targetId, ts);
              if (ts >= sparkStartMs) {
                const dayIndex = Math.min(6, Math.max(0, Math.floor((ts - sparkStartMs) / dayMs)));
                const arr = sparklineByItem.get(targetId) || new Array(7).fill(0);
                arr[dayIndex] += log.minutes;
                sparklineByItem.set(targetId, arr);
              }
            });

            // Sort order depends on the user's chosen mode:
            //   - "recent" (default): recently logged float up, then total
            //     minutes, then createdAt desc — surfaces active work.
            //   - "total": cumulative minutes desc.
            //   - "name": locale-aware A→Z (Japanese collation included).
            // All modes fall back to createdAt desc to keep ties stable.
            const sorted = filtered.slice().sort((a, b) => {
              if (learningSortMode === "custom") {
                /* 手動並べ替え: item.order の昇順。未設定はとても大きな
                   値として末尾に配置 (古いアイテムは並べ替え結果の下に
                   流れる)。同値時は createdAt 古い順。 */
                const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
                const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
                if (ao !== bo) return ao - bo;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              }
              if (learningSortMode === "name") {
                const byName = a.name.localeCompare(b.name, "ja");
                if (byName !== 0) return byName;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              if (learningSortMode === "total") {
                const aMin = totalsByItem.get(a.id) || 0;
                const bMin = totalsByItem.get(b.id) || 0;
                if (aMin !== bMin) return bMin - aMin;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              const aLast = lastLoggedByItem.get(a.id) || 0;
              const bLast = lastLoggedByItem.get(b.id) || 0;
              if (aLast !== bLast) return bLast - aLast;
              const aMin = totalsByItem.get(a.id) || 0;
              const bMin = totalsByItem.get(b.id) || 0;
              if (aMin !== bMin) return bMin - aMin;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            if (sorted.length === 0) {
              // First-run / fully-filtered-out state. Offer curated
              // quick-add chips so a fresh user doesn't have to think up
              // a name from scratch — one tap opens the editor pre-filled
              // and they only need to pick the color.
              const showSuggestions = learningCategoryTab === "all" && !lowerQuery;
              return (
                <div className="learning-empty">
                  <p>{t("学習対象を追加して、学習時間を記録しよう。")}</p>
                  {showSuggestions ? (
                    <div className="learning-empty-suggestions" aria-label={t("よく使われる学習対象")}>
                      {["React", "TypeScript", "英語", "読書", "アルゴリズム"].map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="learning-suggestion-chip"
                          onClick={() => openLearningEditorForCreate(name)}
                        >
                          + {t(name)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" className="learning-add-button" onClick={() => openLearningEditorForCreate("")}>
                    + {t("追加")}
                  </button>
                </div>
              );
            }

            return (
              <div className="learning-grid">
                {sorted.map((item, sortedIndex) => {
                  const minutes = totalsByItem.get(item.id) || 0;
                  const totalLabel = formatStudyTimeJa(minutes);
                  const isBook = item.category === "book";
                  const hasProgress =
                    isBook && typeof item.totalPages === "number" && item.totalPages > 0;
                  const progressPercent = hasProgress
                    ? Math.min(100, Math.round(((item.currentPages || 0) / (item.totalPages || 1)) * 100))
                    : 0;
                  const status = item.status ?? "active";
                  const noteText = item.note?.trim() || "";
                  const isPageEditOpen = learningPageEditId === item.id;
                  const lastTs = lastLoggedByItem.get(item.id);
                  const lastLabel = formatLearningLastLogged(lastTs, todayMidnight.getTime(), dayMs, language);
                  const isFreshToday = !!lastTs && lastTs >= todayMidnight.getTime();
                  const sparkline = sparklineByItem.get(item.id);
                  const sparklineMax = sparkline
                    ? sparkline.reduce((acc, value) => (value > acc ? value : acc), 0)
                    : 0;
                  /* Phase 10c: カードを <button> から <article> へ.
                     ボタンの入れ子は無効な HTML なので、ヘッダ部分は
                     編集を開く <button>、フッタはクイック記録の
                     チップ群、と二つの操作領域に分ける. アーカイブ
                     カードでは記録チップを出さない(再利用させない
                     ためにアーカイブする意図を尊重). */
                  const isQuickLogOpen = learningQuickLogOpenId === item.id;
                  /* 空欄は 0 扱い。時間 + 分を合算した総分数で記録する。
                     どちらか一方だけの入力 (例: 2 時間 / 45 分) も自然に通る。 */
                  const customHoursRaw = Number(learningQuickLogCustomHours);
                  const customMinutesRaw = Number(learningQuickLogCustomMinutes);
                  const customHoursValue =
                    learningQuickLogCustomHours.trim() === "" || !Number.isFinite(customHoursRaw)
                      ? 0
                      : customHoursRaw;
                  const customMinutesPart =
                    learningQuickLogCustomMinutes.trim() === "" || !Number.isFinite(customMinutesRaw)
                      ? 0
                      : customMinutesRaw;
                  const customMinutesValue = customHoursValue * 60 + customMinutesPart;
                  const canSubmitCustom = customMinutesValue > 0;
                  const closeQuickLog = () => {
                    setLearningQuickLogOpenId(null);
                    setLearningQuickLogCustomMinutes("");
                    setLearningQuickLogCustomHours("");
                  };
                  const submitCustomQuickLog = () => {
                    if (!canSubmitCustom) return;
                    handleLearningQuickLog(item, customMinutesValue);
                    closeQuickLog();
                  };
                  const isDragging = dragLibraryItemId === item.id;
                  const isPressing = pressingLibraryItemId === item.id && !isDragging;
                  const isDragTarget =
                    dragLibraryItemId !== null &&
                    dragLibraryItemId !== item.id &&
                    dragLibraryOverIndex === sortedIndex;
                  return (
                    <article
                      key={item.id}
                      ref={(el) => {
                        if (el) cardRectsRef.current.set(item.id, el);
                        else cardRectsRef.current.delete(item.id);
                      }}
                      className={`learning-card${
                        isDragging ? " is-dragging" : ""
                      }${isPressing ? " is-pressing" : ""}${
                        isDragTarget ? " is-drop-target" : ""
                      }`}
                      style={{
                        ["--learning-card-color" as string]: item.color,
                        /* --drag-offset-y は drag 中だけ move handler が
                           直接 DOM に setProperty する。 React state を介さ
                           ないことで指追従が安定。 drag 終了時に下記の
                           cleanup で 0px に戻す。 */
                      } as CSSProperties}
                      onContextMenu={(event) => {
                        event.preventDefault();
                      }}
                      onTouchStart={(event) => {
                        const tgt = event.target as HTMLElement;
                        if (tgt.closest("a, input, textarea")) return;
                        if (event.touches.length !== 1) return;
                        const t0 = event.touches[0];
                        startLearningDrag({
                          articleEl: event.currentTarget as HTMLElement,
                          startX: t0.clientX,
                          startY: t0.clientY,
                          itemId: item.id,
                          sortedIndex,
                          sortedList: sorted,
                          mode: "touch",
                        });
                      }}
                      onMouseDown={(event) => {
                        const tgt = event.target as HTMLElement;
                        if (tgt.closest("a, input, textarea")) return;
                        if (event.button !== 0) return;
                        startLearningDrag({
                          articleEl: event.currentTarget as HTMLElement,
                          startX: event.clientX,
                          startY: event.clientY,
                          itemId: item.id,
                          sortedIndex,
                          sortedList: sorted,
                          mode: "mouse",
                        });
                      }}
                      onClickCapture={(event) => {
                        /* drag 成立後の release で発火する click を抑止 */
                        if (dragWasCommittedRef.current) {
                          dragWasCommittedRef.current = false;
                          event.stopPropagation();
                          event.preventDefault();
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="learning-card-trigger"
                        onClick={() => setLearningRecordItemId(item.id)}
                        aria-label={t("{name}の詳細", { name: item.name })}
                      >
                        <div className="learning-card-head">
                          <span
                            className={`learning-card-photo${item.photo ? "" : " is-fallback"}`}
                            style={
                              item.photo
                                ? undefined
                                : ({ "--learning-thumb-color": item.color } as CSSProperties)
                            }
                            aria-hidden="true"
                          >
                            {item.photo ? (
                              <img src={item.photo} alt="" loading="lazy" />
                            ) : null}
                          </span>
                          {isBook ? (
                            <span className="learning-card-badge" aria-hidden="true">
                              {t("書籍")}
                            </span>
                          ) : null}
                          <strong>{item.name}</strong>
                          {status === "done" ? (
                            <span className="learning-card-status is-done">{t("達成済み")}</span>
                          ) : status === "paused" ? (
                            <span className="learning-card-status is-paused">{t("休止中")}</span>
                          ) : null}
                        </div>
                        <div className="learning-card-meta">
                          <span>{t("累計")} {totalLabel}</span>
                          <span
                            className={`learning-card-last${isFreshToday ? " is-fresh" : ""}${
                              !lastTs ? " is-untouched" : ""
                            }`}
                          >
                            {lastLabel}
                          </span>
                          {item.archived ? <span className="learning-card-archived">{t("休止中")}</span> : null}
                        </div>
                        {sparkline && sparklineMax > 0 ? (
                          <div className="learning-card-spark" aria-hidden="true">
                            {sparkline.map((value, dayIndex) => {
                              const heightPercent = sparklineMax > 0 ? (value / sparklineMax) * 100 : 0;
                              return (
                                <span
                                  key={dayIndex}
                                  className={`learning-card-spark-bar${value > 0 ? " has-value" : ""}${
                                    dayIndex === 6 ? " is-today" : ""
                                  }`}
                                  style={{ height: `${Math.max(value > 0 ? 18 : 6, heightPercent)}%` }}
                                />
                              );
                            })}
                          </div>
                        ) : null}
                        {hasProgress ? (
                          <div className="learning-card-progress" aria-label={`${progressPercent}%`}>
                            <span style={{ width: `${progressPercent}%` }} />
                            <small>
                              {item.currentPages || 0}/{item.totalPages}p
                            </small>
                          </div>
                        ) : null}
                        {noteText ? <span className="learning-card-note">{noteText}</span> : null}
                      </button>
                      {isBook && hasProgress && !item.archived ? (
                        isPageEditOpen ? (
                          <div className="learning-card-pageedit is-input" role="group" aria-label={t("現在ページを更新")}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max={item.totalPages}
                              step="1"
                              value={learningPageEditValue}
                              autoFocus
                              onChange={(event) => setLearningPageEditValue(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleLearningPageUpdate(item.id, Number(learningPageEditValue));
                                  setLearningPageEditId(null);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setLearningPageEditId(null);
                                }
                              }}
                              aria-label={t("現在のページ")}
                            />
                            <span className="learning-card-pageedit-unit">/ {item.totalPages}p</span>
                            <button
                              type="button"
                              className="learning-card-pageedit-submit"
                              onClick={() => {
                                handleLearningPageUpdate(item.id, Number(learningPageEditValue));
                                setLearningPageEditId(null);
                              }}
                            >
                              {t("更新")}
                            </button>
                            <button
                              type="button"
                              className="learning-card-pageedit-cancel"
                              onClick={() => setLearningPageEditId(null)}
                              aria-label={t("閉じる")}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="learning-card-pageedit" role="group" aria-label={t("ページ進捗")}>
                            {[5, 10, 25].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                className="learning-card-pageedit-chip"
                                onClick={() =>
                                  handleLearningPageUpdate(item.id, (item.currentPages || 0) + delta)
                                }
                              >
                                +{delta}p
                              </button>
                            ))}
                            <button
                              type="button"
                              className="learning-card-pageedit-chip is-set"
                              onClick={() => {
                                setLearningPageEditId(item.id);
                                setLearningPageEditValue(String(item.currentPages || 0));
                              }}
                              aria-label={t("ページ数を直接入力")}
                            >
                              {t("ページ")}…
                            </button>
                          </div>
                        )
                      ) : null}
                      {!item.archived ? (
                        isQuickLogOpen ? (
                          <div className="learning-card-quicklog is-custom" role="group" aria-label={t("時間を指定して記録")}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={learningQuickLogCustomHours}
                              autoFocus
                              onChange={(event) => setLearningQuickLogCustomHours(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  submitCustomQuickLog();
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  closeQuickLog();
                                }
                              }}
                              placeholder="0"
                              aria-label={t("記録する時間数")}
                            />
                            <span className="learning-card-quicklog-unit">{t("時間")}</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="59"
                              step="1"
                              value={learningQuickLogCustomMinutes}
                              onChange={(event) => setLearningQuickLogCustomMinutes(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  submitCustomQuickLog();
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  closeQuickLog();
                                }
                              }}
                              placeholder="45"
                              aria-label={t("記録する分数")}
                            />
                            <span className="learning-card-quicklog-unit">{t("分")}</span>
                            <button
                              type="button"
                              className="learning-card-quicklog-submit"
                              disabled={!canSubmitCustom}
                              onClick={submitCustomQuickLog}
                            >
                              {t("記録")}
                            </button>
                            <button
                              type="button"
                              className="learning-card-quicklog-cancel"
                              onClick={closeQuickLog}
                              aria-label={t("閉じる")}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="learning-card-quicklog" role="group" aria-label={t("クイック記録")}>
                            {[1, 10, 60].map((minutes) => (
                              <button
                                key={minutes}
                                type="button"
                                className="learning-card-quicklog-chip"
                                onClick={() => accumulateLearningQuickLog(item, minutes)}
                              >
                                +{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="learning-card-quicklog-chip is-more"
                              onClick={() => {
                                setLearningQuickLogOpenId(item.id);
                                setLearningQuickLogCustomMinutes("");
                              }}
                              aria-label={t("他の時間を指定して記録")}
                            >
                              …
                            </button>
                            {/* 連続タップ中の保留合計。止まると 1 記録に確定する。 */}
                            {(quickLogPendingById[item.id] || 0) > 0 ? (
                              <span
                                className="learning-card-quicklog-pending"
                                aria-live="polite"
                              >
                                +{formatStudyTimeJa(quickLogPendingById[item.id])} {t("記録中")}…
                              </span>
                            ) : null}
                          </div>
                        )
                      ) : null}
                    </article>
                  );
                })}
              </div>
            );
          })()}
        </motion.section>
      ) : currentView === "logs" ? (
        <motion.section
          className="logs-screen"
          aria-label="Contribution Arc logs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {contributionArcCardSection}
          {currentUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="logs"
              title={t("みんなの記録 — 仲間の積み上げが流れる場所")}
              body={t("他のユーザーが今日何をしているかをタイムラインで追えます。")}
              bullets={[
                t("投稿にいいねで応援、返信で対話"),
                t("「Following / All」タブで自分のフォロー先だけに絞れます"),
                t("気になる人をフォローすると、その人の投稿が優先で流れる"),
                t("あなたの学習を投稿すると、誰かの励みになります"),
              ]}
            />
          ) : null}

          <section className="today-strip" aria-label={t("今日の足場")}>
            <div className="today-strip-stat">
              <span className="today-strip-label">{t("今日")}</span>
              <span className="today-strip-value">{formatStudyTimeJa(todayStudyMinutes)}</span>
            </div>
            <div className="today-strip-divider" aria-hidden="true" />
            <div className="today-strip-stat">
              <span className="today-strip-label">{t("今週")}</span>
              <span className="today-strip-value">{formatStudyTimeJa(totalWeeklyMinutes)}</span>
            </div>
            {lastStudyLog ? (
              <>
                <div className="today-strip-divider" aria-hidden="true" />
                <div className="today-strip-stat today-strip-recent">
                  <span className="today-strip-label">{t("最後に学んだ")}</span>
                  <span className="today-strip-value today-strip-recent-subject">{lastStudyLog.subject}</span>
                </div>
              </>
            ) : null}
            {todayStudyMinutes > 0 ? (
              <button
                type="button"
                className="today-strip-share"
                onClick={() => setIsShareToXOpen(true)}
                aria-label={t("今日の作業時間をXでシェア")}
              >
                {t("Xでシェア")}
              </button>
            ) : null}
          </section>

          <section className="log-composer-card">
            <div className="log-composer-head">
              <div>
                <p className="card-kicker">Timeline</p>
                <h2>{t("今日の学びを共有する")}</h2>
              </div>
              <span>{visibleTimelinePosts.length.toLocaleString()} logs</span>
            </div>

            <form className="log-composer" onSubmit={handlePostSubmit}>
              <ProfileCharacterPreview color={playerCharacterColor} />
              <div>
                <textarea
                  value={postDraft}
                  onChange={(event) => {
                    setPostDraft(event.target.value);
                    setPostError("");
                  }}
                  placeholder={t("What are you building tonight?")}
                  maxLength={280}
                  rows={4}
                />
                <div className="log-composer-footer">
                  <span>{postDraft.length}/280</span>
                  <button type="submit" disabled={isPosting || !postDraft.trim()}>
                    {isPosting ? t("Posting") : t("投稿")}
                  </button>
                </div>
                {postError ? <p className="log-post-error">{postError}</p> : null}
                {replyError ? <p className="log-post-error">{replyError}</p> : null}
              </div>
            </form>
          </section>

          <div className="logs-layout">
            <section className="log-timeline" aria-label={t("開発ログタイムライン")}>
              <div className="timeline-filter-tabs" role="tablist" aria-label={t("タイムラインの表示範囲")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineFilter === "following"}
                  className={`timeline-filter-tab${timelineFilter === "following" ? " is-active" : ""}`}
                  onClick={() => setTimelineFilter("following")}
                >
                  Following
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineFilter === "all"}
                  className={`timeline-filter-tab${timelineFilter === "all" ? " is-active" : ""}`}
                  onClick={() => setTimelineFilter("all")}
                >
                  All
                </button>
              </div>
              {visibleTimelinePosts.length > 0 ? (
                visibleTimelinePosts.map((post) => postCard(post))
              ) : timelineFilter === "following" ? (
                <article className="log-empty-card">
                  <p className="card-kicker">Following</p>
                  <strong>{t("フォロー中のログはまだありません。")}</strong>
                  <span>{t("気になるエンジニアをフォローすると、ここに学びが流れます。Allタブで全員のログを見ることもできます。")}</span>
                </article>
              ) : (
                <article className="log-empty-card">
                  <p className="card-kicker">Quiet Progress</p>
                  <strong>{t("まだログはありません。")}</strong>
                  <span>{t("今日作っているもの、学んだこと、commitしたことを静かに共有できます。")}</span>
                </article>
              )}
            </section>

            <aside className="log-side-panel" aria-label="Room logs">
              <div>
                <p className="card-kicker">Current Room</p>
                <strong>{selectedRoom?.name || t("作業部屋")}</strong>
                <span>{roomOnlineCount} online · {formatStudyTimeJa(roomTotalMinutes)}</span>
              </div>
              <div className="room-log-preview">
                <p className="card-kicker">{t("このRoomの最近の投稿")}</p>
                {selectedRoomPosts.length > 0 ? (
                  selectedRoomPosts.map((post) => postCard(post, "compact"))
                ) : (
                  <span>{t("このRoomのログはまだありません。")}</span>
                )}
              </div>
            </aside>
          </div>
        </motion.section>
      ) : currentView === "profile" ? (

        <motion.section
          className="profile-screen"
          aria-label="Profile"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {currentUser && !profileMember && !profileUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="profile"
              title={t("プロフィール — あなたの足跡と設定")}
              body={t("積み上げの累計と、見た目・連携の設定をここでまとめます。")}
              bullets={[
                t("キャラクターの色を変えて、作業部屋での自分を識別しやすく"),
                t("GitHub を連携すると、commit が学習グラフに重なります"),
                t("「決意」欄に短い宣言を書いておくと、毎日の起動時に思い出せます"),
                t("あなたのユーザーID (@xxx) は他の人があなたを検索する手掛かり"),
              ]}
            />
          ) : null}
          <div className="profile-topbar">
            <button type="button" onClick={handleProfileBack}>
              ← {t("ホーム")}
            </button>
          </div>

          {/* 他人のプロフィール (member / user) を見ているときは、
              右上にバツマークの "閉じる" を絶対配置。
              「← ホーム」を見落とした場合の保険として常に手の届く
              位置に出して、戻れずに困らないようにする。 */}
          {profileMember || profileUser ? (
            <button
              type="button"
              className="profile-close-button"
              onClick={handleProfileBack}
              aria-label={t("プロフィールを閉じる")}
              title={t("プロフィールを閉じる")}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}

          <div className="profile-layout">
            {profileMember ? (
              memberProfileCard(profileMember)
            ) : profileUser ? (
              userProfileCard(profileUser)
            ) : (
              <>
                {/* === nondo インスパイアの hero ===
                    巨大ロゴ風ユーザー名 + 右上 line icon ペア +
                    3 メトリックピル + 紫マーカーの手書き下線付き
                    セクション見出しで「シンプル投稿アプリ」っぽい
                    手触りを最上段に。Player Status カードは下に残す。 */}
                <header className="profile-nondo-hero" aria-label={t("プロフィールヘッダー")}>
                  <div className="profile-nondo-corner" aria-hidden="false">
                    {/* プロフィール画面から MENU (user-menu-panel) に
                        1 タップで飛べるよう、ペアの左ボタンを MENU
                        トグルに差し替え。 (旧: プロフィールリンクの
                        コピー — シェアモーダル等から代替できる) */}
                    <button
                      type="button"
                      className="profile-nondo-corner-btn"
                      onClick={() => {
                        /* メニューパネルは sticky site-header の右端に
                           anchor されるので、プロフィール画面で scroll
                           されていると視野外で開いて「何も起きない」と
                           誤認される。一度トップへスクロールしてから
                           開く。 */
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        setIsUserMenuOpen(true);
                      }}
                      aria-label={t("メニュー")}
                      title={t("メニュー")}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="4" y="6" width="14" height="14" rx="2.2" />
                        <path d="M8 3h10a2 2 0 0 1 2 2v11" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="profile-nondo-corner-btn"
                      onClick={handleSettingsOpen}
                      aria-label={t("設定を開く")}
                      title={t("設定")}
                    >
                      {/* 旧アイコンは曲線連続の塊で「設定」と分かりにくかった
                          ので、Feather Icons 互換のシンプルな歯車に差し替え。
                          中心の円 + 8 つの歯の輪郭で誰が見ても "設定" と
                          認識できる形。 */}
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                  </div>
                  <h1 className="profile-nondo-name">
                    {playerName}
                  </h1>
                  <p className="profile-nondo-handle">
                    {userId ? `@${userId}` : "—"}
                  </p>
                </header>

                {/* 自分の目標は Player Status の識別チップ行にコンパクトに
                    集約した（旧: ここに大きなカードを出していたが、設定すると
                    名前直下を占有して邪魔になるため移設）。 */}

                {/* Player Status はプロフィールの主役なので最上部に固定。 */}
                {playerStatusCard(false)}

                {/* 今週の学習を曜日別の棒グラフで。自分の studyLogs から
                    直接組むのでリアルタイム。 */}
                {profileWeekChart(
                  weeklyStudyHours.map((day) => day.totalMinutes),
                  (new Date().getDay() + 6) % 7,
                  { editable: true, weekData: weeklyStudyHours },
                )}

                {/* クイックアクション (プロフィールを編集 / ショップ /
                    プロフィールリンクをコピー) は要望により撤去。
                    同等の導線は下の Menu と右上のリンクコピー
                    (profile-nondo-corner-btn) から確保している。 */}

                {/* シンプルな投稿 + 日報アプリへの方向転換に伴い、トップバーの
                    管理 / 作業部屋 / ショップ / フレンド / 検索 / 通知 / 設定
                    エントリをプロフィール画面に集約。モバイル topbar は非表示
                    にし、ここから全機能にアクセスする。 */}
                <div className="profile-nondo-section profile-nondo-section--menu">
                  <span className="profile-nondo-section-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 7h14M5 12h14M5 17h14" />
                    </svg>
                  </span>
                  <span className="profile-nondo-section-label profile-nondo-marker">Menu</span>
                  <span className="profile-nondo-section-count">{currentOrganization?.ownerUid === currentUser.uid ? 6 : 5}</span>
                  <span className="profile-nondo-section-arrow" aria-hidden="true">›</span>
                </div>
                <nav className="profile-menu" aria-label={t("メニュー")}>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => setIsAnnouncementsModalOpen(true)}
                  >
                    <span className="profile-menu-icon" aria-hidden="true">
                      {/* お知らせ = ベル。旧アイコンは「家」に見える
                          shape だったので、誰でも一目で分かるベル形に
                          差し替え。 */}
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" />
                        <path d="M10 20a2 2 0 0 0 4 0" />
                      </svg>
                    </span>
                    <span className="profile-menu-label">{t("お知らせ")}</span>
                    <span className="profile-menu-arrow" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => setIsGoalPickerOpen(true)}
                  >
                    <span className="profile-menu-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="5" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="profile-menu-label">
                      {t("目標")}
                      {(() => {
                        const g = findGoalById(goalId);
                        return g ? <small className="profile-menu-sub">{g.name}</small> : null;
                      })()}
                    </span>
                    <span className="profile-menu-arrow" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => {
                      /* モーダルではなく専用画面に遷移する。MENU から
                         タップした時にトップに小さく出る popover はモバイル
                         で見落とされやすく「押しても何も起きない」と
                         感じる原因だったので、Friends 画面そのものへ移動。 */
                      setCurrentView("friends");
                    }}
                  >
                    <span className="profile-menu-icon" aria-hidden="true">
                      {/* フレンド = 2 人並びのシルエット。旧アイコンは
                          「太陽 + 虫眼鏡」風で何のメニューか伝わって
                          いなかったので、誰でも分かる二人組に差し替え。 */}
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="8" r="3" />
                        <circle cx="17" cy="9" r="2.4" />
                        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
                        <path d="M14.6 15c0.8-0.7 1.7-1 2.9-1c2.3 0 3.7 1.5 3.7 3.4" />
                      </svg>
                    </span>
                    <span className="profile-menu-label">{t("フレンド・検索")}</span>
                    <span className="profile-menu-arrow" aria-hidden="true">›</span>
                  </button>
                  {/* 「通知」「作業部屋」エントリは要望により撤去。
                      通知は専用パネル / 自動通知に依存、作業部屋は
                      bottom-nav 中央タブから直接アクセスできるため
                      プロフィール Menu からは外す。 */}
                  {/* Shop は Apple guideline 3.1.1 で iOS 提出時に
                      外部課金を伴うストアの導線を出せないため、iOS
                      build では完全に非表示。 */}
                  {!IS_IOS_BUILD ? (
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => setCurrentView("shop")}
                    >
                      <span className="profile-menu-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 9h14l-1.4 9.5a2 2 0 0 1-2 1.5H8.4a2 2 0 0 1-2-1.5z" />
                          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
                        </svg>
                      </span>
                      <span className="profile-menu-label">{t("ショップ")}</span>
                      <span className="profile-menu-arrow" aria-hidden="true">›</span>
                    </button>
                  ) : null}
                  {currentOrganization?.ownerUid === currentUser.uid ? (
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => setCurrentView("manager")}
                    >
                      <span className="profile-menu-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="4" width="7" height="7" rx="1.5" />
                          <rect x="13" y="4" width="7" height="7" rx="1.5" />
                          <rect x="4" y="13" width="7" height="7" rx="1.5" />
                          <rect x="13" y="13" width="7" height="7" rx="1.5" />
                        </svg>
                      </span>
                      <span className="profile-menu-label">{t("管理ダッシュボード")}</span>
                      <span className="profile-menu-arrow" aria-hidden="true">›</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="profile-menu-item profile-menu-item--avatar"
                    onClick={() => {
                      handleSettingsOpen();
                      requestAnimationFrame(() => {
                        const el = document.getElementById("settings-character-panel");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      });
                    }}
                  >
                    {/* アイコン枠を line icon ではなく、実際の分身キャラの
                        小型プレビューに差し替えて「これがあなたの分身」
                        だと一目で伝える。 */}
                    <span className="profile-menu-icon profile-menu-icon--avatar" aria-hidden="true">
                      <ProfileCharacterPreview
                        color={playerCharacterColor}
                        shape={playerCharacterShape}
                      />
                    </span>
                    <span className="profile-menu-label">{t("分身キャラクター")}</span>
                    <span className="profile-menu-arrow" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={handleSettingsOpen}
                  >
                    <span className="profile-menu-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.4.9a7 7 0 0 0-2.2-1.3L13.7 3h-3.4l-.6 2.4a7 7 0 0 0-2.2 1.3l-2.4-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2.2 1.3l.6 2.4h3.4l.6-2.4a7 7 0 0 0 2.2-1.3l2.4.9 2-3.4-2-1.5A7 7 0 0 0 19 12z" />
                      </svg>
                    </span>
                    <span className="profile-menu-label">{t("設定")}</span>
                    <span className="profile-menu-arrow" aria-hidden="true">›</span>
                  </button>
                </nav>

                {/* Lifetime stats + profile-panel-stack は要望により削除 (簡素化)。 */}
              </>
            )}
          </div>
        </motion.section>
      ) : currentView === "poker" ? (
        <motion.section
          className="poker-screen"
          aria-label="Poker screen"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <Suspense fallback={<div className="poker-loading">{t("ポーカーを準備中…")}</div>}>
            <PokerView
              onBack={() => setCurrentView("workspace")}
              arcBalance={coins}
              pokerChips={pokerChips}
              focusChips={focusChips}
              setArcBalance={setCoins}
              setPokerChips={setPokerChips}
              setFocusChips={setFocusChips}
              onOpenShop={() => setCurrentView("shop")}
            />
          </Suspense>
        </motion.section>
      ) : currentView === "workspace" ? (
        <motion.section
          className="workspace-screen"
          aria-label="Silent Workspace screen"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {currentUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="workspace"
              title={t("作業部屋 — 同じ時間に手を動かす場所")}
              body={t("通話なしで、気配だけを共有しながら集中作業ができる空間です。")}
              bullets={[
                t("「今やってること」を入力 → 入室すると 2D 部屋にあなたのキャラが現れます"),
                t("他の人のキャラをタップするとプロフィールが見られます"),
                t("「募集する」で同じ時間に集まる仲間を呼べます"),
                t("退室すると今回の作業時間が記録され、EXP として加算されます"),
              ]}
            />
          ) : null}
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("home")}>
              ← {t("ホーム")}
            </button>
            {/* Poker は Focus Chip → Arc 換金経路があるため、Apple の
                Real-money gaming / Arc 経済の絡みで審査リスクが残る。
                iOS build では非表示にしておく (Web/Android は従来通り)。 */}
            {!IS_IOS_BUILD ? (
              <button
                type="button"
                className="workspace-poker-entry"
                onClick={() => setCurrentView("poker")}
                title={
                  focusChips > 0
                    ? t("Focus Chip {count}枚 — ポーカーで Arc を稼げます", { count: focusChips })
                    : t("25分集中で Focus Chip を獲得（ポーカーで配当 ×1.5）")
                }
              >
                ♠ {t("ポーカー")}
                {focusChips > 0 ? (
                  <span className="workspace-poker-entry-focus">🔥 {focusChips}</span>
                ) : null}
              </button>
            ) : null}
          </div>

          <section
            className={`card silent-workspace workspace-2d-card${isInSelectedRoom ? " is-in-room" : ""}`}
            aria-label="Silent Workspace"
          >
            <div className="workspace-heading">
              <div>
                <p className="card-kicker">Silent Workspace</p>
                <p>{t("通話も雑談も主役にしない。同じ時間に手を動かしている気配だけを共有します。")}</p>
              </div>
              <span className="workspace-live-pill">quiet presence</span>
            </div>

            <div className="workspace-layout">
              {/* Compact room selector — pills along the top so the
                  character map below gets the full canvas. */}
              <div className="workspace-room-strip" aria-label={t("作業部屋")}>
                {/* モバイル専用ヘッダー：タイトル + "+ 部屋を作る"
                    トグル。PC 版では CSS で非表示。 */}
                {(() => {
                  const myOwnedRoom = allWorkspaceRooms.find(
                    (r) => r.createdBy === currentUser.uid,
                  );
                  const canCreate = !myOwnedRoom || isDeveloperAccount;
                  return (
                    <div className="workspace-room-strip-header" aria-hidden="false">
                      <h2 className="workspace-room-strip-title">{t("作業部屋")}</h2>
                      {canCreate ? (
                        <button
                          type="button"
                          className={`workspace-room-create-toggle${isRoomCreatorOpen ? " is-open" : ""}`}
                          aria-expanded={isRoomCreatorOpen}
                          onClick={() => setIsRoomCreatorOpen((open) => !open)}
                        >
                          {isRoomCreatorOpen ? t("閉じる") : `+ ${t("部屋を作る")}`}
                        </button>
                      ) : (
                        <span
                          className="workspace-room-create-locked"
                          title={t("1 人 1 部屋まで。既存の部屋を解体すると新しく作れます。")}
                        >
                          {t("1 人 1 部屋")}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <form
                  className={`workspace-room-create${isRoomCreatorOpen ? " is-open" : ""}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleRoomCreate();
                    // 作成成功時はフォームを閉じる（クリーンな状態に戻す）。
                    // 失敗してもメッセージは別箇所で表示されるので閉じて OK。
                    setIsRoomCreatorOpen(false);
                  }}
                >
                  <input
                    value={newRoomName}
                    onChange={(event) => {
                      setNewRoomName(event.target.value);
                      if (roomCreateState !== "saving") {
                        setRoomCreateState("idle");
                        setRoomCreateMessage("");
                      }
                    }}
                    placeholder={t("新しい場所を作る")}
                    maxLength={32}
                    aria-label={t("作業部屋を作成")}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) {
                        return;
                      }

                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleRoomCreate();
                      }
                    }}
                  />
                  {/* Visibility picker — only shown when the user
                      belongs to an organization. Solo users see no
                      extra control and rooms default to public. */}
                  {currentOrganization ? (
                    <div
                      className="workspace-room-create-visibility"
                      role="radiogroup"
                      aria-label={t("公開範囲")}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={newRoomVisibility === "public"}
                        className={newRoomVisibility === "public" ? "is-active" : ""}
                        onClick={() => setNewRoomVisibility("public")}
                      >
                        {t("公開")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={newRoomVisibility === "org"}
                        className={newRoomVisibility === "org" ? "is-active" : ""}
                        onClick={() => setNewRoomVisibility("org")}
                      >
                        {currentOrganization.name}{t("のみ")}
                      </button>
                    </div>
                  ) : null}
                  <button type="submit">{t("作成")}</button>
                </form>

                {/* Manual lobby refresh: the other-rooms list is fetched once
                    when the workspace opens and never auto-updates afterwards
                    (Firestore cost control). This is the only way to pull a
                    fresh snapshot without leaving and re-entering. */}
                <div className="workspace-room-refresh">
                  <button
                    type="button"
                    className="workspace-room-refresh-button"
                    onClick={() => {
                      void handleManualLobbyRefresh();
                    }}
                    disabled={isRefreshingLobby}
                    aria-label={t("一覧を更新")}
                  >
                    <span aria-hidden="true">↻</span>
                    {isRefreshingLobby ? t("更新中…") : t("一覧を更新")}
                  </button>
                </div>

                {/* ルーム一覧。モバイルでは "入室中" と "ほかのルーム" を
                    セクションで分けて表示し、自分の現在地をひと目で把握
                    できるようにする。各セクションタイトルは CSS で
                    モバイルのみ表示。 */}
                {(() => {
                  const joinedRooms = allWorkspaceRooms.filter((room) =>
                    (room.activeMembers || []).some((m) => m.userId === currentUser.uid),
                  );
                  const otherRooms = allWorkspaceRooms.filter(
                    (room) =>
                      !(room.activeMembers || []).some((m) => m.userId === currentUser.uid),
                  );
                  const renderRoom = (room: WorkspaceRoom) => {
                    const isActiveRoom = room.id === selectedRoom?.id;
                    const roomMembers = room.activeMembers || [];
                    const isJoinedRoom = roomMembers.some(
                      (member) => member.userId === currentUser.uid,
                    );
                    return (
                      <button
                        key={room.id}
                        type="button"
                        role="tab"
                        aria-selected={isActiveRoom}
                        className={[
                          "workspace-room-pill",
                          isActiveRoom ? "active" : "",
                          isJoinedRoom ? "joined" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          /* モバイル: 行をタップしたら入室カードを自然にスクロール表示。
                             以前は同じ画面の下にある preview を見つけるために手動
                             スクロールが必要で「入室する を押しても何も起きない」
                             と誤解される要因になっていた。 */
                          if (typeof window !== "undefined") {
                            window.requestAnimationFrame(() => {
                              const canvas = document.querySelector(".workspace-room-canvas");
                              if (canvas && "scrollIntoView" in canvas) {
                                (canvas as HTMLElement).scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }
                            });
                          }
                        }}
                      >
                        <span className="workspace-room-pill-name">
                          {room.name}
                          {room.visibility === "org" ? (
                            <span
                              className="workspace-room-pill-org"
                              aria-label={t("組織限定")}
                              title={t("組織限定ルーム")}
                            >
                              🔒
                            </span>
                          ) : null}
                        </span>
                        <span className="workspace-room-pill-meta">
                          {t("{count}人", { count: roomMembers.length })} · {Math.round(room.totalMinutes / 60)}h
                        </span>
                        {/* 右側ステータスバッジを React 要素として描画。
                            以前は CSS ::after に "入室する" 文字をハードコード
                            していたため i18n 不可・タップしても join せず
                            select だけ → ユーザー混乱の原因だった。 */}
                        <span
                          className={`workspace-room-pill-status${isJoinedRoom ? " is-joined" : ""}`}
                          aria-hidden="true"
                        >
                          {isJoinedRoom ? `🟢 ${t("入室中")}` : t("開く")}
                        </span>
                      </button>
                    );
                  };
                  return (
                    <div
                      className="workspace-room-pills"
                      role="tablist"
                      aria-label={t("作業部屋")}
                    >
                      {joinedRooms.length > 0 ? (
                        <>
                          <p
                            className="workspace-room-section-title"
                            aria-hidden="true"
                          >
                            {t("入室中")}
                          </p>
                          {joinedRooms.map(renderRoom)}
                        </>
                      ) : null}
                      {otherRooms.length > 0 ? (
                        <>
                          {/* セクションタイトルは joined / other の区切りが必要な
                              ときだけ出す。Workroom ヘッダの下に「ルーム一覧」が
                              さらに付くと冗長で画面が窮屈になるため、joined が
                              無いときは省略する。 */}
                          {joinedRooms.length > 0 ? (
                            <p
                              className="workspace-room-section-title"
                              aria-hidden="true"
                            >
                              {t("ほかのルーム")}
                            </p>
                          ) : null}
                          {otherRooms.map(renderRoom)}
                        </>
                      ) : null}
                      {joinedRooms.length === 0 && otherRooms.length === 0 ? (
                        <p className="workspace-room-empty-hint">
                          {t("まだ部屋がありません。上の「+ 部屋を作る」から作成しましょう。")}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              {roomCreateMessage ? (
                <p className={`room-create-message ${roomCreateState}`}>{roomCreateMessage}</p>
              ) : null}

              <div className="workspace-room-canvas">
                {selectedRoom ? (
                  <>
                    {(() => {
                      const isOwnRoom = selectedRoom.createdBy === currentUser.uid;
                      const isEditingRoom = editingRoomId === selectedRoom.id;
                      return (
                        <div className="workspace-room-canvas-actions">
                          {isEditingRoom ? (
                            <form
                              className="workspace-room-canvas-edit-form"
                              onSubmit={handleRoomTitleSave}
                            >
                              <input
                                value={editingRoomName}
                                onChange={(event) => setEditingRoomName(event.target.value)}
                                maxLength={32}
                                aria-label={t("Roomタイトル")}
                              />
                              <button type="submit">{t("保存")}</button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoomId("");
                                  setEditingRoomName("");
                                }}
                              >
                                {t("取消")}
                              </button>
                            </form>
                          ) : (
                            <>
                              {/* 名前変更は作成者本人 (+ dev moderation) のみに
                                  限定。他人が作った部屋を勝手にリネームできて
                                  しまう問題を塞ぐ。 */}
                              {isOwnRoom || isDeveloperAccount ? (
                                <button
                                  type="button"
                                  className="workspace-room-canvas-action"
                                  onClick={() => startRoomTitleEdit(selectedRoom)}
                                >
                                  {t("名前変更")}
                                </button>
                              ) : null}
                              {isOwnRoom || isDeveloperAccount ? (
                                <button
                                  type="button"
                                  className="workspace-room-canvas-action danger"
                                  onClick={() => handleRoomDelete(selectedRoom.id)}
                                  title={
                                    isOwnRoom
                                      ? t("この部屋を解体")
                                      : t("[Dev] 他ユーザーの部屋を解体")
                                  }
                                >
                                  {isOwnRoom ? t("解体") : t("解体 (Dev)")}
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })()}
                    <SilentWorkspaceRoom
                      roomName={selectedRoom.name}
                      roomDescription={getRoomDescription(selectedRoom, t)}
                      onlineCount={roomOnlineCount}
                      commitLabel={roomCommits.toLocaleString()}
                      members={workspaceActors}
                      currentUserId={currentUser.uid}
                      isJoined={isInSelectedRoom}
                      currentStayLabel={formatStayTime(currentStayMinutes, language)}
                      joinedAtLabel={
                        currentPresence
                          ? new Date(currentPresence.joinedAt).toLocaleTimeString("ja-JP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""
                      }
                      taskValue={workspaceTask}
                      onTaskChange={setWorkspaceTask}
                      onJoin={() => handleRoomJoin(selectedRoom.id)}
                      onLeave={handleRoomLeave}
                      presetMessages={workspacePresetMessages}
                      onPresetMessagesChange={setWorkspacePresetMessages}
                      onPresetMessage={handleWorkspacePresetMessage}
                      bubbleMessage={workspaceBubble}
                      presetLog={presetLog}
                      onRoomRename={
                        selectedRoom.createdBy === currentUser.uid || isDeveloperAccount
                          ? () => startRoomTitleEdit(selectedRoom)
                          : undefined
                      }
                      onRoomDelete={() => handleRoomDelete(selectedRoom.id)}
                      canDeleteRoom={selectedRoom.createdBy === currentUser.uid || isDeveloperAccount}
                      isPlayerWalking={isPlayerWalking}
                      onStageTap={(x, y) => {
                        // タップした座標 (%) を目的地として walk loop に渡す。
                        // 自分が入室中かつポップオーバーが開いていない時のみ。
                        if (!canMoveInRoom) return;
                        const clampedX = clampNumber(x, 7, 93);
                        const clampedY = clampNumber(y, 14, 88);
                        tapWalkTargetRef.current = { x: clampedX, y: clampedY };
                        // 視覚マーカー：1.5s 表示。同じ場所でも id が変わると
                        // 再アニメするので、毎タップ確実にフィードバックが出る。
                        setTapWalkMarker({ x: clampedX, y: clampedY, id: Date.now() });
                        // 触覚フィードバック（対応端末のみ。8ms = 軽い ping）
                        try {
                          navigator.vibrate?.(8);
                        } catch {
                          /* iOS Safari は未対応・無視 */
                        }
                      }}
                      tapWalkMarker={tapWalkMarker}
                      onTapWalkMarkerExpire={(id) =>
                        setTapWalkMarker((current) =>
                          current && current.id === id ? null : current,
                        )
                      }
                      onMemberOpen={handleRoomMemberTap}
                      selectedMemberId={roomMemberPanel?.userId ?? null}
                      memberPanel={
                        roomMemberPanel
                          ? roomMemberCompactCard(roomMemberPanel, roomMemberPanelUser)
                          : null
                      }
                      onPanelClose={handleCloseRoomPanels}
                      onComposeAppearance={handleComposeAppearance}
                      appearancePanel={
                        isEditingAppearance ? (
                          <article className="room-appearance-card">
                            <button
                              type="button"
                              className="room-member-card-close"
                              onClick={handleCloseRoomPanels}
                              aria-label={t("閉じる")}
                            >
                              ×
                            </button>
                            <span className="room-note-card-kicker">{t("✦ 分身を変える")}</span>
                            <div className="room-appearance-preview">
                              <ProfileCharacterPreview
                                color={playerCharacterColor}
                                shape={playerCharacterShape}
                              />
                              {(() => {
                                const active = characterShapeOptions.find(
                                  (o) => o.value === playerCharacterShape,
                                );
                                if (!active) return null;
                                return (
                                  <p className="character-active-intro">
                                    <strong>
                                      {t(active.name)} <span>{active.romaji}</span>
                                    </strong>
                                    {t(active.intro)}
                                  </p>
                                );
                              })()}
                            </div>
                            <div className="character-customize-section compact">
                              <p className="character-customize-section-label">{t("シルエット")}</p>
                              <div
                                className="character-shape-grid compact"
                                aria-label={t("キャラクターの形")}
                              >
                                {characterShapeOptions.map((option) => {
                                  const isLocked = !ownedCharacterShapes.includes(option.value);
                                  const isActive = playerCharacterShape === option.value;
                                  return (
                                    <button
                                      type="button"
                                      key={option.value}
                                      className={`shape-tile ${isActive ? "active " : ""}${
                                        isLocked ? "is-locked" : ""
                                      }`}
                                      onClick={() => {
                                        if (isLocked) {
                                          if (IS_IOS_BUILD) {
                                            /* iOS は Shop 動線なし。
                                               ロック中シルエットはタップ
                                               不可とし、近日対応を案内。 */
                                            showToast(
                                              `${t(option.name)} ${option.romaji} is coming soon.`,
                                              { kind: "info" },
                                            );
                                            return;
                                          }
                                          // ロック shape：いきなり画面遷移すると
                                          // 「シルエット変えても反映されない」と
                                          // 誤認されるので、トーストで明示してから
                                          // confirm でショップ遷移を選ばせる。
                                          showToast(
                                            t("{name} はショップで購入できます", { name: t(option.name) }),
                                            { kind: "info" },
                                          );
                                          const ok = window.confirm(
                                            t("{name} {romaji} はショップで購入できます。ショップへ行きますか？", { name: t(option.name), romaji: option.romaji }),
                                          );
                                          if (ok) setCurrentView("shop");
                                        } else {
                                          chooseCharacterShape(option.value);
                                        }
                                      }}
                                      title={
                                        isLocked
                                          ? t("{name} {romaji}（ショップで購入）", { name: t(option.name), romaji: option.romaji })
                                          : `${t(option.name)} ${option.romaji}`
                                      }
                                      aria-label={
                                        isLocked
                                          ? `${t(option.name)} ${option.romaji}${t("はショップで購入できます")}`
                                          : `${t(option.name)} ${option.romaji}${t("を選択")}`
                                      }
                                      aria-pressed={isActive}
                                    >
                                      <span className="shape-tile-stage" aria-hidden="true">
                                        <ProfileCharacterPreview
                                          color={playerCharacterColor}
                                          shape={option.value}
                                        />
                                      </span>
                                      <span className="shape-tile-text">
                                        <strong className="shape-tile-name">
                                          {t(option.name)}
                                          <span className="shape-tile-romaji">{option.romaji}</span>
                                        </strong>
                                      </span>
                                      {isLocked ? (
                                        <span
                                          className="shape-tile-badge is-lock"
                                          aria-hidden="true"
                                        >
                                          🔒
                                        </span>
                                      ) : isActive ? (
                                        <span
                                          className="shape-tile-badge is-check"
                                          aria-hidden="true"
                                        >
                                          ✓
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="character-customize-section compact">
                              <p className="character-customize-section-label">{t("カラー")}</p>
                              <div className="character-color-grid compact" aria-label={t("分身カラー")}>
                                {characterColorOptions.map((color) => (
                                  <button
                                    type="button"
                                    key={color.value}
                                    className={
                                      playerCharacterColor === color.value ? "active" : ""
                                    }
                                    onClick={() => chooseCharacterColor(color.value)}
                                    title={t(color.name)}
                                    aria-label={`${t(color.name)}${t("を選択")}`}
                                  >
                                    <span style={{ background: color.value }} />
                                    <small>{t(color.name)}</small>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="room-note-card-actions">
                              <button
                                type="button"
                                className="is-primary"
                                onClick={handleCloseRoomPanels}
                              >
                                {t("完了")}
                              </button>
                            </div>
                          </article>
                        ) : null
                      }
                      chatMessages={liveRoomChatMessages}
                      chatError={roomChatError}
                      onChatSend={handleRoomChatSend}
                      floorNotes={floorNoteMarkers}
                      onFloorNoteOpen={handleFloorNoteOpen}
                      onComposeFloorNote={handleComposeFloorNote}
                      canDropFloorNote={isInSelectedRoom}
                      floorNotePanel={(() => {
                        if (isComposingFloorNote) {
                          return (
                            <article className="room-note-card">
                              <button
                                type="button"
                                className="room-member-card-close"
                                onClick={handleCloseRoomPanels}
                                aria-label={t("閉じる")}
                              >
                                ×
                              </button>
                              <span className="room-note-card-kicker">{t("✉ 置き手紙を残す")}</span>
                              <textarea
                                value={floorNoteDraft}
                                onChange={(event) => {
                                  setFloorNoteDraft(event.target.value);
                                  if (floorNoteError) setFloorNoteError("");
                                }}
                                placeholder={t("次に来た人へのひとこと（例：明日の朝、レビューお願いします）")}
                                maxLength={200}
                                autoFocus
                              />
                              {floorNoteError ? (
                                <span className="room-note-card-time" style={{ color: "#c0392b" }}>
                                  {floorNoteError}
                                </span>
                              ) : null}
                              <div className="room-note-card-actions">
                                <button
                                  type="button"
                                  className="is-ghost"
                                  onClick={handleCloseRoomPanels}
                                >
                                  {t("やめる")}
                                </button>
                                <button
                                  type="button"
                                  className="is-primary"
                                  onClick={() => void handleSaveFloorNote()}
                                  disabled={isSavingFloorNote || !floorNoteDraft.trim()}
                                >
                                  {isSavingFloorNote ? t("残しています…") : t("置く")}
                                </button>
                              </div>
                            </article>
                          );
                        }
                        if (openFloorNoteId) {
                          const note = floorNotes.find((item) => item.id === openFloorNoteId);
                          if (!note) return null;
                          return (
                            <article className="room-note-card">
                              <button
                                type="button"
                                className="room-member-card-close"
                                onClick={handleCloseRoomPanels}
                                aria-label={t("閉じる")}
                              >
                                ×
                              </button>
                              <span className="room-note-card-kicker">{t("✉ 置き手紙")}</span>
                              <span className="room-note-card-author">
                                <i style={{ background: note.color || "var(--ink)" }} />
                                {note.name}
                              </span>
                              <p className="room-note-card-body">{note.text}</p>
                              <span className="room-note-card-time">
                                {formatPostTime(note.createdAt)}{t("・24時間で消えます")}
                              </span>
                              {note.userId === currentUserUid ? (
                                <div className="room-note-card-actions">
                                  <button
                                    type="button"
                                    className="is-danger"
                                    onClick={() => void handleDeleteFloorNote(note.id)}
                                  >
                                    {t("削除")}
                                  </button>
                                </div>
                              ) : null}
                            </article>
                          );
                        }
                        return null;
                      })()}
                      monuments={roomMonuments}
                      onMonumentOpen={(id) => {
                        handleCloseRoomPanels();
                        setOpenMonumentId(id);
                      }}
                      monumentPanel={(() => {
                        if (!openMonumentId) return null;
                        const monument = roomMonuments.find((m) => m.id === openMonumentId);
                        if (!monument) return null;
                        return (
                          <article className="room-monument-card">
                            <button
                              type="button"
                              className="room-member-card-close"
                              onClick={handleCloseRoomPanels}
                              aria-label={t("閉じる")}
                            >
                              ×
                            </button>
                            <span className="room-monument-card-kicker">{t("🏛️ 記念碑")}</span>
                            <span className="room-monument-card-icon">{monument.icon}</span>
                            <h3>{monument.name}</h3>
                            <p>{monument.detail}</p>
                          </article>
                        );
                      })()}
                      totalLearnedLabel={`${Math.round(roomTotalMinutes / 60).toLocaleString()}h learned`}
                      learningItemSuggestions={learningItems
                        .filter((item) => !item.archived)
                        .map((item) => ({ id: item.id, name: item.name, color: item.color }))}
                      onLearningItemRegister={(presetName) => openLearningEditorForCreate(presetName)}
                      onOpenRecruitmentModal={handleOpenRecruitmentModal}
                      canRenameRoom={
                        Boolean(currentUser) &&
                        (selectedRoom.createdBy === currentUser?.uid || isDeveloperAccount)
                      }
                      onRenameRoom={(nextName) => persistRoomRename(selectedRoom.id, nextName)}
                      activeRecruitmentSummary={(() => {
                        if (!selectedRoom || !currentUser) return null;
                        const mine = workspaceRecruitments.find(
                          (rec) =>
                            rec.userId === currentUser.uid &&
                            rec.roomId === selectedRoom.id &&
                            new Date(rec.expiresAt).getTime() > feedNowTick,
                        );
                        if (!mine) return null;
                        const startAtMs = new Date(mine.startAt).getTime();
                        const isUpcoming = feedNowTick < startAtMs;
                        return {
                          stateLabel: isUpcoming
                            ? t("{time}開始予定", {
                                time: new Date(mine.startAt).toLocaleTimeString("ja-JP", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                              })
                            : t("募集中"),
                          joinedCount: mine.joinedUserIds.length,
                          onCancel: () => handleCancelRecruitment(mine),
                        };
                      })()}
                    />
                  </>
                ) : (
                  <div className="room-empty-detail">
                    <p className="card-kicker">Silent Workspace</p>
                    <h3>{t("まずはRoomを作成しましょう。")}</h3>
                    <p>{t("上の入力欄から、自分の集中場所を作成できます。")}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </motion.section>
      ) : currentView === "teams" ? (
        <motion.section
          className="teams-screen"
          aria-label="Contribution Arc for Teams"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {/* B2B pitch surface. Reachable directly via ?view=teams so
              the URL can be shared in emails / Twitter / decks; also
              linked from the home dashboard for in-app discovery. The
              CTA branches on auth + org state so prospects, fresh
              signups, and existing solo users all land somewhere
              actionable. */}
          <header className="teams-hero">
            <p className="card-kicker">Contribution Arc for Teams</p>
            <h1>
              {t("チームの学びと集中を、")}<br />
              {t("静かに可視化する。")}
            </h1>
            <p className="teams-hero-lede">
              {t("通知も通話もない作業部屋に集まるだけ。学習時間と GitHub コミットが自動で積み上がり、チームが学びに投じた時間が静かに可視化されます。")}
            </p>
            <div className="teams-hero-cta">
              {currentOrganization ? (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => {
                    setCurrentView("workspace");
                  }}
                >
                  {t("{name} のワークスペースを開く →", { name: currentOrganization.name })}
                </button>
              ) : currentUser ? (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => {
                    setOrgError("");
                    setNewOrgName("");
                    setIsOrgCreateOpen(true);
                  }}
                >
                  {t("組織を作って始める →")}
                </button>
              ) : (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => signInWithPopup(auth, googleProvider).catch(() => undefined)}
                >
                  {t("Google で 30 秒で始める →")}
                </button>
              )}
              <a
                href="mailto:ari.initx@gmail.com?subject=Contribution%20Arc%20for%20Teams%20%E5%B0%8E%E5%85%A5%E7%9B%B8%E8%AB%87"
                className="teams-cta-secondary"
              >
                {t("導入相談（メール）")}
              </a>
            </div>
            <p className="teams-hero-fineprint">
              {t("クレジットカード不要・β 期間中は全機能無料")}
            </p>
            <ul className="teams-trustbar" aria-label={t("主な機能")}>
              <li>{t("通知ゼロ設計")}</li>
              <li>{t("Slack 連携")}</li>
              <li>{t("GitHub 連携")}</li>
              <li>{t("CSV エクスポート")}</li>
              <li>{t("SSO / SCIM 対応予定")}</li>
            </ul>
          </header>

          <section className="teams-preview" aria-label={t("ダッシュボードのイメージ")}>
            <div className="teams-preview-frame">
              <div className="teams-preview-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <p>{t("Admin ダッシュボード")}</p>
              </div>
              <div className="teams-preview-body">
                <div className="teams-preview-metrics">
                  <div className="teams-metric">
                    <p className="teams-metric-label">{t("今月の累計学習")}</p>
                    <p className="teams-metric-value">
                      428<small>{t("時間")}</small>
                    </p>
                    <p className="teams-metric-delta">{t("先月比 +18%")}</p>
                  </div>
                  <div className="teams-metric">
                    <p className="teams-metric-label">{t("アクティブメンバー")}</p>
                    <p className="teams-metric-value">
                      24<small>{t("人")}</small>
                    </p>
                    <p className="teams-metric-delta">{t("継続率 92%")}</p>
                  </div>
                  <div className="teams-metric">
                    <p className="teams-metric-label">{t("今週のコミット")}</p>
                    <p className="teams-metric-value">1,206</p>
                    <p className="teams-metric-delta">{t("直近 7 日間")}</p>
                  </div>
                </div>
                <div className="teams-preview-chart" aria-hidden="true">
                  {[38, 52, 44, 67, 71, 59, 83, 76, 64, 90, 72, 81].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <p className="teams-preview-caption">
              {t("※ 表示はイメージです。チームの学習時間・コミットを集計し、CSV で書き出せます。")}
            </p>
          </section>

          {currentOrganization && currentOrganization.ownerUid === currentUser?.uid ? (
            <section className="teams-plan-manage" aria-label={t("現在のプラン")}>
              <div className="teams-plan-manage-head">
                <p className="card-kicker">{t("{name} の現在のプラン", { name: currentOrganization.name })}</p>
                <h2>{getPlanLocalized(currentOrganization.planTier ?? "free", language).name}</h2>
                <p>{getPlanLocalized(currentOrganization.planTier ?? "free", language).tagline}</p>
              </div>
              <div className="teams-plan-manage-actions">
                {BETA_ALL_FEATURES_FREE ? (
                  <p className="teams-plan-manage-beta">
                    {t("β 期間中はすべての機能を無料でお使いいただけます。")}<br />
                    {t("正式版の開始時にプランの選択・お支払いが有効になります。")}
                  </p>
                ) : isBillingConfigured() ? (
                  (currentOrganization.planTier ?? "free") === "free" ? (
                    <>
                      <button
                        type="button"
                        className="teams-cta-primary"
                        onClick={() => handleStartCheckout("team")}
                        disabled={billingBusy}
                      >
                        {billingBusy ? t("処理中…") : t("Team にアップグレード →")}
                      </button>
                      <a
                        className="teams-cta-secondary"
                        href="mailto:ari.initx@gmail.com?subject=Enterprise%20%E5%B0%8E%E5%85%A5%E7%9B%B8%E8%AB%87"
                      >
                        {t("Enterprise を相談")}
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="teams-cta-primary"
                      onClick={handleManageBilling}
                      disabled={billingBusy}
                    >
                      {billingBusy ? t("処理中…") : t("請求・プランを管理 →")}
                    </button>
                  )
                ) : (
                  <a
                    className="teams-cta-secondary"
                    href="mailto:ari.initx@gmail.com?subject=Contribution%20Arc%20for%20Teams%20%E5%B0%8E%E5%85%A5%E7%9B%B8%E8%AB%87"
                  >
                    {t("アップグレードの相談（メール）")}
                  </a>
                )}
              </div>
            </section>
          ) : null}

          <section className="teams-values" aria-label={t("価値提案")}>
            <article>
              <h3>{t("組織限定の作業部屋")}</h3>
              <p>
                {t("社内・チーム内だけで共有できるルーム。他社や個人ユーザーからは見えず、招待リンクで仲間を招きます。")}
              </p>
            </article>
            <article>
              <h3>{t("Slack に流れる気配")}</h3>
              <p>
                {t("メンバーの入室・募集・日次サマリーを Slack チャンネルに自動投稿。リモート同士でも空気感が伝わります。")}
              </p>
            </article>
            <article>
              <h3>{t("投資の可視化")}</h3>
              <p>
                {t("Admin ダッシュボードでチームの累計学習時間・ストリーク・コミット数を集計。CSV エクスポートで L&D レポートに直結。")}
              </p>
            </article>
          </section>

          <section className="teams-steps" aria-label={t("導入の流れ")}>
            <header>
              <p className="card-kicker">How it works</p>
              <h2>{t("最短 30 秒で、チームの可視化を始められる")}</h2>
            </header>
            <ol className="teams-steps-list">
              <li>
                <span className="teams-step-no">01</span>
                <h3>{t("組織を作る")}</h3>
                <p>{t("Google で 30 秒。クレジットカードは要りません。")}</p>
              </li>
              <li>
                <span className="teams-step-no">02</span>
                <h3>{t("招待リンクを配る")}</h3>
                <p>{t("リンクを共有するだけ。メンバーは作業部屋に入るだけで集計が始まります。")}</p>
              </li>
              <li>
                <span className="teams-step-no">03</span>
                <h3>{t("ダッシュボードで可視化")}</h3>
                <p>{t("学習時間・コミット・継続率を集計し、CSV で L&D レポートへ。")}</p>
              </li>
            </ol>
          </section>

          <section className="teams-privacy" aria-label={t("プライバシー方針")}>
            <div>
              <p className="card-kicker">Privacy by design</p>
              <h2>{t("監視ではなく、投資の可視化に振り切る")}</h2>
              <p>
                {t("個別の学習ログ・投稿内容は admin にも表示しません。可視化されるのは「チームがどれだけ投資したか」だけ。マネージャー・現場の双方が安心して使える設計です。")}
              </p>
            </div>
            <ul>
              <li>{t("個別の作業内容・投稿本文は admin に非表示")}</li>
              <li>{t("退出すると組織限定ルームは即時に見えなくなります")}</li>
              <li>{t("データは Firestore に暗号化保存・退会時に削除可能")}</li>
              <li>{t("労務管理を意識した長時間警告・休憩促し（順次対応）")}</li>
            </ul>
          </section>

          <section className="teams-pricing" aria-label={t("プラン")}>
            <header>
              <h2>{t("プラン(β 期間中は全機能無料)")}</h2>
              <p>{t("正式版リリース時に以下の構成で提供予定です。")}</p>
            </header>
            <div className="teams-pricing-grid">
              {/* 料金表は src/services/plans.ts(単一の真実)から生成。
                  表示文言・価格・推奨バッジはすべて PLANS を編集すれば
                  こことゲーティングが同時に揃う。 */}
              {PLANS.map((plan) => {
                // JP literals in PLANS double as dictionary keys — translate
                // at render time so the pricing card matches the UI language.
                const localized = getPlanLocalized(plan.tier, language);
                return (
                  <article
                    key={plan.tier}
                    className={`teams-plan${plan.featured ? " is-featured" : ""}`}
                  >
                    {plan.featured ? <span className="teams-plan-badge">{t("推奨")}</span> : null}
                    <h3>{plan.name}</h3>
                    <p className="teams-plan-price">
                      {localized.priceLabel}
                      {localized.priceUnit ? <small>{localized.priceUnit}</small> : null}
                    </p>
                    <p className="teams-plan-tagline">{localized.tagline}</p>
                    <ul>
                      {localized.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
            <p className="teams-pricing-note">
              {t("※ 価格は予定です。β 期間中は全機能無料でお使いいただけます。")}
            </p>
          </section>

          <section className="teams-faq" aria-label={t("よくある質問")}>
            <header>
              <p className="card-kicker">FAQ</p>
              <h2>{t("導入前の、よくある質問")}</h2>
            </header>
            <div className="teams-faq-list">
              <details>
                <summary>{t("個人の作業内容は管理者に見えますか？")}</summary>
                <p>
                  {t("いいえ。個別の学習ログ・投稿本文は admin にも表示しません。可視化されるのは「チームがどれだけ学びに投資したか」だけです。")}
                </p>
              </details>
              <details>
                <summary>{t("データはどこに保存されますか？")}</summary>
                <p>
                  {t("Google Cloud(Firestore)に暗号化して保存します。退会時にはデータを削除できます。")}
                </p>
              </details>
              <details>
                <summary>{t("最低何人から使えますか？")}</summary>
                <p>
                  {t("1 人からお使いいただけます。Team プランは 5〜50 名のチームを想定しています。")}
                </p>
              </details>
              <details>
                <summary>{t("解約はいつでもできますか？")}</summary>
                <p>
                  {t("はい。請求ポータルからいつでも解約でき、当月末までご利用いただけます。")}
                </p>
              </details>
              <details>
                <summary>{t("SSO / SCIM には対応していますか？")}</summary>
                <p>
                  {t("Enterprise プランで SAML / SSO・SCIM プロビジョニング・監査ログに対応します。導入相談からご連絡ください。")}
                </p>
              </details>
            </div>
          </section>

          <section className="teams-cta-band" aria-label={t("始める")}>
            <h2>{t("チームの学びを、今日から可視化する。")}</h2>
            <p>{t("β 期間中は全機能無料。まずは組織を作って、作業部屋を開いてみてください。")}</p>
            <div className="teams-hero-cta">
              {currentOrganization ? (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => {
                    setCurrentView("workspace");
                  }}
                >
                  {t("{name} のワークスペースを開く →", { name: currentOrganization.name })}
                </button>
              ) : currentUser ? (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => {
                    setOrgError("");
                    setNewOrgName("");
                    setIsOrgCreateOpen(true);
                  }}
                >
                  {t("組織を作って始める →")}
                </button>
              ) : (
                <button
                  type="button"
                  className="teams-cta-primary"
                  onClick={() => signInWithPopup(auth, googleProvider).catch(() => undefined)}
                >
                  {t("Google で 30 秒で始める →")}
                </button>
              )}
              <a
                href="mailto:ari.initx@gmail.com?subject=Contribution%20Arc%20for%20Teams%20%E5%B0%8E%E5%85%A5%E7%9B%B8%E8%AB%87"
                className="teams-cta-secondary"
              >
                {t("導入相談(メール)")}
              </a>
            </div>
          </section>

          <footer className="teams-foot">
            <p>
              {t("質問・導入相談は")}{" "}
              <a href="mailto:ari.initx@gmail.com">ari.initx@gmail.com</a>{" "}
              {t("までお気軽にどうぞ。")}
            </p>
            <button
              type="button"
              className="teams-cta-secondary"
              onClick={() => setCurrentView("home")}
            >
              ← {t("ホームに戻る")}
            </button>
          </footer>
        </motion.section>
      ) : currentView === "shop" && !IS_IOS_BUILD ? (
        <motion.section
          className="shop-screen"
          aria-label={t("ショップ")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("home")}>
              ← Home
            </button>
          </div>

          <section className="card shop-card" aria-label={t("ショップヘッダー")}>
            <div className="shop-card-head">
              <div>
                <p className="card-kicker">Shop</p>
                <h2>{t("キャラクターをカスタマイズ")}</h2>
                <p className="shop-card-lede">
                  {t("シルエットや姿を変えて、自分だけの分身に。所持している Arc で購入できます。")}
                </p>
              </div>
              <div className="shop-balance" aria-label={t("所持 Arc")}>
                <span className="shop-balance-label">{t("所持 Arc")}</span>
                <strong className="shop-balance-value">
                  <span className="shop-coin-icon" aria-hidden="true">◆</span>
                  {coins.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Daily feed-post bonus explainer. Surfaces the only
                non-purchase way to earn Arc inside the app right now
                — without this, users have no idea where the coins
                come from. Progress bar fills as the user accrues
                toward the 500 lifetime cap. */}
            <div className="shop-feed-bonus" role="group" aria-label={t("投稿で Arc を貯める")}>
              <div className="shop-feed-bonus-head">
                <strong>{t("投稿で Arc を貯める")}</strong>
                <span className="shop-feed-bonus-amount">
                  {feedRewardArcEarned} / 500 Arc
                </span>
              </div>
              <p className="shop-feed-bonus-copy">
                {t("1 日 1 回投稿すると +50 Arc。累計 500 Arc までもらえます。")}
                {feedRewardArcEarned >= 500
                  ? t("上限に到達しました。ありがとうございます！")
                  : lastFeedRewardDate === todayDateKey
                    ? t("今日の分は受け取り済み。明日また投稿してみてください。")
                    : t("今日はまだ受け取っていません。投稿してみてください。")}
              </p>
              <div
                className="shop-feed-bonus-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={500}
                aria-valuenow={feedRewardArcEarned}
              >
                <span
                  style={{ width: `${Math.min(100, (feedRewardArcEarned / 500) * 100)}%` }}
                />
              </div>
            </div>
          </section>

          <ArcPurchasePanel
            catalog={ARC_PACK_CATALOG}
            onPurchaseGranted={(amount) => setCoins((prev) => prev + amount)}
          />

          <section className="shop-section" aria-label={t("シルエット")}>
            <header className="shop-section-head">
              <h3>{t("シルエット")}</h3>
              <span>{t("分身の姿を変える")}</span>
            </header>
            <div className="shop-product-grid">
              {shapeShopCatalog.map((item) => {
                const isOwned = ownedCharacterShapes.includes(item.shape);
                const canAfford = coins >= item.price;
                const isEquipped = playerCharacterShape === item.shape;
                return (
                  <article
                    key={item.shape}
                    className={`shop-product-card${isOwned ? " is-owned" : ""}`}
                  >
                    <div className="shop-product-preview">
                      <ProfileCharacterPreview
                        color={playerCharacterColor}
                       
                        shape={item.shape}
                      />
                    </div>
                    <div className="shop-product-body">
                      <p className="shop-product-tagline">{t(item.tagline)}</p>
                      <h4 className="shop-product-name">{item.name}</h4>
                      <p className="shop-product-description">{t(item.description)}</p>
                    </div>
                    <div className="shop-product-footer">
                      {isOwned ? (
                        <>
                          <span className="shop-product-owned">{t("所持済み")}</span>
                          {isEquipped ? (
                            <span className="shop-product-equipped">{t("使用中")}</span>
                          ) : (
                            <button
                              type="button"
                              className="shop-product-equip"
                              onClick={() => chooseCharacterShape(item.shape)}
                            >
                              {t("着用する")}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="shop-product-price">
                            <span className="shop-coin-icon" aria-hidden="true">◆</span>
                            {item.price.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="shop-product-buy"
                            disabled={!canAfford}
                            onClick={() => {
                              if (!canAfford) return;
                              const ok = window.confirm(
                                t("{name} を {price} Arc で購入しますか？", { name: t(item.name), price: item.price.toLocaleString() }),
                              );
                              if (!ok) return;
                              setCoins((value) => Math.max(0, value - item.price));
                              setOwnedCharacterShapes((current) =>
                                current.includes(item.shape) ? current : [...current, item.shape],
                              );
                              chooseCharacterShape(item.shape);
                            }}
                          >
                            {canAfford ? t("購入する") : t("Arc 不足")}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </motion.section>
      ) : currentView === "friends" ? (
        /* MENU > フレンド・検索 から遷移する専用画面。検索フォーム +
           届いた申請 + 既存フレンド一覧を 1 画面に並べる。モーダル
           popover では「押しても何も起きない」と感じる原因になっていた
           ため、ちゃんとした画面として実装する。 */
        <motion.section
          className="friends-screen"
          aria-label={t("フレンド")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("profile")}>
              ← {t("プロフィール")}
            </button>
          </div>

          <section className="friends-screen-card">
            <header className="friends-screen-head">
              <p className="card-kicker">Friends</p>
              <h1>{t("フレンド")}</h1>
            </header>

            {/* ユーザー検索 */}
            <form className="friends-screen-search" onSubmit={handleUserSearch}>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value.toLowerCase())}
                placeholder={t("ユーザーIDで探す (例: ari.dev)")}
                maxLength={30}
                aria-label={t("ユーザーID")}
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? "…" : t("検索")}
              </button>
            </form>
            {!userId ? (
              <p className="friends-screen-note">
                {t("フォロー機能を使うには、設定から自分のユーザーIDを登録してください。")}
              </p>
            ) : null}
            {searchError ? (
              <p className="friends-screen-error" role="alert">
                {searchError}
              </p>
            ) : null}
            {searchResults.length > 0 ? (
              <ul className="friends-screen-results">
                {searchResults.slice(0, 12).map((profile) => {
                  const isFriend = friends.some((friend) => friend.uid === profile.uid);
                  const isPending = friendRequests.some(
                    (request) =>
                      request.profile.uid === profile.uid &&
                      request.status === "pending",
                  );
                  return (
                    <li key={profile.uid}>
                      <button
                        type="button"
                        className="friends-screen-row"
                        onClick={() => {
                          handleUserProfileOpen(profile);
                        }}
                      >
                        <ProfileCharacterPreview
                          color={profile.characterColor}
                          shape={profile.characterShape || "default"}
                        />
                        <span className="friends-screen-row-text">
                          <strong>{profile.displayName || profile.userId}</strong>
                          <small>
                            @{profile.userId}
                            {isFriend ? ` · ${t("フレンド")}` : isPending ? ` · ${t("申請中")}` : ""}
                          </small>
                        </span>
                        <span aria-hidden="true" className="friends-screen-row-arrow">›</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {/* 届いている申請 */}
            {(() => {
              const incoming = friendRequests.filter(
                (r) => r.direction === "incoming" && r.status === "pending",
              );
              if (incoming.length === 0) return null;
              return (
                <div className="friends-screen-section">
                  <p className="friends-screen-section-label">
                    {t("届いている申請")} ({incoming.length})
                  </p>
                  <ul className="friends-screen-results">
                    {incoming.map((request) => (
                      <li key={request.id}>
                        <div className="friends-screen-row friends-screen-row-incoming">
                          <ProfileCharacterPreview
                            color={request.profile.characterColor}
                            shape={request.profile.characterShape || "default"}
                          />
                          <span className="friends-screen-row-text">
                            <strong>{request.profile.displayName || request.profile.userId}</strong>
                            <small>@{request.profile.userId}</small>
                          </span>
                          <span className="friends-screen-row-actions">
                            <button
                              type="button"
                              className="friends-screen-accept"
                              onClick={() => handleFriendAccept(request)}
                            >
                              {t("承認")}
                            </button>
                            <button
                              type="button"
                              className="friends-screen-reject"
                              onClick={() => handleFriendReject(request)}
                              aria-label={t("削除")}
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* フレンド一覧 */}
            <div className="friends-screen-section">
              <p className="friends-screen-section-label">
                {t("フレンド")} ({friends.length})
              </p>
              {friends.length === 0 ? (
                <p className="friends-screen-empty">
                  {t("まだフレンドがいません。上の検索からユーザーIDで申請してみよう。")}
                </p>
              ) : (
                <ul className="friends-screen-results">
                  {friends.map((friend) => (
                    <li key={friend.uid}>
                      <button
                        type="button"
                        className="friends-screen-row"
                        onClick={async () => {
                          /* フレンド行 → プロフィール画面へ。最新の
                             プロフィール doc を取りに行ってから開く。 */
                          try {
                            const snap = await getDoc(doc(db, "users", friend.uid));
                            if (snap.exists()) {
                              const profile = normalizeUserProfile(
                                friend.uid,
                                snap.data() as Partial<UserProfile>,
                              );
                              handleUserProfileOpen(profile);
                            }
                          } catch (error) {
                            console.info("Open friend profile skipped.", error);
                          }
                        }}
                      >
                        {friend.avatar ? (
                          <span className="friends-screen-row-avatar-img">
                            <img src={friend.avatar} alt="" />
                          </span>
                        ) : (
                          <ProfileCharacterPreview color={undefined} shape="default" />
                        )}
                        <span className="friends-screen-row-text">
                          <strong>{friend.name}</strong>
                          <small>@{friend.userId}</small>
                        </span>
                        <span aria-hidden="true" className="friends-screen-row-arrow">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </motion.section>
      ) : currentView === "manager" ? (
        <motion.section
          className="manager-screen"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("home")}>
              ← Home
            </button>
          </div>
          {currentOrganization && currentUser?.uid === currentOrganization.ownerUid ? (
            isLoadingOrgMembers ? (
              <div className="manager-loading">
                <p>{t("読み込み中…")}</p>
              </div>
            ) : (
              <ManagerDashboard
                teamMembers={orgMembers}
                currentUser={{
                  uid: currentUser.uid,
                  userId: userId,
                  displayName: currentUser.displayName || "Manager",
                  avatarUrl: currentUser.photoURL || "",
                  level: 0,
                  effortExp: 0,
                  outputExp: 0,
                  streak: 0,
                  organizationRole: "owner",
                  lastSyncedAt: new Date().toISOString(),
                  contributionCount: 0,
                }}
                organizationName={currentOrganization.name}
                hasSlackWebhook={
                  !!currentOrganization.slackWebhookUrl &&
                  isValidSlackWebhookUrl(currentOrganization.slackWebhookUrl)
                }
                onSendSlackDigest={async () => {
                  const webhookUrl = currentOrganization.slackWebhookUrl;
                  if (!webhookUrl || !isValidSlackWebhookUrl(webhookUrl)) {
                    return t("Slackウェブフックが設定されていません");
                  }
                  const payload = buildWeeklyDigestPayload({
                    organizationName: currentOrganization.name,
                    members: orgMembers,
                    language,
                  });
                  const result = await postToSlackWebhook(webhookUrl, payload);
                  if (!result.ok) {
                    return t("Slack送信に失敗: {error}", { error: result.error || "unknown" });
                  }
                  return undefined;
                }}
                onFetchOrgLogs={(sinceIso) =>
                  fetchOrganizationStudyLogs(db, currentOrganization.id, sinceIso)
                }
                onFetchMemberLogs={(memberUid) =>
                  listMemberStudyLogs(db, currentOrganization.id, memberUid)
                }
              />
            )
          ) : (
            <div className="manager-empty-state">
              <div className="card">
                <p className="card-kicker">Manager Dashboard</p>
                <h2>{t("アクセス権限がありません")}</h2>
                <p>{t("マネージャーダッシュボードはOrganizationのオーナーのみアクセス可能です")}</p>
              </div>
            </div>
          )}
        </motion.section>
      ) : (
      <motion.div
        className="home-screen"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SNAPPY}
      >

      {/* 運営からのお知らせ。ホームには pinned (ウェルカム) を固定で
          先頭に出し、その下に最新 1 件だけ。過去のお知らせはヘッダー
          右の「すべて見る」から一覧モーダルで辿る。中身は ANNOUNCEMENTS
          (モジュール冒頭の定数) なので Firestore 読み取りは発生しない。 */}
      <section className="home-announcements card" aria-label={t("運営からのお知らせ")}>
        <header className="home-announcements-head">
          <div>
            <p className="card-kicker">{t("お知らせ")}</p>
            <strong>{t("運営からのお知らせ")}</strong>
          </div>
          {/* 固定以外のお知らせは今後追加していくので、ボタンは常に表示して
              一覧モーダルへの導線を残しておく（現状 0 件でも将来の追加に備える）。 */}
          <button
            type="button"
            className="home-announcements-viewall"
            onClick={() => setIsAnnouncementsModalOpen(true)}
          >
            {t("すべて見る")}
          </button>
        </header>
        {ANNOUNCEMENTS.length === 0 ? (
          <p className="home-announcements-empty">{t("いまは新しいお知らせはありません。")}</p>
        ) : (
          <ol className="home-announcements-list">
            {/* ホームには固定のお知らせ (ウェルカム) + 非固定の最新 1 件を
                出す。固定を先頭に、その下へ最新 1 件。残りは「すべて見る」
                モーダルから閲覧する設計。重複（固定が最新を兼ねる場合）は
                id で除外する。 */}
            {[PINNED_ANNOUNCEMENT, LATEST_ANNOUNCEMENT]
              .filter((item): item is Announcement => item !== null)
              .filter(
                (item, index, list) =>
                  list.findIndex((other) => other.id === item.id) === index,
              )
              .map((announcement, index) => {
                const isOpen = openAnnouncementId === announcement.id;
                return (
                  <motion.li
                    key={announcement.id}
                    className={`home-announcement-item${isOpen ? " is-open" : ""}${announcement.pinned ? " is-pinned" : ""}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                  >
                    <button
                      type="button"
                      className="home-announcement-trigger"
                      onClick={() =>
                        setOpenAnnouncementId((current) =>
                          current === announcement.id ? null : announcement.id,
                        )
                      }
                      aria-expanded={isOpen}
                      aria-controls={`announcement-body-${announcement.id}`}
                    >
                      <span className="home-announcement-row-text">
                        <span className="home-announcement-date">
                          {announcement.pinned ? (
                            <span className="home-announcement-pin" aria-hidden="true">📌 </span>
                          ) : null}
                          {announcement.date}
                        </span>
                        <strong className="home-announcement-title">{t(announcement.title)}</strong>
                      </span>
                      <span
                        className={`home-announcement-chevron${isOpen ? " is-open" : ""}`}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M9 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                    {isOpen ? (
                      <div
                        id={`announcement-body-${announcement.id}`}
                        className="home-announcement-body"
                      >
                        <p className="home-announcement-body-text">{t(announcement.body)}</p>
                        {announcement.pinned ? (
                          <button
                            type="button"
                            className="home-announcement-feedback-cta"
                            onClick={() => {
                              setFeedbackError("");
                              setIsFeedbackModalOpen(true);
                            }}
                          >
                            {t("要望を書く")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </motion.li>
                );
              })}
          </ol>
        )}
      </section>

      {currentUser ? (
        <TutorialHint
          uid={currentUser.uid}
          feature="home"
          title={t("ホーム — あなたの学習を一望できる場所")}
          body={t("積み上げの全体像と、いま仲間が何をしているかをまとめて見られます。")}
          bullets={[
            t("13週間のコントリビューショングラフで毎日の取り組みを可視化"),
            t("今週の学習時間・最長連続日数・ジャンル分布をひと目で"),
            t("GitHub を連携すると commit もこのグラフに合流します"),
            t("下の「みんなの記録」「日報」もここから流れてきます"),
          ]}
        />
      ) : null}

      {/* Domain auto-join discovery (Phase 7). When the user's email
          domain matches an existing org's autoJoinDomains list, we
          surface a one-tap join CTA *above* the generic Teams pitch
          ribbon — they already have a destination, no need to read
          the marketing. Falls back to the Teams ribbon when no match. */}
      {!currentOrganization && discoveredOrgs.length > 0 ? (
        <div className="home-domain-discovery">
          {discoveredOrgs.map((org) => (
            <button
              type="button"
              key={org.id}
              className="home-teams-ribbon is-domain-match"
              onClick={() => handleJoinByDomain(org)}
              disabled={isOrgWorking}
            >
              <span className="home-teams-ribbon-icon" aria-hidden="true">●</span>
              <span className="home-teams-ribbon-copy">
                <strong>{t("{name} に参加する", { name: org.name })}</strong>
                <small>{t("あなたのメールドメインが許可されています — タップで参加")}</small>
              </span>
              <span className="home-teams-ribbon-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Discovery ribbon for the B2B surface. Sits near the top of
          the home view so any signed-in user (and anyone we share a
          screenshot with) sees a clear path into the Teams pitch.
          Hidden when the user is already inside an org — at that
          point the ribbon would just be noise. */}
      {!currentOrganization && discoveredOrgs.length === 0 ? (
        <button
          type="button"
          className="home-teams-ribbon"
          onClick={() => setCurrentView("teams")}
        >
          <span className="home-teams-ribbon-copy">
            <strong>{t("チーム / 企業で使う")}</strong>
            <small>{t("組織限定ルーム・Admin ダッシュボード・Slack 連携")}</small>
          </span>
          <span className="home-teams-ribbon-arrow" aria-hidden="true">→</span>
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {(() => {
          const hasTodayPlan = !!(todayDailyReport && todayDailyReport.plan.trim());
          const isDismissed = dailyPromptDismissedFor === currentLearnerDate;
          if (hasTodayPlan || isDismissed) return null;
          return (
            <motion.section
              key="daily-plan-prompt"
              className="daily-plan-prompt"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              aria-label={t("今日の予定を立てる")}
            >
              <div className="daily-plan-prompt-head">
                <div>
                  <p className="card-kicker">TODAY</p>
                  <strong>{t("おはよう。今日は何をやる？")}</strong>
                  <small>{formatDailyDate(currentLearnerDate)}</small>
                </div>
                <button
                  type="button"
                  className="daily-plan-prompt-skip"
                  onClick={handleDailyPromptDismiss}
                  aria-label={t("今日は書かずに進む")}
                  data-tooltip={t("今日は書かずに進む")}
                >
                  {t("スキップ")}
                </button>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleDailyPromptSave();
                }}
              >
                <textarea
                  value={dailyPromptDraft}
                  onChange={(event) => {
                    setDailyPromptDraft(event.target.value);
                    setDailyPromptError("");
                  }}
                  placeholder={t("例: DDIA Ch.7 を読み切る")}
                  rows={2}
                  maxLength={400}
                />
                <div className="daily-plan-prompt-foot">
                  {dailyPromptError ? (
                    <span className="daily-plan-prompt-error">{dailyPromptError}</span>
                  ) : (
                    <span className="daily-plan-prompt-hint">
                      {t("日報の「今日やること」として保存される。短くてもOK。")}
                    </span>
                  )}
                  <button
                    type="submit"
                    className="daily-plan-prompt-save"
                    disabled={isSavingDailyPrompt || !dailyPromptDraft.trim()}
                  >
                    {isSavingDailyPrompt ? t("保存中") : t("今日を始める")}
                  </button>
                </div>
              </form>
            </motion.section>
          );
        })()}
      </AnimatePresence>

      {/* GitHub / 学習のコントリビューションマップ。お知らせをホーム最上部に
          出す方針に変えたので、このマップは下段へ移動した。 */}
      {contributionArcCardSection}

      </motion.div>
      )}

      </div>

      {/* feed view = 新ホーム。bottom-nav の「ホーム」を押すとここに来る。
          以前は feed-view-header に「ホームに戻る ← フィード」と出ていたが、
          新ホーム自身なので戻るボタンは外してタイトルも「ホーム」へ。 */}
      {currentView === "feed" ? (
        <article className="app-view-feed">
          <header className="feed-view-header">
            <h1>{t("ホーム")}</h1>
          </header>
          <div
            className={`feed-view-content${
              isProfileHydrated ? " is-hydrated" : " is-hydrating"
            }`}
          >
            <PullToRefresh onRefresh={handleFeedRefresh}>
              {/* ホーム最上部のコンパクトなお知らせバナー。これまで
                  プロフィールのメニューからしか辿れなかった運営からの
                  お知らせを、1 行に収めてホーム先頭に出す。タップで
                  一覧モーダル (全文) を開く。 */}
              {HEADLINE_ANNOUNCEMENT ? (
                <button
                  type="button"
                  className="home-notice-banner"
                  onClick={() => setIsAnnouncementsModalOpen(true)}
                  aria-label={`${t("お知らせ")}: ${t(HEADLINE_ANNOUNCEMENT.title)}`}
                >
                  <span className="home-notice-banner-badge" aria-hidden="true">
                    {/* MENU > お知らせ と同じベル形に統一。megaphone は
                        「拡声 / 広報」のニュアンスで意味がぼやけていた。 */}
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" />
                      <path d="M10 20a2 2 0 0 0 4 0" />
                    </svg>
                  </span>
                  <span className="home-notice-banner-text">
                    <span className="home-notice-banner-kicker">{t("お知らせ")}</span>
                    <span className="home-notice-banner-title">{t(HEADLINE_ANNOUNCEMENT.title)}</span>
                  </span>
                  <span className="home-notice-banner-chevron" aria-hidden="true">›</span>
                </button>
              ) : null}
              {feedSection}
            </PullToRefresh>
          </div>
        </article>
      ) : null}

      {/* 没入型 "ブランド" トップ画面。Jungle 系のフルブリードな
          イラストレーション + 手書きロゴを参考に、Contribution Arc の
          世界観を一枚絵で見せる演出スクリーン。
          既存のホーム/プロフィール/作業部屋等とは完全に別レイヤーで、
          ボタンから入って戻るボタンで抜けるだけ。データへの副作用なし。 */}
      {currentView === "showcase" ? (
        <article className="app-view-showcase" aria-label={t("Contribution Arc の世界")}>
          <button
            type="button"
            className="app-view-showcase-close"
            aria-label={t("閉じる")}
            onClick={() => setCurrentView("home")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {/* 背景：深い夜の森を模した多層グラデーション + 微細ノイズ。
              CSS だけで完結させてアセット 0、初回表示 0ms を狙う。 */}
          <div className="showcase-scene" aria-hidden="true">
            <div className="showcase-sky" />
            <div className="showcase-canopy" />
            <div className="showcase-mist" />

            {/* contribution grid を "地形" として下層に配置。
                各セルが脈動して "コミットの星座" として読める。 */}
            <div className="showcase-grid" role="presentation">
              {Array.from({ length: 7 * 18 }).map((_, idx) => {
                const col = idx % 18;
                const row = Math.floor(idx / 18);
                const intensity =
                  ((col * 7 + row * 13 + (col % 3) * 5) % 5) /
                  4;
                return (
                  <span
                    key={idx}
                    className="showcase-grid-cell"
                    style={
                      {
                        "--cell-intensity": intensity.toFixed(2),
                        "--cell-delay": `${(col * 0.08 + row * 0.05).toFixed(2)}s`,
                      } as CSSProperties
                    }
                  />
                );
              })}
            </div>

            {/* 中央のシルエット：分身がコミットの森を見上げる姿。
                プロフィールで選んだキャラクターを使う前提だが、
                それが未選択でも default 形状で破綻しない。 */}
            <div className="showcase-figure">
              <ProfileCharacterPreview
                color={playerCharacterColor}
                shape={playerCharacterShape}
              />
            </div>

            {/* 手前のシダ風オーバーレイ。下から立ち上がる輪郭で
                "画面の中に入り込む" 没入感を与える。 */}
            <div className="showcase-foreground" />
          </div>

          {/* ロゴ / コピー。SVG で手書き感のあるカーブを表現。
              viewBox を 1100x300 に広げて、長い "Contribution" が
              端で切れないよう textLength + lengthAdjust で確実に
              枠内に収める。 */}
          <div className="showcase-brand">
            <svg
              className="showcase-brand-mark"
              viewBox="0 0 1100 300"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Contribution"
              focusable="false"
            >
              <defs>
                <linearGradient id="showcaseInk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f0fff5" />
                  <stop offset="1" stopColor="#bfe7cc" />
                </linearGradient>
              </defs>
              <text
                x="50%"
                y="62%"
                textAnchor="middle"
                fontFamily="'Caveat', 'Pacifico', 'Brush Script MT', cursive"
                fontSize="200"
                fontWeight="700"
                fill="url(#showcaseInk)"
                textLength="980"
                lengthAdjust="spacingAndGlyphs"
                style={{ letterSpacing: "0.01em" }}
              >
                Contribution
              </text>
              <text
                x="50%"
                y="92%"
                textAnchor="middle"
                fontFamily="'Caveat', 'Pacifico', 'Brush Script MT', cursive"
                fontSize="64"
                fontWeight="600"
                fill="#bfe7cc"
                opacity="0.86"
              >
                — arc —
              </text>
            </svg>
            <p className="showcase-tagline">
              {t("日々のコミットが、あなたの軌跡を描く。")}
            </p>
            <button
              type="button"
              className="showcase-cta"
              onClick={() => setCurrentView("home")}
            >
              {t("はじめる")}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      ) : null}

      {/* Workspace view fills the canvas with the 2D room and its own
          presence/chat tools — overlaying the global FEED next to it
          competes for attention, makes the desktop layout cramped, and
          hides the room behind feed scroll on mobile. Hide it there.
          On every other view the right pane respects the user's
          isFeedOpen preference (default true, persisted to localStorage). */}
      {currentView !== "workspace" && currentView !== "feed" && isFeedOpen ? (
        <aside className="two-pane-right" aria-label={t("投稿")}>
          {feedSection}
        </aside>
      ) : null}

      </div>
      </div>

      {/* 投稿ペインの常駐トグル。開いていても畳んでいても画面右端に
          固定で出続けるので、PC のどのビューからでもワンクリックで
          投稿の表示/非表示を切り替えられる（アバターメニューから出した）。
          矢印の向き = パネルの動く方向で直感的に：開いているときは右向き
          (›＝右へ畳む)、畳んでいるときは左向き (‹＝左へ引き出す)。
          2 カラムになる ≥1081px でのみ意味を持つので、それ未満は CSS で
          非表示（狭い幅では投稿は bottom-nav のホームから辿れる）。 */}
      {currentView !== "workspace" && currentView !== "feed" ? (
        <button
          type="button"
          className={`feed-dock-toggle${isFeedOpen ? " is-open" : ""}`}
          onClick={() => setIsFeedOpen((prev) => !prev)}
          aria-pressed={isFeedOpen}
          aria-label={isFeedOpen ? t("投稿を閉じる") : t("投稿を開く")}
          data-tooltip={isFeedOpen ? t("投稿を閉じる") : t("投稿を開く")}
        >
          <span className="feed-dock-toggle-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="feed-dock-toggle-label">{t("投稿")}</span>
        </button>
      ) : null}

      {/* Mobile-only bottom navigation. Visible at ≤720px (CSS-gated).
          5 primary destinations match the desktop topbar-nav so the
          mobile user never has to dig through a menu to switch views.
          Hidden on desktop and during onboarding. */}
      {currentView && onboardingStep !== "welcome" ? (
        <nav className="mobile-bottom-nav" aria-label={t("メインナビゲーション")}>
          {/* ホーム / 学習記録 はラベルと中身の swap：
              - 「ホーム」を押すと FEED (旧投稿) view が表示される
              - 「学習記録」を押すと 旧ホーム (お知らせ等) view が表示される
              これは「ホームに feed の内容を出して、投稿タブの中身は旧ホーム」
              というユーザー要求への対応。アクティブ判定もそれに合わせて反転。 */}
          <button
            type="button"
            className={currentView === "feed" ? "is-active" : ""}
            onClick={() => setCurrentView("feed")}
            aria-label={t("ホーム")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span>{t("ホーム")}</span>
          </button>
          {/* ユーザー要望でホームの右に "日報" を配置。日々の振り返りが
              ホームから 1 タップで届く位置に来る。 */}
          <button
            type="button"
            className={currentView === "daily" ? "is-active" : ""}
            onClick={() => setCurrentView("daily")}
            aria-label={t("日報")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>{t("日報")}</span>
          </button>
          {/* 中央タブはクイック記録 CTA から「作業部屋」(作業部屋) への
              入口に変更。記録はライブラリ側の +1m/+10m… で完結するため、
              中央は仲間と静かに作業する場所への動線にした。在室者がいる
              ときは黒丸の右上に人数バッジを出して「今、誰かが居る」気配を
              そっと添える。中央アイコンは Contribution Arc 公式 PWA
              icon-512.png を使い、ブラウザがダウンスケールしてくれる
              ので 30px 表示でも高画質になる。 */}
          <button
            type="button"
            className={`is-cta${currentView === "workspace" ? " is-active" : ""}${activeMembers.length > 0 ? " has-presence" : ""}`}
            onClick={() => setCurrentView("workspace")}
            aria-label={
              activeMembers.length > 0
                ? t("作業部屋 — 現在 {count} 人が作業中", { count: activeMembers.length })
                : t("作業部屋")
            }
            aria-pressed={currentView === "workspace"}
          >
            <img
              src={`${import.meta.env.BASE_URL}icon-512.png`}
              alt=""
              aria-hidden="true"
              width="36"
              height="36"
              decoding="async"
            />
            {activeMembers.length > 0 ? (
              <span className="mobile-cta-presence" aria-hidden="true">{activeMembers.length}</span>
            ) : null}
            <span>{t("作業部屋")}</span>
          </button>
          {/* ユーザー要望でライブラリとプロフィールの並びを入れ替え、
              ライブラリを左、プロフィールを右端に配置する。 */}
          <button
            type="button"
            className={currentView === "learning" ? "is-active" : ""}
            onClick={() => setCurrentView("learning")}
            aria-label={t("ライブラリ")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 4h4v16H5zM11 4h4v16h-4zM16.5 4.8l3.4.9-3 14.6-3.4-.9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span>{t("ライブラリ")}</span>
          </button>
          {/* プロフィール導線。元は「投稿 → 学習記録」と rename していたが
              実体は home view に飛ばすブリッジ用ボタン。ユーザー要望で
              ラベルとアイコンを「プロフィール」(人物アイコン) に変更し、
              遷移先も実際のプロフィール view へ。 */}
          <button
            type="button"
            className={currentView === "profile" ? "is-active" : ""}
            onClick={() => setCurrentView("profile")}
            aria-label={t("プロフィール")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M4.5 20c1.4-3.4 4.4-5.4 7.5-5.4s6.1 2 7.5 5.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>{t("プロフィール")}</span>
          </button>
        </nav>
      ) : null}

      {/* Global toast host. Mounted once near the root so any handler
          can `showToast(...)` without prop-drilling. The fixed
          positioning + high z-index makes it the topmost UI surface,
          including on top of the mobile bottom nav. */}
      {/* Phase 10d: グローバルなクイック記録ポップオーバー. トップバーと
          mobile bottom nav から開かれる. backdrop クリック or ESC で閉じる. */}
      {isQuickLogPopoverOpen ? (
        <div
          className="quicklog-backdrop"
          role="presentation"
          onClick={closeQuickLogPopover}
        >
          <div
            className="quicklog-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quicklog-popover-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeQuickLogPopover();
              }
            }}
          >
            <header className="quicklog-popover-head">
              <div>
                <p className="card-kicker">Quick Log</p>
                <h3 id="quicklog-popover-title">{t("今すぐ記録")}</h3>
              </div>
              <button
                type="button"
                className="quicklog-popover-close"
                onClick={closeQuickLogPopover}
                aria-label={t("閉じる")}
              >
                ×
              </button>
            </header>
            {quickLogRecentItems.length === 0 ? (
              <div className="quicklog-popover-empty">
                <p>{t("学習対象がまだありません。1つ登録すると、ここから時間を記録できます。")}</p>
                <button
                  type="button"
                  className="quicklog-popover-cta"
                  onClick={() => {
                    closeQuickLogPopover();
                    setCurrentView("learning");
                  }}
                >
                  + {t("学習対象を追加")}
                </button>
              </div>
            ) : (
              <ul className="quicklog-popover-list">
                {quickLogRecentItems.map((item) => {
                  const raw = quickLogMinutesById[item.id] ?? "";
                  const minutes = Number(raw);
                  const canSubmit = Number.isFinite(minutes) && minutes > 0;
                  const submit = () => {
                    if (!canSubmit) return;
                    handleLearningQuickLog(item, minutes);
                    closeQuickLogPopover();
                  };
                  return (
                    <li
                      key={item.id}
                      className="quicklog-popover-row"
                      style={{ "--learning-card-color": item.color } as CSSProperties}
                    >
                      <span className="quicklog-popover-row-name">
                        <i aria-hidden="true" />
                        <strong>{item.name}</strong>
                      </span>
                      <span className="quicklog-popover-row-input">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={raw}
                          onChange={(event) =>
                            setQuickLogMinutesById((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              submit();
                            }
                          }}
                          placeholder="45"
                          aria-label={`${item.name} ${t("記録する分数")}`}
                        />
                        <span className="quicklog-popover-unit">{t("分")}</span>
                        <button
                          type="button"
                          className="quicklog-popover-submit"
                          disabled={!canSubmit}
                          onClick={submit}
                        >
                          {t("記録")}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <footer className="quicklog-popover-foot">
              <button
                type="button"
                className="quicklog-popover-link"
                onClick={() => {
                  closeQuickLogPopover();
                  setCurrentView("learning");
                }}
              >
                {t("学習対象を管理")} →
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      <ToastHost />
      <IOSInstallHint />
      <PWAInstallPrompt />
      <InstallInstructionsModal
        open={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </motion.main>
    </MotionConfig>
  );
}

export default App;
