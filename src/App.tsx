import { useEffect, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, githubProvider, googleProvider } from "./firebase";
import "./App.css";

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

type CharacterOption = {
  id: string;
  name: string;
  englishName: string;
  label: string;
  concept: string;
  evolution: string;
};

type WorkspaceMember = {
  userId: string;
  name: string;
  building: string;
  color: string;
  joinedAt: string;
  tone: "deep" | "green" | "soft" | "blue";
  avatar?: string;
};

type WorkspaceSessionHistory = {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  building: string;
  color: string;
  joinedAt: string;
  leftAt: string;
  minutes: number;
  exp: number;
};

type WorkspaceRoom = {
  id: string;
  name: string;
  totalMinutes: number;
  contributions: number;
  commits: number;
  createdAt: string;
  createdBy: string;
  activeMembers: WorkspaceMember[];
  history: WorkspaceSessionHistory[];
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const studyColorOptions = [
  { name: "Forest", value: "#1f6f4a" },
  { name: "Lime", value: "#83bb70" },
  { name: "Teal", value: "#2f8f83" },
  { name: "Blue", value: "#3f6f9f" },
  { name: "Violet", value: "#7667a8" },
  { name: "Gold", value: "#c8a95b" },
];

const defaultStudyLogs: StudyLog[] = [
  {
    id: "seed-mon",
    subject: "Java",
    minutes: 120,
    createdAt: "2026-05-11T09:00:00.000Z",
    color: "#c8a95b",
  },
  {
    id: "seed-tue",
    subject: "React",
    minutes: 90,
    createdAt: "2026-05-12T09:00:00.000Z",
    color: "#3f6f9f",
  },
  {
    id: "seed-wed",
    subject: "資格勉強",
    minutes: 30,
    createdAt: "2026-05-13T09:00:00.000Z",
    color: "#7667a8",
  },
  {
    id: "seed-thu",
    subject: "React",
    minutes: 180,
    createdAt: "2026-05-14T09:00:00.000Z",
    color: "#3f6f9f",
  },
  {
    id: "seed-fri",
    subject: "Java",
    minutes: 60,
    createdAt: "2026-05-15T09:00:00.000Z",
    color: "#c8a95b",
  },
  {
    id: "seed-sat",
    subject: "Build",
    minutes: 240,
    createdAt: "2026-05-16T09:00:00.000Z",
    color: "#2f8f83",
  },
  {
    id: "seed-sun",
    subject: "資格勉強",
    minutes: 150,
    createdAt: "2026-05-17T09:00:00.000Z",
    color: "#7667a8",
  },
];

const outputStats = {
  commits: 18,
  contributions: 42,
  pullRequests: 2,
};

const workspaceRooms: WorkspaceRoom[] = [];
const workspaceRoomsStorageKey = "contribution-arc-workspace-rooms";

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

function getWeeklyStudyHours(logs: StudyLog[]): WeeklyStudyDay[] {
  const weekStart = getWeekStart();
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

function getOutputExp() {
  return outputStats.commits * 90 + outputStats.contributions * 24 + outputStats.pullRequests * 160;
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

function getRoomSessionExp(minutes: number) {
  return Math.max(20, Math.round((minutes / 60) * 80));
}

function getTodayKey(date = new Date()) {
  return date.toDateString();
}

function normalizeWorkspaceRoom(room: WorkspaceRoom): WorkspaceRoom {
  return {
    ...room,
    totalMinutes: room.totalMinutes || 0,
    contributions: room.contributions || 0,
    commits: room.commits || 0,
    createdAt: room.createdAt || new Date().toISOString(),
    createdBy: room.createdBy || "legacy",
    activeMembers: (room.activeMembers || []).map((member) => ({
      ...member,
      color: member.color || studyColorOptions[0].value,
    })),
    history: (room.history || []).map((item) => ({
      ...item,
      color: item.color || studyColorOptions[0].value,
    })),
  };
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
    <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.1 13.4c.08-.46.08-.94 0-1.4l1.62-1.22-1.7-2.95-1.9.78a7.3 7.3 0 0 0-1.2-.7L15.65 5.9h-3.4l-.28 2.02c-.42.18-.82.41-1.2.7l-1.9-.78-1.7 2.95L8.8 12c-.08.46-.08.94 0 1.4l-1.62 1.22 1.7 2.95 1.9-.78c.38.29.78.52 1.2.7l.28 2.02h3.4l.28-2.02c.42-.18.82-.41 1.2-.7l1.9.78 1.7-2.95-1.62-1.22Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
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
            <span>Continue with Google</span>
          </button>
          <button
            type="button"
            className="provider-button github"
            onClick={() => handleProviderLogin("github")}
            disabled={isSubmitting}
          >
            <GitHubIcon />
            <span>Continue with GitHub</span>
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
  const [customUserName, setCustomUserName] = useState("");
  const [draftUserName, setDraftUserName] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "profile">("home");
  const [profileMember, setProfileMember] = useState<WorkspaceMember | null>(null);
  const [determination, setDetermination] = useState("");
  const [draftDetermination, setDraftDetermination] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [customRooms, setCustomRooms] = useState<WorkspaceRoom[]>([]);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [workspaceTask, setWorkspaceTask] = useState("React");
  const [workspaceDraftTask, setWorkspaceDraftTask] = useState("React");
  const [workspaceDraftColor, setWorkspaceDraftColor] = useState(studyColorOptions[0].value);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [workspaceNow, setWorkspaceNow] = useState(Date.now());
  const [lastRoomSession, setLastRoomSession] = useState<WorkspaceSessionHistory | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsWorkspaceLoaded(false);
      setCurrentView("home");
      setProfileMember(null);
      setCurrentUser(user);
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const savedLogs = window.localStorage.getItem(`contribution-arc-study-${currentUser.uid}`);
    const savedUserName = window.localStorage.getItem(`contribution-arc-name-${currentUser.uid}`);
    const savedDetermination = window.localStorage.getItem(`contribution-arc-determination-${currentUser.uid}`);
    const savedAvatar = window.localStorage.getItem(`contribution-arc-avatar-${currentUser.uid}`);
    const savedRoomId = window.localStorage.getItem(`contribution-arc-room-${currentUser.uid}`);
    const savedRooms = window.localStorage.getItem(`contribution-arc-rooms-${currentUser.uid}`);
    const savedWorkspaceTask = window.localStorage.getItem(`contribution-arc-workspace-task-${currentUser.uid}`);
    const sharedRooms = window.localStorage.getItem(workspaceRoomsStorageKey);
    const parsedSharedRooms = sharedRooms
      ? (JSON.parse(sharedRooms) as WorkspaceRoom[]).map(normalizeWorkspaceRoom)
      : [];
    const legacyRooms = savedRooms
      ? (JSON.parse(savedRooms) as WorkspaceRoom[]).map(normalizeWorkspaceRoom)
      : [];
    const parsedRooms = [...parsedSharedRooms];
    legacyRooms.forEach((room) => {
      if (!parsedRooms.some((sharedRoom) => sharedRoom.id === room.id)) {
        parsedRooms.push(room);
      }
    });
    if (savedLogs) {
      setStudyLogs(JSON.parse(savedLogs) as StudyLog[]);
    } else {
      setStudyLogs(defaultStudyLogs);
    }
    setCustomUserName(savedUserName || "");
    setDraftUserName(savedUserName || currentUser.displayName || currentUser.email?.split("@")[0] || "");
    setDetermination(savedDetermination || "");
    setDraftDetermination(savedDetermination || "");
    setPlayerAvatar(savedAvatar || currentUser.photoURL || "");
    setCustomRooms(parsedRooms);
    if (savedRoomId && parsedRooms.some((room) => room.id === savedRoomId)) {
      setSelectedRoomId(savedRoomId);
    } else if (parsedRooms[0]) {
      setSelectedRoomId(parsedRooms[0].id);
    } else {
      setSelectedRoomId("");
    }
    setWorkspaceTask(savedWorkspaceTask || studySubject);
    setWorkspaceDraftTask(savedWorkspaceTask || studySubject);
    setWorkspaceDraftColor(studyColorOptions[0].value);
    setIsWorkspaceLoaded(true);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem(
      `contribution-arc-study-${currentUser.uid}`,
      JSON.stringify(studyLogs),
    );
  }, [currentUser, studyLogs]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem(`contribution-arc-room-${currentUser.uid}`, selectedRoomId);
  }, [currentUser, selectedRoomId]);

  useEffect(() => {
    if (!currentUser || !isWorkspaceLoaded) {
      return;
    }

    window.localStorage.setItem(workspaceRoomsStorageKey, JSON.stringify(customRooms));
  }, [currentUser, customRooms, isWorkspaceLoaded]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    window.localStorage.setItem(
      `contribution-arc-workspace-task-${currentUser.uid}`,
      workspaceTask,
    );
  }, [currentUser, workspaceTask]);

  useEffect(() => {
    const timerId = window.setInterval(() => setWorkspaceNow(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== workspaceRoomsStorageKey || !event.newValue) {
        return;
      }

      setCustomRooms((JSON.parse(event.newValue) as WorkspaceRoom[]).map(normalizeWorkspaceRoom));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
        const nextMembers = room.activeMembers.map((member) => {
          if (member.userId !== currentUser.uid) {
            return member;
          }

          if (member.name === nextName && member.building === nextBuilding && member.avatar === playerAvatar) {
            return member;
          }

          changed = true;
          return {
            ...member,
            name: nextName,
            building: nextBuilding,
            avatar: playerAvatar,
          };
        });

        return nextMembers === room.activeMembers ? room : { ...room, activeMembers: nextMembers };
      });

      return changed ? nextRooms : rooms;
    });
  }, [currentUser, customUserName, isWorkspaceLoaded, playerAvatar, studySubject, workspaceTask]);

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

  const playerName =
    customUserName.trim() || currentUser.displayName || currentUser.email?.split("@")[0] || "Developer";
  const playerInitial = playerName.slice(0, 1).toUpperCase();
  const weeklyStudyHours = getWeeklyStudyHours(studyLogs);
  const maxStudyMinutes = Math.max(1, ...weeklyStudyHours.map((item) => item.totalMinutes));
  const effortExp = getEffortExp(studyLogs);
  const outputExp = getOutputExp();
  const levelState = getLevelState(effortExp + outputExp);
  const titles = getTitleRanks(studyLogs, effortExp, outputExp);
  const currentTitle =
    [...titles].reverse().find((title) => title.unlocked)?.name || "Commit Knight";
  const recentLogs = [...studyLogs].reverse();
  const totalWeeklyMinutes = weeklyStudyHours.reduce((sum, item) => sum + item.totalMinutes, 0);
  const totalWeeklyLabel =
    totalWeeklyMinutes > 0 && totalWeeklyMinutes < 60
      ? formatStudyTime(totalWeeklyMinutes)
      : `${(Math.round((totalWeeklyMinutes / 60) * 10) / 10).toLocaleString()}h`;
  const allWorkspaceRooms = [...workspaceRooms, ...customRooms];
  const selectedRoom = allWorkspaceRooms.find((room) => room.id === selectedRoomId) || allWorkspaceRooms[0];
  const currentBuilding = workspaceTask.trim() || studySubject.trim() || "Deep work";
  const activeRoom =
    customRooms.find((room) => room.activeMembers.some((member) => member.userId === currentUser.uid)) || null;
  const isInSelectedRoom = Boolean(
    selectedRoom?.activeMembers.some((member) => member.userId === currentUser.uid),
  );
  const visibleMembers = selectedRoom?.activeMembers || [];
  const currentPresence = visibleMembers.find((member) => member.userId === currentUser.uid) || null;
  const currentStayMinutes = currentPresence ? getElapsedMinutes(currentPresence.joinedAt, workspaceNow) : 0;
  const roomTotalMinutes =
    (selectedRoom?.totalMinutes || 0) +
    visibleMembers.reduce((sum, member) => sum + getElapsedMinutes(member.joinedAt, workspaceNow), 0);
  const todayRoomHistory = selectedRoom
    ? selectedRoom.history.filter((item) => getTodayKey(new Date(item.leftAt)) === getTodayKey())
    : [];
  const roomContributions = todayRoomHistory.length + (isInSelectedRoom ? 1 : 0);
  const roomCommits = (selectedRoom?.commits || 0) + outputStats.commits;
  const roomOnlineCount = visibleMembers.length;
  const userRoomHistory = customRooms
    .flatMap((room) => room.history.filter((item) => item.userId === currentUser.uid))
    .sort((a, b) => new Date(b.leftAt).getTime() - new Date(a.leftAt).getTime())
    .slice(0, 4);
  const pendingJoinRoom = pendingJoinRoomId
    ? allWorkspaceRooms.find((room) => room.id === pendingJoinRoomId)
    : null;
  const handleStudySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(studyAmount);
    if (!studySubject.trim() || Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const minutes = Math.round(studyUnit === "hours" ? amount * 60 : amount);
    setStudyLogs((logs) => [
      ...logs,
      {
        id: crypto.randomUUID(),
        subject: studySubject.trim(),
        minutes,
        createdAt: new Date().toISOString(),
        color: studyColor,
      },
    ]);
    setStudyAmount(studyUnit === "hours" ? "1" : "30");
  };

  const handleSettingsOpen = () => {
    setDraftUserName(playerName);
    setIsSettingsOpen(true);
  };

  const handleSettingsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftUserName.trim();
    setCustomUserName(nextName);
    window.localStorage.setItem(`contribution-arc-name-${currentUser.uid}`, nextName);
    setIsSettingsOpen(false);
  };

  const handleDeterminationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextDetermination = draftDetermination.trim();
    setDetermination(nextDetermination);
    window.localStorage.setItem(`contribution-arc-determination-${currentUser.uid}`, nextDetermination);
  };

  const handleProfileBack = () => {
    setCurrentView("home");
    setProfileMember(null);
  };

  const handleMemberProfileOpen = (member: WorkspaceMember) => {
    setProfileMember(member.userId === currentUser.uid ? null : member);
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
      setPlayerAvatar(nextAvatar);
      window.localStorage.setItem(`contribution-arc-avatar-${currentUser.uid}`, nextAvatar);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleAvatarRemove = () => {
    setPlayerAvatar("");
    window.localStorage.removeItem(`contribution-arc-avatar-${currentUser.uid}`);
  };

  const closeWorkspaceSession = (roomId: string) => {
    const room = customRooms.find((item) => item.id === roomId);
    const member = room?.activeMembers.find((item) => item.userId === currentUser.uid);
    if (!room || !member) {
      return;
    }

    const leftAt = new Date().toISOString();
    const minutes = getElapsedMinutes(member.joinedAt);
    const session: WorkspaceSessionHistory = {
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      userName: member.name,
      roomId: room.id,
      roomName: room.name,
      building: member.building,
      color: member.color,
      joinedAt: member.joinedAt,
      leftAt,
      minutes,
      exp: getRoomSessionExp(minutes),
    };

    setCustomRooms((rooms) =>
      rooms.map((item) =>
        item.id === roomId
          ? {
              ...item,
              totalMinutes: item.totalMinutes + minutes,
              contributions: item.contributions + 1,
              activeMembers: item.activeMembers.filter((activeMember) => activeMember.userId !== currentUser.uid),
              history: [session, ...item.history],
            }
          : item,
      ),
    );

    setStudyLogs((logs) => [
      ...logs,
      {
        id: `workspace-${session.id}`,
        subject: session.building,
        minutes: session.minutes,
        createdAt: session.leftAt,
        color: session.color,
      },
    ]);
    setLastRoomSession(session);
  };

  const handleRoomJoin = (roomId: string) => {
    setPendingJoinRoomId(roomId);
    setWorkspaceDraftTask(workspaceTask || studySubject || "");
    setWorkspaceDraftColor(studyColor);
  };

  const handleWorkspaceStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingJoinRoomId) {
      return;
    }

    const nextTask = workspaceDraftTask.trim();
    if (!nextTask) {
      return;
    }

    const roomId = pendingJoinRoomId;
    if (activeRoom && activeRoom.id !== roomId) {
      closeWorkspaceSession(activeRoom.id);
    }

    const joinedAt = new Date().toISOString();
    setSelectedRoomId(roomId);
    setWorkspaceTask(nextTask);
    setStudySubject(nextTask);
    setStudyColor(workspaceDraftColor);
    setLastRoomSession(null);
    setPendingJoinRoomId(null);
    setCustomRooms((rooms) =>
      rooms.map((room) => {
        if (room.id !== roomId || room.activeMembers.some((member) => member.userId === currentUser.uid)) {
          return room;
        }

        return {
          ...room,
          activeMembers: [
            ...room.activeMembers,
            {
              userId: currentUser.uid,
              name: playerName,
              building: nextTask,
              color: workspaceDraftColor,
              joinedAt,
              tone: "deep",
              avatar: playerAvatar,
            },
          ],
        };
      }),
    );
  };

  const handleRoomLeave = () => {
    if (!selectedRoom) {
      return;
    }

    closeWorkspaceSession(selectedRoom.id);
  };

  const handleRoomCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const roomName = newRoomName.trim();
    if (!roomName) {
      return;
    }

    const room: WorkspaceRoom = {
      id: `custom-${crypto.randomUUID()}`,
      name: roomName,
      totalMinutes: 0,
      contributions: 0,
      commits: 0,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      activeMembers: [],
      history: [],
    };

    setCustomRooms((rooms) => [...rooms, room]);
    setSelectedRoomId(room.id);
    setNewRoomName("");
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

  const memberProfileCard = (member: WorkspaceMember) => {
    const memberRoom =
      customRooms.find((room) => room.activeMembers.some((item) => item.userId === member.userId)) ||
      selectedRoom;
    const elapsedMinutes = getElapsedMinutes(member.joinedAt, workspaceNow);

    return (
      <article className="card member-profile-card">
        <div className="member-profile-hero">
          <span className={`presence-avatar ${member.tone}`}>
            {member.avatar ? <img src={member.avatar} alt="" /> : member.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="card-kicker">Profile</p>
            <h2>{member.name}</h2>
          </div>
        </div>

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
        </div>
      </article>
    );
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="user-session">
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
      </header>

      {isSettingsOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div>
              <p className="card-kicker">Settings</p>
              <h2 id="settings-title">プロフィール設定</h2>
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

              <div className="settings-actions">
                <button type="button" className="settings-secondary" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="settings-primary">
                  Save
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

      {currentView === "profile" ? (
        <section className="profile-screen" aria-label="Profile">
          <div className="profile-topbar">
            <button type="button" onClick={handleProfileBack}>
              ← Home
            </button>
          </div>

          <div className="profile-layout">
            {profileMember ? (
              memberProfileCard(profileMember)
            ) : (
              <>
                {playerStatusCard(false)}

                <div className="profile-panel-stack">
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
                          rows={8}
                        />
                      </label>
                      <button type="submit">保存</button>
                    </form>
                  </article>
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
      <>
      <section className="hero-grid" aria-label="Contribution Arc overview">
        <div className="overview-stack">
          {playerStatusCard(true)}
        </div>

        <article className="card hours-card weekly-card">
          <div className="section-heading compact">
            <div>
              <p className="card-kicker">Weekly Study Log</p>
              <p className="study-total">{totalWeeklyLabel} this week</p>
            </div>
            <span className="soft-pill">7 days</span>
          </div>

          <div className="bar-chart" aria-label="Learning hours for the last seven days">
            {weeklyStudyHours.map((item) => {
              const segments = getStudySegments(item.logs);

              return (
                <div className="bar-item" key={item.day} tabIndex={0}>
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
                      <div className="bar-stack">
                        {segments.map((segment) => (
                          <span
                            key={segment.key}
                            title={`${segment.subject} ${formatStudyTime(segment.minutes)}`}
                            style={
                              {
                                "--segment-ratio": `${(segment.minutes / item.totalMinutes) * 100}%`,
                                "--bar-color": segment.color,
                              } as CSSProperties
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="bar-tooltip" role="tooltip">
                    <div>
                      <strong>
                        {item.day} / {item.dateLabel}
                      </strong>
                      <span>{formatStudyTime(item.totalMinutes)} logged</span>
                    </div>
                    <p>{getSubjectSummary(item.logs)}</p>
                    <small>+{Math.round(item.hours * 80)} Effort EXP</small>
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
                <span>Quest</span>
                <input
                  value={studySubject}
                  onChange={(event) => setStudySubject(event.target.value)}
                  placeholder="Java / React / 資格勉強"
                />
              </label>
              <label>
                <span>Time</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={studyAmount}
                  onChange={(event) => setStudyAmount(event.target.value)}
                />
              </label>
              <label>
                <span>Unit</span>
                <select
                  value={studyUnit}
                  onChange={(event) => setStudyUnit(event.target.value as "hours" | "minutes")}
                >
                  <option value="hours">h</option>
                  <option value="minutes">m</option>
                </select>
              </label>
              <fieldset className="study-color-field">
                <legend>Color</legend>
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
              <button type="submit">Log +EXP</button>
            </form>

            <div className="recent-log" aria-label="Recent study logs">
              {recentLogs.map((log) => (
                <div key={log.id}>
                  <span>
                    <i style={{ background: log.color || studyColorOptions[0].value }} />
                    <b>{log.subject}</b>
                  </span>
                  <strong>{formatStudyTime(log.minutes)}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="card silent-workspace" aria-label="Silent Workspace">
        <div className="workspace-heading">
          <div>
            <p className="card-kicker">Silent Workspace</p>
            <p>通話も雑談も主役にしない。同じ時間に手を動かしている気配だけを共有します。</p>
          </div>
          <span className="workspace-live-pill">quiet presence</span>
        </div>

        <div className="workspace-layout">
          <div className="room-list" aria-label="Workspace rooms">
            <form className="room-create-form" onSubmit={handleRoomCreate}>
              <label>
                <span>Roomを作成</span>
                <input
                  value={newRoomName}
                  onChange={(event) => setNewRoomName(event.target.value)}
                  placeholder="例: 朝活Build"
                  maxLength={32}
                />
              </label>
              <button type="submit">作成</button>
            </form>

            {allWorkspaceRooms.map((room) => (
              <button
                type="button"
                key={room.id}
                className={room.id === selectedRoom?.id ? "room-card active" : "room-card"}
                onClick={() => setSelectedRoomId(room.id)}
              >
                <span className="room-card-top">
                  <span>{room.name}</span>
                  <span className="room-join-badge">
                    {room.activeMembers.some((member) => member.userId === currentUser.uid) ? "入室中" : "参加"}
                  </span>
                </span>
                <strong>{room.activeMembers.length} online</strong>
                <small>{Math.round(room.totalMinutes / 60)}h learned / {room.contributions} contributions</small>
              </button>
            ))}
          </div>

          <div className="room-detail">
            {selectedRoom ? (
              <>
                <div className="room-detail-top">
                  <div>
                    <p className="card-kicker">{isInSelectedRoom ? "入室中" : "Room"} / {selectedRoom.name}</p>
                    <h3>静かな作業ログ</h3>
                  </div>
                  <div className="room-stay-panel" aria-label="Room stay status">
                    <span>{isInSelectedRoom ? "滞在時間" : "参加者"}</span>
                    <strong>{isInSelectedRoom ? formatStayTime(currentStayMinutes) : `${roomOnlineCount}人`}</strong>
                  </div>
                </div>

                <label className="workspace-task-field">
                  <span>現在の作業</span>
                  <input
                    value={workspaceTask}
                    onChange={(event) => setWorkspaceTask(event.target.value)}
                    placeholder="React / Java / API設計"
                    maxLength={48}
                  />
                </label>

                <div className="room-actions">
                  <button
                    type="button"
                    className={isInSelectedRoom ? "room-leave-button" : "room-join-button"}
                    onClick={() => (isInSelectedRoom ? handleRoomLeave() : handleRoomJoin(selectedRoom.id))}
                  >
                    {isInSelectedRoom ? "退出して学習を記録" : "このRoomに入室"}
                  </button>
                  <span>退出時に滞在時間がWeekly Study Logへ反映されます</span>
                  {lastRoomSession ? (
                    <strong>+{lastRoomSession.exp} EXP / {formatStayTime(lastRoomSession.minutes)}を記録</strong>
                  ) : null}
                </div>

                <div className="presence-list" aria-label="Room presence">
                  {visibleMembers.length > 0 ? (
                    visibleMembers.map((member) => {
                      const minutes = getElapsedMinutes(member.joinedAt, workspaceNow);
                      return (
                        <button
                          type="button"
                          className="presence-card"
                          key={`${member.userId}-${member.joinedAt}`}
                          onClick={() => handleMemberProfileOpen(member)}
                        >
                          <span className={`presence-avatar ${member.tone}`}>
                            {member.avatar ? <img src={member.avatar} alt="" /> : member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>
                              <i style={{ background: member.color }} />
                              {member.name} — {member.building}
                            </strong>
                            <span>{formatStayTime(minutes)}滞在</span>
                            <small>今日 +{getRoomSessionExp(minutes)} EXP</small>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="presence-empty">まだ誰も入室していません。</div>
                  )}
                </div>

                {userRoomHistory.length > 0 ? (
                  <div className="room-history-panel">
                    <p className="card-kicker">学習履歴</p>
                    {userRoomHistory.map((item) => (
                      <article key={item.id}>
                        <span>{new Date(item.leftAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <strong>{item.roomName}</strong>
                        <small>
                          <i style={{ background: item.color }} />
                          {item.building} / {formatStayTime(item.minutes)} / +{item.exp} EXP
                        </small>
                      </article>
                    ))}
                  </div>
                ) : null}

                <div className="room-output-panel">
                  <div>
                    <p className="card-kicker">Tonight's Output</p>
                    <h3>{roomCommits.toLocaleString()} commits</h3>
                    <span>{Math.round(roomTotalMinutes / 60).toLocaleString()}h learned</span>
                  </div>
                  <div className="room-heatmap" aria-hidden="true">
                    {Array.from({ length: 42 }, (_, index) => (
                      <span
                        key={index}
                        className={`heat-${(index + roomOnlineCount + selectedRoom.contributions) % 5}`}
                        style={{ animationDelay: `${index * 18}ms` }}
                      />
                    ))}
                  </div>
                  <div className="room-output-meta">
                    <strong>{roomContributions.toLocaleString()}</strong>
                    <span>contributions today</span>
                  </div>
                </div>
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
      </>
      )}
    </main>
  );
}

export default App;
