import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
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
  arrayRemove,
  arrayUnion,
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
  updateDoc,
  where,
} from "firebase/firestore";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { auth, db, githubProvider, googleProvider } from "./firebase";
import {
  deleteStudyLogFromCloud,
  migrateStudyLogsToCloud,
  saveGithubActivitySummary,
  saveStudyLogToCloud,
  saveUserProgressToCloud,
  saveWorkspaceSessionToCloud,
  subscribeStudyLogsFromCloud,
} from "./services/cloudData";
import {
  deleteLearningItemFromCloud,
  saveLearningItemToCloud,
  subscribeLearningItemsFromCloud,
} from "./services/learningItems";
import {
  cancelRecruitmentInCloud,
  createRecruitmentInCloud,
  joinRecruitmentInCloud,
  subscribeActiveRecruitmentsFromCloud,
  type WorkspaceRecruitmentRecord,
} from "./services/workspaceRecruitments";
import {
  WorkspaceRecruitmentFeedCard,
  type RecruitmentAuthor,
} from "./components/feed/WorkspaceRecruitmentFeedCard";
import {
  fetchPostRepliesOnce,
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
import { fetchGithubContributions, type GithubContributions } from "./services/githubContributions";
import { type AppView, type FriendPreview, type LiveActivity } from "./components/PremiumNavigation";
import { SilentWorkspaceRoom, type RoomActivityItem } from "./components/SilentWorkspaceRoom";
import { ArcPurchasePanel } from "./components/ArcPurchasePanel";
import { ShareToXModal } from "./components/ShareToXModal";
import { TutorialHint } from "./components/TutorialHint";
import { ToastHost } from "./components/ToastHost";
import { IOSInstallHint } from "./components/IOSInstallHint";
import { resetAllTutorials } from "./services/tutorial";
import { showToast } from "./services/toast";
import "./App.css";

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

type QuestEvent = "chest" | "sword" | "flame" | "star";
type Terrain = "trail" | "plain" | "grove" | "ridge" | "citadel";

type MapCell = {
  id: number;
  level: 0 | 1 | 2 | 3 | 4;
  terrain: Terrain;
  route: boolean;
  event?: QuestEvent;
};

type StudyLog = {
  id: string;
  subject: string;
  minutes: number;
  createdAt: string;
  color?: string;
  learningItemId?: string;
};

type LearningCategory = "book" | "stack";

type LearningItem = {
  id: string;
  userId: string;
  name: string;
  category: LearningCategory;
  color: string;
  totalPages?: number;
  currentPages?: number;
  archived: boolean;
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
  isToday: boolean;
  logs: StudyLog[];
};

type StudySegment = {
  key: string;
  subject: string;
  minutes: number;
  color: string;
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
  /* Last YYYY-MM-DD (local timezone) on which the user earned the
     daily "post to feed" Arc bonus. Used to gate the reward so the
     50-Arc payout fires exactly once per calendar day. */
  lastFeedRewardDate?: string;
  /* Total Arc the user has ever earned through the daily feed-post
     bonus. Once this hits the lifetime cap (500) the daily reward
     stops paying out. Independent of the actual coin balance — the
     user can spend Arc and the cap still applies. */
  feedRewardArcEarned?: number;
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
};

type FriendRequestStatus = "pending" | "accepted";
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
type CharacterShape = "default" | "ghost" | "owl";

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
};

type OnboardingStep = "idle" | "welcome" | "settings" | "firstPost";

type RoomCreateState = "idle" | "saving" | "saved" | "offline";

type NotificationItem = {
  id: string;
  type: "dailyLog" | "post" | "friendRequest";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  sourceUserId: string;
};

type DesktopNotificationSettings = {
  dailyLog: boolean;
  post: boolean;
  friendRequest: boolean;
  sound: boolean;
  soundVolume: number;
};

type DailyReport = {
  id: string;
  userId: string;
  userName?: string;
  characterColor?: string;
  currentTitle?: string;
  date: string;
  plan: string;
  reflection: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: "synced" | "pending";
  syncError?: string;
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

type ObsidianNoteSource = {
  title: string;
  content: string;
};

const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];

// Unified motion language — used by all framer-motion components so the app
// has one coherent physical feel rather than a mix of eased curves.
const SPRING_SOFT = { type: "spring", stiffness: 280, damping: 28, mass: 0.7 } as const;
const SPRING_SNAPPY = { type: "spring", stiffness: 380, damping: 30, mass: 0.6 } as const;

// Visual char counter — circular ring that fills as you type and
// switches to a remaining-count number in the danger zone.
function CharCountRing({ value, max }: { value: number; max: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, value / max);
  const isNearLimit = value >= max - 20;
  const isOverLimit = value >= max;
  const remaining = max - value;
  const strokeColor = isOverLimit
    ? "var(--accent-warm, #d3573b)"
    : isNearLimit
    ? "#c8a95b"
    : "var(--green, #1f6f4a)";
  return (
    <span className="char-count-ring" aria-label={`${value} / ${max} 文字`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--line-strong, rgba(0,0,0,0.12))"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 12 12)"
          style={{ transition: "stroke-dashoffset 240ms ease, stroke 240ms ease" }}
        />
      </svg>
      {isNearLimit ? <small>{remaining}</small> : null}
    </span>
  );
}
const studyColorOptions = [
  { name: "Evergreen", value: "#1f6f4a" },
  { name: "Sage", value: "#7aa874" },
  { name: "Jade", value: "#2f8f83" },
  { name: "Sea", value: "#2f7890" },
  { name: "Azure", value: "#4f7fb2" },
  { name: "Indigo", value: "#5b68a6" },
  { name: "Lavender", value: "#8b72b6" },
  { name: "Plum", value: "#9b4f83" },
  { name: "Rose", value: "#bf5f78" },
  { name: "Clay", value: "#b87555" },
  { name: "Amber", value: "#c8a95b" },
  { name: "Moss", value: "#6f8f45" },
];

/* Character silhouette options offered in the profile editor.
   Order is intentional — "default" stays first so it's the
   visual fallback for legacy users. Adding a new shape here also
   requires:
   - extending the CharacterShape type
   - adding the shape to CHARACTER_SHAPES (the runtime allow-list)
   - implementing `.actor-sprite.shape-<value>` styles in App.css */
const characterShapeOptions: { value: CharacterShape; name: string }[] = [
  { value: "default", name: "人型" },
  { value: "ghost", name: "ゴースト" },
  { value: "owl", name: "フクロウ" },
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
    name: "ゴースト",
    tagline: "Soul shape",
    description: "脚のない魂のシルエット。作業部屋の片隅でふわりと漂う、もう一人のあなた。",
    price: 500,
  },
  {
    shape: "owl",
    name: "フクロウ",
    tagline: "Night owl",
    description: "丸い頭に大きな琥珀の眼。深夜にひとり手を動かす時間のお供に。",
    price: 500,
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
  { name: "ツタ", value: "#3a5a40" },
  { name: "Forest", value: "#1f6f4a" },
  { name: "Deep Green", value: "#176345" },
  { name: "Mint", value: "#2f8f83" },
  { name: "Blue", value: "#3f6f9f" },
  { name: "Navy", value: "#20334a" },
  { name: "Slate", value: "#475569" },
  { name: "Violet", value: "#7667a8" },
  { name: "Plum", value: "#7c3f6f" },
  { name: "Rose", value: "#b05268" },
  { name: "Amber", value: "#c8a95b" },
  { name: "Moss", value: "#6f8f3f" },
  { name: "Graphite", value: "#111827" },
];

const defaultStudyLogs: StudyLog[] = [];

const outputStats = {
  commits: 0,
  contributions: 0,
  pullRequests: 0,
};

const workspaceRooms: WorkspaceRoom[] = [];
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
const maxWorkspacePresenceMinutes = 12 * 60;
const onboardingMessage = "ようこそContribution Arcへ";
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
  friendRequest: `${import.meta.env.BASE_URL}sounds/notification-soft.mp3`,
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
    id: "tsuta",
    name: "ツタ",
    englishName: "Tsuta",
    label: "初期解放キャラクター",
    concept:
      "繋がりながら、ゆっくり伸びていく蔦の精霊。学習を積み重ねるたびに、新しい葉が芽吹く。",
    evolution: "ツタ → 若葉 → 蔓 → 群生",
  },
];

const eventCells = new Map<number, QuestEvent>([
  [7, "star"],
  [18, "chest"],
  [31, "sword"],
  [45, "flame"],
  [61, "star"],
  [77, "chest"],
  [92, "sword"],
  [105, "flame"],
]);

const routeCells = new Set([
  96, 97, 98, 82, 66, 50, 51, 52, 36, 20, 21, 22, 23, 39, 55, 71, 72, 73, 74,
  58, 42, 43, 44, 28, 12, 13, 14, 30, 46, 62, 78, 94, 110, 111,
]);

const contributionMap: MapCell[] = Array.from({ length: 112 }, (_, index) => {
  const base = (index * 7 + Math.floor(index / 4) * 5 + (index % 6)) % 12;
  const level = (base < 2 ? 0 : base < 5 ? 1 : base < 8 ? 2 : base < 10 ? 3 : 4) as
    | 0
    | 1
    | 2
    | 3
    | 4;
  const route = routeCells.has(index);
  const event = eventCells.get(index);
  const terrain: Terrain = event
    ? "citadel"
    : route
      ? "trail"
      : level >= 4
        ? "ridge"
        : level >= 2
          ? "grove"
          : "plain";

  return {
    id: index,
    level,
    terrain,
    route,
    event,
  };
});

const githubCallbackPath = "/auth/github/callback";

function getWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function normalizeKnowledgeTitle(value: string) {
  const withoutHash = value.split("#")[0] || value;
  const withoutAlias = withoutHash.split("|")[0] || withoutHash;
  const decoded = decodeURIComponent(withoutAlias).replace(/\\/g, "/");
  const filename = decoded.split("/").filter(Boolean).pop() || decoded;
  return filename.replace(/\.md$/i, "").trim();
}

function getNoteTitle(file: File) {
  const rawPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return normalizeKnowledgeTitle(rawPath);
}

function getObsidianLinks(content: string) {
  const links = new Set<string>();
  const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
  const markdownLinkPattern = /\[[^\]]+\]\((?!https?:\/\/|mailto:)([^)#]+)(?:#[^)]+)?\)/g;

  for (const match of content.matchAll(wikiLinkPattern)) {
    const title = normalizeKnowledgeTitle(match[1] || "");
    if (title) {
      links.add(title);
    }
  }

  for (const match of content.matchAll(markdownLinkPattern)) {
    const title = normalizeKnowledgeTitle(match[1] || "");
    if (title) {
      links.add(title);
    }
  }

  return [...links];
}

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

function buildObsidianGraph(notes: ObsidianNoteSource[]): KnowledgeGraphData {
  const nodeMap = new Map<string, Omit<KnowledgeNode, "x" | "y">>();
  const linkSet = new Set<string>();
  const connectionCount = new Map<string, number>();

  notes.forEach((note) => {
    if (!nodeMap.has(note.title)) {
      nodeMap.set(note.title, { id: note.title, title: note.title, minutes: 0, size: 13 });
    }

    getObsidianLinks(note.content).forEach((targetTitle) => {
      if (!targetTitle || targetTitle === note.title) {
        return;
      }

      if (!nodeMap.has(targetTitle)) {
        nodeMap.set(targetTitle, { id: targetTitle, title: targetTitle, minutes: 0, size: 13 });
      }

      linkSet.add(`${note.title}::${targetTitle}`);
      connectionCount.set(note.title, (connectionCount.get(note.title) || 0) + 1);
      connectionCount.set(targetTitle, (connectionCount.get(targetTitle) || 0) + 1);
    });
  });

  return withKnowledgeLayout({
    nodes: [...nodeMap.values()].map((node) => ({
      ...node,
      size: Math.min(32, 11 + (connectionCount.get(node.id) || 0) * 3.2),
    })),
    links: [...linkSet].map((key) => {
      const [source, target] = key.split("::");
      return { source, target };
    }),
  });
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

    return {
      day,
      hours: totalMinutes / 60,
      totalMinutes,
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
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

function getOutputExp() {
  return outputStats.commits * 90 + outputStats.contributions * 24 + outputStats.pullRequests * 160;
}

function removeSeedStudyLogs(logs: StudyLog[]) {
  return logs.filter((log) => !log.id.startsWith("seed-"));
}

function validateUserId(value: string) {
  if (!value) {
    return "ユーザーIDを入力してください。";
  }

  if (value.length > 30) {
    return "ユーザーIDは30文字以内にしてください。";
  }

  if (!/^[a-z0-9._]+$/.test(value)) {
    return "使用できる文字は小文字の半角英数字、_、. のみです。";
  }

  if (value.startsWith(".") || value.endsWith(".")) {
    return "ピリオドは先頭と末尾には使えません。";
  }

  if (value.includes("..")) {
    return "ピリオドは連続して使えません。";
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
    characterColor: getSafeCharacterColor(data.characterColor),
    characterShape: getSafeCharacterShape(data.characterShape),
    ownedCharacterShapes: Array.isArray(data.ownedCharacterShapes)
      ? (data.ownedCharacterShapes
          .map((shape) => getSafeCharacterShape(shape))
          .filter((shape, index, arr) => arr.indexOf(shape) === index) as CharacterShape[])
      : ["default"],
    coins: typeof data.coins === "number" && Number.isFinite(data.coins) ? Math.max(0, Math.floor(data.coins)) : 0,
    lastFeedRewardDate: typeof data.lastFeedRewardDate === "string" ? data.lastFeedRewardDate : "",
    feedRewardArcEarned:
      typeof data.feedRewardArcEarned === "number" && Number.isFinite(data.feedRewardArcEarned)
        ? Math.max(0, Math.floor(data.feedRewardArcEarned))
        : 0,
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
const CHARACTER_SHAPES: readonly CharacterShape[] = ["default", "ghost", "owl"];
function getSafeCharacterShape(shape: unknown): CharacterShape {
  return typeof shape === "string" && (CHARACTER_SHAPES as readonly string[]).includes(shape)
    ? (shape as CharacterShape)
    : "default";
}

function getFriendGithubUrl(userId: string) {
  return userId && !userId.startsWith("npc-") ? `https://github.com/${userId}` : "";
}

function profileToFriend(profile: UserProfile): FriendPreview {
  return {
    uid: profile.uid,
    userId: profile.userId,
    name: profile.displayName,
    avatar: profile.photoURL,
    status: "offline",
    activity: profile.determination || "オフライン",
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

function workspaceMemberToProfile(member: WorkspaceMember): UserProfile {
  return {
    uid: member.userId,
    userId: member.userId.startsWith("npc-") ? member.name.toLowerCase() : member.userId,
    displayName: member.name,
    photoURL: member.avatar || "",
    searchName: member.name.toLowerCase(),
    following: [],
    followers: [],
    determination: member.status === "on-break" ? "少し休憩中です。" : `${member.building}を積み上げています。`,
    characterColor: getSafeCharacterColor(member.characterColor || member.color),
    characterShape: member.characterShape,
  };
}

function profileResolveText(profile: UserProfile) {
  return profile.determination?.trim() || "静かに積み上げています。";
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

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Engineers often work past midnight; treat the "day" as rolling over at 6:00 AM
// local time. So 2 AM on May 24 still counts as May 23's session — and the new
// day's prompt only appears once the user wakes up.
const DAILY_CUTOFF_HOUR = 6;

// LIVE ACTIVITY only surfaces study sessions of at least this many minutes.
// Sub-5-minute pings would crowd the timeline with low-signal noise — they're
// still persisted to Firestore, just hidden from the public ticker. Bump this
// up if the feed still feels too chatty.
const LIVE_ACTIVITY_MIN_MINUTES = 5;

function getLearnerDate(now: Date = new Date()) {
  const shifted = new Date(now.getTime() - DAILY_CUTOFF_HOUR * 60 * 60 * 1000);
  return getDateInputValue(shifted);
}

function formatDailyDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

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
    currentTitle: typeof data.currentTitle === "string" ? data.currentTitle : "",
    date,
    plan: typeof data.plan === "string" ? data.plan : "",
    reflection: typeof data.reflection === "string" ? data.reflection : "",
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt ? data.updatedAt : new Date().toISOString(),
    syncStatus: data.syncStatus === "pending" ? "pending" : "synced",
    syncError: typeof data.syncError === "string" ? data.syncError : "",
  };
}

function dailyReportToCloudPayload(report: DailyReport) {
  const { syncStatus, syncError, ...cloudReport } = report;
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

function getNotificationSourceText(type: NotificationItem["type"]) {
  if (type === "dailyLog") return "日報";
  if (type === "post") return "投稿";
  return "フレンド申請";
}

function getStudyLogPostVerb(subject: string) {
  const normalizedSubject = subject.toLowerCase();
  const workKeywords = [
    "実装",
    "開発",
    "作業",
    "修正",
    "改善",
    "対応",
    "構築",
    "整理",
    "設計",
    "デプロイ",
    "リファクタ",
    "build",
    "develop",
    "fix",
    "debug",
    "deploy",
    "release",
    "refactor",
    "implement",
  ];
  const studyKeywords = [
    "学習",
    "勉強",
    "復習",
    "読書",
    "講座",
    "資格",
    "試験",
    "silver",
    "gold",
    "learn",
    "study",
    "course",
    "book",
  ];

  if (workKeywords.some((keyword) => normalizedSubject.includes(keyword))) {
    return "作業しました";
  }

  if (studyKeywords.some((keyword) => normalizedSubject.includes(keyword))) {
    return "学習しました";
  }

  return "学習しました";
}

// variant:
//   "tsuta"  — default. Body + sprout (cotyledons) + eyes + legs.
//   "simple" — body + inner highlight (sprite-body) + legs. No sprout, no eyes.
//              Used in the daily-feed avatar chips where the user wants
//              a minimal silhouette ("葉っぱなし・目なし") matching the
//              workspace-room representation of the character.
function ProfileCharacterPreview({
  color,
  variant = "tsuta",
  shape = "default",
}: {
  color?: string;
  variant?: "tsuta" | "simple";
  /* When set to "ghost" the preview switches to the soul shape
     (no legs, no sprout, wavy hem, floating). Other shapes can be
     added here in the future. */
  shape?: CharacterShape;
}) {
  const isGhost = shape === "ghost";
  const isOwl = shape === "owl";
  const isCustomShape = isGhost || isOwl;
  return (
    <div
      className={`profile-character-preview${variant === "simple" ? " is-simple" : ""}${
        isGhost ? " is-ghost" : ""
      }${isOwl ? " is-owl" : ""}`}
      style={{ "--actor-color": color || characterColorOptions[0].value } as CSSProperties}
      aria-hidden="true"
    >
      <span className={`actor-sprite deep shape-${shape} ${isCustomShape ? "" : "is-tsuta"}`}>
        {isOwl ? (
          <>
            <span className="sprite-head">
              <span className="sprite-tuft sprite-tuft-left" />
              <span className="sprite-tuft sprite-tuft-right" />
              <span className="sprite-owl-eye sprite-owl-eye-left" />
              <span className="sprite-owl-eye sprite-owl-eye-right" />
              <span className="sprite-beak" />
            </span>
            <span className="sprite-body" />
            <span className="sprite-wing sprite-wing-left" />
            <span className="sprite-wing sprite-wing-right" />
            <span className="sprite-leg sprite-leg-left" />
            <span className="sprite-leg sprite-leg-right" />
          </>
        ) : isGhost ? (
          <>
            <span className="sprite-body" />
            <span className="sprite-eye sprite-eye-left" />
            <span className="sprite-eye sprite-eye-right" />
            <span className="sprite-tail" />
            <span className="sprite-ghost-hat" aria-hidden="true">
              <span className="sprite-ghost-hat-crown" />
              <span className="sprite-ghost-hat-brim" />
              <span className="sprite-ghost-hat-band" />
            </span>
            <span className="sprite-ghost-arm sprite-ghost-arm-left" />
            <span className="sprite-ghost-arm sprite-ghost-arm-right" />
            <svg
              className="sprite-ghost-mouth"
              viewBox="0 0 24 8"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M2 4 Q 6 0.5 10 4 T 18 4 L 22 4"
                stroke="#3b2218"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        ) : variant === "tsuta" ? (
          <>
            <svg
              className="sprite-sprout"
              viewBox="0 0 24 30"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M10 30 Q 6 18 12 7"
                stroke="#2f4a35"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse cx="8" cy="6.5" rx="4.6" ry="3" fill="#8db090" transform="rotate(-28 8 6.5)" />
              <ellipse cx="15" cy="5.5" rx="4.6" ry="3" fill="#8db090" transform="rotate(28 15 5.5)" />
            </svg>
            <span className="sprite-eye sprite-eye-left" />
            <span className="sprite-eye sprite-eye-right" />
            <span className="sprite-leg sprite-leg-left" />
            <span className="sprite-leg sprite-leg-right" />
          </>
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
}

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

function formatStudyTimeJa(minutes: number) {
  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}時間`;
}

// Compact "last logged" label used on learning cards. Buckets into:
//   未記録 (no logs)
//   今日 / 昨日 / N日前 (within 6 days)
//   N週間前 / Nヶ月前 (older)
function formatLearningLastLogged(
  lastTs: number | undefined,
  todayMidnightMs: number,
  dayMs: number,
) {
  if (!lastTs) return "未記録";
  if (lastTs >= todayMidnightMs) return "今日";
  const yesterdayMidnight = todayMidnightMs - dayMs;
  if (lastTs >= yesterdayMidnight) return "昨日";
  const diffDays = Math.max(1, Math.floor((todayMidnightMs - lastTs) / dayMs));
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

function formatStayTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}時間${rest}分` : `${hours}時間`;
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function getRoomDescription(room: WorkspaceRoom) {
  if (room.name.toLowerCase().includes("night")) {
    return "夜の集中作業に向いた、ゆっくり流れるビルドルーム。";
  }

  return "小さく集中し、積み上げを共有するための静かな空間。";
}

function getRoomAccent(room: WorkspaceRoom) {
  if (room.name.toLowerCase().includes("night")) {
    return "night";
  }

  return "garden";
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

function getTodayKey(date = new Date()) {
  return date.toDateString();
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
  };
}

function serializeWorkspaceRooms(rooms: WorkspaceRoom[]) {
  return rooms.map(serializeWorkspaceRoom);
}

function getSerializedWorkspaceRoomText(room: WorkspaceRoom) {
  return JSON.stringify(serializeWorkspaceRoom(room));
}

async function saveWorkspaceRoomToCloud(room: WorkspaceRoom, currentUserUid?: string) {
  const ref = doc(db, workspaceRoomsCollectionName, room.id);

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

function getSubjectSummary(logs: StudyLog[]) {
  if (logs.length === 0) {
    return "No study logged yet";
  }

  const summary = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.subject] = (acc[log.subject] || 0) + log.minutes;
    return acc;
  }, {});

  return Object.entries(summary)
    .map(([subject, minutes]) => `${subject} ${formatStudyTime(minutes)}`)
    .join(" / ");
}

function getStudySegments(logs: StudyLog[], learningItems: LearningItem[] = []): StudySegment[] {
  if (logs.length === 0) {
    return [];
  }

  const itemById = new Map(learningItems.map((item) => [item.id, item] as const));

  const segments = logs.reduce<Record<string, StudySegment>>((acc, log) => {
    const linkedItem = log.learningItemId ? itemById.get(log.learningItemId) : undefined;
    const subject = linkedItem ? linkedItem.name : log.subject;
    const color = linkedItem ? linkedItem.color : log.color || studyColorOptions[0].value;
    const key = linkedItem ? `item:${linkedItem.id}` : `${subject}-${color}`;
    acc[key] = acc[key] || {
      key,
      subject,
      minutes: 0,
      color,
    };
    acc[key].minutes += log.minutes;
    return acc;
  }, {});

  return Object.values(segments).sort((a, b) => b.minutes - a.minutes);
}

function PixelIcon({ type }: { type: QuestEvent }) {
  return (
    <span className={`pixel-icon ${type}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function ArcSproutCharacter() {
  return (
    <svg className="arc-sprout-character" viewBox="0 0 160 180" role="img" aria-label="アークの芽 Arc Sprout">
      <defs>
        <radialGradient id="sprout-body" cx="42%" cy="28%" r="72%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.42" stopColor="#f4faf6" />
          <stop offset="0.76" stopColor="#dce8e1" />
          <stop offset="1" stopColor="#b8d0c3" />
        </radialGradient>
        <linearGradient id="sprout-belly" x1="47" y1="122" x2="119" y2="44">
          <stop offset="0" stopColor="#1f6f4a" stopOpacity="0.94" />
          <stop offset="1" stopColor="#83bb70" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id="sprout-arc" x1="35" y1="128" x2="132" y2="36">
          <stop offset="0" stopColor="#1f6f4a" stopOpacity="0.05" />
          <stop offset="0.48" stopColor="#1f6f4a" stopOpacity="0.38" />
          <stop offset="1" stopColor="#9dcc80" stopOpacity="0.74" />
        </linearGradient>
        <filter id="sprout-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#1f6f4a" floodOpacity="0.14" />
        </filter>
      </defs>
      <path
        className="sprout-arc"
        d="M35 126 C61 106 73 70 123 42"
        fill="none"
        stroke="url(#sprout-arc)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <g className="sprout-arc-blocks">
        <rect x="34" y="124" width="6" height="6" rx="2" />
        <rect x="52" y="108" width="6" height="6" rx="2" />
        <rect x="65" y="88" width="6" height="6" rx="2" />
        <rect x="84" y="67" width="5" height="5" rx="1.7" />
        <rect x="110" y="47" width="5" height="5" rx="1.7" />
        <rect x="126" y="38" width="4" height="4" rx="1.4" />
      </g>
      <ellipse cx="80" cy="160" rx="42" ry="9" fill="rgba(31,111,74,0.13)" />
      <g filter="url(#sprout-soft-shadow)">
        <path
          d="M73 37 C66 24 72 13 87 15 C99 17 105 29 99 41 C110 30 126 32 129 45 C132 59 118 70 102 64 C114 78 118 97 111 117 C104 137 89 149 72 146 C53 143 39 127 37 107 C35 86 46 72 59 64 C46 60 43 47 52 39 C59 33 67 33 73 37Z"
          fill="url(#sprout-body)"
          stroke="#dce8e1"
          strokeWidth="2"
        />
        <path
          d="M73 37 C69 22 76 10 90 14 C101 17 103 31 94 42 C109 29 126 33 128 46 C130 58 116 66 101 61 C94 57 85 50 73 37Z"
          fill="#1f6f4a"
          opacity="0.96"
        />
        <path
          d="M77 34 C83 24 91 20 98 23 C99 31 94 39 84 43"
          fill="#83bb70"
          opacity="0.92"
        />
        <path
          d="M71 83 C78 74 93 75 101 85 C107 94 105 111 94 119 C84 127 67 122 61 111 C56 100 61 90 71 83Z"
          fill="url(#sprout-belly)"
          opacity="0.18"
        />
        <circle cx="62" cy="89" r="10" fill="#111827" />
        <circle cx="98" cy="91" r="10" fill="#111827" />
        <circle cx="66" cy="86" r="3.2" fill="#fafaf8" />
        <circle cx="101" cy="88" r="3.2" fill="#fafaf8" />
        <path d="M77 108 C81 111 85 111 89 108" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.72" />
        <path d="M39 107 C29 108 24 117 26 127" stroke="#b8d0c3" strokeWidth="7" strokeLinecap="round" />
        <path d="M118 108 C129 111 134 120 132 130" stroke="#b8d0c3" strokeWidth="7" strokeLinecap="round" />
        <path d="M61 145 L56 158 M99 144 L104 158" stroke="#8aa998" strokeWidth="7" strokeLinecap="round" />
        <g className="sprout-contribution-mark">
          <rect x="53" y="116" width="7" height="7" rx="2" />
          <rect x="64" y="121" width="7" height="7" rx="2" />
          <rect x="75" y="115" width="7" height="7" rx="2" />
          <rect x="86" y="122" width="7" height="7" rx="2" />
          <rect x="97" y="116" width="7" height="7" rx="2" />
        </g>
      </g>
    </svg>
  );
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

function SettingsIcon() {
  return (
    <svg className="settings-icon" viewBox="0 0 256 256" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.4 7.6C111.6 2.8 117.8 0 124.2 0h7.6c6.4 0 12.6 2.8 16.8 7.6 3.4 3.9 5.2 8.9 5 14.1l-1.4 29.1c6.9 2.2 13.5 5.1 19.6 8.7l22.3-19.5c4-3.5 9.2-5.2 14.5-4.8 5.3.4 10.2 2.9 13.6 7l5.4 6.4c7.3 8.6 6.6 21.4-1.6 29.2l-21.6 20.5c1.4 6.3 2.1 12.9 2.1 19.7 0 3.6-.2 7.2-.6 10.7l27.8 10.5c10.4 3.9 16 15.2 12.8 25.8l-2.4 7.9c-1.6 5.3-5.3 9.7-10.2 12.2-4.9 2.5-10.7 2.9-15.9 1l-28.1-10.1c-4.4 5.2-9.4 9.9-14.9 14l8.5 28.3c1.5 5 .8 10.4-2 14.8-2.8 4.4-7.2 7.6-12.3 8.8l-8.1 1.9c-10.9 2.6-21.9-3.6-25.4-14.3l-9-28c-3.6.4-7.2.6-10.9.6-3.7 0-7.3-.2-10.9-.6l-9 28c-3.5 10.7-14.5 16.9-25.4 14.3l-8.1-1.9c-5.1-1.2-9.6-4.4-12.3-8.8-2.8-4.4-3.5-9.8-2-14.8l8.5-28.3c-5.5-4.1-10.5-8.8-14.9-14L38 176.1c-5.2 1.9-10.9 1.5-15.9-1-4.9-2.5-8.6-6.9-10.2-12.2L9.5 155c-3.2-10.6 2.4-21.9 12.8-25.8l27.8-10.5c-.4-3.5-.6-7.1-.6-10.7 0-6.8.7-13.4 2.1-19.7L30 67.8c-8.2-7.8-8.9-20.6-1.6-29.2l5.4-6.4c3.4-4.1 8.3-6.6 13.6-7 5.3-.4 10.5 1.3 14.5 4.8l22.3 19.5c6.1-3.6 12.7-6.5 19.6-8.7l-1.4-29.1c-.2-5.2 1.6-10.2 5-14.1ZM128 78a50 50 0 1 0 0 100 50 50 0 0 0 0-100Zm0 28a22 22 0 1 0 0 44 22 22 0 0 0 0-44Z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M22 26c0-7.7 4.2-13.4 10-13.4S42 18.3 42 26v12.4l7 9.8H15l7-9.8V26Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M28 12.8V9.6c0-2.2 1.8-4 4-4s4 1.8 4 4v3.2M27.2 48.2c.8 3 2.4 4.8 4.8 4.8s4-1.8 4.8-4.8M14 24.5c-2.9 2.8-4.6 6.5-4.9 10.7M50 24.5c2.9 2.8 4.6 6.5 4.9 10.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="gift-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M10 27h44v29H10V27Z"
        fill="#ffffff"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M8 20h48v11H8V20Z"
        fill="#ffffff"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path d="M32 20v36M8 31h48" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M31 19c-7-10-16-11-18-5-2 7 6 10 18 6Zm2 0c7-10 16-11 18-5 2 7-6 10-18 6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function ContributionArcLogo() {
  return (
    <div className="brand-logo-stage" aria-label="Contribution Arc logo">
      <svg
        className="brand-logo-mark"
        viewBox="0 0 160 160"
        role="img"
        aria-labelledby="contribution-arc-logo-title"
      >
        <title id="contribution-arc-logo-title">Contribution Arc</title>
        <defs>
          <linearGradient id="logo-border-gradient" x1="22" y1="134" x2="138" y2="24">
            <stop offset="0" stopColor="#103d2a" />
            <stop offset="0.48" stopColor="#1f6f4a" />
            <stop offset="1" stopColor="#a7c978" />
          </linearGradient>
        </defs>
        <rect className="logo-icon-base" x="10" y="10" width="140" height="140" rx="35" />
        <rect className="logo-icon-border" x="13" y="13" width="134" height="134" rx="32" />
        <rect className="logo-icon-inner-border" x="25" y="25" width="110" height="110" rx="27" />
        <g className="logo-contribution-arc" aria-hidden="true">
          <rect className="arc-block block-1" x="34" y="109" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-2" x="46" y="105" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-3" x="58" y="98" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-4" x="70" y="88" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-5" x="82" y="76" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-6" x="94" y="63" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-7" x="106" y="51" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-8" x="118" y="42" width="10" height="10" rx="2.4" />
        </g>
      </svg>
    </div>
  );
}

function GitHubCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  return (
    <main className="app-shell callback-shell">
      <section className="card callback-card">
        <p className="card-kicker">GitHub OAuth Callback</p>
        <h1>Contribution Arc is ready to complete your GitHub connection.</h1>
        {error ? (
          <p className="callback-message error">
            GitHub returned an error: <strong>{error}</strong>
          </p>
        ) : (
          <p className="callback-message">
            Authorization code received. The next step is exchanging this code on a
            backend server, not in the browser.
          </p>
        )}

        <div className="callback-detail">
          <span>code</span>
          <code>{code || "No code parameter found"}</code>
        </div>
        <div className="callback-detail">
          <span>state</span>
          <code>{state || "No state parameter found"}</code>
        </div>

        <a className="callback-back" href="/">
          Back to Contribution Arc
        </a>
      </section>
    </main>
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

function getAuthErrorDetail(error: unknown): AuthErrorDetail {
  const code = getAuthErrorCode(error);
  const localhostUrl = getLocalhostUrl();

  console.error("Firebase auth failed", error);

  switch (code) {
    case "auth/unauthorized-domain":
      return {
        title: "このURLはFirebase Authで許可されていません。",
        message: localhostUrl
          ? "127.0.0.1 ではなく localhost で開くとログインできる可能性が高いです。"
          : "Firebase ConsoleのAuthentication設定で、このドメインをAuthorized domainsに追加してください。",
        action: localhostUrl ? `こちらで開き直してください: ${localhostUrl}` : undefined,
        code,
      };
    case "auth/operation-not-allowed":
      return {
        title: "このログイン方法がFirebase側で有効化されていません。",
        message: "Firebase ConsoleのAuthentication > Sign-in methodで、選んだログイン方法を有効にしてください。",
        code,
      };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return {
        title: "メールアドレスまたはパスワードが正しくありません。",
        message: "まだ登録していない場合は、Sign upに切り替えてアカウントを作成してください。",
        code,
      };
    case "auth/email-already-in-use":
      return {
        title: "このメールアドレスはすでに登録されています。",
        message: "Loginに切り替えてログインしてください。",
        code,
      };
    case "auth/weak-password":
      return {
        title: "パスワードが短すぎます。",
        message: "6文字以上のパスワードを入力してください。",
        code,
      };
    case "auth/invalid-email":
      return {
        title: "メールアドレスの形式が正しくありません。",
        message: "入力内容を確認してもう一度お試しください。",
        code,
      };
    case "auth/popup-blocked":
      return {
        title: "ログイン用ポップアップがブロックされました。",
        message: "ブラウザのポップアップ許可設定を確認して、もう一度お試しください。",
        code,
      };
    case "auth/popup-closed-by-user":
      return {
        title: "ログイン画面が閉じられました。",
        message: "もう一度ログインボタンを押してください。",
        code,
      };
    case "auth/account-exists-with-different-credential":
      return {
        title: "同じメールアドレスの別ログイン方法が存在します。",
        message: "以前使ったログイン方法でログインしてください。",
        code,
      };
    case "auth/network-request-failed":
      return {
        title: "ネットワーク接続に失敗しました。",
        message: "通信状況を確認して、少し待ってからもう一度お試しください。",
        code,
      };
    case "auth/too-many-requests":
      return {
        title: "ログイン試行が一時的に制限されています。",
        message: "時間を置いてからもう一度お試しください。",
        code,
      };
    default:
      return {
        title: "ログインに失敗しました。",
        message: "設定または入力内容を確認してください。詳しいエラーはブラウザコンソールにも出力しています。",
        code: code || undefined,
      };
  }
}

function LoginScreen() {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<AuthErrorDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setAuthError(getAuthErrorDetail(error));
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
      setAuthError(getAuthErrorDetail(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-hero-panel" aria-label="Contribution Arc login">
        <ContributionArcLogo />

        <div className="login-brand">
          <p className="eyebrow">Developer Learning Graph</p>
          <h1>Contribution Arc</h1>
          <p>学習の積み重ねを記録し、仲間と進捗を共有するための場所。</p>
        </div>
      </section>

      <div className="login-side-stack">
      <section className="card login-card">
        <header className="login-card-head">
          <p className="card-kicker">Sign in</p>
          <h2>アカウントにログイン</h2>
        </header>
        <p className="login-copy">
          メール、Google、GitHub のいずれかでログインできます。
        </p>

        <div className="auth-mode-tabs" aria-label="認証モード">
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

        <div className="login-divider">
          <span>or continue with</span>
        </div>

        <div className="provider-grid">
          <button
            type="button"
            className="provider-button google"
            onClick={() => handleProviderLogin("google")}
            disabled={isSubmitting}
          >
            <GoogleIcon />
            <span>Googleで続行</span>
          </button>
          <button
            type="button"
            className="provider-button github"
            onClick={() => handleProviderLogin("github")}
            disabled={isSubmitting}
          >
            <GitHubIcon />
            <span>GitHubで続行</span>
          </button>
        </div>

        {authError ? (
          <div className="auth-error" role="alert">
            <strong>{authError.title}</strong>
            <span>{authError.message}</span>
            {authError.action ? <span>{authError.action}</span> : null}
            {authError.code ? <code>{authError.code}</code> : null}
          </div>
        ) : null}
      </section>

      </div>
    </main>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Forces a re-render after operations that mutate the Firebase User in
  // place without firing onAuthStateChanged (e.g. linkWithPopup attaches a
  // provider but keeps the same User reference, so React would otherwise
  // never see providerData update).
  const [authRefreshTick, setAuthRefreshTick] = useState(0);
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
  } | null>(null);
  const [learningCategoryTab, setLearningCategoryTab] = useState<"all" | "book" | "archived">("all");
  const [learningSearchQuery, setLearningSearchQuery] = useState("");
  const [isLearningDeleteConfirming, setIsLearningDeleteConfirming] = useState(false);
  const [studySubject, setStudySubject] = useState("React");
  const [studyAmount, setStudyAmount] = useState("1");
  const [studyUnit, setStudyUnit] = useState<"hours" | "minutes">("hours");
  const [studyColor, setStudyColor] = useState(studyColorOptions[0].value);
  const [selectedStudyDay, setSelectedStudyDay] = useState(dayLabels[(new Date().getDay() + 6) % 7]);
  const [selectedArcDayKey, setSelectedArcDayKey] = useState<string | null>(null);
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
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("contribution-arc-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("idle");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [workspaceProfiles, setWorkspaceProfiles] = useState<Record<string, UserProfile>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendMessage, setFriendMessage] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [lastNotificationReadAt, setLastNotificationReadAt] = useState("");
  const [appNotifications, setAppNotifications] = useState<NotificationItem[]>([]);
  const [desktopNotificationSettings, setDesktopNotificationSettings] = useState<DesktopNotificationSettings>(
    defaultDesktopNotificationSettings,
  );
  const [currentView, setCurrentViewRaw] = useState<AppView>("home");

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
  const [determination, setDetermination] = useState("");
  const [draftDetermination, setDraftDetermination] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [playerCharacterColor, setPlayerCharacterColor] = useState(characterColorOptions[0].value);
  const [playerCharacterShape, setPlayerCharacterShape] = useState<CharacterShape>("default");
  const [ownedCharacterShapes, setOwnedCharacterShapes] = useState<CharacterShape[]>(["default"]);
  const [coins, setCoins] = useState<number>(0);
  /* Daily feed-post Arc reward bookkeeping. Both fields are mirrored
     to the user profile doc so a second device sees the same gate.
     The lifetime cap is enforced against `feedRewardArcEarned` (not
     the live `coins` balance) so spending Arc never re-opens the
     reward — exactly what the user asked for. */
  const [lastFeedRewardDate, setLastFeedRewardDate] = useState<string>("");
  const [feedRewardArcEarned, setFeedRewardArcEarned] = useState<number>(0);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [customRooms, setCustomRooms] = useState<WorkspaceRoom[]>([]);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomCreateState, setRoomCreateState] = useState<RoomCreateState>("idle");
  const [roomCreateMessage, setRoomCreateMessage] = useState("");
  const [editingRoomId, setEditingRoomId] = useState("");
  const [editingRoomName, setEditingRoomName] = useState("");
  const [workspaceTask, setWorkspaceTask] = useState("");
  const [workspaceDraftTask, setWorkspaceDraftTask] = useState("");
  const [workspaceDraftColor, setWorkspaceDraftColor] = useState(studyColorOptions[0].value);
  const [workspaceStartError, setWorkspaceStartError] = useState("");
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [workspaceNow, setWorkspaceNow] = useState(Date.now());
  const [lastRoomSession, setLastRoomSession] = useState<WorkspaceSessionHistory | null>(null);
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
  const [postDraft, setPostDraft] = useState("");
  const [postError, setPostError] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"following" | "all">("all");
  const [workspaceRecruitments, setWorkspaceRecruitments] = useState<WorkspaceRecruitmentRecord[]>([]);
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
  const [selectedDailyDate, setSelectedDailyDate] = useState(getLearnerDate());
  const [dailyPlanDraft, setDailyPlanDraft] = useState("");
  const [dailyReflectionDraft, setDailyReflectionDraft] = useState("");
  const [dailyHistoryDateFilter, setDailyHistoryDateFilter] = useState("");
  const [dailyHistorySearch, setDailyHistorySearch] = useState("");
  // Modal state for the "tap a past daily report" → expanded detail
  // view in the Team Daily feed. Stores the full report; we look up
  // study/commit data for that date on the fly when rendering.
  const [expandedDailyReport, setExpandedDailyReport] = useState<DailyReport | null>(null);
  const [dailyMessage, setDailyMessage] = useState("");
  const [isSavingDailyReport, setIsSavingDailyReport] = useState(false);
  const [postReplies, setPostReplies] = useState<ContributionReplyRecord[]>([]);
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
  const [knowledgeScale, setKnowledgeScale] = useState(1);
  const [knowledgePositions, setKnowledgePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingKnowledgeId, setDraggingKnowledgeId] = useState("");
  const pressedWorkspaceKeysRef = useRef<Set<string>>(new Set());
  // Walk-state ref mirrors `isPlayerWalking` so the walk loop can read
  // the current value without a stale-closure capture, and so keydown
  // can flip the class in the same frame the key was pressed instead
  // of waiting for the next rAF tick to notice the change.
  const isPlayerWalkingRef = useRef(false);
  const syncedRoomPositionRef = useRef<string | null>(null);
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
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
  const remoteWorkspaceRoomsRef = useRef<{ rooms: WorkspaceRoom[]; legacyRooms: WorkspaceRoom[] }>({
    rooms: [],
    legacyRooms: [],
  });
  const didRequestStudyLogMigrationRef = useRef(false);
  const didRequestDailyReportMigrationRef = useRef(false);
  const seenNotificationKeysRef = useRef<Set<string>>(new Set());
  const notificationCooldownRef = useRef<Record<string, number>>({});
  const lastNotificationSoundAtRef = useRef(0);
  const notificationBootedRef = useRef(false);
  const notificationStartedAtRef = useRef(Date.now());

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      didRequestStudyLogMigrationRef.current = false;
      didRequestDailyReportMigrationRef.current = false;
      cleanedLegacyWorkspaceRoomsRef.current = new Set();
      remoteWorkspaceRoomsRef.current = { rooms: [], legacyRooms: [] };
      setIsWorkspaceLoaded(false);
      setCurrentView("home");
      setProfileMember(null);
      setProfileUser(null);
      setOnboardingStep("idle");
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
      setSelectedDailyDate(getLearnerDate());
      setDailyPlanDraft("");
      setDailyReflectionDraft("");
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
    const savedAvatar =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "avatar")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-avatar-${currentUser.uid}`) : null);
    const savedCharacterColor =
      window.localStorage.getItem(getAccountStorageKey(accountScope, "character-color")) ||
      (shouldUseLegacyUserStorage ? window.localStorage.getItem(`contribution-arc-character-color-${currentUser.uid}`) : null);
    const savedCharacterShape = window.localStorage.getItem(
      getAccountStorageKey(accountScope, "character-shape"),
    );
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
    setPlayerAvatar(savedAvatar || currentUser.photoURL || "");
    setPlayerCharacterColor(savedCharacterColor || characterColorOptions[0].value);
    setPlayerCharacterShape(getSafeCharacterShape(savedCharacterShape));
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
            setOnboardingStep("welcome");
          } else if (!savedOnboardingComplete) {
            safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
          }
          return;
        }

        const profile = normalizeUserProfile(currentUser.uid, snapshot.data() as Partial<UserProfile>);
        resolvedUserId = profile.userId || resolvedUserId;
        setUserId(resolvedUserId);
        setDraftUserId(resolvedUserId);
        setCustomUserName(profile.displayName || savedUserName || "");
        setDraftUserName(profile.displayName || savedUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
        setFollowing(profile.following);
        setDetermination(profile.determination || savedDetermination || "");
        setDraftDetermination(profile.determination || savedDetermination || "");
        setPlayerAvatar(profile.photoURL || savedAvatar || currentUser.photoURL || "");
        setPlayerCharacterColor(profile.characterColor || savedCharacterColor || characterColorOptions[0].value);
        // Shape ownership migration. ADMIN_EMAIL gets every silhouette plus
        // a generous coin grant (used to seed test purchases). Everyone
        // else has their owned set narrowed to whatever they legitimately
        // possess — only "default" by default, since pre-monetization
        // users could freely pick ghost/owl from settings. If they were
        // mid-wearing a non-owned shape, snap them back to "default".
        const ADMIN_EMAIL = "ari.initx@gmail.com";
        const isAdmin = (currentUser.email || "").toLowerCase() === ADMIN_EMAIL;
        const loadedOwned = profile.ownedCharacterShapes || ["default"];
        const resolvedOwned: CharacterShape[] = isAdmin
          ? [...CHARACTER_SHAPES]
          : Array.from(new Set<CharacterShape>(["default", ...loadedOwned.filter((shape) => shape === "default")]));
        const loadedShape = getSafeCharacterShape(profile.characterShape || savedCharacterShape || "default");
        const safeShape: CharacterShape = resolvedOwned.includes(loadedShape) ? loadedShape : "default";
        const grantedCoins = isAdmin ? Math.max(profile.coins || 0, 10000) : profile.coins || 0;
        setOwnedCharacterShapes(resolvedOwned);
        setCoins(grantedCoins);
        setLastFeedRewardDate(profile.lastFeedRewardDate || "");
        setFeedRewardArcEarned(profile.feedRewardArcEarned || 0);
        setPlayerCharacterShape(safeShape);
        setOpenedWorkspaceGiftLevels((levels) =>
          Array.from(new Set([...levels, ...(profile.openedWorkspaceGiftLevels || [])])).sort(
            (first, second) => first - second,
          ),
        );
        if (resolvedUserId) {
          safeSetLocalStorage(`contribution-arc-user-id-${currentUser.uid}`, resolvedUserId);
          if (savedOnboardingComplete === "true") {
            setOnboardingStep("idle");
          } else {
            setOnboardingStep("firstPost");
            setCurrentView("home");
          }
        } else {
          setOnboardingStep("welcome");
        }
      })
      .catch(() => {
        if (!savedUserId) {
          setOnboardingStep("welcome");
        } else if (!savedOnboardingComplete) {
          safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
        }
      });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || onboardingStep !== "welcome") {
      return;
    }

    setCurrentView("home");
    setProfileMember(null);
    setProfileUser(null);
    setIsSearchOpen(false);
    setPendingJoinRoomId(null);
    setIsSettingsOpen(false);

    const timeoutId = window.setTimeout(() => {
      setDraftUserName(customUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
      setDraftUserId(userId);
      setSettingsError("ユーザーIDを入力するとContribution Arcを開始できます。");
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
            void migrateStudyLogsToCloud(db, currentUser.uid, localOnly).catch((error) => {
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

    const unsubscribe = subscribeLearningItemsFromCloud(
      db,
      currentUser.uid,
      (cloudItems) => {
        setLearningItems(cloudItems);
      },
      (error) => {
        console.info("Learning items cloud sync skipped.", error);
      },
    );

    return () => unsubscribe();
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

  useEffect(() => {
    // Tick at 1s when any active recruitment is visible so countdown text
    // and breathing pulse stay live. Falls back to 30s when nothing is live.
    const hasLive = workspaceRecruitments.some((r) => new Date(r.expiresAt).getTime() > Date.now());
    const intervalMs = hasLive ? 1000 : 30000;
    const interval = window.setInterval(() => setFeedNowTick(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [workspaceRecruitments]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("contribution-arc-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#0f0f10" : "#fafaf8");
    }
  }, [theme]);

  // Cursor spotlight — fine pointers only, throttled to rAF for cost
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    let nextX = 0;
    let nextY = 0;
    const apply = () => {
      const el = spotlightRef.current;
      if (el) {
        // body has `zoom: var(--ui-scale)` applied, but clientX/Y are raw
        // viewport coords. position:fixed children of a zoomed ancestor get
        // their `transform` translate values multiplied by that zoom, so we
        // pre-divide here to keep the spotlight centered on the real cursor.
        const scaleRaw = getComputedStyle(document.documentElement)
          .getPropertyValue("--ui-scale")
          .trim();
        const scale = parseFloat(scaleRaw);
        const z = Number.isFinite(scale) && scale > 0 ? scale : 1;
        el.style.setProperty("--spot-x", `${nextX / z}px`);
        el.style.setProperty("--spot-y", `${nextY / z}px`);
        if (!el.classList.contains("is-visible")) el.classList.add("is-visible");
      }
      frame = 0;
    };
    const onMove = (event: MouseEvent) => {
      nextX = event.clientX;
      nextY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      const el = spotlightRef.current;
      if (el) el.classList.remove("is-visible");
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
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
            setPostError("本日の利用上限に達しました。しばらく経ってから再読み込みしてください。");
            return;
          }

          console.info("Posts realtime sync errored — will reconnect.", error);
          setPostError("ログの読み込みを待っています。");
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
  }, [currentUser]);

  // Fetch replies once on sign-in. Realtime sync is not needed here;
  // optimistic updates keep local state current after the user posts a reply.
  useEffect(() => {
    if (!currentUser) return;

    void fetchPostRepliesOnce(db, (error) => {
      console.info("Post reply fetch skipped.", error);
    }).then(setPostReplies);
  }, [currentUser]);

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
        .filter((report) => report.userId === currentUser.uid && report.syncStatus === "pending")
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
    const sharedDailyQuery = query(collection(db, "dailyReports"), orderBy("date", "desc"), limit(30));
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
            durableReportsCache.map((report) =>
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
    void getDocs(sharedDailyQuery)
      .then((snapshot) => {
        if (!isActive) return;
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
          .filter((report) => report.userId && (report.plan.trim() || report.reflection.trim()));

        setSharedDailyReports(syncedCloudReports);
        void putPersistentItems("dailyReports", syncedCloudReports);
      })
      .catch((error) => {
        console.info("Shared daily report fetch skipped.", error);
      });

    return () => {
      isActive = false;
      unsubscribeOwnReports();
    };
  }, [currentUser, isWorkspaceLoaded, userId]);

  useEffect(() => {
    const nextReport = dailyReports.find((report) => report.date === selectedDailyDate);
    setDailyPlanDraft(nextReport?.plan || "");
    setDailyReflectionDraft(nextReport?.reflection || "");
  }, [dailyReports, selectedDailyDate]);

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
      setFriendRequests((requests) => {
        const localRequests = requests
          .map((request) => ({
            ...request,
            direction: request.direction || "outgoing",
          }))
          .filter((request) => request.direction !== direction);
        const nextRequests = [...cloudRequests, ...localRequests];

        return nextRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      setFriends((items) => {
        const nextFriends = [...items];
        cloudRequests
          .filter((request) => request.status === "accepted")
          .forEach((request) => {
            const nextFriend = profileToFriend(request.profile);
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
    serializedRooms.forEach((room) => {
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

  useEffect(() => {
    // Cost control: the workspaceRooms / legacyWorkspaceRooms collections are
    // subscribed *without* a where/limit filter — every doc fans out to every
    // listener. Keeping this live on every screen turned out to dominate
    // Firestore reads (the 2026-05-26 usage spike), so we only subscribe when
    // the user is actually looking at the workspace. Other views render from
    // whatever customRooms / workspaceProfiles snapshot was last in memory,
    // which is fine — presence freshness only matters inside the workspace
    // itself. The legacy collection is migrated out as it arrives, so missing
    // a few seconds of legacy snapshots while on another view is a non-issue.
    if (!currentUser || !isWorkspaceLoaded || !isPageVisible || currentView !== "workspace") {
      return;
    }

    const applyRemoteRooms = () => {
      const remoteRoomMap = new Map<string, WorkspaceRoom>();

      remoteWorkspaceRoomsRef.current.legacyRooms.forEach((room) => {
        remoteRoomMap.set(room.id, room);
      });
      remoteWorkspaceRoomsRef.current.rooms.forEach((room) => {
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
            normalizeWorkspaceRoom({ ...remoteRoom, activeMembers: mergedMembers }),
          );
        });

        // Pending locally-created rooms that haven't synced yet still
        // belong in the merge.
        pendingWorkspaceRoomsRef.current.forEach((pendingLocal, roomId) => {
          if (!finalRoomMap.has(roomId)) {
            finalRoomMap.set(roomId, pendingLocal);
          }
        });

        // Rooms that only exist locally (e.g. offline edits) stay
        // as-is until they sync.
        currentRooms.forEach((room) => {
          if (!finalRoomMap.has(room.id) && !remoteRoomIds.has(room.id)) {
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
    };

    const readRoomsSnapshot = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) =>
      snapshot.docs.map((item) =>
        normalizeWorkspaceRoom({
          ...((item.data() as Partial<WorkspaceRoom>) || {}),
          id: item.id,
        } as WorkspaceRoom),
      );

    const unsubscribeRooms = onSnapshot(
      collection(db, workspaceRoomsCollectionName),
      (snapshot) => {
        remoteWorkspaceRoomsRef.current.rooms = readRoomsSnapshot(snapshot);
        applyRemoteRooms();
      },
      (error) => {
        console.info("Workspace room realtime sync skipped.", error);
      },
    );

    const unsubscribeLegacyRooms = onSnapshot(
      collection(db, legacyWorkspaceRoomsCollectionName),
      (snapshot) => {
        remoteWorkspaceRoomsRef.current.legacyRooms = readRoomsSnapshot(snapshot);
        applyRemoteRooms();
      },
      (error) => {
        console.info("Legacy workspace room realtime sync skipped.", error);
      },
    );

    return () => {
      unsubscribeRooms();
      unsubscribeLegacyRooms();
    };
  }, [currentUser, isWorkspaceLoaded, isPageVisible, currentView]);

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
      const dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const isMoving = dx !== 0 || dy !== 0;

      if (!isMoving) {
        if (isPlayerWalkingRef.current) {
          isPlayerWalkingRef.current = false;
          setIsPlayerWalking(false);
        }
        lastTimestamp = null;
        frameId = window.requestAnimationFrame(tick);
        return;
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
      const length = Math.hypot(dx, dy) || 1;
      const seconds = elapsed / 1000;
      setPlayerPosition((position) => ({
        x: clampNumber(position.x + (dx / length) * SPEED_PERCENT_PER_SEC * seconds, 7, 93),
        y: clampNumber(position.y + (dy / length) * SPEED_PERCENT_PER_SEC * seconds, 14, 88),
      }));

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
  const maxStudyMinutes = Math.max(1, ...weeklyStudyHours.map((item) => item.totalMinutes));
  const contributionArc = useMemo(() => getContributionArc(studyLogs), [studyLogs]);
  // GitHub contribution heatmap state. Fetched lazily from the public
  // jogruber endpoint once we know the user's GitHub username. Errors are
  // kept around so the UI can render a non-fatal "取得できませんでした" hint.
  const [githubContributions, setGithubContributions] = useState<GithubContributions | null>(null);
  const [githubContributionsError, setGithubContributionsError] = useState<string | null>(null);
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
        label: `${selectedArcDay.date.getMonth() + 1}月${selectedArcDay.date.getDate()}日`,
        isDaily: true,
        // Stable key so framer-motion's AnimatePresence re-mounts on
        // day change, triggering the swap animation.
        key: `day-${selectedArcDay.key}`,
      };
    }
    return {
      ...arcSubjectTotals,
      label: "13週合計",
      isDaily: false,
      key: "total",
    };
  }, [selectedArcDay, selectedArcDaySubjectTotals, arcSubjectTotals]);
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
  const githubUsername =
    githubLoginCached || githubProviderInfo?.displayName || (githubProviderInfo ? userId : "");
  // Lazy-fetch the user's public GitHub contribution grid as soon as we
  // know which login to query. The service handles its own 1h cache so
  // re-mounts (route changes, hot reloads) don't re-hit the endpoint.
  useEffect(() => {
    if (!githubUsername) return;
    let cancelled = false;
    setGithubContributionsError(null);
    fetchGithubContributions(githubUsername)
      .then((data) => {
        if (!cancelled) setGithubContributions(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setGithubContributionsError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [githubUsername]);
  const totalWeeklyMinutes = weeklyStudyHours.reduce((sum, item) => sum + item.totalMinutes, 0);
  const todayStudyMinutes = weeklyStudyHours.find((item) => item.isToday)?.totalMinutes ?? 0;
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
  const selectedStudyDayData =
    weeklyStudyHours.find((item) => item.day === selectedStudyDay) ||
    weeklyStudyHours.find((item) => item.isToday) ||
    weeklyStudyHours[0];
  const totalWeeklyLabel =
    totalWeeklyMinutes > 0 && totalWeeklyMinutes < 60
      ? formatStudyTime(totalWeeklyMinutes)
      : `${(Math.round((totalWeeklyMinutes / 60) * 10) / 10).toLocaleString()}h`;
  const baseWorkspaceRooms = [...workspaceRooms, ...customRooms]
    .map(normalizeWorkspaceRoom)
    .filter((room) => !isLegacyWorkspaceRoom(room));
  const scheduledMinaRoomId = getScheduledMinaRoomId(baseWorkspaceRooms, workspaceNow);
  const scheduledNishimiyaRoomId = getScheduledNishimiyaRoomId(baseWorkspaceRooms, workspaceNow);
  const allWorkspaceRooms = baseWorkspaceRooms.map((room) =>
    normalizeWorkspaceRoom(
      applyScheduledWorkspacePresence(room, workspaceNow, scheduledMinaRoomId, scheduledNishimiyaRoomId),
    ),
  );
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
  const roomActivityItems: RoomActivityItem[] = [
    ...resolvedVisibleMembers.map((member) => {
      const task = member.currentTask || member.building;
      const activeMinutes = getWorkspaceActiveMinutes(member, workspaceNow);
      const stayLabel = formatStayTime(activeMinutes);
      const text =
        member.status === "on-break"
          ? `${member.name} stepped away for a quiet break`
          : activeMinutes >= 180
            ? `${member.name} reached ${stayLabel} focus`
            : `${member.name} started building ${task}`;

      return {
        id: `active-${member.userId}-${member.joinedAt}`,
        userId: member.userId,
        userName: member.name,
        avatar: "",
        text,
        meta: `${stayLabel} in ${selectedRoom?.name || "room"}`,
        member,
      };
    }),
    ...((selectedRoom?.history || []).slice(0, 4).map((item) => ({
      id: `history-${item.id}`,
      userId: item.userId,
      userName: item.userName,
      avatar: "",
      text:
        item.id === "seed-mina-beta"
          ? `${item.userName} is quietly clearing work`
          : `${item.userName} closed a ${formatStayTime(item.minutes)} ${item.building} session`,
      meta: new Date(item.leftAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    })) satisfies RoomActivityItem[]),
  ].slice(0, 7);
  const roomTotalMinutes =
    (selectedRoom?.totalMinutes || 0) +
    visibleMembers.reduce((sum, member) => sum + getWorkspaceActiveMinutes(member, workspaceNow), 0);
  const todayRoomHistory = selectedRoom
    ? selectedRoom.history.filter((item) => getTodayKey(new Date(item.leftAt)) === getTodayKey())
    : [];
  const roomContributions = todayRoomHistory.length + (isInSelectedRoom ? 1 : 0);
  const roomCommits = (selectedRoom?.commits || 0) + outputStats.commits;
  const roomOnlineCount = visibleMembers.length;
  const userRoomHistory = allWorkspaceRooms
    .flatMap((room) => room.history.filter((item) => item.userId === currentUserUid))
    .sort((a, b) => new Date(b.leftAt).getTime() - new Date(a.leftAt).getTime())
    .slice(0, 4);
  const activeMembers = allWorkspaceRooms.flatMap((room) => room.activeMembers);
  const friendIds = new Set(friends.map((friend) => friend.uid));
  const personalActivityMembers = activeMembers.filter(
    (member) => member.userId === currentUserUid || friendIds.has(member.userId),
  );
  const sidebarFriends = friends.map((friend) => {
    const activeFriend = activeMembers.find((member) => member.userId === friend.uid);
    if (activeFriend) {
      return {
        ...friend,
        status: "online" as const,
        activity: `学習中: ${activeFriend.building}`,
      };
    }

    return friend;
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
  const recentStudyActivities: LiveActivity[] = studyActivityGroups
    .slice(0, 3)
    .map(({ log, count }) => ({
      id: `study-${log.id}`,
      userId: currentUserUid,
      userName: playerName,
      avatar: playerAvatar,
      text: `${playerName} completed ${formatStudyTimeJa(log.minutes)} ${log.subject}${count > 1 ? ` (×${count})` : ""}`,
      meta: new Date(log.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      status: "recent",
    }));
  const onlineActivities: LiveActivity[] = personalActivityMembers.slice(0, 3).map((member) => ({
    id: `online-${member.userId}-${member.joinedAt}`,
    userId: member.userId,
    userName: member.name,
    avatar: member.avatar,
    text: `${member.name} is studying ${member.building}`,
    meta: `${formatStayTime(getElapsedMinutes(member.joinedAt, workspaceNow))} active`,
    status: "online",
  }));
  const liveActivities = [...onlineActivities, ...recentStudyActivities].slice(0, 5);
  const selectedRoomPosts = selectedRoom ? posts.filter((post) => post.roomId === selectedRoom.id).slice(0, 4) : [];
  const selectedDailyReport = dailyReports.find((report) => report.date === selectedDailyDate) || null;
  const currentLearnerDate = getLearnerDate(new Date(feedNowTick));
  const todayDailyReport = dailyReports.find((report) => report.date === currentLearnerDate) || null;
  const canEditSelectedDailyReport = canEditDailyReportDate(selectedDailyDate);
  const visibleSharedDailyReports = Array.from(
    new Map([...sharedDailyReports, ...dailyReports].map((report) => [report.id, report])).values(),
  )
    .sort((a, b) => b.date.localeCompare(a.date) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);
  const normalizedDailyHistorySearch = dailyHistorySearch.trim().toLowerCase();
  const filteredDailyReports = dailyReports.filter((report) => {
    const matchesDate = !dailyHistoryDateFilter || report.date === dailyHistoryDateFilter;
    const searchableText = [
      report.date,
      formatDailyDate(report.date),
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
  const hasUnreadNotifications = unreadNotificationCount > 0;
  const handleNotificationSoundTest = () => {
    lastNotificationSoundAtRef.current = 0;
    void playNotificationSound("default", desktopNotificationSettings);
  };
  const pushAppNotification = (item: NotificationItem, shouldSendNative: boolean) => {
    const cooldownKey = `${item.type}:${item.sourceUserId}`;
    const now = Date.now();
    const lastNotifiedAt = notificationCooldownRef.current[cooldownKey] || 0;
    const canSendNative = shouldSendNative && now - lastNotifiedAt > notificationCooldownMs;
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
          title: `${report.userName || "Developer"}の日報`,
          body: (report.reflection || report.plan || "日報が更新されました。").slice(0, 120),
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
          title: `${post.username}の投稿`,
          body: post.text.slice(0, 120),
          createdAt: post.createdAt,
          read: false,
          sourceUserId,
        },
        desktopNotificationSettings.post,
      );
    });

    friendRequests
      .filter((request) => request.direction === "incoming" && request.status === "pending")
      .forEach((request) => {
        const notificationId = `friendRequest:${request.id}`;
        if (seenNotificationKeysRef.current.has(notificationId)) {
          return;
        }

        if (!isRecentEnough(request.createdAt)) {
          seenNotificationKeysRef.current.add(notificationId);
          return;
        }

        pushAppNotification(
          {
            id: notificationId,
            type: "friendRequest",
            title: "フレンド申請",
            body: `${request.profile.displayName}からフレンド申請が届きました`,
            createdAt: request.createdAt,
            read: false,
            sourceUserId: request.profile.uid,
          },
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
    isWorkspaceLoaded,
    notifiableUserIds,
    posts,
    pushAppNotification,
    visibleSharedDailyReports,
  ]);
  const activeKnowledgeGraph = knowledgeGraph.nodes.length > 0 ? knowledgeGraph : studyKnowledgeGraph;
  const graphNodes = activeKnowledgeGraph.nodes.map((node) => ({
    ...node,
    ...(knowledgePositions[node.id] || {}),
  }));
  const knowledgeNodeMap = new Map(graphNodes.map((node) => [node.id, node]));
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
  const handleStudySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    const amount = Number(studyAmount);
    if (!studySubject.trim() || Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const minutes = Math.round(studyUnit === "hours" ? amount * 60 : amount);
    const trimmedSubject = studySubject.trim();
    const matchedItem = learningItems.find(
      (item) => !item.archived && item.name.toLowerCase() === trimmedSubject.toLowerCase(),
    );
    const nextLog: StudyLog = {
      id: crypto.randomUUID(),
      subject: matchedItem ? matchedItem.name : trimmedSubject,
      minutes,
      createdAt: new Date().toISOString(),
      color: matchedItem ? matchedItem.color : studyColor,
      ...(matchedItem ? { learningItemId: matchedItem.id } : {}),
    };
    setStudyLogs((logs) => [...logs, nextLog]);
    void saveStudyLogToCloud(db, currentUser.uid, nextLog, {
      earnedExp: Math.round(minutes * 1.25),
      source: "manual",
    }).catch((error) => {
      // Surface to console as an error so silent persistence failures
      // (rules / network) don't quietly lose records. Local state +
      // localStorage still hold the log; the subscription merge step
      // will retry the upload on the next snapshot.
      console.error("Study log cloud save failed.", error);
    });
    setStudyAmount(studyUnit === "hours" ? "1" : "30");
  };

  const openLearningEditorForCreate = (presetName = "") => {
    setIsLearningDeleteConfirming(false);
    setLearningEditorState({
      mode: "create",
      name: presetName,
      category: "stack",
      color: studyColorOptions[0].value,
      totalPages: "",
      currentPages: "",
    });
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
    });
  };

  const closeLearningEditor = () => {
    setIsLearningDeleteConfirming(false);
    setLearningEditorState(null);
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

    if (learningEditorState.mode === "create") {
      const newItem: LearningItem = {
        id: crypto.randomUUID(),
        userId: currentUser.uid,
        name: trimmedName.slice(0, 60),
        category: learningEditorState.category,
        color: learningEditorState.color,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...(isBook && Number.isFinite(totalPagesNum) && totalPagesNum > 0 ? { totalPages: totalPagesNum } : {}),
        ...(isBook && Number.isFinite(currentPagesNum) && currentPagesNum >= 0 ? { currentPages: currentPagesNum } : {}),
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
        updatedAt: nowIso,
        ...(isBook && Number.isFinite(totalPagesNum) && totalPagesNum > 0
          ? { totalPages: totalPagesNum }
          : { totalPages: undefined }),
        ...(isBook && Number.isFinite(currentPagesNum) && currentPagesNum >= 0
          ? { currentPages: currentPagesNum }
          : { currentPages: undefined }),
      };
      setLearningItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      void saveLearningItemToCloud(db, updated).catch((error) => {
        console.info("Learning item cloud save skipped.", error);
      });
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

  const handlePostSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser || isPosting) {
      return;
    }

    const text = postDraft.trim();
    if (!text) {
      setPostError("ログ内容を入力してください。");
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
          ? `+${reward} Arc 獲得（投稿ボーナス上限 ${FEED_REWARD_LIFETIME_CAP} に到達）`
          : `+${reward} Arc 獲得（累計 ${nextEarned} / ${FEED_REWARD_LIFETIME_CAP}）`,
        { kind: "success" },
      );
    }

    if (onboardingStep === "firstPost") {
      safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
      setOnboardingStep("idle");
    }

    try {
      await savePostToCloud(db, nextPost);
      const syncedPost: ContributionPostRecord = { ...nextPost, syncStatus: "synced", syncError: "" };
      setPosts((items) => mergePosts([syncedPost, ...items.filter((item) => item.id !== nextPost.id)]));
      void putPersistentItem("posts", syncedPost).catch(logPersistError);
      // The new post appears in the feed below, but on a long list it's
      // easy to miss the visual update. The toast confirms the send so
      // the user doesn't second-guess whether their tap landed.
      showToast("投稿しました", { kind: "success" });
    } catch (error) {
      setPostError(
        getFirestoreErrorMessage(
          error,
          "ログをローカルに保存しました。クラウドへ再同期します。",
          "ログをクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。",
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
      setPostError("リアクションを保存できませんでした。");
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
      setReplyError("返信を保存できませんでした。");
      setPostReplies((items) => items.filter((item) => item.id !== reply.id));
      setReplyDrafts((drafts) => ({ ...drafts, [post.id]: text }));
    }
  };

  const handlePostDelete = (post: ContributionPostRecord) => {
    if (!currentUser || post.userId !== currentUser.uid) {
      return;
    }

    const isConfirmed = window.confirm("このログを削除しますか？");
    if (!isConfirmed) {
      return;
    }

    setPosts((items) => items.filter((item) => item.id !== post.id));
    setPostReplies((items) => items.filter((item) => item.postId !== post.id));
    void deletePersistentItem("posts", post.id);
    void deleteDoc(doc(db, "posts", post.id)).catch((error) => {
      console.info("Post delete skipped.", error);
      setPostError("ログを削除できませんでした。");
    });
  };

  const handleDailyReportDelete = (report: DailyReport) => {
    if (!currentUser || report.userId !== currentUser.uid) {
      return;
    }

    const isConfirmed = window.confirm(`${formatDailyDate(report.date)}の日報を削除しますか？`);
    if (!isConfirmed) {
      return;
    }

    const nextReports = dailyReports.filter((item) => item.id !== report.id);
    setDailyReports(nextReports);
    setSharedDailyReports((reports) => reports.filter((item) => item.id !== report.id));
    persistDailyReports(currentUser.uid, userId, nextReports);
    void deletePersistentItem("dailyReports", report.id);

    if (selectedDailyDate === report.date) {
      setDailyPlanDraft("");
      setDailyReflectionDraft("");
      setDailyMessage("日報を削除しました。");
    }

    void deleteDoc(doc(db, "dailyReports", report.id)).catch((error) => {
      console.info("Daily report delete skipped.", error);
      setDailyMessage("日報を削除できませんでした。");
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
      setDailyPromptError("今日やることを入力してください。");
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

    // Keep the daily-screen draft in sync if the user opens it next
    if (selectedDailyDate === date) {
      setDailyPlanDraft(planText);
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

  const handleDailyDateChange = (date: string) => {
    const nextReport = dailyReports.find((report) => report.date === date);
    setSelectedDailyDate(date);
    setDailyPlanDraft(nextReport?.plan || "");
    setDailyReflectionDraft(nextReport?.reflection || "");
    setDailyMessage("");
  };

  const handleDailyReportSectionSave = async (section: "plan" | "reflection") => {
    if (!currentUser || isSavingDailyReport) {
      return;
    }

    if (!canEditDailyReportDate(selectedDailyDate)) {
      setDailyMessage("日報の編集は当日または1日前までです。");
      return;
    }

    const planText = dailyPlanDraft.trim();
    const reflectionText = dailyReflectionDraft.trim();
    const sectionText = section === "plan" ? planText : reflectionText;
    const sectionLabel = section === "plan" ? "今日やること" : "振り返り";

    if (!sectionText) {
      setDailyMessage(`${sectionLabel}を入力してください。`);
      return;
    }

    const now = new Date().toISOString();
    const existingReport = dailyReports.find((report) => report.date === selectedDailyDate);
    const report: DailyReport = {
      id: `${currentUser.uid}_${selectedDailyDate}`,
      userId: currentUser.uid,
      userName: playerName,
      characterColor: playerCharacterColor,
      currentTitle,
      date: selectedDailyDate,
      plan: section === "plan" ? planText : existingReport?.plan || "",
      reflection: section === "reflection" ? reflectionText : existingReport?.reflection || "",
      createdAt: existingReport?.createdAt || now,
      updatedAt: now,
      syncStatus: "pending",
      syncError: "",
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
      setDailyMessage(`${sectionLabel}を保存しました。`);
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
          `${sectionLabel}をローカルに保存しました。クラウドへ再同期します。`,
          `${sectionLabel}をクラウド保存する権限がまだ有効ではありません。ローカルには保存されています。`,
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

  const useLatestStudyLogAsPost = () => {
    const latestLog = [...studyLogs]
      .filter((log) => !log.id.startsWith("seed-"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!latestLog) {
      setPostDraft("今日の積み上げを静かに記録中。");
      return;
    }

    setPostDraft(`${latestLog.subject}を${formatStudyTimeJa(latestLog.minutes)}${getStudyLogPostVerb(latestLog.subject)}。`);
  };

  const useRoomPresenceAsPost = () => {
    const currentPostRoom = activeRoom || selectedRoom;
    setPostDraft(`${currentPostRoom?.name || "作業部屋"}で${currentBuilding}を進めています。`);
  };

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
      streak: studyStreak,
      determination,
      following: [...following].sort(),
      followers: [] as string[],
      unlockedCharacters: [characterOptions[0].id],
      characterExp: effortExp,
      openedWorkspaceGiftLevels: [...openedWorkspaceGiftLevels].sort(),
      githubId,
      githubUsername,
      contributionCount: outputStats.contributions,
    };
    const userProgressSignature = JSON.stringify(userProgressPayload);

    if (lastSyncedUserProgressRef.current !== userProgressSignature) {
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
    effortExp,
    following,
    githubId,
    githubUsername,
    isWorkspaceLoaded,
    levelState.level,
    outputExp,
    openedWorkspaceGiftLevels,
    playerAvatar,
    playerCharacterColor,
    playerName,
    studyStreak,
    userId,
    coins,
    ownedCharacterShapes,
    lastFeedRewardDate,
    feedRewardArcEarned,
  ]);

  if (window.location.pathname === githubCallbackPath) {
    return <GitHubCallbackPage />;
  }

  if (!isAuthReady) {
    return (
      <main className="login-shell loading-auth">
        <section className="card login-card">
          <p className="card-kicker">Contribution Arc</p>
          <h2>Loading your workspace...</h2>
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

  const handleSettingsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftUserName.trim();
    const nextDisplayName = nextName || playerName || currentUser.email?.split("@")[0] || "Developer";
    const nextUserId = draftUserId.trim();
    const userIdError = validateUserId(nextUserId);
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
              throw new Error("このユーザーIDはすでに使われています。");
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
              "ユーザーIDを保存できませんでした。",
              "ユーザーIDの保存権限が有効になっていません。少し時間を置いて再度お試しください。",
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
            : "プロフィールをこのブラウザに保存できませんでした。ブラウザのストレージ設定を確認してください。",
        );
        return;
      }

      if (wasOnboardingSettings) {
        setOnboardingStep("firstPost");
        setCurrentView("home");
      } else {
        setOnboardingStep("idle");
        // Onboarding has its own celebratory flow ("first post" banner),
        // so only toast for regular saves — otherwise the user sees both
        // and the banner gets stepped on.
        showToast("プロフィールを保存しました", { kind: "success" });
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
      const results = snapshot.docs
        .map((item) => normalizeUserProfile(item.id, item.data() as Partial<UserProfile>))
        .filter((profile) => profile.uid !== currentUser.uid && profile.userId);

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("該当するユーザーが見つかりません。");
      }
    } catch (error) {
      setSearchError(
        getFirestoreErrorMessage(
          error,
          "ユーザー検索に失敗しました。",
          "ユーザー検索の権限が有効になっていません。少し時間を置いて再度お試しください。",
        ),
      );
    } finally {
      setIsSearching(false);
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
      setFriendMessage("フレンド上限に達しています。");
      return;
    }

    if (profile.uid === currentUser.uid) {
      setFriendMessage("自分自身にはフレンド申請できません。");
      return;
    }

    if (friends.some((friend) => friend.uid === profile.uid)) {
      setFriendMessage("すでにフレンドです。");
      return;
    }

    if (friendRequests.some((request) => request.profile.uid === profile.uid && request.status === "pending")) {
      setFriendMessage("フレンド申請を送信済みです。");
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
      showToast(`${profile.displayName} にフレンド申請を送りました`, { kind: "success" });
    } catch (error) {
      console.info("Friend request cloud send skipped.", error);
      showToast("フレンド申請をローカルに保存しました。再接続後に同期します。", { kind: "info" });
    }

    setFriendMessage("フレンド申請を送信しました。承認されるとFriendsに表示されます。");
  };

  const handleFriendAccept = async (request: FriendRequest) => {
    if (!currentUser) {
      return;
    }

    if (request.direction !== "incoming") {
      setFriendMessage("フレンド申請は相手が承認すると成立します。");
      return;
    }

    if (friends.length >= 20) {
      setFriendMessage("フレンド上限に達しています。");
      return;
    }

    const nextFriend = profileToFriend(request.profile);
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
    } catch (error) {
      console.info("Friend request accept cloud sync skipped.", error);
    }

    setFriendMessage("フレンドになりました。");
    showToast(`${nextFriend.name} とフレンドになりました`, { kind: "success" });
  };

  const handleNotificationFriendAccept = (
    event: ReactMouseEvent<HTMLButtonElement>,
    request: FriendRequest,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    void handleFriendAccept(request);
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

  const handleFollowToggle = async (profile: UserProfile) => {
    if (!userId) {
      setSearchError("フォローする前に設定からユーザーIDを登録してください。");
      return;
    }

    const isFollowing = following.includes(profile.uid);
    const currentRef = doc(db, "users", currentUser.uid);

    try {
      await setDoc(
        currentRef,
        {
          uid: currentUser.uid,
          userId,
          displayName: playerName,
          photoURL: playerAvatar,
          searchName: playerName.toLowerCase(),
          determination,
          characterColor: playerCharacterColor,
          following,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await updateDoc(currentRef, {
        following: isFollowing ? arrayRemove(profile.uid) : arrayUnion(profile.uid),
        updatedAt: serverTimestamp(),
      });

      setFollowing((items) =>
        isFollowing ? items.filter((item) => item !== profile.uid) : [...items, profile.uid],
      );
    } catch (error) {
      setSearchError(
        getFirestoreErrorMessage(
          error,
          "フォロー状態を更新できませんでした。",
          "フォロー状態を保存する権限が有効になっていません。少し時間を置いて再度お試しください。",
        ),
      );
    }
  };

  const handleDeterminationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextDetermination = draftDetermination.trim();
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    setDetermination(nextDetermination);
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

  const handleProfileBack = () => {
    setCurrentView("home");
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

  const handleRoomActivityOpen = (item: RoomActivityItem) => {
    if (item.userId === currentUser.uid) {
      setProfileMember(null);
      setProfileUser(null);
      setCurrentView("profile");
      return;
    }

    const activeMember = item.member || activeMembers.find((member) => member.userId === item.userId);
    if (activeMember) {
      handleMemberProfileOpen(activeMember);
      return;
    }

    setProfileMember(null);
    setProfileUser({
      uid: item.userId,
      userId: item.userId.startsWith("npc-") ? item.userName.toLowerCase() : item.userId,
      displayName: item.userName,
      photoURL: item.avatar || "",
      searchName: item.userName.toLowerCase(),
      following: [],
      followers: [],
      determination: item.text,
      characterColor: characterColorOptions[0].value,
    });
    setFriendMessage("");
    setCurrentView("profile");
  };

  const handleLiveActivityOpen = (activity: LiveActivity) => {
    if (activity.userId === currentUser.uid) {
      setProfileMember(null);
      setProfileUser(null);
      setCurrentView("profile");
      return;
    }

    const activeMember = activeMembers.find((member) => member.userId === activity.userId);
    if (activeMember) {
      handleMemberProfileOpen(activeMember);
      return;
    }

    setProfileMember(null);
    setProfileUser({
      uid: activity.userId,
      userId: activity.userId.startsWith("npc-") ? activity.userName.toLowerCase() : activity.userId,
      displayName: activity.userName,
      photoURL: activity.avatar || "",
      searchName: activity.userName.toLowerCase(),
      following: [],
      followers: [],
      determination: activity.text,
      characterColor: characterColorOptions[0].value,
    });
    setFriendMessage("");
    setCurrentView("profile");
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = typeof reader.result === "string" ? reader.result : "";
      const accountScope = getAccountStorageScope(currentUser.uid, userId);
      setPlayerAvatar(nextAvatar);
      safeSetLocalStorage(getAccountStorageKey(accountScope, "avatar"), nextAvatar);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleAvatarRemove = () => {
    const accountScope = getAccountStorageScope(currentUser.uid, userId);
    setPlayerAvatar("");
    window.localStorage.removeItem(getAccountStorageKey(accountScope, "avatar"));
  };

  const closeWorkspaceSession = (roomId: string) => {
    const room = customRooms.map(normalizeWorkspaceRoom).find((item) => item.id === roomId);
    const member = room?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!room || !member) {
      return;
    }

    const leftAt = new Date().toISOString();
    const minutes = getWorkspaceActiveMinutes(member);
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
    }).catch((error) => {
      console.error("Workspace study log cloud save failed.", error);
    });
    setLastRoomSession(session);
    // EXP/minute earnings only become visible on the profile screen,
    // which the user usually isn't looking at when they leave a room.
    // The toast surfaces the reward immediately so the action feels
    // rewarding rather than empty.
    if (session.durationMinutes > 0) {
      showToast(
        `退室しました ・ ${formatStayTime(session.durationMinutes)} で +${session.earnedExp} EXP`,
        { kind: "success" },
      );
    }
  };

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
      setWorkspaceStartError("作業内容を入力してください。");
      setWorkspaceBubble("作業内容を入力してください。");
      return;
    }

    setWorkspaceStartError("");
    const joinedAt = new Date().toISOString();
    const seatPosition = getWorkspaceSeatPosition(nextTask);
    const targetRoom = allWorkspaceRooms.find((room) => room.id === roomId);

    if (!targetRoom) {
      setWorkspaceStartError("Roomデータを読み込めませんでした。もう一度Roomを選択してください。");
      setWorkspaceBubble("Roomデータを読み込めませんでした。");
      return;
    }

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
      setWorkspaceStartError("作業内容を入力してください。");
      setWorkspaceBubble("作業内容を入力してください。");
      return;
    }

    startWorkspaceSession(roomId, nextTask, studyColor);
  };

  const handleWorkspaceStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingJoinRoomId) {
      return;
    }

    const nextTask = workspaceDraftTask.trim();
    if (!nextTask) {
      setWorkspaceStartError("作業内容を入力してください。");
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
      setRecruitmentError("入室する作業部屋を選択してください。");
      return;
    }
    const task = workspaceTask.trim();
    if (!task) {
      setRecruitmentError("作業内容を入力してから募集してください。");
      return;
    }
    const message = recruitmentDraft.message.trim();
    if (message.length > 140) {
      setRecruitmentError("メッセージは140字までです。");
      return;
    }

    const now = new Date();
    let startAtDate = now;
    if (recruitmentDraft.mode === "scheduled") {
      if (!recruitmentDraft.scheduledAt) {
        setRecruitmentError("開始時刻を入力してください。");
        return;
      }
      const scheduled = new Date(recruitmentDraft.scheduledAt);
      if (Number.isNaN(scheduled.getTime())) {
        setRecruitmentError("開始時刻が正しくありません。");
        return;
      }
      if (scheduled.getTime() <= now.getTime()) {
        setRecruitmentError("開始時刻は今より後を指定してください。");
        return;
      }
      const maxFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (scheduled.getTime() > maxFuture.getTime()) {
        setRecruitmentError("予約は24時間以内までです。");
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
    } catch (error) {
      console.warn("Failed to create recruitment", error);
      setRecruitmentError("募集の投稿に失敗しました。時間をおいて再度お試しください。");
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

  const handleRoomCreate = () => {
    if (!currentUser) {
      return;
    }

    const roomName = newRoomName.trim();
    if (!roomName) {
      setRoomCreateState("offline");
      setRoomCreateMessage("Room名を入力してください。");
      return;
    }

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
    });

    pendingWorkspaceRoomsRef.current.set(room.id, room);
    setCustomRooms((rooms) => (rooms.some((item) => item.id === room.id) ? rooms : [...rooms, room].map(normalizeWorkspaceRoom)));
    void saveWorkspaceRoomToCloud(room, currentUser.uid)
      .then(() => {
        pendingWorkspaceRoomsRef.current.delete(room.id);
      })
      .catch((error) => {
        console.info("Workspace room create cloud sync skipped.", error);
      });
    setSelectedRoomId(room.id);
    setProfileMember(null);
    setProfileUser(null);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setCurrentView("workspace");
    setNewRoomName("");
    setRoomCreateState("saved");
    setRoomCreateMessage("Roomを作成しました。");
  };

  const startRoomTitleEdit = (room: WorkspaceRoom) => {
    setEditingRoomId(room.id);
    setEditingRoomName(room.name);
  };

  const handleRoomTitleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = editingRoomName.trim();
    if (!nextName) {
      return;
    }

    setCustomRooms((rooms) =>
      rooms.map((room) => (room.id === editingRoomId ? { ...room, name: nextName } : room)),
    );
    setEditingRoomId("");
    setEditingRoomName("");
  };

  const handleRoomDelete = (roomId: string) => {
    const room = customRooms.find((item) => item.id === roomId);
    if (!room || room.createdBy !== currentUser.uid) {
      return;
    }

    const isConfirmed = window.confirm(`${room.name}を解体しますか？このRoomは一覧から消えます。`);
    if (!isConfirmed) {
      return;
    }

    pendingWorkspaceRoomsRef.current.delete(roomId);
    const nextRooms = customRooms.filter((item) => item.id !== roomId);
    setCustomRooms(nextRooms);
    void deleteDoc(doc(db, workspaceRoomsCollectionName, roomId)).catch((error) => {
      console.info("Workspace room delete cloud sync skipped.", error);
    });
    void deleteDoc(doc(db, legacyWorkspaceRoomsCollectionName, roomId)).catch((error) => {
      console.info("Legacy workspace room delete cloud sync skipped.", error);
    });

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
  };

  const handleStudyLogDelete = (logId: string) => {
    setStudyLogs((logs) => logs.filter((log) => log.id !== logId));
    void deleteStudyLogFromCloud(db, logId).catch((error) => {
      console.info("Study log cloud delete skipped.", error);
    });
  };

  const handleKnowledgeImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.name.toLowerCase().endsWith(".md"));
    if (files.length === 0) {
      return;
    }

    const notes = await Promise.all(
      files.map(async (file) => ({
        title: getNoteTitle(file),
        content: await file.text(),
      })),
    );
    const nextGraph = buildObsidianGraph(notes);
    setKnowledgeGraph(nextGraph);
    setSelectedKnowledgeId(nextGraph.nodes[0]?.id || "");
    setHoveredKnowledgeId("");
    setKnowledgePositions({});
    event.target.value = "";
  };

  const getKnowledgePoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = graphSvgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 760;
    const y = ((event.clientY - rect.top) / rect.height) * 460;
    return {
      x: 380 + (x - 380) / knowledgeScale,
      y: 230 + (y - 230) / knowledgeScale,
    };
  };

  const handleKnowledgeDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingKnowledgeId) {
      return;
    }

    const point = getKnowledgePoint(event);
    setKnowledgePositions((positions) => ({
      ...positions,
      [draggingKnowledgeId]: point,
    }));
  };

  const playerStatusCard = (isInteractive = false) => (
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
      aria-label={isInteractive ? "プロフィール画面を開く" : undefined}
    >
      <div className="card-kicker">Player Status</div>
      <div className="player-heading">
        <span className="player-avatar">
          {playerAvatar ? <img src={playerAvatar} alt="" /> : playerInitial}
        </span>
        <div>
          <h2>{playerName} Lv.{levelState.level}</h2>
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
        <div>
          <strong>{outputStats.commits.toLocaleString()}</strong>
          <span>commits</span>
        </div>
        <div>
          <strong>{outputStats.contributions.toLocaleString()}</strong>
          <span>contributions</span>
        </div>
        <div>
          <strong>{outputStats.pullRequests.toLocaleString()}</strong>
          <span>PRs</span>
        </div>
      </div>
    </article>
  );

  const postCard = (post: ContributionPostRecord, variant: "full" | "compact" = "full") => {
    const isLiked = post.likedUserIds.includes(currentUserUid);
    const roomLabel = post.roomName || "Quiet log";
    const studyLabel = post.studyMinutes > 0 ? `${formatStudyTimeJa(post.studyMinutes)} focused` : "quiet progress";
    const contributionLabel =
      post.githubContributionCount > 0 ? `+${post.githubContributionCount.toLocaleString()} commits` : "";
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
          <ProfileCharacterPreview color={post.characterColor} variant="simple" />
          <span>
            <strong>{post.username}</strong>
            <small>{formatPostTime(post.createdAt)}</small>
          </span>
        </button>

        <p>{post.text}</p>

        <div className="log-post-meta">
          <span>{studyLabel}</span>
          {contributionLabel ? <span>{contributionLabel}</span> : null}
          <span>{roomLabel}</span>
        </div>

        <div className="log-post-actions">
          <motion.button
            type="button"
            className={isLiked ? "log-like-button liked" : "log-like-button"}
            onClick={() => handlePostLike(post)}
            aria-label={isLiked ? "ハートを取り消す" : "ハートする"}
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
          </motion.button>

          <button
            type="button"
            className={isReplyOpen ? "log-reply-toggle is-open" : "log-reply-toggle"}
            onClick={() => togglePostReplyOpen(post.id)}
            aria-label={isReplyOpen ? "返信を閉じる" : "返信を書く"}
            aria-expanded={isReplyOpen}
            data-tooltip={isReplyOpen ? "閉じる" : "返信"}
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
          </button>

          {post.userId === currentUserUid ? (
            <button type="button" className="log-delete-button" onClick={() => handlePostDelete(post)}>
              削除
            </button>
          ) : null}
        </div>

        <div className="post-reply-area">
          {visibleReplies.length > 0 ? (
            <div className="post-reply-list">
              {visibleReplies.map((reply) => (
                <article key={reply.id} className="post-reply-item">
                  <ProfileCharacterPreview color={reply.characterColor} variant="simple" />
                  <p>
                    <strong>{reply.username}</strong>
                    <span>{reply.text}</span>
                  </p>
                </article>
              ))}
              {replies.length > visibleReplies.length ? <small>ほか {replies.length - visibleReplies.length} 件</small> : null}
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
                  placeholder="短く返信"
                  maxLength={160}
                />
                <button type="submit" disabled={!replyDraft.trim()}>
                  返信
                </button>
              </motion.form>
            ) : null}
          </AnimatePresence>
        </div>
      </article>
    );
  };

  const recentLogsCard = (ownerUid: string, title = "Recent Logs") => {
    const recentPosts = posts.filter((post) => post.userId === ownerUid).slice(0, 3);

    return (
      <article className="profile-log-card">
        <div className="profile-log-head">
          <p className="card-kicker">{title}</p>
          <button type="button" onClick={() => setCurrentView("logs")}>
            みんなの記録を見る
          </button>
        </div>
        {recentPosts.length > 0 ? (
          <div className="profile-log-list">{recentPosts.map((post) => postCard(post, "compact"))}</div>
        ) : (
          <p className="profile-log-empty">まだ静かなログはありません。</p>
        )}
      </article>
    );
  };

  const memberProfileCard = (member: WorkspaceMember) => {
    const memberRoom =
      allWorkspaceRooms.find((room) => room.activeMembers.some((item) => item.userId === member.userId)) ||
      selectedRoom;
    const elapsedMinutes = getElapsedMinutes(member.joinedAt, workspaceNow);
    const memberProfile = workspaceMemberToProfile(member);
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
      ? "つながっています"
      : pendingIncomingRequest
        ? "申請が届いています"
        : pendingOutgoingRequest
          ? "承認待ち"
          : "未接続";
    const connectionState = isFriend
      ? "is-friend"
      : hasPendingRequest
        ? "is-pending"
        : "is-stranger";

    return (
      <article className="card member-profile-card workspace-member-profile-card">
        <header className="member-profile-hero">
          <ProfileCharacterPreview
            color={memberProfile.characterColor}
            variant="simple"
            shape={memberProfile.characterShape}
          />
          <div className="member-profile-identity">
            <h2>{member.name}</h2>
            <small>@{memberProfile.userId}</small>
            <span className={`member-profile-status-chip ${connectionState}`}>
              <i />
              {connectionLabel}
            </span>
          </div>
        </header>

        <div className="profile-resolve-panel">
          <span>決意</span>
          <p>{profileResolveText(memberProfile)}</p>
        </div>

        <section className="member-profile-now" aria-label="いまの活動">
          <div className="member-profile-now-main">
            <span className="member-profile-now-label">いま</span>
            <div className="member-profile-now-body">
              <strong>
                <i style={{ background: member.color }} />
                {member.building}
              </strong>
              <small>
                {memberRoom?.name || "Silent Workspace"}
                {" · 滞在 "}
                {formatStayTime(elapsedMinutes)}
              </small>
            </div>
          </div>
          <div className="member-profile-now-exp" aria-label="今日獲得したEXP">
            <span className="member-profile-now-exp-label">今日</span>
            <strong>+{getRoomSessionExp(elapsedMinutes)} EXP</strong>
          </div>
        </section>

        <div className="friend-profile-actions member-profile-actions">
          <button
            type="button"
            disabled={isFriend || hasPendingRequest}
            onClick={() => handleFriendRequest(memberProfile)}
          >
            {isFriend ? "フレンド" : pendingIncomingRequest ? "申請が届いています" : pendingOutgoingRequest ? "申請中" : "フレンド申請"}
          </button>
          {pendingIncomingRequest ? (
            <button type="button" onClick={() => handleFriendAccept(pendingIncomingRequest)}>
              承認する
            </button>
          ) : null}
        </div>

        {friendMessage ? <p className="friend-message">{friendMessage}</p> : null}
        {recentLogsCard(member.userId)}
      </article>
    );
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
      ? "つながっています"
      : pendingIncomingRequest
        ? "申請が届いています"
        : pendingOutgoingRequest
          ? "承認待ち"
          : "未接続";
    const connectionState = isFriend
      ? "is-friend"
      : hasPendingRequest
        ? "is-pending"
        : "is-stranger";

    return (
      <article className="card member-profile-card friend-profile-card">
        <header className="member-profile-hero">
          <ProfileCharacterPreview
            color={profile.characterColor}
            variant="simple"
            shape={profile.characterShape}
          />
          <div className="member-profile-identity">
            <h2>{profile.displayName}</h2>
            <small>@{profile.userId}</small>
            <span className={`member-profile-status-chip ${connectionState}`}>
              <i />
              {connectionLabel}
            </span>
          </div>
        </header>

        <div className="profile-resolve-panel">
          <span>決意</span>
          <p>{profileResolveText(profile)}</p>
        </div>

        <div className="friend-profile-actions">
          <button type="button" disabled={isFriend || hasPendingRequest} onClick={() => handleFriendRequest(profile)}>
            {isFriend ? "フレンド" : pendingIncomingRequest ? "申請が届いています" : pendingOutgoingRequest ? "申請中" : "フレンド申請"}
          </button>
          {pendingIncomingRequest ? (
            <button type="button" onClick={() => handleFriendAccept(pendingIncomingRequest)}>
              承認する
            </button>
          ) : null}
          {githubUrl ? (
            <a href={githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
        </div>

        {friendMessage ? <p className="friend-message">{friendMessage}</p> : null}
        {recentLogsCard(profile.uid)}
      </article>
    );
  };

  const contributionArcCardSection = (
    <section className="contribution-arc-card" aria-label="Contribution Arc">
        <div className="contribution-arc-head">
          <div className="contribution-arc-head-title">
            <p className="card-kicker">Contribution Arc</p>
            <strong>
              {Math.round(contributionArc.totalMinutes / 60)}時間 学習
              {githubContributionArc ? ` · ${githubContributionArc.total} commit` : ""}
            </strong>
            <span>
              直近13週
              {" · "}
              {contributionArc.activeDays}日学習
              {githubContributionArc ? ` / ${githubContributionArc.activeDays}日コミット` : ""}
            </span>
          </div>
          <div className="contribution-arc-stats" aria-label="学習サマリ">
            <div
              className="arc-stat"
              data-tooltip={
                contributionArc.lastWeekMinutes > 0
                  ? `先週比 ${
                      contributionArc.thisWeekMinutes - contributionArc.lastWeekMinutes >= 0 ? "+" : ""
                    }${formatStudyTimeJa(
                      Math.abs(contributionArc.thisWeekMinutes - contributionArc.lastWeekMinutes),
                    )}`
                  : "先週の記録はまだありません"
              }
            >
              <small>今週</small>
              <strong>{formatStudyTimeJa(contributionArc.thisWeekMinutes)}</strong>
            </div>
            <div className="arc-stat" data-tooltip="連続して記録した最長期間">
              <small>最長連続</small>
              <strong>{contributionArc.longestStreak}日</strong>
            </div>
            <div
              className="arc-stat"
              data-tooltip={
                contributionArc.topMonthMinutes > 0
                  ? `合計 ${formatStudyTimeJa(contributionArc.topMonthMinutes)}`
                  : "まだ記録なし"
              }
            >
              <small>最も学んだ月</small>
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
            aria-label={`直近13週: ${contributionArc.activeDays}日学習${
              githubContributionArc ? ` · ${githubContributionArc.activeDays}日コミット` : ""
            }`}
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
                      {["日", "月", "火", "水", "木", "金", "土"][hoveredArcCell.day.date.getDay()]}曜
                    </span>
                  </div>
                  {hasStudy ? (
                    <>
                      <p className="contribution-arc-tooltip-total">
                        {formatStudyTimeJa(hoveredArcCell.day.minutes)} 学習
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
                            ほか {hoveredArcDayLogs.length - 4} 件
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
                    <p className="contribution-arc-tooltip-empty">記録なし</p>
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
                  if (commitCount > 0) ariaParts.push(`${commitCount}コミット`);
                  const ariaLabel = `${day.date.getMonth() + 1}月${day.date.getDate()}日 ${
                    ariaParts.length > 0 ? ariaParts.join(" / ") : "記録なし"
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
            <span>少</span>
            <i className="lv-0" />
            <i className="lv-1" />
            <i className="lv-2" />
            <i className="lv-3" />
            <i className="lv-4" />
            <span>多</span>
          </div>
          {githubContributionArc ? (
            <div className="contribution-arc-github-stats">
              <span>
                今週 <strong>{githubContributionArc.thisWeekCount}</strong> commit
              </span>
              <span>
                先週 <strong>{githubContributionArc.lastWeekCount}</strong>
              </span>
              <span>
                最長 <strong>{githubContributionArc.longestStreak}日</strong>
              </span>
            </div>
          ) : !githubUsername ? (
            <div className="contribution-arc-github-cta">
              <span>GitHub を連携すると commit もこの図に重なります</span>
              <button
                type="button"
                className="contribution-arc-github-link-btn"
                onClick={handleLinkGithub}
                disabled={isLinkingGithub}
              >
                {isLinkingGithub ? "連携中…" : "GitHub を連携"}
              </button>
              {linkGithubError ? (
                <p className="contribution-arc-github-link-error">{linkGithubError}</p>
              ) : null}
            </div>
          ) : (
            <p className="contribution-arc-github-status">
              {githubContributionsError ? "GitHub データの取得に失敗しました" : "GitHub データを読み込み中…"}
            </p>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {donutDisplay.total > 0 ? (
            <motion.div
              key={donutDisplay.key}
              className={`contribution-arc-donut${donutDisplay.isDaily ? " is-daily" : ""}`}
              aria-label={donutDisplay.isDaily ? `${donutDisplay.label}の学習ジャンル配分` : "13週の学習ジャンル配分"}
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
                  <span>{donutDisplay.items.length}ジャンル</span>
                </div>
              </div>
              <ul className="contribution-arc-donut-legend">
                {donutDisplay.items.map((item) => {
                  const pct = Math.round((item.minutes / donutDisplay.total) * 100);
                  return (
                    <li key={item.subject}>
                      <i style={{ background: item.color }} aria-hidden="true" />
                      <strong className="legend-name">{item.subject}</strong>
                      <span className="legend-pct">{pct}%</span>
                      <span className="legend-time">{formatStudyTimeJa(item.minutes)}</span>
                    </li>
                  );
                })}
              </ul>
              {donutDisplay.isDaily ? (
                <button
                  type="button"
                  className="contribution-arc-donut-reset"
                  onClick={() => setSelectedArcDayKey(null)}
                  aria-label="13週合計に戻す"
                >
                  13週合計に戻す
                </button>
              ) : null}
            </motion.div>
          ) : donutDisplay.isDaily ? (
            <motion.div
              key={donutDisplay.key}
              className="contribution-arc-donut is-daily is-empty-daily"
              aria-label={`${donutDisplay.label}の学習ジャンル配分（記録なし）`}
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
                  <strong>0時間</strong>
                  <span>学習記録なし</span>
                </div>
              </div>
              <p className="contribution-arc-donut-empty-note">この日はまだ学習が記録されていません。</p>
              <button
                type="button"
                className="contribution-arc-donut-reset"
                onClick={() => setSelectedArcDayKey(null)}
                aria-label="13週合計に戻す"
              >
                13週合計に戻す
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
              <p>学習を記録するとここにジャンル分布が現れます。</p>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        {selectedArcDay ? (
          <div className="contribution-arc-detail" role="region" aria-label="選択日の学習詳細">
            <div className="contribution-arc-detail-head">
              <div>
                <strong>
                  {selectedArcDay.date.getFullYear()}年 {selectedArcDay.date.getMonth() + 1}月
                  {selectedArcDay.date.getDate()}日
                </strong>
                <span>
                  {selectedArcDay.minutes > 0
                    ? `${formatStudyTimeJa(selectedArcDay.minutes)} 学習`
                    : "学習記録なし"}
                </span>
              </div>
              <button
                type="button"
                className="contribution-arc-detail-close"
                onClick={() => setSelectedArcDayKey(null)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            {selectedArcDayLogs.length > 0 ? (
              <ul className="contribution-arc-detail-list">
                {selectedArcDayLogs.map((log) => (
                  <li key={log.id}>
                    <span
                      className="contribution-arc-detail-dot"
                      style={{ background: log.color || "rgba(31,111,74,0.7)" }}
                      aria-hidden="true"
                    />
                    <strong>{log.subject}</strong>
                    <small>{formatStudyTime(log.minutes)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="contribution-arc-detail-empty">この日はまだ記録がありません。</p>
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
      ...posts.map((post) => ({ kind: "post" as const, id: post.id, createdAt: post.createdAt, post })),
      ...workspaceRecruitments.map((recruitment) => ({
        kind: "recruitment" as const,
        id: recruitment.id,
        createdAt: recruitment.createdAt,
        recruitment,
      })),
    ];

    const filtered =
      timelineFilter === "following"
        ? allEntries.filter((entry) =>
            followingSet.has(entry.kind === "post" ? entry.post.userId : entry.recruitment.userId),
          )
        : allEntries;

    const sorted = filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return (
      <section className="home-feed-section" aria-label="フィード">
        <header className="home-feed-head">
          <div>
            <p className="card-kicker">Feed</p>
            <h2>みんなと学びを共有・作業仲間を募集</h2>
          </div>
          <span>{sorted.length.toLocaleString()} 件</span>
        </header>

        {onboardingStep === "firstPost" ? (
          <div className="onboarding-firstpost-banner" role="status" aria-live="polite">
            <div className="onboarding-firstpost-copy">
              <p className="card-kicker">チュートリアル · 最後のステップ</p>
              <h3>「初めまして！」と投稿してみよう</h3>
              <p>
                下のフォームに <strong>初めまして！</strong> と入力して、最初の投稿を送信しましょう。投稿が完了するとチュートリアルは終わりです。
              </p>
            </div>
            <span className="onboarding-firstpost-arrow" aria-hidden="true">↓</span>
          </div>
        ) : null}

        <section
          className={`home-feed-composer is-living${
            onboardingStep === "firstPost" ? " is-onboarding-highlight" : ""
          }`}
          aria-label="投稿を作成"
        >
          <form className="log-composer" onSubmit={handlePostSubmit}>
            <ProfileCharacterPreview color={playerCharacterColor} variant="simple" />
            <div>
              <textarea
                value={postDraft}
                onChange={(event) => {
                  setPostDraft(event.target.value);
                  setPostError("");
                }}
                placeholder={
                  onboardingStep === "firstPost"
                    ? "初めまして！ と入力してみよう"
                    : "What are you building tonight?"
                }
                maxLength={280}
                rows={1}
              />
              <div className="log-composer-footer">
                <div className="log-compose-shortcuts">
                  <button type="button" onClick={useRoomPresenceAsPost}>
                    Roomから作成
                  </button>
                  <button type="button" onClick={useLatestStudyLogAsPost}>
                    学習ログから作成
                  </button>
                </div>
                <CharCountRing value={postDraft.length} max={280} />
                <button type="submit" disabled={isPosting || !postDraft.trim()}>
                  {isPosting ? "Posting" : "投稿"}
                </button>
              </div>
              {postError ? <p className="log-post-error">{postError}</p> : null}
            </div>
          </form>
        </section>

        <div className="timeline-filter-tabs" role="tablist" aria-label="フィードの表示範囲">
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
              <p className="card-kicker">{timelineFilter === "following" ? "Following" : "Quiet Progress"}</p>
              <strong>
                {timelineFilter === "following"
                  ? "フォロー中の投稿はまだありません。"
                  : "まだ投稿はありません。"}
              </strong>
              <span>
                {timelineFilter === "following"
                  ? "気になるエンジニアをフォローすると、ここに学びと作業部屋の募集が流れます。"
                  : "今日作っているもの、学んだこと、作業部屋の募集が静かに流れます。"}
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
      <div ref={spotlightRef} className="cursor-spotlight" aria-hidden="true" />
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
            <strong>{activeRoom?.name || selectedRoom?.name || "作業部屋"}</strong>
          </div>

          <div className="desktop-app-actions">
            <span className="desktop-status-pill">
              <i aria-hidden="true" />
              {activeRoom ? `${formatStayTime(currentStayMinutes)} focused` : `${roomOnlineCount} online`}
            </span>
            <span className="desktop-github-pill">{githubConnectionLabel}</span>
            <button type="button" onClick={handleSettingsOpen}>
              プロフィール
            </button>
          </div>
        </header>
      ) : null}

      {isDesktopApp && isDesktopWelcomeVisible ? (
        <div className="desktop-welcome-toast" role="status" aria-live="polite">
          Welcome back, {playerName}.
        </div>
      ) : null}

      {onboardingStep === "welcome" ? (
        <div className="onboarding-welcome" role="status" aria-live="polite">
          <section>
            <p className="card-kicker">Contribution Arc</p>
            <h1>{onboardingMessage}</h1>
            <span>最初にあなたのプロフィールを整えます。</span>
          </section>
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
            ホーム
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
            <span className="workspace-tab-label">作業部屋</span>
            {activeMembers.length > 0 ? (
              <span
                className="topbar-presence-count"
                aria-label={`現在 ${activeMembers.length} 人が作業中`}
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
            記録する
          </button>
          <button
            type="button"
            className={currentView === "daily" ? "is-active" : ""}
            onClick={() => setCurrentView("daily")}
          >
            日報
          </button>
        </nav>

        <div className="topbar-context">
          {todayStudyMinutes > 0 ? (
            <span className="topbar-today">
              今日 {formatStudyTimeJa(todayStudyMinutes)} 学習
            </span>
          ) : null}
        </div>

        <div className="user-session">
          <button
            type="button"
            className="topbar-icon-button topbar-shop-button"
            aria-label={`ショップ${coins > 0 ? ` (${coins.toLocaleString()} Arc)` : ""}`}
            onClick={() => {
              setCurrentView("shop");
              setIsFriendsPopoverOpen(false);
              setIsLivePopoverOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
            {coins > 0 ? (
              <span className="topbar-shop-coins" aria-hidden="true">
                {coins.toLocaleString()}
              </span>
            ) : null}
          </button>

          <div className="topbar-popover-wrap" ref={friendsPopoverRef}>
            <button
              type="button"
              className={`topbar-icon-button${isFriendsPopoverOpen ? " is-open" : ""}`}
              aria-label={`Friends${sidebarFriends.length > 0 ? ` (${sidebarFriends.length})` : ""}`}
              aria-expanded={isFriendsPopoverOpen}
              onClick={() => {
                setIsFriendsPopoverOpen((prev) => !prev);
                setIsLivePopoverOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="16.5" cy="9" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M3 19c1-3 3.4-4.6 6-4.6s5 1.6 6 4.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M14.6 19c.8-2.4 2.5-3.6 4.4-3.6s3.6 1.2 4.4 3.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              {sidebarFriends.length > 0 ? (
                <span className="topbar-icon-badge">{sidebarFriends.length}</span>
              ) : null}
            </button>
            {isFriendsPopoverOpen ? (
              <section className="topbar-popover topbar-popover-friends" aria-label="Friends">
                <div className="topbar-popover-head">
                  <p className="card-kicker">Friends</p>
                  {sidebarFriends.length > 0 ? <span>{sidebarFriends.length}/20</span> : null}
                </div>
                <div className="topbar-popover-list">
                  {sidebarFriends.length > 0 ? (
                    sidebarFriends.slice(0, 8).map((friend) => (
                      <button
                        type="button"
                        key={friend.uid}
                        className="topbar-popover-row"
                        onClick={() => {
                          handleFriendOpen(friend);
                          setIsFriendsPopoverOpen(false);
                        }}
                      >
                        <span className="topbar-popover-avatar">
                          {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1).toUpperCase()}
                          <i className={`topbar-popover-dot ${friend.status}`} />
                        </span>
                        <span>
                          <strong>{friend.name}</strong>
                          <small>{friend.activity}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="topbar-popover-empty">
                      <p>フレンドを招待して、一緒に学びを積み上げよう</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentView("profile");
                          setIsFriendsPopoverOpen(false);
                        }}
                      >
                        フレンドを招待する
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </div>

          <div className="topbar-popover-wrap" ref={livePopoverRef}>
            <button
              type="button"
              className={`topbar-icon-button${isLivePopoverOpen ? " is-open" : ""}`}
              aria-label={`Live Activity${liveActivities.length > 0 ? ` (${liveActivities.length})` : ""}`}
              aria-expanded={isLivePopoverOpen}
              onClick={() => {
                setIsLivePopoverOpen((prev) => !prev);
                setIsFriendsPopoverOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M4 12h3l2-6 4 12 2-6h5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {liveActivities.length > 0 ? (
                <span className="topbar-icon-badge">{liveActivities.length}</span>
              ) : null}
            </button>
            {isLivePopoverOpen ? (
              <section className="topbar-popover topbar-popover-live" aria-label="Live Activity">
                <div className="topbar-popover-head">
                  <p className="card-kicker">Live Activity</p>
                </div>
                <div className="topbar-popover-list">
                  {liveActivities.length > 0 ? (
                    liveActivities.map((activity) => (
                      <button
                        type="button"
                        key={activity.id}
                        className="topbar-popover-row"
                        onClick={() => {
                          handleLiveActivityOpen(activity);
                          setIsLivePopoverOpen(false);
                        }}
                      >
                        <span className="topbar-popover-avatar">
                          {activity.avatar ? <img src={activity.avatar} alt="" /> : activity.userName.slice(0, 1).toUpperCase()}
                          <i className={`topbar-popover-dot ${activity.status}`} />
                        </span>
                        <span>
                          <strong>{activity.text}</strong>
                          <small>{activity.meta}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="topbar-popover-empty-text">今は静かです。誰かの記録が始まるとここに流れます。</p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
          <button
            type="button"
            className="user-search-button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="ユーザー検索を開く"
          >
            <span aria-hidden="true" />
            <strong>Search</strong>
            <em>⌘K</em>
          </button>
          <div className="notification-wrap">
            <button
              type="button"
              className={hasUnreadNotifications ? "notification-button has-unread" : "notification-button"}
              aria-label={`お知らせ${unreadNotificationCount > 0 ? ` ${unreadNotificationCount}件の未読` : ""}`}
              aria-expanded={isNotificationsOpen}
              onClick={handleNotificationsToggle}
            >
              <BellIcon />
              {unreadNotificationCount > 0 ? (
                <span className="notification-dot" aria-hidden="true" />
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <section className="notification-panel" aria-label="お知らせ">
                <div className="notification-head">
                  <p className="card-kicker">Notifications</p>
                  <strong>お知らせ</strong>
                </div>

                <div className="notification-list">
                  {notificationFeedItems.length > 0 ? (
                    notificationFeedItems.map((item) => {
                      const friendRequest = friendRequests.find(
                        (request) => item.id === `friendRequest:${request.id}`,
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
                          <span className="notification-avatar">
                            {sourceProfile?.photoURL ? (
                              <img src={sourceProfile.photoURL} alt="" />
                            ) : (
                              item.title.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                            <small>
                              {getNotificationSourceText(item.type)} ·{" "}
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
                          <button
                            type="button"
                            className="notification-accept"
                            onClick={(event) => handleNotificationFriendAccept(event, friendRequest)}
                          >
                            承認
                          </button>
                        ) : null}
                      </article>
                    );
                    })
                  ) : (
                    <p className="notification-empty">新しいお知らせはありません。</p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
          <div className="user-menu-wrap" ref={userMenuRef}>
            <button
              type="button"
              className={`user-menu-button${isUserMenuOpen ? " open" : ""}`}
              aria-label="アカウントメニュー"
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
                    <small>@{userId || "未設定"}</small>
                    {currentUser?.email ? (
                      <small className="user-menu-email" title="サインイン中のアカウント">
                        {currentUser.email}
                      </small>
                    ) : null}
                  </span>
                </div>
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
                  <span>プロフィール</span>
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
                  <span>設定</span>
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
                  <span>チュートリアルをもう一度</span>
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
                  ログアウト
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.header>

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
                {learningEditorState.mode === "create" ? "学習対象を追加" : "学習対象を編集"}
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
                <span>名前</span>
                <input
                  value={learningEditorState.name}
                  onChange={(event) =>
                    setLearningEditorState((state) => (state ? { ...state, name: event.target.value } : state))
                  }
                  placeholder="DDIA / Go言語 など"
                  maxLength={60}
                  autoFocus
                  required
                />
              </label>

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
                  <strong>📕 書籍として記録する</strong>
                  <small>チェックするとページ数で進捗を追える</small>
                </span>
              </label>

              <div className="learning-color-panel">
                <span>カラー</span>
                <div className="character-color-grid compact" aria-label="カラー">
                  {studyColorOptions.map((color) => (
                    <button
                      type="button"
                      key={color.value}
                      className={learningEditorState.color === color.value ? "active" : ""}
                      onClick={() =>
                        setLearningEditorState((state) => (state ? { ...state, color: color.value } : state))
                      }
                      title={color.name}
                      aria-label={`${color.name}を選択`}
                    >
                      <span style={{ background: color.value }} />
                      <small>{color.name}</small>
                    </button>
                  ))}
                </div>
              </div>

              {learningEditorState.category === "book" ? (
                <div className="learning-book-fields">
                  <label>
                    <span>総ページ数</span>
                    <input
                      type="number"
                      min={0}
                      value={learningEditorState.totalPages}
                      onChange={(event) =>
                        setLearningEditorState((state) => (state ? { ...state, totalPages: event.target.value } : state))
                      }
                      placeholder="例: 600"
                    />
                  </label>
                  <label>
                    <span>現在のページ</span>
                    <input
                      type="number"
                      min={0}
                      value={learningEditorState.currentPages}
                      onChange={(event) =>
                        setLearningEditorState((state) => (state ? { ...state, currentPages: event.target.value } : state))
                      }
                      placeholder="例: 120"
                    />
                  </label>
                </div>
              ) : null}

              <div className="learning-modal-actions">
                {learningEditorState.mode === "edit" ? (
                  <button
                    type="button"
                    className="learning-archive-button"
                    onClick={handleLearningEditorArchiveToggle}
                  >
                    {learningItems.find((item) => item.id === learningEditorState.itemId)?.archived
                      ? "アーカイブ解除"
                      : "アーカイブ"}
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <div className="learning-modal-actions-right">
                  <button type="button" className="learning-cancel-button" onClick={closeLearningEditor}>
                    キャンセル
                  </button>
                  <button type="submit" className="learning-save-button">
                    保存
                  </button>
                </div>
              </div>
            </form>

            {learningEditorState.mode === "edit" ? (
              <div className="learning-danger-zone" role="group" aria-label="危険な操作">
                <div className="learning-danger-zone-info">
                  <strong>削除</strong>
                  <small>この学習対象の登録を完全に削除します。学習ログ自体は残ります。</small>
                </div>
                {isLearningDeleteConfirming ? (
                  <div className="learning-danger-zone-confirm">
                    <button
                      type="button"
                      className="learning-delete-cancel"
                      onClick={() => setIsLearningDeleteConfirming(false)}
                    >
                      やめる
                    </button>
                    <button
                      type="button"
                      className="learning-delete-confirm"
                      onClick={handleLearningEditorDelete}
                    >
                      本当に削除する
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="learning-delete-trigger"
                    onClick={() => setIsLearningDeleteConfirming(true)}
                  >
                    削除する
                  </button>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

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
                <ProfileCharacterPreview color={report.characterColor || characterColorOptions[0].value} />
                <div>
                  <p className="card-kicker">Daily Report</p>
                  <h2 id="daily-detail-modal-title">{displayName}</h2>
                  <small>{formatDailyDate(report.date)}</small>
                </div>
                <button
                  type="button"
                  className="daily-detail-modal-close"
                  onClick={() => setExpandedDailyReport(null)}
                  aria-label="閉じる"
                >
                  ×
                </button>
              </header>

              {report.plan ? (
                <section className="daily-detail-modal-section">
                  <h3>今日やること</h3>
                  <p>{report.plan}</p>
                </section>
              ) : null}

              {report.reflection ? (
                <section className="daily-detail-modal-section">
                  <h3>振り返り</h3>
                  <p>{report.reflection}</p>
                </section>
              ) : null}

              {!report.plan && !report.reflection ? (
                <p className="daily-detail-modal-empty">本文はまだ書かれていません。</p>
              ) : null}

              {isMine ? (
                <section className="daily-detail-modal-section">
                  <h3>この日のデータ</h3>
                  <div className="daily-detail-modal-metrics">
                    <div>
                      <small>学習時間</small>
                      <strong>{totalMinutes > 0 ? formatStudyTimeJa(totalMinutes) : "—"}</strong>
                    </div>
                    <div>
                      <small>commit</small>
                      <strong>{commitCount > 0 ? commitCount : "—"}</strong>
                    </div>
                    <div>
                      <small>記録</small>
                      <strong>{logsForDay.length > 0 ? `${logsForDay.length}件` : "—"}</strong>
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
                    <p className="daily-detail-modal-empty">この日の学習ログはありません。</p>
                  )}
                </section>
              ) : (
                <p className="daily-detail-modal-empty">
                  他のメンバーの学習データはここでは表示されません。
                </p>
              )}
            </section>
          </div>
        );
      })() : null}

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
              <h2 id="recruitment-modal-title">作業部屋の募集を投稿</h2>
              <p className="recruitment-modal-help">
                {selectedRoom ? (
                  <>
                    部屋: <strong>{selectedRoom.name}</strong> / 作業: <strong>{workspaceTask.trim() || "(作業内容を入力してください)"}</strong>
                  </>
                ) : (
                  "作業部屋を選択してください。"
                )}
              </p>
            </div>

            <form className="settings-form recruitment-form" onSubmit={handleCreateRecruitmentSubmit}>
              <div className="recruitment-mode-toggle" role="tablist" aria-label="開始タイミング">
                <button
                  type="button"
                  role="tab"
                  aria-selected={recruitmentDraft.mode === "now"}
                  className={recruitmentDraft.mode === "now" ? "is-active" : ""}
                  onClick={() => setRecruitmentDraft((prev) => ({ ...prev, mode: "now" }))}
                >
                  今から
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={recruitmentDraft.mode === "scheduled"}
                  className={recruitmentDraft.mode === "scheduled" ? "is-active" : ""}
                  onClick={() => setRecruitmentDraft((prev) => ({ ...prev, mode: "scheduled" }))}
                >
                  予約
                </button>
              </div>

              {recruitmentDraft.mode === "scheduled" ? (
                <label className="recruitment-field">
                  <span>開始時刻</span>
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
                <span>想定時間</span>
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
                <span>メッセージ (任意, 140字)</span>
                <textarea
                  value={recruitmentDraft.message}
                  onChange={(event) =>
                    setRecruitmentDraft((prev) => ({ ...prev, message: event.target.value }))
                  }
                  placeholder="一緒にやりませんか"
                  maxLength={140}
                  rows={3}
                />
                <small>{recruitmentDraft.message.length}/140</small>
              </label>

              {recruitmentError ? <p className="log-post-error">{recruitmentError}</p> : null}

              <div className="recruitment-modal-actions">
                <button type="button" className="learning-cancel-button" onClick={handleCloseRecruitmentModal}>
                  キャンセル
                </button>
                <button type="submit" className="learning-save-button">
                  投稿する
                </button>
              </div>
            </form>
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
            <div>
              <p className="card-kicker">{isOnboardingSettings ? "Welcome Setup" : "Settings"}</p>
              <h2 id="settings-title">プロフィール設定</h2>
              {isOnboardingSettings ? (
                <p className="onboarding-settings-copy">
                  Contribution Arcで使う名前とユーザーIDを設定してください。ユーザーIDはフレンド申請やプロフィール表示に使います。
                </p>
              ) : null}
            </div>

            <form className="settings-form" onSubmit={handleSettingsSubmit}>
              <div className="settings-avatar-field">
                <span className="settings-avatar-preview">
                  {playerAvatar ? <img src={playerAvatar} alt="" /> : playerInitial}
                </span>
                <div className="settings-avatar-actions">
                  <label>
                    写真を選択
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                  {playerAvatar ? (
                    <button type="button" onClick={handleAvatarRemove}>
                      削除
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="settings-character-color-panel">
                <div className="settings-character-color-head">
                  <span>分身キャラクター</span>
                  <ProfileCharacterPreview
                    color={playerCharacterColor}
                    variant="simple"
                    shape={playerCharacterShape}
                  />
                </div>

                <div className="character-customize-section compact">
                  <p className="character-customize-section-label">シルエット</p>
                  <div className="character-shape-grid compact" aria-label="キャラクターの形">
                    {characterShapeOptions.map((option) => {
                      const isLocked = !ownedCharacterShapes.includes(option.value);
                      return (
                        <button
                          type="button"
                          key={option.value}
                          className={`${playerCharacterShape === option.value ? "active " : ""}${
                            isLocked ? "is-locked" : ""
                          }`}
                          onClick={() => {
                            if (isLocked) {
                              setIsSettingsOpen(false);
                              setCurrentView("shop");
                            } else {
                              setPlayerCharacterShape(option.value);
                            }
                          }}
                          title={isLocked ? `${option.name}（ショップで購入）` : option.name}
                          aria-label={
                            isLocked
                              ? `${option.name}はショップで購入できます`
                              : `${option.name}を選択`
                          }
                        >
                          <span
                            className={`character-shape-swatch shape-${option.value}`}
                            style={{ "--actor-color": playerCharacterColor } as CSSProperties}
                          >
                            {option.value === "owl" ? (
                              <>
                                <span className="swatch-owl-beak" />
                                <span className="swatch-owl-foot swatch-owl-foot-left" />
                                <span className="swatch-owl-foot swatch-owl-foot-right" />
                              </>
                            ) : null}
                          </span>
                          {isLocked ? (
                            <span className="character-shape-lock" aria-hidden="true">
                              🔒
                            </span>
                          ) : null}
                          <small>{option.name}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="character-customize-section compact">
                  <p className="character-customize-section-label">カラー</p>
                  <div className="character-color-grid compact" aria-label="分身カラー">
                    {characterColorOptions.map((color) => (
                      <button
                        type="button"
                        key={color.value}
                        className={playerCharacterColor === color.value ? "active" : ""}
                        onClick={() => setPlayerCharacterColor(color.value)}
                        title={color.name}
                        aria-label={`${color.name}を選択`}
                      >
                        <span style={{ background: color.value }} />
                        <small>{color.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-theme-panel" role="group" aria-label="テーマ">
                <span className="settings-theme-label">テーマ</span>
                <div className="settings-theme-toggle">
                  <button
                    type="button"
                    className={theme === "dark" ? "active" : ""}
                    onClick={() => setTheme("dark")}
                    aria-pressed={theme === "dark"}
                  >
                    ダーク
                  </button>
                  <button
                    type="button"
                    className={theme === "light" ? "active" : ""}
                    onClick={() => setTheme("light")}
                    aria-pressed={theme === "light"}
                  >
                    ライト
                  </button>
                </div>
              </div>

              <div className="settings-zoom-panel" role="group" aria-label="表示サイズ">
                <div className="settings-zoom-head">
                  <span className="settings-theme-label">表示サイズ</span>
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
                    aria-label="表示を小さくする"
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
                    aria-label="表示サイズスライダー"
                  />
                  <button
                    type="button"
                    className="settings-zoom-step"
                    onClick={() =>
                      setUiScale((v) =>
                        Math.min(UI_SCALE_MAX, Math.round((v + 0.05) * 100) / 100),
                      )
                    }
                    aria-label="表示を大きくする"
                    disabled={uiScale >= UI_SCALE_MAX - 1e-6}
                  >
                    ＋
                  </button>
                </div>
              </div>

              <label>
                <span>ユーザーネーム</span>
                <input
                  value={draftUserName}
                  onChange={(event) => setDraftUserName(event.target.value)}
                  placeholder="表示したい名前"
                  maxLength={24}
                  autoFocus
                />
              </label>

              <label>
                <span>ユーザーID</span>
                <input
                  value={draftUserId}
                  onChange={(event) => setDraftUserId(event.target.value.toLowerCase())}
                  placeholder="ari.dev"
                  maxLength={30}
                  required
                />
                {isOnboardingSettings ? <small>小文字の半角英数字、_、. が使えます。</small> : null}
              </label>

              {!isOnboardingSettings ? (
                <fieldset className="desktop-notification-settings">
                  <legend>Mac通知</legend>
                  {([
                    ["dailyLog", "日報通知"],
                    ["post", "投稿通知"],
                    ["friendRequest", "フレンド申請通知"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
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
                    <span>通知音</span>
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
                      <span>通知音量</span>
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
                    通知音をテスト
                  </button>
                </fieldset>
              ) : null}

              {settingsError ? <p className="settings-error">{settingsError}</p> : null}

              <div className="settings-actions">
                {!isOnboardingSettings ? (
                  <button type="button" className="settings-secondary" onClick={() => setIsSettingsOpen(false)}>
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="settings-primary" disabled={isSavingSettings}>
                  {isSavingSettings ? "Saving..." : isOnboardingSettings ? "Contribution Arcを始める" : "Save"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isSearchOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="user-search-modal" role="dialog" aria-modal="true" aria-labelledby="user-search-title">
            <div className="user-search-head">
              <div>
                <p className="card-kicker">User Search</p>
                <h2 id="user-search-title">ユーザーを探す</h2>
              </div>
              <button
                type="button"
                className="search-close-button"
                onClick={() => setIsSearchOpen(false)}
                aria-label="ユーザー検索を閉じる"
              >
                ×
              </button>
            </div>

            <form className="user-search-form" onSubmit={handleUserSearch}>
              <label>
                <span>ユーザーID</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value.toLowerCase())}
                  placeholder="ari.dev"
                  maxLength={30}
                  autoFocus
                />
              </label>
              <button type="submit" disabled={isSearching}>
                {isSearching ? "Searching" : "Search"}
              </button>
            </form>

            {!userId ? (
              <p className="search-note">フォロー機能を使うには、設定から自分のユーザーIDを登録してください。</p>
            ) : null}
            {searchError ? <p className="settings-error">{searchError}</p> : null}

            <div className="user-search-results">
              {searchResults.map((profile) => {
                const isFriend = friends.some((friend) => friend.uid === profile.uid);
                const isPending = friendRequests.some(
                  (request) =>
                    request.profile.uid === profile.uid &&
                    request.status === "pending" &&
                    (request.direction === "outgoing" || request.direction === "incoming"),
                );
                return (
                  <article key={profile.uid} className="user-result-card">
                    <button type="button" className="user-result-profile" onClick={() => handleUserProfileOpen(profile)}>
                      <span className="user-result-avatar">
                      {profile.photoURL ? <img src={profile.photoURL} alt="" /> : profile.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong>{profile.displayName}</strong>
                        <small>@{profile.userId}</small>
                      </span>
                    </button>
                    <button type="button" onClick={() => handleFriendRequest(profile)} disabled={isFriend || isPending}>
                      {isFriend ? "Friends" : isPending ? "Pending" : "Request"}
                    </button>
                  </article>
                );
              })}
            </div>
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
                <span>作業内容</span>
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
                <legend>記録カラー</legend>
                <div className="workspace-start-colors">
                  {studyColorOptions.map((color) => (
                    <label key={color.value} title={color.name}>
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
                  Cancel
                </button>
                <button type="submit">作業を始める</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <div className="two-pane-shell">
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
              title="日報 — 1日のはじまりと締めくくり"
              body="その日の計画と振り返りを残すと、明日の自分への布石になります。"
              bullets={[
                "「計画」欄に朝の予定を、「振り返り」欄に夜の感想を書きます",
                "保存は自動。書きかけのまま画面を離れても消えません",
                "他の人の日報もここから読めて、刺激を受けられます",
                "編集できるのは当日と前日まで(過去の自分に向き合うため)",
              ]}
            />
          ) : null}
          <section className="daily-editor-card">
            <div className="daily-editor-head">
              <div>
                <p className="card-kicker">Daily Report</p>
              </div>
              <label>
                <span>日付</span>
                <input
                  type="date"
                  value={selectedDailyDate}
                  onChange={(event) => handleDailyDateChange(event.target.value)}
                />
              </label>
            </div>

            {!canEditSelectedDailyReport ? (
              <p className="daily-edit-note">日報の編集は当日または1日前までです。</p>
            ) : null}

            <div className="daily-editor-form">
              <form className="daily-entry-card" onSubmit={(event) => handleDailyReportSectionSubmit(event, "plan")}>
                <label>
                  <span>今日やること</span>
                  <textarea
                    value={dailyPlanDraft}
                    onChange={(event) => setDailyPlanDraft(event.target.value)}
                    placeholder="今日進める業務、確認すること、優先順位など"
                    rows={7}
                    disabled={!canEditSelectedDailyReport}
                  />
                </label>

                <div className="daily-editor-actions">
                  <button type="submit" disabled={isSavingDailyReport || !canEditSelectedDailyReport}>
                    {isSavingDailyReport ? "保存中" : selectedDailyReport?.plan ? "今日やることを更新" : "今日やることを送信"}
                  </button>
                </div>
              </form>

              <form
                className="daily-entry-card"
                onSubmit={(event) => handleDailyReportSectionSubmit(event, "reflection")}
              >
                <label>
                  <span>振り返り</span>
                  <textarea
                    value={dailyReflectionDraft}
                    onChange={(event) => setDailyReflectionDraft(event.target.value)}
                    placeholder="できたこと、詰まったこと、明日に回すことなど"
                    rows={7}
                    disabled={!canEditSelectedDailyReport}
                  />
                </label>

                <div className="daily-editor-actions">
                  <button type="submit" disabled={isSavingDailyReport || !canEditSelectedDailyReport}>
                    {isSavingDailyReport ? "保存中" : selectedDailyReport?.reflection ? "振り返りを更新" : "振り返りを送信"}
                  </button>
                </div>
              </form>
              {dailyMessage ? <p className="daily-message">{dailyMessage}</p> : null}
            </div>
          </section>

          <aside className="daily-history-card">
            <div className="daily-history-head">
              <p className="card-kicker">History</p>
              <strong>{filteredDailyReports.length}/{dailyReports.length} days</strong>
            </div>
            <div className="daily-history-filters" aria-label="過去の日報を絞り込む">
              <label>
                <span>日付</span>
                <input
                  type="date"
                  value={dailyHistoryDateFilter}
                  onChange={(event) => setDailyHistoryDateFilter(event.target.value)}
                />
              </label>
              <label>
                <span>検索</span>
                <input
                  type="search"
                  value={dailyHistorySearch}
                  onChange={(event) => setDailyHistorySearch(event.target.value)}
                  placeholder="本文・日付から探す"
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
                  クリア
                </button>
              ) : null}
            </div>
            <div className="daily-history-list">
              {filteredDailyReports.length > 0 ? (
                filteredDailyReports.slice(0, 20).map((report) => (
                  <article
                    key={report.id}
                    className={report.date === selectedDailyDate ? "active" : ""}
                  >
                    <button type="button" onClick={() => handleDailyDateChange(report.date)}>
                      <strong>{formatDailyDate(report.date)}</strong>
                      <span>{report.plan || "今日やることは未入力"}</span>
                      <small>{report.reflection ? "振り返り済み" : "振り返り未入力"}</small>
                    </button>
                    <button
                      type="button"
                      className="daily-delete-button"
                      onClick={() => handleDailyReportDelete(report)}
                    >
                      削除
                    </button>
                  </article>
                ))
              ) : dailyReports.length > 0 ? (
                <p>一致する日報はありません。</p>
              ) : (
                <p>まだ日報はありません。</p>
              )}
            </div>

            <div className="daily-shared-feed" aria-label="みんなの日報">
              <div className="daily-history-head">
                <p className="card-kicker">Team Daily</p>
                <strong>{visibleSharedDailyReports.length}</strong>
              </div>
              {visibleSharedDailyReports.length > 0 ? (
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
                          aria-label={`${displayName}の${formatDailyDate(report.date)}の日報を開く`}
                        >
                          <div>
                            <ProfileCharacterPreview
                              color={report.characterColor || characterColorOptions[0].value}
                              variant="simple"
                            />
                            <span>
                              <strong>{displayName}</strong>
                              <small>{formatDailyDate(report.date)}</small>
                            </span>
                          </div>
                          {report.plan ? (
                            <p className="daily-shared-section">
                              <strong>今日やること</strong>
                              <span>{report.plan}</span>
                            </p>
                          ) : null}
                          {report.reflection ? (
                            <p className="daily-shared-section">
                              <strong>振り返り</strong>
                              <span>{report.reflection}</span>
                            </p>
                          ) : null}
                        </button>
                        {isMine ? (
                          <button
                            type="button"
                            className="daily-delete-button"
                            onClick={() => handleDailyReportDelete(report)}
                          >
                            削除
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="daily-shared-empty">共有された日報はまだありません。</p>
              )}
            </div>
          </aside>
        </motion.section>
      ) : currentView === "learning" ? (
        <motion.section
          className="learning-screen"
          aria-label="記録する"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          {currentUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="learning"
              title="記録する — 学びの時間を積み上げる中心"
              body="勉強・読書・アウトプットの時間を残すと、ホームのグラフに反映されます。"
              bullets={[
                "「学習対象」をジャンルと色で登録(例: React=青、英語=橙)",
                "時間を入力すると、その分だけ Effort EXP が貯まります",
                "ページ数を持つ本タイプは「現在ページ / 総ページ」も追えます",
                "使わなくなった対象はアーカイブ。記録は残ります",
              ]}
            />
          ) : null}
          <header className="learning-header">
            <div>
              <p className="card-kicker">Learning Items</p>
              <h2>📚 記録する</h2>
              <small>学習対象を登録しておくと、ログ入力時にブレずに集計できる。</small>
            </div>
            <button type="button" className="learning-add-button" onClick={() => openLearningEditorForCreate("")}>
              + 追加
            </button>
          </header>

          <div className="learning-controls">
            <div className="learning-tabs" role="tablist">
              {(
                [
                  { value: "all" as const, label: "すべて" },
                  { value: "book" as const, label: "書籍" },
                  { value: "archived" as const, label: "アーカイブ" },
                ]
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  className={learningCategoryTab === tab.value ? "active" : ""}
                  onClick={() => setLearningCategoryTab(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              className="learning-search"
              type="search"
              placeholder="名前で検索"
              value={learningSearchQuery}
              onChange={(event) => setLearningSearchQuery(event.target.value)}
            />
          </div>

          {(() => {
            const lowerQuery = learningSearchQuery.trim().toLowerCase();
            const filtered = learningItems
              .filter((item) => {
                if (learningCategoryTab === "archived") {
                  return item.archived;
                }
                if (item.archived) return false;
                if (learningCategoryTab === "book") return item.category === "book";
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
            studyLogs.forEach((log) => {
              if (!log.learningItemId) return;
              totalsByItem.set(
                log.learningItemId,
                (totalsByItem.get(log.learningItemId) || 0) + log.minutes,
              );
              const ts = new Date(log.createdAt).getTime();
              if (!Number.isFinite(ts)) return;
              const prevLast = lastLoggedByItem.get(log.learningItemId) || 0;
              if (ts > prevLast) lastLoggedByItem.set(log.learningItemId, ts);
              if (ts >= sparkStartMs) {
                const dayIndex = Math.min(6, Math.max(0, Math.floor((ts - sparkStartMs) / dayMs)));
                const arr = sparklineByItem.get(log.learningItemId) || new Array(7).fill(0);
                arr[dayIndex] += log.minutes;
                sparklineByItem.set(log.learningItemId, arr);
              }
            });

            // Sort priority:
            //   1. Recently logged items float to the top so the user sees
            //      what they're currently working on.
            //   2. Among items with the same "never logged" state (no logs
            //      at all), fall back to total minutes — keeps big dormant
            //      projects above brand-new empty ones.
            //   3. Finally createdAt desc so newest-added wins ties.
            const sorted = filtered.slice().sort((a, b) => {
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
                  <p>学習対象を追加して、学習時間を記録しよう。</p>
                  {showSuggestions ? (
                    <div className="learning-empty-suggestions" aria-label="よく使われる学習対象">
                      {["React", "TypeScript", "英語", "読書", "アルゴリズム"].map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="learning-suggestion-chip"
                          onClick={() => openLearningEditorForCreate(name)}
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" className="learning-add-button" onClick={() => openLearningEditorForCreate("")}>
                    + 追加
                  </button>
                </div>
              );
            }

            return (
              <div className="learning-grid">
                {sorted.map((item) => {
                  const minutes = totalsByItem.get(item.id) || 0;
                  const totalLabel = formatStudyTimeJa(minutes);
                  const isBook = item.category === "book";
                  const hasProgress =
                    isBook && typeof item.totalPages === "number" && item.totalPages > 0;
                  const progressPercent = hasProgress
                    ? Math.min(100, Math.round(((item.currentPages || 0) / (item.totalPages || 1)) * 100))
                    : 0;
                  const lastTs = lastLoggedByItem.get(item.id);
                  const lastLabel = formatLearningLastLogged(lastTs, todayMidnight.getTime(), dayMs);
                  const isFreshToday = !!lastTs && lastTs >= todayMidnight.getTime();
                  const sparkline = sparklineByItem.get(item.id);
                  const sparklineMax = sparkline
                    ? sparkline.reduce((acc, value) => (value > acc ? value : acc), 0)
                    : 0;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className="learning-card"
                      style={{ "--learning-card-color": item.color } as CSSProperties}
                      onClick={() => openLearningEditorForEdit(item)}
                    >
                      <div className="learning-card-head">
                        {isBook ? (
                          <span className="learning-card-badge" aria-hidden="true">
                            📕
                          </span>
                        ) : null}
                        <strong>{item.name}</strong>
                      </div>
                      <div className="learning-card-meta">
                        <span>累計 {totalLabel}</span>
                        <span
                          className={`learning-card-last${isFreshToday ? " is-fresh" : ""}${
                            !lastTs ? " is-untouched" : ""
                          }`}
                        >
                          {lastLabel}
                        </span>
                        {item.archived ? <span className="learning-card-archived">アーカイブ</span> : null}
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
                    </button>
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
          {currentUser ? (
            <TutorialHint
              uid={currentUser.uid}
              feature="logs"
              title="みんなの記録 — 仲間の積み上げが流れる場所"
              body="他のユーザーが今日何をしているかをタイムラインで追えます。"
              bullets={[
                "投稿に❤︎ で応援、返信で対話",
                "「Following / All」タブで自分のフォロー先だけに絞れます",
                "気になる人をフォローすると、その人の投稿が優先で流れる",
                "あなたの学習を投稿すると、誰かの励みになります",
              ]}
            />
          ) : null}
      {contributionArcCardSection}

          <section className="today-strip" aria-label="今日の足場">
            <div className="today-strip-stat">
              <span className="today-strip-label">今日</span>
              <span className="today-strip-value">{formatStudyTimeJa(todayStudyMinutes)}</span>
            </div>
            <div className="today-strip-divider" aria-hidden="true" />
            <div className="today-strip-stat">
              <span className="today-strip-label">今週</span>
              <span className="today-strip-value">{formatStudyTimeJa(totalWeeklyMinutes)}</span>
            </div>
            {lastStudyLog ? (
              <>
                <div className="today-strip-divider" aria-hidden="true" />
                <div className="today-strip-stat today-strip-recent">
                  <span className="today-strip-label">最後に学んだ</span>
                  <span className="today-strip-value today-strip-recent-subject">{lastStudyLog.subject}</span>
                </div>
              </>
            ) : null}
            {todayStudyMinutes > 0 ? (
              <button
                type="button"
                className="today-strip-share"
                onClick={() => setIsShareToXOpen(true)}
                aria-label="今日の作業時間をXでシェア"
              >
                Xでシェア
              </button>
            ) : null}
          </section>

          <section className="log-composer-card">
            <div className="log-composer-head">
              <div>
                <p className="card-kicker">Timeline</p>
                <h2>今日の学びを共有する</h2>
              </div>
              <span>{visibleTimelinePosts.length.toLocaleString()} logs</span>
            </div>

            <form className="log-composer" onSubmit={handlePostSubmit}>
              <ProfileCharacterPreview color={playerCharacterColor} variant="simple" />
              <div>
                <textarea
                  value={postDraft}
                  onChange={(event) => {
                    setPostDraft(event.target.value);
                    setPostError("");
                  }}
                  placeholder="What are you building tonight?"
                  maxLength={280}
                  rows={4}
                />
                <div className="log-composer-footer">
                  <div className="log-compose-shortcuts">
                    <button type="button" onClick={useRoomPresenceAsPost}>
                      Roomから作成
                    </button>
                    <button type="button" onClick={useLatestStudyLogAsPost}>
                      学習ログから作成
                    </button>
                  </div>
                  <span>{postDraft.length}/280</span>
                  <button type="submit" disabled={isPosting || !postDraft.trim()}>
                    {isPosting ? "Posting" : "投稿"}
                  </button>
                </div>
                {postError ? <p className="log-post-error">{postError}</p> : null}
                {replyError ? <p className="log-post-error">{replyError}</p> : null}
              </div>
            </form>
          </section>

          <div className="logs-layout">
            <section className="log-timeline" aria-label="開発ログタイムライン">
              <div className="timeline-filter-tabs" role="tablist" aria-label="タイムラインの表示範囲">
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
                  <strong>フォロー中のログはまだありません。</strong>
                  <span>気になるエンジニアをフォローすると、ここに学びが流れます。Allタブで全員のログを見ることもできます。</span>
                </article>
              ) : (
                <article className="log-empty-card">
                  <p className="card-kicker">Quiet Progress</p>
                  <strong>まだログはありません。</strong>
                  <span>今日作っているもの、学んだこと、commitしたことを静かに共有できます。</span>
                </article>
              )}
            </section>

            <aside className="log-side-panel" aria-label="Room logs">
              <div>
                <p className="card-kicker">Current Room</p>
                <strong>{selectedRoom?.name || "作業部屋"}</strong>
                <span>{roomOnlineCount} online · {formatStudyTimeJa(roomTotalMinutes)}</span>
              </div>
              <div className="room-log-preview">
                <p className="card-kicker">このRoomの最近の投稿</p>
                {selectedRoomPosts.length > 0 ? (
                  selectedRoomPosts.map((post) => postCard(post, "compact"))
                ) : (
                  <span>このRoomのログはまだありません。</span>
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
              title="プロフィール — あなたの足跡と設定"
              body="積み上げの累計と、見た目・連携の設定をここでまとめます。"
              bullets={[
                "キャラクターの色を変えて、作業部屋での自分を識別しやすく",
                "GitHub を連携すると、commit が学習グラフに重なります",
                "「決意」欄に短い宣言を書いておくと、毎日の起動時に思い出せます",
                "あなたのユーザーID (@xxx) は他の人があなたを検索する手掛かり",
              ]}
            />
          ) : null}
          <div className="profile-topbar">
            <button type="button" onClick={handleProfileBack}>
              ← ホーム
            </button>
          </div>

          <div className="profile-layout">
            {profileMember ? (
              memberProfileCard(profileMember)
            ) : profileUser ? (
              userProfileCard(profileUser)
            ) : (
              <>
                {playerStatusCard(false)}

                <div className="profile-panel-stack">
                  <article className="card hours-card weekly-card is-compact">
                    <div className="section-heading compact">
                      <div>
                        <p className="card-kicker">学習ログ</p>
                        <p className="study-total">今週 {formatStudyTimeJa(totalWeeklyMinutes)}</p>
                      </div>
                      <span className="soft-pill">7日間</span>
                    </div>

                    <div className="bar-chart" aria-label="直近7日間の学習時間">
                      {weeklyStudyHours.map((item, index) => {
                        const segments = getStudySegments(item.logs, learningItems);

                        return (
                          <div
                            className={[
                              "bar-item",
                              item.isToday ? "today" : "",
                              selectedStudyDayData?.day === item.day ? "selected" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={item.day}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedStudyDay(item.day)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedStudyDay(item.day);
                              }
                            }}
                            aria-label={`${item.day}曜日の学習詳細を表示`}
                          >
                            <div
                              className="bar-shell"
                              style={
                                {
                                  "--bar-height": segments.length
                                    ? `${Math.max((item.totalMinutes / maxStudyMinutes) * 100, 4)}%`
                                    : "0%",
                                } as CSSProperties
                              }
                            >
                              {segments.length > 0 ? (
                                <motion.div
                                  className="bar-stack"
                                  initial={{ scaleY: 0, opacity: 0.62, filter: "blur(2px)" }}
                                  animate={{ scaleY: 1, opacity: 1, filter: "blur(0px)" }}
                                  transition={{
                                    delay: 0.12 + index * 0.075,
                                    type: "spring",
                                    stiffness: 92,
                                    damping: 18,
                                    mass: 0.82,
                                  }}
                                  style={{ transformOrigin: "bottom center" }}
                                >
                                  {segments.map((segment) => (
                                    <motion.span
                                      key={segment.key}
                                      title={`${segment.subject} ${formatStudyTime(segment.minutes)}`}
                                      initial={{ opacity: 0.58 }}
                                      animate={{ opacity: 1 }}
                                      transition={{
                                        delay: 0.24 + index * 0.075,
                                        duration: 0.42,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                      style={
                                        {
                                          "--segment-ratio": `${(segment.minutes / item.totalMinutes) * 100}%`,
                                          "--bar-color": segment.color,
                                        } as CSSProperties
                                      }
                                    />
                                  ))}
                                </motion.div>
                              ) : null}
                            </div>
                            <div className="bar-tooltip" role="tooltip">
                              <div>
                                <strong>
                                  {item.dateLabel}（{item.day}）
                                </strong>
                                <span>{formatStudyTimeJa(item.totalMinutes)} 学習</span>
                              </div>
                              <p>{getSubjectSummary(item.logs)}</p>
                              <small>+{Math.round(item.hours * 80)} EXP</small>
                            </div>
                            <strong>{item.day}</strong>
                            <small>{item.totalMinutes > 0 ? formatStudyTime(item.totalMinutes) : "0h"}</small>
                          </div>
                        );
                      })}
                    </div>

                    <div className="progress-console">
                      <form className="study-form" onSubmit={handleStudySubmit}>
                        <label className="study-subject-field">
                          <span>学習内容</span>
                          {(() => {
                            const activeItems = learningItems.filter((item) => !item.archived);
                            const recentItemIds: string[] = [];
                            for (let logIdx = studyLogs.length - 1; logIdx >= 0 && recentItemIds.length < 3; logIdx--) {
                              const logItemId = studyLogs[logIdx].learningItemId;
                              if (logItemId && !recentItemIds.includes(logItemId) && activeItems.some((item) => item.id === logItemId)) {
                                recentItemIds.push(logItemId);
                              }
                            }
                            const recentChips = recentItemIds
                              .map((id) => activeItems.find((item) => item.id === id))
                              .filter((item): item is LearningItem => Boolean(item));
                            const trimmedSubject = studySubject.trim();
                            const matchedItem = activeItems.find(
                              (item) => item.name.toLowerCase() === trimmedSubject.toLowerCase(),
                            );
                            const showGhostHint = trimmedSubject.length > 0 && !matchedItem;
                            return (
                              <>
                                {recentChips.length > 0 ? (
                                  <div className="study-subject-chips" aria-label="最近使った学習対象">
                                    {recentChips.map((item) => (
                                      <button
                                        type="button"
                                        key={item.id}
                                        className={matchedItem?.id === item.id ? "active" : ""}
                                        onClick={() => {
                                          setStudySubject(item.name);
                                          setStudyColor(item.color);
                                        }}
                                        style={{ "--chip-color": item.color } as CSSProperties}
                                      >
                                        {item.name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                                <input
                                  value={studySubject}
                                  onChange={(event) => setStudySubject(event.target.value)}
                                  placeholder="Java / React / 資格勉強"
                                  list="learning-items-datalist"
                                />
                                <datalist id="learning-items-datalist">
                                  {activeItems.map((item) => (
                                    <option key={item.id} value={item.name} />
                                  ))}
                                </datalist>
                                {showGhostHint ? (
                                  <button
                                    type="button"
                                    className="subject-ghost-hint"
                                    onClick={() => openLearningEditorForCreate(trimmedSubject)}
                                  >
                                    + 「{trimmedSubject}」を記録に追加
                                  </button>
                                ) : null}
                              </>
                            );
                          })()}
                        </label>
                        <label>
                          <span>時間</span>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={studyAmount}
                            onChange={(event) => setStudyAmount(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>単位</span>
                          <select
                            value={studyUnit}
                            onChange={(event) => setStudyUnit(event.target.value as "hours" | "minutes")}
                          >
                            <option value="hours">h</option>
                            <option value="minutes">m</option>
                          </select>
                        </label>
                        <fieldset className="study-color-field">
                          <legend>カラー</legend>
                          <div className="study-color-options">
                            {studyColorOptions.map((color) => (
                              <label key={color.value} title={color.name}>
                                <input
                                  type="radio"
                                  name="study-color"
                                  value={color.value}
                                  checked={studyColor === color.value}
                                  onChange={(event) => setStudyColor(event.target.value)}
                                />
                                <span style={{ background: color.value }} />
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <button type="submit">記録 +EXP</button>
                      </form>

                      {selectedStudyDayData ? (
                        <div className="study-day-detail" aria-label={`${selectedStudyDayData.day}曜日の学習詳細`}>
                          <div className="study-day-detail-head">
                            <div>
                              <p className="card-kicker">{selectedStudyDayData.dateLabel}（{selectedStudyDayData.day}）</p>
                              <strong>{formatStudyTimeJa(selectedStudyDayData.totalMinutes)} 学習</strong>
                            </div>
                            <span>+{Math.round(selectedStudyDayData.hours * 80)} EXP</span>
                          </div>

                          {selectedStudyDayData.logs.length > 0 ? (
                            <div className="study-day-detail-list">
                              {selectedStudyDayData.logs.map((log) => (
                                <article key={log.id}>
                                  <span>
                                    <i style={{ background: log.color || studyColorOptions[0].value }} />
                                    <b>{log.subject}</b>
                                  </span>
                                  <strong>{formatStudyTime(log.minutes)}</strong>
                                  <button
                                    type="button"
                                    className="study-log-delete-button"
                                    onClick={() => handleStudyLogDelete(log.id)}
                                    aria-label={`${log.subject}の学習記録を削除`}
                                  >
                                    削除
                                  </button>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="study-day-empty">この日の学習記録はまだありません</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                  <article className="card character-color-card">
                    <div className="character-color-head">
                      <div>
                        <p className="card-kicker">分身キャラクター</p>
                        <h3>形とカラーをカスタマイズ</h3>
                      </div>
                      <ProfileCharacterPreview
                        color={playerCharacterColor}
                        variant="simple"
                        shape={playerCharacterShape}
                      />
                    </div>

                    <div className="character-customize-section">
                      <p className="character-customize-section-label">シルエット</p>
                      <div className="character-shape-grid" aria-label="キャラクターの形">
                        {characterShapeOptions.map((option) => {
                          const isLocked = !ownedCharacterShapes.includes(option.value);
                          return (
                            <button
                              type="button"
                              key={option.value}
                              className={`${playerCharacterShape === option.value ? "active " : ""}${
                                isLocked ? "is-locked" : ""
                              }`}
                              onClick={() => {
                                if (isLocked) {
                                  setCurrentView("shop");
                                } else {
                                  setPlayerCharacterShape(option.value);
                                }
                              }}
                              title={isLocked ? `${option.name}（ショップで購入）` : option.name}
                              aria-label={
                                isLocked
                                  ? `${option.name}はショップで購入できます`
                                  : `${option.name}を選択`
                              }
                            >
                              <span
                                className={`character-shape-swatch shape-${option.value}`}
                                style={{ "--actor-color": playerCharacterColor } as CSSProperties}
                              >
                                {option.value === "owl" ? (
                                  <>
                                    <span className="swatch-owl-beak" />
                                    <span className="swatch-owl-foot swatch-owl-foot-left" />
                                    <span className="swatch-owl-foot swatch-owl-foot-right" />
                                  </>
                                ) : null}
                              </span>
                              {isLocked ? (
                                <span className="character-shape-lock" aria-hidden="true">
                                  🔒
                                </span>
                              ) : null}
                              <small>{option.name}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="character-customize-section">
                      <p className="character-customize-section-label">カラー</p>
                      <div className="character-color-grid" aria-label="分身カラー">
                        {characterColorOptions.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={playerCharacterColor === color.value ? "active" : ""}
                            onClick={() => setPlayerCharacterColor(color.value)}
                            title={color.name}
                            aria-label={`${color.name}を選択`}
                          >
                            <span style={{ background: color.value }} />
                            <small>{color.name}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="card determination-card">
                    <div>
                      <p className="card-kicker">決意</p>
                      {determination ? <p>{determination}</p> : null}
                    </div>

                    <form className="determination-form" onSubmit={handleDeterminationSubmit}>
                      <label>
                        <span>決意入力</span>
                        <textarea
                          value={draftDetermination}
                          onChange={(event) => setDraftDetermination(event.target.value)}
                          rows={4}
                        />
                      </label>
                      <button type="submit">保存</button>
                    </form>
                  </article>
                  {recentLogsCard(currentUser.uid)}
                </div>
              </>
            )}
          </div>
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
              title="作業部屋 — 同じ時間に手を動かす場所"
              body="通話なしで、気配だけを共有しながら集中作業ができる空間です。"
              bullets={[
                "「今やってること」を入力 → 入室すると 2D 部屋にあなたのキャラが現れます",
                "他の人のキャラをタップするとプロフィールが見られます",
                "「📣 募集する」で同じ時間に集まる仲間を呼べます",
                "退室すると今回の作業時間が記録され、EXP として加算されます",
              ]}
            />
          ) : null}
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("home")}>
              ← Home
            </button>
          </div>

          <section className="card silent-workspace workspace-2d-card" aria-label="Silent Workspace">
            <div className="workspace-heading">
              <div>
                <p className="card-kicker">Silent Workspace</p>
                <p>通話も雑談も主役にしない。同じ時間に手を動かしている気配だけを共有します。</p>
              </div>
              <span className="workspace-live-pill">quiet presence</span>
            </div>

            <div className="workspace-layout">
              {/* Compact room selector — pills along the top so the
                  character map below gets the full canvas. */}
              <div className="workspace-room-strip" aria-label="Workspace rooms">
                <form
                  className="workspace-room-create"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleRoomCreate();
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
                    placeholder="新しい場所"
                    maxLength={32}
                    aria-label="Roomを作成"
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
                  <button type="submit">作成</button>
                </form>

                <div className="workspace-room-pills" role="tablist" aria-label="作業部屋一覧">
                  {allWorkspaceRooms.map((room) => {
                    const isActiveRoom = room.id === selectedRoom?.id;
                    const roomMembers = room.activeMembers || [];
                    const isJoinedRoom = roomMembers.some((member) => member.userId === currentUser.uid);

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
                        onClick={() => setSelectedRoomId(room.id)}
                      >
                        <span className="workspace-room-pill-name">{room.name}</span>
                        <span className="workspace-room-pill-meta">
                          {roomMembers.length}人 · {Math.round(room.totalMinutes / 60)}h
                          {isJoinedRoom ? <em>入室中</em> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
                                aria-label="Roomタイトル"
                              />
                              <button type="submit">保存</button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoomId("");
                                  setEditingRoomName("");
                                }}
                              >
                                取消
                              </button>
                            </form>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="workspace-room-canvas-action"
                                onClick={() => startRoomTitleEdit(selectedRoom)}
                              >
                                名前変更
                              </button>
                              {isOwnRoom ? (
                                <button
                                  type="button"
                                  className="workspace-room-canvas-action danger"
                                  onClick={() => handleRoomDelete(selectedRoom.id)}
                                >
                                  解体
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })()}
                    <SilentWorkspaceRoom
                      roomName={selectedRoom.name}
                      roomDescription={getRoomDescription(selectedRoom)}
                      onlineCount={roomOnlineCount}
                      commitLabel={roomCommits.toLocaleString()}
                      members={workspaceActors}
                      currentUserId={currentUser.uid}
                      isJoined={isInSelectedRoom}
                      currentStayLabel={formatStayTime(currentStayMinutes)}
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
                      onResetPresence={resetWorkspacePresence}
                      presetMessages={workspacePresetMessages}
                      onPresetMessagesChange={setWorkspacePresetMessages}
                      onPresetMessage={handleWorkspacePresetMessage}
                      bubbleMessage={workspaceBubble}
                      presetLog={presetLog}
                      isPlayerWalking={isPlayerWalking}
                      activityItems={roomActivityItems}
                      onMemberOpen={handleMemberProfileOpen}
                      onActivityOpen={handleRoomActivityOpen}
                      lastSessionLabel={
                        lastRoomSession
                          ? `+${lastRoomSession.exp} EXP / ${formatStayTime(lastRoomSession.minutes)}を記録`
                          : ""
                      }
                      totalLearnedLabel={`${Math.round(roomTotalMinutes / 60).toLocaleString()}h learned`}
                      contributionLabel={`${roomContributions.toLocaleString()} contributions today`}
                      learningItemSuggestions={learningItems
                        .filter((item) => !item.archived)
                        .map((item) => ({ id: item.id, name: item.name, color: item.color }))}
                      recentLearningItemIds={(() => {
                        const ids: string[] = [];
                        for (let i = studyLogs.length - 1; i >= 0 && ids.length < 3; i--) {
                          const lid = studyLogs[i].learningItemId;
                          if (lid && !ids.includes(lid) && learningItems.some((item) => item.id === lid && !item.archived)) {
                            ids.push(lid);
                          }
                        }
                        return ids;
                      })()}
                      onLearningItemRegister={(presetName) => openLearningEditorForCreate(presetName)}
                      onOpenRecruitmentModal={handleOpenRecruitmentModal}
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
                            ? `🗓 ${new Date(mine.startAt).toLocaleTimeString("ja-JP", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}開始予定`
                            : "🔴 募集中",
                          joinedCount: mine.joinedUserIds.length,
                          onCancel: () => handleCancelRecruitment(mine),
                        };
                      })()}
                    />
                  </>
                ) : (
                  <div className="room-empty-detail">
                    <p className="card-kicker">Silent Workspace</p>
                    <h3>まずはRoomを作成しましょう。</h3>
                    <p>上の入力欄から、自分の集中場所を作成できます。</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </motion.section>
      ) : currentView === "shop" ? (
        <motion.section
          className="shop-screen"
          aria-label="ショップ"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
        >
          <div className="profile-topbar">
            <button type="button" onClick={() => setCurrentView("home")}>
              ← Home
            </button>
          </div>

          <section className="card shop-card" aria-label="ショップヘッダー">
            <div className="shop-card-head">
              <div>
                <p className="card-kicker">Shop</p>
                <h2>キャラクターをカスタマイズ</h2>
                <p className="shop-card-lede">
                  シルエットや姿を変えて、自分だけの分身に。所持している Arc で購入できます。
                </p>
              </div>
              <div className="shop-balance" aria-label="所持 Arc">
                <span className="shop-balance-label">所持 Arc</span>
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
            <div className="shop-feed-bonus" role="group" aria-label="投稿で Arc を貯める">
              <div className="shop-feed-bonus-head">
                <strong>投稿で Arc を貯める</strong>
                <span className="shop-feed-bonus-amount">
                  {feedRewardArcEarned} / 500 Arc
                </span>
              </div>
              <p className="shop-feed-bonus-copy">
                ログを 1 日 1 回投稿すると +50 Arc。累計 500 Arc までもらえます。
                {feedRewardArcEarned >= 500
                  ? "上限に到達しました。ありがとうございます！"
                  : lastFeedRewardDate === todayDateKey
                    ? "今日の分は受け取り済み。明日また投稿してみてください。"
                    : "今日はまだ受け取っていません。ログを投稿してみてください。"}
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

          <section className="shop-section" aria-label="シルエット">
            <header className="shop-section-head">
              <h3>シルエット</h3>
              <span>分身の姿を変える</span>
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
                        variant="simple"
                        shape={item.shape}
                      />
                    </div>
                    <div className="shop-product-body">
                      <p className="shop-product-tagline">{item.tagline}</p>
                      <h4 className="shop-product-name">{item.name}</h4>
                      <p className="shop-product-description">{item.description}</p>
                    </div>
                    <div className="shop-product-footer">
                      {isOwned ? (
                        <>
                          <span className="shop-product-owned">所持済み</span>
                          {isEquipped ? (
                            <span className="shop-product-equipped">使用中</span>
                          ) : (
                            <button
                              type="button"
                              className="shop-product-equip"
                              onClick={() => setPlayerCharacterShape(item.shape)}
                            >
                              着用する
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
                                `${item.name} を ${item.price.toLocaleString()} Arc で購入しますか？`,
                              );
                              if (!ok) return;
                              setCoins((value) => Math.max(0, value - item.price));
                              setOwnedCharacterShapes((current) =>
                                current.includes(item.shape) ? current : [...current, item.shape],
                              );
                              setPlayerCharacterShape(item.shape);
                            }}
                          >
                            {canAfford ? "購入する" : "Arc 不足"}
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
      ) : (
      <motion.div
        className="home-screen"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SNAPPY}
      >

      {currentUser ? (
        <TutorialHint
          uid={currentUser.uid}
          feature="home"
          title="ホーム — あなたの学習を一望できる場所"
          body="積み上げの全体像と、いま仲間が何をしているかをまとめて見られます。"
          bullets={[
            "13週間のコントリビューショングラフで毎日の取り組みを可視化",
            "今週の学習時間・最長連続日数・ジャンル分布をひと目で",
            "GitHub を連携すると commit もこのグラフに合流します",
            "下の「みんなの記録」「日報」もここから流れてきます",
          ]}
        />
      ) : null}

      {contributionArcCardSection}

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
              aria-label="今日の予定を立てる"
            >
              <div className="daily-plan-prompt-head">
                <div>
                  <p className="card-kicker">TODAY</p>
                  <strong>おはよう。今日は何をやる？</strong>
                  <small>{formatDailyDate(currentLearnerDate)}</small>
                </div>
                <button
                  type="button"
                  className="daily-plan-prompt-skip"
                  onClick={handleDailyPromptDismiss}
                  aria-label="今日は書かずに進む"
                  data-tooltip="今日は書かずに進む"
                >
                  スキップ
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
                  placeholder="例: DDIA Ch.7 を読み切る"
                  rows={2}
                  maxLength={400}
                />
                <div className="daily-plan-prompt-foot">
                  {dailyPromptError ? (
                    <span className="daily-plan-prompt-error">{dailyPromptError}</span>
                  ) : (
                    <span className="daily-plan-prompt-hint">
                      日報の「今日やること」として保存される。短くてもOK。
                    </span>
                  )}
                  <button
                    type="submit"
                    className="daily-plan-prompt-save"
                    disabled={isSavingDailyPrompt || !dailyPromptDraft.trim()}
                  >
                    {isSavingDailyPrompt ? "保存中" : "今日を始める"}
                  </button>
                </div>
              </form>
            </motion.section>
          );
        })()}
      </AnimatePresence>

      <section className="hero-grid" aria-label="Contribution Arc overview">
        <div className="overview-stack">
          <article className="card daily-today-card">
            <div>
              <p className="card-kicker">今日の日報</p>
              <strong>{todayDailyReport?.plan ? "今日やることあり" : "今日やることは未入力"}</strong>
              <span>{todayDailyReport?.reflection ? "振り返り済み" : "振り返りを記録"}</span>
            </div>
            <button type="button" onClick={() => setCurrentView("daily")}>
              日報を書く
            </button>
          </article>
          {/* Workspace summary card — 在室者が居るときは「気配アバター」を
              チラ見せして、自然に作業部屋へ誘導。煽らないために最大4人、
              低彩度の小さな円のみ。誰も居ない時はその領域ごと消す。 */}
          <article
            className={`card workspace-summary-card${
              activeMembers.length > 0 ? " has-live-presence" : ""
            }`}
          >
            <div>
              <p className="card-kicker">Silent Workspace</p>
              <strong>{selectedRoom?.name || "作業部屋"}</strong>
              <span>
                {isInSelectedRoom
                  ? `入室中 ${currentStayMinutes > 0 ? formatStayTime(currentStayMinutes) : ""}`
                  : activeMembers.length > 0
                    ? `今 ${activeMembers.length} 人が作業中`
                    : "今は静かです"}
              </span>
            </div>
            {activeMembers.length > 0 && !isInSelectedRoom ? (
              <div
                className="workspace-summary-presence"
                aria-hidden="true"
                title={`${activeMembers.length} 人が作業中`}
              >
                {activeMembers.slice(0, 4).map((member, index) => (
                  <span
                    className="workspace-summary-presence-avatar"
                    key={`${member.userId}-${index}`}
                    style={{
                      backgroundColor: member.color || "var(--ink-soft)",
                    }}
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt="" />
                    ) : (
                      <span>{(member.name || "?").slice(0, 1)}</span>
                    )}
                  </span>
                ))}
                {activeMembers.length > 4 ? (
                  <span className="workspace-summary-presence-more">
                    +{activeMembers.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button type="button" onClick={() => setCurrentView("workspace")}>
              {isInSelectedRoom
                ? "作業部屋へ戻る"
                : activeMembers.length > 0
                  ? "見てみる"
                  : "作業部屋へ"}
            </button>
          </article>
        </div>
      </section>

      </motion.div>
      )}

      </div>

      {/* Workspace view fills the canvas with the 2D room and its own
          presence/chat tools — overlaying the global FEED next to it
          competes for attention, makes the desktop layout cramped, and
          hides the room behind feed scroll on mobile. Hide it there. */}
      {currentView !== "workspace" ? (
        <aside className="two-pane-right" aria-label="フィード">
          {feedSection}
        </aside>
      ) : null}

      </div>
      </div>

      {/* Mobile-only bottom navigation. Visible at ≤720px (CSS-gated).
          5 primary destinations match the desktop topbar-nav so the
          mobile user never has to dig through a menu to switch views.
          Hidden on desktop and during onboarding. */}
      {currentView && onboardingStep !== "welcome" ? (
        <nav className="mobile-bottom-nav" aria-label="メインナビゲーション">
          <button
            type="button"
            className={currentView === "home" ? "is-active" : ""}
            onClick={() => setCurrentView("home")}
            aria-label="ホーム"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span>ホーム</span>
          </button>
          {/* 作業部屋を中央CTAの隣（左）に配置。親指の自然な到達位置に
              置くことで、入室への摩擦を下げる。在室者ドット + 数字も
              添えて、気配を伝える（煽り表示にならないよう極小サイズ）。*/}
          <button
            type="button"
            className={`workspace-tab${currentView === "workspace" ? " is-active" : ""}${
              activeMembers.length > 0 ? " has-presence" : ""
            }`}
            onClick={() => setCurrentView("workspace")}
            aria-label={
              activeMembers.length > 0
                ? `作業部屋 — 現在 ${activeMembers.length} 人が作業中`
                : "作業部屋"
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {activeMembers.length > 0 ? (
              <span className="mobile-tab-presence-dot" aria-hidden="true" />
            ) : null}
            <span>
              作業部屋
              {activeMembers.length > 0 ? (
                <span className="mobile-tab-presence-count" aria-hidden="true">
                  {" "}
                  · {activeMembers.length}
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`is-cta${currentView === "learning" ? " is-active" : ""}`}
            onClick={() => setCurrentView("learning")}
            aria-label="記録する"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>記録する</span>
          </button>
          <button
            type="button"
            className={currentView === "logs" ? "is-active" : ""}
            onClick={() => setCurrentView("logs")}
            aria-label="みんなの記録"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>記録</span>
          </button>
          <button
            type="button"
            className={currentView === "daily" ? "is-active" : ""}
            onClick={() => setCurrentView("daily")}
            aria-label="日報"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>日報</span>
          </button>
        </nav>
      ) : null}

      {/* Global toast host. Mounted once near the root so any handler
          can `showToast(...)` without prop-drilling. The fixed
          positioning + high z-index makes it the topmost UI surface,
          including on top of the mobile bottom nav. */}
      <ToastHost />
      <IOSInstallHint />
    </motion.main>
    </MotionConfig>
  );
}

export default App;
