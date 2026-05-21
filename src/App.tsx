import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createUserWithEmailAndPassword,
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
import { motion } from "framer-motion";
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
  savePostToCloud,
  subscribePostsFromCloud,
  togglePostLikeInCloud,
  type ContributionPostRecord,
} from "./services/posts";
import { PremiumSidebar, type AppView, type FriendPreview, type LiveActivity } from "./components/PremiumNavigation";
import { SilentWorkspaceRoom, type RoomActivityItem } from "./components/SilentWorkspaceRoom";
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
  email?: string;
  avatarUrl?: string;
  photoURL: string;
  searchName: string;
  following: string[];
  followers: string[];
  determination?: string;
  characterColor?: string;
  level?: number;
  effortExp?: number;
  outputExp?: number;
  currentTitle?: string;
  currentCharacter?: string;
  streak?: number;
  unlockedCharacters?: string[];
  characterExp?: number;
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

type RoomUser = {
  id: string;
  name: string;
  avatar?: string;
  characterColor?: string;
  x: number;
  y: number;
  currentTask: string;
  status: RoomUserStatus;
  joinedAt: string;
  activeStartedAt?: string;
  accumulatedActiveMinutes?: number;
  breakStartedAt?: string;
};

type WorkspaceMember = RoomUser & {
  userId: string;
  building: string;
  color: string;
  tone: "deep" | "green" | "soft" | "blue";
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
  seatLabels?: WorkspaceSeatLabels;
  totalMinutes: number;
  contributions: number;
  commits: number;
  createdAt: string;
  createdBy: string;
  activeMembers: WorkspaceMember[];
  history: WorkspaceSessionHistory[];
};

type WorkspaceSeatLabels = Record<string, string>;

type OnboardingStep = "idle" | "welcome" | "settings";

type RoomCreateState = "idle" | "saving" | "saved" | "offline";

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
const studyColorOptions = [
  { name: "Forest", value: "#1f6f4a" },
  { name: "Lime", value: "#83bb70" },
  { name: "Teal", value: "#2f8f83" },
  { name: "Blue", value: "#3f6f9f" },
  { name: "Violet", value: "#7667a8" },
  { name: "Gold", value: "#c8a95b" },
];

const characterColorOptions = [
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
const minaAvatarPath = "mina-icon.webp";
const detaUserId = "npc-deta";
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
const defaultWorkspaceSeatLabels: WorkspaceSeatLabels = {
  frontend: "作業",
  java: "仕事",
  deep: "休憩",
  cloud: "学習",
};
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
    id: "arc-sprout",
    name: "アークの芽",
    englishName: "Arc Sprout",
    label: "初期解放キャラクター",
    concept:
      "最初の学習記録から生まれる小さな精霊。Contributionの草と学習ログから発生したArc粒子が、まだ小さな生命体として定着した存在。",
    evolution: "アークの芽 → ログリーフ → アークブルーム → コントリビュート",
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
    email: data.email || "",
    avatarUrl: data.avatarUrl || "",
    photoURL: data.photoURL || data.avatarUrl || "",
    searchName: data.searchName || (data.displayName || "Developer").toLowerCase(),
    following: Array.isArray(data.following) ? data.following : [],
    followers: Array.isArray(data.followers) ? data.followers : [],
    determination: data.determination || "",
    characterColor: getSafeCharacterColor(data.characterColor),
    level: data.level || 1,
    effortExp: data.effortExp || 0,
    outputExp: data.outputExp || 0,
    currentTitle: data.currentTitle || "",
    currentCharacter: data.currentCharacter || characterOptions[0].id,
    streak: data.streak || 0,
    unlockedCharacters: Array.isArray(data.unlockedCharacters) ? data.unlockedCharacters : [characterOptions[0].id],
    characterExp: data.characterExp || 0,
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

function ProfileCharacterPreview({ color }: { color?: string }) {
  return (
    <div
      className="profile-character-preview"
      style={{ "--actor-color": color || characterColorOptions[0].value } as CSSProperties}
      aria-hidden="true"
    >
      <span className="actor-sprite deep">
        <span className="sprite-head" />
        <span className="sprite-body" />
        <span className="sprite-leg sprite-leg-left" />
        <span className="sprite-leg sprite-leg-right" />
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

  return (
    code.includes("permission-denied") ||
    code.includes("unavailable") ||
    message.includes("Missing or insufficient permissions")
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
  if (room.id === "deep-work-studio") {
    return "深夜でも静かに手を動かせる、Contribution Arcの基点となる開発室。";
  }

  if (room.name.toLowerCase().includes("night")) {
    return "夜の集中作業に向いた、ゆっくり流れるビルドルーム。";
  }

  return "小さく集中し、積み上げを共有するための静かな空間。";
}

function getRoomAccent(room: WorkspaceRoom) {
  if (room.id === "deep-work-studio") {
    return "studio";
  }

  if (room.name.toLowerCase().includes("night")) {
    return "night";
  }

  return "garden";
}

function getWorkspaceSeatPosition(task: string) {
  const normalizedTask = task.toLowerCase();

  if (normalizedTask.includes("java")) {
    return { x: 63, y: 47 };
  }

  if (normalizedTask.includes("aws") || normalizedTask.includes("cloud")) {
    return { x: 73, y: 69 };
  }

  if (normalizedTask.includes("deep") || normalizedTask.includes("focus")) {
    return { x: 44, y: 67 };
  }

  return { x: 30, y: 47 };
}

function createDetaMember(joinedAt: Date): WorkspaceMember {
  return createWorkspaceMember({
    id: detaUserId,
    userId: detaUserId,
    name: "deta",
    avatar: "",
    characterColor: "#1f6f4a",
    x: 30,
    y: 47,
    currentTask: "React",
    color: "#1f6f4a",
    joinedAt: joinedAt.toISOString(),
    activeStartedAt: joinedAt.toISOString(),
    accumulatedActiveMinutes: 0,
    status: "deep-work",
    tone: "green",
  });
}

function getScheduledDetaMember(nowMs: number): WorkspaceMember | null {
  const now = new Date(nowMs);
  const hour = now.getHours();

  if (hour < 6) {
    return null;
  }

  const dayStart = new Date(now);
  dayStart.setHours(6, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(24, 0, 0, 0);

  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const random = seededRandom(getStableHash(`deta-${dateKey}`));
  let cursor = dayStart.getTime() + Math.floor(random() * 90) * 60000;

  while (cursor < dayEnd.getTime()) {
    const durationMinutes = 60 + Math.floor(random() * 121);
    const sessionEnd = cursor + durationMinutes * 60000;

    if (nowMs >= cursor && nowMs < sessionEnd) {
      return createDetaMember(new Date(cursor));
    }

    const breakMinutes = 25 + Math.floor(random() * 156);
    cursor = sessionEnd + breakMinutes * 60000;
  }

  return null;
}

function isDetaLikeMember(member: Pick<WorkspaceMember, "userId" | "id" | "name">) {
  return member.userId === detaUserId || member.userId === "npc-ari" || member.id === "npc-ari" || member.name === "Ari";
}

function applyScheduledDetaPresence(room: WorkspaceRoom, nowMs: number): WorkspaceRoom {
  const activeMembers = Array.isArray(room.activeMembers) ? room.activeMembers : [];

  if (room.id !== "deep-work-studio") {
    return room;
  }

  const detaMember = getScheduledDetaMember(nowMs);
  const nextActiveMembers = activeMembers.filter((member) => member && !isDetaLikeMember(member));

  return {
    ...room,
    activeMembers: detaMember ? [detaMember, ...nextActiveMembers] : nextActiveMembers,
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

function createDefaultWorkspaceRooms(): WorkspaceRoom[] {
  const now = Date.now();

  return [
    {
      id: "deep-work-studio",
      name: "Deep Work Studio",
      totalMinutes: 1860,
      contributions: 24,
      commits: 0,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 8).toISOString(),
      createdBy: "system",
      ownerName: "Contribution Arc",
      ownerAvatar: "",
      seatLabels: defaultWorkspaceSeatLabels,
      activeMembers: [
        createWorkspaceMember({
          id: "npc-yuki",
          userId: "npc-yuki",
          name: "Yuki",
          avatar: "",
          characterColor: "#3f6f9f",
          x: 62,
          y: 47,
          currentTask: "Java",
          color: "#3f6f9f",
          joinedAt: new Date(now - 1000 * 60 * 66).toISOString(),
          activeStartedAt: new Date(now - 1000 * 60 * 66).toISOString(),
          accumulatedActiveMinutes: 0,
          status: "working",
          tone: "blue",
        }),
        createWorkspaceMember({
          id: "npc-mina",
          userId: "npc-mina",
          name: "Mina",
          avatar: minaAvatarPath,
          characterColor: "#2f8f83",
          x: 72,
          y: 69,
          currentTask: "AWS",
          color: "#2f8f83",
          joinedAt: new Date(now - 1000 * 60 * 31).toISOString(),
          activeStartedAt: new Date(now - 1000 * 60 * 31).toISOString(),
          accumulatedActiveMinutes: 0,
          status: "working",
          tone: "deep",
        }),
      ],
      history: [
        {
          id: "seed-deta-react",
          userId: detaUserId,
          userName: "deta",
          roomId: "deep-work-studio",
          roomName: "Deep Work Studio",
          task: "React",
          building: "React",
          color: "#1f6f4a",
          joinedAt: new Date(now - 1000 * 60 * 160).toISOString(),
          leftAt: new Date(now - 1000 * 60 * 100).toISOString(),
          durationMinutes: 60,
          earnedExp: getRoomSessionExp(60),
          minutes: 60,
          exp: getRoomSessionExp(60),
        },
        {
          id: "seed-mina-joined",
          userId: "npc-mina",
          userName: "Mina",
          roomId: "deep-work-studio",
          roomName: "Deep Work Studio",
          task: "Deep Work",
          building: "Deep Work",
          color: "#2f8f83",
          joinedAt: new Date(now - 1000 * 60 * 240).toISOString(),
          leftAt: new Date(now - 1000 * 60 * 210).toISOString(),
          durationMinutes: 30,
          earnedExp: getRoomSessionExp(30),
          minutes: 30,
          exp: getRoomSessionExp(30),
        },
      ],
    },
  ];
}

function seedWorkspaceRooms(rooms: WorkspaceRoom[]): WorkspaceRoom[] {
  const seedRoom = createDefaultWorkspaceRooms()[0];
  const normalizedRooms = rooms.map(normalizeWorkspaceRoom);
  const existingRoom = normalizedRooms.find((room) => room.id === seedRoom.id);

  if (!existingRoom) {
    return [seedRoom, ...normalizedRooms];
  }

  const activeIds = new Set(existingRoom.activeMembers.map((member) => member.userId));
  const missingSeedMembers = seedRoom.activeMembers.filter((member) => !activeIds.has(member.userId));
  const mergedRoom = normalizeWorkspaceRoom({
    ...existingRoom,
    activeMembers: [...missingSeedMembers, ...existingRoom.activeMembers],
    history: existingRoom.history.length > 0 ? existingRoom.history : seedRoom.history,
  });

  return [mergedRoom, ...normalizedRooms.filter((room) => room.id !== seedRoom.id)];
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
    seatLabels: {
      ...defaultWorkspaceSeatLabels,
      ...(safeRoom.seatLabels || {}),
    },
    activeMembers: activeMembers.filter(Boolean).map((member, index) => {
      const task = member.currentTask || member.building || "Deep Work";

      const isMina = member.userId === "npc-mina" || member.id === "npc-mina" || member.name === "Mina";
      const memberId = member.userId || member.id || `member-${roomId}-${index}`;

      return {
        ...member,
        id: member.id || memberId,
        userId: memberId,
        name: member.name || "Developer",
        avatar: isMina ? minaAvatarPath : member.avatar || "",
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
    seatLabels: {
      ...defaultWorkspaceSeatLabels,
      ...(normalizedRoom.seatLabels || {}),
    },
    totalMinutes: normalizedRoom.totalMinutes || 0,
    contributions: normalizedRoom.contributions || 0,
    commits: normalizedRoom.commits || 0,
    createdAt: normalizedRoom.createdAt || new Date().toISOString(),
    createdBy: normalizedRoom.createdBy || "legacy",
    activeMembers: (normalizedRoom.activeMembers || []).map((member) => ({
      ...member,
      avatar: member.userId === "npc-mina" ? member.avatar : getSerializableAvatar(member.avatar),
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

async function saveWorkspaceRoomToCloud(room: WorkspaceRoom) {
  await setDoc(
    doc(db, workspaceRoomsCollectionName, room.id),
    {
      ...serializeWorkspaceRoom(room),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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

function getStudySegments(logs: StudyLog[]): StudySegment[] {
  if (logs.length === 0) {
    return [];
  }

  const segments = logs.reduce<Record<string, StudySegment>>((acc, log) => {
    const color = log.color || studyColorOptions[0].value;
    const key = `${log.subject}-${color}`;
    acc[key] = acc[key] || {
      key,
      subject: log.subject,
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

    try {
      await signInWithPopup(auth, provider === "google" ? googleProvider : githubProvider);
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

      <section className="card login-card">
        <p className="card-kicker">Authentication</p>
        <h2>記録を始めよう。</h2>
        <p className="login-copy">
          <span>メール、Google、GitHubでログインできます。</span>
          <span className="login-copy-highlight">今日の学習ログを明日の成長へ。</span>
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
    </main>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(defaultStudyLogs);
  const [studySubject, setStudySubject] = useState("React");
  const [studyAmount, setStudyAmount] = useState("1");
  const [studyUnit, setStudyUnit] = useState<"hours" | "minutes">("hours");
  const [studyColor, setStudyColor] = useState(studyColorOptions[0].value);
  const [selectedStudyDay, setSelectedStudyDay] = useState(dayLabels[(new Date().getDay() + 6) % 7]);
  const [customUserName, setCustomUserName] = useState("");
  const [draftUserName, setDraftUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [draftUserId, setDraftUserId] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [profileMember, setProfileMember] = useState<WorkspaceMember | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [determination, setDetermination] = useState("");
  const [draftDetermination, setDraftDetermination] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [playerCharacterColor, setPlayerCharacterColor] = useState(characterColorOptions[0].value);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [customRooms, setCustomRooms] = useState<WorkspaceRoom[]>([]);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomCreateState, setRoomCreateState] = useState<RoomCreateState>("idle");
  const [roomCreateMessage, setRoomCreateMessage] = useState("");
  const [editingRoomId, setEditingRoomId] = useState("");
  const [editingRoomName, setEditingRoomName] = useState("");
  const [workspaceTask, setWorkspaceTask] = useState("React");
  const [workspaceDraftTask, setWorkspaceDraftTask] = useState("React");
  const [workspaceDraftColor, setWorkspaceDraftColor] = useState(studyColorOptions[0].value);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [workspaceNow, setWorkspaceNow] = useState(Date.now());
  const [lastRoomSession, setLastRoomSession] = useState<WorkspaceSessionHistory | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 18, y: 72 });
  const [isPlayerWalking, setIsPlayerWalking] = useState(false);
  const [workspaceBubble, setWorkspaceBubble] = useState("");
  const [workspacePresetMessages, setWorkspacePresetMessages] = useState(defaultWorkspacePresetMessages);
  const [posts, setPosts] = useState<ContributionPostRecord[]>([]);
  const [postDraft, setPostDraft] = useState("");
  const [postError, setPostError] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isDesktopWelcomeVisible, setIsDesktopWelcomeVisible] = useState(true);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData>(emptyKnowledgeGraph);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState("");
  const [hoveredKnowledgeId, setHoveredKnowledgeId] = useState("");
  const [knowledgeScale, setKnowledgeScale] = useState(1);
  const [knowledgePositions, setKnowledgePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingKnowledgeId, setDraggingKnowledgeId] = useState("");
  const pressedWorkspaceKeysRef = useRef<Set<string>>(new Set());
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
  const isApplyingRemoteRoomsRef = useRef(false);
  const lastSyncedWorkspaceRoomsRef = useRef("");
  const pendingWorkspaceRoomsRef = useRef<Map<string, WorkspaceRoom>>(new Map());
  const remoteWorkspaceRoomsRef = useRef<{ rooms: WorkspaceRoom[]; legacyRooms: WorkspaceRoom[] }>({
    rooms: [],
    legacyRooms: [],
  });
  const didRequestStudyLogMigrationRef = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      didRequestStudyLogMigrationRef.current = false;
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
      setDetermination("");
      setDraftDetermination("");
      setPlayerAvatar("");
      setPlayerCharacterColor(characterColorOptions[0].value);
      setSelectedRoomId("");
      setCustomRooms([]);
      setRoomCreateState("idle");
      setRoomCreateMessage("");
      setPendingJoinRoomId(null);
      setLastRoomSession(null);
      setWorkspaceTask("React");
      setWorkspaceDraftTask("React");
      setWorkspacePresetMessages(defaultWorkspacePresetMessages);
      setPosts([]);
      setPostDraft("");
      setPostError("");
      setIsPosting(false);
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
    setCustomRooms(seededRooms);
    if (savedRoomId && seededRooms.some((room) => room.id === savedRoomId)) {
      setSelectedRoomId(savedRoomId);
    } else if (seededRooms[0]) {
      setSelectedRoomId(seededRooms[0].id);
    } else {
      setSelectedRoomId("");
    }
    setWorkspaceTask(savedWorkspaceTask || studySubject);
    setWorkspaceDraftTask(savedWorkspaceTask || studySubject);
    setWorkspaceDraftColor(studyColorOptions[0].value);
    setWorkspacePresetMessages(
      savedWorkspacePresetMessages
        ? [
            ...(JSON.parse(savedWorkspacePresetMessages) as string[]).slice(0, 6),
            ...defaultWorkspacePresetMessages,
          ].slice(0, 6)
        : defaultWorkspacePresetMessages,
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
        if (resolvedUserId) {
          safeSetLocalStorage(`contribution-arc-user-id-${currentUser.uid}`, resolvedUserId);
          safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
          setOnboardingStep("idle");
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
    const cachedLogs = removeSeedStudyLogs(studyLogs);

    const unsubscribe = subscribeStudyLogsFromCloud(
      db,
      currentUser.uid,
      (cloudLogs) => {
        const remoteLogs = removeSeedStudyLogs(cloudLogs);

        if (remoteLogs.length > 0) {
          setStudyLogs(remoteLogs);
          handledInitialSnapshot = true;
          return;
        }

        if (!handledInitialSnapshot && cachedLogs.length > 0 && !didRequestStudyLogMigrationRef.current) {
          didRequestStudyLogMigrationRef.current = true;
          void migrateStudyLogsToCloud(db, currentUser.uid, cachedLogs).catch((error) => {
            console.info("Study log migration to cloud skipped.", error);
          });
        } else if (!handledInitialSnapshot && cachedLogs.length === 0) {
          setStudyLogs(defaultStudyLogs);
        }

        handledInitialSnapshot = true;
      },
      (error) => {
        console.info("Study log cloud sync skipped.", error);
      },
    );

    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    return subscribePostsFromCloud(
      db,
      setPosts,
      (error) => {
        console.info("Post realtime sync skipped.", error);
        setPostError("ログの読み込みを待っています。");
      },
    );
  }, [currentUser, isWorkspaceLoaded]);

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
      void saveWorkspaceRoomToCloud(room).catch((error) => {
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

    safeSetLocalStorage(
      getAccountStorageKey(accountScope, "workspace-preset-messages"),
      JSON.stringify(workspacePresetMessages.slice(0, 6)),
    );
  }, [currentUser, workspacePresetMessages, isWorkspaceLoaded, userId]);

  useEffect(() => {
    const timerId = window.setInterval(() => setWorkspaceNow(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    setCustomRooms((rooms) => cleanWorkspacePresenceForUser(rooms, currentUser.uid, workspaceNow));
  }, [currentUser, isWorkspaceLoaded, workspaceNow]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
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

      remoteRooms.forEach((room) => {
        const pendingRoom = pendingWorkspaceRoomsRef.current.get(room.id);
        if (pendingRoom && getSerializedWorkspaceRoomText(pendingRoom) === getSerializedWorkspaceRoomText(room)) {
          pendingWorkspaceRoomsRef.current.delete(room.id);
        }
      });

      setCustomRooms((currentRooms) => {
        const pendingLocalRooms = Array.from(pendingWorkspaceRoomsRef.current.values());
        const pendingLocalRoomIds = new Set(pendingLocalRooms.map((room) => room.id));
        const remoteRoomsForMerge = remoteRooms.filter((room) => !pendingLocalRoomIds.has(room.id));
        const localOnlyRooms = currentRooms.filter(
          (room) =>
            !remoteRoomIds.has(room.id) &&
            !pendingWorkspaceRoomsRef.current.has(room.id),
        );
        const hasLocalRoomsWaitingForCloud = pendingLocalRooms.length > 0 || localOnlyRooms.length > 0;
        const nextRooms = cleanWorkspacePresenceForUser(
          seedWorkspaceRooms([...remoteRoomsForMerge, ...pendingLocalRooms, ...localOnlyRooms]),
          currentUser.uid,
          Date.now(),
        );

        isApplyingRemoteRoomsRef.current = !hasLocalRoomsWaitingForCloud;
        if (!hasLocalRoomsWaitingForCloud) {
          lastSyncedWorkspaceRoomsRef.current = JSON.stringify(serializeWorkspaceRooms(nextRooms));
        }
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
  }, [currentUser, isWorkspaceLoaded]);

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

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextProfiles: Record<string, UserProfile> = {};

        snapshot.docs.forEach((item) => {
          nextProfiles[item.id] = normalizeUserProfile(item.id, item.data() as Partial<UserProfile>);
        });

        setWorkspaceProfiles(nextProfiles);
      },
      (error) => {
        console.info("Workspace profile realtime sync skipped.", error);
      },
    );

    return () => unsubscribe();
  }, [currentUser, isWorkspaceLoaded]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    const nextName =
      customUserName.trim() || currentUser.displayName || currentUser.email?.split("@")[0] || "Developer";
    const nextBuilding = workspaceTask.trim() || studySubject.trim() || "Deep work";

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
            member.characterColor === playerCharacterColor
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
  }, [currentUser, customUserName, isWorkspaceLoaded, playerAvatar, playerCharacterColor, studySubject, workspaceTask]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const selectedLocalRoom = customRooms.map(normalizeWorkspaceRoom).find((room) => room.id === selectedRoomId);
    const member = selectedLocalRoom?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!member) {
      pressedWorkspaceKeysRef.current.clear();
      setIsPlayerWalking(false);
      return;
    }

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

  useEffect(() => {
    if (!currentUser || (currentView !== "workspace" && currentView !== "home")) {
      pressedWorkspaceKeysRef.current.clear();
      setIsPlayerWalking(false);
      return;
    }

    const selectedLocalRoom = customRooms.map(normalizeWorkspaceRoom).find((room) => room.id === selectedRoomId);
    const canMove = Boolean(selectedLocalRoom?.activeMembers.some((member) => member.userId === currentUser.uid));
    if (!canMove) {
      pressedWorkspaceKeysRef.current.clear();
      setIsPlayerWalking(false);
      return;
    }

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!workspaceMovementKeys.has(key) || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      pressedWorkspaceKeysRef.current.add(key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!workspaceMovementKeys.has(key)) {
        return;
      }

      event.preventDefault();
      pressedWorkspaceKeysRef.current.delete(key);
    };

    let frameId = 0;
    const tick = () => {
      const keys = pressedWorkspaceKeysRef.current;
      const dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const isMoving = dx !== 0 || dy !== 0;

      setIsPlayerWalking(isMoving);
      if (isMoving) {
        const length = Math.hypot(dx, dy) || 1;
        setPlayerPosition((position) => ({
          x: clampNumber(position.x + (dx / length) * 0.42, 7, 93),
          y: clampNumber(position.y + (dy / length) * 0.42, 14, 88),
        }));
      }

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
      setIsPlayerWalking(false);
    };
  }, [currentUser, currentView, customRooms, selectedRoomId]);

  const studyKnowledgeGraph = useMemo(() => buildStudyKnowledgeGraph(studyLogs), [studyLogs]);

  const currentUserUid = currentUser?.uid || "";
  const playerName =
    customUserName.trim() || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Developer";
  const playerInitial = playerName.slice(0, 1).toUpperCase();
  const isDesktopApp = Boolean(window.contributionArcDesktop?.isElectron);
  const isOnboardingSettings = onboardingStep === "settings";
  const weeklyStudyHours = getWeeklyStudyHours(studyLogs);
  const maxStudyMinutes = Math.max(1, ...weeklyStudyHours.map((item) => item.totalMinutes));
  const effortExp = getEffortExp(studyLogs);
  const outputExp = getOutputExp();
  const levelState = getLevelState(effortExp + outputExp);
  const titles = getTitleRanks(studyLogs, effortExp, outputExp);
  const currentTitle =
    [...titles].reverse().find((title) => title.unlocked)?.name || "Commit Knight";
  const studyStreak = getStudyStreak(studyLogs);
  const githubProviderInfo = currentUser?.providerData.find((provider) => provider.providerId === "github.com");
  const githubId = githubProviderInfo?.uid || "";
  const githubUsername = githubProviderInfo?.displayName || (githubProviderInfo ? userId : "");
  const totalWeeklyMinutes = weeklyStudyHours.reduce((sum, item) => sum + item.totalMinutes, 0);
  const selectedStudyDayData =
    weeklyStudyHours.find((item) => item.day === selectedStudyDay) ||
    weeklyStudyHours.find((item) => item.isToday) ||
    weeklyStudyHours[0];
  const totalWeeklyLabel =
    totalWeeklyMinutes > 0 && totalWeeklyMinutes < 60
      ? formatStudyTime(totalWeeklyMinutes)
      : `${(Math.round((totalWeeklyMinutes / 60) * 10) / 10).toLocaleString()}h`;
  const allWorkspaceRooms = [...workspaceRooms, ...customRooms].map((room) =>
    normalizeWorkspaceRoom(applyScheduledDetaPresence(normalizeWorkspaceRoom(room), workspaceNow)),
  );
  const selectedRoom = allWorkspaceRooms.find((room) => room.id === selectedRoomId) || allWorkspaceRooms[0];
  const currentBuilding = workspaceTask.trim() || studySubject.trim() || "Deep work";
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

    return {
      ...member,
      name: nextName,
      characterColor: nextCharacterColor,
      color: nextCharacterColor,
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
      : member,
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
      avatar: item.userName === "Mina" || item.userId === "npc-mina" ? minaAvatarPath : "",
      text:
        item.id === "seed-mina-joined"
          ? `${item.userName} committed to Contribution Arc`
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
  const recentStudyActivities: LiveActivity[] = [...studyLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map((log) => ({
      id: `study-${log.id}`,
      userId: currentUserUid,
      userName: playerName,
      avatar: playerAvatar,
      text: `${playerName} completed ${formatStudyTimeJa(log.minutes)} ${log.subject}`,
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
  const accountScope = getAccountStorageScope(currentUserUid, userId);
  const notificationItems = friendRequests
    .filter((request) => request.direction === "incoming" || request.status === "accepted")
    .sort((a, b) => new Date(b.acceptedAt || b.createdAt).getTime() - new Date(a.acceptedAt || a.createdAt).getTime())
    .slice(0, 8);
  const unreadNotificationCount = friendRequests.filter(
    (request) => {
      const notificationAt = request.acceptedAt || request.createdAt;
      const shouldNotify =
        (request.direction === "incoming" && request.status === "pending") ||
        (request.direction === "outgoing" && request.status === "accepted");

      return (
        shouldNotify &&
        (!lastNotificationReadAt || new Date(notificationAt).getTime() > new Date(lastNotificationReadAt).getTime())
      );
    },
  ).length;
  const hasUnreadNotifications = unreadNotificationCount > 0;
  const handleNotificationsToggle = () => {
    const nextIsOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextIsOpen);

    if (nextIsOpen) {
      const nextReadAt = new Date().toISOString();
      setLastNotificationReadAt(nextReadAt);
      safeSetLocalStorage(getAccountStorageKey(accountScope, "notifications-read-at"), nextReadAt);
    }
  };
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
    const nextLog: StudyLog = {
      id: crypto.randomUUID(),
      subject: studySubject.trim(),
      minutes,
      createdAt: new Date().toISOString(),
      color: studyColor,
    };
    setStudyLogs((logs) => [...logs, nextLog]);
    void saveStudyLogToCloud(db, currentUser.uid, nextLog, {
      earnedExp: Math.round(minutes * 1.25),
      source: "manual",
    }).catch((error) => {
      console.info("Study log cloud save skipped.", error);
    });
    setStudyAmount(studyUnit === "hours" ? "1" : "30");
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
    };

    setIsPosting(true);
    setPostError("");
    setPosts((items) => [nextPost, ...items.filter((item) => item.id !== nextPost.id)]);
    setPostDraft("");

    try {
      await savePostToCloud(db, nextPost);
    } catch (error) {
      setPostError(
        getFirestoreErrorMessage(
          error,
          "ログを保存できませんでした。",
          "ログを保存する権限がまだ有効になっていません。少し時間を置いて再度お試しください。",
        ),
      );
      setPosts((items) => items.filter((item) => item.id !== nextPost.id));
      setPostDraft(text);
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

    void togglePostLikeInCloud(db, post.id, currentUser.uid, isLiked).catch((error) => {
      console.info("Post like sync skipped.", error);
      setPostError("リアクションを保存できませんでした。");
    });
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

    setPostDraft(`${latestLog.subject}を${formatStudyTimeJa(latestLog.minutes)}積み上げました。`);
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

    const lastSyncedAt = new Date().toISOString();
    const safeAvatar = getSerializableAvatar(playerAvatar || currentUser.photoURL || "");

    void saveUserProgressToCloud(db, {
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
      streak: studyStreak,
      determination,
      following,
      followers: [],
      unlockedCharacters: [characterOptions[0].id],
      characterExp: effortExp,
      githubId,
      githubUsername,
      contributionCount: outputStats.contributions,
      lastSyncedAt,
    }).catch((error) => {
      console.info("User progress cloud sync skipped.", error);
    });

    void saveGithubActivitySummary(db, {
      userId: currentUser.uid,
      githubId,
      githubUsername,
      contributionCount: outputStats.contributions,
      lastSyncedAt,
    }).catch((error) => {
      console.info("GitHub activity cloud sync skipped.", error);
    });
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
    playerAvatar,
    playerCharacterColor,
    playerName,
    studyStreak,
    userId,
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

    try {
      const userRef = doc(db, "users", currentUser.uid);

      await runTransaction(db, async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        const currentProfile = userSnapshot.exists()
          ? normalizeUserProfile(currentUser.uid, userSnapshot.data() as Partial<UserProfile>)
          : normalizeUserProfile(currentUser.uid, {
              displayName: playerName,
              following,
              photoURL: playerAvatar,
              determination,
              characterColor: playerCharacterColor,
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
            email: currentUser.email || "",
            avatarUrl: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
            photoURL: getSerializableAvatar(playerAvatar || currentUser.photoURL || ""),
            determination,
            characterColor: playerCharacterColor,
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
      });
    } catch (error) {
      if (!canSaveProfileLocally(error)) {
        setSettingsError(
          getFirestoreErrorMessage(
            error,
            "ユーザーIDを保存できませんでした。",
            "ユーザーIDの保存権限が有効になっていません。少し時間を置いて再度お試しください。",
          ),
        );
        setIsSavingSettings(false);
        return;
      }

      console.info("Profile cloud sync skipped; saved locally.", error);
    }

    try {
      const accountScope = getAccountStorageScope(currentUser.uid, nextUserId);
      setUserId(nextUserId);
      setCustomUserName(nextDisplayName);
      safeSetLocalStorage(`contribution-arc-user-id-${currentUser.uid}`, nextUserId);
      safeSetLocalStorage(getAccountStorageKey(accountScope, "name"), nextDisplayName);
      safeSetLocalStorage(`contribution-arc-onboarding-complete-${currentUser.uid}`, "true");
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "プロフィールをこのブラウザに保存できませんでした。ブラウザのストレージ設定を確認してください。",
      );
      setIsSavingSettings(false);
      return;
    }

    setIsSavingSettings(false);
    setOnboardingStep("idle");
    setIsSettingsOpen(false);
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
    } catch (error) {
      console.info("Friend request cloud send skipped.", error);
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

    const sessionLog: StudyLog = {
      id: `workspace-${session.id}`,
      subject: session.building,
      minutes: session.minutes,
      createdAt: session.leftAt,
      color: session.color,
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
      console.info("Workspace study log cloud save skipped.", error);
    });
    setLastRoomSession(session);
  };

  const resetWorkspacePresence = () => {
    pressedWorkspaceKeysRef.current.clear();
    setIsPlayerWalking(false);
    setPendingJoinRoomId(null);
    setLastRoomSession(null);
    setCustomRooms((rooms) => removeWorkspacePresenceForUser(rooms, currentUser.uid));
  };

  const startWorkspaceSession = (roomId: string, task: string, color: string) => {
    const nextTask = task.trim();
    if (!nextTask) {
      return;
    }

    const joinedAt = new Date().toISOString();
    const seatPosition = getWorkspaceSeatPosition(nextTask);
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
    });

    setSelectedRoomId(roomId);
    setWorkspaceTask(nextTask);
    setLastRoomSession(null);
    setPendingJoinRoomId(null);
    setPlayerPosition(seatPosition);
    pressedWorkspaceKeysRef.current.clear();
    setIsPlayerWalking(false);
    setCustomRooms((rooms) => {
      const fallbackRoom = createDefaultWorkspaceRooms().find((room) => room.id === roomId);
      const baseRooms =
        rooms.some((room) => room.id === roomId) || !fallbackRoom
          ? rooms
          : [fallbackRoom, ...rooms.filter((room) => room.id !== roomId)];

      const nextRooms = baseRooms.map((room) => {
        const normalizedRoom = normalizeWorkspaceRoom(room);
        const activeMembers = normalizedRoom.activeMembers.filter((member) => member.userId !== currentUser.uid);

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
    startWorkspaceSession(roomId, workspaceTask || studySubject || "Deep work", studyColor);
  };

  const handleWorkspaceStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingJoinRoomId) {
      return;
    }

    startWorkspaceSession(pendingJoinRoomId, workspaceDraftTask, workspaceDraftColor);
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
                      };
                    })()
                  : member,
              ),
            });

        pendingWorkspaceRoomsRef.current.set(nextRoom.id, nextRoom);
        return nextRoom;
      }),
    );
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
      seatLabels: defaultWorkspaceSeatLabels,
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
    void saveWorkspaceRoomToCloud(room)
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

  const handleSeatLabelsChange = (roomId: string, labels: WorkspaceSeatLabels) => {
    setCustomRooms((rooms) =>
      rooms.map((room) => {
        if (room.id !== roomId || room.createdBy !== currentUser.uid) {
          return room;
        }

        return {
          ...room,
          seatLabels: {
            ...defaultWorkspaceSeatLabels,
            ...labels,
          },
        };
      }),
    );
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
      setSelectedRoomId(nextRooms[0]?.id || createDefaultWorkspaceRooms()[0].id);
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
      post.githubContributionCount > 0 ? `+${post.githubContributionCount.toLocaleString()} commits` : "GitHub ready";

    return (
      <article className={`log-post-card ${variant === "compact" ? "compact" : ""}`} key={post.id}>
        <button type="button" className="log-post-author" onClick={() => handlePostAuthorOpen(post)}>
          <ProfileCharacterPreview color={post.characterColor} />
          <span>
            <strong>{post.username}</strong>
            <small>
              {post.currentTitle || "Builder"} · {formatPostTime(post.createdAt)}
            </small>
          </span>
        </button>

        <p>{post.text}</p>

        <div className="log-post-meta">
          <span>{studyLabel}</span>
          <span>{contributionLabel}</span>
          <span>{roomLabel}</span>
        </div>

        <button
          type="button"
          className={isLiked ? "log-like-button liked" : "log-like-button"}
          onClick={() => handlePostLike(post)}
          aria-label={isLiked ? "ハートを取り消す" : "ハートする"}
        >
          <span aria-hidden="true">{isLiked ? "♥" : "♡"}</span>
          {post.likesCount.toLocaleString()}
        </button>
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
            ログを見る
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

    return (
      <article className="card member-profile-card workspace-member-profile-card">
        <div className="member-profile-hero">
          <ProfileCharacterPreview color={memberProfile.characterColor} />
          <div>
            <p className="card-kicker">Profile</p>
            <h2>{member.name}</h2>
            <small>@{memberProfile.userId}</small>
          </div>
        </div>

        <div className="profile-resolve-panel">
          <span>決意</span>
          <p>{profileResolveText(memberProfile)}</p>
        </div>

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
          <span>
            {isFriend
              ? "つながっています"
              : pendingIncomingRequest
                ? "相手から申請が届いています"
                : pendingOutgoingRequest
                  ? "相手の承認待ちです"
                  : "静かに作業仲間へ追加"}
          </span>
        </div>

        {friendMessage ? <p className="friend-message">{friendMessage}</p> : null}

        <div className="member-profile-grid">
          <div>
            <span>Room</span>
            <strong>{memberRoom?.name || "Silent Workspace"}</strong>
          </div>
          <div>
            <span>Working on</span>
            <strong>
              <i style={{ background: member.color }} />
              {member.building}
            </strong>
          </div>
          <div>
            <span>Stay</span>
            <strong>{formatStayTime(elapsedMinutes)}</strong>
          </div>
          <div>
            <span>Today</span>
            <strong>+{getRoomSessionExp(elapsedMinutes)} EXP</strong>
          </div>
          <div>
            <span>Connection</span>
            <strong>
              <i style={{ background: isFriend ? "#1f6f4a" : hasPendingRequest ? "#c8a95b" : "#d4d4d8" }} />
              {isFriend ? "Friends" : hasPendingRequest ? "Pending" : "Not connected"}
            </strong>
          </div>
        </div>
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

    return (
      <article className="card member-profile-card friend-profile-card">
        <div className="member-profile-hero">
          <ProfileCharacterPreview color={profile.characterColor} />
          <div>
            <p className="card-kicker">Friend Profile</p>
            <h2>{profile.displayName}</h2>
            <small>@{profile.userId}</small>
          </div>
        </div>

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

        <div className="member-profile-grid">
          <div>
            <span>Status</span>
            <strong>
              <i style={{ background: isFriend ? "#1f6f4a" : hasPendingRequest ? "#c8a95b" : "#d4d4d8" }} />
              {isFriend ? "Friends" : hasPendingRequest ? "Pending" : "Not connected"}
            </strong>
          </div>
          <div>
            <span>Community</span>
            <strong>静かな積み上げ</strong>
          </div>
        </div>
        {recentLogsCard(profile.uid)}
      </article>
    );
  };

  return (
    <motion.main
      className={isDesktopApp ? "app-shell premium-shell desktop-shell" : "app-shell premium-shell"}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
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
            <strong>{activeRoom?.name || selectedRoom?.name || "Deep Work Studio"}</strong>
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

      <PremiumSidebar
        currentView={currentView}
        logo={<ContributionArcLogo />}
        roomOnlineCount={roomOnlineCount}
        weeklyStudyLabel={formatStudyTimeJa(totalWeeklyMinutes)}
        friends={sidebarFriends}
        liveActivities={liveActivities}
        onViewChange={setCurrentView}
        onProfileOpen={() => {
          setProfileMember(null);
          setProfileUser(null);
          setCurrentView("profile");
        }}
        onFriendOpen={handleFriendOpen}
        onActivityOpen={handleLiveActivityOpen}
      />

      <div className="app-main-panel">
      <motion.header
        className="site-header premium-dashboard-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
      >
        <div className="topbar-context">
          <p className="card-kicker">Contribution Arc</p>
          <strong>
            {currentView === "workspace"
              ? "作業部屋"
              : currentView === "logs"
                ? "ログ"
              : currentView === "profile"
                ? "プロフィール"
                : "ホーム"}
          </strong>
        </div>
        <div className="user-session">
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
              {unreadNotificationCount > 0 ? <span>{unreadNotificationCount}</span> : null}
            </button>

            {isNotificationsOpen ? (
              <section className="notification-panel" aria-label="お知らせ">
                <div className="notification-head">
                  <p className="card-kicker">Notifications</p>
                  <strong>お知らせ</strong>
                </div>

                <div className="notification-list">
                  {notificationItems.length > 0 ? (
                    notificationItems.map((request) => (
                      <article key={`${request.direction}-${request.id}`} className="notification-item">
                        <button type="button" onClick={() => handleUserProfileOpen(request.profile)}>
                          <span className="notification-avatar">
                            {request.profile.photoURL ? (
                              <img src={request.profile.photoURL} alt="" />
                            ) : (
                              request.profile.displayName.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span>
                            <strong>
                              {request.status === "accepted"
                                ? `${request.profile.displayName}とフレンドになりました`
                                : `${request.profile.displayName}からフレンド申請`}
                            </strong>
                            <small>
                              {new Date(request.acceptedAt || request.createdAt).toLocaleString("ja-JP", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </span>
                        </button>
                        {request.direction === "incoming" && request.status === "pending" ? (
                          <button
                            type="button"
                            className="notification-accept"
                            onClick={(event) => handleNotificationFriendAccept(event, request)}
                          >
                            承認
                          </button>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="notification-empty">新しいお知らせはありません。</p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
          <button
            type="button"
            className="settings-button"
            aria-label="Settings"
            onClick={handleSettingsOpen}
          >
            <SettingsIcon />
          </button>
          <button type="button" className="connect-button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </motion.header>

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
                  <span>分身カラー</span>
                  <div
                    className="character-color-preview compact"
                    style={{ "--actor-color": playerCharacterColor } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span className="actor-sprite deep">
                      <span className="sprite-head" />
                      <span className="sprite-body" />
                      <span className="sprite-leg sprite-leg-left" />
                      <span className="sprite-leg sprite-leg-right" />
                    </span>
                  </div>
                </div>

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
              <p className="card-kicker">Start Session / {pendingJoinRoom.name}</p>
              <h2 id="workspace-start-title">何を積み上げますか。</h2>
            </div>

            <form className="workspace-start-form" onSubmit={handleWorkspaceStart}>
              <label>
                <span>作業内容</span>
                <input
                  value={workspaceDraftTask}
                  onChange={(event) => setWorkspaceDraftTask(event.target.value)}
                  placeholder="React / Java / AWS"
                  maxLength={48}
                  autoFocus
                />
              </label>

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

      {currentView === "logs" ? (
        <motion.section
          className="logs-screen"
          aria-label="Contribution Arc logs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <section className="log-composer-card">
            <div className="log-composer-head">
              <div>
                <p className="card-kicker">Quiet Logs</p>
                <h2>今日の積み上げを静かに残す。</h2>
              </div>
              <span>{posts.length.toLocaleString()} logs</span>
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
              </div>
            </form>
          </section>

          <div className="logs-layout">
            <section className="log-timeline" aria-label="開発ログタイムライン">
              {posts.length > 0 ? (
                posts.map((post) => postCard(post))
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
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
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
                  <article className="card character-color-card">
                    <div className="character-color-head">
                      <div>
                        <p className="card-kicker">分身カラー</p>
                        <h3>キャラクターの色を選択</h3>
                      </div>
                      <div
                        className="character-color-preview"
                        style={{ "--actor-color": playerCharacterColor } as CSSProperties}
                        aria-hidden="true"
                      >
                        <span className="actor-sprite deep">
                          <span className="sprite-head" />
                          <span className="sprite-body" />
                          <span className="sprite-leg sprite-leg-left" />
                          <span className="sprite-leg sprite-leg-right" />
                        </span>
                      </div>
                    </div>

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
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
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
              <div className="room-list" aria-label="Workspace rooms">
                <div className="room-space-list-head">
                  <p className="card-kicker">Spaces</p>
                  <span>静かに積み上げる場所を選ぶ</span>
                </div>
                <div className="room-create-form">
                  <label>
                    <span>Roomを作成</span>
                    <input
                      value={newRoomName}
                      onChange={(event) => {
                        setNewRoomName(event.target.value);
                        if (roomCreateState !== "saving") {
                          setRoomCreateState("idle");
                          setRoomCreateMessage("");
                        }
                      }}
                      placeholder=""
                      maxLength={32}
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
                  </label>
                  <button type="button" onClick={handleRoomCreate}>
                    作成
                  </button>
                </div>
                {roomCreateMessage ? (
                  <p className={`room-create-message ${roomCreateState}`}>{roomCreateMessage}</p>
                ) : null}

                {allWorkspaceRooms.map((room) => {
                  const isOwnRoom = room.createdBy === currentUser.uid;
                  const isActiveRoom = room.id === selectedRoom?.id;
                  const roomMembers = room.activeMembers || [];
                  const isJoinedRoom = roomMembers.some((member) => member.userId === currentUser.uid);

                  return (
                    <article
                      key={room.id}
                      className={["room-card", isActiveRoom ? "active" : "", isJoinedRoom ? "joined" : ""]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className="room-title-display"
                        onClick={() => setSelectedRoomId(room.id)}
                        aria-label={`${room.name}を選択`}
                      >
                        {room.name}
                      </button>
                      <button
                        type="button"
                        className={`room-select-button room-accent-${getRoomAccent(room)}`}
                        onClick={() => setSelectedRoomId(room.id)}
                        aria-label={`${room.name}を表示`}
                      >
                        <span className="room-online-count">
                          <strong>{roomMembers.length}</strong>
                          <em>online</em>
                        </span>
                        <small className="room-supporting-meta">
                          {Math.round(room.totalMinutes / 60)}h / {room.contributions} contributions
                        </small>
                      </button>

                      <div className="room-card-actions">
                        {isJoinedRoom ? (
                          <button
                            type="button"
                            className="room-card-leave-button"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              closeWorkspaceSession(room.id);
                            }}
                          >
                            退出する
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="room-card-join-button"
                            onClick={() => {
                              setSelectedRoomId(room.id);
                              handleRoomJoin(room.id);
                            }}
                          >
                            入室する
                          </button>
                        )}
                      </div>

                      <div className="room-owner-actions">
                        {editingRoomId === room.id ? (
                          <form className="room-title-edit-form" onSubmit={handleRoomTitleSave}>
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
                            <button type="button" className="room-title-edit-button" onClick={() => startRoomTitleEdit(room)}>
                              名前変更
                            </button>
                            {isOwnRoom ? (
                              <button type="button" className="room-delete-button" onClick={() => handleRoomDelete(room.id)}>
                                解体
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="room-detail">
                {selectedRoom ? (
                  <>
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
                      onSeatSelect={(task) => startWorkspaceSession(selectedRoom.id, task, studyColor)}
                      seatLabels={selectedRoom.seatLabels || defaultWorkspaceSeatLabels}
                      canEditSeatLabels={selectedRoom.createdBy === currentUser.uid}
                      onSeatLabelsChange={(labels) => handleSeatLabelsChange(selectedRoom.id, labels)}
                      presetMessages={workspacePresetMessages}
                      onPresetMessagesChange={setWorkspacePresetMessages}
                      onPresetMessage={handleWorkspacePresetMessage}
                      bubbleMessage={workspaceBubble}
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
                    />
                    <section className="room-log-strip" aria-label="このRoomの最近の投稿">
                      <div>
                        <p className="card-kicker">Room Logs</p>
                        <button type="button" onClick={() => setCurrentView("logs")}>
                          ログを開く
                        </button>
                      </div>
                      {selectedRoomPosts.length > 0 ? (
                        <div>{selectedRoomPosts.slice(0, 3).map((post) => postCard(post, "compact"))}</div>
                      ) : (
                        <span>このRoomの投稿はまだありません。</span>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="room-empty-detail">
                    <p className="card-kicker">Silent Workspace</p>
                    <h3>まずはRoomを作成しましょう。</h3>
                    <p>左の入力欄から、自分の集中場所を作成できます。</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </motion.section>
      ) : (
      <motion.div
        className="home-screen"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
      <section className="home-workspace-focus card workspace-2d-card" aria-label="Silent Workspace live view">
        <div className="home-workspace-header">
          <div>
            <p className="card-kicker">Silent Workspace</p>
            <h2>{selectedRoom?.name || "Deep Work Studio"}</h2>
            <p>
              {isInSelectedRoom
                ? `入室中 ${currentStayMinutes > 0 ? formatStayTime(currentStayMinutes) : ""}`
                : "席を選び、定型文だけで気配を届ける。詳細なRoom設定は専用画面で整えます。"}
            </p>
          </div>
          <div className="home-workspace-actions">
            <span className="workspace-online-pill">
              <span>{roomOnlineCount}</span>
              online
            </span>
            <button type="button" onClick={() => setCurrentView("workspace")}>
              詳細設定
            </button>
          </div>
        </div>

        {selectedRoom ? (
          <SilentWorkspaceRoom
            presentation="focus"
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
            onSeatSelect={(task) => startWorkspaceSession(selectedRoom.id, task, studyColor)}
            seatLabels={selectedRoom.seatLabels || defaultWorkspaceSeatLabels}
            canEditSeatLabels={false}
            onSeatLabelsChange={(labels) => handleSeatLabelsChange(selectedRoom.id, labels)}
            presetMessages={workspacePresetMessages}
            onPresetMessagesChange={setWorkspacePresetMessages}
            onPresetMessage={handleWorkspacePresetMessage}
            bubbleMessage={workspaceBubble}
            isPlayerWalking={isPlayerWalking}
            activityItems={roomActivityItems}
            onMemberOpen={handleMemberProfileOpen}
            onActivityOpen={handleRoomActivityOpen}
            lastSessionLabel={
              lastRoomSession ? `+${lastRoomSession.exp} EXP / ${formatStayTime(lastRoomSession.minutes)}を記録` : ""
            }
            totalLearnedLabel={`${Math.round(roomTotalMinutes / 60).toLocaleString()}h learned`}
            contributionLabel={`${roomContributions.toLocaleString()} contributions today`}
          />
        ) : null}
      </section>

      <section className="hero-grid" aria-label="Contribution Arc overview">
        <div className="overview-stack">
          {playerStatusCard(true)}
        </div>

        <article className="card hours-card weekly-card">
          <div className="section-heading compact">
            <div>
              <p className="card-kicker">学習ログ</p>
              <p className="study-total">今週 {formatStudyTimeJa(totalWeeklyMinutes)}</p>
            </div>
            <span className="soft-pill">7日間</span>
          </div>

          <div className="bar-chart" aria-label="直近7日間の学習時間">
            {weeklyStudyHours.map((item, index) => {
              const segments = getStudySegments(item.logs);

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
              <label>
                <span>学習内容</span>
                <input
                  value={studySubject}
                  onChange={(event) => setStudySubject(event.target.value)}
                  placeholder="Java / React / 資格勉強"
                />
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
      </section>

      </motion.div>
      )}
      </div>
    </motion.main>
  );
}

export default App;
