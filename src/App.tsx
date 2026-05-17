import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
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
};

type TitleRank = {
  name: string;
  condition: string;
  unlocked: boolean;
};

type WeeklyStudyDay = {
  day: string;
  hours: number;
  dateLabel: string;
  logs: StudyLog[];
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultStudyLogs: StudyLog[] = [
  { id: "seed-mon", subject: "Java", minutes: 120, createdAt: "2026-05-11T09:00:00.000Z" },
  { id: "seed-tue", subject: "React", minutes: 90, createdAt: "2026-05-12T09:00:00.000Z" },
  { id: "seed-wed", subject: "資格勉強", minutes: 30, createdAt: "2026-05-13T09:00:00.000Z" },
  { id: "seed-thu", subject: "React", minutes: 180, createdAt: "2026-05-14T09:00:00.000Z" },
  { id: "seed-fri", subject: "Java", minutes: 60, createdAt: "2026-05-15T09:00:00.000Z" },
  { id: "seed-sat", subject: "Build", minutes: 240, createdAt: "2026-05-16T09:00:00.000Z" },
  { id: "seed-sun", subject: "資格勉強", minutes: 150, createdAt: "2026-05-17T09:00:00.000Z" },
];

const outputStats = {
  commits: 18,
  contributions: 42,
  pullRequests: 3,
};

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
      hours: Math.round((totalMinutes / 60) * 10) / 10,
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

function PixelHero() {
  return (
    <div className="pixel-hero" aria-label="Commit Knight pixel avatar">
      <span className="pixel-row helmet" />
      <span className="pixel-row face" />
      <span className="pixel-row cape" />
      <span className="pixel-row armor" />
      <span className="pixel-row boots" />
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
        <h1>Contribution Arc is ready to exchange your quest token.</h1>
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

function getAuthErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: string }).code)
    : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/email-already-in-use":
      return "このメールアドレスはすでに登録されています。ログインを試してください。";
    case "auth/popup-closed-by-user":
      return "ログイン画面が閉じられました。もう一度お試しください。";
    case "auth/account-exists-with-different-credential":
      return "同じメールアドレスの別ログイン方法が存在します。別の方法でログインしてください。";
    default:
      return "ログインに失敗しました。設定または入力内容を確認してください。";
  }
}

function LoginScreen() {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setIsSubmitting(true);

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderLogin = async (provider: "google" | "github") => {
    setAuthError("");
    setIsSubmitting(true);

    try {
      await signInWithPopup(auth, provider === "google" ? googleProvider : githubProvider);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-hero-panel" aria-label="Contribution Arc login">
        <div className="login-brand">
          <p className="eyebrow">GitHub Contribution RPG</p>
          <h1>Contribution Arc</h1>
          <p>Turn your commits into experience.</p>
        </div>

        <div className="login-preview-card">
          <div className="login-preview-top">
            <span>Lv.12</span>
            <strong>Commit Knight</strong>
          </div>
          <div className="login-preview-map" aria-hidden="true">
            {contributionMap.slice(0, 42).map((cell) => (
              <span
                key={cell.id}
                className={`map-cell level-${cell.level} terrain-${cell.terrain} ${
                  cell.route ? "is-route" : ""
                } ${cell.event ? "has-event" : ""}`}
              >
                {cell.event ? <PixelIcon type={cell.event} /> : null}
              </span>
            ))}
          </div>
          <p>Every sign-in opens your quest map.</p>
        </div>
      </section>

      <section className="card login-card">
        <p className="card-kicker">Authentication</p>
        <h2>Enter the guild.</h2>
        <p className="login-copy">
          メール、Google、GitHubでログインできます。Contributionを経験値に変える冒険を始めましょう。
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
              placeholder="8 characters or more"
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
            <span>G</span>
            Google
          </button>
          <button
            type="button"
            className="provider-button github"
            onClick={() => handleProviderLogin("github")}
            disabled={isSubmitting}
          >
            <span>GH</span>
            GitHub
          </button>
        </div>

        {authError ? <p className="auth-error">{authError}</p> : null}
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

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const savedLogs = window.localStorage.getItem(`contribution-arc-study-${currentUser.uid}`);
    if (savedLogs) {
      setStudyLogs(JSON.parse(savedLogs) as StudyLog[]);
    } else {
      setStudyLogs(defaultStudyLogs);
    }
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

  if (window.location.pathname === githubCallbackPath) {
    return <GitHubCallbackPage />;
  }

  if (!isAuthReady) {
    return (
      <main className="login-shell loading-auth">
        <section className="card login-card">
          <p className="card-kicker">Contribution Arc</p>
          <h2>Loading your quest...</h2>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const displayName =
    currentUser.displayName || currentUser.email?.split("@")[0] || "Ari";
  const weeklyStudyHours = getWeeklyStudyHours(studyLogs);
  const maxHours = Math.max(1, ...weeklyStudyHours.map((item) => item.hours));
  const effortExp = getEffortExp(studyLogs);
  const outputExp = getOutputExp();
  const levelState = getLevelState(effortExp + outputExp);
  const titles = getTitleRanks(studyLogs, effortExp, outputExp);
  const currentTitle =
    [...titles].reverse().find((title) => title.unlocked)?.name || "Commit Knight";
  const recentLogs = studyLogs.slice(-3).reverse();
  const totalWeeklyHours = weeklyStudyHours.reduce((sum, item) => sum + item.hours, 0);
  const weeklyActiveDays = weeklyStudyHours.filter((item) => item.hours > 0).length;
  const weeklyEffortExp = Math.round(totalWeeklyHours * 80 + weeklyActiveDays * 20);
  const bestStudyDay = weeklyStudyHours.reduce(
    (best, item) => (item.hours > best.hours ? item : best),
    weeklyStudyHours[0],
  );

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
      },
    ]);
    setStudyAmount(studyUnit === "hours" ? "1" : "30");
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="user-session">
          <span>{displayName}</span>
          <button type="button" className="connect-button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      <section className="hero-grid" aria-label="Contribution Arc overview">
        <div className="overview-stack">
          <article className="card status-card">
            <div className="card-kicker">Player Status</div>
            <div className="player-heading">
              <div>
                <h2>Ari Lv.{levelState.level}</h2>
                <p>Class: Frontend Adventurer</p>
              </div>
              <span className="rank-badge">S</span>
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
          </article>

          <article className="card character-card">
            <div className="character-stage">
              <PixelHero />
              <div className="pixel-shadow" />
            </div>
            <div>
              <p className="card-kicker">Current Title</p>
              <h2>{currentTitle}</h2>
              <p>Study fills effort. Commits forge output.</p>
            </div>
          </article>
        </div>

        <article className="card hours-card weekly-card">
          <div className="section-heading compact">
            <div>
              <p className="card-kicker">Weekly Study Log</p>
              <p className="study-total">{totalWeeklyHours.toLocaleString()}h this week</p>
            </div>
            <span className="soft-pill">7 days</span>
          </div>

          <div className="bar-chart" aria-label="Learning hours for the last seven days">
            {weeklyStudyHours.map((item) => (
              <div className="bar-item" key={item.day} tabIndex={0}>
                <div className="bar-shell">
                  <span
                    style={
                      {
                        "--bar-height": `${(item.hours / maxHours) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <div className="bar-tooltip" role="tooltip">
                  <div>
                    <strong>
                      {item.day} / {item.dateLabel}
                    </strong>
                    <span>{item.hours}h logged</span>
                  </div>
                  <p>{getSubjectSummary(item.logs)}</p>
                  <small>+{Math.round(item.hours * 80)} Effort EXP</small>
                </div>
                <strong>{item.day}</strong>
                <small>{item.hours}h</small>
              </div>
            ))}
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
              <button type="submit">Log +EXP</button>
            </form>

            <div className="study-summary" aria-label="Weekly study summary">
              <div>
                <span>Active days</span>
                <strong>{weeklyActiveDays} / 7</strong>
              </div>
              <div>
                <span>Best day</span>
                <strong>{bestStudyDay.day}</strong>
              </div>
              <div>
                <span>Weekly Effort</span>
                <strong>+{weeklyEffortExp}</strong>
              </div>
            </div>

            <div className="recent-log" aria-label="Recent study logs">
              {recentLogs.map((log) => (
                <div key={log.id}>
                  <span>{log.subject}</span>
                  <strong>{formatStudyTime(log.minutes)}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;
